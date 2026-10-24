import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { roles as allRoles, type Role } from "./routes";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  blocked: boolean;
  /** Empty for blocked users: blocking removes all access. */
  roles: Role[];
};

/**
 * The signed-in user with profile and roles, or null. Reads the request
 * cookies, so callers must render inside <Suspense>. Deduplicated per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  // getClaims verifies the JWT signature; getSession alone would trust the cookie.
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, display_name, locale, status")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return null;

  const blocked = profile.status !== "active";
  const roles = (roleRows ?? [])
    .map((row) => row.role as Role)
    .filter((role) => allRoles.includes(role));

  return {
    id: userId,
    email: profile.email,
    displayName: profile.display_name,
    locale: profile.locale === "ar" ? "ar" : "ru",
    blocked,
    roles: blocked ? [] : roles,
  };
});

/** Signed-in user or a redirect to the login page. */
export async function requireUser(locale: Locale): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

/**
 * Signed-in user that has `role`, or null when they do not. Pages show an
 * access-denied state for null; data access is additionally enforced by RLS.
 */
export async function userWithRole(locale: Locale, role: Role) {
  const user = await requireUser(locale);
  return user.roles.includes(role) ? user : null;
}
