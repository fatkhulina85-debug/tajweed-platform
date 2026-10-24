import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPT_BYTES,
  checkAudio,
  extensionFor,
  formatDuration,
  microphoneProblem,
  normalizeAudioType,
  pickRecorderType,
} from "./audio";
import { attemptStats } from "./stats";

describe("audio types", () => {
  it("normalizes codecs and aliases", () => {
    expect(normalizeAudioType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioType("audio/x-wav")).toBe("audio/wav");
    expect(normalizeAudioType("audio/x-m4a")).toBe("audio/mp4");
    expect(normalizeAudioType("video/webm")).toBeNull();
    expect(normalizeAudioType("")).toBeNull();
  });

  it("maps types to file extensions", () => {
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("audio/webm")).toBe("webm");
  });

  it("prefers webm/opus and falls back to mp4 (Safari)", () => {
    expect(pickRecorderType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderType(() => false)).toBeNull();
  });
});

describe("checkAudio", () => {
  const ok = { type: "audio/webm", size: 20_000 };

  it("accepts a normal recording", () => {
    expect(checkAudio(ok, { maxBytes: MAX_ATTEMPT_BYTES, durationMs: 2500 })).toBeNull();
  });

  it("rejects wrong type, size and duration", () => {
    expect(checkAudio({ type: "image/png", size: 20_000 }, { maxBytes: MAX_ATTEMPT_BYTES })).toBe("unsupported_type");
    expect(checkAudio({ ...ok, size: MAX_ATTEMPT_BYTES + 1 }, { maxBytes: MAX_ATTEMPT_BYTES })).toBe("too_large");
    expect(checkAudio({ ...ok, size: 10 }, { maxBytes: MAX_ATTEMPT_BYTES })).toBe("too_small");
    expect(checkAudio(ok, { maxBytes: MAX_ATTEMPT_BYTES, durationMs: 0 })).toBe("no_duration");
    expect(checkAudio(ok, { maxBytes: MAX_ATTEMPT_BYTES, durationMs: 60_000 })).toBe("too_long");
  });
});

describe("microphoneProblem", () => {
  it("explains getUserMedia errors", () => {
    expect(microphoneProblem({ name: "NotAllowedError" })).toBe("denied");
    expect(microphoneProblem({ name: "NotFoundError" })).toBe("no_device");
    expect(microphoneProblem({ name: "NotReadableError" })).toBe("busy");
    expect(microphoneProblem(new TypeError("x"))).toBe("unsupported");
    expect(microphoneProblem("weird")).toBe("unknown");
  });
});

describe("formatDuration", () => {
  it("shows minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(2400)).toBe("0:02");
    expect(formatDuration(30_000)).toBe("0:30");
  });
});

describe("attemptStats", () => {
  it("counts only real, submitted attempts", () => {
    expect(
      attemptStats([
        { status: "pending_upload", verdict: null },
        { status: "processing_failed", verdict: null },
        { status: "needs_teacher_review", verdict: null },
        { status: "reviewed", verdict: "correct" },
        { status: "reviewed", verdict: "needs_fix" },
        { status: "reviewed", verdict: "retry" },
      ]),
    ).toEqual({ saved: 4, correct: 1, notYet: 2, awaitingReview: 1 });
  });

  it("is all zeros with no attempts", () => {
    expect(attemptStats([])).toEqual({ saved: 0, correct: 0, notYet: 0, awaitingReview: 0 });
  });
});
