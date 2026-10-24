"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./routes";
import {
  formLocale,
  isEmail,
  isStrongPassword,
  text,
  type FormState,
} from "./validation";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = formLocale(formData);
  const email = text(formData, "email").toLowerCase();
  const password = formData.get("password");
  if (!isEmail(email) || typeof password !== "string" || !password) {
    return { error: "invalid_credentials" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "invalid_credentials" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.status !== "active") {
    await supabase.auth.signOut();
    return { error: "blocked" };
  }

  redirect(safeNextPath(text(formData, "next"), locale));
}

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${formLocale(formData)}/login`);
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  if (!isEmail(email)) return { error: "invalid_email" };

  const supabase = await createClient();
  // The email template builds the link; the result is not revealed so the
  // form cannot be used to check which addresses have accounts.
  await supabase.auth.resetPasswordForEmail(email);
  return { ok: true };
}

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = formLocale(formData);
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof password !== "string" || !isStrongPassword(password)) {
    return { error: "weak_password" };
  }
  if (password !== confirm) return { error: "password_mismatch" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { error: "session_expired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.code === "weak_password" ? "weak_password" : "unknown" };
  }

  redirect(`/${locale}/app`);
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const displayName = text(formData, "display_name").slice(0, 120);
  const preferredLocale = text(formData, "preferred_locale") === "ar" ? "ar" : "ru";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "session_expired" };

  // RLS limits this update to the caller's own row.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, locale: preferredLocale })
    .eq("id", userId);
  return error ? { error: "unknown" } : { ok: true };
}
