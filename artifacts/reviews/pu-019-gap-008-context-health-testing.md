# PU-019 GAP-008 Context Health Testing Lens

## Scope

- Lifecycle slice: PU-019 / GAP-008 context-health agent-readiness projection.
- Role: testing.
- Changed behavior: `agent-readiness` emits advisory context-health metadata, stale/missing context warnings, and prerequisite-aware refresh guidance.

## Test Strategy

The smallest exact proof is the focused command test file because it invokes the production `assessAgentReadiness` and `runAgentReadinessCLI` paths against temporary repositories. The live CLI command then proves the current checkout emits the expected report shape.

## Coverage Map

| Requirement | Proof |
| --- | --- |
| JSON includes `agent-readiness-context-health/v1` | `src/commands/agent-readiness.test.ts:99` and live CLI JSON |
| Surfaces include active artifacts, active route refs, Project Brain memory/knowledge, runtime card, and external horizon | `src/commands/agent-readiness.test.ts:38` |
| Missing active-route refs warn with concrete paths | `src/commands/agent-readiness.test.ts:115` |
| Active route rows marked not-current warn | `src/commands/agent-readiness.test.ts:156` |
| Malformed active-artifacts file produces non-empty stale reason | `src/commands/agent-readiness.test.ts:192` |
| Missing Project Brain memory/knowledge warns without failing the report | `src/commands/agent-readiness.test.ts:217` |
| Refresh guidance is prerequisite-aware | `src/commands/agent-readiness.test.ts:251` |
| Human output prints separate command options instead of shell chains | `src/commands/agent-readiness.test.ts:276` |
| Local context-health is not misrepresented as an external-state refresh | `src/commands/agent-readiness.test.ts:296` |
| Safe repo-relative active-route refs outside the original common prefixes are accepted | `src/commands/agent-readiness.test.ts:192` |
| Unsafe active-route tokens are ignored before evidence lookup | `src/commands/agent-readiness.test.ts:234` |
| Projection does not duplicate canonical context-health report fields | `src/commands/agent-readiness.test.ts:402` |

## Validation Evidence

- Command: `pnpm vitest run src/commands/agent-readiness.test.ts` -> pass (18 tests).
- Command: `node --import tsx src/cli.ts agent-readiness --repo-root . --json` -> pass, report status warn with 18 pass / 3 warn / 0 fail.
- Command: `node_modules/.bin/biome check src/lib/agent-readiness/context-health.ts src/lib/agent-readiness/cli.ts src/commands/agent-readiness.test.ts .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json` -> pass.

## Failure Ownership

- Current patch: covered by the 18 focused tests and live CLI smoke.
- Pre-existing warning: `approval_gates.shared_state` remains warn in the live report; not introduced by PU-019.
- Environment / unavailable evidence: runtime-card and external-horizon local artifacts are absent in this checkout and correctly reported as orientation warnings.

## Coverage Gaps

No further PU-019 test is required before the slice receipt. Broader gates such as `pnpm test:deep`, remote CI, PR review threads, Linear freshness, and merge readiness remain outside this local context-health slice and must be handled by later lifecycle units or closeout proof.
