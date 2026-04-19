# Development Workflow Standards

## Table of Contents
- [Scope](#scope)
- [Research and reuse first](#research-and-reuse-first)
- [Plan before implementation](#plan-before-implementation)
- [Build and verify loop](#build-and-verify-loop)
- [Pre-review readiness](#pre-review-readiness)
- [Enforcement](#enforcement)

## Scope
- This module defines the end-to-end feature workflow before and around Git/PR operations.
- It complements [13-git-workflow.md](./13-git-workflow.md), which covers commit and PR mechanics.

## Research and reuse first
- Before writing new implementation code:
  1. Search the current repository for an existing pattern.
  2. Search trusted upstream sources (official docs, library docs, primary references).
  3. Reuse or adapt proven patterns where practical instead of creating net-new approaches.
- Prefer retrieval-led reasoning for fast-moving ecosystems and version-sensitive APIs.

## Plan before implementation
- For multi-step work, define a short implementation plan before editing.
- Identify risks, dependencies, validation gates, and rollback path up front.
- Keep scope explicit; defer non-required follow-ups rather than blending unrelated work.

## Build and verify loop
1. Implement the smallest meaningful increment.
2. Run relevant tests/validators immediately.
3. Fix failures before expanding scope.
4. Repeat until the intended behavior and contract checks are green (or explicitly blocked).

## Pre-review readiness
- Before handoff or PR review:
  - Ensure branch state and diff scope are understood.
  - Ensure required validation commands were run and recorded.
  - Ensure blocker reasons are explicit for any skipped or blocked checks.

## Enforcement
- Required baseline validation for this repository:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `bash scripts/verify-work.sh --fast`
- Use exact command evidence format:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
