# PU-035 / SPG-009 Best-Practices Review (ArtifactRuntimeSurface/v1) - Re-review

## Scope
- src/lib/artifact-runtime-surface/**
- scripts/validate-artifact-runtime-surface.cjs
- contracts/artifact-runtime-surface.schema.json
- contracts/examples/artifact-runtime-surface.example.json
- contracts/fixtures/artifact-runtime-surface-reviewable.md
- contracts/runtime-packet-schemas.manifest.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- AGENTS.md
- ARCHITECTURE.md
- docs/agents/00-architecture-bootstrap.md
- docs/agents/07b-agent-governance.md
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json

## Final status
No material findings remain in the reviewed slice.

The previously reported high-severity gap (standalone CJS validator accepting unknown fields) is now addressed with explicit known-key checks and regression coverage. Additional hardening for live-HEAD matching in claim-support mode and expanded secret-like value detection is present and validated.

## Verification evidence
- `pnpm vitest run src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass (36 tests)
- `node scripts/validate-artifact-runtime-surface.cjs contracts/examples/artifact-runtime-surface.example.json --repo-root .` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass (`packetCount: 16`)

## Validation ownership classification
- Gate failures observed in this re-review: none
- Ownership: n/a

## Accountability receipt
- status: completed_no_findings
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e6ece-c831-7d80-a595-7e8ca44b80a5/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-best-practices.md
- findings:
  - none
- failures_or_blockers:
  - none
- improvement_opportunities:
  - optional: add one explicit CJS regression for unknown keys under `lineage.verifierRefs[*]` and `blockers[*]` to pin nested-key fail-closed behavior already implemented
- strengths:
  - schema, TypeScript validator, standalone semantic validator, manifest registration, and tests are aligned
  - claim-support current-head and filesystem containment protections are enforced in the standalone path
  - fixture strategy (audit_trail checked-in example + runtime claim-support synthesis in tests) avoids head-drift brittleness
- validation_evidence:
  - commands listed above with passing outputs
- useful_findings:
  - 0
- avoided_false_positive:
  - re-ran direct validator and test suite before closeout
- evidence_quality:
  - high
- followed_scope:
  - yes
- reusable_learning:
  - for contract-only packets with semantic validators, keep direct-script fail-closed checks and fixture strategy separate from live-head claim-support assertions
- coordinator_score:
  - strong remediation response; prior blocker resolved
- next_action:
  - proceed with coordinator closeout for this reviewer lane

WROTE: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-best-practices.md
