"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  localeCookie,
  localeNames,
  locales,
  switchLocalePath,
  type Locale,
} from "@/i18n/config";

export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 text-sm">
      {/* Until the pathname streams in, links point to each locale's home. */}
      <Suspense fallback={<Links current={current} hrefFor={(locale) => `/${locale}`} />}>
        <CurrentPageLinks current={current} />
      </Suspense>
    </nav>
  );
}

function CurrentPageLinks({ current }: { current: Locale }) {
  const pathname = usePathname();
  return (
    <Links current={current} hrefFor={(locale) => switchLocalePath(pathname, locale)} />
  );
}

function Links({
  current,
  hrefFor,
}: {
  current: Locale;
  hrefFor: (locale: Locale) => string;
}) {
  return locales.map((locale) => (
    <Link
      key={locale}
      href={hrefFor(locale)}
      lang={locale}
      hrefLang={locale}
      aria-current={locale === current ? "true" : undefined}
      onClick={() => {
        document.cookie = `${localeCookie}=${locale}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="rounded-md px-2.5 py-1 text-muted hover:bg-mint aria-[current]:bg-primary aria-[current]:text-white"
    >
      {localeNames[locale]}
    </Link>
  ));
}
