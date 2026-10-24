"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, requireAdmin } from "@/lib/admin/guard";
import { formLocale, text, type FormState } from "@/lib/auth/validation";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { blockTypes, bodyFromFields, parseOptions, type BlockType } from "./blocks";

// All writes go through the admin's own Supabase session, so RLS ("admins
// manage") and the audit triggers apply. requireAdmin() is the first check;
// RLS is the second.

type Enums = Database["public"]["Enums"];
type Status = Enums["content_status"];
type Ordered = "modules" | "lessons" | "lesson_blocks" | "quiz_questions";
type Parent = { modules: "course_id"; lessons: "module_id"; lesson_blocks: "lesson_id"; quiz_questions: "assignment_id" };
const parentColumn: Parent = {
  modules: "course_id",
  lessons: "module_id",
  lesson_blocks: "lesson_id",
  quiz_questions: "assignment_id",
};

const statuses: readonly Status[] = ["draft", "published", "archived"];
const auditStatuses: readonly Enums["source_audit_status"][] = ["pending", "in_review", "verified", "not_required"];
const rightsStatuses: readonly Enums["rights_status"][] = ["unknown", "permitted", "restricted", "own"];
const verificationStatuses: readonly Enums["verification_status"][] = ["pending", "verified", "rejected"];

function pick<T extends string>(allowed: readonly T[], value: string): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

async function admin() {
  const user = await requireAdmin();
  return user ? { user, supabase: await createClient() } : null;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function nextPosition(supabase: Supabase, table: Ordered, parentId: string) {
  const { data } = await supabase
    .from(table)
    .select("position")
    // The parent column differs per table; the union is too wide for the typed builder.
    .eq(parentColumn[table] as never, parentId)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function createCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const slug = text(formData, "slug").toLowerCase();
  const title = text(formData, "title");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !title) return { error: "invalid_input" };

  const { data, error } = await ctx.supabase
    .from("courses")
    .insert({ slug, title, title_ar: text(formData, "title_ar"), description: text(formData, "description") })
    .select("id")
    .single();
  if (error) return { error: dbError(error.code) };

  redirect(`/${formLocale(formData)}/admin/courses/${data.id}`);
}

export async function updateCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const title = text(formData, "title");
  if (!title) return { error: "invalid_input" };
  const { error } = await ctx.supabase
    .from("courses")
    .update({ title, title_ar: text(formData, "title_ar"), description: text(formData, "description") })
    .eq("id", text(formData, "id"));
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

/** Status change for courses, modules, lessons and assignments. */
export async function setStatus(formData: FormData) {
  const ctx = await admin();
  const table = pick(["courses", "modules", "lessons", "assignments"] as const, text(formData, "table"));
  const status = pick(statuses, text(formData, "status"));
  if (!ctx || !table || !status) return;

  // A lesson waiting for source audit is rejected by the database as well;
  // the editor disables the button and explains why.
  await ctx.supabase.from(table).update({ status }).eq("id", text(formData, "id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Modules and lessons
// ---------------------------------------------------------------------------

export async function createModule(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const courseId = text(formData, "course_id");
  const title = text(formData, "title");
  if (!title) return { error: "invalid_input" };

  const { error } = await ctx.supabase.from("modules").insert({
    course_id: courseId,
    position: await nextPosition(ctx.supabase, "modules", courseId),
    title,
    title_ar: text(formData, "title_ar"),
  });
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

export async function createLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const moduleId = text(formData, "module_id");
  const title = text(formData, "title");
  if (!title) return { error: "invalid_input" };

  const { data, error } = await ctx.supabase
    .from("lessons")
    .insert({
      module_id: moduleId,
      position: await nextPosition(ctx.supabase, "lessons", moduleId),
      title,
      title_ar: text(formData, "title_ar"),
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error.code) };

  redirect(`/${formLocale(formData)}/admin/content/${data.id}`);
}

export async function updateLesson(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const title = text(formData, "title");
  const audit = pick(auditStatuses, text(formData, "source_audit_status"));
  const minutesText = text(formData, "estimated_minutes");
  const minutes = minutesText ? Number(minutesText) : null;
  if (!title || !audit || (minutes !== null && !(Number.isInteger(minutes) && minutes >= 1 && minutes <= 600))) {
    return { error: "invalid_input" };
  }
  const objectives = text(formData, "objectives")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const { error } = await ctx.supabase
    .from("lessons")
    .update({
      title,
      title_ar: text(formData, "title_ar"),
      objectives,
      estimated_minutes: minutes,
      source_audit_status: audit,
    })
    .eq("id", text(formData, "id"));
  if (error) return { error: error.code === "23514" ? "not_audited" : dbError(error.code) };
  refresh();
  return { ok: true };
}

/** Swaps an item with its neighbour above or below within the same parent. */
export async function move(formData: FormData) {
  const ctx = await admin();
  const table = pick(["modules", "lessons", "lesson_blocks", "quiz_questions"] as const, text(formData, "table"));
  const direction = text(formData, "direction") === "up" ? "up" : "down";
  if (!ctx || !table) return;

  const id = text(formData, "id");
  const parent = parentColumn[table];
  const { data: item } = await ctx.supabase.from(table).select(`id, position, ${parent}`).eq("id", id).maybeSingle();
  if (!item) return;
  const row = item as unknown as { id: string; position: number } & Record<string, string>;

  const { data: neighbours } = await ctx.supabase
    .from(table)
    .select("id, position")
    .eq(parent as never, row[parent])
    [direction === "up" ? "lt" : "gt"]("position", row.position)
    .order("position", { ascending: direction === "down" })
    .limit(1);
  const other = neighbours?.[0];
  if (!other) return;

  // Unique (parent, position): park one row on a free position first.
  const parked = 1_000_000 + row.position;
  await ctx.supabase.from(table).update({ position: parked }).eq("id", row.id);
  await ctx.supabase.from(table).update({ position: row.position }).eq("id", other.id);
  await ctx.supabase.from(table).update({ position: other.position }).eq("id", row.id);
  refresh();
}

// ---------------------------------------------------------------------------
// Lesson blocks
// ---------------------------------------------------------------------------

function blockFields(formData: FormData, type: BlockType) {
  const body = bodyFromFields(type, {
    text: text(formData, "text"),
    arabic: text(formData, "arabic"),
    note: text(formData, "note"),
    table: text(formData, "table"),
    header: formData.get("header") === "on",
  });
  const authoring = text(formData, "authoring_type") === "source" ? "source" : "authored";
  const sourceId = text(formData, "source_reference_id") || null;
  const locale = pick(["ru", "ar"] as const, text(formData, "block_locale"));
  if (!body || (authoring === "source" && !sourceId)) return null;
  return {
    block_type: type,
    title: text(formData, "title").slice(0, 200),
    body,
    locale,
    authoring_type: authoring,
    source_reference_id: sourceId,
  } as const;
}

export async function addBlock(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const type = pick(blockTypes, text(formData, "block_type"));
  const fields = type && blockFields(formData, type);
  if (!fields) return { error: "invalid_input" };

  const lessonId = text(formData, "lesson_id");
  const { error } = await ctx.supabase.from("lesson_blocks").insert({
    ...fields,
    lesson_id: lessonId,
    position: await nextPosition(ctx.supabase, "lesson_blocks", lessonId),
  });
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

export async function updateBlock(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const type = pick(blockTypes, text(formData, "block_type"));
  const fields = type && blockFields(formData, type);
  if (!fields) return { error: "invalid_input" };

  const { error } = await ctx.supabase.from("lesson_blocks").update(fields).eq("id", text(formData, "id"));
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

export async function deleteBlock(formData: FormData) {
  const ctx = await admin();
  if (!ctx) return;
  await ctx.supabase.from("lesson_blocks").delete().eq("id", text(formData, "id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function sourceFields(formData: FormData) {
  const title = text(formData, "title");
  const rights = pick(rightsStatuses, text(formData, "rights_status"));
  const verification = pick(verificationStatuses, text(formData, "verification_status"));
  if (!title || !rights || !verification) return null;
  return {
    title,
    author: text(formData, "author"),
    edition: text(formData, "edition"),
    page_or_section: text(formData, "page_or_section"),
    rights_status: rights,
    verification_status: verification,
    notes: text(formData, "notes"),
  };
}

export async function createSource(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };
  const fields = sourceFields(formData);
  if (!fields) return { error: "invalid_input" };

  const { error } = await ctx.supabase.from("source_references").insert({ ...fields, created_by: ctx.user.id });
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

export async function updateSource(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };
  const fields = sourceFields(formData);
  if (!fields) return { error: "invalid_input" };

  const { error } = await ctx.supabase.from("source_references").update(fields).eq("id", text(formData, "id"));
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Assignments and quiz questions
// ---------------------------------------------------------------------------

export async function createAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const title = text(formData, "title");
  const type = pick(["quiz", "audio", "written"] as const, text(formData, "type"));
  if (!title || !type) return { error: "invalid_input" };

  const { error } = await ctx.supabase.from("assignments").insert({
    lesson_id: text(formData, "lesson_id"),
    title,
    type,
    instructions: text(formData, "instructions"),
    created_by: ctx.user.id,
  });
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

export async function addQuestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const prompt = text(formData, "prompt");
  const options = parseOptions(text(formData, "options"));
  const correct = Number(text(formData, "correct")) - 1;
  if (!prompt || !options || !Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return { error: "invalid_input" };
  }

  const assignmentId = text(formData, "assignment_id");
  const { data, error } = await ctx.supabase
    .from("quiz_questions")
    .insert({
      assignment_id: assignmentId,
      position: await nextPosition(ctx.supabase, "quiz_questions", assignmentId),
      prompt,
      options,
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error.code) };

  const { error: keyError } = await ctx.supabase
    .from("quiz_answer_keys")
    .insert({ question_id: data.id, correct_options: [correct] });
  if (keyError) {
    await ctx.supabase.from("quiz_questions").delete().eq("id", data.id);
    return { error: dbError(keyError.code) };
  }
  refresh();
  return { ok: true };
}

export async function deleteQuestion(formData: FormData) {
  const ctx = await admin();
  if (!ctx) return;
  await ctx.supabase.from("quiz_questions").delete().eq("id", text(formData, "id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Cohorts
// ---------------------------------------------------------------------------

export async function createCohort(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await admin();
  if (!ctx) return { error: "not_allowed" };

  const name = text(formData, "name");
  if (!name) return { error: "invalid_input" };
  const { error } = await ctx.supabase.from("cohorts").insert({
    course_id: text(formData, "course_id"),
    name,
    starts_on: text(formData, "starts_on") || null,
    ends_on: text(formData, "ends_on") || null,
  });
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

export async function setCohortMember(formData: FormData) {
  const ctx = await admin();
  const cohortId = text(formData, "cohort_id");
  const studentId = text(formData, "student_id");
  if (!ctx || !cohortId || !studentId) return;

  const status = text(formData, "member") === "1" ? "active" : "left";
  await ctx.supabase
    .from("cohort_members")
    .upsert({ cohort_id: cohortId, student_id: studentId, status }, { onConflict: "cohort_id,student_id" });
  refresh();
}
