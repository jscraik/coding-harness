## Agent-Native Architecture Review

### Summary
PU-026 introduces an opt-in `--trace-out` lane that emits canonical `agent-run-event/v1` events and `agent-run-manifest/v1` output through the shared run-record writer, preserving the advisory-only boundary. The implementation is directionally strong for GAP-012 and keeps delivery-truth authority out of trace output. One remaining coverage gap should be closed before calling the slice fully hardened.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Emit replay-ready runtime-card execution trace via `--trace-out` | src/commands/runtime-card.ts:156 | `harness runtime-card --trace-out ...` | Yes (CLI/docs surfaces) | Must-have | Implemented |
| Reject non-canonical trace paths | src/commands/runtime-card-args.ts:90 | `parseRuntimeCardTraceOutPath` gate | Yes | Must-have | Implemented |
| Keep trace advisory-only (not merge/closeout proof) | src/lib/runtime-trace/runtime-card-trace.ts:349 and docs/cli-reference.md:71 | Advisory policy context + docs contract | Yes | Must-have | Implemented |
| Emit failure trace after parse-time success | src/commands/runtime-card.ts:225 | `safelyRecordTraceFailure` terminal record | Yes | Should-have | Implemented |

### Findings

#### Warnings (Should Fix)
1. **Missing explicit regression tests for absolute/traversal `--trace-out` rejection paths** -- `src/lib/runtime-trace/runtime-card-trace.ts:115-118`, `src/commands/runtime-card.test.ts:786-805`
Impacted behavior: parser logic rejects absolute and traversal paths, but test coverage currently asserts only one non-canonical shape (`artifacts/runtime-card-trace-test/events.jsonl`). A future refactor could weaken security/path guarantees without detection.
Remediation: add tests for `--trace-out /abs/path/events.jsonl`, `--trace-out artifacts/agent-runs/../x/events.jsonl`, and backslash-normalized traversal cases.
Confidence: 90
Validation ownership: introduced by current patch

#### Critical (Must Fix)
1. None.

#### Observations
1. Advisory boundary is explicit and mechanically encoded through `policyContext.mode: "advisory"` and documentation language that trace output is not closeout/review/merge proof (`src/lib/runtime-trace/runtime-card-trace.ts:349-353`, `docs/cli-reference.md:71-76`).
2. Replay-readiness is correctly delegated to canonical run-record primitives (`appendCanonicalEvent`, `writeCanonicalManifest`) rather than a second ad hoc writer (`src/lib/runtime-trace/runtime-card-trace.ts:213-217`, `:329-371`).

### What's Working Well
- Canonical-only path contract is enforced both at parse time and command wiring (`src/commands/runtime-card-args.ts:102-109`, `src/commands/runtime-card.ts:86-101`).
- Trace write path is opt-in and non-invasive to existing runtime-card behavior unless `--trace-out` is present.
- Tests verify success and runtime-failure trace chains and manifest outcome classifications (`src/commands/runtime-card.test.ts:699-784`).

### Score
- **4/4 high-priority capabilities are agent-accessible**
- **Verdict:** PASS with minor hardening follow-up

## Accountability Receipt
- status: completed_with_warning
- manifest_path: artifacts/agent-runs/agent-native-reviewer-20260527T163500Z/manifest.json
- artifact_paths: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-final-agent-native.md
- findings:
  - warning: missing explicit absolute/traversal `--trace-out` regression tests
- failures_or_blockers:
  - none
- improvement_opportunities:
  - add parser-edge regression tests for absolute/traversal/backslash-normalized paths
- strengths:
  - preserves advisory-only boundary
  - reuses canonical run-record contract for replay integrity
  - trace behavior covered for success and runtime failures
- validation_evidence:
  - `git show e9ff29e4181933446af4549c1fc427957fd47af9 -- <scoped files>`
  - `nl -ba src/lib/runtime-trace/runtime-card-trace.ts`
  - `nl -ba src/commands/runtime-card.ts`
  - `nl -ba src/commands/runtime-card-args.ts`
  - `nl -ba src/commands/runtime-card.test.ts`
  - note: no local test command executed in this review pass; assessment is source-based
- next_action:
  - add targeted parser-edge tests, rerun `pnpm vitest run src/commands/runtime-card.test.ts`, then keep current semantics unchanged
- useful_findings: 1
- avoided_false_positive: did not flag advisory-only policy as missing; confirmed in code and docs
- evidence_quality: medium-high (line-referenced code + docs, no runtime execution in this pass)
- followed_scope: yes (limited to commit and listed files)
- reusable_learning: path-shape validation requires explicit edge-case regression coverage even when parser logic is present
- coordinator_score: 8/10

WROTE: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-final-agent-native.md
