# PU-026 GAP-012 Runtime-Card Trace-Out Final Best-Practices Review

## Scope
- Commit: `e9ff29e4181933446af4549c1fc427957fd47af9`
- Reviewed files only:
  - `src/lib/runtime-trace/runtime-card-trace.ts`
  - `src/commands/runtime-card.ts`
  - `src/commands/runtime-card-args.ts`
  - `src/commands/runtime-card.test.ts`
  - `ARCHITECTURE.md`
  - `docs/cli-reference.md`
  - `docs/agents/00-architecture-bootstrap.md`
  - `docs/agents/07b-agent-governance.md`
  - `.harness/implementation-notes/codex-runtime-evidence-verifier-cockpit.mdx`

## Verdict
PU-026 substantially addresses GAP-012 for a bounded, opt-in runtime-card trace lane:
- Canonical `--trace-out artifacts/agent-runs/<runId>/events.jsonl` shape is enforced at parse and runtime wiring.
- Trace persistence reuses canonical run-record primitives (`appendCanonicalEvent`, `writeCanonicalManifest`) instead of introducing a parallel writer.
- Emitted records remain explicitly advisory/audit/orientation-only in implementation and docs.

Confidence: 92% (below 95% due to regression-hardening gaps listed below).

## Findings (Severity-Ordered)

### 1) Medium - Advisory-only boundary is not directly asserted in trace regression tests
- Severity: medium
- Evidence:
  - `src/lib/runtime-trace/runtime-card-trace.ts:349` sets manifest `policyContext.mode: "advisory"`.
  - `src/lib/runtime-trace/runtime-card-trace.ts:352` sets `effectivePolicySource: "runtime-card --trace-out"`.
  - `src/commands/runtime-card.test.ts:719` onward asserts manifest schema/outcome fields, but does not assert `policyContext.mode` or prohibition semantics.
- Impacted behavior:
  - The implementation currently preserves advisory-only semantics, but tests do not pin this contract. A future refactor could accidentally drift into stronger claim semantics without failing the focused trace tests.
- Remediation:
  - Add explicit assertions in trace success/failure tests for:
    - `bundle.manifest.policyContext.mode === "advisory"`
    - `bundle.manifest.policyContext.effectivePolicySource === "runtime-card --trace-out"`
    - Optional assertion that no delivery-truth/merge-readiness claim fields are produced by this path.
- Confidence: high
- Validation ownership: introduced by current patch (missing regression guard for newly introduced contract field).

### 2) Low - Duplicate malformed-packet test case creates maintenance drift risk
- Severity: low
- Evidence:
  - `src/commands/runtime-card.test.ts:576` defines `"rejects malformed codex-runtime-evidence/v1 packets through --evidence"`.
  - `src/commands/runtime-card.test.ts:634` defines the same test title and near-identical body again.
- Impacted behavior:
  - No direct runtime bug, but duplicate tests increase maintenance overhead and can hide intent when one copy changes and the other does not.
- Remediation:
  - Remove one duplicate case or merge into a single parametrized case to keep a single source of truth.
- Confidence: high
- Validation ownership: pre-existing (not specific to trace-out logic but present in reviewed commit surface).

## Confirmed Strengths
- useful_findings: The slice enforces canonical path shape and rejects absolute/traversal/non-canonical targets (`src/lib/runtime-trace/runtime-card-trace.ts:111-134`, `src/commands/runtime-card-args.ts:90-110`).
- avoided_false_positive: No evidence that trace-out grants delivery-truth or merge-readiness authority; implementation and docs consistently classify it as advisory/orientation-only.
- evidence_quality: Direct file-and-line evidence from implementation, tests, and governance docs.
- followed_scope: Review constrained to the commit/files requested; no unrelated Project Brain surfaces reviewed.
- reusable_learning: For bounded evidence slices, add contract-pin tests for policy fields that enforce trust boundaries (advisory vs authoritative).
- coordinator_score: strong implementation slice with two targeted hardening opportunities.

## Validation Ownership Classification
- No gate/test execution was performed in this review pass (read-only assessment).
- Ownership classification for findings:
  - Finding 1: introduced by current patch.
  - Finding 2: pre-existing within scoped test file content.
- No environment/tooling failures encountered.

## Accountability Receipt
- status: completed_with_findings
- artifact_paths:
  - `artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-final-best-practices.md`
- manifest_path: `artifacts/agent-runs/best-practices-researcher-2026-05-27-pu026/manifest.json`
- findings:
  - medium: advisory-only contract not asserted in trace tests
  - low: duplicate malformed-packet test
- failures_or_blockers:
  - none
- improvement_opportunities:
  - add policyContext contract assertions to trace tests
  - deduplicate malformed-packet test block
- strengths:
  - canonical trace path enforcement
  - canonical writer reuse
  - explicit advisory-only semantics in docs + implementation
- validation_evidence:
  - `git show --name-only --oneline e9ff29e4...`
  - targeted `nl -ba` and `rg -n` evidence reads over scoped files
- next_action:
  - apply the two focused test hardening edits before claiming >95% confidence on GAP-012 closure for this slice.

WROTE: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-final-best-practices.md
