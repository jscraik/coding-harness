# Adversarial Review - PU-025 / GAP-005 Decision-Request Governance

STATUS: complete

## Scope
- src/lib/decision-request/**
- src/commands/decision-request.ts
- src/commands/decision-request.test.ts
- src/lib/cli/registry/decision-request-command-spec.ts
- src/lib/cli/registry/command-specs-core.ts
- src/lib/cli/registry/command-capability-rules.ts
- src/lib/cli/command-registry.test.ts
- contracts/decision-request.schema.json
- contracts/examples/decision-request.example.json
- contracts/runtime-packet-schemas.manifest.json
- scripts/validate-runtime-packet-schemas.cjs
- src/dev/validate-runtime-packet-schemas-script.test.ts
- README.md
- docs/cli-reference.md
- ARCHITECTURE.md
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json

## Findings (severity-ranked)
No blocker-level adversarial findings identified in scoped files.

## Residual Risks
- Low: CLI scalar flags use first-occurrence semantics (`inspectFlagValue`), so repeated conflicting scalar flags can be misread by users who expect last-wins behavior. This is a UX/operational ambiguity rather than a direct governance bypass because invalid values still fail closed at the builder boundary.
  - Evidence: src/lib/cli/parse-utils.ts:143
  - Validation ownership: pre-existing parser contract

### Coordinator Resolution

Resolved in this slice after review: `decision-request` now rejects repeated scalar flags with `decision-request.scalar_flag_duplicate` before builder execution, and the behavior is covered by `src/commands/decision-request.test.ts`.

## Testing Gaps
- The duplicate scalar flag gap found during review was closed by adding a regression test for repeated `--intent`. Existing tests also cover explicit fail-closed paths requested by intent (duplicate options, unknown tradeoff id, malformed/blank escalation fields, invalid dates/authority/status/freshness).

## Evidence Notes
- Registry reachability is present and tested for `decision-request` command dispatch.
  - Evidence: src/lib/cli/registry/command-specs-core.ts:119; src/lib/cli/command-registry.test.ts:96
- Governance-only boundaries are encoded as packet consts and schema consts.
  - Evidence: src/lib/decision-request/builder.ts:141
  - Evidence: contracts/decision-request.schema.json
- Fail-closed checks for required intent/default option/options, option duplicates, unknown tradeoff option IDs, invalid status/freshness/authority/datetime, and blank escalation fields are implemented in the deep module.
  - Evidence: src/lib/decision-request/builder.ts:69
  - Evidence: src/lib/decision-request/cli.ts:19
  - Evidence: src/commands/decision-request.test.ts:90

## Accountability Receipt
- status: complete
- manifest_path: n/a (coordinator did not provide run-id-specific manifest target)
- artifact_paths: artifacts/reviews/pu-025-gap-005-decision-request-governance-final-adversarial.md
- findings:
  - useful_findings: 0 blocker findings; 1 low-severity residual operational ambiguity
  - avoided_false_positive: did not flag closeout-proof escalation because packet const/schema const enforce governance-only intent
  - evidence_quality: medium-high (line-level code and contract evidence; no runtime rerun in this pass)
- failures_or_blockers:
  - missing_template_contract_paths: `agents/templates/review-artifact.md` and `agents/contracts.json` were not found in this checkout, so artifact used the required fields directly without template expansion
- improvement_opportunities:
  - add explicit parser contract test for duplicate scalar flags to prevent semantic drift
- strengths:
  - deep-module split preserved (`src/lib/decision-request/*` owns validation/emission logic)
  - registry command wiring and capability metadata include decision-request handoff availability
  - runtime packet manifest updated to emitted state with parity validator entry
- validation_evidence:
  - reviewed provided command outcomes (tests/schema validation/CLI smoke) and verified code paths for each required fail-closed condition
- next_action:
  - optional: add one regression test to lock duplicate-scalar-flag semantics (first-wins vs last-wins) and document behavior if intentional
- coordinator_score: 0.93
- followed_scope: true
- reusable_learning: fail-closed governance packets are strongest when both builder logic and schema constants enforce non-closeout use

WROTE: artifacts/reviews/pu-025-gap-005-decision-request-governance-final-adversarial.md
