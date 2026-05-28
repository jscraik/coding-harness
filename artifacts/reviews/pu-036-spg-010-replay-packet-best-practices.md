# PU-036 / SPG-010 ReplayPacket Best-Practices Review

## Scope
- Reviewed only the requested files:
  - src/lib/replay/replay-packet.ts
  - src/lib/replay/replay-packet.test.ts
  - scripts/validate-replay-packet.cjs
  - contracts/replay-packet.schema.json
  - contracts/examples/replay-packet.example.json
  - contracts/runtime-packet-schemas.manifest.json
  - src/dev/validate-runtime-packet-schemas-script.test.ts
  - AGENTS.md
  - ARCHITECTURE.md
  - README.md
  - docs/agents/00-architecture-bootstrap.md
  - docs/agents/07b-agent-governance.md
  - docs/agents/04-validation.md
  - src/lib/pr-template-validator.ts
  - src/lib/pr-template-validator-rules.ts
  - src/lib/pr-template-validator.test.ts

## Findings (severity-ranked)
- No blocking findings in reviewed scope.

## Validation ownership classification
- No gate failures observed during this review run.
- Classification summary:
  - introduced by current patch: none observed
  - pre-existing: none observed in executed checks
  - unrelated dirty worktree: not observed in executed checks
  - environment/tooling failure: none observed

## Evidence
- Replay semantic validator passes checked-in example:
  - command: `node scripts/validate-replay-packet.cjs contracts/examples/replay-packet.example.json`
  - outcome: pass (exit 0)
- Targeted tests pass:
  - command: `pnpm -s vitest src/lib/replay/replay-packet.test.ts src/lib/pr-template-validator.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts`
  - outcome: pass (3 files, 88 tests)

## Best-practices assessment
- Schema hardening and semantic validator layering are aligned:
  - JSON schema uses `additionalProperties: false` and required fields for packet sub-objects ([contracts/replay-packet.schema.json] lines 6-31, 131-314).
  - Semantic validator enforces repo-relative path safety, digest verification, and no-raw/no-secret constraints ([src/lib/replay/replay-packet.ts] lines 591-625, 627-643; [scripts/validate-replay-packet.cjs] lines 404-436, 493-510).
- Replay safety boundaries are explicit and consistently documented:
  - Governance/docs state replay packet is orientation/audit only and cannot be claim-support ([AGENTS.md] patch hunk; [README.md] replay section; [docs/agents/00-architecture-bootstrap.md] replay section; [docs/agents/07b-agent-governance.md] replay section).
  - Runtime manifest keeps replay packet in `not_yet_emitted` state with explicit blocker metadata ([contracts/runtime-packet-schemas.manifest.json] lines 163-171).
- PR acceptance-trace guard tightened consistently:
  - Rule adds explicit preparatory + “no completed acceptance IDs” requirement ([src/lib/pr-template-validator-rules.ts] lines 47-48, [src/lib/pr-template-validator.ts] lines 198-210).
  - Tests cover fail/fail/pass matrix for linked issue acceptance trace ([src/lib/pr-template-validator.test.ts] lines 69-98).
  - Validation docs updated to match wording ([docs/agents/04-validation.md] line 126).

## Residual risks / improvement opportunities
- Medium confidence residual: TypeScript validator and CJS semantic validator duplicate substantial logic; current parity check validates only the example fixture path, not broad behavioral equivalence. Consider adding a shared fixture matrix (invalid-path, digest mismatch, stale orientation, raw-key leakage) executed against both validators to reduce drift risk over time.
  - evidence: duplicated validation logic across [src/lib/replay/replay-packet.ts] and [scripts/validate-replay-packet.cjs]; current runtime packet schema script test adds replay example parity but not adversarial parity cases ([src/dev/validate-runtime-packet-schemas-script.test.ts] lines 98-108).

## Accountability receipt
- status: complete
- artifact_paths:
  - artifacts/reviews/pu-036-spg-010-replay-packet-best-practices.md
- findings:
  - none blocking
  - one residual improvement opportunity (validator drift risk from duplicated logic)
- failures_or_blockers:
  - Missing requested template path: `agents/templates/review-artifact.md` not found in this checkout; used equivalent structured artifact format instead.
- improvement_opportunities:
  - Add dual-validator adversarial fixture matrix for replay packet semantic rules.
- strengths:
  - Strong contract boundary language across governance surfaces.
  - Defense-in-depth validation (schema + semantic checks + tests).
  - Explicit not-yet-emitted manifest contract with owner gap and blockedBy.
- validation_evidence:
  - `node scripts/validate-replay-packet.cjs contracts/examples/replay-packet.example.json` (pass)
  - `pnpm -s vitest src/lib/replay/replay-packet.test.ts src/lib/pr-template-validator.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts` (pass)
- next_action:
  - Coordinator may choose whether to treat the validator-parity matrix as follow-up scope now or track as a non-blocking hardening task.
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e6f1e-6a54-7121-94f6-d247fc86e8e5/manifest.json
- useful_findings: replay packet boundary is consistently non-authoritative; linked-issue acceptance trace guard now rejects ambiguous preparatory claims.
- avoided_false_positive: did not flag stale-audit behavior as bug because explicit stale-state/blocker requirement is implemented and tested.
- evidence_quality: high for reviewed scope (line-level inspection + command evidence).
- followed_scope: yes (restricted to requested files).
- reusable_learning: future runtime packet additions should include dual-path (TS + CJS) adversarial parity fixtures.
- coordinator_score: 0.90

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-best-practices.md
