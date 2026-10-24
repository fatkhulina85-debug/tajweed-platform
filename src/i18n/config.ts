export const locales = ["ru", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

export const localeCookie = "NEXT_LOCALE";

export const localeDirection: Record<Locale, "ltr" | "rtl"> = {
  ru: "ltr",
  ar: "rtl",
};

export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  ar: "العربية",
};

export function hasLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

/**
 * Picks the locale for a request without a locale prefix:
 * saved choice first, then the browser's Accept-Language, then the default.
 */
export function negotiateLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (hasLocale(cookieValue)) return cookieValue;

  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q === undefined ? 1 : Number(q) };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of preferred) {
    const base = tag.split("-")[0];
    if (hasLocale(base)) return base;
  }

  return defaultLocale;
}

/** Replaces (or adds) the locale prefix of a pathname. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  const segments = pathname.split("/");
  if (hasLocale(segments[1])) {
    segments[1] = locale;
    return segments.join("/");
  }
  return `/${locale}${pathname === "/" ? "" : pathname}`;
}
