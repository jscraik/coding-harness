# Adversarial Re-Review - PU-032/SPG-006 HILT Boundary Implementation

## Scope
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/lib/decision-request/types.ts
- src/commands/decision-request.test.ts
- contracts/decision-request.schema.json
- docs/cli-reference.md
- artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-adversarial.md
- artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-agent-native.md
- artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-best-practices.md

## Depth Selection
- Depth: Standard
- Size/risk basis: bounded governance packet change with claim-sensitive authority boundary behavior.

## Findings (Severity-ordered)
No material adversarial findings in the scoped rereview.

## Verification Notes
- Claim-sensitive evidence gate now trims refs before checking non-empty values (ref.trim().length > 0), so blank/whitespace-only refs do not satisfy claim-sensitive boundaries.
  - Evidence: /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:86
- Emitted packet evidence refs are normalized (trim + drop empty) before serialization.
  - Evidence: /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts:149
  - Evidence: /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts:163
- Regression tests cover claim-sensitive rejection for blank refs and packet normalization.
  - Evidence: /Users/jamiecraik/dev/coding-harness/src/commands/decision-request.test.ts:333
  - Evidence: /Users/jamiecraik/dev/coding-harness/src/commands/decision-request.test.ts:350
- Schema now rejects empty-string evidence ref items via minLength: 1.
  - Evidence: /Users/jamiecraik/dev/coding-harness/contracts/decision-request.schema.json:82
- CLI docs now enumerate accepted HILT taxonomy and claim-sensitive stale-state/evidence rule.
  - Evidence: /Users/jamiecraik/dev/coding-harness/docs/cli-reference.md:152

## Residual Risks
- Schema-level evidence ref validation does not trim whitespace, so externally produced packets validated only against schema could still carry whitespace-only refs (while builder output remains normalized). This is a low-severity contract-quality risk, not a re-opened claim-sensitive bypass in the builder path.
- Claim-sensitive stale-state acceptance remains intentionally broad (any non-current stale marker), which may admit low-specificity stale-state reasons unless future policy narrows accepted surfaces.

## Testing Gaps
- No direct contract test was observed for schema-level whitespace-only evidence refs (for example "   ") outside builder-mediated emission.

## Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6d17-ffa9-72a1-860a-ecf70006237a/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-adversarial-rereview.md
- findings:
  - none (prior high-severity evidence-ref bypass is fixed in reviewed surfaces)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - consider schema pattern guard to reject whitespace-only evidence refs for producer-agnostic strictness
  - consider boundary-specific stale-state surface constraints if policy requires tighter claim-sensitive semantics
- strengths:
  - claim-sensitive gate blocks blank/whitespace evidence refs
  - emitted packets normalize evidence refs deterministically
  - schema and docs now align with runtime boundary taxonomy and claim-sensitive requirements
  - regression tests cover the previously exploitable path
- validation_evidence:
  - /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/hilt-boundary.ts:86
  - /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts:149
  - /Users/jamiecraik/dev/coding-harness/src/lib/decision-request/builder.ts:163
  - /Users/jamiecraik/dev/coding-harness/src/commands/decision-request.test.ts:333
  - /Users/jamiecraik/dev/coding-harness/src/commands/decision-request.test.ts:350
  - /Users/jamiecraik/dev/coding-harness/contracts/decision-request.schema.json:82
  - /Users/jamiecraik/dev/coding-harness/docs/cli-reference.md:152
- next_action:
  - coordinator may treat this adversarial rereview lane as cleared for the original finding; optional hardening follow-up can tighten whitespace semantics at schema boundary

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-adversarial-rereview.md
