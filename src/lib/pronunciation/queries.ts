import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SubmissionStatus } from "./stats";

// All queries run as the signed-in user; RLS limits students to their own
// attempts and teachers to students they teach.

/** An audio exercise the user can see (published + enrolled for students). */
export async function getExercise(assignmentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignments")
    .select(`
      id, title, instructions, target_text, reference_audio_path, status,
      lessons (id, title, title_ar)
    `)
    .eq("id", assignmentId)
    .eq("type", "audio")
    .maybeSingle();
  return data;
}

/** The student's attempts at one exercise, newest first, with reviews. */
export async function listOwnAttempts(assignmentId: string, studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("submissions")
    .select(`
      id, attempt_number, status, duration_ms, submitted_at, created_at,
      reviews (verdict, error_type, feedback_text, reviewed_at)
    `)
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("attempt_number", { ascending: false });
  return data ?? [];
}

export type QueueFilters = { studentId?: string; assignmentId?: string; status?: SubmissionStatus };

/** Attempts a teacher may review, oldest submission first. */
export async function teacherQueue(filters: QueueFilters) {
  const supabase = await createClient();
  let query = supabase
    .from("submissions")
    .select(`
      id, attempt_number, status, duration_ms, submitted_at, student_id, assignment_id,
      assignments (title, target_text),
      profiles!submissions_student_id_fkey (display_name, email),
      reviews (verdict, reviewed_at)
    `)
    .in("status", ["needs_teacher_review", "reviewed"])
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.studentId) query = query.eq("student_id", filters.studentId);
  if (filters.assignmentId) query = query.eq("assignment_id", filters.assignmentId);
  const { data } = await query;
  return data ?? [];
}

/** One attempt with the exercise, the student, its review and the student's other attempts. */
export async function getAttemptForReview(submissionId: string) {
  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("submissions")
    .select(`
      id, attempt_number, status, duration_ms, mime_type, size_bytes, submitted_at, student_id, assignment_id,
      assignments (id, title, instructions, target_text, reference_audio_path),
      profiles!submissions_student_id_fkey (display_name, email),
      reviews (verdict, error_type, feedback_text, reviewed_at, reviewer_id)
    `)
    .eq("id", submissionId)
    .in("status", ["needs_teacher_review", "reviewed"])
    .maybeSingle();
  if (!attempt) return null;

  const { data: history } = await supabase
    .from("submissions")
    .select("id, attempt_number, status, submitted_at, reviews (verdict, feedback_text)")
    .eq("student_id", attempt.student_id)
    .eq("assignment_id", attempt.assignment_id)
    .in("status", ["needs_teacher_review", "reviewed"])
    .order("attempt_number", { ascending: false });

  return { attempt, history: history ?? [] };
}
