import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { AudioPlayer } from "@/components/pronunciation/audio-player";
import { Recorder } from "@/components/pronunciation/recorder";
import { Pill } from "@/components/ui";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import { localized } from "@/lib/content/blocks";
import { formatDuration } from "@/lib/pronunciation/audio";
import { getExercise, listOwnAttempts } from "@/lib/pronunciation/queries";
import { attemptStats } from "@/lib/pronunciation/stats";

export default async function ExercisePage({ params }: PageProps<"/[lang]/student/exercises/[assignmentId]">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<Loading label={dict.auth.pending} />}>
      <Exercise assignmentId={params.then((p) => p.assignmentId)} />
    </Suspense>
  );
}

const verdictTone = { correct: "verified", needs_fix: "pending", retry: "rejected" } as const;

async function Exercise({ assignmentId: idPromise }: { assignmentId: Promise<string> }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const user = await userWithRole(locale, "student");
  if (!user) return <AccessState kind="denied" />;

  const t = dict.pronunciation;
  // RLS returns the exercise only if it is published and the student is enrolled.
  const exercise = await getExercise(await idPromise);
  if (!exercise) return <p className="text-muted">{dict.content.notFound}</p>;

  const attempts = await listOwnAttempts(exercise.id, user.id);
  const rows = attempts.map((a) => ({ ...a, review: a.reviews ?? null }));
  const stats = attemptStats(rows.map((a) => ({ status: a.status, verdict: a.review?.verdict ?? null })));
  const latestReviewed = rows.find((a) => a.review);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const playerLabels = { loading: t.loadingAudio, error: t.audioError };

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        {exercise.lessons && (
          <Link href={`/${locale}/student/lessons/${exercise.lessons.id}`} className="text-sm text-primary underline">
            ← {localized(locale, exercise.lessons.title, exercise.lessons.title_ar)}
          </Link>
        )}
        <p className="text-sm text-muted">{t.exerciseLabel}</p>
        <h1 className="text-2xl font-semibold text-primary">{exercise.title}</h1>
      </header>

      <section className="grid gap-6 rounded-xl border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center">
          <p className="text-sm text-muted">{t.pronounce}</p>
          <p lang="ar" dir="rtl" className="arabic text-[5rem] leading-tight text-ink sm:text-[7rem]">
            {exercise.target_text}
          </p>
        </div>
        <div className="space-y-3">
          {exercise.instructions && <p className="max-w-prose">{exercise.instructions}</p>}
          <h2 className="font-semibold">{t.reference}</h2>
          {exercise.reference_audio_path ? (
            <AudioPlayer query={`reference=${exercise.id}`} label={t.playReference} labels={playerLabels} size="large" />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t.noReference}</p>
          )}
        </div>
      </section>

      <Recorder assignmentId={exercise.id} labels={t} />

      <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold">{t.latestReview}</h2>
        {latestReviewed?.review ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-muted">
                {t.attempt} {latestReviewed.attempt_number}:
              </span>
              <Pill tone={verdictTone[latestReviewed.review.verdict]}>{t.verdict[latestReviewed.review.verdict]}</Pill>
              {latestReviewed.review.error_type && (
                <span className="text-sm text-muted">
                  {t.errorType[latestReviewed.review.error_type as keyof typeof t.errorType]}
                </span>
              )}
            </p>
            {latestReviewed.review.feedback_text && (
              <blockquote className="max-w-prose whitespace-pre-line border-s-4 border-accent ps-3">
                <span className="sr-only">{t.teacherComment}: </span>
                {latestReviewed.review.feedback_text}
              </blockquote>
            )}
          </div>
        ) : (
          <p className="text-muted">{t.noReviewYet}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.history}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              [t.stats.saved, stats.saved],
              [t.stats.correct, stats.correct],
              [t.stats.notYet, stats.notYet],
              [t.stats.awaiting, stats.awaitingReview],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-surface p-3">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-mono text-2xl tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {rows.length === 0 ? (
          <p className="text-muted">{t.noAttempts}</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((attempt) => (
              <li key={attempt.id} className="space-y-2 rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {t.attempt} {attempt.attempt_number}
                  </span>
                  <span className="text-sm text-muted">
                    {date.format(new Date(attempt.submitted_at ?? attempt.created_at))}
                    {attempt.duration_ms ? ` · ${formatDuration(attempt.duration_ms)}` : ""}
                  </span>
                  <Pill tone={attempt.status === "processing_failed" ? "rejected" : attempt.status === "reviewed" ? "verified" : "pending"}>
                    {t.status[attempt.status]}
                  </Pill>
                  {attempt.review && (
                    <Pill tone={verdictTone[attempt.review.verdict]}>{t.verdict[attempt.review.verdict]}</Pill>
                  )}
                </div>
                {attempt.review?.feedback_text && (
                  <p className="max-w-prose whitespace-pre-line text-sm">{attempt.review.feedback_text}</p>
                )}
                {(attempt.status === "needs_teacher_review" || attempt.status === "reviewed") && (
                  <AudioPlayer query={`submission=${attempt.id}`} label={t.play} labels={playerLabels} />
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
