import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { LessonView } from "@/components/lesson-view";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import { getLesson } from "@/lib/content/queries";

export default async function StudentLessonPage({ params }: PageProps<"/[lang]/student/lessons/[lessonId]">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<Loading label={dict.auth.pending} />}>
      <Lesson lessonId={params.then((p) => p.lessonId)} />
    </Suspense>
  );
}

async function Lesson({ lessonId: lessonIdPromise }: { lessonId: Promise<string> }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "student"))) return <AccessState kind="denied" />;

  // RLS hides drafts and courses the student is not enrolled in, so a missing
  // lesson and a forbidden one look the same.
  const lesson = await getLesson(await lessonIdPromise);

  return (
    <div className="space-y-4">
      <Link href={`/${locale}/student/course`} className="text-sm text-primary underline">
        ← {dict.pages.studentCourse.title}
      </Link>
      {lesson ? (
        <LessonView
          lesson={lesson}
          locale={locale}
          dict={dict}
          exerciseHref={(id) => `/${locale}/student/exercises/${id}`}
        />
      ) : (
        <p className="text-muted">{dict.content.notFound}</p>
      )}
    </div>
  );
}
