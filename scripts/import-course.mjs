// Imports the draft course from content/course-basics.mjs.
//
// usage: node --env-file=<env file> scripts/import-course.mjs
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//
// Safe to re-run: it stops if a course with the same slug already exists.
// Everything is created as a draft; lessons get source_audit_status
// "in_review", so the database refuses to publish them until a teacher
// marks them verified.
import { createClient } from "@supabase/supabase-js";
import { course } from "../content/course-basics.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const db = createClient(url, key, { auth: { persistSession: false } });

async function insert(table, row) {
  const { data, error } = await db.from(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

const { data: existing } = await db.from("courses").select("id").eq("slug", course.slug).maybeSingle();
if (existing) {
  console.log(`Course "${course.slug}" already exists (${existing.id}); nothing imported.`);
} else {
  await importCourse();
}

async function importCourse() {
  console.log(`Importing into ${new URL(url).host}`);
  const courseId = await insert("courses", {
    slug: course.slug,
    title: course.title,
    title_ar: course.title_ar,
    description: course.description,
  });

  let lessonCount = 0;
  let blockCount = 0;
  let questionCount = 0;

  for (const [mi, module] of course.modules.entries()) {
    const moduleId = await insert("modules", {
      course_id: courseId,
      position: mi + 1,
      title: module.title,
      title_ar: module.title_ar,
    });

    for (const [li, lesson] of module.lessons.entries()) {
      const sourceId = await insert("source_references", {
        title: `${course.workbookSource.title}, ${lesson.source.workbook}`,
        author: course.workbookSource.author,
        page_or_section: lesson.source.pages,
        rights_status: "unknown",
        verification_status: "pending",
        notes: "Structure and order of the lesson follow this section. The text is our own; nothing is copied.",
      });

      const lessonId = await insert("lessons", {
        module_id: moduleId,
        position: li + 1,
        title: lesson.title,
        title_ar: lesson.title_ar,
        objectives: lesson.objectives,
        estimated_minutes: lesson.estimated_minutes,
        source_audit_status: "in_review",
      });
      lessonCount++;

      for (const [bi, block] of lesson.blocks.entries()) {
        await insert("lesson_blocks", {
          lesson_id: lessonId,
          position: bi + 1,
          block_type: block.block_type,
          title: block.title,
          body: block.body,
          authoring_type: "authored",
          // The first block points to the workbook section the lesson follows.
          source_reference_id: bi === 0 ? sourceId : null,
        });
        blockCount++;
      }

      if (lesson.quiz?.length) {
        const assignmentId = await insert("assignments", {
          lesson_id: lessonId,
          title: "Проверьте себя",
          type: "quiz",
          instructions: "Выберите один правильный ответ.",
        });
        for (const [qi, q] of lesson.quiz.entries()) {
          const questionId = await insert("quiz_questions", {
            assignment_id: assignmentId,
            position: qi + 1,
            prompt: q.prompt,
            options: q.options,
          });
          const { error } = await db.from("quiz_answer_keys").insert({ question_id: questionId, correct_options: [q.correct] });
          if (error) throw new Error(`quiz_answer_keys: ${error.message}`);
          questionCount++;
        }
      }
    }
  }

  console.log(`Imported course ${courseId}: ${course.modules.length} module(s), ${lessonCount} lessons, ${blockCount} blocks, ${questionCount} quiz questions. Everything is a draft.`);
}
