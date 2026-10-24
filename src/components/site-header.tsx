import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";
import { UserMenu } from "./user-menu";

export async function SiteHeader({ subtitle }: { subtitle?: string }) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href={`/${locale}`}
          className="flex items-baseline gap-2 text-lg font-semibold text-primary"
        >
          {dict.common.appName}
          {subtitle && (
            <span className="text-sm font-normal text-muted">{subtitle}</span>
          )}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense fallback={null}>
            <UserMenu />
          </Suspense>
          <LanguageSwitcher current={locale} label={dict.common.language} />
        </div>
      </div>
    </header>
  );
}
