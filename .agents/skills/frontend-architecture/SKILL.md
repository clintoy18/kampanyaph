---
name: frontend-architecture
description: React feature structure and API contracts
---

Use feature folders for business-profile, strategy, content-studio, review, and campaigns. Route boundaries and tenant/business switcher must reflect authenticated memberships. Use typed API client generated or aligned with backend OpenAPI; centralize auth/session, query caching and error mapping. Avoid leaking backend DTOs into visual components; use adapters. No secrets in Vite environment variables. No direct imports from apps/api; use versioned OpenAPI HTTP client. Define testable forms, loading/empty/error/forbidden states, and optimistic changes only where rollback is safe.
