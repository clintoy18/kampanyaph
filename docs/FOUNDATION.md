# Phase 1 foundation decisions

This document began as the Phase 1 proposal. The owner has approved the authentication, role, design, and MVP workflow decisions below. Phases 3–6 implement them; production deployment remains separately approval-gated.

## Package and deployment layout

Use npm with separate `package.json` and `package-lock.json` files in `apps/web` and `apps/api`. A root manifest only delegates commands. This keeps both provider roots self-contained and avoids a shared runtime package. Keep the OpenAPI source in the API; commit a generated web client when feature endpoints arrive, and check contract drift in CI. Vercel root stays `apps/web`; Render root stays `apps/api`. Path filters must account for root configuration and contract changes.

The web app uses Tailwind CSS through its Vite plugin. `components.json` prepares selective shadcn/ui components; no shadcn component has been added yet. Direction A supplies deep navy, warm cream, coral, restrained teal, editorial typography, and accessible responsive layouts.

## Approved MVP authentication

The API owns email/password authentication and authorization. Use secure password hashing, revocable opaque sessions stored as hashes in PostgreSQL, `HttpOnly` cookies with `Secure` in production, short session expiry, logout, and CSRF protection on state-changing requests. Restrict browser origins and never place tokens in browser storage. Invitations and password recovery use expiring single-use tokens through a development-only email adapter. A production transactional email provider and production app/API origins remain deployment blockers; do not send real email before approval.

## Approved permission matrix

| Action | Owner | Editor | Reviewer |
| --- | --- | --- | --- |
| Manage core business details, members, and roles | Yes | No | No |
| Maintain brand context, audiences, and evidence | Yes | Yes | Read |
| Create strategy, content, and campaigns | Yes | Yes | Read |
| Submit a draft for review | Yes | Yes | No |
| Approve or request changes on another user's content | Yes | No | Yes |
| Mark approved content published manually | Yes | Yes | No |

All roles read only businesses of which they are active members; one user may hold a different role in each business. Owners alone invite/remove members and change core business details. Editors cannot approve content. Reviewers cannot edit marketing context or content. No one may approve or reject their own content or revision, including Owners. The API enforces every permission and scopes nested records to the authenticated business; route visibility in the web app is only a convenience.

## Workflow and integrity rules

`DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED` is the approved status path. A change request or edit of approved copy returns the item to draft; body edits create a new revision. `PUBLISHED` is a manual status, never a social API action. Review decisions target a specific revision. Drafts may have planned dates. Store planned times in UTC and render in the business's IANA timezone; onboarding defaults to `Asia/Manila`, and Owners may change it. All tenant-owned records carry `businessId`; API queries and nested IDs must be scoped to authenticated membership. The initial migration has been generated but not applied.

## Contract and operations

The live MVP routes are listed in `apps/api/openapi/openapi.json`; the web path types are generated from the same route manifest. API errors carry stable codes and request IDs. Credentials stay server-side. CORS, allowed Origin checks, CSRF tokens, backend role checks, and tenant-scoped references protect business data. AI generation uses confirmed evidence, structured output validation, bounded usage, and human review.

## Remaining deployment and product choices

1. Select the production transactional email provider and app/API domains before deployment.
2. First-release platform labels remain configurable values; no platform integration is included.
3. Drafts may have planned dates for calendar organization; planned time is never automatic publishing. Onboarding defaults to `Asia/Manila`, and Owners may change the business timezone.
