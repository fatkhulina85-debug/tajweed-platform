import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { localized, paragraphs, readBody, type BlockType } from "@/lib/content/blocks";
import type { getLesson } from "@/lib/content/queries";

type Lesson = NonNullable<Awaited<ReturnType<typeof getLesson>>>;

const calloutTypes: BlockType[] = ["makhraj", "sifat", "mastery"];

/** Renders a lesson for students and for the admin preview. */
export function LessonView({
  lesson,
  locale,
  dict,
  answerKeys,
  exerciseHref,
}: {
  lesson: Lesson;
  locale: Locale;
  dict: Dictionary;
  /** Present only in the admin preview. */
  answerKeys?: Map<string, number[]>;
  /** Link to the pronunciation trainer; absent in the admin preview. */
  exerciseHref?: (assignmentId: string) => string;
}) {
  const objectives = Array.isArray(lesson.objectives) ? (lesson.objectives as string[]) : [];
  const blocks = lesson.lesson_blocks.filter((block) => !block.locale || block.locale === locale);
  const quizzes = lesson.assignments.filter((a) => a.type === "quiz" && a.quiz_questions.length > 0);
  const exercises = lesson.assignments.filter((a) => a.type === "audio");
  const parent = lesson.modules;

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        {parent && (
          <p className="text-sm text-muted">
            {parent.courses && `${localized(locale, parent.courses.title, parent.courses.title_ar)} · `}
            {localized(locale, parent.title, parent.title_ar)}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-primary">
          {localized(locale, lesson.title, lesson.title_ar)}
        </h1>
        {lesson.estimated_minutes && (
          <p className="text-sm text-muted">
            {lesson.estimated_minutes} {dict.content.minutesShort}
          </p>
        )}
      </header>

      {objectives.length > 0 && (
        <section className="rounded-xl bg-mint p-4">
          <h2 className="mb-2 font-semibold">{dict.content.objectivesTitle}</h2>
          <ul className="list-disc space-y-1 ps-5">
            {objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </section>
      )}

      {blocks.map((block) => {
        const body = readBody(block.block_type, block.body);
        const source = block.source_references;
        const callout = calloutTypes.includes(block.block_type);
        const heading = block.title || (callout ? dict.content.blockTypes[block.block_type] : "");

        return (
          <section
            key={block.id}
            className={
              callout
                ? "space-y-3 rounded-xl border-s-4 border-accent bg-surface p-4"
                : "space-y-3"
            }
          >
            {heading && <h2 className="text-lg font-semibold text-ink">{heading}</h2>}

            {body.kind === "text" &&
              paragraphs(body.text).map((paragraph, i) => (
                <p key={i} className="max-w-prose whitespace-pre-line leading-relaxed">
                  {paragraph}
                </p>
              ))}

            {body.kind === "arabic" && (
              <>
                <p lang="ar" dir="rtl" className="arabic rounded-lg bg-surface p-4 text-center">
                  {body.arabic}
                </p>
                {body.note && <p className="max-w-prose text-muted">{body.note}</p>}
              </>
            )}

            {body.kind === "table" && (
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full text-center">
                  <tbody>
                    {body.rows.map((row, r) => (
                      <tr key={r} className={r > 0 ? "border-t border-line" : ""}>
                        {row.map((cell, c) => {
                          const Cell = body.header && r === 0 ? "th" : "td";
                          const arabic = /[؀-ۿ]/.test(cell);
                          return (
                            <Cell
                              key={c}
                              lang={arabic ? "ar" : undefined}
                              dir={arabic ? "rtl" : undefined}
                              className={`px-3 py-2 ${arabic ? "arabic" : ""} ${Cell === "th" ? "bg-mint font-semibold" : ""}`}
                            >
                              {cell}
                            </Cell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {source && (
              <p className="text-xs text-muted">
                {dict.content.sourceLabel}: {source.title}
                {source.author && `, ${source.author}`}
                {source.edition && `, ${source.edition}`}
                {source.page_or_section && `, ${source.page_or_section}`}
              </p>
            )}
          </section>
        );
      })}

      {exercises.map((exercise) => (
        <section key={exercise.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5">
          <div className="space-y-1">
            <p className="text-sm text-muted">{dict.pronunciation.exerciseLabel}</p>
            <h2 className="text-lg font-semibold">{exercise.title}</h2>
          </div>
          {exerciseHref ? (
            <Link
              href={exerciseHref(exercise.id)}
              className="rounded-full bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-strong"
            >
              {dict.pronunciation.openExercise}
            </Link>
          ) : (
            <p className="text-sm text-muted">{dict.pronunciation.studentLink}</p>
          )}
        </section>
      ))}

      {quizzes.map((quiz) => (
        <section key={quiz.id} className="space-y-4 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">{quiz.title}</h2>
          {quiz.instructions && <p className="text-muted">{quiz.instructions}</p>}
          <ol className="list-decimal space-y-4 ps-5">
            {quiz.quiz_questions.map((question) => {
              const options = Array.isArray(question.options) ? (question.options as string[]) : [];
              const key = answerKeys?.get(question.id) ?? [];
              return (
                <li key={question.id} className="space-y-2">
                  <p>{question.prompt}</p>
                  <ul className="space-y-1">
                    {options.map((option, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <input type="radio" disabled name={question.id} aria-label={option} />
                        <span>{option}</span>
                        {key.includes(i) && (
                          <span className="text-xs text-primary">({dict.content.correctMark})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p className="text-sm text-muted">{dict.content.quizNote}</p>
        </section>
      ))}
    </article>
  );
}
