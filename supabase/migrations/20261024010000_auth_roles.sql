-- Stage 2: profiles, roles, teacher assignments and the audit log.
--
-- Deletion policy: users are blocked (profiles.status = 'blocked'), not deleted.
-- Foreign keys to profiles use ON DELETE RESTRICT so deleting a user with
-- learning history fails instead of silently removing that history.

-- Helpers live in a schema that PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.app_role as enum ('student', 'teacher', 'admin');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null,
  display_name text not null default '' check (char_length(display_name) <= 120),
  locale text not null default 'ru' check (locale in ('ru', 'ar')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.app_role not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (teacher_id <> student_id)
);

create unique index teacher_assignments_active_pair
  on public.teacher_assignments (teacher_id, student_id) where active;
create index teacher_assignments_student_id on public.teacher_assignments (student_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_created_at on public.audit_logs (created_at desc);
create index audit_logs_actor on public.audit_logs (actor_user_id);

-- ---------------------------------------------------------------------------
-- Access helpers
--
-- SECURITY DEFINER is needed so policies can read user_roles and
-- teacher_assignments without recursing into their own RLS policies.
-- The functions only answer questions about the calling user (auth.uid()),
-- use an empty search_path and are not callable by anon.
-- ---------------------------------------------------------------------------

create function private.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid())
      and r.role = _role
      and p.status = 'active'
  );
$$;

create function private.is_teacher_of(_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('teacher') and exists (
    select 1
    from public.teacher_assignments ta
    where ta.teacher_id = (select auth.uid())
      and ta.student_id = _student_id
      and ta.active
  );
$$;

revoke all on function private.has_role(public.app_role) from public, anon;
revoke all on function private.is_teacher_of(uuid) from public, anon;
grant execute on function private.has_role(public.app_role) to authenticated, service_role;
grant execute on function private.is_teacher_of(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile. No role is granted here: roles are assigned by an
-- admin, never taken from user-editable metadata.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'ru' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.sync_user_email();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger teacher_assignments_updated_at
  before update on public.teacher_assignments
  for each row execute function private.touch_updated_at();

-- Only admins may change a profile's status. Requests without a user
-- (service role, migrations) are trusted server code.
create function private.guard_profile_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and (select auth.uid()) is not null
     and not private.has_role('admin') then
    raise exception 'only admins can change profile status' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.id = (select auth.uid()) then
    raise exception 'admins cannot change their own status' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_status
  before update of status on public.profiles
  for each row execute function private.guard_profile_status();

-- An admin cannot remove their own admin role (prevents locking everyone out).
create function private.guard_own_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.user_id = (select auth.uid()) then
    raise exception 'admins cannot remove their own admin role' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger user_roles_guard_own_admin
  before delete on public.user_roles
  for each row execute function private.guard_own_admin_role();

-- Assignments must link a teacher to a student.
create function private.check_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_roles where user_id = new.teacher_id and role = 'teacher') then
    raise exception 'teacher_id must have the teacher role' using errcode = '23514';
  end if;
  if not exists (select 1 from public.user_roles where user_id = new.student_id and role = 'student') then
    raise exception 'student_id must have the student role' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger teacher_assignments_check_roles
  before insert or update of teacher_id, student_id on public.teacher_assignments
  for each row execute function private.check_teacher_assignment();

-- Audit trail for privileged changes. Clients cannot write audit_logs directly.
create function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row jsonb := to_jsonb(coalesce(new, old));
  _metadata jsonb;
begin
  _metadata := case tg_table_name
    when 'user_roles' then jsonb_build_object('user_id', _row ->> 'user_id', 'role', _row ->> 'role')
    when 'teacher_assignments' then jsonb_build_object(
      'teacher_id', _row ->> 'teacher_id', 'student_id', _row ->> 'student_id', 'active', _row -> 'active')
    when 'profiles' then jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status')
    else '{}'::jsonb
  end;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), lower(tg_op), tg_table_name, _row ->> 'id', _metadata);
  return null;
end;
$$;

create trigger user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function private.audit_change();

create trigger teacher_assignments_audit
  after insert or update or delete on public.teacher_assignments
  for each row execute function private.audit_change();

create trigger profiles_audit_status
  after update of status on public.profiles
  for each row when (old.status is distinct from new.status)
  execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.user_roles, public.teacher_assignments, public.audit_logs
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, locale, status) on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant select, insert, update on public.teacher_assignments to authenticated;
grant select on public.audit_logs to authenticated;

-- profiles
create policy "profiles: read own, assigned students, or any as admin"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or private.has_role('admin')
    or private.is_teacher_of(id)
  );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles: admins update any"
  on public.profiles for update to authenticated
  using (private.has_role('admin'))
  with check (private.has_role('admin'));

-- user_roles
create policy "user_roles: read own or any as admin"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('admin'));

create policy "user_roles: admins grant"
  on public.user_roles for insert to authenticated
  with check (private.has_role('admin') and created_by = (select auth.uid()));

create policy "user_roles: admins revoke"
  on public.user_roles for delete to authenticated
  using (private.has_role('admin'));

-- teacher_assignments
create policy "teacher_assignments: participants and admins read"
  on public.teacher_assignments for select to authenticated
  using (
    private.has_role('admin')
    or (teacher_id = (select auth.uid()) and private.has_role('teacher'))
    or student_id = (select auth.uid())
  );

create policy "teacher_assignments: admins create"
  on public.teacher_assignments for insert to authenticated
  with check (private.has_role('admin') and created_by = (select auth.uid()));

create policy "teacher_assignments: admins update"
  on public.teacher_assignments for update to authenticated
  using (private.has_role('admin'))
  with check (private.has_role('admin'));

-- audit_logs
create policy "audit_logs: admins read"
  on public.audit_logs for select to authenticated
  using (private.has_role('admin'));
