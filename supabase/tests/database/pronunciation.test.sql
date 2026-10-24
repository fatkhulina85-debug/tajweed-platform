-- Access tests for pronunciation attempts, reviews and the private audio buckets.
-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Fixtures (as postgres) ------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'p-admin@test.local'),
  ('a0000000-0000-0000-0000-0000000000a1', 'p-teacher@test.local'),
  ('a0000000-0000-0000-0000-0000000000a2', 'p-teacher2@test.local'),
  ('a0000000-0000-0000-0000-0000000000b1', 'p-student1@test.local'),
  ('a0000000-0000-0000-0000-0000000000b2', 'p-student2@test.local'),
  ('a0000000-0000-0000-0000-0000000000b3', 'p-student3@test.local');

insert into public.user_roles (user_id, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin'),
  ('a0000000-0000-0000-0000-0000000000a1', 'teacher'),
  ('a0000000-0000-0000-0000-0000000000a2', 'teacher'),
  ('a0000000-0000-0000-0000-0000000000b1', 'student'),
  ('a0000000-0000-0000-0000-0000000000b2', 'student'),
  ('a0000000-0000-0000-0000-0000000000b3', 'student');

insert into public.courses (id, slug, title, status) values
  ('c0000000-0000-0000-0000-000000000001', 'p-course', 'P course', 'published');
insert into public.modules (id, course_id, position, title, status) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 'M', 'published');
insert into public.lessons (id, module_id, position, title, status, source_audit_status) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, 'L', 'published', 'not_required');
insert into public.assignments (id, lesson_id, title, type, status, target_text) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Dal', 'audio', 'published', 'د'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Draft audio', 'audio', 'draft', 'ذ'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Quiz', 'quiz', 'published', '');

insert into public.cohorts (id, course_id, name) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'G');
insert into public.cohort_members (cohort_id, student_id) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b1'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b2');
insert into public.teacher_assignments (teacher_id, student_id) values
  ('a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000b1');

create function pg_temp.login(_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'role', 'authenticated')::text, true);
$$;

-- Student 1 -------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('a0000000-0000-0000-0000-0000000000b1');

select lives_ok($$ insert into public.submissions (id, assignment_id, student_id, attempt_number, status)
  values ('99000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
          'a0000000-0000-0000-0000-0000000000b1', 99, 'reviewed') $$,
  'student starts an attempt');
select results_eq($$ select attempt_number, status::text from public.submissions where id = '99000000-0000-0000-0000-000000000001' $$,
  $$ values (1, 'pending_upload') $$, 'the database numbers the attempt and ignores a forged status');
select lives_ok($$ insert into public.submissions (id, assignment_id, student_id, attempt_number)
  values ('99000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
          'a0000000-0000-0000-0000-0000000000b1', 1) $$, 'student starts a second attempt');
select results_eq($$ select attempt_number from public.submissions where id = '99000000-0000-0000-0000-000000000002' $$,
  array[2], 'a new attempt gets the next number');
select throws_ok($$ insert into public.submissions (id, assignment_id, student_id, attempt_number)
  values (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b2', 1) $$,
  '42501', null, 'student cannot create an attempt for someone else');
select throws_ok($$ insert into public.submissions (id, assignment_id, student_id, attempt_number)
  values (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-0000000000b1', 1) $$,
  '42501', null, 'a quiz is not an audio exercise');
select throws_ok($$ insert into public.submissions (id, assignment_id, student_id, attempt_number)
  values (gen_random_uuid(), 'f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000b1', 1) $$,
  '42501', null, 'a draft exercise cannot be attempted');
select throws_ok($$ insert into public.submissions (id, assignment_id, student_id, attempt_number)
  values ('99000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b1', 1) $$,
  '23505', null, 'the same attempt id cannot be created twice');
select throws_ok($$ update public.submissions set audio_path = 'a0000000-0000-0000-0000-0000000000b2/x.webm'
  where id = '99000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'audio path must belong to the attempt');
select lives_ok($$ update public.submissions
  set audio_path = 'a0000000-0000-0000-0000-0000000000b1/f0000000-0000-0000-0000-000000000001/99000000-0000-0000-0000-000000000001.webm',
      duration_ms = 2400, mime_type = 'audio/webm', size_bytes = 18000, status = 'needs_teacher_review'
  where id = '99000000-0000-0000-0000-000000000001' $$, 'student submits the attempt');
select is_empty($$ update public.submissions set status = 'pending_upload'
  where id = '99000000-0000-0000-0000-000000000001' returning id $$,
  'a submitted attempt cannot be reopened');
select throws_ok($$ update public.submissions set status = 'reviewed' where id = '99000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'student cannot mark an attempt reviewed');
select lives_ok($$ insert into storage.objects (bucket_id, name)
  values ('submissions', 'a0000000-0000-0000-0000-0000000000b1/f0000000-0000-0000-0000-000000000001/99000000-0000-0000-0000-000000000002.webm') $$,
  'student uploads into an unfinished attempt');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('submissions', 'a0000000-0000-0000-0000-0000000000b1/f0000000-0000-0000-0000-000000000001/99000000-0000-0000-0000-000000000001.mp4') $$,
  '42501', null, 'a submitted attempt cannot get another file');
select throws_ok($$ insert into storage.objects (bucket_id, name)
  values ('submissions', 'a0000000-0000-0000-0000-0000000000b2/f0000000-0000-0000-0000-000000000001/99000000-0000-0000-0000-000000000002.webm') $$,
  '42501', null, 'student cannot upload into another student''s folder');

-- The submitted file exists (as the storage API would have created it).
reset role;
insert into storage.objects (bucket_id, name)
values ('submissions', 'a0000000-0000-0000-0000-0000000000b1/f0000000-0000-0000-0000-000000000001/99000000-0000-0000-0000-000000000001.webm');
set local role authenticated;

-- Student 2 (same cohort, different teacher) ------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-0000000000b2');
select is_empty($$ select 1 from public.submissions where student_id = 'a0000000-0000-0000-0000-0000000000b1' $$,
  'another student cannot read the attempts');
select is_empty($$ select 1 from storage.objects where bucket_id = 'submissions' $$,
  'another student cannot see the audio files');
select throws_ok($$ insert into public.reviews (submission_id, reviewer_id, verdict)
  values ('99000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000b2', 'correct') $$,
  '42501', null, 'a student cannot review');

-- Teacher without this student -------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-0000000000a2');
select is_empty($$ select 1 from public.submissions where student_id = 'a0000000-0000-0000-0000-0000000000b1' $$,
  'an unassigned teacher cannot read the attempts');
select throws_ok($$ insert into public.reviews (submission_id, reviewer_id, verdict)
  values ('99000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a2', 'correct') $$,
  '42501', null, 'an unassigned teacher cannot review');

-- Assigned teacher --------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-0000000000a1');
select results_eq($$ select count(*)::int from public.submissions where student_id = 'a0000000-0000-0000-0000-0000000000b1' $$,
  array[2], 'the student''s teacher reads the attempts');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'submissions'
  and name like 'a0000000-0000-0000-0000-0000000000b1/%99000000-0000-0000-0000-000000000001.webm' $$,
  array[1], 'the student''s teacher can access the submitted file');
select is_empty($$ select 1 from storage.objects where bucket_id = 'submissions'
  and name like '%99000000-0000-0000-0000-000000000002.webm' $$,
  'the teacher cannot see the file of an unfinished attempt');
select throws_ok($$ insert into public.reviews (submission_id, reviewer_id, verdict)
  values ('99000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-0000000000a1', 'correct') $$,
  '23514', null, 'an unfinished attempt cannot be reviewed');
select lives_ok($$ insert into public.reviews (submission_id, reviewer_id, verdict, feedback_text)
  values ('99000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000000a1', 'correct', 'Хорошо') $$,
  'the teacher saves a review');
select results_eq($$ select status::text from public.submissions where id = '99000000-0000-0000-0000-000000000001' $$,
  array['reviewed'], 'the review marks the attempt reviewed');
select lives_ok($$ update public.reviews set verdict = 'needs_fix', error_type = 'makhraj', feedback_text = 'Кончик языка выше'
  where submission_id = '99000000-0000-0000-0000-000000000001' $$, 'the teacher corrects the review');
select throws_ok($$ update public.reviews set reviewer_id = 'a0000000-0000-0000-0000-0000000000a2'
  where submission_id = '99000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the reviewer cannot be changed');

-- Student 1 sees the result ---------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-0000000000b1');
select results_eq($$ select verdict::text, feedback_text from public.reviews where submission_id = '99000000-0000-0000-0000-000000000001' $$,
  $$ values ('needs_fix', 'Кончик языка выше') $$, 'the student sees the verdict and comment');
select is_empty($$ update public.reviews set verdict = 'correct' where submission_id = '99000000-0000-0000-0000-000000000001' returning id $$,
  'the student cannot change the review');
select is_empty('select 1 from public.automated_assessments', 'no automatic assessment is exposed to students');

-- Audit, anon, admin ----------------------------------------------------------------
reset role;
select results_eq($$ select count(*)::int from public.audit_logs where entity_type = 'reviews'
  and entity_id = '99000000-0000-0000-0000-000000000001' $$, array[2], 'saving and correcting a review are audited');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok('select 1 from public.submissions', '42501', null, 'anon cannot read attempts');
select is_empty($$ select 1 from storage.objects where bucket_id in ('submissions', 'reference-audio') $$,
  'anon cannot see audio files');

-- Reference recording ------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name) values ('reference-audio', 'f0000000-0000-0000-0000-000000000001/reference.webm');
update public.assignments set reference_audio_path = 'f0000000-0000-0000-0000-000000000001/reference.webm'
  where id = 'f0000000-0000-0000-0000-000000000001';
set local role authenticated;

select pg_temp.login('a0000000-0000-0000-0000-0000000000b1');
select results_eq($$ select count(*)::int from storage.objects where bucket_id = 'reference-audio' $$,
  array[1], 'an enrolled student can access the reference recording');
select pg_temp.login('a0000000-0000-0000-0000-0000000000b3');
select is_empty($$ select 1 from storage.objects where bucket_id = 'reference-audio' $$,
  'a student outside the cohort cannot access the reference recording');

select * from finish();
rollback;
