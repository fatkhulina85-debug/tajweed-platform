-- Stage 3: course structure, sources, assignments, cohorts.
--
-- Visibility rules:
--   admin    - everything, drafts included;
--   teacher  - published content of every course (needed to review students);
--   student  - published content of courses they are enrolled in through an
--              active cohort. A lesson is visible only if the lesson, its
--              module and its course are all published.
-- Only admins write content. Quiz answer keys live in a separate table that
-- only admins can read.

create type public.content_status as enum ('draft', 'published', 'archived');
create type public.source_audit_status as enum ('pending', 'in_review', 'verified', 'not_required');
create type public.verification_status as enum ('pending', 'verified', 'rejected');
create type public.rights_status as enum ('unknown', 'permitted', 'restricted', 'own');
create type public.block_type as enum ('text', 'arabic', 'table', 'makhraj', 'sifat', 'mastery');
create type public.authoring_type as enum ('source', 'authored');
create type public.assignment_type as enum ('quiz', 'audio', 'written');
create type public.question_type as enum ('single_choice', 'multiple_choice');

-- ---------------------------------------------------------------------------
-- Sources
-- ---------------------------------------------------------------------------

create table public.source_references (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '',
  edition text not null default '',
  page_or_section text not null default '',
  rights_status public.rights_status not null default 'unknown',
  verification_status public.verification_status not null default 'pending',
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Course structure
-- ---------------------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  title_ar text not null default '',
  description text not null default '',
  status public.content_status not null default 'draft',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 1 and 200),
  title_ar text not null default '',
  description text not null default '',
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modules_position_unique unique (course_id, position) deferrable initially immediate
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete restrict,
  position integer not null check (position > 0),
  title text not null check (char_length(title) between 1 and 200),
  title_ar text not null default '',
  objectives jsonb not null default '[]' check (jsonb_typeof(objectives) = 'array'),
  estimated_minutes integer check (estimated_minutes between 1 and 600),
  status public.content_status not null default 'draft',
  source_audit_status public.source_audit_status not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_position_unique unique (module_id, position) deferrable initially immediate,
  -- Unaudited material must not reach students (specification, section 4).
  constraint lessons_publish_requires_audit
    check (status <> 'published' or source_audit_status in ('verified', 'not_required'))
);

create table public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position integer not null check (position > 0),
  block_type public.block_type not null,
  title text not null default '',
  body jsonb not null default '{}' check (jsonb_typeof(body) = 'object'),
  -- null: shown in every interface language; otherwise only in that one.
  locale text check (locale in ('ru', 'ar')),
  authoring_type public.authoring_type not null default 'authored',
  source_reference_id uuid references public.source_references (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_blocks_position_unique unique (lesson_id, position) deferrable initially immediate,
  constraint lesson_blocks_source_required
    check (authoring_type <> 'source' or source_reference_id is not null)
);

create index modules_course_id on public.modules (course_id);
create index lessons_module_id on public.lessons (module_id);
create index lessons_status on public.lessons (status);
create index lesson_blocks_lesson_id on public.lesson_blocks (lesson_id);
create index lesson_blocks_source on public.lesson_blocks (source_reference_id);

-- ---------------------------------------------------------------------------
-- Assignments and quizzes
-- ---------------------------------------------------------------------------

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons (id) on delete restrict,
  module_id uuid references public.modules (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 200),
  instructions text not null default '',
  type public.assignment_type not null,
  rubric jsonb not null default '[]' check (jsonb_typeof(rubric) = 'array'),
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_one_parent check (num_nonnulls(lesson_id, module_id) = 1)
);

create index assignments_lesson_id on public.assignments (lesson_id);
create index assignments_module_id on public.assignments (module_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  position integer not null check (position > 0),
  type public.question_type not null default 'single_choice',
  prompt text not null check (char_length(prompt) between 1 and 2000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  points integer not null default 1 check (points between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_position_unique unique (assignment_id, position) deferrable initially immediate
);

-- Kept apart from quiz_questions so the key never reaches a student's
-- browser, not even through a direct API call.
create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_options jsonb not null check (jsonb_typeof(correct_options) = 'array' and jsonb_array_length(correct_options) >= 1),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cohorts (enrolment)
-- ---------------------------------------------------------------------------

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.cohort_members (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, student_id)
);

create index cohorts_course_id on public.cohorts (course_id);
create index cohort_members_student_id on public.cohort_members (student_id);

-- Assign a teacher to a whole cohort as well as to single students.
alter table public.teacher_assignments
  add column cohort_id uuid references public.cohorts (id) on delete restrict,
  alter column student_id drop not null,
  add constraint teacher_assignments_one_target check (num_nonnulls(student_id, cohort_id) = 1);

create index teacher_assignments_cohort_id on public.teacher_assignments (cohort_id);

-- Cohort assignments need a teacher only; the student check applies to direct ones.
create or replace function private.check_teacher_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_roles where user_id = new.teacher_id and role = 'teacher') then
    raise exception 'teacher_id must have the teacher role' using errcode = '23514';
  end if;
  if new.student_id is not null
     and not exists (select 1 from public.user_roles where user_id = new.student_id and role = 'student') then
    raise exception 'student_id must have the student role' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger teacher_assignments_check_roles on public.teacher_assignments;
create trigger teacher_assignments_check_roles
  before insert or update of teacher_id, student_id, cohort_id on public.teacher_assignments
  for each row execute function private.check_teacher_assignment();

-- A teacher of a cohort is a teacher of each active member.
create or replace function private.is_teacher_of(_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('teacher') and exists (
    select 1
    from public.teacher_assignments ta
    left join public.cohort_members cm
      on cm.cohort_id = ta.cohort_id and cm.status = 'active'
    where ta.teacher_id = (select auth.uid())
      and ta.active
      and coalesce(ta.student_id, cm.student_id) = _student_id
  );
$$;

-- Only students can be enrolled.
create function private.check_cohort_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_roles where user_id = new.student_id and role = 'student') then
    raise exception 'student_id must have the student role' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger cohort_members_check_role
  before insert or update of student_id on public.cohort_members
  for each row execute function private.check_cohort_member();

-- ---------------------------------------------------------------------------
-- Visibility helpers (SECURITY DEFINER for the same reason as has_role:
-- they read parent rows without recursing through RLS).
-- ---------------------------------------------------------------------------

create function private.is_enrolled(_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('student') and exists (
    select 1
    from public.cohort_members cm
    join public.cohorts c on c.id = cm.cohort_id
    where cm.student_id = (select auth.uid())
      and cm.status = 'active'
      and c.status = 'active'
      and c.course_id = _course_id
  );
$$;

create function private.course_visible(_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin') or exists (
    select 1 from public.courses c
    where c.id = _course_id
      and c.status = 'published'
      and (private.has_role('teacher') or private.is_enrolled(c.id))
  );
$$;

create function private.module_visible(_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin') or exists (
    select 1 from public.modules m
    where m.id = _module_id
      and m.status = 'published'
      and private.course_visible(m.course_id)
  );
$$;

create function private.lesson_visible(_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin') or exists (
    select 1 from public.lessons l
    where l.id = _lesson_id
      and l.status = 'published'
      and private.module_visible(l.module_id)
  );
$$;

create function private.assignment_visible(_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin') or exists (
    select 1 from public.assignments a
    where a.id = _assignment_id
      and a.status = 'published'
      and (
        (a.lesson_id is not null and private.lesson_visible(a.lesson_id))
        or (a.module_id is not null and private.module_visible(a.module_id))
      )
  );
$$;

-- A source is visible to whoever can see a lesson that cites it.
create function private.source_visible(_source_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin') or exists (
    select 1 from public.lesson_blocks b
    where b.source_reference_id = _source_id
      and private.lesson_visible(b.lesson_id)
  );
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'private.is_enrolled(uuid)', 'private.course_visible(uuid)', 'private.module_visible(uuid)',
    'private.lesson_visible(uuid)', 'private.assignment_visible(uuid)', 'private.source_visible(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: timestamps, publish date, audit trail
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'source_references', 'courses', 'modules', 'lessons', 'lesson_blocks',
    'assignments', 'quiz_questions', 'cohorts', 'cohort_members'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.touch_updated_at()',
      t || '_updated_at', t);
  end loop;
end;
$$;

create trigger quiz_answer_keys_updated_at
  before update on public.quiz_answer_keys
  for each row execute function private.touch_updated_at();

create function private.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger lessons_published_at
  before insert or update of status on public.lessons
  for each row execute function private.stamp_published_at();

-- Status changes of content are the "history of changes" for publishing.
create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row jsonb := to_jsonb(coalesce(new, old));
  _metadata jsonb;
begin
  _metadata := case
    when tg_table_name = 'user_roles' then
      jsonb_build_object('user_id', _row ->> 'user_id', 'role', _row ->> 'role')
    when tg_table_name = 'teacher_assignments' then jsonb_build_object(
      'teacher_id', _row ->> 'teacher_id', 'student_id', _row ->> 'student_id',
      'cohort_id', _row ->> 'cohort_id', 'active', _row -> 'active')
    when tg_table_name = 'cohort_members' then jsonb_build_object(
      'cohort_id', _row ->> 'cohort_id', 'student_id', _row ->> 'student_id', 'status', _row ->> 'status')
    when tg_table_name in ('profiles', 'courses', 'modules', 'lessons', 'assignments') then
      jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status')
    else '{}'::jsonb
  end;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), lower(tg_op), tg_table_name, _row ->> 'id', _metadata);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['courses', 'modules', 'lessons', 'assignments'] loop
    execute format(
      'create trigger %I after update of status on public.%I for each row '
      'when (old.status is distinct from new.status) execute function private.audit_change()',
      t || '_audit_status', t);
  end loop;
end;
$$;

create trigger cohort_members_audit
  after insert or update or delete on public.cohort_members
  for each row execute function private.audit_change();

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'source_references', 'courses', 'modules', 'lessons', 'lesson_blocks',
    'assignments', 'quiz_questions', 'quiz_answer_keys', 'cohorts', 'cohort_members'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (private.has_role(''admin'')) with check (private.has_role(''admin''))',
      t || ': admins manage', t);
  end loop;
end;
$$;

-- Read policies for everyone else. Policies are OR-ed with "admins manage".
create policy "courses: visible courses"
  on public.courses for select to authenticated
  using (private.course_visible(id));

create policy "modules: visible modules"
  on public.modules for select to authenticated
  using (private.module_visible(id));

create policy "lessons: visible lessons"
  on public.lessons for select to authenticated
  using (private.lesson_visible(id));

create policy "lesson_blocks: blocks of visible lessons"
  on public.lesson_blocks for select to authenticated
  using (private.lesson_visible(lesson_id));

create policy "source_references: cited in visible lessons"
  on public.source_references for select to authenticated
  using (private.has_role('teacher') or private.source_visible(id));

create policy "assignments: visible assignments"
  on public.assignments for select to authenticated
  using (private.assignment_visible(id));

create policy "quiz_questions: questions of visible assignments"
  on public.quiz_questions for select to authenticated
  using (private.assignment_visible(assignment_id));

-- quiz_answer_keys: admins only (the "admins manage" policy above).

create policy "cohorts: members and their teachers"
  on public.cohorts for select to authenticated
  using (
    exists (
      select 1 from public.cohort_members cm
      where cm.cohort_id = cohorts.id and cm.student_id = (select auth.uid())
    )
    or exists (
      select 1 from public.teacher_assignments ta
      where ta.cohort_id = cohorts.id and ta.teacher_id = (select auth.uid()) and ta.active
    )
  );

create policy "cohort_members: own rows and teachers of the student"
  on public.cohort_members for select to authenticated
  using (student_id = (select auth.uid()) or private.is_teacher_of(student_id));
