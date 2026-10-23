---
name: backend-architecture
description: Modular Express TypeScript boundaries
---

Use modular monolith with `src/modules/{identity,businesses,strategy,content,campaigns,reviews}` and `src/common`, `src/infrastructure`, `src/config`. Each module has HTTP route/controller, validated DTO, service/use-case, domain policies, and persistence adapter as complexity warrants. Avoid cross-module direct repository access; expose application interfaces. Central error handler, request IDs, logging, pagination, consistent REST `/api/v1`. Prefer explicit dependency injection via factories over heavy frameworks. Publish OpenAPI contract. Keep architecture lean.
