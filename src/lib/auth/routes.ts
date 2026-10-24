import { hasLocale, type Locale } from "@/i18n/config";

export type Role = "student" | "teacher" | "admin";

export const roles: readonly Role[] = ["student", "teacher", "admin"];

/** First page of each cabinet. */
export const cabinetHome: Record<Role, string> = {
  student: "student/dashboard",
  teacher: "teacher/dashboard",
  admin: "admin/users",
};

/** Cabinet to open when a user has several roles. */
export function primaryRole(userRoles: readonly Role[]): Role | null {
  for (const role of ["admin", "teacher", "student"] as const) {
    if (userRoles.includes(role)) return role;
  }
  return null;
}

const protectedSections = new Set(["app", "account", "set-password", ...roles]);
const guestOnlySections = new Set(["login", "reset-password"]);

/**
 * Optimistic routing decision for the proxy, based only on whether a session
 * cookie is valid. Role checks happen on the server next to the data.
 */
export function routeDecision(
  pathname: string,
  signedIn: boolean,
): { redirectTo: string } | null {
  const [, locale, section] = pathname.split("/");
  if (!hasLocale(locale) || !section) return null;

  if (!signedIn && protectedSections.has(section)) {
    return { redirectTo: `/${locale}/login?next=${encodeURIComponent(pathname)}` };
  }
  if (signedIn && guestOnlySections.has(section)) {
    return { redirectTo: `/${locale}/app` };
  }
  return null;
}

/**
 * Accepts only same-site paths inside a locale, so `next` cannot be used for
 * open redirects (`//evil.com`, `https://…`).
 */
export function safeNextPath(next: string | null | undefined, locale: Locale): string {
  if (next && /^\/(ru|ar)(\/[\w\-/]*)?$/.test(next) && !next.includes("//")) {
    return next;
  }
  return `/${locale}/app`;
}
