# PU-019 GAP-008 Context Health Architecture Lens

## Scope

- Lifecycle slice: PU-019 / GAP-008 context-health agent-readiness projection.
- Role: improve-codebase-architecture.
- Files reviewed:
  - `src/lib/agent-readiness/context-health.ts`
  - `src/lib/agent-readiness/types.ts`
  - `src/lib/agent-readiness/checker.ts`
  - `src/lib/agent-readiness/cli.ts`
  - `src/commands/agent-readiness.test.ts`
  - `.harness/active-artifacts.md`

## Verdict

Status: pass.

The implementation keeps the new context-health behavior inside the existing agent-readiness deep module instead of creating a second cockpit or duplicating the canonical `context-health-report/v1` engine. The main interface is `buildContextHealthProjection(repoRoot)`, and callers get one compact advisory projection through `AgentReadinessReport.contextHealth`.

## Evidence

- `src/lib/agent-readiness/context-health.ts:34` builds the advisory projection with schema `agent-readiness-context-health/v1`.
- `src/lib/agent-readiness/context-health.ts:48` points at the canonical deep `context-health-report/v1` command instead of embedding its artifact-grade fields.
- `src/lib/agent-readiness/checker.ts:41` wires the projection once into the existing readiness report path.
- `src/lib/agent-readiness/types.ts:84` documents the projection as advisory context-health metadata.
- `src/commands/agent-readiness.test.ts:325` proves the projection does not add canonical context-health report fields such as artifact refs, metrics, contradiction history, or inventory metrics.

## Findings

No blocking architecture findings in the current scoped diff.

The earlier per-surface external-horizon recommendation risk was fixed before this artifact: `external_horizon` no longer recommends local `context-health --json` as if it refreshed PR/CI/Linear/CodeRabbit truth. The current design preserves separate local context-integrity and external-state responsibilities.

The later reviewer finding about hardcoded active-route path prefixes was also fixed in the implementation: active-route parsing now accepts safe repo-relative backtick paths beyond the original prefix list while rejecting absolute, traversal, URL, backslash, and shell-operator tokens.

## Validation Ownership

- Current patch: owns the new projection, surface classification, and regression tests.
- Later slices: own external-state snapshot production and delivery-claim support.
- Pre-existing: live PR/CI/Linear/CodeRabbit truth is not available to this local projection.

## Validation Evidence

- Command: `pnpm vitest run src/commands/agent-readiness.test.ts` -> pass (18 tests).
- Command: `node_modules/.bin/biome check src/lib/agent-readiness/context-health.ts src/lib/agent-readiness/cli.ts src/commands/agent-readiness.test.ts .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json` -> pass.
- Command: `git diff --check -- src/lib/agent-readiness/context-health.ts src/lib/agent-readiness/cli.ts src/commands/agent-readiness.test.ts .harness/active-artifacts.md .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json` -> pass.

## Residual Risk

Runtime-card and external-horizon absence remain orientation warnings only. That is correct for PU-019, but the later runtime-card and external-state slices must provide artifact producers before these warnings can become stronger delivery evidence.
