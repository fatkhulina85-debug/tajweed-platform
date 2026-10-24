import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";

export async function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="content" className="flex flex-1 items-start justify-center px-4 py-10">
        <section className="w-full max-w-sm space-y-5 rounded-xl border border-line bg-surface p-6">
          <h1 className="text-2xl font-semibold text-primary">{title}</h1>
          {children}
        </section>
      </main>
    </>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  required = true,
  defaultValue,
  ltr = false,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
  /** Force left-to-right input (emails, passwords) in the Arabic interface. */
  ltr?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        dir={ltr ? "ltr" : undefined}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
      />
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function HiddenLocale({ locale }: { locale: string }) {
  return <input type="hidden" name="locale" value={locale} />;
}
