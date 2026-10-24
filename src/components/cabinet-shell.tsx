import { Suspense, type ReactNode } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import type { Role } from "@/lib/auth/routes";
import { userWithRole } from "@/lib/auth/session";
import { AccessState, Loading } from "./access-state";
import { NavLink } from "./nav-link";
import { SiteHeader } from "./site-header";

/** Sidebar order per role; labels come from `dict.nav[role]`. */
const navigation = {
  student: ["dashboard", "course", "assignments", "progress", "sessions"],
  teacher: ["dashboard", "students", "assignments", "sessions"],
  admin: ["users", "courses", "sources", "reports"],
} as const;

export async function CabinetShell({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const labels: Record<string, string> = dict.nav[role];

  return (
    <>
      <SiteHeader subtitle={dict.roles[role]} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:gap-8 md:py-8">
        <nav
          aria-label={dict.common.menu}
          className="-mx-4 overflow-x-auto border-b border-line px-4 pb-2 md:mx-0 md:w-56 md:shrink-0 md:overflow-visible md:border-0 md:p-0"
        >
          <ul className="flex gap-1 md:flex-col">
            {navigation[role].map((key) => (
              <li key={key}>
                <NavLink href={`/${locale}/${role}/${key}`} label={labels[key]} />
              </li>
            ))}
          </ul>
        </nav>
        <main id="content" className="min-w-0 flex-1">
          <Suspense fallback={<Loading label={dict.auth.pending} />}>
            <RoleGate role={role}>{children}</RoleGate>
          </Suspense>
        </main>
      </div>
    </>
  );
}

/**
 * Shows the cabinet only to users with the role. This is the UI layer;
 * pages that load data check access again and RLS enforces it in the database.
 */
async function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const user = await userWithRole(await getLocale(), role);
  return user ? children : <AccessState kind="denied" />;
}
