import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function HomePage() {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <>
      <SiteHeader />
      <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 md:py-16">
        <section className="max-w-2xl space-y-5">
          <h1 className="text-3xl font-semibold text-primary md:text-4xl">
            {dict.home.title}
          </h1>
          <p className="text-lg text-muted">{dict.home.subtitle}</p>
          <p className="arabic text-ink" lang="ar" dir="rtl">
            وَرَتِّلِ ٱلْقُرْءَانَ تَرْتِيلًا
          </p>
          <Link
            href={`/${locale}/login`}
            className="inline-block rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary-strong"
          >
            {dict.home.cta}
          </Link>
        </section>

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {dict.home.features.map((feature) => (
            <li
              key={feature.title}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <h2 className="mb-2 font-semibold text-ink">{feature.title}</h2>
              <p className="text-sm text-muted">{feature.text}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
