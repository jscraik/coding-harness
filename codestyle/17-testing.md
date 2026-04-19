# Testing Standards

## Table of Contents
- [Scope](#scope)
- [Required test layers](#required-test-layers)
- [TDD default workflow](#tdd-default-workflow)
- [Test quality standards](#test-quality-standards)
- [Coverage and gates](#coverage-and-gates)
- [Enforcement](#enforcement)

## Scope
- This module defines testing standards for implementation and release confidence.

## Required test layers
- Test strategy SHOULD include:
  - Unit tests for core logic.
  - Integration tests for boundary interactions.
  - End-to-end tests for critical user workflows when applicable.

## TDD default workflow
1. Write a failing test (RED).
2. Implement the smallest change to pass (GREEN).
3. Refactor safely while keeping tests green (REFACTOR).

## Test quality standards
- Keep tests deterministic and isolated.
- Use Arrange-Act-Assert structure when practical.
- Name tests by behavior and expected outcome.
- Fix implementation when behavior is wrong; only rewrite tests when assertions are invalid.

## Coverage and gates
- Default target is >= 80% coverage unless a repository contract defines a different threshold.
- Repository-defined baseline gates are mandatory:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `bash scripts/verify-work.sh --fast`

## Enforcement
- Testing evidence MUST list exact commands and outcomes in this form: `Command: <exact command> -> pass|fail|blocked (<reason>)`.
- Blocked test steps MUST include concrete blocker reasons.
