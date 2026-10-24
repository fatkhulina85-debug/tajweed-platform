import Link from "next/link";
import { Suspense } from "react";
import { AccessState, Loading } from "@/components/access-state";
import { LessonView } from "@/components/lesson-view";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { userWithRole } from "@/lib/auth/session";
import { getAnswerKeys, getLesson } from "@/lib/content/queries";

// The admin sees drafts through RLS; switch the interface language in the
// header to preview the Arabic version.
export default async function LessonPreviewPage({ params }: PageProps<"/[lang]/admin/content/[lessonId]/preview">) {
  const dict = await getDictionary();
  return (
    <Suspense fallback={<Loading label={dict.auth.pending} />}>
      <Preview lessonId={params.then((p) => p.lessonId)} />
    </Suspense>
  );
}

async function Preview({ lessonId: lessonIdPromise }: { lessonId: Promise<string> }) {
  const locale = await getLocale();
  const dict = await getDictionary();
  if (!(await userWithRole(locale, "admin"))) return <AccessState kind="denied" />;

  const lesson = await getLesson(await lessonIdPromise);
  if (!lesson) return <p className="text-muted">{dict.content.notFound}</p>;
  const keys = await getAnswerKeys(lesson.assignments.flatMap((a) => a.quiz_questions.map((q) => q.id)));

  return (
    <div className="space-y-4">
      <Link href={`/${locale}/admin/content/${lesson.id}`} className="text-sm text-primary underline">
        ← {dict.content.openEditor}
      </Link>
      <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {dict.content.previewBanner}
      </p>
      <LessonView lesson={lesson} locale={locale} dict={dict} answerKeys={keys} />
    </div>
  );
}
