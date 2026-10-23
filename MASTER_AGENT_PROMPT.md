# Kampanya master project instructions

**Kampanya — Your campaigns, made smarter.** Build an AI-assisted content and campaign workspace for micro and small enterprises. Preserve the existing Phase 1 foundation and approved modular monolith. These instructions describe project scope; they do not themselves activate Autonomous Mode.

## Repository and deployment boundaries

- One Git repository with independent `apps/web` (React, TypeScript, Vite; Vercel root) and `apps/api` (Node.js, Express, TypeScript; Render root).
- PostgreSQL, Prisma, OpenAI, authentication credentials, and secrets remain in the API. The browser uses versioned `/api/v1` HTTP contracts and never imports API implementation.
- Keep app-local manifests, lockfiles, checks, environment files, and deployment roots. Do not add microservices, a shared runtime package, Nx, or Turborepo without approval.
- Preserve existing database and migration history, API paths, environment variable names, and deployment resources during the branding migration.

## Approved MVP

1. Multi-user authentication, multi-business membership, and server-enforced roles.
2. Business profiles, offerings, brand voice, target audiences, and owner-confirmed evidence.
3. Marketing objectives, strategy briefs, content pillars or angles, and AI-assisted planning.
4. Formula-guided OpenAI content variants using **Audience Insight + Marketing Objective + Hook + Value Proposition + Trust Element + Call to Action + Platform Optimization**.
5. Editable content, revisions, structured review decisions, and approval.
6. Campaigns and an accessible content calendar with planned dates and manual published status.

The formula is an operational framework, not a validated law. Omit unsupported trust claims. Never invent testimonials, reviews, certifications, statistics, outcomes, or customer evidence. Generated content must stay editable and require human review. No automatic social publishing, advanced analytics, or research experiments in the initial MVP.

## Research objectives held for later approval

The proposed independent variable is **Content Generation Method** (formula-guided versus conventional prompt-based). The proposed dependent variable is **Marketing Content Quality**, measured across audience relevance, informativeness, clarity, persuasive appeal, CTA alignment, and brand consistency. A future comparison must hold model, business context, audience, objective, and platform requirements constant. The adviser must approve the final method, ratings, and analysis before research evaluation is built. Manual performance tracking and usability assessment are also later approval-gated work.

## Design and engineering quality

Read the relevant skills in `.agents/skills/` before implementation. Use the approved Kampanya design direction, semantic tokens, strong typography, purposeful spacing, accessible forms, responsive layouts, and real content hierarchy. Avoid generic AI dashboards, filler metrics, excessive glassmorphism, and decorative gradients. Review critical screens at mobile, tablet, and desktop widths and report actual visual evidence or limitations.

Keep API modules separate by business capability. Validate inputs and model output; enforce tenant membership and role policy on every protected request. Use secure sessions and CSRF protection appropriate to the approved auth design. Bound AI usage, capture generation metadata, and test tenant isolation and failure paths. Review migrations before applying them.

## Execution modes and phase map

**Supervised Mode is the default.** Implement the requested task and stop at phase boundaries. **Autonomous Mode** requires an explicit session prompt naming approved phases and expires with that session. In Autonomous Mode, continue after each phase passes its quality gates; stop for unresolved product or security choices, architecture or scope changes, destructive database work, production deployment, paid resources, or external account or credential changes.

- Phase 1: Foundation and contracts — complete; audit and preserve.
- Phase 2: Kampanya branding and design foundations.
- Phase 3: Identity, memberships, roles, business profiles, brand context, and audiences.
- Phase 4: Strategy and formula-guided OpenAI generation.
- Phase 5: Editing, revisions, review, and approval.
- Phase 6: Campaigns and content calendar.
- Later, separately approved: deployment and hardening, research evaluation, optional manual performance tracking.

For every approved phase, define acceptance criteria, implement the smallest maintainable solution, run relevant checks, review defects, fix and retest up to three correction iterations, and record results in `docs/DEVELOPMENT_PROGRESS.md`. Never weaken tests to advance. Create local commits for verified milestones when safe. Stop and document options if essential role permissions or UI direction remain unapproved.
