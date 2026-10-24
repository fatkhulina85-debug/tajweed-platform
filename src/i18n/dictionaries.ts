import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";

const dictionaries = {
  ru: () => import("./dictionaries/ru").then((module) => module.default),
  ar: () => import("./dictionaries/ar").then((module) => module.default),
};

/** Locale of the current request, taken from the `[lang]` root segment. */
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

export async function getDictionary() {
  return dictionaries[await getLocale()]();
}

export type { Dictionary } from "./dictionaries/ru";
