import { requireAdmin } from "@/lib/admin/guard";
import { MAX_REFERENCE_BYTES, checkAudio, extensionFor, normalizeAudioType } from "@/lib/pronunciation/audio";
import { isSameOrigin, json, uuidPattern } from "@/lib/pronunciation/http";
import { createClient } from "@/lib/supabase/server";

/**
 * An admin uploads the reference recording of an audio exercise. Each upload
 * gets a new path, so a replaced reference is never served from an old link;
 * earlier files are kept, not deleted.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  const admin = await requireAdmin();
  if (!admin) return json({ error: "forbidden" }, 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const assignmentId = String(form.get("assignmentId") ?? "");
  const file = form.get("file");
  if (!uuidPattern.test(assignmentId) || !(file instanceof File)) return json({ error: "bad_request" }, 400);

  const type = normalizeAudioType(file.type);
  const problem = checkAudio(file, { maxBytes: MAX_REFERENCE_BYTES });
  if (problem || !type) return json({ error: problem ?? "unsupported_type" }, 422);

  const supabase = await createClient();
  const { data: exercise } = await supabase
    .from("assignments")
    .select("id")
    .eq("id", assignmentId)
    .eq("type", "audio")
    .maybeSingle();
  if (!exercise) return json({ error: "not_found" }, 404);

  const path = `${assignmentId}/reference-${Date.now()}.${extensionFor(type)}`;
  const { error: uploadError } = await supabase.storage
    .from("reference-audio")
    .upload(path, file, { contentType: type, upsert: false });
  if (uploadError) return json({ error: "upload_failed" }, 502);

  const { error } = await supabase.from("assignments").update({ reference_audio_path: path }).eq("id", assignmentId);
  if (error) return json({ error: "save_failed" }, 500);
  return json({ ok: true }, 201);
}
