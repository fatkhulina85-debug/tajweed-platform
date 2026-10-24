import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/i18n/dictionaries";

export default async function NotFound() {
  const locale = await getLocale();

  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-16">
        <h1 className="text-3xl font-semibold text-primary">404</h1>
        <Link href={`/${locale}`} className="text-primary underline">
          {locale === "ar" ? "العودة إلى الرئيسية" : "На главную"}
        </Link>
      </main>
    </>
  );
}
