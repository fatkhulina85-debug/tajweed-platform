import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { HiddenLocale } from "@/components/auth-card";
import { AudioPlayer } from "@/components/pronunciation/audio-player";
import { Panel, Pill, SelectField, TextArea } from "@/components/ui";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth/session";
import { saveReview } from "@/lib/pronunciation/actions";
import { formatDuration } from "@/lib/pronunciation/audio";
import { getAttemptForReview } from "@/lib/pronunciation/queries";
import { errorTypes, verdicts } from "@/lib/pronunciation/stats";

export default async function ReviewPage({ params }: PageProps<"/[lang]/teacher/submissions/[id]">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<Loading label={dict.auth.pending} />}>
      <Review submissionId={params.then((p) => p.id)} />
    </Suspense>
  );
}

const verdictTone = { correct: "verified", needs_fix: "pending", retry: "rejected" } as const;

async function Review({ submissionId: idPromise }: { submissionId: Promise<string> }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes("teacher") || user.roles.includes("admin"))) return <AccessState kind="denied" />;

  const t = dict.pronunciation;
  // RLS: only attempts of this teacher's students come back.
  const data = await getAttemptForReview(await idPromise);
  if (!data) return <p className="text-muted">{t.notFoundAttempt}</p>;

  const { attempt, history } = data;
  const exercise = attempt.assignments;
  const review = attempt.reviews;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const playerLabels = { loading: t.loadingAudio, error: t.audioError };

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/teacher/dashboard`} className="text-sm text-primary underline">
        ← {t.backToQueue}
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-primary">{t.reviewTitle}</h1>
        <p className="text-muted">
          {attempt.profiles?.display_name || attempt.profiles?.email} · {exercise?.title} · {t.attempt}{" "}
          {attempt.attempt_number}
          {attempt.submitted_at && ` · ${date.format(new Date(attempt.submitted_at))}`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t.reference}>
          <p lang="ar" dir="rtl" className="arabic text-center text-6xl">
            {exercise?.target_text}
          </p>
          {exercise?.reference_audio_path ? (
            <AudioPlayer query={`reference=${exercise.id}`} label={t.playReference} labels={playerLabels} />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t.noReference}</p>
          )}
        </Panel>
        <Panel title={t.studentRecording}>
          <AudioPlayer query={`submission=${attempt.id}`} label={t.play} labels={playerLabels} size="large" />
          <p className="text-sm text-muted">
            {t.duration}: {attempt.duration_ms ? formatDuration(attempt.duration_ms) : "—"}
          </p>
        </Panel>
      </div>

      <Panel title={t.result}>
        <div className="max-w-xl">
          <ActionForm
            action={saveReview}
            submitLabel={t.saveReview}
            pendingLabel={dict.auth.pending}
            successText={t.reviewSaved}
            errors={dict.errors}
          >
            <HiddenLocale locale={locale} />
            <input type="hidden" name="submission_id" value={attempt.id} />
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">{t.result}</legend>
              {verdicts.map((verdict) => (
                <label key={verdict} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="verdict"
                    value={verdict}
                    required
                    defaultChecked={review?.verdict === verdict}
                    className="size-4"
                  />
                  {t.verdict[verdict]}
                </label>
              ))}
            </fieldset>
            <SelectField
              label={t.errorTypeLabel}
              name="error_type"
              defaultValue={review?.error_type ?? ""}
              options={[{ value: "", label: t.noErrorType }, ...errorTypes.map((e) => ({ value: e, label: t.errorType[e] }))]}
            />
            <TextArea label={t.comment} name="feedback_text" rows={4} defaultValue={review?.feedback_text ?? ""} />
          </ActionForm>
        </div>
      </Panel>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.studentHistory}</h2>
        <ol className="space-y-2">
          {history.map((item) => (
            <li
              key={item.id}
              className={`space-y-2 rounded-xl border bg-surface p-3 ${item.id === attempt.id ? "border-primary" : "border-line"}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/${locale}/teacher/submissions/${item.id}`} className="font-medium underline">
                  {t.attempt} {item.attempt_number}
                </Link>
                {item.submitted_at && <span className="text-muted">{date.format(new Date(item.submitted_at))}</span>}
                {item.reviews ? (
                  <Pill tone={verdictTone[item.reviews.verdict]}>{t.verdict[item.reviews.verdict]}</Pill>
                ) : (
                  <Pill tone="pending">{t.status[item.status]}</Pill>
                )}
              </div>
              {item.reviews?.feedback_text && <p className="text-sm text-muted">{item.reviews.feedback_text}</p>}
              {item.id !== attempt.id && <AudioPlayer query={`submission=${item.id}`} label={t.play} labels={playerLabels} />}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
