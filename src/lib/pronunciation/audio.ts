// Limits and formats shared by the recorder, the upload route and the tests.
// They match the CHECK constraints and bucket settings in
// supabase/migrations/20261025010000_pronunciation.sql.

export const MAX_RECORDING_MS = 30_000;
export const MAX_ATTEMPT_BYTES = 2 * 1024 * 1024;
export const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;
export const MIN_AUDIO_BYTES = 1024;

export const audioTypes = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;
export type AudioType = (typeof audioTypes)[number];

const extensions: Record<AudioType, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** "audio/webm;codecs=opus" -> "audio/webm"; unknown types -> null. */
export function normalizeAudioType(type: string): AudioType | null {
  const base = type.split(";")[0].trim().toLowerCase();
  const alias = base === "audio/x-wav" || base === "audio/wave" ? "audio/wav" : base === "audio/x-m4a" ? "audio/mp4" : base;
  return (audioTypes as readonly string[]).includes(alias) ? (alias as AudioType) : null;
}

export function extensionFor(type: AudioType): string {
  return extensions[type];
}

/** Recording formats in order of preference; Safari only supports audio/mp4. */
const recorderCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function pickRecorderType(isTypeSupported: (type: string) => boolean): string | null {
  return recorderCandidates.find((type) => isTypeSupported(type)) ?? null;
}

export type AudioProblem = "unsupported_type" | "too_large" | "too_small" | "too_long" | "no_duration";

/** Validates a file before upload (client) and on receipt (server). */
export function checkAudio(
  file: { type: string; size: number },
  options: { maxBytes: number; durationMs?: number | null },
): AudioProblem | null {
  if (!normalizeAudioType(file.type)) return "unsupported_type";
  if (file.size > options.maxBytes) return "too_large";
  if (file.size < MIN_AUDIO_BYTES) return "too_small";
  if (options.durationMs !== undefined) {
    if (!options.durationMs || options.durationMs <= 0) return "no_duration";
    if (options.durationMs > MAX_RECORDING_MS + 2_000) return "too_long";
  }
  return null;
}

/** Maps getUserMedia / MediaRecorder errors to what the student is told. */
export type MicrophoneProblem = "denied" | "no_device" | "busy" | "unsupported" | "unknown";

export function microphoneProblem(error: unknown): MicrophoneProblem {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_device";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "unknown";
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
