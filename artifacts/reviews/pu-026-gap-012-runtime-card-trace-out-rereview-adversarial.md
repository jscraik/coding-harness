# PU-026 GAP-012 Adversarial Re-review (Runtime Card Trace Out)

## Scope
- Base commit: `e9ff29e4181933446af4549c1fc427957fd47af9`
- Patched files reviewed:
  - `src/lib/runtime-trace/runtime-card-trace.ts`
  - `src/commands/runtime-card.test.ts`
- Prior findings explicitly re-checked:
  1. runId reuse fail-closed before mixed-run append
  2. same-runId concurrent risk mitigation via reuse rejection when artifacts exist
  3. manifest `policyContext` advisory fields pinned in tests
  4. malformed evidence duplicate test removed
  5. absolute/traversal/backslash `--trace-out` rejection regression coverage

## Depth Selection
- Depth: **Standard**
- Rationale: targeted patch with runtime artifact IO and path validation behavior; adversarial focus on assumption violation + composition failure + abuse cases.

## Findings (severity-ranked)
- No material remaining adversarial findings in this patch slice.

## Evidence Checks
1. **Reuse fail-closed before append is enforced**
- Trigger scenario: second invocation reuses `artifacts/agent-runs/runtime-card-reused-trace/events.jsonl`.
- Code path: `createRuntimeCardTraceRecorder` -> `createTraceState` -> `assertFreshTraceTarget` throws if either events or manifest already exists.
- Evidence:
  - `src/lib/runtime-trace/runtime-card-trace.ts:150-186`
  - `src/commands/runtime-card.test.ts:775-814`
- Outcome: second run fails with explicit error and prior event chain remains unchanged.

2. **Concurrent/same-runId abuse is reduced by existing-artifact guard**
- Trigger scenario: later invocation with same runId after first writer emits artifacts.
- Code path: existing file check rejects reused runId.
- Evidence:
  - `src/lib/runtime-trace/runtime-card-trace.ts:177-186`
  - `src/commands/runtime-card.test.ts:782-814`
- Outcome: guard blocks cross-run append corruption once any canonical artifact exists.

3. **Manifest advisory policy context is pinned**
- Evidence:
  - Manifest sets `mode: \"advisory\"`, `safetyPosture: \"strict\"`, `effectivePolicySource: \"runtime-card --trace-out\"` at `src/lib/runtime-trace/runtime-card-trace.ts:345-349`.
  - Assertions present for success and failure manifests:
    - `src/commands/runtime-card.test.ts:707-710`
    - `src/commands/runtime-card.test.ts:754-757`
- Outcome: policy-context drift now has explicit regression pressure.

4. **Malformed evidence duplicate test**
- Evidence: exactly one malformed `codex-runtime-evidence/v1` rejection test found.
  - `src/commands/runtime-card.test.ts:576-599`
- Outcome: duplicate malformed-evidence case appears removed from this test file.

5. **Invalid path rejection regression coverage**
- Evidence: explicit matrix includes absolute, posix traversal, backslash traversal, and non-canonical directory; asserts usage error and no trace emission target created.
  - `src/commands/runtime-card.test.ts:816-854`
- Outcome: path normalization and traversal edge cases are now guarded by regression tests.

## Residual Risks
- A true simultaneous first-write race (two processes with same runId starting before either file exists) is still theoretically possible with filesystem check-then-write semantics. This is outside the requested finding set and would require lock/atomic-create strategy to eliminate fully.

## Confidence
- **>=95% confidence** for the requested five finding closures in this slice.
- No further material improvements identified inside the scoped patch set.

## Accountability Receipt
- status: complete
- artifact_paths:
  - artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-rereview-adversarial.md
- manifest_path: n/a (single-review artifact lane; no run manifest contract file provided in repo scope)
- findings: none material remaining
- failures_or_blockers: none
- improvement_opportunities:
  - optional future hardening: atomic lockfile or O_EXCL create for first-writer same-runId races
- strengths:
  - fail-closed runId reuse guard is placed before recorder event appends
  - policyContext contract is now test-pinned on both success and failure
  - trace-out path validation now includes traversal/backslash abuse coverage
- validation_evidence:
  - static source inspection of patched files and related tests
  - prior coordinator test run noted: `pnpm vitest run src/commands/runtime-card.test.ts` passing
- next_action:
  - coordinator can treat adversarial re-review of listed prior findings as closed for PU-026 GAP-012

WROTE: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-rereview-adversarial.md
