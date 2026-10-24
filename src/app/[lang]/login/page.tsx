import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AuthCard, Field, HiddenLocale } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { signIn } from "@/lib/auth/actions";

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/login">) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <AuthCard title={dict.auth.loginTitle}>
      <Suspense fallback={null}>
        <LinkError searchParams={searchParams} message={dict.auth.linkError} />
      </Suspense>
      <ActionForm
        action={signIn}
        submitLabel={dict.auth.submit}
        pendingLabel={dict.auth.pending}
        errors={dict.errors}
      >
        <HiddenLocale locale={locale} />
        <Suspense fallback={null}>
          <NextField searchParams={searchParams} />
        </Suspense>
        <Field label={dict.auth.email} name="email" type="email" autoComplete="email" ltr />
        <Field
          label={dict.auth.password}
          name="password"
          type="password"
          autoComplete="current-password"
          ltr
        />
      </ActionForm>
      <Link href={`/${locale}/reset-password`} className="block text-sm text-primary underline">
        {dict.auth.forgot}
      </Link>
      <p className="text-xs text-muted">{dict.auth.inviteOnly}</p>
    </AuthCard>
  );
}

type SearchParams = PageProps<"/[lang]/login">["searchParams"];

async function NextField({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return typeof next === "string" ? <input type="hidden" name="next" value={next} /> : null;
}

async function LinkError({
  searchParams,
  message,
}: {
  searchParams: SearchParams;
  message: string;
}) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}
