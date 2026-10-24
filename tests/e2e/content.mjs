// End-to-end checks for stage 3: the admin builds and publishes a lesson through
// the real forms; students see only what they should.
// Requires `npx supabase start` and the app running against it (see README).
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const { API_URL, PUBLISHABLE_KEY, SECRET_KEY, APP } = process.env;
const service = createClient(API_URL, SECRET_KEY, { auth: { persistSession: false } });
const PASSWORD = "Test12345";
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
};

const stamp = Date.now();
const email = (name) => `${name}.${stamp}@test.local`;

async function makeUser(name, roles) {
  const { data, error } = await service.auth.admin.createUser({ email: email(name), password: PASSWORD, email_confirm: true });
  if (error) throw error;
  for (const role of roles) await service.from("user_roles").insert({ user_id: data.user.id, role });
  return data.user.id;
}

async function cookiesFor(name) {
  const jar = new Map();
  const client = createServerClient(API_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
      setAll: (list) => list.forEach(({ name: n, value }) => jar.set(n, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: email(name), password: PASSWORD });
  if (error) throw error;
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

const decode = (value) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");

async function page(path, cookie) {
  const res = await fetch(APP + path, { headers: { cookie } });
  // React separates adjacent text nodes with <!-- --> comments.
  return (await res.text()).replaceAll("<!-- -->", "");
}

/** Finds the first form containing every needle; a needle starting with "!" must be absent. */
function findForm(html, ...needles) {
  for (const match of html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)) {
    const ok = needles.every((needle) =>
      needle.startsWith("!") ? !match[0].includes(needle.slice(1)) : match[0].includes(needle),
    );
    if (ok) return match[0];
  }
  return null;
}

/** Submits a form the way a browser without JavaScript would. */
async function submit(path, cookie, form, fields = {}) {
  if (!form) return { status: 0, location: "", body: "form not found" };
  const data = new FormData();
  for (const input of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    if (name && !(name in fields)) data.append(decode(name), decode(input[0].match(/value="([^"]*)"/)?.[1] ?? ""));
  }
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  const res = await fetch(APP + path, { method: "POST", body: data, headers: { cookie }, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") ?? "", body: await res.text() };
}

await makeUser("content-admin", ["admin"]);
const studentId = await makeUser("content-student", ["student"]);
await makeUser("content-outsider", ["student"]);
const admin = await cookiesFor("content-admin");
const student = await cookiesFor("content-student");
const outsider = await cookiesFor("content-outsider");
const slug = `e2e-${stamp}`;

// 1. Course
let html = await page("/ru/admin/courses", admin);
let r = await submit("/ru/admin/courses", admin, findForm(html, 'name="slug"'), {
  title: "Курс E2E",
  title_ar: "مقرر الاختبار",
  slug,
  description: "Проверочный курс",
});
const courseId = r.location.match(/\/ru\/admin\/courses\/([0-9a-f-]{36})/)?.[1];
check("admin creates a course through the form", r.status === 303 && Boolean(courseId), `${r.status} ${r.location}`);

const coursePath = `/ru/admin/courses/${courseId}`;
html = await page(coursePath, admin);
r = await submit(coursePath, admin, findForm(html, 'name="course_id"', 'name="title"'), { title: "Модуль 1", title_ar: "" });
html = await page(coursePath, admin);
const moduleId = html.match(/name="module_id" value="([0-9a-f-]{36})"/)?.[1];
check("admin creates a module", Boolean(moduleId));

// 2. Lessons
r = await submit(coursePath, admin, findForm(html, `value="${moduleId}"`, 'name="title"'), { title: "Урок 1", title_ar: "الدرس الأول" });
const lessonId = r.location.match(/\/ru\/admin\/content\/([0-9a-f-]{36})/)?.[1];
check("admin creates a lesson and lands in the editor", r.status === 303 && Boolean(lessonId), `${r.status} ${r.location}`);
html = await page(coursePath, admin);
r = await submit(coursePath, admin, findForm(html, `value="${moduleId}"`, 'name="title"'), { title: "Урок 2 (черновик)", title_ar: "" });
const draftLessonId = r.location.match(/\/ru\/admin\/content\/([0-9a-f-]{36})/)?.[1];

// 3. Blocks and settings
const editor = `/ru/admin/content/${lessonId}`;
html = await page(editor, admin);
const newBlock = () => findForm(html, 'name="block_type"', 'name="lesson_id"', '!name="id"');
r = await submit(editor, admin, newBlock(), { block_type: "text", block_locale: "", title: "", text: "Буква алиф — первая буква алфавита.", arabic: "", note: "", table: "", authoring_type: "authored", source_reference_id: "" });
html = await page(editor, admin);
r = await submit(editor, admin, newBlock(), { block_type: "arabic", block_locale: "", title: "Пример", text: "", arabic: "أَ إِ أُ", note: "Огласовки", table: "", authoring_type: "authored", source_reference_id: "" });
html = await page(editor, admin);
r = await submit(editor, admin, newBlock(), { block_type: "text", block_locale: "", title: "", text: "Без источника", arabic: "", note: "", table: "", authoring_type: "source", source_reference_id: "" });
check("a block marked 'from source' without a source is rejected", r.body.includes("Проверьте заполнение полей"));
const { data: blocks } = await service.from("lesson_blocks").select("position, block_type").eq("lesson_id", lessonId).order("position");
check("admin adds blocks in order", JSON.stringify(blocks) === JSON.stringify([{ position: 1, block_type: "text" }, { position: 2, block_type: "arabic" }]), JSON.stringify(blocks));

// 4. Publishing is blocked until the source audit
html = await page(editor, admin);
check("publish button is disabled while the audit is pending", /<button[^>]*disabled=""[^>]*>Опубликовать/.test(findForm(html, 'value="lessons"', 'value="published"') ?? ""));
await submit(editor, admin, findForm(html, 'value="lessons"', 'value="published"'));
let { data: lessonRow } = await service.from("lessons").select("status").eq("id", lessonId).single();
check("forcing the publish form anyway leaves the lesson a draft", lessonRow.status === "draft", lessonRow.status);

r = await submit(editor, admin, findForm(html, 'name="source_audit_status"'), {
  title: "Урок 1",
  title_ar: "الدرس الأول",
  objectives: "Узнать букву алиф\nПрочитать огласовки",
  estimated_minutes: "20",
  source_audit_status: "not_required",
});
html = await page(editor, admin);
await submit(editor, admin, findForm(html, 'value="lessons"', 'value="published"'));
({ data: lessonRow } = await service.from("lessons").select("status, published_at").eq("id", lessonId).single());
check("admin publishes the audited lesson", lessonRow.status === "published" && Boolean(lessonRow.published_at), JSON.stringify(lessonRow));
const { data: audit } = await service.from("audit_logs").select("id").eq("entity_type", "lessons").eq("entity_id", lessonId).eq("metadata->>to", "published");
check("publishing is in the audit log", audit.length === 1);

// 5. Quiz
html = await page(editor, admin);
await submit(editor, admin, findForm(html, 'name="type"', 'name="instructions"'), { title: "Проверка", type: "quiz", instructions: "Выберите ответ" });
html = await page(editor, admin);
await submit(editor, admin, findForm(html, 'name="assignment_id"', 'name="prompt"'), { prompt: "Какая это буква: ا ?", options: "Алиф\nБа\nТа", correct: "1" });
html = await page(editor, admin);
await submit(editor, admin, findForm(html, 'value="assignments"', 'value="published"'));
const { data: quiz } = await service.from("assignments").select("status, quiz_questions (id, quiz_answer_keys (correct_options))").eq("lesson_id", lessonId).single();
check("admin creates and publishes a quiz with an answer key", quiz.status === "published" && JSON.stringify(quiz.quiz_questions[0].quiz_answer_keys) === JSON.stringify({ correct_options: [0] }), JSON.stringify(quiz));

// 6. Student before enrolment and before the course is published
html = await page("/ru/student/course", student);
check("student without a cohort sees the empty state", html.includes("Вам пока не открыт ни один курс"));

html = await page(coursePath, admin);
await submit(coursePath, admin, findForm(html, 'name="name"', 'name="course_id"'), { name: "Поток E2E", starts_on: "", ends_on: "" });
html = await page(coursePath, admin);
await submit(coursePath, admin, findForm(html, `value="${studentId}"`, 'name="member" value="1"'));
html = await page("/ru/student/course", student);
check("enrolled student still sees nothing while the course is a draft", !html.includes("Курс E2E"));

html = await page(coursePath, admin);
await submit(coursePath, admin, findForm(html, 'value="modules"', 'value="published"'));
html = await page(coursePath, admin);
await submit(coursePath, admin, findForm(html, 'value="courses"', 'value="published"'));

// 7. Student view
html = await page("/ru/student/course", student);
check("student sees the published lesson", html.includes("Курс E2E") && html.includes("Урок 1"));
check("student does not see the draft lesson", !html.includes("Урок 2 (черновик)"));
html = await page(`/ru/student/lessons/${lessonId}`, student);
check("lesson page shows blocks, objectives and Arabic text", html.includes("Буква алиф — первая буква алфавита.") && html.includes("Узнать букву алиф") && html.includes("أَ إِ أُ"));
check("lesson page shows the quiz without the answer", html.includes("Какая это буква") && !html.includes("(верный)"));
html = await page(`/ar/student/lessons/${lessonId}`, student);
check("Arabic interface uses the Arabic title and RTL", html.includes("الدرس الأول") && html.includes('dir="rtl"'));
html = await page(`/ru/student/lessons/${draftLessonId}`, student);
check("draft lesson URL shows 'not found' to the student", html.includes("Урок не найден или ещё не опубликован"));
html = await page(`/ru/student/lessons/${lessonId}`, outsider);
check("a student outside the cohort cannot open the lesson", html.includes("Урок не найден") && !html.includes("Буква алиф"));

// 8. A student replaying an admin form changes nothing
html = await page("/ru/admin/courses", admin);
r = await submit("/ru/admin/courses", student, findForm(html, 'name="slug"'), { title: "Взлом", title_ar: "", slug: `${slug}-hack`, description: "" });
const { data: hacked } = await service.from("courses").select("id").eq("slug", `${slug}-hack`);
check("a student replaying the admin form cannot create a course", hacked.length === 0);
html = await page(coursePath, admin);
await submit(coursePath, student, findForm(html, 'value="courses"', 'value="draft"'));
const { data: courseRow } = await service.from("courses").select("status").eq("id", courseId).single();
check("a student replaying 'unpublish' cannot change the course", courseRow.status === "published");

// 9. Ordering
html = await page(coursePath, admin);
await submit(coursePath, admin, findForm(html, 'value="lessons"', `value="${draftLessonId}"`, 'value="up"'));
const { data: order } = await service.from("lessons").select("id").eq("module_id", moduleId).order("position");
check("admin moves a lesson up", order[0]?.id === draftLessonId, JSON.stringify(order));

// 10. Preview
html = await page(`/ar/admin/content/${lessonId}/preview`, admin);
check("admin preview shows the answer key", html.includes("(صحيح)"));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
