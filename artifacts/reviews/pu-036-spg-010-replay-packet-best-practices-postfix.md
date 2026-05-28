# PU-036 / SPG-010 ReplayPacket Best-Practices Postfix Review

## Scope
- Focused re-check for prior warning only: TS/CJS ReplayPacket semantic validator drift risk.
- Reviewed:
  - src/dev/validate-runtime-packet-schemas-script.test.ts
  - src/lib/replay/replay-packet.ts
  - scripts/validate-replay-packet.cjs
  - src/lib/replay/replay-packet.test.ts
- No source edits performed.

## Decision
- Previous warning status: resolved.

## Findings (severity-ranked)
- No remaining material gaps found in the previously flagged area.
- The patch now includes dual-validator negative parity coverage that exercises both validators on the same invalid packets and asserts aligned failures.

## Evidence
- New parity checks present and targeted:
  - [src/dev/validate-runtime-packet-schemas-script.test.ts] lines 130-151: invalid `replayKind` fails both TypeScript and CJS validators.
  - [src/dev/validate-runtime-packet-schemas-script.test.ts] lines 153-192: stale orientation contradiction fails both validators with matching semantic error classes.
- Validation commands rerun and passing:
  - `pnpm -s vitest src/dev/validate-runtime-packet-schemas-script.test.ts src/lib/replay/replay-packet.test.ts src/lib/pr-template-validator.test.ts src/commands/pr-template-gate.test.ts` -> pass (4 files, 100 tests).
  - `node scripts/validate-replay-packet.cjs contracts/examples/replay-packet.example.json --repo-root .` -> pass.
  - `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass.
  - `pnpm -s typecheck` -> pass.

## Validation ownership classification
- introduced by current patch: none failing
- pre-existing: none observed
- unrelated dirty worktree: none observed in this lane
- environment/tooling failure: none observed

## Accountability receipt
- status: complete
- artifact_paths:
  - artifacts/reviews/pu-036-spg-010-replay-packet-best-practices-postfix.md
- findings:
  - prior drift-risk warning resolved by dual-validator negative parity tests
- failures_or_blockers:
  - none
- improvement_opportunities:
  - optional future hardening: add one digest-mismatch dual-validator parity case to complement replayKind and stale-orientation cases
- strengths:
  - direct replay-semantic parity assertions now span both validator implementations
  - check suite includes schema-manifest and typecheck coverage
- validation_evidence:
  - pnpm -s vitest src/dev/validate-runtime-packet-schemas-script.test.ts src/lib/replay/replay-packet.test.ts src/lib/pr-template-validator.test.ts src/commands/pr-template-gate.test.ts
  - node scripts/validate-replay-packet.cjs contracts/examples/replay-packet.example.json --repo-root .
  - node scripts/validate-runtime-packet-schemas.cjs --all
  - pnpm -s typecheck
- next_action:
  - coordinator can treat prior warning as closed for PU-036/SPG-010
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e6f1e-6a54-7121-94f6-d247fc86e8e5/manifest.json
- useful_findings: negative parity now covers semantic mismatch classes across both validator implementations
- avoided_false_positive: did not reopen warning after confirming concrete parity tests and green validation evidence
- evidence_quality: high
- followed_scope: yes
- reusable_learning: when semantic validator logic is duplicated, add dual-run invalid-fixture tests in the runtime packet schema script suite
- coordinator_score: 0.96

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-best-practices-postfix.md
