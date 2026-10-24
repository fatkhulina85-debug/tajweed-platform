"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "./guard";
import { roles, type Role } from "@/lib/auth/routes";
import { formLocale, isEmail, text, type FormState } from "@/lib/auth/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function parseRole(value: string): Role | null {
  return roles.includes(value as Role) ? (value as Role) : null;
}

export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "not_allowed" };

  const email = text(formData, "email").toLowerCase();
  const role = parseRole(text(formData, "role"));
  const displayName = text(formData, "display_name").slice(0, 120);
  if (!isEmail(email) || !role) return { error: "invalid_email" };

  // Sending an invitation is the one step that needs the service role.
  const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName, locale: formLocale(formData) },
  });
  if (error || !data.user) {
    return { error: error?.code === "email_exists" ? "already_exists" : "unknown" };
  }

  // The role is granted as the admin, so RLS checks it and the audit log
  // records who granted it.
  const supabase = await createClient();
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({ user_id: data.user.id, role, created_by: admin.id });
  if (roleError) return { error: "unknown" };

  refresh();
  return { ok: true };
}

export async function setRole(formData: FormData) {
  const admin = await requireAdmin();
  const role = parseRole(text(formData, "role"));
  const userId = text(formData, "user_id");
  if (!admin || !role || !userId) return;

  const supabase = await createClient();
  if (text(formData, "grant") === "1") {
    await supabase.from("user_roles").insert({ user_id: userId, role, created_by: admin.id });
  } else {
    await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  }
  refresh();
}

export async function setBlocked(formData: FormData) {
  const admin = await requireAdmin();
  const userId = text(formData, "user_id");
  if (!admin || !userId || userId === admin.id) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ status: text(formData, "blocked") === "1" ? "blocked" : "active" })
    .eq("id", userId);
  refresh();
}

export async function assignTeacher(formData: FormData) {
  const admin = await requireAdmin();
  const studentId = text(formData, "student_id");
  const teacherId = text(formData, "teacher_id");
  if (!admin || !studentId) return;

  const supabase = await createClient();
  // One active teacher per student for now: deactivate, then add the new one.
  await supabase
    .from("teacher_assignments")
    .update({ active: false })
    .eq("student_id", studentId)
    .eq("active", true)
    .neq("teacher_id", teacherId || "00000000-0000-0000-0000-000000000000");

  if (teacherId) {
    const { data: existing } = await supabase
      .from("teacher_assignments")
      .select("id")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .eq("active", true)
      .maybeSingle();
    if (!existing) {
      await supabase
        .from("teacher_assignments")
        .insert({ teacher_id: teacherId, student_id: studentId, created_by: admin.id });
    }
  }
  refresh();
}
