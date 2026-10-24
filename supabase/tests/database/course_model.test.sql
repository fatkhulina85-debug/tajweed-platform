-- Access tests for courses, modules, lessons, blocks, sources, assignments, cohorts.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Fixtures (as postgres) ------------------------------------------------------
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'c-admin@test.local'),
  ('10000000-0000-0000-0000-0000000000a1', 'c-teacher@test.local'),
  ('10000000-0000-0000-0000-0000000000a2', 'c-teacher2@test.local'),
  ('10000000-0000-0000-0000-0000000000b1', 'c-student1@test.local'),
  ('10000000-0000-0000-0000-0000000000b2', 'c-student2@test.local');

insert into public.user_roles (user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-0000000000a1', 'teacher'),
  ('10000000-0000-0000-0000-0000000000a2', 'teacher'),
  ('10000000-0000-0000-0000-0000000000b1', 'student'),
  ('10000000-0000-0000-0000-0000000000b2', 'student');

insert into public.source_references (id, title) values
  ('20000000-0000-0000-0000-000000000001', 'Cited source'),
  ('20000000-0000-0000-0000-000000000002', 'Unused source');

insert into public.courses (id, slug, title, status) values
  ('30000000-0000-0000-0000-000000000001', 'published-course', 'Published course', 'published'),
  ('30000000-0000-0000-0000-000000000002', 'draft-course', 'Draft course', 'draft');

insert into public.modules (id, course_id, position, title, status) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'Published module', 'published'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 2, 'Draft module', 'draft'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 1, 'Module of draft course', 'published');

insert into public.lessons (id, module_id, position, title, status, source_audit_status) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 1, 'Published lesson', 'published', 'not_required'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 2, 'Draft lesson', 'draft', 'pending'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 1, 'Lesson in draft module', 'published', 'verified'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 1, 'Lesson in draft course', 'published', 'verified');

insert into public.lesson_blocks (lesson_id, position, block_type, body, authoring_type, source_reference_id) values
  ('50000000-0000-0000-0000-000000000001', 1, 'text', '{"text":"visible"}', 'source', '20000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', 1, 'text', '{"text":"draft"}', 'authored', null);

insert into public.assignments (id, lesson_id, title, type, status) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Published quiz', 'quiz', 'published'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Draft quiz', 'quiz', 'draft');

insert into public.quiz_questions (id, assignment_id, position, prompt, options) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 1, 'Q?', '["a","b"]'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 1, 'Draft Q?', '["a","b"]');

insert into public.quiz_answer_keys (question_id, correct_options) values
  ('70000000-0000-0000-0000-000000000001', '[0]');

insert into public.cohorts (id, course_id, name) values
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Group 1'),
  ('80000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Group 2');

insert into public.cohort_members (cohort_id, student_id) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000b1'),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000b1');

insert into public.teacher_assignments (teacher_id, cohort_id) values
  ('10000000-0000-0000-0000-0000000000a2', '80000000-0000-0000-0000-000000000001');

create function pg_temp.login(_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;

-- Enrolled student --------------------------------------------------------------
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000b1');

select results_eq('select count(*)::int from public.courses', array[1],
  'student sees only published courses they are enrolled in');
select results_eq('select count(*)::int from public.modules', array[1],
  'student does not see draft modules or modules of draft courses');
select results_eq('select count(*)::int from public.lessons', array[1],
  'student sees a lesson only when lesson, module and course are published');
select results_eq('select count(*)::int from public.lesson_blocks', array[1],
  'student does not see blocks of draft lessons');
select results_eq('select count(*)::int from public.assignments', array[1],
  'student does not see draft assignments');
select results_eq('select count(*)::int from public.quiz_questions', array[1],
  'student sees questions of published assignments only');
select is_empty('select 1 from public.quiz_answer_keys', 'student cannot read answer keys');
select results_eq('select count(*)::int from public.source_references', array[1],
  'student sees only sources cited in visible lessons');
select throws_ok($$ insert into public.courses (slug, title) values ('x', 'x') $$,
  '42501', null, 'student cannot create a course');
select is_empty($$ update public.lessons set title = 'x' where id = '50000000-0000-0000-0000-000000000001' returning id $$,
  'student cannot edit a lesson');
select results_eq('select count(*)::int from public.cohorts', array[2], 'student sees their own cohorts');

-- Student without enrolment -------------------------------------------------------
select pg_temp.login('10000000-0000-0000-0000-0000000000b2');

select is_empty('select 1 from public.courses', 'student without a cohort sees no courses');
select is_empty('select 1 from public.lessons', 'student without a cohort sees no lessons');

-- Teacher ---------------------------------------------------------------------
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');

select results_eq($$ select count(*)::int from public.courses where id::text like '30000000-%' $$, array[1], 'teacher sees published courses only');
select results_eq($$ select count(*)::int from public.lessons where id::text like '50000000-%' $$, array[1], 'teacher does not see unpublished lessons');
select is_empty('select 1 from public.quiz_answer_keys', 'teacher cannot read answer keys');
select results_eq($$ select count(*)::int from public.source_references where id::text like '20000000-%' $$, array[2], 'teacher sees the source registry');

-- Teacher of a cohort ---------------------------------------------------------------
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');

select results_eq($$ select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-0000000000b1' $$,
  array[1], 'a cohort teacher sees the cohort''s students');

-- Anonymous -------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select 1 from public.courses', '42501', null, 'anon cannot read courses');

-- Admin -----------------------------------------------------------------------
reset role;
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-00000000000a');

select results_eq($$ select count(*)::int from public.lessons where id::text like '50000000-%' $$,
  array[4], 'admin sees drafts');
select throws_ok($$ update public.lessons set status = 'published' where id = '50000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'a lesson waiting for source audit cannot be published');
select lives_ok($$ update public.lessons set source_audit_status = 'verified', status = 'published'
  where id = '50000000-0000-0000-0000-000000000002' $$,
  'admin publishes an audited lesson');
select isnt_empty($$ select 1 from public.lessons where id = '50000000-0000-0000-0000-000000000002' and published_at is not null $$,
  'publishing stamps published_at');
select isnt_empty($$ select 1 from public.audit_logs
  where entity_type = 'lessons' and entity_id = '50000000-0000-0000-0000-000000000002'
    and metadata ->> 'to' = 'published' and actor_user_id = '10000000-0000-0000-0000-00000000000a' $$,
  'publishing is written to the audit log');
select results_eq($$ select count(*)::int from public.quiz_answer_keys where question_id::text like '70000000-%' $$,
  array[1], 'admin reads answer keys');
select throws_ok($$ insert into public.lesson_blocks (lesson_id, position, block_type, authoring_type)
  values ('50000000-0000-0000-0000-000000000001', 9, 'text', 'source') $$,
  '23514', null, 'a source-based block must cite a source');
select throws_ok($$ insert into public.lessons (module_id, position, title)
  values ('40000000-0000-0000-0000-000000000001', 1, 'Duplicate position') $$,
  '23505', null, 'lesson positions are unique within a module');
select throws_ok($$ insert into public.cohort_members (cohort_id, student_id)
  values ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1') $$,
  '23514', null, 'only students can be enrolled');

-- Student again: new lesson appears in order; leaving the cohort hides the course
select pg_temp.login('10000000-0000-0000-0000-0000000000b1');
select results_eq('select position from public.lessons order by position', array[1, 2],
  'a newly published lesson appears in order');

reset role;
update public.cohort_members set status = 'left'
  where student_id = '10000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000b1');
select is_empty('select 1 from public.courses', 'a student who left the cohort loses access');

select * from finish();
rollback;
