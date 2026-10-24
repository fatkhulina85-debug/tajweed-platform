# Tajweed

A web platform for learning tajweed step by step: lessons based on four workbooks, a fifth month of surah reading practice, audio submissions reviewed by a teacher, and a progress map by competency. The interface is in Russian and Arabic (RTL).

The full specification is `Tajweed_Technical_Specification_v1.docx` (kept outside the repository).

## Stack

- Next.js 16 (App Router, Cache Components), React 19, TypeScript
- Tailwind CSS 4
- Supabase: Postgres, Auth, Storage; migrations in `supabase/migrations`
- Vitest, ESLint, GitHub Actions

## Getting started

Requires Node.js 24.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev                  # http://localhost:3000
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types and runs `tsc` |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run check` | Runs all of the above in order, as CI does |
| `npm run test:db` | Database access tests (pgTAP) against the local Supabase |
| `npm run test:e2e` | Builds the app against the local Supabase and runs the end-to-end auth checks |
| `npm run db:types` | Regenerates `src/lib/supabase/database.types.ts` from the local schema |

## Local Supabase

Database changes are tested locally before they reach the real project. Requires Docker Desktop.

```bash
npx supabase start -x studio,imgproxy,vector,logflare,realtime,edge-runtime,supavisor,postgres-meta
npm run test:db     # every migration on a clean database + RLS tests
npm run test:e2e
npx supabase stop
```

Emails sent by the local stack (invitations, password resets) appear in Mailpit: http://127.0.0.1:54324.

## Accounts and access

- No public sign-up. An admin invites people from `/ru/admin/users`; the email link (`/[lang]/auth/confirm`) signs them in and opens `/[lang]/set-password`.
- Roles are stored in `public.user_roles`, never in user-editable metadata. A new user has no role until an admin grants one.
- Users are blocked (`profiles.status`), not deleted. A blocked user loses all roles immediately, including in RLS.
- Role grants, assignments and blocking are written to `audit_logs` by database triggers.
- Pages check the role on the server (`src/lib/auth/session.ts`), and RLS checks it again in the database. `src/proxy.ts` only refreshes the session and redirects guests.

## Languages and RTL

Every route starts with a locale: `/ru/...` or `/ar/...`. `src/proxy.ts` redirects addresses without one, using the `NEXT_LOCALE` cookie first and then the browser language. The root layout `src/app/[lang]/layout.tsx` sets `lang` and `dir` on `<html>`.

- Interface strings: `src/i18n/dictionaries/ru.ts` and `ar.ts`. A test checks that both have the same keys.
- Use logical Tailwind classes (`ms-`, `pe-`, `start-`, `text-start`) instead of `ml-`/`right-` so layouts mirror correctly in Arabic.
- Wrap Arabic text inside the Russian interface in an element with `class="arabic" lang="ar" dir="rtl"`.

## Structure

```
src/
  app/[lang]/          pages: home, login, reset-password, app,
                       student/*, teacher/*, admin/*
  components/          shared UI (cabinet shell, header, forms)
  i18n/                locales, negotiation, dictionaries
  lib/auth/            session and roles (DAL), auth Server Actions
  lib/admin/           admin Server Actions (invite, roles, blocking)
  lib/supabase/        Supabase clients: server, proxy, admin (server only)
  proxy.ts             locale redirect, session refresh
supabase/
  migrations/          schema, RLS policies, triggers
  tests/database/      pgTAP access tests
  templates/           invite and recovery emails
tests/e2e/             end-to-end auth checks
```

## Security rules

- `SUPABASE_SERVICE_ROLE_KEY` is server-only: never prefix it with `NEXT_PUBLIC_` and never import it in client components.
- Every table gets RLS policies and access tests in the same change that creates it.
- Audio is stored only in a private bucket and served through short-lived signed URLs.
- Schema changes go through migrations in the repository, not manual edits in the Dashboard.

## Stages

0. Audit ✅
1. Scaffold: routes, RU/AR, RTL, design tokens ✅
2. Auth and roles, RLS ✅ (locally; applying to the real project needs CLI access)
3. Course model: migrations, admin publishes a lesson
4. Student cabinet: lesson, quiz, progress
5. Audio and review: private storage, teacher queue, feedback
6. Live sessions
7. Content pilot: audit of the first workbook
8. QA and launch
