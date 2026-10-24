import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AuthCard, Field, HiddenLocale } from "@/components/auth-card";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { setPassword } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";

// Opened from the invite or recovery email after /auth/confirm signed the user in.
export default async function SetPasswordPage() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <AuthCard title={dict.auth.setPasswordTitle}>
      <Suspense fallback={<p className="text-sm text-muted">{dict.auth.pending}</p>}>
        <SignedInEmail />
      </Suspense>
      <ActionForm
        action={setPassword}
        submitLabel={dict.auth.savePassword}
        pendingLabel={dict.auth.pending}
        errors={dict.errors}
      >
        <HiddenLocale locale={locale} />
        <Field
          label={dict.auth.newPassword}
          name="password"
          type="password"
          autoComplete="new-password"
          hint={dict.auth.passwordHint}
          ltr
        />
        <Field
          label={dict.auth.confirmPassword}
          name="confirm"
          type="password"
          autoComplete="new-password"
          ltr
        />
      </ActionForm>
    </AuthCard>
  );
}

async function SignedInEmail() {
  const user = await requireUser(await getLocale());
  return (
    <p className="text-sm text-muted" dir="ltr">
      {user.email}
    </p>
  );
}
