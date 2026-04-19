# Web Standards

## Table of Contents
- [Scope](#scope)
- [React](#react)
- [Vite](#vite)
- [Tailwind](#tailwind)
- [Storybook](#storybook)
- [Accessibility](#accessibility)
- [Enforcement](#enforcement)

## Scope
- This module covers web application standards for React, Vite, Tailwind, and Storybook surfaces.

## React
- Use semantic HTML first; add ARIA only where semantics are insufficient.
- Hooks MUST follow Rules of Hooks and keep side effects in effect hooks.
- Prefer controlled inputs unless uncontrolled behavior is intentional and documented.
- Keep state local by default; avoid global mutable state drift.

## Vite
- Keep environment variable usage explicit, typed, and documented.
- Never expose secrets in client bundles.
- Avoid mode-dependent runtime behavior changes without explicit test coverage.

## Tailwind
- Keep utility usage consistent with repo formatting/lint policy.
- Prefer design tokens over one-off magic values.
- Maintain readable conditional class composition.
- Ensure visible focus states and avoid color-only status communication.

## Storybook
- Use deterministic fixtures; avoid hidden network calls in stories.
- Keep interaction and accessibility checks enabled where applicable.
- Treat Storybook as behavior and visual contract documentation for reusable UI components.

## Accessibility
- Target WCAG 2.2 AA for interactive web surfaces.
- Ensure full keyboard operation, visible focus, and screen-reader-meaningful labels.

## Enforcement
- Web changes MUST pass:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `bash scripts/verify-work.sh --fast`
- For component-system work, include Storybook/accessibility checks when configured in the touched project.
- All bypasses require documented waiver metadata (reason, tracker, expiry/ADR).
