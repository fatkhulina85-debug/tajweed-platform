"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_REFERENCE_BYTES, checkAudio } from "@/lib/pronunciation/audio";

/** Admin: uploads a real reference recording for an audio exercise. */
export function ReferenceUpload({
  assignmentId,
  labels,
}: {
  assignmentId: string;
  labels: { upload: string; uploading: string; done: string; failed: string; hint: string; field: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "uploading" | "done" | "failed">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || checkAudio(file, { maxBytes: MAX_REFERENCE_BYTES })) {
      setState("failed");
      return;
    }
    setState("uploading");
    const form = new FormData();
    form.append("assignmentId", assignmentId);
    form.append("file", file);
    try {
      const response = await fetch("/api/pronunciation/reference", { method: "POST", body: form });
      setState(response.ok ? "done" : "failed");
      if (response.ok) router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{labels.field}</span>
        <input
          type="file"
          name="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/webm,audio/wav"
          required
          className="block w-full text-sm"
        />
        <span className="block text-xs text-muted">{labels.hint}</span>
      </label>
      <button
        type="submit"
        disabled={state === "uploading"}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-mint disabled:opacity-60"
      >
        {state === "uploading" ? labels.uploading : labels.upload}
      </button>
      <p aria-live="polite" className="text-sm">
        {state === "done" && <span className="text-primary">{labels.done}</span>}
        {state === "failed" && <span className="text-red-800">{labels.failed}</span>}
      </p>
    </form>
  );
}
