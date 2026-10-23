---
name: api-testing
description: Backend quality and acceptance checks
---

Test unit domain policies, service behavior, and API integration; verify auth failures, cross-tenant IDOR attempts, permission matrix, validation errors, content draft→review→approved transitions, and campaign scheduling constraints. Mock OpenAI responses in deterministic tests; test malformed responses and rate limits. Verify Prisma migrations on disposable database, OpenAPI accuracy, health endpoint, CORS for approved Vercel origins, environment configuration for Render. Report exact commands and results; no invented passes.
