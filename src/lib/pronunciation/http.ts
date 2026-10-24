import "server-only";
import { NextResponse } from "next/server";

/**
 * Route Handlers do not get the Origin check that Server Actions have, so
 * state-changing handlers call this first (CSRF protection on top of the
 * SameSite=Lax session cookie).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** JSON response that is never cached (it may carry signed URLs or personal data). */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lifetime of signed audio URLs. Players request a new one when it expires. */
export const SIGNED_URL_SECONDS = 300;
