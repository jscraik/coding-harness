# Adversarial Re-Review: PU-032 / SPG-006 HILT Boundary (Post-Semantic Validator)

## Scope
- scripts/validate-decision-request.cjs
- scripts/validate-runtime-packet-schemas.cjs
- contracts/runtime-packet-schemas.manifest.json
- contracts/decision-request.schema.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/commands/decision-request.test.ts
- docs/cli-reference.md

## Findings (severity-ranked)
No material adversarial findings in scoped changes.

## Answers To Requested Questions
1. Prior external packet semantic-bypass finding fixed: **Yes (within scoped enforcement path).**
- Evidence: decision-request entries now require both schema and semantic validation through manifest wiring and script execution in scripts/validate-runtime-packet-schemas.cjs:561 and scripts/validate-runtime-packet-schemas.cjs:571.
- Evidence: semantic validator enforces claim-sensitive HILT constraints for externally supplied packets in scripts/validate-decision-request.cjs:128.
- Evidence: manifest includes semantic validator mapping for decision-request in contracts/runtime-packet-schemas.manifest.json:75.

2. Runtime and external packet validation materially aligned for claim-sensitive HILT boundaries: **Yes.**
- Builder-side boundary validation requires real HILT boundary plus claim-sensitive evidence and non-current state in src/lib/decision-request/hilt-boundary.ts:42 and src/lib/decision-request/hilt-boundary.ts:82.
- External packet path now enforces equivalent constraints via semantic validator invoked by runtime packet schema validator in scripts/validate-runtime-packet-schemas.cjs:561.
- Contract-level shape now requires hiltBoundary and non-empty evidenceRef items in contracts/decision-request.schema.json:23 and contracts/decision-request.schema.json:82.

3. Remaining material gaps in scoped implementation: **None identified at material severity.**

## Residual Risks
- The semantic validator currently runs through manifest/example validation and depends on that lane being executed in CI/local gates; if teams bypass validate-runtime-packet-schemas, semantic guarantees are not enforced at arbitrary packet ingestion points.
- The semantic validator asserts hiltBoundary.reason equals intent exactly; this is strict and correct for integrity, but future producer diversity may require explicit normalization policy to avoid false negatives across sources.

## Validation Evidence
- node scripts/validate-runtime-packet-schemas.cjs --all -> pass (13 packets, 0 errors)
- pnpm -s vitest run src/dev/validate-runtime-packet-schemas-script.test.ts src/commands/decision-request.test.ts -> pass (2 files, 29 tests)

## Accountability Receipt
- status: complete
- manifest_path: artifacts/agent-runs/adversarial-reviewer-pu-032-spg-006-post-semantic/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-post-semantic-adversarial.md
- findings:
  - none
- failures_or_blockers:
  - none
- improvement_opportunities:
  - Add an integration assertion in any downstream packet-consumer path (if introduced) that reuses the same semantic validator contract to prevent drift from manifest-only coverage.
- strengths:
  - Closed the schema-valid semantic-bypass class by combining schema and semantic enforcement and adding targeted regression coverage.
- validation_evidence:
  - node scripts/validate-runtime-packet-schemas.cjs --all
  - pnpm -s vitest run src/dev/validate-runtime-packet-schemas-script.test.ts src/commands/decision-request.test.ts
- next_action:
  - Coordinator can mark this adversarial lane as satisfied for the scoped fix and proceed with cross-review synthesis.

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-post-semantic-adversarial.md
