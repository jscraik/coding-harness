# SynAIpse CC2 recovered Worker handoff

## Instruction attestation

- Packet: `.harness/intent/2026-07-21-synaipse-cc2-recovered-worker-packet.json`
- Packet SHA-256: `63db4f5946720da9412fd7aca72b8c64bba1d1804b912a86288892182ac9ac5f`
- Target worktree: `/private/tmp/coding-harness-jsc-cc2-recovered`
- Branch: `codex/synaipse-cc2-recovered`
- Observed target SHA: `8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8`
- Observed staged patch SHA-256: `1d4ed517e6cdf2cdee3065c812049cfa91befc60d3e172dbbb3442aed4665afe`
- Applied instruction chain: root `AGENTS.md`, `contracts/AGENTS.md`, `src/AGENTS.md`, `docs/agents/quickstart.md`, `CODESTYLE.md`, and the packet's `coding-harness` skill route.
- Authority boundary honored: source, tests, contracts, Git state, hosted state, and other worktrees were not mutated.

## Review scope and result

I reviewed the public `harness-decision/v1` schema and types, the additive
`synaipse-context-failure-envelope/v1` parser and semantic validator, the
canonical context-resolution producer, `harness next` decision projection,
the `synaipse-state/v1` compatibility projection, and the focused producer,
reader, malformed-input, optional-unknown, required-blocker, and schema-parity
fixtures.

The exact staged candidate is internally consistent for the declared CC2
scope. Required context failures block before changed-file inspection and emit
the versioned envelope. Optional provider failures remain identified by the
existing `ch_context`-keyed `contextUnknowns` projection while the additive
failure envelope remains available for the provider failure diagnostics.
Legacy decisions without `cockpitLane` and legacy metadata without the additive
failure envelope remain accepted. Unknown properties, invalid versions,
contradictory requirement/code combinations, duplicate logical failures,
invalid identifiers/digests, and invalid freshness values fail closed.

No reproducible source or contract defect was found in this Worker review.

## Command outcomes

- Command: `MISE_NO_CONFIG=1 pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/context-plane.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts --maxWorkers=1 --reporter=dot` -> pass (4 files, 134 tests)
- Command: `MISE_NO_CONFIG=1 node scripts/validate-runtime-packet-schemas.cjs --all` -> pass (28 runtime packet schemas)
- Command: `MISE_NO_CONFIG=1 pnpm boundary:unknown-guards` -> pass (52 baselined guards; no new entries)
- Command: `MISE_NO_CONFIG=1 pnpm exec tsc --noEmit` -> pass (no diagnostics)
- Command: `MISE_NO_CONFIG=1 pnpm run quality:docstrings` -> pass (8 files checked)
- Command: `MISE_NO_CONFIG=1 pnpm run quality:size` -> pass (8 production files and 3 test files checked)
- Command: `git diff --cached --binary | shasum -a 256` -> pass (`1d4ed517e6cdf2cdee3065c812049cfa91befc60d3e172dbbb3442aed4665afe`)
- Command: `git diff --cached --check` -> pass (no whitespace diagnostics)
- Command: `uv run --python 3.12 python - <<'PY'` (Draft202012Validator against `/Users/jamiecraik/dev/jamie-brain/operating-system/schemas/pm-child-result.v1.schema.json`) -> pass (`schema-valid`)
- Command: `git rev-parse HEAD` -> pass (`8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8`)
- Command: `git status --short --branch` -> pass (target and staged patch unchanged; packet/review outputs and the mandatory agent-accountability artifacts are untracked)

## Worker verdict

`accepted` for the Worker role only. This is fresh local Worker evidence for
the exact target/staged-patch pair and is not an independent QA Disproof or
Adversarial Review. The consequential packet still requires both fresh review
roles and a SHA-bound finding fan-in before any source commit.

## Claims boundary

This handoff proves only the bounded Worker review and the listed local
commands in this retained worktree. It does not prove fresh QA Disproof,
Adversarial Review, fan-in acceptance, hosted checks, hosted review, human
acceptance, PR readiness, mergeability, release, deployment, or production
readiness.

WROTE: .harness/review/synaipse-cc2-recovered/worker-handoff.md
