# Kampanya architecture

## Repository and deployment boundaries

One Git repository contains two independently deployable apps. `apps/web` is React, TypeScript, Vite, and Tailwind CSS with Vercel root `apps/web`. `apps/api` is an Express/TypeScript modular monolith with Render root `apps/api`. Each app has its own manifest, lockfile, environment, and checks. The root manifest delegates commands. PostgreSQL, Prisma, OpenAI, and credentials belong exclusively to the API. The browser calls versioned `/api/v1` endpoints; it never imports API source. No shared runtime package, microservices, Nx, or Turborepo are planned.

## Module boundaries

The API modules are `identity` (sessions, recovery, invitations), `businesses` (membership and marketing context), `marketing` (strategy briefs and generation), and `content` (drafts, review decisions, campaigns, calendar). Shared request IDs, errors, role policy, and timezone conversion live in `src/common`; Prisma, development email, and OpenAI adapters live in `src/infrastructure`. External providers sit behind interfaces.

The web app has feature folders for identity and the business workspace. The workspace groups business context, strategy, content studio, reviews, and campaigns behind an authenticated business switcher. `apps/api/openapi/contract.mjs` generates the OpenAPI file and accepted web route path types; the web client keeps response DTO types locally and does not share API runtime code. Kampanya Design Direction A is provisionally approved for the current session.

## Contract and flow

`apps/api/openapi/openapi.json` lists the versioned MVP routes. Protected resources sit under `/api/v1/businesses/{businessId}`. API errors use stable codes and request IDs. Activity lists are capped at 100 items where needed; cursor pagination can be added when usage requires it.

The MVP flow is business and brand context → strategy brief → formula-guided content draft → editable revision → review decision → campaign and calendar → manually tracked published status. No automatic social posting. Owner-confirmed evidence can support trust claims; AI output remains editable and reviewable. Generation metadata records method, template version, model, and token usage. Research comparison, analytics, and automated publishing remain outside the approved MVP.

## Data and security

`apps/api/prisma/schema.prisma` uses one PostgreSQL database. Tenant-owned rows carry `businessId`; composite foreign keys keep related content in one business. Every protected request checks current membership and role, and nested IDs are scoped to the requested business. The approved permission matrix is in `docs/FOUNDATION.md`. The initial migration is generated but unapplied because no development PostgreSQL instance is available here.

Only `VITE_API_ORIGIN` is exposed to the browser. The API holds database, OpenAI, and session secrets. Cookie sessions are opaque, hashed at rest, revocable, and guarded by allowed Origin checks and CSRF tokens. Production email delivery and the final app/API origin arrangement are deployment blockers requiring approval. Changes to shared root files must be considered in both app build pipelines.
