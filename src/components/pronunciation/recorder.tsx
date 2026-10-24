"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  MAX_ATTEMPT_BYTES,
  MAX_RECORDING_MS,
  checkAudio,
  extensionFor,
  formatDuration,
  microphoneProblem,
  normalizeAudioType,
  pickRecorderType,
} from "@/lib/pronunciation/audio";

type Labels = Dictionary["pronunciation"];
type Problem = keyof Labels["problems"];
type Phase = "idle" | "requesting" | "recording" | "recorded" | "sending" | "sent" | "failed";
type Take = { url: string; blob: Blob; durationMs: number; attemptId: string };

/**
 * Records the student's pronunciation with MediaRecorder, lets them listen
 * back, and sends it only when they press "send". The attempt id is created
 * with the recording, so retrying a failed send finishes the same attempt.
 */
export function Recorder({ assignmentId, labels }: { assignmentId: string; labels: Labels }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Take | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const interruptedRef = useRef(false);

  function releaseMicrophone() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Free the microphone and the preview URL when the page is left.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseMicrophone();
    };
  }, []);
  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url);
  }, [take]);

  async function start() {
    setProblem(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setProblem("unsupported");
      return;
    }
    const mimeType = pickRecorderType((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      setProblem("unsupported");
      return;
    }

    setPhase("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      setProblem(microphoneProblem(error));
      setPhase("idle");
      return;
    }
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    interruptedRef.current = false;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      interruptedRef.current = true;
      if (recorder.state === "recording") recorder.stop();
    };
    // The microphone disappeared (unplugged, taken by another app).
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        interruptedRef.current = true;
        if (recorder.state === "recording") recorder.stop();
      };
    });
    recorder.onstop = () => {
      const durationMs = Math.round(performance.now() - startedAt);
      releaseMicrophone();
      if (interruptedRef.current) {
        setProblem("interrupted");
        setPhase("idle");
        return;
      }
      const type = normalizeAudioType(recorder.mimeType || mimeType) ?? "audio/webm";
      const blob = new Blob(chunks, { type });
      const issue = checkAudio(blob, { maxBytes: MAX_ATTEMPT_BYTES, durationMs });
      if (issue) {
        setProblem(issue === "too_large" ? "too_large" : "too_small");
        setPhase("idle");
        return;
      }
      setTake({ url: URL.createObjectURL(blob), blob, durationMs, attemptId: crypto.randomUUID() });
      setPhase("recorded");
    };

    recorder.start(250);
    setElapsed(0);
    setPhase("recording");
    timerRef.current = window.setInterval(() => {
      const ms = performance.now() - startedAt;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS && recorder.state === "recording") recorder.stop();
    }, 200);
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function discard() {
    setTake(null);
    setProblem(null);
    setPhase("idle");
  }

  async function send() {
    if (!take) return;
    setPhase("sending");
    setProblem(null);
    const type = normalizeAudioType(take.blob.type) ?? "audio/webm";
    const form = new FormData();
    form.append("assignmentId", assignmentId);
    form.append("attemptId", take.attemptId);
    form.append("durationMs", String(take.durationMs));
    form.append("file", new File([take.blob], `attempt.${extensionFor(type)}`, { type }));

    try {
      const response = await fetch("/api/pronunciation/attempts", { method: "POST", body: form });
      if (response.ok) {
        setPhase("sent");
        setTake(null);
        router.refresh();
        return;
      }
      // 5xx: technical failure, the same attempt can be sent again.
      // 4xx: the server refused this recording.
      setProblem(response.status >= 500 ? "upload" : response.status === 422 ? "too_small" : "rejected");
    } catch {
      setProblem("upload");
    }
    setPhase("failed");
  }

  const busy = phase === "requesting" || phase === "sending";

  return (
    <section aria-labelledby="recorder-title" className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <h2 id="recorder-title" className="text-lg font-semibold">
        {labels.yourTurn}
      </h2>
      <p className="max-w-prose text-sm text-muted">{labels.consent}</p>

      <div aria-live="polite" className="space-y-3">
        {phase === "requesting" && <p className="text-sm">{labels.requesting}</p>}

        {phase === "recording" && (
          <p className="flex items-center gap-3 text-lg font-medium text-red-800">
            <span aria-hidden="true" className="inline-block size-3 rounded-full bg-red-600 motion-safe:animate-pulse" />
            {labels.recording}
            <span role="timer" className="font-mono tabular-nums">
              {formatDuration(elapsed)} / {formatDuration(MAX_RECORDING_MS)}
            </span>
          </p>
        )}

        {(phase === "recorded" || phase === "failed" || phase === "sending") && take && (
          <div className="space-y-2">
            <p className="text-sm text-muted">{labels.listenBack}</p>
            <audio src={take.url} controls aria-label={labels.yourTurn} className="w-full max-w-md" />
          </div>
        )}

        {phase === "sent" && (
          <p role="status" className="rounded-lg bg-mint px-3 py-2 text-sm">
            {labels.sent}
          </p>
        )}

        {problem && (
          <p role="alert" className="max-w-prose rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {labels.problems[problem]}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {(phase === "idle" || phase === "requesting") && (
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="rounded-full bg-primary px-6 py-3 text-lg font-medium text-white hover:bg-primary-strong disabled:opacity-60"
          >
            ● {labels.start}
          </button>
        )}
        {phase === "recording" && (
          <button
            type="button"
            onClick={stop}
            className="rounded-full bg-red-700 px-6 py-3 text-lg font-medium text-white hover:bg-red-800"
          >
            ■ {labels.stop}
          </button>
        )}
        {(phase === "recorded" || phase === "failed" || phase === "sending") && take && (
          <>
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="rounded-full bg-primary px-6 py-3 text-lg font-medium text-white hover:bg-primary-strong disabled:opacity-60"
            >
              {phase === "sending" ? labels.sending : phase === "failed" ? labels.retry : labels.send}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={busy}
              className="rounded-full border border-line bg-surface px-5 py-3 hover:bg-mint disabled:opacity-60"
            >
              {labels.rerecord}
            </button>
          </>
        )}
        {phase === "sent" && (
          <button
            type="button"
            onClick={discard}
            className="rounded-full border border-primary bg-surface px-5 py-3 font-medium text-primary hover:bg-mint"
          >
            {labels.newAttempt}
          </button>
        )}
      </div>
      {phase === "idle" && <p className="text-xs text-muted">{labels.maxLength}</p>}
    </section>
  );
}
