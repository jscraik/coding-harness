# Adversarial Review - PU-032/SPG-006 HILT Boundary Implementation

## Scope
- src/lib/decision-request/types.ts
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/lib/decision-request/cli.ts
- src/commands/decision-request.test.ts
- src/lib/cli/command-registry.test.ts
- src/lib/cli/registry/decision-request-command-spec.ts
- contracts/decision-request.schema.json
- contracts/examples/decision-request.example.json
- docs/cli-reference.md
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-032-spg-006-hilt-boundary-intent.json

## Depth Selection
- Depth: Standard
- Size/risk basis: targeted runtime-packet behavior change with governance/authority-boundary implications.

## Findings (Severity-ordered)

### 1) High - Claim-sensitive boundary accepts empty evidence refs from non-CLI producers
- Severity: high
- Confidence: 100
- Owner: human
- Autofix class: advisory
- Validation ownership: introduced by current patch
- Evidence:
  - [src/lib/decision-request/hilt-boundary.ts:86](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:86) only checks `input.evidenceRefs.length === 0`, so any array with one empty string passes the evidence gate.
  - [src/lib/decision-request/builder.ts:149](/Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts:149) copies `input.evidenceRefs` directly into the packet without normalizing/filtering empty strings.
  - [contracts/decision-request.schema.json:82](/Users/jamiecraik/dev/coding-harness/contracts/decision-request.schema.json:82) models `evidenceRefs.items` as `{ "type": "string" }` without `minLength`, so `[""]` is schema-valid.
- Impacted behavior:
  - Scenario chain:
  - Trigger: a non-CLI producer (test harness, script, another command adapter) submits claim-sensitive boundary (e.g., `merge_readiness`) with `evidenceRefs: [""]`, plus stale state (`freshness: "stale"` or expired status).
  - Execution path: schema accepts payload; builder passes raw refs; boundary validator sees `length > 0` and allows emission.
  - Failure outcome: packet claims claim-sensitive decision has evidence refs, but references are non-actionable, undermining the “explicit evidence refs” contract and enabling low-signal decision debt.
- Remediation:
  - Normalize and validate evidence refs in builder/hilt boundary: trim, drop empties, and fail when resulting set is empty for claim-sensitive boundaries.
  - Tighten schema with `evidenceRefs.items.minLength: 1` (or pattern-based non-empty token contract) so non-CLI producers cannot bypass.
  - Add regression tests for `evidenceRefs: [""]` and `["   "]` at builder/schema boundaries.

## Residual Risks
- Claim-sensitive validation currently depends only on “non-current staleState exists” and not on boundary-specific stale-state surfaces. This may be acceptable by design, but it means any stale marker can satisfy the gate.
- Human output prints boundary/blocker class but not evidence refs in non-JSON mode; operators may need JSON to quickly inspect evidence quality.

## Testing Gaps
- No explicit test proving claim-sensitive boundaries reject empty-string evidence refs for non-CLI build inputs.
- No schema regression test asserting `evidenceRefs` items must be non-empty strings.

## Validation Evidence Classification
- No new validation failures observed in provided command evidence.
- Prior `pnpm test:deep` blocker classification remains: environment or tooling failure (missing credential env surface / FIFO env file with no writer), not introduced by this patch.

## Accountability Receipt
- status: completed
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-adversarial.md
- findings:
  - 1 high-severity composition failure (schema + builder + boundary validator evidence-ref bypass)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - enforce normalized non-empty evidence refs across schema and builder
  - add non-CLI bypass regression tests
- strengths:
  - closed HILT boundary taxonomy enforced
  - routine uncertainty boundary rejected deterministically
  - packet remains `governance_request_only` and `not_closeout_proof`
- validation_evidence:
  - reviewed provided passing validations and scoped source/tests
- next_action:
  - patch evidence-ref normalization + schema minLength guard, then add regressions

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-adversarial.md
