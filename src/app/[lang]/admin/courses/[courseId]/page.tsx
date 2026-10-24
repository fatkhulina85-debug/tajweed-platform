import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { Field, HiddenLocale } from "@/components/auth-card";
import { ActionButton, Panel, Pill, TextArea } from "@/components/ui";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import {
  createCohort,
  createLesson,
  createModule,
  move,
  setCohortMember,
  setStatus,
  updateCourse,
} from "@/lib/content/actions";
import { localized } from "@/lib/content/blocks";
import { getCohorts, getCourseTree } from "@/lib/content/queries";

export default async function AdminCoursePage({ params }: PageProps<"/[lang]/admin/courses/[courseId]">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<Loading label={dict.auth.pending} />}>
      <Course courseId={params.then((p) => p.courseId)} />
    </Suspense>
  );
}

async function Course({ courseId: courseIdPromise }: { courseId: Promise<string> }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "admin"))) return <AccessState kind="denied" />;

  const courseId = await courseIdPromise;
  const [course, { cohorts, students }] = await Promise.all([getCourseTree(courseId), getCohorts(courseId)]);
  if (!course) return <p className="text-muted">{dict.content.courseNotFound}</p>;

  const t = dict.content;
  const published = course.status === "published";

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href={`/${locale}/admin/courses`} className="text-sm text-primary underline">
          ← {t.backToCourses}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-primary">{localized(locale, course.title, course.title_ar)}</h1>
          <Pill tone={course.status}>{t.status[course.status]}</Pill>
          <ActionButton
            action={setStatus}
            fields={{ table: "courses", id: course.id, status: published ? "draft" : "published" }}
            variant={published ? "secondary" : "primary"}
          >
            {published ? t.unpublish : t.publish}
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 space-y-4">
          <h2 className="text-lg font-semibold">{t.modules}</h2>
          {course.modules.length === 0 && <p className="text-muted">{t.noModules}</p>}
          <ol className="space-y-4">
            {course.modules.map((module, mi) => {
              const modulePublished = module.status === "published";
              return (
                <li key={module.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-muted">{module.position}.</span>
                    <h3 className="font-semibold">{localized(locale, module.title, module.title_ar)}</h3>
                    <Pill tone={module.status}>{t.status[module.status]}</Pill>
                    <span className="ms-auto flex flex-wrap gap-1">
                      <ActionButton action={move} fields={{ table: "modules", id: module.id, direction: "up" }} disabled={mi === 0}>
                        ↑ <span className="sr-only">{t.moveUp}</span>
                      </ActionButton>
                      <ActionButton
                        action={move}
                        fields={{ table: "modules", id: module.id, direction: "down" }}
                        disabled={mi === course.modules.length - 1}
                      >
                        ↓ <span className="sr-only">{t.moveDown}</span>
                      </ActionButton>
                      <ActionButton
                        action={setStatus}
                        fields={{ table: "modules", id: module.id, status: modulePublished ? "draft" : "published" }}
                      >
                        {modulePublished ? t.unpublish : t.publish}
                      </ActionButton>
                    </span>
                  </div>

                  {module.lessons.length === 0 ? (
                    <p className="text-sm text-muted">{t.noLessons}</p>
                  ) : (
                    <ol className="divide-y divide-line rounded-lg border border-line">
                      {module.lessons.map((lesson, li) => (
                        <li key={lesson.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <span className="font-mono text-sm text-muted">
                            {module.position}.{lesson.position}
                          </span>
                          <Link href={`/${locale}/admin/content/${lesson.id}`} className="text-ink underline">
                            {localized(locale, lesson.title, lesson.title_ar)}
                          </Link>
                          <Pill tone={lesson.status}>{t.status[lesson.status]}</Pill>
                          <Pill tone={lesson.source_audit_status}>{t.audit[lesson.source_audit_status]}</Pill>
                          <span className="ms-auto flex gap-1">
                            <ActionButton action={move} fields={{ table: "lessons", id: lesson.id, direction: "up" }} disabled={li === 0}>
                              ↑ <span className="sr-only">{t.moveUp}</span>
                            </ActionButton>
                            <ActionButton
                              action={move}
                              fields={{ table: "lessons", id: lesson.id, direction: "down" }}
                              disabled={li === module.lessons.length - 1}
                            >
                              ↓ <span className="sr-only">{t.moveDown}</span>
                            </ActionButton>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary">+ {t.newLesson}</summary>
                    <div className="mt-3 max-w-md">
                      <ActionForm action={createLesson} submitLabel={t.create} pendingLabel={dict.auth.pending} errors={dict.errors}>
                        <HiddenLocale locale={locale} />
                        <input type="hidden" name="module_id" value={module.id} />
                        <Field label={t.title} name="title" />
                        <Field label={t.titleAr} name="title_ar" required={false} />
                      </ActionForm>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
          <Panel title={t.newModule}>
            <ActionForm action={createModule} submitLabel={t.create} pendingLabel={dict.auth.pending} errors={dict.errors}>
              <HiddenLocale locale={locale} />
              <input type="hidden" name="course_id" value={course.id} />
              <Field label={t.title} name="title" />
              <Field label={t.titleAr} name="title_ar" required={false} />
            </ActionForm>
          </Panel>
        </section>

        <div className="space-y-6">
          <Panel title={t.courseSettings}>
            <ActionForm
              action={updateCourse}
              submitLabel={t.save}
              pendingLabel={dict.auth.pending}
              successText={t.saved}
              errors={dict.errors}
            >
              <HiddenLocale locale={locale} />
              <input type="hidden" name="id" value={course.id} />
              <Field label={t.title} name="title" defaultValue={course.title} />
              <Field label={t.titleAr} name="title_ar" required={false} defaultValue={course.title_ar} />
              <TextArea label={t.description} name="description" defaultValue={course.description} rows={3} />
            </ActionForm>
          </Panel>

          <Panel title={t.cohorts}>
            {cohorts.length === 0 && <p className="text-sm text-muted">{t.noCohorts}</p>}
            {cohorts.map((cohort) => {
              const active = new Set(
                cohort.cohort_members.filter((m) => m.status === "active").map((m) => m.student_id),
              );
              return (
                <div key={cohort.id} className="space-y-2 border-t border-line pt-3 first:border-0 first:pt-0">
                  <h3 className="font-medium">{cohort.name}</h3>
                  {students.length === 0 ? (
                    <p className="text-sm text-muted">{t.noStudents}</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {students.map((student) => {
                        const member = active.has(student.id);
                        return (
                          <li key={student.id} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate" dir="ltr">
                              {student.display_name || student.email}
                              {member && <span className="ms-1 text-primary">· {t.inCohort}</span>}
                            </span>
                            <ActionButton
                              action={setCohortMember}
                              fields={{ cohort_id: cohort.id, student_id: student.id, member: member ? "0" : "1" }}
                            >
                              {member ? t.unenroll : t.enroll}
                            </ActionButton>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            <details className="text-sm">
              <summary className="cursor-pointer text-primary">+ {t.newCohort}</summary>
              <div className="mt-3">
                <ActionForm action={createCohort} submitLabel={t.create} pendingLabel={dict.auth.pending} errors={dict.errors}>
                  <HiddenLocale locale={locale} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <Field label={t.cohortName} name="name" />
                  <Field label={t.startsOn} name="starts_on" type="date" required={false} />
                  <Field label={t.endsOn} name="ends_on" type="date" required={false} />
                </ActionForm>
              </div>
            </details>
          </Panel>
        </div>
      </div>
    </div>
  );
}
