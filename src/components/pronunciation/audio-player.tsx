"use client";

import { useRef, useState } from "react";

/**
 * Plays a private recording. The signed URL is requested only when the user
 * presses play, and requested again once if it has expired.
 */
export function AudioPlayer({
  query,
  label,
  labels,
  size = "normal",
}: {
  /** "submission=<id>" or "reference=<exercise id>" */
  query: string;
  label: string;
  labels: { loading: string; error: string };
  size?: "normal" | "large";
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const retried = useRef(false);

  async function load(autoplay: boolean) {
    setState("loading");
    try {
      const response = await fetch(`/api/pronunciation/audio?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { url: string };
      setUrl(body.url);
      setState("ready");
      if (autoplay) {
        // Wait for React to attach the new src.
        requestAnimationFrame(() => audioRef.current?.play().catch(() => undefined));
      }
    } catch {
      setState("error");
    }
  }

  const big = size === "large";

  return (
    <div className="space-y-2">
      {state !== "ready" && (
        <button
          type="button"
          onClick={() => load(true)}
          disabled={state === "loading"}
          aria-label={label}
          className={`inline-flex items-center gap-2 rounded-full border border-primary bg-surface font-medium text-primary hover:bg-mint disabled:opacity-60 ${
            big ? "px-6 py-3 text-lg" : "px-4 py-2 text-sm"
          }`}
        >
          <span aria-hidden="true">▶</span>
          {state === "loading" ? labels.loading : label}
        </button>
      )}
      {url && (
        <audio
          ref={audioRef}
          src={url}
          controls
          preload="none"
          aria-label={label}
          className={`w-full max-w-md ${state === "ready" ? "" : "hidden"}`}
          onError={() => {
            // Most likely the signed URL expired: get a fresh one once.
            if (!retried.current) {
              retried.current = true;
              void load(false);
            } else {
              setState("error");
            }
          }}
        />
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-red-800">
          {labels.error}
        </p>
      )}
    </div>
  );
}
