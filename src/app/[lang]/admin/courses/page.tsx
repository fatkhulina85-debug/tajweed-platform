import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { ActionForm } from "@/components/action-form";
import { Field, HiddenLocale } from "@/components/auth-card";
import { Panel, Pill, TextArea } from "@/components/ui";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import { createCourse } from "@/lib/content/actions";
import { localized } from "@/lib/content/blocks";
import { listCourses } from "@/lib/content/queries";

export default async function AdminCoursesPage() {
  const dict = await getDictionary();

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-primary">{dict.pages.adminCourses.title}</h1>
      <Suspense fallback={<Loading label={dict.auth.pending} />}>
        <Courses />
      </Suspense>
    </section>
  );
}

async function Courses() {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "admin"))) return <AccessState kind="denied" />;

  const courses = await listCourses();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        {courses.length === 0 ? (
          <p className="text-muted">{dict.content.noCourses}</p>
        ) : (
          <ul className="space-y-3">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/${locale}/admin/courses/${course.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 hover:border-primary"
                >
                  <span className="space-y-1">
                    <span className="block font-semibold text-ink">
                      {localized(locale, course.title, course.title_ar)}
                    </span>
                    <span className="block text-sm text-muted" dir="ltr">
                      {course.slug}
                    </span>
                  </span>
                  <Pill tone={course.status}>{dict.content.status[course.status]}</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel title={dict.content.newCourse}>
        <ActionForm
          action={createCourse}
          submitLabel={dict.content.create}
          pendingLabel={dict.auth.pending}
          errors={dict.errors}
        >
          <HiddenLocale locale={locale} />
          <Field label={dict.content.title} name="title" />
          <Field label={dict.content.titleAr} name="title_ar" required={false} />
          <Field label={dict.content.slug} name="slug" ltr />
          <TextArea label={dict.content.description} name="description" rows={3} />
        </ActionForm>
      </Panel>
    </div>
  );
}
