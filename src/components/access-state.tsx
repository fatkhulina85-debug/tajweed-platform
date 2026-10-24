import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function AccessState({ kind }: { kind: "denied" | "no-role" | "blocked" }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const title = kind === "denied" ? dict.access.deniedTitle : dict.access.noRoleTitle;
  const text = {
    denied: dict.access.deniedText,
    "no-role": dict.access.noRoleText,
    blocked: dict.access.blockedText,
  }[kind];

  return (
    <section role="alert" className="space-y-3 rounded-xl border border-line bg-surface p-6">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="text-muted">{text}</p>
      {kind === "denied" && (
        <Link href={`/${locale}/app`} className="inline-block text-primary underline">
          {dict.access.goToCabinet}
        </Link>
      )}
    </section>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="text-sm text-muted">
      {label}
    </p>
  );
}
