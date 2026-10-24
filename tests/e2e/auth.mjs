// End-to-end auth checks against the local Supabase stack and a running app.
// Requires `npx supabase start` and the app running against it (see README).
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const { API_URL, PUBLISHABLE_KEY, SECRET_KEY, MAILPIT_URL, APP } = process.env;
const admin = createClient(API_URL, SECRET_KEY, { auth: { persistSession: false } });
const PASSWORD = "Test12345";
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
}

async function makeUser(email, roles) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  for (const role of roles) {
    const { error: e } = await admin.from("user_roles").insert({ user_id: data.user.id, role });
    if (e) throw e;
  }
  return data.user.id;
}

async function cookiesFor(email) {
  const jar = new Map();
  const client = createServerClient(API_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function get(path, cookie) {
  const res = await fetch(APP + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
  return { status: res.status, location: res.headers.get("location") ?? "", body: await res.text(), headers: res.headers };
}

const stamp = Date.now();
const email = (name) => `${name}.${stamp}@test.local`;

await makeUser(email("admin"), ["admin"]);
const teacherId = await makeUser(email("teacher"), ["teacher"]);
const s1 = await makeUser(email("student1"), ["student"]);
const s2 = await makeUser(email("student2"), ["student"]);
await makeUser(email("norole"), []);
await admin.from("teacher_assignments").insert({ teacher_id: teacherId, student_id: s1 });

const c = {
  admin: await cookiesFor(email("admin")),
  teacher: await cookiesFor(email("teacher")),
  s1: await cookiesFor(email("student1")),
  s2: await cookiesFor(email("student2")),
  norole: await cookiesFor(email("norole")),
};

// Guests
let r = await get("/ru/student/dashboard");
check("guest is sent from a cabinet to login with next", r.status === 307 && r.location.includes("/ru/login?next=%2Fru%2Fstudent%2Fdashboard"), `${r.status} ${r.location}`);
r = await get("/ru/admin/users");
check("guest cannot open admin users", r.status === 307 && r.location.includes("/ru/login"), `${r.status}`);
r = await get("/ru/login");
check("guest sees the login form", r.status === 200 && r.body.includes('name="password"'), `${r.status}`);

// Role redirect
r = await get("/ru/app", c.s1);
check("student /app -> student dashboard", r.body.includes("/ru/student/dashboard") || r.location.includes("/ru/student/dashboard"), `${r.status} ${r.location}`);
r = await get("/ru/app", c.teacher);
check("teacher /app -> teacher dashboard", r.body.includes("/ru/teacher/dashboard") || r.location.includes("/ru/teacher/dashboard"), `${r.status} ${r.location}`);
r = await get("/ar/app", c.admin);
check("admin /app -> admin users (ar)", r.body.includes("/ar/admin/users") || r.location.includes("/ar/admin/users"), `${r.status} ${r.location}`);
r = await get("/ru/app", c.norole);
check("user without a role sees 'access not granted yet'", r.body.includes("Доступ ещё не выдан"));
r = await get("/ru/login", c.s1);
check("signed-in user is sent from login to /app", r.status === 307 && r.location.endsWith("/ru/app"), `${r.status} ${r.location}`);

// Cabinet gates
r = await get("/ru/student/dashboard", c.s1);
check("student opens student cabinet", r.status === 200 && !r.body.includes("Нет доступа") && r.body.includes("Продолжить обучение"));
r = await get("/ru/admin/users", c.s1);
check("student is denied admin users", r.body.includes("Нет доступа") && !r.body.includes(email("student2")));
r = await get("/ru/teacher/dashboard", c.s1);
check("student is denied teacher cabinet", r.body.includes("Нет доступа"));
r = await get("/ru/admin/users", c.teacher);
check("teacher is denied admin users", r.body.includes("Нет доступа") && !r.body.includes(email("student1")));
r = await get("/ru/admin/users", c.admin);
check("admin sees all users", [email("admin"), email("teacher"), email("student1"), email("student2"), email("norole")].every((e) => r.body.includes(e)));
r = await get("/ru/account", c.s1);
check("account page shows own email only", r.body.includes(email("student1")) && !r.body.includes(email("student2")));
r = await get("/ru/student/dashboard", c.s1);
check("header shows logout for signed-in user", r.body.includes("Выйти"));

// Blocking
await admin.from("profiles").update({ status: "blocked" }).eq("id", s2);
r = await get("/ru/app", c.s2);
check("blocked user sees 'access suspended'", r.body.includes("Доступ к аккаунту приостановлен"));
r = await get("/ru/student/dashboard", c.s2);
check("blocked user is denied the cabinet", r.body.includes("Нет доступа"));

// Data API with the user's own token: RLS
for (const [who, cookie, expected] of [["student1", c.s1, 1], ["teacher", c.teacher, 2], ["admin", c.admin, null]]) {
  const jar = Object.fromEntries(cookie.split("; ").map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]));
  const client = createServerClient(API_URL, PUBLISHABLE_KEY, { cookies: { getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })), setAll: () => {} } });
  const { data } = await client.from("profiles").select("id");
  check(`REST: ${who} sees ${expected ?? "all"} profiles`, expected === null ? data.length >= 5 : data.length === expected, `got ${data?.length}`);
}

// Invite email -> confirm link -> set-password
await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
const inviteEmail = email("invited");
const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(inviteEmail, { data: { locale: "ru" } });
check("invite email is sent", !inviteError, inviteError?.message);
await new Promise((resolve) => setTimeout(resolve, 1500));
const list = await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent("to:" + inviteEmail)}`)).json();
const msg = list.messages?.[0] && (await (await fetch(`${MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`)).json());
check("invite subject is localized", msg?.Subject === "Приглашение на платформу Tajweed", msg?.Subject);
const link = msg?.HTML.match(/href="([^"]*\/ru\/auth\/confirm[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
check("invite contains a token_hash link to /ru/auth/confirm", Boolean(link && link.includes("token_hash=") && link.includes("type=invite")), link);
if (link) {
  const url = new URL(link);
  r = await get(url.pathname + url.search);
  const setCookie = r.headers.getSetCookie?.() ?? [];
  check("confirm link signs in and opens set-password", r.status === 307 && r.location.endsWith("/ru/set-password") && setCookie.some((v) => v.startsWith("sb-")), `${r.status} ${r.location}`);
  r = await get(url.pathname + url.search);
  check("the same link cannot be used twice", r.location.includes("/ru/login?error=link"), `${r.status} ${r.location}`);
}
r = await get("/ru/auth/confirm?token_hash=bogus&type=invite&next=/ru/set-password");
check("a bad token goes to login with an error", r.location.includes("/ru/login?error=link"), r.location);
r = await get("/ru/auth/confirm?token_hash=bogus&type=signup");
check("unsupported link types are rejected", r.location.includes("/ru/login?error=link"), r.location);
const { data: invited } = await admin.from("profiles").select("id, locale").eq("email", inviteEmail).single();
const { data: invitedRoles } = await admin.from("user_roles").select("role").eq("user_id", invited.id);
check("invited user gets a profile and no role by default", invited && invitedRoles.length === 0);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
