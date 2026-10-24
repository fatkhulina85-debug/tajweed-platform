import { Suspense } from "react";
import { PagePlaceholder, RouteParam } from "@/components/page-placeholder";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherSubmissionPage({ params }: PageProps<"/[lang]/teacher/submissions/[id]">) {
  const dict = await getDictionary();

  return (
    <PagePlaceholder page="teacherSubmission">
      <Suspense fallback={null}>
        <RouteParam label={dict.common.identifier} value={params.then((p) => p.id)} />
      </Suspense>
    </PagePlaceholder>
  );
}
