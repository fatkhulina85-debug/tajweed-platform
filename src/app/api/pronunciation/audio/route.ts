import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { SIGNED_URL_SECONDS, json, uuidPattern } from "@/lib/pronunciation/http";
import { createClient } from "@/lib/supabase/server";

/**
 * Short-lived signed URL for one recording:
 *   ?submission=<attempt id>   a student's attempt (owner, their teacher, admin)
 *   ?reference=<exercise id>   the exercise's reference recording
 * The rows are read as the user, so RLS decides access; the storage policies
 * check the same rows again when the URL is signed. The file path itself is
 * never trusted.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthenticated" }, 401);

  const submissionId = request.nextUrl.searchParams.get("submission");
  const referenceId = request.nextUrl.searchParams.get("reference");
  const supabase = await createClient();

  let bucket: "submissions" | "reference-audio";
  let path: string | null = null;

  if (submissionId && uuidPattern.test(submissionId)) {
    bucket = "submissions";
    const { data } = await supabase
      .from("submissions")
      .select("audio_path, status")
      .eq("id", submissionId)
      .in("status", ["needs_teacher_review", "reviewed"])
      .maybeSingle();
    path = data?.audio_path ?? null;
  } else if (referenceId && uuidPattern.test(referenceId)) {
    bucket = "reference-audio";
    const { data } = await supabase
      .from("assignments")
      .select("reference_audio_path")
      .eq("id", referenceId)
      .maybeSingle();
    if (data && !data.reference_audio_path) return json({ error: "no_reference" }, 404);
    path = data?.reference_audio_path ?? null;
  } else {
    return json({ error: "bad_request" }, 400);
  }

  if (!path) return json({ error: "not_found" }, 404);

  const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !signed) return json({ error: "not_found" }, 404);
  return json({ url: signed.signedUrl, expiresIn: SIGNED_URL_SECONDS });
}
