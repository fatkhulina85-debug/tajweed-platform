import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { Pill } from "@/components/ui";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDuration } from "@/lib/pronunciation/audio";
import { teacherQueue } from "@/lib/pronunciation/queries";
import type { SubmissionStatus } from "@/lib/pronunciation/stats";

export default async function TeacherDashboardPage({ searchParams }: PageProps<"/[lang]/teacher/dashboard">) {
  const dict = await getDictionary();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary">{dict.pronunciation.queueTitle}</h1>
      <Suspense fallback={<Loading label={dict.auth.pending} />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

const statusFilters: SubmissionStatus[] = ["needs_teacher_review", "reviewed"];

async function Queue({ searchParams }: { searchParams: PageProps<"/[lang]/teacher/dashboard">["searchParams"] }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const user = await getCurrentUser();
  if (!user || !(user.roles.includes("teacher") || user.roles.includes("admin"))) return <AccessState kind="denied" />;

  const t = dict.pronunciation;
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const statusParam = pick("status");
  // Default view: what still waits for the teacher.
  const status = statusParam === "all" ? undefined : ((statusFilters as string[]).includes(statusParam) ? statusParam : "needs_teacher_review") as SubmissionStatus;
  const studentId = pick("student") || undefined;
  const assignmentId = pick("exercise") || undefined;

  // RLS returns only attempts of students this teacher teaches.
  const [rows, all] = await Promise.all([teacherQueue({ status, studentId, assignmentId }), teacherQueue({})]);
  const students = new Map(all.map((r) => [r.student_id, r.profiles?.display_name || r.profiles?.email || ""]));
  const exercises = new Map(all.map((r) => [r.assignment_id, r.assignments?.title ?? ""]));
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const select = "rounded-lg border border-line bg-surface px-3 py-2";

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4" method="get">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{t.filterStudent}</span>
          <select name="student" defaultValue={studentId ?? ""} className={select}>
            <option value="">{t.allStudents}</option>
            {[...students].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{t.filterExercise}</span>
          <select name="exercise" defaultValue={assignmentId ?? ""} className={select}>
            <option value="">{t.allExercises}</option>
            {[...exercises].map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="block font-medium">{t.filterStatus}</span>
          <select name="status" defaultValue={statusParam === "all" ? "all" : status} className={select}>
            {statusFilters.map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
            <option value="all">{t.allStatuses}</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-strong">
          {t.apply}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted">{t.queueEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-mint">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t.filterStudent}</th>
                <th className="px-3 py-2 text-start font-medium">{t.filterExercise}</th>
                <th className="px-3 py-2 text-start font-medium">{t.attempt}</th>
                <th className="px-3 py-2 text-start font-medium">{t.submittedAt}</th>
                <th className="px-3 py-2 text-start font-medium">{t.filterStatus}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2">{row.profiles?.display_name || row.profiles?.email}</td>
                  <td className="px-3 py-2">
                    {row.assignments?.title}{" "}
                    <span lang="ar" dir="rtl" className="arabic text-base">
                      {row.assignments?.target_text}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {row.attempt_number}
                    {row.duration_ms ? ` · ${formatDuration(row.duration_ms)}` : ""}
                  </td>
                  <td className="px-3 py-2">{row.submitted_at && date.format(new Date(row.submitted_at))}</td>
                  <td className="px-3 py-2">
                    <Pill tone={row.status === "reviewed" ? "verified" : "pending"}>{t.status[row.status]}</Pill>
                    {row.reviews && <span className="ms-2 text-muted">{t.verdict[row.reviews.verdict]}</span>}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Link href={`/${locale}/teacher/submissions/${row.id}`} className="text-primary underline">
                      {t.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
