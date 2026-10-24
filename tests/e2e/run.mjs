// Builds the app against the local Supabase stack, starts it and runs the
// end-to-end checks. Requires Docker and `npx supabase start`.
import { execSync, spawn } from "node:child_process";

const port = 3200;
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" }));
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY,
  NEXT_DIST_DIR: ".next-e2e",
  API_URL: status.API_URL,
  PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SECRET_KEY: status.SECRET_KEY,
  MAILPIT_URL: status.MAILPIT_URL ?? status.INBUCKET_URL,
  APP: `http://localhost:${port}`,
};

execSync("npx next build", { env, stdio: "inherit" });
const server = spawn("npx", ["next", "start", "-p", String(port)], { env, shell: true });

let code = 1;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${env.APP}/ru`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  execSync("node tests/e2e/auth.mjs", { env, stdio: "inherit" });
  execSync("node tests/e2e/login.mjs", { env, stdio: "inherit" });
  code = 0;
} catch {
  code = 1;
} finally {
  if (process.platform === "win32") execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
  else server.kill();
}
process.exit(code);
