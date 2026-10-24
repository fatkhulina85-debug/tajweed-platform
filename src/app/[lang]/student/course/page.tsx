import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import { localized } from "@/lib/content/blocks";
import { listCourseTrees } from "@/lib/content/queries";

export default async function StudentCoursePage() {
  const dict = await getDictionary();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary">{dict.pages.studentCourse.title}</h1>
      <Suspense fallback={<Loading label={dict.auth.pending} />}>
        <Courses />
      </Suspense>
    </section>
  );
}

async function Courses() {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "student"))) return <AccessState kind="denied" />;

  // RLS returns only published content of courses the student is enrolled in.
  const courses = await listCourseTrees();
  if (courses.length === 0) return <p className="max-w-prose text-muted">{dict.content.emptyCourse}</p>;

  return (
    <div className="space-y-8">
      {courses.map((course) => (
        <section key={course.id} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-ink">{localized(locale, course.title, course.title_ar)}</h2>
            {course.description && <p className="max-w-prose text-muted">{course.description}</p>}
          </div>
          <ol className="space-y-4">
            {course.modules.map((module) => (
              <li key={module.id} className="space-y-2 rounded-xl border border-line bg-surface p-4">
                <h3 className="font-semibold">
                  {module.position}. {localized(locale, module.title, module.title_ar)}
                </h3>
                {module.lessons.length === 0 ? (
                  <p className="text-sm text-muted">{dict.content.noLessons}</p>
                ) : (
                  <ol className="divide-y divide-line">
                    {module.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/${locale}/student/lessons/${lesson.id}`}
                          className="flex items-center justify-between gap-3 py-2 hover:text-primary"
                        >
                          <span>
                            <span className="me-2 font-mono text-sm text-muted">
                              {module.position}.{lesson.position}
                            </span>
                            {localized(locale, lesson.title, lesson.title_ar)}
                          </span>
                          {lesson.estimated_minutes && (
                            <span className="shrink-0 text-sm text-muted">
                              {lesson.estimated_minutes} {dict.content.minutesShort}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
