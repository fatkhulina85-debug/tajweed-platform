// Submits the real login / logout forms without JavaScript (progressive enhancement).
// Requires `npx supabase start` and the app running against it (see README).
import { createClient } from "@supabase/supabase-js";
const { API_URL, SECRET_KEY, APP } = process.env;
const admin = createClient(API_URL, SECRET_KEY, { auth: { persistSession: false } });
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
};

const stamp = Date.now();
async function makeUser(name, role, status = "active") {
  const email = `${name}.${stamp}@test.local`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test12345", email_confirm: true });
  await admin.from("user_roles").insert({ user_id: data.user.id, role });
  if (status !== "active") await admin.from("profiles").update({ status }).eq("id", data.user.id);
  return email;
}

function hiddenInputs(html) {
  const form = html.match(/<form[^>]*>([\s\S]*?)<\/form>/)[1];
  return [...form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)].map((m) => {
    const name = m[0].match(/name="([^"]*)"/)?.[1];
    const value = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
    return [name?.replaceAll("&amp;", "&"), value.replaceAll("&amp;", "&").replaceAll("&quot;", '"')];
  }).filter(([name]) => name);
}

async function submitLogin(email, password, path = "/ru/login") {
  const page = await fetch(APP + path);
  const html = await page.text();
  const form = new FormData();
  for (const [name, value] of hiddenInputs(html)) form.append(name, value);
  // `next` streams in behind <Suspense>; with JavaScript React moves it into the form.
  const next = html.match(/<input type="hidden" name="next" value="([^"]*)"/)?.[1];
  if (next) form.append("next", next.replaceAll("&amp;", "&"));
  form.append("email", email);
  form.append("password", password);
  const res = await fetch(APP + path, { method: "POST", body: form, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") ?? "", cookies: res.headers.getSetCookie(), body: await res.text() };
}

const student = await makeUser("form-student", "student");
const blocked = await makeUser("form-blocked", "student", "blocked");

let r = await submitLogin(student, "Test12345", "/ru/login?next=%2Fru%2Fstudent%2Fprogress");
check("correct password signs in and follows next", r.status === 303 && r.location.endsWith("/ru/student/progress") && r.cookies.some((c) => c.startsWith("sb-")), `${r.status} ${r.location}`);
const session = r.cookies.map((c) => c.split(";")[0]).join("; ");

r = await submitLogin(student, "wrong-password");
check("wrong password shows an error and sets no session", r.status === 200 && r.body.includes("Неверная почта или пароль") && !r.cookies.some((c) => c.startsWith("sb-") && !c.includes("Max-Age=0")), `${r.status}`);

r = await submitLogin(blocked, "Test12345");
check("blocked user is refused and signed out", r.body.includes("Доступ к аккаунту приостановлен") && !r.cookies.some((c) => /^sb-[^=]+=[^;]+;/.test(c) && !c.includes("Max-Age=0")), `${r.status}`);

r = await submitLogin(student, "Test12345", "/ru/login?next=%2F%2Fevil.com");
check("an external next is ignored", r.location.endsWith("/ru/app"), r.location);

// Logout through the header form
const dash = await (await fetch(APP + "/ru/student/dashboard", { headers: { cookie: session } })).text();
const logoutForm = dash.match(/<form[^>]*>(?:(?!<\/form>)[\s\S])*Выйти[\s\S]*?<\/form>/)?.[0] ?? "";
const fields = new FormData();
for (const m of logoutForm.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
  fields.append(m[0].match(/name="([^"]*)"/)[1], m[0].match(/value="([^"]*)"/)?.[1] ?? "");
}
r = await fetch(APP + "/ru/student/dashboard", { method: "POST", body: fields, headers: { cookie: session }, redirect: "manual" });
const cleared = r.headers.getSetCookie().filter((c) => c.startsWith("sb-"));
check("logout clears the session and opens login", r.headers.get("location")?.endsWith("/ru/login") && cleared.length > 0 && cleared.every((c) => /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(c)), `${r.status} ${r.headers.get("location")}`);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
