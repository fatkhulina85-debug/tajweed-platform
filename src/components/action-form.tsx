"use client";

import { useActionState, type ReactNode } from "react";
import type { FormError, FormState } from "@/lib/auth/validation";

/** Form bound to a Server Action that returns FormState. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  successText,
  errors,
  children,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  successText?: string;
  errors: Record<FormError, string>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors[state.error]}
        </p>
      )}
      {state?.ok && successText && (
        <p role="status" className="rounded-lg bg-mint px-3 py-2 text-sm text-ink">
          {successText}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-strong disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
