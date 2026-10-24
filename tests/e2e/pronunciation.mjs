// End-to-end checks for the pronunciation trainer: uploads, private files,
// retries, teacher review and statistics.
// Requires `npx supabase start` and the app running against it (see README).
// The WAV files below are generated test fixtures for the local database only.
import { randomUUID } from "node:crypto";
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

async function session(name) {
  const jar = new Map();
  const client = createServerClient(API_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([n, value]) => ({ name: n, value })),
      setAll: (list) => list.forEach(({ name: n, value }) => jar.set(n, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: email(name), password: PASSWORD });
  if (error) throw error;
  return { cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; "), client };
}

/** 16-bit mono PCM WAV with a sine tone. */
function wav(seconds, frequency = 220) {
  const rate = 16000;
  const samples = Math.round(seconds * rate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 8000), 44 + i * 2);
  }
  return buffer;
}

const origin = new URL(APP).origin;

async function postAttempt(cookie, { assignmentId, attemptId = randomUUID(), bytes = wav(1.5), type = "audio/wav", durationMs = 1500, withOrigin = true }) {
  const form = new FormData();
  form.append("assignmentId", assignmentId);
  form.append("attemptId", attemptId);
  form.append("durationMs", String(durationMs));
  form.append("file", new Blob([bytes], { type }), "attempt.wav");
  const res = await fetch(`${APP}/api/pronunciation/attempts`, {
    method: "POST",
    body: form,
    headers: { cookie, ...(withOrigin ? { origin } : {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})), attemptId };
}

async function audioUrl(cookie, query) {
  const res = await fetch(`${APP}/api/pronunciation/audio?${query}`, { headers: cookie ? { cookie } : {} });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const page = async (path, cookie) => (await (await fetch(APP + path, { headers: { cookie } })).text()).replaceAll("<!-- -->", "");

function findForm(html, ...needles) {
  for (const match of html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/g)) {
    if (needles.every((n) => match[0].includes(n))) return match[0];
  }
  return null;
}

async function submitForm(path, cookie, form, fields) {
  const data = new FormData();
  for (const input of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = input[0].match(/name="([^"]*)"/)?.[1];
    if (name) data.append(name.replaceAll("&amp;", "&"), (input[0].match(/value="([^"]*)"/)?.[1] ?? "").replaceAll("&amp;", "&").replaceAll("&quot;", '"'));
  }
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return fetch(APP + path, { method: "POST", body: data, headers: { cookie }, redirect: "manual" });
}

// ---------------------------------------------------------------------------
// Fixtures: a published lesson with an audio exercise, students and teachers.
// ---------------------------------------------------------------------------
await makeUser("p-admin", ["admin"]);
const teacherId = await makeUser("p-teacher", ["teacher"]);
await makeUser("p-teacher2", ["teacher"]);
const s1 = await makeUser("p-student1", ["student"]);
const s2 = await makeUser("p-student2", ["student"]);
await makeUser("p-student3", ["student"]);

const { data: course } = await service.from("courses").insert({ slug: `p-${stamp}`, title: "P", status: "published" }).select("id").single();
const { data: mod } = await service.from("modules").insert({ course_id: course.id, position: 1, title: "M", status: "published" }).select("id").single();
const { data: lesson } = await service.from("lessons").insert({ module_id: mod.id, position: 1, title: "Урок с тренажёром", status: "published", source_audit_status: "not_required" }).select("id").single();
const { data: exercise } = await service.from("assignments").insert({ lesson_id: lesson.id, title: "Произношение буквы даль", type: "audio", status: "published", target_text: "دَ", instructions: "Послушайте и повторите" }).select("id").single();
const { data: cohort } = await service.from("cohorts").insert({ course_id: course.id, name: "P" }).select("id").single();
await service.from("cohort_members").insert([{ cohort_id: cohort.id, student_id: s1 }, { cohort_id: cohort.id, student_id: s2 }]);
await service.from("teacher_assignments").insert({ teacher_id: teacherId, student_id: s1 });

const admin = await session("p-admin");
const teacher = await session("p-teacher");
const teacher2 = await session("p-teacher2");
const student1 = await session("p-student1");
const student2 = await session("p-student2");
const student3 = await session("p-student3");
const exercisePath = `/ru/student/exercises/${exercise.id}`;

// --- Student view before the reference exists -------------------------------
let html = await page(`/ru/student/lessons/${lesson.id}`, student1.cookie);
check("lesson shows a link to the trainer", html.includes(`/ru/student/exercises/${exercise.id}`) && html.includes("Открыть тренажёр"));
html = await page(exercisePath, student1.cookie);
check("trainer shows the Arabic target and the recorder", html.includes("دَ") && html.includes("Начать запись"));
check("without a reference the trainer says so (no fake audio)", html.includes("Эталонная запись пока не добавлена"));
check("statistics start at zero", /Отправлено<\/dt><dd[^>]*>0</.test(html));
html = await page(exercisePath, student3.cookie);
check("a student outside the cohort cannot open the trainer", html.includes("Урок не найден") && !html.includes("Начать запись"));

// --- Reference upload (admin) -----------------------------------------------
const refForm = new FormData();
refForm.append("assignmentId", exercise.id);
refForm.append("file", new Blob([wav(1, 330)], { type: "audio/wav" }), "ref.wav");
let res = await fetch(`${APP}/api/pronunciation/reference`, { method: "POST", body: refForm, headers: { cookie: student1.cookie, origin } });
check("a student cannot upload a reference", res.status === 403, String(res.status));
res = await fetch(`${APP}/api/pronunciation/reference`, { method: "POST", body: refForm, headers: { cookie: admin.cookie, origin } });
check("admin uploads the reference recording", res.status === 201, String(res.status));
let r = await audioUrl(student1.cookie, `reference=${exercise.id}`);
check("enrolled student gets a signed reference URL", r.status === 200 && r.body.url?.includes("/storage/v1/object/sign/reference-audio/"), JSON.stringify(r));
const refAudio = await fetch(r.body.url);
check("the signed reference URL serves audio", refAudio.ok && (refAudio.headers.get("content-type") ?? "").startsWith("audio/"));
r = await audioUrl(student3.cookie, `reference=${exercise.id}`);
check("a student outside the cohort gets no reference URL", r.status === 404, String(r.status));

// --- Attempts ---------------------------------------------------------------
r = await postAttempt(student1.cookie, { assignmentId: exercise.id, withOrigin: false });
check("upload without Origin is refused (CSRF)", r.status === 403, String(r.status));

const first = wav(1.5, 200);
const a1 = await postAttempt(student1.cookie, { assignmentId: exercise.id, bytes: first, durationMs: 1500 });
check("student submits attempt 1", a1.status === 201 && a1.body.attempt?.attemptNumber === 1 && a1.body.attempt?.status === "needs_teacher_review", JSON.stringify(a1));
let { data: row } = await service.from("submissions").select("*").eq("id", a1.attemptId).single();
check(
  "attempt row has correct metadata",
  row.student_id === s1 && row.assignment_id === exercise.id && row.mime_type === "audio/wav" && row.size_bytes === first.length &&
    row.duration_ms === 1500 && row.audio_path === `${s1}/${exercise.id}/${a1.attemptId}.wav` && Boolean(row.submitted_at),
  JSON.stringify(row),
);
const { data: objects } = await service.storage.from("submissions").list(`${s1}/${exercise.id}`);
check("the file is in the private bucket", objects.some((o) => o.name === `${a1.attemptId}.wav`));
const publicTry = await fetch(`${API_URL}/storage/v1/object/public/submissions/${row.audio_path}`);
check("the file has no public URL", !publicTry.ok, String(publicTry.status));

const repeat = await postAttempt(student1.cookie, { assignmentId: exercise.id, attemptId: a1.attemptId, bytes: wav(2, 500), durationMs: 2000 });
const { count: afterRepeat } = await service.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", s1);
check("re-sending the same attempt creates no duplicate and keeps the file", repeat.status === 200 && repeat.body.alreadySubmitted === true && afterRepeat === 1, JSON.stringify(repeat.body));

const a2 = await postAttempt(student1.cookie, { assignmentId: exercise.id, bytes: wav(1.2, 300), durationMs: 1200 });
check("a new attempt gets number 2", a2.status === 201 && a2.body.attempt?.attemptNumber === 2, JSON.stringify(a2.body));
r = await audioUrl(student1.cookie, `submission=${a1.attemptId}`);
const firstBack = Buffer.from(await (await fetch(r.body.url)).arrayBuffer());
check("attempt 1 is not overwritten by later attempts", firstBack.equals(first));

const bad1 = await postAttempt(student1.cookie, { assignmentId: exercise.id, bytes: Buffer.alloc(4000, 1), type: "image/png" });
const bad2 = await postAttempt(student1.cookie, { assignmentId: exercise.id, bytes: Buffer.alloc(2 * 1024 * 1024 + 10, 1) });
const bad3 = await postAttempt(student1.cookie, { assignmentId: exercise.id, durationMs: 0 });
const { count: afterBad } = await service.from("submissions").select("id", { count: "exact", head: true }).eq("student_id", s1);
check("wrong format, oversize file and missing duration are refused", bad1.status === 422 && bad2.status === 422 && bad3.status === 422, `${bad1.status} ${bad2.status} ${bad3.status}`);
check("refused uploads leave no attempt behind", afterBad === 2, String(afterBad));

// An attempt started but never finished (e.g. the connection dropped after step 1).
const stuck = randomUUID();
await student1.client.from("submissions").insert({ id: stuck, assignment_id: exercise.id, student_id: s1, attempt_number: 1 });
const recovered = await postAttempt(student1.cookie, { assignmentId: exercise.id, attemptId: stuck });
check("an unfinished attempt is completed by retrying the same id", recovered.status === 201 && recovered.body.attempt?.attemptNumber === 3, JSON.stringify(recovered.body));

r = await postAttempt(student3.cookie, { assignmentId: exercise.id });
check("a student outside the cohort cannot submit", r.status === 404, String(r.status));
r = await postAttempt(teacher.cookie, { assignmentId: exercise.id });
check("a teacher cannot submit attempts", r.status === 403, String(r.status));

// --- Who may listen ------------------------------------------------------------
r = await audioUrl(student1.cookie, `submission=${a1.attemptId}`);
check("the student listens to their own attempt", r.status === 200);
r = await audioUrl(student2.cookie, `submission=${a1.attemptId}`);
check("another student cannot get the file", r.status === 404, String(r.status));
r = await audioUrl(teacher2.cookie, `submission=${a1.attemptId}`);
check("an unassigned teacher cannot get the file", r.status === 404, String(r.status));
r = await audioUrl(teacher.cookie, `submission=${a1.attemptId}`);
check("the student's teacher gets the file", r.status === 200);
r = await audioUrl("", `submission=${a1.attemptId}`);
check("anonymous requests are refused", r.status === 401, String(r.status));
const direct = await student2.client.storage.from("submissions").createSignedUrl(row.audio_path, 60);
check("another student cannot sign the path directly in Storage", Boolean(direct.error) || !direct.data?.signedUrl);

// --- Teacher queue and review ------------------------------------------------------
html = await page("/ru/teacher/dashboard", teacher.cookie);
check("teacher queue lists the student's attempts", html.includes(`/ru/teacher/submissions/${a1.attemptId}`) && html.includes(`/ru/teacher/submissions/${a2.attemptId}`));
html = await page("/ru/teacher/dashboard", teacher2.cookie);
check("another teacher's queue does not", !html.includes(a1.attemptId));
html = await page(`/ru/teacher/dashboard?student=${s1}&status=needs_teacher_review&exercise=${exercise.id}`, teacher.cookie);
check("queue filters by student, exercise and status", html.includes(a1.attemptId));

const reviewPath = `/ru/teacher/submissions/${a1.attemptId}`;
html = await page(reviewPath, teacher.cookie);
check("review page shows reference and student recording", html.includes("Прослушать эталон") && html.includes("Запись ученика"));
await submitForm(reviewPath, teacher2.cookie, findForm(html, 'name="submission_id"'), { verdict: "correct", error_type: "", feedback_text: "чужой" });
let { data: rev } = await service.from("reviews").select("*").eq("submission_id", a1.attemptId).maybeSingle();
check("an unassigned teacher replaying the form saves nothing", !rev);
await submitForm(reviewPath, teacher.cookie, findForm(html, 'name="submission_id"'), { verdict: "needs_fix", error_type: "makhraj", feedback_text: "Кончик языка ближе к основанию зубов" });
({ data: rev } = await service.from("reviews").select("*").eq("submission_id", a1.attemptId).maybeSingle());
({ data: row } = await service.from("submissions").select("status").eq("id", a1.attemptId).single());
check("the teacher saves a review", rev?.verdict === "needs_fix" && rev.reviewer_id === teacherId && row.status === "reviewed", JSON.stringify(rev));
html = await page(reviewPath, teacher.cookie);
await submitForm(reviewPath, teacher.cookie, findForm(html, 'name="submission_id"'), { verdict: "needs_fix", error_type: "makhraj", feedback_text: "Кончик языка ближе к основанию зубов. Попробуйте ещё." });
const { count: reviewCount } = await service.from("reviews").select("id", { count: "exact", head: true }).eq("submission_id", a1.attemptId);
check("correcting a review updates it instead of adding another", reviewCount === 1);

// --- The student sees the result -------------------------------------------------
html = await page(exercisePath, student1.cookie);
check("the student sees the verdict and comment", html.includes("Нужно исправить") && html.includes("Кончик языка ближе к основанию зубов. Попробуйте ещё."));
const stat = (label) => Number(html.match(new RegExp(`${label}</dt><dd[^>]*>(\\d+)<`))?.[1]);
check(
  "statistics match the data (3 sent, 0 correct, 1 to improve, 2 waiting)",
  stat("Отправлено") === 3 && stat("Верно") === 0 && stat("Нужно доработать") === 1 && stat("Ждут проверки") === 2,
  [stat("Отправлено"), stat("Верно"), stat("Нужно доработать"), stat("Ждут проверки")].join(","),
);
html = await page(exercisePath, student2.cookie);
check("another student's history stays empty", html.includes("Попыток пока нет"));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
