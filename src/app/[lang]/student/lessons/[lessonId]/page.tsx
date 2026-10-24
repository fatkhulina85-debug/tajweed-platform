import { Suspense } from "react";
import { PagePlaceholder, RouteParam } from "@/components/page-placeholder";
import { getDictionary } from "@/i18n/dictionaries";

export default async function StudentLessonPage({ params }: PageProps<"/[lang]/student/lessons/[lessonId]">) {
  const dict = await getDictionary();

  return (
    <PagePlaceholder page="studentLesson">
      <Suspense fallback={null}>
        <RouteParam label={dict.common.identifier} value={params.then((p) => p.lessonId)} />
      </Suspense>
    </PagePlaceholder>
  );
}
