-- Access tests for profiles, roles, teacher assignments and the audit log.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- Fixtures (as postgres) ------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a1', 'teacher@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'teacher2@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'student1@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'student2@test.local');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-0000000000a1', 'teacher'),
  ('00000000-0000-0000-0000-0000000000a2', 'teacher'),
  ('00000000-0000-0000-0000-0000000000b1', 'student'),
  ('00000000-0000-0000-0000-0000000000b2', 'student');

insert into public.teacher_assignments (teacher_id, student_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

create function pg_temp.login(_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;

-- Student 1 -------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');

select results_eq('select count(*)::int from public.profiles', array[1],
  'student sees only their own profile');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'student cannot read another student''s profile');
select lives_ok($$ update public.profiles set display_name = 'Амина' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'student can rename themselves');
select throws_ok($$ update public.profiles set status = 'blocked' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'student cannot change their own status');
select is_empty($$ update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-0000000000b2' returning id $$,
  'student cannot update another profile');
select throws_ok($$ update public.profiles set email = 'x@test.local' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'student cannot change the email column');
select throws_ok($$ insert into public.user_roles (user_id, role, created_by)
  values ('00000000-0000-0000-0000-0000000000b1', 'admin', '00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'student cannot grant themselves admin');
select results_eq('select count(*)::int from public.user_roles', array[1],
  'student sees only their own role');
select is_empty('select 1 from public.audit_logs', 'student cannot read the audit log');
select results_eq('select count(*)::int from public.teacher_assignments', array[1],
  'student sees their own teacher assignment');
select throws_ok($$ insert into public.teacher_assignments (teacher_id, student_id, created_by)
  values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'student cannot assign a teacher');

-- Teacher 1 (assigned to student 1) ---------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');

select results_eq('select count(*)::int from public.profiles', array[2],
  'teacher sees themselves and their assigned student');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'teacher cannot read an unassigned student');
select results_eq('select count(*)::int from public.teacher_assignments', array[1],
  'teacher sees their own assignments');
select is_empty($$ update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-0000000000b1' returning id $$,
  'teacher cannot edit a student''s profile');

-- Teacher 2 (no students) -------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');

select results_eq('select count(*)::int from public.profiles', array[1],
  'teacher without assignments sees only themselves');

-- Anonymous -------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select 1 from public.user_roles', '42501', null, 'anon cannot read roles');
select throws_ok($$ select private.has_role('admin') $$, '42501', null, 'anon cannot call private helpers');

-- Admin -----------------------------------------------------------------------
reset role;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

select results_eq($$ select count(*)::int from public.profiles where email like '%@test.local' and id::text like '00000000-%' $$,
  array[5], 'admin sees every profile');
select lives_ok($$ insert into public.user_roles (user_id, role, created_by)
  values ('00000000-0000-0000-0000-0000000000b2', 'teacher', '00000000-0000-0000-0000-00000000000a') $$,
  'admin can grant a role');
select isnt_empty($$ select 1 from public.audit_logs
  where entity_type = 'user_roles' and action = 'insert'
    and actor_user_id = '00000000-0000-0000-0000-00000000000a'
    and metadata ->> 'role' = 'teacher' $$,
  'granting a role is written to the audit log');
select lives_ok($$ update public.profiles set status = 'blocked' where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'admin can block a user');
select throws_ok($$ delete from public.user_roles
  where user_id = '00000000-0000-0000-0000-00000000000a' and role = 'admin' $$,
  '42501', null, 'admin cannot remove their own admin role');
select throws_ok($$ update public.profiles set status = 'blocked' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'admin cannot block themselves');
select lives_ok($$ insert into public.teacher_assignments (teacher_id, student_id, created_by)
  values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a') $$,
  'admin can assign a teacher');
select throws_ok($$ insert into public.teacher_assignments (teacher_id, student_id, created_by)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a') $$,
  '23514', null, 'an assignment must point at a student');

-- Blocked user ------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');

select is(private.has_role('teacher'), false, 'a blocked user loses their roles');

select * from finish();
rollback;
