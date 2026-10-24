import { getCurrentUser } from "@/lib/auth/session";
import { MAX_ATTEMPT_BYTES, checkAudio, extensionFor, normalizeAudioType } from "@/lib/pronunciation/audio";
import { isSameOrigin, json, uuidPattern } from "@/lib/pronunciation/http";
import { createClient } from "@/lib/supabase/server";

/**
 * Receives one recorded attempt.
 *
 * The browser chooses the attempt id when the recording is made and sends the
 * same id on every retry, so a repeated request finishes the same attempt
 * instead of creating a new one. Steps, all as the student (RLS applies):
 *   1. create the attempt row (pending_upload), or reuse it on retry;
 *   2. upload the file to the private bucket under <student>/<exercise>/<attempt>;
 *   3. mark the attempt needs_teacher_review with its metadata.
 * If step 2 or 3 fails the attempt becomes processing_failed: a technical
 * problem, never a pronunciation verdict. The student retries with the same id.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (!user.roles.includes("student")) return json({ error: "forbidden" }, 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const assignmentId = String(form.get("assignmentId") ?? "");
  const attemptId = String(form.get("attemptId") ?? "");
  const durationMs = Number(form.get("durationMs"));
  const file = form.get("file");
  if (!uuidPattern.test(assignmentId) || !uuidPattern.test(attemptId) || !(file instanceof File)) {
    return json({ error: "bad_request" }, 400);
  }

  const type = normalizeAudioType(file.type);
  const problem = checkAudio(file, { maxBytes: MAX_ATTEMPT_BYTES, durationMs });
  if (problem || !type) return json({ error: problem ?? "unsupported_type" }, 422);

  const supabase = await createClient();

  // The exercise must be an audio exercise this student can see.
  const { data: exercise } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .eq("type", "audio")
    .maybeSingle();
  if (!exercise) return json({ error: "not_found" }, 404);

  // 1. Create or reuse the attempt.
  let { data: attempt } = await supabase
    .from("submissions")
    .select("id, assignment_id, attempt_number, status, submitted_at")
    .eq("id", attemptId)
    .maybeSingle();

  if (attempt && attempt.assignment_id !== assignmentId) return json({ error: "conflict" }, 409);
  if (attempt && (attempt.status === "needs_teacher_review" || attempt.status === "reviewed")) {
    // Already delivered (e.g. the response to an earlier request was lost).
    return json({ attempt: toAttempt(attempt), alreadySubmitted: true }, 200);
  }
  if (!attempt) {
    const { data: created, error } = await supabase
      .from("submissions")
      .insert({ id: attemptId, assignment_id: assignmentId, student_id: user.id, attempt_number: 1 })
      .select("id, assignment_id, attempt_number, status, submitted_at")
      .single();
    if (error) {
      // 23505: another request with the same id got there first; RLS refusal otherwise.
      return json({ error: error.code === "23505" ? "retry" : "forbidden" }, error.code === "23505" ? 409 : 403);
    }
    attempt = created;
  }

  // 2. Upload. Same path on retry, so a retry replaces only this attempt's file.
  const path = `${user.id}/${assignmentId}/${attemptId}.${extensionFor(type)}`;
  const { error: uploadError } = await supabase.storage
    .from("submissions")
    .upload(path, file, { contentType: type, upsert: true });
  if (uploadError) {
    await supabase.from("submissions").update({ status: "processing_failed" }).eq("id", attemptId);
    return json({ error: "upload_failed", attemptId }, 502);
  }

  // 3. Hand over to the teacher.
  const { data: submitted, error: updateError } = await supabase
    .from("submissions")
    .update({
      audio_path: path,
      duration_ms: Math.round(durationMs),
      mime_type: type,
      size_bytes: file.size,
      status: "needs_teacher_review",
    })
    .eq("id", attemptId)
    .select("id, assignment_id, attempt_number, status, submitted_at")
    .single();
  if (updateError || !submitted) {
    await supabase.from("submissions").update({ status: "processing_failed" }).eq("id", attemptId);
    return json({ error: "save_failed", attemptId }, 500);
  }

  return json({ attempt: toAttempt(submitted), alreadySubmitted: false }, 201);
}

function toAttempt(row: { id: string; attempt_number: number; status: string; submitted_at: string | null }) {
  return { id: row.id, attemptNumber: row.attempt_number, status: row.status, submittedAt: row.submitted_at };
}
