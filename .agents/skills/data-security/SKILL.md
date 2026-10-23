---
name: data-security
description: PostgreSQL tenancy, RBAC, and security
---

PostgreSQL + Prisma. Model User, Business, Membership, BrandContext, Audience, Campaign, ContentItem, ContentRevision, ReviewDecision, and AI generation metadata as needed after ERD approval. Every tenant-scoped read/write enforces authenticated business membership and role permissions; verify object belongs to business, including nested relationships. Use server-side session/auth mechanism selected in Phase 1; secure cookies/token strategy and CSRF protections as appropriate. Validate inputs; rate-limit auth and AI endpoints; bound content length; protect secrets; redact PII from logs. Add DB constraints, indexes, soft-delete policy only where justified. Migration/seed review before applying to shared environments.
