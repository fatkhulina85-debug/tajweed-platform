"use server";

import { refresh } from "next/cache";
import { dbError, requireAdmin } from "@/lib/admin/guard";
import { getCurrentUser } from "@/lib/auth/session";
import { text, type FormState } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import { errorTypes, verdicts, type ErrorType, type ReviewVerdict } from "./stats";

/**
 * Saves or corrects the teacher's review of one attempt. RLS allows it only
 * for a teacher of that student (or an admin), and the database marks the
 * attempt reviewed and writes the audit log.
 */
export async function saveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes("teacher") || user.roles.includes("admin"))) return { error: "not_allowed" };

  const submissionId = text(formData, "submission_id");
  const verdict = text(formData, "verdict") as ReviewVerdict;
  const errorTypeText = text(formData, "error_type");
  const feedback = text(formData, "feedback_text").slice(0, 2000);
  if (!submissionId || !verdicts.includes(verdict)) return { error: "invalid_input" };
  const errorType = errorTypes.includes(errorTypeText as ErrorType) ? (errorTypeText as ErrorType) : null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reviews")
    .select("id, reviewer_id")
    .eq("submission_id", submissionId)
    .maybeSingle();

  const { error } = existing
    ? existing.reviewer_id === user.id
      ? await supabase
          .from("reviews")
          .update({ verdict, error_type: errorType, feedback_text: feedback })
          .eq("id", existing.id)
      : { error: { code: "42501" } }
    : await supabase
        .from("reviews")
        .insert({ submission_id: submissionId, reviewer_id: user.id, verdict, error_type: errorType, feedback_text: feedback });

  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}

/** Admin: what the student should pronounce and the task wording. */
export async function updateExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await requireAdmin())) return { error: "not_allowed" };
  const targetText = text(formData, "target_text").slice(0, 500);
  const instructions = text(formData, "instructions").slice(0, 2000);
  if (!targetText) return { error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ target_text: targetText, instructions })
    .eq("id", text(formData, "id"))
    .eq("type", "audio");
  if (error) return { error: dbError(error.code) };
  refresh();
  return { ok: true };
}
