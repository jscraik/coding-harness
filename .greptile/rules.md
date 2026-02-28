# Greptile repository rules for coding-harness

## Table of Contents
- [Review objective](#review-objective)
- [What to prioritize](#what-to-prioritize)
- [Repository-specific checks](#repository-specific-checks)
- [Commenting guidance](#commenting-guidance)

## Review objective
Prioritize correctness and merge safety for a TypeScript control-plane repository with policy-driven workflows.

## What to prioritize
1. Contract and policy correctness over style nits.
2. Deterministic behavior and explicit validation evidence.
3. Clear, minimal diffs that keep rollback simple.

## Repository-specific checks
- Local ESM imports must keep `.js` suffixes in relative import paths.
- `pnpm` is the canonical package manager for commands and docs.
- Behavior changes should keep required gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm check`.
- PR workflow expectations from `AGENTS.md` and `CONTRIBUTING.md` apply for merge readiness.

## Commenting guidance
- Treat functional regressions, policy-contract mismatches, security issues, and CI breakages as actionable.
- Mark purely cosmetic preferences as informational unless they violate explicit repository policy.
