# AI Marketer — persistent monorepo instructions

> Archived instructions from the original planning kit. Use the root `AGENTS.md` for active repository guidance; Phase 1 was approved after this file was written.

ONE Git repository, TWO independently deployable applications:
- `apps/web`: React + TypeScript + Vite → Vercel, root directory `apps/web`.
- `apps/api`: Express + Node.js + TypeScript → Render, root directory `apps/api`. PostgreSQL + Prisma and OpenAI are backend-only.

Read `MASTER_AGENT_PROMPT.md` and `docs/ARCHITECTURE.md`. Before work, read relevant root `.agents/skills/<skill>/SKILL.md` and app-scoped `AGENTS.md`. If skills are not auto-discovered, open them explicitly.

Phase 0 planning only until explicitly approved. No app code, installs, migrations, deployments, or provisioning. Each app has independent package manifest, env, tests, build and deployment. No imports of backend implementation into frontend. Versioned `/api/v1` OpenAPI contract. No OpenAI or DB secrets in browser. Enforce business-level tenant isolation and RBAC server-side.

MVP: business/brand context; formula-guided AI content generation; review/approval; campaigns/calendar. Research comparison and manual performance analytics are later approval-gated scope. No automatic social posting or fabricated marketing evidence.

Before UI work read `frontend-design`, `design-system`, `frontend-architecture`; before UI acceptance read `ui-quality-gate`. Before API work read `backend-architecture`, `data-security`, `ai-content-engine`; before acceptance read `api-testing`. Stop after every phase, report real checks, and ask for approval.

## Mandatory Engineering Loop

For every implementation task, read:

`.agents/skills/loop-engineering/SKILL.md`

Follow the Plan → Implement → Validate → Review → Improve cycle.

Repeat within the approved task until its acceptance criteria pass,
or until the iteration limit is reached.

Never advance to another phase without explicit user approval.

Preserve the existing frontend, backend, security, and UI quality skills.

