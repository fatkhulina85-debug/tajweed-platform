import "server-only";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The signed-in admin, or null. Every admin Server Action calls this first:
 * actions are public endpoints, so the page that rendered the form proves nothing.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.roles.includes("admin") ? user : null;
}

/** Maps Postgres error codes to form errors. */
export function dbError(code: string | undefined) {
  if (code === "23505") return "duplicate" as const;
  if (code === "23514" || code === "22P02" || code === "23502") return "invalid_input" as const;
  if (code === "42501") return "not_allowed" as const;
  return "unknown" as const;
}
