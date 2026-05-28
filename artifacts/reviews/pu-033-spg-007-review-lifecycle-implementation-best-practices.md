# Review Artifact: PU-033 SPG-007 ReviewLifecycle/v1 (Implementation Best Practices)

## Scope
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-033-spg-007-review-lifecycle-intent.json
- contracts/runtime-packet-schemas.manifest.json
- contracts/review-lifecycle.schema.json
- contracts/examples/review-lifecycle.example.json
- scripts/validate-review-lifecycle.cjs
- src/dev/validate-runtime-packet-schemas-script.test.ts
- src/lib/review-state/index.ts
- src/lib/review-state/review-lifecycle.ts
- src/lib/review-state/review-lifecycle.test.ts

## Findings (severity-ranked)

### 1) Severity: medium - Standalone semantic validator misses lineage-to-covered-role binding parity
- Evidence:
  - TS validator enforces lineage binding for covered roles in [src/lib/review-state/review-lifecycle.ts:588](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:588) through [src/lib/review-state/review-lifecycle.ts:603](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:603).
  - CLI semantic validator does not enforce the same rule in [scripts/validate-review-lifecycle.cjs:255](/Users/jamiecraik/dev/coding-harness/scripts/validate-review-lifecycle.cjs:255) through [scripts/validate-review-lifecycle.cjs:278](/Users/jamiecraik/dev/coding-harness/scripts/validate-review-lifecycle.cjs:278).
  - Repro command (executed): mutate the example so `coverage.coveredRoles=["missing-role"]` with unchanged `artifactLineage`; `node scripts/validate-review-lifecycle.cjs` returns pass (`EXIT:0`).
- Impacted behavior:
  - The semantic validator can certify packets where claimed covered roles are not backed by lineage artifacts. This weakens parity guarantees between schema+semantic CLI validation and runtime TS validation.
- Remediation:
  - Add a lineage role-set check in `scripts/validate-review-lifecycle.cjs` mirroring TS logic: each `coveredRoles[]` entry must appear in `artifactLineage[].role`.
  - Add a dedicated negative test in [src/dev/validate-runtime-packet-schemas-script.test.ts](/Users/jamiecraik/dev/coding-harness/src/dev/validate-runtime-packet-schemas-script.test.ts) that patches review-lifecycle example similarly and expects semantic-validator failure.
- Confidence: high
- Validation ownership: introduced_by_current_patch

## Residual risks (non-blocking)
- Forged independence is still only syntactic:
  - Current checks enforce `role === producer`, receipt producer/ref/head, and non-empty manifest ref, but cannot cryptographically prove artifact provenance ownership. This is expected for this slice but remains a trust-boundary risk if used outside orientation/audit mode.
  - Evidence in [src/lib/review-state/review-lifecycle.ts:473](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:473) through [src/lib/review-state/review-lifecycle.ts:557](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.ts:557) and matching schema fields in [contracts/review-lifecycle.schema.json:321](/Users/jamiecraik/dev/coding-harness/contracts/review-lifecycle.schema.json:321) through [contracts/review-lifecycle.schema.json:340](/Users/jamiecraik/dev/coding-harness/contracts/review-lifecycle.schema.json:340).

## Strengths observed
- Orientation-only boundary is explicitly preserved:
  - Contract language in [contracts/review-lifecycle.schema.json:5](/Users/jamiecraik/dev/coding-harness/contracts/review-lifecycle.schema.json:5), plus runtime status `not_yet_emitted` and non-authoritative evidence-use modes.
- Self-certified/implementation-produced artifacts are actively rejected in TS validator tests:
  - See [src/lib/review-state/review-lifecycle.test.ts:130](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.test.ts:130) through [src/lib/review-state/review-lifecycle.test.ts:150](/Users/jamiecraik/dev/coding-harness/src/lib/review-state/review-lifecycle.test.ts:150).
- Manifest wiring includes semantic validator hook:
  - [contracts/runtime-packet-schemas.manifest.json:130](/Users/jamiecraik/dev/coding-harness/contracts/runtime-packet-schemas.manifest.json:130) through [contracts/runtime-packet-schemas.manifest.json:138](/Users/jamiecraik/dev/coding-harness/contracts/runtime-packet-schemas.manifest.json:138).

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/best-practices-researcher-2026-05-28T10-15-00Z/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-best-practices.md
- findings:
  - 1 medium-severity parity gap between TS validator and standalone semantic validator (coveredRoles lineage binding).
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness|task:pu-033-spg-007-review-lifecycle" --json` failed with `failed to write PID file: /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`.
  - blocked_local_memory_cli: `local-memory search "review lifecycle validator parity semantic validator" --session_filter_mode all --json` failed with same PID write permission error.
- improvement_opportunities:
  - Add semantic parity test case for coveredRoles/artifactLineage mismatch.
  - Keep semantic validator logic centralized or generated from TS rules to reduce drift.
- strengths:
  - Clear orientation-only/non-authoritative contract.
  - Good TS-level negative coverage for stale mode, unresolved threads, zero-byte artifacts, head mismatch, raw/sensitive field rejection, and unknown top-level keys.
- validation_evidence:
  - Direct source inspection with line-level evidence.
  - Repro command showing semantic CLI false-positive pass on coveredRoles/artifactLineage mismatch.
- next_action:
  - Patch `scripts/validate-review-lifecycle.cjs` to enforce covered-role lineage parity and add regression in `src/dev/validate-runtime-packet-schemas-script.test.ts`.
- useful_findings: true
- avoided_false_positive: true (no unsupported authority-promotion finding; orientation/audit boundary is explicit in contract and tests)
- evidence_quality: high
- followed_scope: true
- reusable_learning: semantic validators should mirror TS cross-field invariants or be fixture-validated against the same negative corpus
- coordinator_score: 0.87

WROTE: artifacts/reviews/pu-033-spg-007-review-lifecycle-implementation-best-practices.md
