# Repository Guidelines

## Structure and Architecture

Kampanya is one repository with independently deployable `apps/web` (React, TypeScript, Vite; Vercel root) and `apps/api` (Express, TypeScript; Render root). Read `MASTER_AGENT_PROMPT.md`, `docs/ARCHITECTURE.md`, and the owning app's `AGENTS.md` before changing an app. Project skills live in `.agents/skills/`. The API alone accesses PostgreSQL, Prisma, OpenAI, and secrets. The web app uses a versioned `/api/v1` HTTP contract; never import API implementation into it.

## Development Commands

Each app has its own manifest and lockfile. From the repository root, use `npm --prefix apps/web run dev` or `npm --prefix apps/api run dev`. Run each app's `lint`, `typecheck`, `test`, and `build` scripts before review. `npm --prefix apps/api run schema:validate` checks the proposed Prisma schema without applying migrations. Install dependencies separately in each app with `npm --prefix apps/web ci` and `npm --prefix apps/api ci` after lockfiles exist.

## Style and Tests

Use strict TypeScript, two-space indentation, ESLint, and Prettier. Keep web code feature-first and API code in modules with explicit service boundaries. Put tests in the owning app; name them `*.test.ts` or `*.test.tsx`. Prioritize tenant isolation, permissions, transitions, validation, and failure cases. For UI work, inspect responsive, keyboard, loading, empty, error, and forbidden states. Do not claim checks passed unless they ran.

## Execution Modes and Engineering Loop

Supervised Mode is the default: implement the requested task and stop at phase boundaries. Autonomous Mode requires explicit authorization in the current session and applies only to the named phases; it is never a persistent setting. In Autonomous Mode, continue through authorized phases after each quality gate passes. In either mode, stop for unresolved product or security choices, architectural changes, scope expansion, destructive database work, production deployment, paid resources, or external account or credential changes.

Read `.agents/skills/loop-engineering/SKILL.md` and `docs/ENGINEERING_LOOP.md` for every approved task. The latter clarifies session-scoped Autonomous Mode where the legacy skill says to stop after each phase. Plan, implement, test, review, fix, retest, and report; stop after three unsuccessful correction iterations. Apply relevant frontend or backend skills. Record phase results in `docs/DEVELOPMENT_PROGRESS.md`. Never bypass a failing check to advance.

## Commits, Reviews, and Security

Use short imperative commit subjects, for example `Add API health endpoint`. Pull requests should state scope, decisions, checks with results, and screenshots for UI changes. Keep secrets out of Git and Vite environment variables. Enforce business membership and role checks server-side; do not fabricate marketing claims or publish content automatically. Preserve existing API paths, environment names, database history, and deployment resources during branding changes.
