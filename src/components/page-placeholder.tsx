import type { ReactNode } from "react";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";

/** Temporary page body for routes that later stages will implement. */
export async function PagePlaceholder({
  page,
  children,
}: {
  page: keyof Dictionary["pages"];
  children?: ReactNode;
}) {
  const dict = await getDictionary();
  const { title, description } = dict.pages[page];

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      <p className="max-w-prose text-muted">{description}</p>
      {children}
      <p className="rounded-lg border border-dashed border-line bg-mint px-4 py-3 text-sm text-ink">
        {dict.common.inProgress}
      </p>
    </section>
  );
}

/** Shows a route parameter; must render inside <Suspense> (request data). */
export async function RouteParam({
  label,
  value,
}: {
  label: string;
  value: Promise<string>;
}) {
  return (
    <p className="text-sm text-muted">
      {label}: <code dir="ltr">{await value}</code>
    </p>
  );
}
