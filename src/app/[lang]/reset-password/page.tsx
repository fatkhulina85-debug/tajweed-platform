import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AuthCard, Field, HiddenLocale } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { requestPasswordReset } from "@/lib/auth/actions";

export default async function ResetPasswordPage() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <AuthCard title={dict.auth.resetTitle}>
      <p className="text-sm text-muted">{dict.auth.resetHint}</p>
      <ActionForm
        action={requestPasswordReset}
        submitLabel={dict.auth.resetSubmit}
        pendingLabel={dict.auth.pending}
        successText={dict.auth.resetSent}
        errors={dict.errors}
      >
        <HiddenLocale locale={locale} />
        <Field label={dict.auth.email} name="email" type="email" autoComplete="email" ltr />
      </ActionForm>
      <Link href={`/${locale}/login`} className="block text-sm text-primary underline">
        {dict.auth.backToLogin}
      </Link>
    </AuthCard>
  );
}
