# Development progress

## Phase 1 audit — complete foundation, retained

- One Git repository with independent `apps/web` and `apps/api` manifests, lockfiles, TypeScript, lint, format, test, and build scripts.
- Web: React/Vite placeholder, Tailwind and shadcn/ui configuration; no feature screens or web test cases.
- API: Express health and metadata routes, request IDs, restricted browser CORS, JSON size/error handling, five API tests, OpenAPI skeleton.
- Prisma schema is a proposal only. No migration, database, identity feature, OpenAI integration, or deployment is present.
- At audit start, Git had no commits and all repository files were untracked. Preserve the existing working tree; make the first local commit only after a verified milestone and review of staged files.

## Phase 2 — Kampanya branding and design foundations

**Acceptance criteria:** user-facing product and API metadata say Kampanya; documentation reflects the current phase map and session-scoped autonomy; existing API paths, environment names, package identities, and database history remain compatible; a concrete UI direction is recorded and approved before screen work; relevant checks pass.

**Completed:** updated root and app instructions, master prompt, product copy and metadata, API contract name, and branding documentation. Added `docs/ENGINEERING_LOOP.md` because writing the protected `.agents/skills/loop-engineering/SKILL.md` was denied by the workspace policy.

**Verification:** web lint, typecheck, build, and formatting pass; its Vitest runner reports zero test files. API Prisma validation, lint, typecheck, build, formatting, and all five route tests pass. Production-dependency npm audits report zero vulnerabilities in both apps. Desktop and true 375 px mobile screenshots of the placeholder were inspected; the mobile DOM reports `innerWidth = scrollWidth = 375`. A basic narrow-window screenshot clipped because Edge used a wider layout viewport, so a DevTools mobile viewport was used for the actual check.

**Pending:** owner confirmation of design direction before changing visual tokens or implementing feature screens. The existing app package names and example database name remain unchanged intentionally. The protected loop skill file still needs to be reconciled with `docs/ENGINEERING_LOOP.md` when write access is available.

**Commit status:** no local commit was created. The repository has no initial commit and no configured Git author identity; no author details were invented. All changes remain reviewable in the working tree.

## Phase 2 decisions recorded before the current session

The earlier review identified role permissions, authentication, and visual direction as open. The current session resolved authentication and visual direction, and exposed the role conflict documented below.

## Current session — Phase 3 authorization audit

The owner provisionally approved Design Direction A and approved API-owned email/password authentication with server-managed sessions, local-only development email delivery, account recovery, invitations, and backend authorization. No paid email provider or production delivery was authorized. The owner also authorized autonomous Phases 3–6, subject to an explicit stop if the approved role model materially differs from the foundation matrix.

**Deployment blocker:** a production transactional email provider and delivery configuration must be selected and approved before real invitations or password recovery can be deployed. Development will use an adapter that does not send external mail.

**Resolved permission conflict:** the owner approved Option 2. Editors may maintain brand context, audiences, and evidence; Owners alone change core business details and memberships. Reviewers have read access to business marketing data and may review another user's content. No role may review its own content. `docs/FOUNDATION.md` now records this approved matrix.

**Current phase:** Phases 3–6 have been implemented under session-scoped Autonomous Mode. Database-backed and deployment validation remain open. No production deployment or external email delivery is authorized.

## Session implementation — Phases 3–6

The owner approved Option 2 permissions and resumed session-scoped Autonomous Mode. The current implementation follows Design Direction A. Platform labels remain configurable text, drafts may have planned dates, onboarding defaults to `Asia/Manila`, and Owners may change the timezone. Production domains remain a deployment decision.

### Phase 3 — identity and business context

**Acceptance:** register/login/logout, revocable HTTP-only cookie sessions and CSRF, recovery and invitations with single-use expiring tokens, membership and roles per business, brand context, offerings, audiences, evidence, and backend tenant authorization.

**Implemented:** Prisma schema and generated initial SQL migration; `identity`, `businesses`, `common`, and `infrastructure` API modules; local-only email sink; authentication, onboarding, business context, and team screens. Owner/Editor/Reviewer grants match `docs/FOUNDATION.md`. Owners alone change core details and memberships. All nested reads and writes scope records to the business. The API rejects self-review for every role.

**Verification:** authorization and identity HTTP tests exercise Owner, Editor, Reviewer, cross-business denial, CSRF, session secrecy, logout, and self-review. Prisma schema validates and client generation/typecheck pass. The migration was **not applied**; a PostgreSQL integration run is still required.

### Phase 4 — strategy and AI generation

**Acceptance:** strategy briefs link same-business audiences and confirmed evidence; structured OpenAI output follows the seven-part formula; generated copy remains editable; metadata, history, bounded usage, and safe failures are present.

**Implemented:** `marketing` routes, an OpenAI Responses adapter, bounded output validation, timeout and retry, a shared daily limit for strategy suggestions and content generation, token usage history for both, and the strategy workbench. Business offerings are included in bounded model context. The API key stays server-side. Unconfirmed evidence cannot be chosen as a trust element. No AI call was made in this environment; adapter tests mock responses.

### Phase 5 — editing and review

**Acceptance:** revisions, draft submission, review decisions with feedback and checklist, approval history, no self-approval, and backend status transitions.

**Implemented:** content editor, revision history, review queue, conditional backend transitions, reviewer decision records, and rejection feedback. Approval requires all checks; a change request may record failed checks. Content edited after approval returns to draft. Metadata writes detect a status change during review. HTTP tests cover role and self-review rules.

### Phase 6 — campaigns and calendar

**Acceptance:** campaigns and objectives, campaign/content organization, business-timezone calendar, and manual published status; no social integration.

**Implemented:** campaign CRUD paths, content assignment with same-business validation, month grid and accessible list view, scheduling and conflict hints, and manual published status. Campaign date edits use a serializable transaction. Planned instants are stored in UTC and queried by business calendar dates. Unit tests cover date boundaries and invalid campaign ranges.

## Changed areas and checks

- API: Prisma schema/migration, identity/business/marketing/content modules, OpenAI and email adapters, role/security/time helpers, OpenAPI route manifest and contract, and automated tests.
- Web: typed API client with generated route paths, authentication and workspace feature screens, semantic design tokens, responsive layouts, timezone conversion, and client tests.
- Docs: approved permission matrix, current architecture, README, and this progress record. The protected `.agents/skills/loop-engineering/SKILL.md` remains read-only; `docs/ENGINEERING_LOOP.md` is the active temporary instruction.

Final exact check results are recorded below after the quality gate. Visual inspection used Edge DevTools viewport emulation at 375, 768, and 1440 px with a local mock API; screenshots are ignored build artifacts under `.npm-cache/visual-check/`. They show layout only and are not an end-to-end database test.

## Remaining blockers and next steps

1. Run real database-backed integration tests against an approved disposable PostgreSQL database. A user-configured Prisma Postgres database now reports the initial migration as finished, but these checks have not been run. `DIRECT_URL` is still missing from the local API environment. No database was modified by this agent.
2. Select and approve a production transactional email provider and app/API domain arrangement before deployment. Production startup intentionally fails until email delivery is provided. Cross-site cookie behavior must be checked for the chosen domains.
3. Exercise a real OpenAI request with approved credentials in a nonproduction environment; mocked adapter tests do not prove provider access, output quality, or current pricing.
4. Reconcile the protected loop skill when write access is granted. No filesystem permission was bypassed.

No production deployment, external email, paid resource creation, social publishing, analytics, or research evaluation was performed. No local commit was made because this repository still has no initial commit or configured author identity.

## Latest quality gate

The latest repository-wide run passed `npm.cmd run typecheck`, `npm.cmd run test` (4 web tests and 34 API tests), `npm.cmd run lint`, and `npm.cmd run build`. Both apps passed `format:check`; `npm.cmd --prefix apps/api run schema:validate` and the OpenAPI contract drift check passed. The initial SQL migration matched a fresh Prisma schema diff byte-for-byte in the previous gate. Production-dependency npm audits previously reported zero vulnerabilities after using the system certificate store. An initial parallel test/typecheck run briefly failed because both commands regenerated the same Prisma client concurrently; sequential validation passed without code changes.

Edge screenshots of auth and all five workspace sections were inspected at 375, 768, and 1440 px with a local mock API. Measured document width stayed within each viewport. A keyboard Tab check reached three shell controls with visible solid focus outlines. These checks cover rendered layout and navigation only; production browser sessions, real database flows, external email delivery, and real OpenAI calls remain unverified.

**Current status:** approved MVP code for Phases 3–6 is in the working tree and passes available local gates. Database-backed integration and deployment gates remain open; do not treat this as production-ready or deploy it automatically.

## Prisma Console setup follow-up

The API Prisma config now prefers `DIRECT_URL` for CLI migrations while retaining `DATABASE_URL` as a fallback for local PostgreSQL. The runtime still uses `DATABASE_URL`; the API environment example and README explain pooled and direct URLs. This preserves the existing runtime architecture and does not expose credentials to the browser.

The API dependencies were absent from the checkout and were restored with `npm.cmd ci --prefer-offline`. API typecheck, ESLint, Prettier, Prisma schema validation, all 34 API tests, and build passed afterward. A temporary API instance returned `{"status":"ok"}` from `/healthz`. Read-only checks through the configured pooled Prisma Postgres URL succeeded. A later read-only query confirmed `20261023000000_initial` is recorded as finished and not rolled back, and the `User` table exists. This agent did not apply the migration. `DIRECT_URL` remains absent, so future CLI migrations need the direct URL from Prisma Console. The API environment has a valid-length CSRF secret and local allowed origin; the web app points to port 4000. An OpenAI API key is not configured, so generation remains unavailable locally.
