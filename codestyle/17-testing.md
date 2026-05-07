# Testing Standards

## Table of Contents
- [Scope](#scope)
- [Required test layers](#required-test-layers)
- [TDD default workflow](#tdd-default-workflow)
- [Test quality standards](#test-quality-standards)
- [Exact behavior checks](#exact-behavior-checks)
- [Coverage and gates](#coverage-and-gates)
- [Enforcement](#enforcement)

## Scope
- This module defines testing standards for implementation and release confidence.

## Required test layers
- Test strategy SHOULD include:
  - Unit tests for core logic.
  - Integration tests for boundary interactions.
  - End-to-end tests for critical user workflows when applicable.
- This repository's TypeScript test runner is Vitest; keep unit, related, CI, coverage, e2e, and artifact checks routed through the package scripts unless a narrower documented invocation is needed for iteration.

## TDD default workflow
1. Write a failing test (RED).
2. Implement the smallest change to pass (GREEN).
3. Refactor safely while keeping tests green (REFACTOR).

## Test quality standards
- Tests MUST remain deterministic and isolated.
- Tests SHOULD use Arrange-Act-Assert structure when practical.
- Test names SHOULD describe behavior and expected outcome.
- If behavior is wrong, implementations MUST be fixed; tests SHOULD be rewritten only when assertions are invalid.
- Changed production `src/**` files MUST have a related Vitest path via `pnpm run test:related`; the gate must not pass silently when no test covers the changed source.

## Exact behavior checks
- When executable behavior changes, the smallest real code path that exercises the exact production code touched MUST run before the change is described as verified.
- Prefer invoking the production function, class, CLI command, shell script, validator, or route directly.
- If no existing test covers the path, agents MAY create a temporary local reproduction harness under `codex-scripts/`, but it MUST remain gitignored and MUST import or invoke production code directly instead of copying implementation into the harness.
- If the exact path cannot run because it depends on unavailable credentials, external services, unsafe side effects, or missing generated runtime state, the blocker MUST be stated explicitly and the nearest meaningful validation SHOULD run instead.
- Production behavior MUST NOT be described as verified unless the touched path actually ran.

## Coverage and gates
- Default target is >= 80% coverage unless a repository contract defines a different threshold.
- Generated artifacts, init scaffolds, and runtime/output contracts require artifact or deep validation when their emitted behavior changes.
- Repository-defined baseline gates are mandatory:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm run test:related`
  - `pnpm test`
  - `pnpm audit`
  - `pnpm check`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`

## Enforcement
- Testing evidence MUST list exact commands and outcomes in this form: `Command: <exact command> -> pass|fail|blocked (<reason>)`.
- Blocked test steps MUST include concrete blocker reasons.
