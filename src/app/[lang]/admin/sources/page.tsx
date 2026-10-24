import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { Field, HiddenLocale } from "@/components/auth-card";
import { Panel, Pill, SelectField, TextArea } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import { createSource, updateSource } from "@/lib/content/actions";
import { listSources } from "@/lib/content/queries";

export default async function AdminSourcesPage() {
  const dict = await getDictionary();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary">{dict.pages.adminSources.title}</h1>
      <p className="max-w-prose text-sm text-muted">{dict.content.sourceNotice}</p>
      <Suspense fallback={<Loading label={dict.auth.pending} />}>
        <Sources />
      </Suspense>
    </section>
  );
}

type Source = Awaited<ReturnType<typeof listSources>>[number];

async function Sources() {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "admin"))) return <AccessState kind="denied" />;

  const sources = await listSources();
  const t = dict.content;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0 space-y-3">
        {sources.length === 0 && <p className="text-muted">{t.noSources}</p>}
        {sources.map((source) => (
          <article key={source.id} className="space-y-2 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{source.title}</h2>
              <Pill tone={source.verification_status}>{t.verification[source.verification_status]}</Pill>
              <Pill tone={source.rights_status === "permitted" || source.rights_status === "own" ? "verified" : "pending"}>
                {t.rightsStatus}: {t.rights[source.rights_status]}
              </Pill>
            </div>
            <p className="text-sm text-muted">
              {[source.author, source.edition, source.page_or_section].filter(Boolean).join(" · ")}
            </p>
            {source.notes && <p className="whitespace-pre-line text-sm">{source.notes}</p>}
            <details>
              <summary className="cursor-pointer text-sm text-primary">{t.edit}</summary>
              <div className="mt-3 max-w-md">
                <SourceForm dict={dict} locale={locale} source={source} />
              </div>
            </details>
          </article>
        ))}
      </div>
      <Panel title={t.newSource}>
        <SourceForm dict={dict} locale={locale} />
      </Panel>
    </div>
  );
}

function SourceForm({ dict, locale, source }: { dict: Dictionary; locale: string; source?: Source }) {
  const t = dict.content;
  return (
    <ActionForm
      action={source ? updateSource : createSource}
      submitLabel={source ? t.save : t.create}
      pendingLabel={dict.auth.pending}
      successText={source ? t.saved : undefined}
      errors={dict.errors}
    >
      <HiddenLocale locale={locale} />
      {source && <input type="hidden" name="id" value={source.id} />}
      <Field label={t.title} name="title" defaultValue={source?.title} />
      <Field label={t.author} name="author" required={false} defaultValue={source?.author} />
      <Field label={t.edition} name="edition" required={false} defaultValue={source?.edition} />
      <Field label={t.pageOrSection} name="page_or_section" required={false} defaultValue={source?.page_or_section} />
      <SelectField
        label={t.rightsStatus}
        name="rights_status"
        defaultValue={source?.rights_status ?? "unknown"}
        options={(["unknown", "permitted", "restricted", "own"] as const).map((v) => ({ value: v, label: t.rights[v] }))}
      />
      <SelectField
        label={t.verificationStatus}
        name="verification_status"
        defaultValue={source?.verification_status ?? "pending"}
        options={(["pending", "verified", "rejected"] as const).map((v) => ({ value: v, label: t.verification[v] }))}
      />
      <TextArea label={t.notes} name="notes" rows={3} defaultValue={source?.notes} />
    </ActionForm>
  );
}
