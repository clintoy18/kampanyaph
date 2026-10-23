---
name: frontend-design
description: Distinctive product UI and anti-AI-slop rules
---

# Objective
Create a purposeful, credible marketing workspace for small businesses—not a generic AI SaaS template.

## Required workflow
1. Read approved business flows and screen goals. Identify primary user, task, hierarchy, and required data for each view.
2. Propose a **design direction** before code: typography pairing, color roles, spacing, layout density, navigation model, component states, responsive behavior. Explain why it suits marketing workflows.
3. Sketch at least two distinct layout directions for important screens and recommend one; do not implement until approved in design-heavy phases.
4. Build using design tokens and accessible primitives; inspect at desktop and mobile widths.
5. Perform a visual critique and fix deficiencies before presenting for approval.

## Anti-slop prohibitions
- No default purple/blue gradient hero, glassmorphism everywhere, excessive blur/glow, floating orbs, random emojis, decorative charts, identical rounded cards for every piece of information, oversized empty whitespace, or fake metrics.
- No generic 'Unlock the power of AI' copy, invented testimonials, dummy business outcomes presented as real, or unlabeled placeholder charts.
- No blanket shadows or animations. Use visual emphasis only when it improves comprehension.
- Do not copy another product's branding, assets, or layouts without authorization.

## Preferred interaction quality
- Information hierarchy: one clear primary action per screen; secondary actions visually quieter.
- Meaningful content editor with editable draft, formula component hints, source/fact checks, revision history where scoped, and explicit save/review state.
- Campaign calendar must handle content statuses, scheduling conflicts, mobile fallback, and accessible alternative list view.
- Empty states teach the next action. Forms use inline validation and preservation of unsaved work.
- Typography should be chosen deliberately (not default Inter everywhere). Use a restrained palette, consistent scale, purposeful density, and predictable interaction patterns.
- Respect WCAG AA contrast where applicable; keyboard and screen-reader semantics; reduced motion.

## Acceptance
Show visual rationale, screenshots/previews for key breakpoints, keyboard pass, contrast pass, no clipped/overflowing text, no generic AI decoration. Ask owner to approve design direction before scaling to other pages.
