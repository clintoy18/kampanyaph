# Skill: Loop Engineering

## Purpose

Implement a controlled, iterative software engineering workflow that improves code quality while preserving business requirements, architecture, and human approval.

## Core Loop

For every approved implementation task:

1. **Understand** — Read `AGENTS.md`, the relevant skills, business requirements, and existing code.
2. **Plan** — Define scope, acceptance criteria, affected files, risks, and verification steps.
3. **Implement** — Make the smallest maintainable change that satisfies the task.
4. **Validate** — Run relevant linting, type checks, tests, builds, and security checks.
5. **Review** — Inspect the implementation for correctness, maintainability, security, UX quality, and architectural consistency.
6. **Improve** — Fix verified problems and repeat validation.
7. **Report** — Summarize changes, evidence, unresolved issues, and decisions.

## Loop Rules

- Work only within the currently approved phase.
- Do not advance to the next phase automatically.
- Use a maximum of three correction iterations per task before reporting unresolved blockers.
- Never claim tests passed unless they were executed successfully.
- Do not bypass failing tests by removing assertions or weakening validation.
- Do not introduce unrelated refactors.
- Do not silently change database schemas, authentication rules, API contracts, or business requirements.
- Request approval before destructive operations, deployment, or major architectural changes.
- Never invent successful outputs, performance results, or marketing claims.

## Frontend Quality Loop

Before completing frontend tasks:

- Apply the frontend design and design-system skills.
- Review visual hierarchy, typography, spacing, responsiveness, and accessibility.
- Verify loading, empty, error, success, and permission states.
- Inspect rendered screens when browser or screenshot tools are available.
- Avoid generic AI-generated interfaces and unnecessary visual effects.

## Backend Quality Loop

Before completing backend tasks:

- Verify validation and error handling.
- Enforce tenant isolation and role-based authorization.
- Check API contracts and database operations.
- Validate AI integration, output constraints, and usage limits.
- Run unit and integration tests relevant to the change.

## Completion Criteria

A task is complete only when:

- All acceptance criteria are satisfied.
- Relevant automated checks pass.
- No known critical issues remain.
- Changes are documented.
- The implementation follows the approved architecture.

If validation cannot be completed, report the limitation rather than declaring success.

## Approval Gate

After finishing the approved phase:

1. Report implemented features.
2. List modified files.
3. Summarize tests and results.
4. Identify remaining issues and risks.
5. Wait for explicit approval before proceeding.