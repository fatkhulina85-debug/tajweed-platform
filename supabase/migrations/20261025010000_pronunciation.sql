-- Pronunciation exercises: student audio attempts, teacher reviews, private
-- storage. Additive only.
--
-- An exercise is an existing `assignments` row of type 'audio'; it gains the
-- text to pronounce and a reference recording. Who may see an exercise is
-- decided by private.assignment_visible (published + enrolled), as for quizzes.
--
-- Attempt flow (one row per attempt, id chosen by the browser so a retried
-- request reuses the same row instead of creating a new one):
--   pending_upload -> needs_teacher_review -> reviewed
--   pending_upload -> processing_failed -> pending_upload (retry) -> ...
-- A technical failure is never a pronunciation verdict.

-- ---------------------------------------------------------------------------
-- Exercise fields on assignments
-- ---------------------------------------------------------------------------

alter table public.assignments
  add column target_text text not null default '' check (char_length(target_text) <= 500),
  add column reference_audio_path text;

-- ---------------------------------------------------------------------------
-- Attempts
-- ---------------------------------------------------------------------------

create type public.submission_status as enum (
  'pending_upload', 'needs_teacher_review', 'reviewed', 'processing_failed'
);

create table public.submissions (
  id uuid primary key,
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  audio_path text,
  duration_ms integer check (duration_ms between 1 and 60000),
  mime_type text check (mime_type in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav')),
  size_bytes integer check (size_bytes between 1 and 2097152),
  status public.submission_status not null default 'pending_upload',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id, attempt_number),
  -- An attempt waiting for review must have its file and metadata.
  constraint submissions_complete_when_submitted check (
    status in ('pending_upload', 'processing_failed')
    or (audio_path is not null and duration_ms is not null and mime_type is not null
        and size_bytes is not null and submitted_at is not null)
  )
);

create index submissions_student on public.submissions (student_id, assignment_id);
create index submissions_status on public.submissions (status, submitted_at);

-- ---------------------------------------------------------------------------
-- Teacher reviews (one per attempt; the reviewer may correct it later)
-- ---------------------------------------------------------------------------

create type public.review_verdict as enum ('correct', 'needs_fix', 'retry');

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete restrict,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  verdict public.review_verdict not null,
  error_type text check (error_type in ('makhraj', 'sifat', 'vowel', 'length', 'other')),
  feedback_text text not null default '' check (char_length(feedback_text) <= 2000),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_reviewer on public.reviews (reviewer_id);

-- ---------------------------------------------------------------------------
-- Future automatic assessment, kept apart from the teacher's review. Nothing
-- writes here yet; only trusted server code (service role) will.
-- ---------------------------------------------------------------------------

create type public.assessment_status as enum ('pending', 'processed', 'low_confidence', 'failed');

create table public.automated_assessments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete restrict,
  provider text not null,
  status public.assessment_status not null default 'pending',
  result jsonb not null default '{}' check (jsonb_typeof(result) = 'object'),
  confidence numeric(4, 3) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automated_assessments_submission on public.automated_assessments (submission_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is this an audio exercise the current student may practise?
create function private.can_attempt(_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('student')
    and private.assignment_visible(_assignment_id)
    and exists (select 1 from public.assignments a where a.id = _assignment_id and a.type = 'audio');
$$;

-- Can the current user listen to / review this student's work?
create function private.can_review_student(_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin') or private.is_teacher_of(_student_id);
$$;

revoke all on function private.can_attempt(uuid) from public, anon;
revoke all on function private.can_review_student(uuid) from public, anon;
grant execute on function private.can_attempt(uuid) to authenticated, service_role;
grant execute on function private.can_review_student(uuid) to authenticated, service_role;

-- New attempt: number it, and pin owner-controlled fields.
create function private.prepare_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize numbering per student and exercise.
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text || new.assignment_id::text, 0));
  select coalesce(max(attempt_number), 0) + 1 into new.attempt_number
  from public.submissions
  where student_id = new.student_id and assignment_id = new.assignment_id;

  new.status = 'pending_upload';
  new.audio_path = null;
  new.submitted_at = null;
  return new;
end;
$$;

create trigger submissions_prepare
  before insert on public.submissions
  for each row execute function private.prepare_submission();

-- Status changes and file path rules.
create function private.guard_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _expected_prefix text := new.student_id::text || '/' || new.assignment_id::text || '/' || new.id::text || '.';
begin
  if new.student_id <> old.student_id or new.assignment_id <> old.assignment_id
     or new.attempt_number <> old.attempt_number or new.id <> old.id then
    raise exception 'attempt identity cannot change' using errcode = '42501';
  end if;

  if new.audio_path is not null and left(new.audio_path, length(_expected_prefix)) <> _expected_prefix then
    raise exception 'audio_path must be <student>/<assignment>/<attempt>.<ext>' using errcode = '23514';
  end if;

  -- Only the review trigger (or trusted code without a user) may mark an attempt reviewed.
  if new.status = 'reviewed' and old.status <> 'reviewed' and (select auth.uid()) is not null
     and coalesce(current_setting('tajweed.applying_review', true), '') <> 'on' then
    raise exception 'only a review can mark an attempt reviewed' using errcode = '42501';
  end if;

  -- Students cannot reopen an attempt that is already with the teacher.
  if old.status in ('needs_teacher_review', 'reviewed') and new.status in ('pending_upload', 'processing_failed')
     and (select auth.uid()) is not null then
    raise exception 'a submitted attempt cannot be changed' using errcode = '42501';
  end if;

  if new.status = 'needs_teacher_review' and old.status <> 'needs_teacher_review' then
    new.submitted_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger submissions_guard
  before update on public.submissions
  for each row execute function private.guard_submission();

-- A review marks its attempt reviewed and is written to the audit log.
create function private.apply_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
begin
  -- Transaction-local flag read by guard_submission. PostgREST clients cannot
  -- run set_config, so only this trigger can set it.
  perform set_config('tajweed.applying_review', 'on', true);
  update public.submissions set status = 'reviewed' where id = new.submission_id and status <> 'reviewed';
  perform set_config('tajweed.applying_review', 'off', true);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (_uid, lower(tg_op), 'reviews', new.submission_id::text,
          jsonb_build_object('verdict', new.verdict, 'error_type', new.error_type));
  return null;
end;
$$;

create trigger reviews_apply
  after insert or update of verdict, error_type, feedback_text on public.reviews
  for each row execute function private.apply_review();

create function private.guard_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.submission_id <> old.submission_id or new.reviewer_id <> old.reviewer_id) then
    raise exception 'review identity cannot change' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.submissions s
    where s.id = new.submission_id and s.status in ('needs_teacher_review', 'reviewed')
  ) then
    raise exception 'only submitted attempts can be reviewed' using errcode = '23514';
  end if;
  new.reviewed_at = now();
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_guard
  before insert or update on public.reviews
  for each row execute function private.guard_review();

create trigger automated_assessments_updated_at
  before update on public.automated_assessments
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

alter table public.submissions enable row level security;
alter table public.reviews enable row level security;
alter table public.automated_assessments enable row level security;

revoke all on public.submissions, public.reviews, public.automated_assessments from anon, authenticated;

grant select, insert on public.submissions to authenticated;
grant update (audio_path, duration_ms, mime_type, size_bytes, status) on public.submissions to authenticated;
grant select, insert on public.reviews to authenticated;
grant update (verdict, error_type, feedback_text) on public.reviews to authenticated;
grant select on public.automated_assessments to authenticated;

create policy "submissions: owner, their teachers and admins read"
  on public.submissions for select to authenticated
  using (student_id = (select auth.uid()) or private.can_review_student(student_id));

create policy "submissions: students start their own attempts"
  on public.submissions for insert to authenticated
  with check (student_id = (select auth.uid()) and private.can_attempt(assignment_id));

-- Students finish or mark failed only their own unfinished attempts.
create policy "submissions: students complete their own attempts"
  on public.submissions for update to authenticated
  using (student_id = (select auth.uid()) and status in ('pending_upload', 'processing_failed'))
  with check (
    student_id = (select auth.uid())
    and status in ('pending_upload', 'needs_teacher_review', 'processing_failed')
  );

create policy "reviews: the student and their teachers read"
  on public.reviews for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and (s.student_id = (select auth.uid()) or private.can_review_student(s.student_id))
    )
  );

create policy "reviews: teachers of the student write"
  on public.reviews for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and private.can_review_student(s.student_id)
    )
  );

create policy "reviews: the reviewer corrects their review"
  on public.reviews for update to authenticated
  using (reviewer_id = (select auth.uid()))
  with check (
    reviewer_id = (select auth.uid())
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and private.can_review_student(s.student_id)
    )
  );

create policy "automated_assessments: teachers of the student read"
  on public.automated_assessments for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and private.can_review_student(s.student_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: two private buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('submissions', 'submissions', false, 2097152,
   array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']),
  ('reference-audio', 'reference-audio', false, 5242880,
   array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
on conflict (id) do nothing;

-- Access is decided by the database row the file belongs to, never by the
-- path alone.

-- Students upload only into an attempt of theirs that is still unfinished,
-- under <student>/<assignment>/<attempt>.<ext>.
create policy "submissions bucket: upload into own unfinished attempt"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.submissions s
      where s.student_id = (select auth.uid())
        and s.status in ('pending_upload', 'processing_failed')
        and storage.objects.name like s.student_id::text || '/' || s.assignment_id::text || '/' || s.id::text || '.%'
    )
  );

-- Retrying the same attempt may replace its own file (upsert), nothing else.
create policy "submissions bucket: replace own unfinished attempt"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.submissions s
      where s.student_id = (select auth.uid())
        and s.status in ('pending_upload', 'processing_failed')
        and storage.objects.name like s.student_id::text || '/' || s.assignment_id::text || '/' || s.id::text || '.%'
    )
  )
  with check (bucket_id = 'submissions');

-- The owner reads files of their own attempts (the storage API also needs this
-- for the upsert on retry); teachers read only files linked to a submitted attempt.
create policy "submissions bucket: owner and their teachers read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and exists (
      select 1 from public.submissions s
      where (
          s.student_id = (select auth.uid())
          and storage.objects.name like s.student_id::text || '/' || s.assignment_id::text || '/' || s.id::text || '.%'
        )
        or (
          s.audio_path = storage.objects.name
          and s.status in ('needs_teacher_review', 'reviewed')
          and private.can_review_student(s.student_id)
        )
    )
  );

create policy "reference bucket: admins manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'reference-audio' and private.has_role('admin'))
  with check (bucket_id = 'reference-audio' and private.has_role('admin'));

create policy "reference bucket: whoever sees the exercise listens"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'reference-audio'
    and exists (
      select 1 from public.assignments a
      where a.reference_audio_path = storage.objects.name
        and (private.assignment_visible(a.id) or private.has_role('teacher'))
    )
  );
