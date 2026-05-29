# PU-036 SPG-010 ReplayPacket/v1 Simplify Lens

Status: pass

Scope reviewed:
- src/lib/replay/replay-packet.ts
- scripts/validate-replay-packet.cjs
- src/lib/pr-template-validator.ts
- src/lib/pr-template-validator.test.ts

Findings:
- No simplification changes are required before closeout.
- ReplayPacket/v1 is intentionally narrow: src/lib/replay/replay-packet.ts lines 5-15 has a closed ref-kind union, lines 27-110 keep one packet type, and lines 117-120 keep validation output to pass/fail plus errors. That is sufficient for the current fixture lane without adding an orchestration layer.
- The CJS validator duplicates semantic checks for CLI portability, but that duplication is justified because contracts/runtime-packet-schemas.manifest.json needs a standalone semantic validator and the TypeScript validator is covered separately by src/dev/validate-runtime-packet-schemas-script.test.ts.
- The linked-issue guard change is small and localized to src/lib/pr-template-validator.ts lines 179-210 and src/lib/pr-template-validator.test.ts lines 69-95.

Validation ownership classification:
- Introduced by current patch: none.
- Pre-existing: none observed within scope.
- Unrelated dirty worktree: unrelated untracked project-brain files remain outside this slice.
- Environment or tooling failure: none observed.

Validation evidence:
- pnpm vitest run src/lib/pr-template-validator.test.ts src/commands/pr-template-gate.test.ts --reporter=dot -> pass
- bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file artifacts/pr-body/pr-310.md --json -> pass
- pnpm typecheck -> pass

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-simplify.md
