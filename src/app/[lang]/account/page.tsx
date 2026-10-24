import Link from "next/link";
import { Suspense } from "react";
import { Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { Field, HiddenLocale } from "@/components/auth-card";
import { SiteHeader } from "@/components/site-header";
import { localeNames, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { updateProfile } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

export default async function AccountPage() {
  const dict = await getDictionary();

  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-10">
        <h1 className="text-2xl font-semibold text-primary">{dict.account.title}</h1>
        <Suspense fallback={<Loading label={dict.auth.pending} />}>
          <AccountForm />
        </Suspense>
      </main>
    </>
  );
}

async function AccountForm() {
  const locale = await getLocale();
  const dict = await getDictionary();
  const user = await requireUser(locale);

  return (
    <div className="space-y-6 rounded-xl border border-line bg-surface p-6">
      <p className="text-sm text-muted" dir="ltr">
        {user.email}
      </p>
      <p className="text-sm">
        <span className="text-muted">{dict.account.yourRoles}: </span>
        {user.roles.map((role) => dict.roles[role]).join(", ") || "—"}
      </p>
      <ActionForm
        action={updateProfile}
        submitLabel={dict.account.save}
        pendingLabel={dict.auth.pending}
        successText={dict.account.saved}
        errors={dict.errors}
      >
        <HiddenLocale locale={locale} />
        <Field
          label={dict.account.displayName}
          name="display_name"
          autoComplete="name"
          required={false}
          defaultValue={user.displayName}
        />
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-ink">{dict.account.preferredLanguage}</span>
          <select
            name="preferred_locale"
            defaultValue={user.locale}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
          >
            {locales.map((value) => (
              <option key={value} value={value}>
                {localeNames[value]}
              </option>
            ))}
          </select>
        </label>
      </ActionForm>
      <Link href={`/${locale}/reset-password`} className="block text-sm text-primary underline">
        {dict.account.changePassword}
      </Link>
    </div>
  );
}
