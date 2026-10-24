import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";

export type FormError =
  | "invalid_email"
  | "invalid_credentials"
  | "blocked"
  | "weak_password"
  | "password_mismatch"
  | "session_expired"
  | "already_exists"
  | "not_allowed"
  | "duplicate"
  | "invalid_input"
  | "not_audited"
  | "unknown";

export type FormState = { error?: FormError; ok?: boolean } | undefined;

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function formLocale(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(value) ? value : defaultLocale;
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Mirrors Supabase Auth settings: at least 8 characters, letters and digits. */
export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /\p{L}/u.test(value) && /\d/.test(value);
}
