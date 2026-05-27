# PU-026 GAP-012 Runtime-Card Trace-Out Re-review (Best Practices)

## Scope and Evidence
- Base commit reviewed: `e9ff29e4181933446af4549c1fc427957fd47af9`
- Patched files reviewed:
  - `src/lib/runtime-trace/runtime-card-trace.ts`
  - `src/commands/runtime-card.test.ts`
- Prior coordinator validation acknowledged:
  - `pnpm vitest run src/commands/runtime-card.test.ts` (pass, 25 tests)
- Additional evidence gathered in this re-review:
  - Line-level source inspection with `nl -ba` on both patched files.

## Findings (Severity-Ranked)

### 1) Medium: Concurrent same-`runId` start can still race before first artifact exists
- Evidence: [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:195) to [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:207)
- Impacted behavior: `assertFreshTraceTarget` rejects reuse only when `events.jsonl` or `manifest.json` already exists. Two simultaneous invocations with identical `--trace-out` can both pass this check before either writes, so mixed/interleaved writes remain theoretically possible under true concurrency.
- Remediation: Add an atomic per-`runId` lock acquisition step (for example, `open(lock, O_CREAT|O_EXCL)` or `mkdir` lock dir) before first append; fail closed if lock exists.
- Confidence: medium-high.
- Validation ownership: introduced by current patch scope (risk is in this newly added guard behavior).

### 2) Low: Trace manifest `policyContext.safetyPosture` is emitted but not pinned by regression tests
- Evidence emitted field: [src/lib/runtime-trace/runtime-card-trace.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime-trace/runtime-card-trace.ts:367)
- Evidence in tests currently pinning only subset: [src/commands/runtime-card.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/runtime-card.test.ts:707) and [src/commands/runtime-card.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/runtime-card.test.ts:754)
- Impacted behavior: A future drift/removal of `safetyPosture: "strict"` would not fail current tests, reducing contract stability for consumers expecting full advisory policy context.
- Remediation: Extend both manifest assertions to include `policyContext.safetyPosture === "strict"`.
- Confidence: high.
- Validation ownership: introduced by current patch scope (new field exists without complete pinning).

## Prior Findings Verification Status
- runId reuse fail-closed before mixed-run append: **Addressed** (reuse now rejected when artifact exists).
- concurrent same-runId risk mitigated by reuse rejection for existing artifacts: **Partially addressed** (serial reuse covered; true startup race remains as above).
- trace manifest policyContext advisory fields pinned in tests: **Partially addressed** (`mode` and `effectivePolicySource` pinned; `safetyPosture` not pinned).
- malformed evidence duplicate test removal: **Addressed** (no duplicate malformed-evidence regression observed in patched scope).
- absolute/traversal/backslash trace-out rejection regression coverage: **Addressed** ([src/commands/runtime-card.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/runtime-card.test.ts:816)).

## Confidence
- Overall confidence: **93%**
- Confidence >=95%: **No**
- Reason: concurrency race requires explicit lock semantics to fully prove same-`runId` collision safety under parallel start.

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e69d6-f66d-7673-9ee7-c6f438c51024/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-rereview-best-practices.md
- findings:
  - Medium: concurrent same-runId startup race window remains.
  - Low: `policyContext.safetyPosture` not test-pinned.
- failures_or_blockers:
  - Missing shared artifact template/contract files in this checkout for mandated format (`agents/templates/review-artifact.md`, `agents/contracts.json` not found via `rg --files`), so receipt structure was embedded directly in this artifact.
- improvement_opportunities:
  - Add atomic lock around runId creation.
  - Pin full `policyContext` contract fields in tests.
- strengths:
  - Reuse rejection now fails closed for existing run artifacts.
  - Negative path coverage for absolute/traversal/backslash `--trace-out` is present.
  - Advisory policy fields are now emitted in manifest and partially asserted.
- validation_evidence:
  - Source inspection commands:
    - `nl -ba src/lib/runtime-trace/runtime-card-trace.ts`
    - `nl -ba src/commands/runtime-card.test.ts`
  - Coordinator validation noted: `pnpm vitest run src/commands/runtime-card.test.ts` pass.
- next_action:
  - Implement atomic lock for `runId` acquisition and add one concurrent-collision regression (or deterministic lock-behavior unit test), then rerun `pnpm vitest run src/commands/runtime-card.test.ts`.

WROTE: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-rereview-best-practices.md
