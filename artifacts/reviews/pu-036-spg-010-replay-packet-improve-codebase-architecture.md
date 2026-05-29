# PU-036 SPG-010 ReplayPacket/v1 Architecture Lens

Status: pass

Scope reviewed:
- src/lib/replay/replay-packet.ts
- scripts/validate-replay-packet.cjs
- contracts/replay-packet.schema.json
- contracts/examples/replay-packet.example.json
- contracts/runtime-packet-schemas.manifest.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- src/lib/pr-template-validator.ts
- src/lib/pr-template-validator-rules.ts
- src/lib/pr-template-validator.test.ts

Findings:
- No blocking architecture findings.
- Deep-module placement is appropriate: the public TypeScript surface stays in src/lib/replay/replay-packet.ts with typed packet, options, result, and validator exports at lines 5-120, while the standalone semantic CLI validator lives in scripts/validate-replay-packet.cjs lines 148-174 for manifest/CI usage.
- The packet remains contract-only and does not blur delivery authority: src/lib/replay/replay-packet.ts lines 27-110 define runtimeStatus as "not_yet_emitted" and evidenceUse as orientation/audit_trail only, preventing ReplayPacket/v1 from becoming claim support.
- The linked-issue ambiguity is now guarded mechanically: src/lib/pr-template-validator.ts lines 179-210 requires either explicit acceptance IDs or preparatory language plus "completed issue acceptance IDs are none."

Validation ownership classification:
- Introduced by current patch: none.
- Pre-existing: none observed within scope.
- Unrelated dirty worktree: project-brain untracked files are outside this slice.
- Environment or tooling failure: none observed.

Validation evidence:
- node scripts/validate-replay-packet.cjs contracts/examples/replay-packet.example.json --repo-root . -> pass
- node scripts/validate-runtime-packet-schemas.cjs --all -> pass
- pnpm vitest run src/lib/replay/replay-packet.test.ts src/lib/replay/tracer.test.ts src/lib/replay/trace-normalizer.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts src/lib/pr-template-validator.test.ts src/commands/pr-template-gate.test.ts --reporter=dot -> pass
- pnpm typecheck -> pass

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-improve-codebase-architecture.md
