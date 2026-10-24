import { Suspense } from "react";
import { PagePlaceholder, RouteParam } from "@/components/page-placeholder";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminContentPage({ params }: PageProps<"/[lang]/admin/content/[lessonId]">) {
  const dict = await getDictionary();

  return (
    <PagePlaceholder page="adminContent">
      <Suspense fallback={null}>
        <RouteParam label={dict.common.identifier} value={params.then((p) => p.lessonId)} />
      </Suspense>
    </PagePlaceholder>
  );
}
