import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { Field, HiddenLocale } from "@/components/auth-card";
import { ActionButton, Checkbox, Panel, Pill, SelectField, TextArea } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { userWithRole } from "@/lib/auth/session";
import {
  addBlock,
  addQuestion,
  createAssignment,
  deleteBlock,
  deleteQuestion,
  move,
  setStatus,
  updateBlock,
  updateLesson,
} from "@/lib/content/actions";
import { blockTypes, formatTable, localized, readBody } from "@/lib/content/blocks";
import { getAnswerKeys, getLesson, listSources } from "@/lib/content/queries";

export default async function LessonEditorPage({ params }: PageProps<"/[lang]/admin/content/[lessonId]">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<Loading label={dict.auth.pending} />}>
      <Editor lessonId={params.then((p) => p.lessonId)} />
    </Suspense>
  );
}

type Source = Awaited<ReturnType<typeof listSources>>[number];

async function Editor({ lessonId: lessonIdPromise }: { lessonId: Promise<string> }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "admin"))) return <AccessState kind="denied" />;

  const lessonId = await lessonIdPromise;
  const [lesson, sources] = await Promise.all([getLesson(lessonId), listSources()]);
  if (!lesson) return <p className="text-muted">{dict.content.notFound}</p>;

  const t = dict.content;
  const questionIds = lesson.assignments.flatMap((a) => a.quiz_questions.map((q) => q.id));
  const keys = await getAnswerKeys(questionIds);
  const published = lesson.status === "published";
  const audited = lesson.source_audit_status === "verified" || lesson.source_audit_status === "not_required";
  const courseId = lesson.modules?.course_id;
  const objectives = Array.isArray(lesson.objectives) ? (lesson.objectives as string[]) : [];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {courseId && (
          <Link href={`/${locale}/admin/courses/${courseId}`} className="text-sm text-primary underline">
            ← {t.backToCourse}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-primary">{localized(locale, lesson.title, lesson.title_ar)}</h1>
          <Pill tone={lesson.status}>{t.status[lesson.status]}</Pill>
          <Pill tone={lesson.source_audit_status}>{t.audit[lesson.source_audit_status]}</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            action={setStatus}
            fields={{ table: "lessons", id: lesson.id, status: published ? "draft" : "published" }}
            variant={published ? "secondary" : "primary"}
            disabled={!published && !audited}
          >
            {published ? t.unpublish : t.publish}
          </ActionButton>
          <Link
            href={`/${locale}/admin/content/${lesson.id}/preview`}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-mint"
          >
            {t.preview}
          </Link>
        </div>
        {!published && !audited && (
          <p role="note" className="max-w-prose rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t.publishBlocked}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-4">
          <h2 className="text-lg font-semibold">{t.blocks}</h2>
          {lesson.lesson_blocks.length === 0 && <p className="text-muted">{t.noBlocks}</p>}
          <ol className="space-y-3">
            {lesson.lesson_blocks.map((block, i) => (
              <li key={block.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-muted">{block.position}.</span>
                  <span className="font-medium">{t.blockTypes[block.block_type]}</span>
                  {block.title && <span className="text-muted">· {block.title}</span>}
                  <Pill tone={block.authoring_type === "source" ? "verified" : "draft"}>
                    {t.authoring[block.authoring_type]}
                  </Pill>
                  {block.locale && <Pill tone="draft">{block.locale === "ru" ? t.onlyRu : t.onlyAr}</Pill>}
                  <span className="ms-auto flex flex-wrap gap-1">
                    <ActionButton action={move} fields={{ table: "lesson_blocks", id: block.id, direction: "up" }} disabled={i === 0}>
                      ↑ <span className="sr-only">{t.moveUp}</span>
                    </ActionButton>
                    <ActionButton
                      action={move}
                      fields={{ table: "lesson_blocks", id: block.id, direction: "down" }}
                      disabled={i === lesson.lesson_blocks.length - 1}
                    >
                      ↓ <span className="sr-only">{t.moveDown}</span>
                    </ActionButton>
                    <ActionButton action={deleteBlock} fields={{ id: block.id }} variant="danger">
                      {t.delete}
                    </ActionButton>
                  </span>
                </div>
                <BlockSummary type={block.block_type} body={block.body} />
                <details>
                  <summary className="cursor-pointer text-sm text-primary">{t.edit}</summary>
                  <div className="mt-3">
                    <BlockForm
                      dict={dict}
                      locale={locale}
                      sources={sources}
                      lessonId={lesson.id}
                      block={block}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ol>

          <Panel title={t.newBlock}>
            <BlockForm dict={dict} locale={locale} sources={sources} lessonId={lesson.id} />
          </Panel>

          <h2 className="pt-4 text-lg font-semibold">{t.assignments}</h2>
          {lesson.assignments.map((assignment) => {
            const assignmentPublished = assignment.status === "published";
            return (
              <div key={assignment.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{assignment.title}</h3>
                  <Pill tone="draft">{t.assignmentTypes[assignment.type]}</Pill>
                  <Pill tone={assignment.status}>{t.status[assignment.status]}</Pill>
                  <span className="ms-auto">
                    <ActionButton
                      action={setStatus}
                      fields={{ table: "assignments", id: assignment.id, status: assignmentPublished ? "draft" : "published" }}
                    >
                      {assignmentPublished ? t.unpublish : t.publish}
                    </ActionButton>
                  </span>
                </div>
                {assignment.instructions && <p className="text-sm text-muted">{assignment.instructions}</p>}
                {assignment.type === "quiz" && (
                  <>
                    <ol className="list-decimal space-y-2 ps-5 text-sm">
                      {assignment.quiz_questions.map((question) => {
                        const options = Array.isArray(question.options) ? (question.options as string[]) : [];
                        const key = keys.get(question.id) ?? [];
                        return (
                          <li key={question.id} className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <span>{question.prompt}</span>
                              <ActionButton action={deleteQuestion} fields={{ id: question.id }} variant="danger">
                                {t.delete}
                              </ActionButton>
                            </div>
                            <ul className="text-muted">
                              {options.map((option, oi) => (
                                <li key={oi} className={key.includes(oi) ? "font-medium text-primary" : ""}>
                                  {oi + 1}. {option} {key.includes(oi) && `(${t.correctMark})`}
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ol>
                    <details>
                      <summary className="cursor-pointer text-sm text-primary">+ {t.newQuestion}</summary>
                      <div className="mt-3 max-w-md">
                        <ActionForm action={addQuestion} submitLabel={t.add} pendingLabel={dict.auth.pending} errors={dict.errors}>
                          <HiddenLocale locale={locale} />
                          <input type="hidden" name="assignment_id" value={assignment.id} />
                          <TextArea label={t.prompt} name="prompt" rows={2} required />
                          <TextArea label={t.options} name="options" rows={4} required />
                          <Field label={t.correct} name="correct" type="number" />
                        </ActionForm>
                      </div>
                    </details>
                  </>
                )}
              </div>
            );
          })}
          <Panel title={t.newAssignment}>
            <ActionForm action={createAssignment} submitLabel={t.create} pendingLabel={dict.auth.pending} errors={dict.errors}>
              <HiddenLocale locale={locale} />
              <input type="hidden" name="lesson_id" value={lesson.id} />
              <Field label={t.title} name="title" />
              <SelectField
                label={t.assignmentType}
                name="type"
                defaultValue="quiz"
                options={(["quiz", "audio", "written"] as const).map((v) => ({ value: v, label: t.assignmentTypes[v] }))}
              />
              <TextArea label={t.instructions} name="instructions" rows={2} />
            </ActionForm>
          </Panel>
        </section>

        <Panel title={t.lessonSettings}>
          <ActionForm
            action={updateLesson}
            submitLabel={t.save}
            pendingLabel={dict.auth.pending}
            successText={t.saved}
            errors={dict.errors}
          >
            <HiddenLocale locale={locale} />
            <input type="hidden" name="id" value={lesson.id} />
            <Field label={t.title} name="title" defaultValue={lesson.title} />
            <Field label={t.titleAr} name="title_ar" required={false} defaultValue={lesson.title_ar} />
            <TextArea label={t.objectives} name="objectives" rows={4} defaultValue={objectives.join("\n")} />
            <Field
              label={t.minutes}
              name="estimated_minutes"
              type="number"
              required={false}
              defaultValue={lesson.estimated_minutes?.toString() ?? ""}
            />
            <SelectField
              label={t.auditStatus}
              name="source_audit_status"
              defaultValue={lesson.source_audit_status}
              options={(["pending", "in_review", "verified", "not_required"] as const).map((v) => ({
                value: v,
                label: t.audit[v],
              }))}
            />
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}

function BlockSummary({ type, body }: { type: Parameters<typeof readBody>[0]; body: unknown }) {
  const value = readBody(type, body);
  const text =
    value.kind === "text" ? value.text : value.kind === "arabic" ? value.arabic : `${value.rows.length} × ${value.rows[0]?.length ?? 0}`;
  return (
    <p
      className={`line-clamp-3 whitespace-pre-line text-sm text-muted ${value.kind === "arabic" ? "arabic" : ""}`}
      dir={value.kind === "arabic" ? "rtl" : undefined}
      lang={value.kind === "arabic" ? "ar" : undefined}
    >
      {text}
    </p>
  );
}

type Block = NonNullable<Awaited<ReturnType<typeof getLesson>>>["lesson_blocks"][number];

function BlockForm({
  dict,
  locale,
  sources,
  lessonId,
  block,
}: {
  dict: Dictionary;
  locale: Locale;
  sources: Source[];
  lessonId: string;
  block?: Block;
}) {
  const t = dict.content;
  const body = block ? readBody(block.block_type, block.body) : null;

  return (
    <ActionForm
      action={block ? updateBlock : addBlock}
      submitLabel={block ? t.save : t.add}
      pendingLabel={dict.auth.pending}
      successText={block ? t.saved : undefined}
      errors={dict.errors}
    >
      <HiddenLocale locale={locale} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      {block && <input type="hidden" name="id" value={block.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t.blockType}
          name="block_type"
          defaultValue={block?.block_type ?? "text"}
          options={blockTypes.map((v) => ({ value: v, label: t.blockTypes[v] }))}
        />
        <SelectField
          label={t.blockLocale}
          name="block_locale"
          defaultValue={block?.locale ?? ""}
          options={[
            { value: "", label: t.allLocales },
            { value: "ru", label: t.onlyRu },
            { value: "ar", label: t.onlyAr },
          ]}
        />
      </div>
      <Field label={t.blockTitle} name="title" required={false} defaultValue={block?.title ?? ""} />
      <p className="text-xs text-muted">{t.blockFieldsHint}</p>
      <TextArea label={t.blockText} name="text" rows={5} defaultValue={body?.kind === "text" ? body.text : ""} />
      <TextArea label={t.blockArabic} name="arabic" rows={3} dir="rtl" defaultValue={body?.kind === "arabic" ? body.arabic : ""} />
      <TextArea label={t.blockNote} name="note" rows={2} defaultValue={body?.kind === "arabic" ? body.note : ""} />
      <TextArea
        label={t.blockTable}
        name="table"
        rows={4}
        defaultValue={body?.kind === "table" ? formatTable(body.rows) : ""}
      />
      <Checkbox label={t.tableHeader} name="header" defaultChecked={body?.kind === "table" ? body.header : true} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t.authoringType}
          name="authoring_type"
          defaultValue={block?.authoring_type ?? "authored"}
          options={(["authored", "source"] as const).map((v) => ({ value: v, label: t.authoring[v] }))}
        />
        <SelectField
          label={t.source}
          name="source_reference_id"
          defaultValue={block?.source_reference_id ?? ""}
          options={[
            { value: "", label: t.noSource },
            ...sources.map((s) => ({ value: s.id, label: s.page_or_section ? `${s.title}, ${s.page_or_section}` : s.title })),
          ]}
        />
      </div>
    </ActionForm>
  );
}
