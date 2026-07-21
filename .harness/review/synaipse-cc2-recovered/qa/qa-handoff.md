# SynAIpse CC2 recovered QA Disproof handoff

## Instruction attestation

- Packet: `.harness/intent/2026-07-21-synaipse-cc2-recovered-qa-packet.json`
- Packet SHA-256: `e4053d56b4f7c44d58e7e5a09ebf93cd934028536b1ca9a0f74e448ca1819e96`
- Target worktree: `/private/tmp/coding-harness-jsc-cc2-recovered-qa`
- Branch: `codex/synaipse-cc2-recovered-qa`
- Observed target SHA: `8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8`
- Observed staged patch SHA-256: `1d4ed517e6cdf2cdee3065c812049cfa91befc60d3e172dbbb3442aed4665afe`
- Worker result SHA-256: `479de4531c6eedf6139aaedb1ae649e64d7c43246b8235d12dd1987afe9309e0`
- Applied instruction chain: root `AGENTS.md`, `contracts/AGENTS.md`, `src/AGENTS.md`, `docs/agents/quickstart.md`, `CODESTYLE.md`, and the packet's `coding-harness` skill route.
- Authority boundary honored: source, tests, contracts, Git state, hosted state, and other worktrees were not mutated.

## Review scope and result

I independently reviewed the exact admitted CC2 staged patch for producer-reader
compatibility, the additive `synaipse-context-failure-envelope/v1` semantics,
decision stop behavior, `synaipse-state/v1` compatibility, optional
`contextUnknowns`, required-context blocking, malformed-input handling, and
legacy decisions without the additive envelope. The focused tests and static
checks passed, and the staged target fingerprint remained unchanged.

The corrected packet binds the current probe SHA
`307871071109f30abc3a2701bf38a64c472c9fe82dbe788b6b8b9d55eb5fe7ad` and
worktree-preflight SHA
`4aa5d48c2302e7fdb74687433ba0080003df975b03df528bd9e650de794a130e`.
Those bindings are current and schema-valid. No source or contract defect was
reproducible in the executed review gates.

## Command outcomes

- Command: `MISE_NO_CONFIG=1 pnpm install --frozen-lockfile` -> pass (lockfile already satisfied; pnpm emitted only the pre-existing missing Vale bin warning).
- Command: `MISE_NO_CONFIG=1 pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/context-plane.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts --maxWorkers=1 --reporter=dot` -> pass (4 files, 134 tests).
- Command: `MISE_NO_CONFIG=1 node scripts/validate-runtime-packet-schemas.cjs --all` -> pass (28 runtime packet schemas, no errors).
- Command: `MISE_NO_CONFIG=1 pnpm boundary:unknown-guards` -> pass (52 baselined guards; no new entries).
- Command: `MISE_NO_CONFIG=1 pnpm exec tsc --noEmit` -> pass (no diagnostics).
- Command: `MISE_NO_CONFIG=1 pnpm run quality:docstrings` -> pass (8 files checked; public API documentation present).
- Command: `MISE_NO_CONFIG=1 pnpm run quality:size` -> pass (8 production files and 3 test files checked; limits passed).
- Command: `git diff --cached --binary | shasum -a 256` -> pass (`1d4ed517e6cdf2cdee3065c812049cfa91befc60d3e172dbbb3442aed4665afe`).
- Command: `git rev-parse HEAD` -> pass (`8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8`).
- Command: `git status --short --branch` -> pass (only the admitted staged source patch plus declared packet/review artifacts; no source mutation during QA).
- Command: `/usr/bin/shasum -a 256 .harness/intent/2026-07-21-synaipse-cc2-recovered-qa-packet.json .harness/review/synaipse-cc2-recovered-qa/worker-artifact-probe.json .harness/review/synaipse-cc2-recovered-qa/qa-worktree-preflight.json` -> pass (packet SHA `e4053d56...`; declared probe/preflight SHA values match the current receipts).
- Command: `/opt/homebrew/bin/python3 - <<'PY' ... Draft202012Validator against pm-child-task-packet.v1.schema.json ... PY` -> pass (packet JSON is schema-valid and cross-artifact SHA binding is current).

## QA verdict

`accepted` for the QA Disproof role only. The corrected packet, probe, and
worktree-preflight are current and SHA-bound, and the review gates found no
reproducible source or contract defect. This does not accept the Worker,
Adversarial Review, or the overall job.

## Claims boundary

This handoff proves only the read-only QA inspection and the listed local
commands for the exact target/staged-patch pair. It does not prove an accepted
QA Disproof verdict, Adversarial Review, finding-fan-in acceptance, hosted
checks, hosted review, human acceptance, PR readiness, mergeability, release,
deployment, or production readiness.

WROTE: .harness/review/synaipse-cc2-recovered-qa/qa-handoff.md
