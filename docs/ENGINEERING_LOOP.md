# Kampanya engineering loop

The `.agents/skills/loop-engineering/SKILL.md` file remains the reusable skill. This document clarifies the newer execution mode policy until the protected skill file can be updated. Session instructions and `AGENTS.md` govern whether phases may continue automatically.

## Plan → Implement → Test → Review → Fix → Retest → Report → Continue

For each approved task, state acceptance criteria and affected boundaries. Implement the smallest maintainable change. Run relevant tests, linting, type checks, builds, schema checks, and visual checks. Review correctness, security, tenant isolation, architecture, accessibility, responsive layout, and contract accuracy. Fix verified defects and repeat validation, with no more than three unsuccessful correction iterations. Do not weaken tests or bypass failures to advance. Record changed files, exact checks and results, remaining risks, and next steps in `docs/DEVELOPMENT_PROGRESS.md`.

In Supervised Mode, stop at the requested task or phase boundary. In Autonomous Mode, continue only through phases explicitly named in the current session prompt when every applicable quality gate passes. Stop for unresolved essential product or security decisions, architecture changes, scope expansion, destructive database work, production deployment, paid resources, or external account and credential changes. Authorization never carries into another session.
