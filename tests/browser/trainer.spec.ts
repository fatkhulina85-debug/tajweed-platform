import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Next.js adds its own role="alert" route announcer, so alerts are matched by text.
// Browser checks for the recorder: real MediaRecorder with Chromium's fake
// microphone, plus simulated denial, missing support and network failure.
// Fixtures are created in the local database only.

const API_URL = process.env.API_URL!;
const PUBLISHABLE_KEY = process.env.PUBLISHABLE_KEY!;
const service = createClient(API_URL, process.env.SECRET_KEY!, { auth: { persistSession: false } });
const PASSWORD = "Test12345";
const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

type Fixture = { exerciseId: string; studentEmail: string; studentId: string; teacherEmail: string };
let fx: Fixture;

async function makeUser(name: string, roles: string[]) {
  const email = `${name}.${stamp}@test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  for (const role of roles) await service.from("user_roles").insert({ user_id: data.user.id, role });
  return { email, id: data.user.id };
}

test.beforeAll(async () => {
  const student = await makeUser("b-student", ["student"]);
  const teacher = await makeUser("b-teacher", ["teacher"]);
  const { data: course } = await service.from("courses").insert({ slug: `b-${stamp}`, title: "B", status: "published" }).select("id").single();
  const { data: mod } = await service.from("modules").insert({ course_id: course!.id, position: 1, title: "M", status: "published" }).select("id").single();
  const { data: lesson } = await service
    .from("lessons")
    .insert({ module_id: mod!.id, position: 1, title: "L", status: "published", source_audit_status: "not_required" })
    .select("id")
    .single();
  const { data: exercise } = await service
    .from("assignments")
    .insert({ lesson_id: lesson!.id, title: "Произношение буквы даль", type: "audio", status: "published", target_text: "د" })
    .select("id")
    .single();
  const { data: cohort } = await service.from("cohorts").insert({ course_id: course!.id, name: "B" }).select("id").single();
  await service.from("cohort_members").insert({ cohort_id: cohort!.id, student_id: student.id });
  await service.from("teacher_assignments").insert({ teacher_id: teacher.id, student_id: student.id });
  fx = { exerciseId: exercise!.id, studentEmail: student.email, studentId: student.id, teacherEmail: teacher.email };
});

async function signIn(context: BrowserContext, email: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(API_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await client.auth.signInWithPassword({ email, password: PASSWORD });
  const { hostname } = new URL(process.env.APP ?? "http://localhost:3200");
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, domain: hostname, path: "/" })));
}

/** Keeps every microphone stream so the test can check it was released. */
async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as unknown as { __streams: MediaStream[] }).__streams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as unknown as { __streams: MediaStream[] }).__streams.push(stream);
      return stream;
    };
  });
}

async function record(page: Page, ms = 1500) {
  await page.getByRole("button", { name: /Начать запись/ }).click();
  await expect(page.getByText("Идёт запись")).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.waitForTimeout(ms);
  await page.getByRole("button", { name: /Остановить/ }).click();
}

const attemptsOfStudent = async () =>
  (await service.from("submissions").select("id, attempt_number, status").eq("student_id", fx.studentId).order("attempt_number")).data ?? [];

test("records, plays back before sending, sends, frees the microphone", async ({ page, context }, info) => {
  await signIn(context, fx.studentEmail);
  await trackStreams(page);
  await page.goto(`/ru/student/exercises/${fx.exerciseId}`);
  await expect(page.getByText("Эталонная запись пока не добавлена")).toBeVisible();
  await expect(page.getByText(/Её услышат только ваш преподаватель/)).toBeVisible();

  const before = (await attemptsOfStudent()).length;
  await record(page);

  // Preview before sending; nothing is uploaded yet.
  await expect(page.getByText("Прослушайте запись перед отправкой.")).toBeVisible();
  const preview = page.locator("audio").first();
  await expect(preview).toHaveAttribute("src", /^blob:/);
  expect(await preview.evaluate((a: HTMLAudioElement) => new Promise<number>((resolve) => {
    if (a.readyState >= 1) resolve(a.duration);
    a.onloadedmetadata = () => resolve(a.duration);
  }))).toBeGreaterThan(0);
  expect((await attemptsOfStudent()).length).toBe(before);

  const released = await page.evaluate(() =>
    (window as unknown as { __streams: MediaStream[] }).__streams.every((s) => s.getTracks().every((t) => t.readyState === "ended")),
  );
  expect(released).toBe(true);

  // Re-record replaces the take without sending anything.
  await page.getByRole("button", { name: "Записать заново" }).click();
  await record(page, 1000);
  await page.getByRole("button", { name: "Отправить учителю" }).click();
  await expect(page.getByText(/Запись отправлена учителю/)).toBeVisible();
  await expect(page.getByText("Ждёт проверки").first()).toBeVisible();

  const after = await attemptsOfStudent();
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)!.status).toBe("needs_teacher_review");

  // Layout check: nothing wider than the screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `test-results/trainer-${info.project.name}.png`, fullPage: true });
});

test("a refused microphone is explained and nothing is sent", async ({ page, context }) => {
  await signIn(context, fx.studentEmail);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.goto(`/ru/student/exercises/${fx.exerciseId}`);
  await page.getByRole("button", { name: /Начать запись/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Нет доступа к микрофону" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Начать запись/ })).toBeEnabled();
});

test("a browser without recording support is told so", async ({ page, context }) => {
  await signIn(context, fx.studentEmail);
  await page.addInitScript(() => {
    // @ts-expect-error simulate an old browser
    delete window.MediaRecorder;
  });
  await page.goto(`/ru/student/exercises/${fx.exerciseId}`);
  await page.getByRole("button", { name: /Начать запись/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "не умеет записывать звук" })).toBeVisible();
});

test("a network failure keeps the recording and a retry sends it once", async ({ page, context }) => {
  await signIn(context, fx.studentEmail);
  await page.goto(`/ru/student/exercises/${fx.exerciseId}`);
  const before = (await attemptsOfStudent()).length;

  await record(page, 1000);
  await page.route("**/api/pronunciation/attempts", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Отправить учителю" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Запись не потеряна" })).toBeVisible();
  expect((await attemptsOfStudent()).length).toBe(before);

  await page.unroute("**/api/pronunciation/attempts");
  await page.getByRole("button", { name: "Отправить ещё раз" }).click();
  await expect(page.getByText(/Запись отправлена учителю/)).toBeVisible();
  const after = await attemptsOfStudent();
  expect(after.length).toBe(before + 1);
});

test("keyboard users can start a recording", async ({ page, context }, info) => {
  test.skip(info.project.name === "mobile", "keyboard check runs on desktop");
  await signIn(context, fx.studentEmail);
  await page.goto(`/ru/student/exercises/${fx.exerciseId}`);
  const start = page.getByRole("button", { name: /Начать запись/ });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Идёт запись")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: /Остановить/ }).press("Enter");
  await expect(page.getByRole("button", { name: "Отправить учителю" })).toBeVisible();
});

test("the teacher listens and saves a review the student then sees", async ({ browser }, info) => {
  test.skip(info.project.name === "mobile", "teacher flow runs on desktop");
  const [attempt] = (await attemptsOfStudent()).filter((a) => a.status === "needs_teacher_review");
  expect(attempt).toBeTruthy();

  const teacherContext = await browser.newContext();
  await signIn(teacherContext, fx.teacherEmail);
  const teacher = await teacherContext.newPage();
  await teacher.goto("/ru/teacher/dashboard");
  await teacher.getByRole("link", { name: "Открыть" }).first().click();
  const recording = teacher.locator("section", { has: teacher.getByRole("heading", { name: "Запись ученика" }) });
  await recording.getByRole("button", { name: "Прослушать", exact: true }).click();
  await expect(recording.locator("audio")).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/submissions\//);
  await teacher.getByLabel("Верно").check();
  await teacher.getByLabel("Комментарий для ученика").fill("Хорошо получилось");
  await teacher.getByRole("button", { name: "Сохранить проверку" }).click();
  await expect(teacher.getByText(/Проверка сохранена/)).toBeVisible();
  await teacher.screenshot({ path: "test-results/review-desktop.png", fullPage: true });
  await teacherContext.close();

  const studentContext = await browser.newContext();
  await signIn(studentContext, fx.studentEmail);
  const student = await studentContext.newPage();
  await student.goto(`/ru/student/exercises/${fx.exerciseId}`);
  await expect(student.getByText("Хорошо получилось").first()).toBeVisible();
  await studentContext.close();
});
