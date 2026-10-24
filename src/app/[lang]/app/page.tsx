import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { cabinetHome, primaryRole } from "@/lib/auth/routes";
import { requireUser } from "@/lib/auth/session";

// Sends the signed-in user to the cabinet of their main role.
export default async function AppPage() {
  const dict = await getDictionary();

  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Suspense fallback={<Loading label={dict.auth.pending} />}>
          <RoleRedirect />
        </Suspense>
      </main>
    </>
  );
}

async function RoleRedirect() {
  const locale = await getLocale();
  const user = await requireUser(locale);
  if (user.blocked) return <AccessState kind="blocked" />;

  const role = primaryRole(user.roles);
  if (!role) return <AccessState kind="no-role" />;
  redirect(`/${locale}/${cabinetHome[role]}`);
}
