import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { Field, HiddenLocale } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { assignTeacher, inviteUser, setBlocked, setRole } from "@/lib/admin/actions";
import { roles, type Role } from "@/lib/auth/routes";
import { userWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const dict = await getDictionary();

  return (
    <section className="space-y-8">
      <h1 className="text-2xl font-semibold text-primary">{dict.pages.adminUsers.title}</h1>
      <Suspense fallback={<Loading label={dict.auth.pending} />}>
        <UsersAdmin />
      </Suspense>
    </section>
  );
}

async function UsersAdmin() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const admin = await userWithRole(locale, "admin");
  if (!admin) return <AccessState kind="denied" />;

  // RLS lets admins read every row of these tables.
  const supabase = await createClient();
  const [{ data: profiles }, { data: roleRows }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, status").order("created_at"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("teacher_assignments").select("teacher_id, student_id").eq("active", true),
  ]);

  const rolesByUser = new Map<string, Role[]>();
  for (const row of roleRows ?? []) {
    rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role as Role]);
  }
  const teacherOf = new Map((assignments ?? []).map((a) => [a.student_id, a.teacher_id]));
  const users = profiles ?? [];
  const teachers = users.filter((u) => rolesByUser.get(u.id)?.includes("teacher"));

  return (
    <>
      <div className="max-w-md space-y-3 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold text-ink">{dict.admin.inviteTitle}</h2>
        <p className="text-sm text-muted">{dict.admin.inviteHint}</p>
        <ActionForm
          action={inviteUser}
          submitLabel={dict.admin.invite}
          pendingLabel={dict.auth.pending}
          successText={dict.admin.invited}
          errors={dict.errors}
        >
          <HiddenLocale locale={locale} />
          <Field label={dict.auth.email} name="email" type="email" ltr />
          <Field label={dict.admin.name} name="display_name" required={false} />
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-ink">{dict.admin.role}</span>
            <select
              name="role"
              defaultValue="student"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {dict.roles[role]}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">{dict.admin.usersTitle}</h2>
        {users.length === 0 ? (
          <p className="text-muted">{dict.admin.empty}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-mint text-start">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{dict.admin.email}</th>
                  <th className="px-3 py-2 text-start font-medium">{dict.admin.roles}</th>
                  <th className="px-3 py-2 text-start font-medium">{dict.admin.teacher}</th>
                  <th className="px-3 py-2 text-start font-medium">{dict.admin.status}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const userRoles = rolesByUser.get(user.id) ?? [];
                  const isSelf = user.id === admin.id;
                  const blocked = user.status !== "active";
                  return (
                    <tr key={user.id} className="border-t border-line align-top">
                      <td className="px-3 py-3">
                        <div dir="ltr" className="text-start">{user.email}</div>
                        <div className="text-muted">
                          {user.display_name}
                          {isSelf && ` (${dict.admin.you})`}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {roles.map((role) => {
                            const has = userRoles.includes(role);
                            const locked = isSelf && role === "admin";
                            return (
                              <form key={role} action={setRole}>
                                <HiddenLocale locale={locale} />
                                <input type="hidden" name="user_id" value={user.id} />
                                <input type="hidden" name="role" value={role} />
                                <input type="hidden" name="grant" value={has ? "0" : "1"} />
                                <button
                                  type="submit"
                                  disabled={locked}
                                  aria-pressed={has}
                                  className="rounded-full border border-line px-2.5 py-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-white disabled:opacity-60"
                                >
                                  {dict.roles[role]}
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {userRoles.includes("student") ? (
                          <form action={assignTeacher} className="flex gap-2">
                            <HiddenLocale locale={locale} />
                            <input type="hidden" name="student_id" value={user.id} />
                            <select
                              name="teacher_id"
                              defaultValue={teacherOf.get(user.id) ?? ""}
                              aria-label={dict.admin.teacher}
                              className="min-w-0 rounded-lg border border-line bg-surface px-2 py-1"
                            >
                              <option value="">{dict.admin.noTeacher}</option>
                              {teachers
                                .filter((t) => t.id !== user.id)
                                .map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.display_name || t.email}
                                  </option>
                                ))}
                            </select>
                            <button type="submit" className="rounded-lg border border-line px-2 py-1 hover:bg-mint">
                              {dict.admin.assign}
                            </button>
                          </form>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <div className={blocked ? "text-red-800" : "text-primary"}>
                            {blocked ? dict.admin.blocked : dict.admin.active}
                          </div>
                          {!isSelf && (
                            <form action={setBlocked}>
                              <HiddenLocale locale={locale} />
                              <input type="hidden" name="user_id" value={user.id} />
                              <input type="hidden" name="blocked" value={blocked ? "0" : "1"} />
                              <button type="submit" className="text-xs text-muted underline">
                                {blocked ? dict.admin.unblock : dict.admin.block}
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
