# SynAIpse CC2 release-10 QA Disproof handoff

## Attestation

- Role: QA Disproof
- Packet: `pkt_cc2release10qa`
- Dispatch: `ch_cc2release10qa`
- Packet SHA-256: `a3f3a62e384611207aa7216757b76969e32c3b190bae4a4c92937fc3ed0d3b79`
- Target SHA: `8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8`
- Staged patch SHA-256: `98d650c6c407143f4386396ac675cdd3f000849c373630319e9e1efb28b5c801`
- Accepted Worker result SHA-256: `15adb3eef736a82ed7d0c0cdea9fd24b8a1d34959ff71ea689b99ba817ab0564`
- Source, staging, commit, push, hosted state, and cleanup were not mutated.

## Verdict

Accepted with no findings. The fresh read-only QA pass did not disprove the accepted Worker result or staged patch. All nine required disposition cases produced the expected resolver state, canonical failure code, exact stop/continue condition, blocker or legacy `contextUnknowns` projection, decision validation, semantic validation, and state-v1 compatibility result.

## Nine-case disproof matrix

| Scenario | Resolver state | Canonical failure | Public condition | Projection | Result |
| --- | --- | --- | --- | --- | --- |
| optional missing | resolved | `missing_optional_context` | continue with explicit unknown | one `contextUnknowns` entry with `missing_context`; no blocker | pass |
| optional provider unavailable | resolved | `provider_unavailable` | continue with explicit unknown | one `contextUnknowns` entry with `provider_unavailable`; no blocker | pass |
| optional unresolved host path | resolved | `unresolved_host_path` | continue with explicit unknown | one `contextUnknowns` entry with `unresolved_host_path`; no blocker | pass |
| optional historical | blocked | `superseded_context` | stop | blocker; no unknown | pass |
| optional superseded | blocked | `superseded_context` | stop | blocker; no unknown | pass |
| optional access denied | blocked | `context_access_denied` | stop | blocker; no unknown | pass |
| optional stale digest | blocked | `stale_context_digest` | stop | blocker; no unknown | pass |
| required provider unavailable | blocked | `provider_unavailable` | stop | blocker; no unknown | pass |
| required unresolved host path | blocked | `unresolved_host_path` | stop | blocker; no unknown | pass |

The matrix exercised the public `runHarnessNext` adapter as well as the resolver. Each returned decision passed `validateHarnessDecision`, the failure semantic validator, and `validateSynaipseState`; the legacy reader path therefore remained valid while the additive failure envelope was present. Existing focused tests also covered envelope version rejection, unknown-field rejection, requirement/code identity, recovery, owner, stop-condition, freshness, duplicate logical identity, schema/example parity, repository mismatch, missing identity, and malformed catalog projections.

## Validation evidence

- Command: `git rev-parse HEAD` -> pass (`8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8`)
- Command: `git diff --cached --binary | shasum -a 256` -> pass (`98d650c6c407143f4386396ac675cdd3f000849c373630319e9e1efb28b5c801`)
- Command: `shasum -a 256 /private/tmp/coding-harness-synaipse-cc2-next/.harness/intent/2026-07-20-synaipse-cc2-release10-qa-packet.json` -> pass (`a3f3a62e384611207aa7216757b76969e32c3b190bae4a4c92937fc3ed0d3b79`)
- Command: `shasum -a 256 /private/tmp/coding-harness-synaipse-cc2-next/.harness/review/synaipse-cc2-next/release9-worker-result.json` -> pass (`15adb3eef736a82ed7d0c0cdea9fd24b8a1d34959ff71ea689b99ba817ab0564`)
- Command: `pnpm boundary:unknown-guards` -> pass (52 baselined boundary guards; no new entries)
- Command: `pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/context-plane.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts src/dev/validate-harness-decision-failures.test.ts src/dev/runtime-packet-example-parity.test.ts --maxWorkers=1 --reporter=dot` -> pass (6 files, 164 tests)
- Command: `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass (28 packets; zero errors)
- Command: `pnpm exec tsc --noEmit` -> pass (zero diagnostics)
- Command: `pnpm run quality:self-affirming` -> pass (435 test files; assertion oracles passed)
- Command: `pnpm run quality:size` -> pass (9 production files and 6 test files; limits passed)
- Command: `node --import tsx /private/tmp/cc2-release10-qa-matrix.mts` -> pass (all nine cases; public decision, semantic, and legacy state-v1 assertions passed)
- Command: `pnpm exec vitest run src/lib/synaipse/state.test.ts src/commands/next-agent-parity.test.ts src/lib/decision/harness-decision.test.ts --maxWorkers=1 --reporter=dot` -> pass (3 files, 58 tests)
- Command: `uv run --python 3.12 python -c 'import json,jsonschema; schema=json.load(open("/Users/jamiecraik/dev/jamie-brain/operating-system/schemas/pm-child-result.v1.schema.json")); value=json.load(open(".harness/review/synaipse-cc2-next/release10-qa-result.json")); jsonschema.Draft202012Validator(schema).validate(value); print("pm-child-result/v1 schema: pass")'` -> pass (result artifact validated against the authoritative pm-child-result/v1 schema)
- Command: `git diff --cached --check` -> pass (no staged whitespace errors)

## Claims boundary

This handoff proves only fresh local read-only QA against target `8aa5e406f49c84ba04fa39e628d9d8f5a3ea35c8` and staged patch `98d650c6c407143f4386396ac675cdd3f000849c373630319e9e1efb28b5c801`, with the accepted Worker binding above. It does not prove Adversarial Review, finding fan-in, commit authorization, hosted checks, hosted review, acceptance, merge, release, deployment, or production readiness.

WROTE: .harness/review/synaipse-cc2-next/release10-qa-handoff.md
