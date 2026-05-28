# PU-028 SPG-002 Runtime-Card Handoff HE Code Review

## Scope

Reviewed the SPG-002 runtime-card handoff implementation as committed on PR #309 head `43d0aba59e80e9619676ab7037ce9b2251399ff5`.

Primary files reviewed:

- `src/lib/runtime/runtime-card-handoff.ts`
- `src/lib/runtime/runtime-card-handoff.test.ts`
- `src/commands/runtime-card-artifacts.ts`
- `contracts/runtime-card-handoff.schema.json`
- `contracts/examples/runtime-card-handoff.example.json`
- `contracts/runtime-packet-schemas.manifest.json`

## Findings

No blocking implementation finding found in this pass.

### Evidence-Bound Handoff Shape

The implementation builds `runtime-card-handoff/v1` inside the runtime deep module and keeps the CLI surface in `src/commands/runtime-card-artifacts.ts`. That matches the deep-module placement rule for runtime-card evidence adapter changes: the public command path remains a narrow facade, while checksum, artifact identity, evidence-use, and runtime identity logic live in `src/lib/runtime`.

### Claim-Support Boundary

The handoff sets `evidenceUse: "orientation"` and tests reject `claim_support`. This preserves the intended boundary: runtime-card handoff artifacts can orient the agent and supply audit trail pointers, but they cannot independently prove delivery, merge readiness, review-thread resolution, or goal completion.

### Artifact Integrity

The builder records repository-relative artifact paths, SHA-256 digests, file sizes, schema versions, generated timestamps, source refs, provenance refs, and head SHA. Tests cover mismatched runtime generations, forged schema families, path traversal, and artifact head-SHA mismatch. That gives this slice enough deterministic proof for an artifact-backed handoff packet.

### Runtime Coupling

`--handoff-out` requires both `--out` and `--evidence-out`, and output paths must be distinct. This is the right coupling because the handoff has no standalone truth value without the specific runtime-card and evidence-bundle artifacts it binds.

## Residual Risks

- This slice does not implement final delivery truth or goal-completion audit semantics.
- This slice does not refresh review-thread, Linear, or merge-readiness truth.
- Credentialed `pnpm test:deep` remains blocked in this session by `~/.codex/.env` being a FIFO without an available writer.

## Validation Evidence

- `pnpm vitest run src/lib/runtime/runtime-card-handoff.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass
- `pnpm vitest run src/lib/architecture/module-boundaries.test.ts src/lib/runtime/runtime-card-handoff.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts src/lib/cli/command-registry.test.ts` -> pass
- `bash scripts/validate-codestyle.sh --fast` -> pass
- `gh pr checks 309 --repo jscraik/coding-harness --watch=false` -> pass at head `43d0aba59e80e9619676ab7037ce9b2251399ff5`

## Status

PASS: PU-028 SPG-002 runtime-card handoff is acceptable as an orientation/audit-trail handoff packet. It is not a delivery-truth or merge-readiness implementation.

