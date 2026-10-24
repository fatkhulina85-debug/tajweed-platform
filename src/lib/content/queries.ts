import "server-only";
import { createClient } from "@/lib/supabase/server";

// Every query runs as the signed-in user: RLS decides what comes back, so the
// same loader returns drafts to admins and only published, enrolled content to
// students. Callers check the role first (see lib/auth/session).

export async function listCourses() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, slug, title, title_ar, description, status, created_at")
    .order("created_at");
  return data ?? [];
}

/** Course with its modules and lessons in order. */
export async function getCourseTree(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    // One literal (no concatenation) so supabase-js can infer the row type.
    .select(`
      id, slug, title, title_ar, description, status,
      modules (id, position, title, title_ar, status,
        lessons (id, position, title, title_ar, status, source_audit_status, estimated_minutes))
    `)
    .eq("id", courseId)
    .order("position", { referencedTable: "modules" })
    .order("position", { referencedTable: "modules.lessons" })
    .maybeSingle();
  return data;
}

/** Every course the user can see, with modules and lessons in order. */
export async function listCourseTrees() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(`
      id, title, title_ar, description,
      modules (id, position, title, title_ar, lessons (id, position, title, title_ar, estimated_minutes))
    `)
    .order("created_at")
    .order("position", { referencedTable: "modules" })
    .order("position", { referencedTable: "modules.lessons" });
  return data ?? [];
}

/** Lesson with blocks, cited sources and quizzes (no answer keys). */
export async function getLesson(lessonId: string) {
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select(`
      id, module_id, position, title, title_ar, objectives, estimated_minutes, status, source_audit_status, published_at,
      modules (id, title, title_ar, status, course_id, courses (id, title, title_ar, status)),
      lesson_blocks (id, position, block_type, title, body, locale, authoring_type, source_reference_id,
        source_references (id, title, author, edition, page_or_section, verification_status)),
      assignments (id, title, instructions, type, status, target_text, reference_audio_path,
        quiz_questions (id, position, prompt, options, points))
    `)
    .eq("id", lessonId)
    .order("position", { referencedTable: "lesson_blocks" })
    .order("created_at", { referencedTable: "assignments" })
    .order("position", { referencedTable: "assignments.quiz_questions" })
    .maybeSingle();
  return lesson;
}

/** Correct option indexes per question; empty for everyone except admins (RLS). */
export async function getAnswerKeys(questionIds: string[]) {
  if (questionIds.length === 0) return new Map<string, number[]>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_answer_keys")
    .select("question_id, correct_options")
    .in("question_id", questionIds);
  return new Map((data ?? []).map((row) => [row.question_id, row.correct_options as number[]]));
}

export async function listSources() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("source_references")
    .select("id, title, author, edition, page_or_section, rights_status, verification_status, notes")
    .order("created_at");
  return data ?? [];
}

/** Cohorts of a course with their members, plus every student for enrolment. */
export async function getCohorts(courseId: string) {
  const supabase = await createClient();
  const [{ data: cohorts }, { data: studentRoles }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, starts_on, ends_on, status, cohort_members (student_id, status)")
      .eq("course_id", courseId)
      .order("created_at"),
    supabase.from("user_roles").select("user_id, profiles!user_roles_user_id_fkey (id, email, display_name)").eq("role", "student"),
  ]);
  const students = (studentRoles ?? [])
    .map((row) => row.profiles)
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  return { cohorts: cohorts ?? [], students };
}
