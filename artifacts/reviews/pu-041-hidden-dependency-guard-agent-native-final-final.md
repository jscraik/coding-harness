## Agent-Native Architecture Review

### Scope Reviewed
- Final-final delta only for PU-041 hidden-dependency guard hardening in `/Users/jamiecraik/dev/coding-harness`.
- Reviewed import-identity tightening in `scripts/check-behavior-tests.mjs` and regression coverage in `src/dev/check-behavior-tests-script.test.ts`.
- Explicitly out of scope: full JSC-363 completion, PR readiness, CI readiness, Linear state, merge readiness.

### Evidence Inspected
- Guard identity binding to canonical helper path:
  - `scripts/check-behavior-tests.mjs:14-17` defines canonical path `src/lib/testing/expect-behavior.ts`.
  - `scripts/check-behavior-tests.mjs:128-136` resolves import specifiers to canonical path only.
  - `scripts/check-behavior-tests.mjs:139-159` requires import of `expectBehavior` from that canonical location.
- Existing runtime hardening retained:
  - `scripts/check-behavior-tests.mjs:80-83` exact proving command contract.
  - `scripts/check-behavior-tests.mjs:85-91` repo-local `node_modules/.bin/vitest` enforcement.
  - `scripts/check-behavior-tests.mjs:100-104` trace token/file injection.
  - `scripts/check-behavior-tests.mjs:116-121` suite-bound runtime trace requirement.
  - `scripts/check-behavior-tests.mjs:60-62` direct trace-control env reference rejection.
- Regression tests covering shim bypass and guard behavior:
  - `src/dev/check-behavior-tests-script.test.ts:167-191` rejects suite-local `./expect-behavior.js` shim.
  - Canonical accepted fixtures continue using `./testing/expect-behavior.js` imports in positive/negative suites.

### Capability Map Delta
| UI Action / User Capability | Location | Agent Tool / Guard Capability | In Prompt? | Priority | Status |
|---|---|---|---|---|---|
| Declare evidence-bearing suite import identity | behavior suite files | Script verifies canonical `expectBehavior` import path identity | n/a | Must have | PASS |
| Forge behavior evidence via local shim | suite-local helper path | Rejected by canonical resolution + import check | n/a | Must have | PASS |
| Forge behavior evidence via command/path shadowing | proving command and PATH | Exact `pnpm vitest run <suite>` + repo-local vitest path enforced | n/a | Must have | PASS |

### Findings

#### Critical (Must Fix)
- None.

#### Warnings (Should Fix)
- None.

#### Observations
1. `agents/templates/review-artifact.md` and `agents/contracts.json` were not present in this checkout when probed (`sed` returned `No such file or directory`). This did not block the requested scoped review artifact, but coordinator-owned template/contract path assumptions should be kept synchronized with repo reality.

### Validation Evidence
- `pnpm exec biome format --write scripts/check-behavior-tests.mjs src/dev/check-behavior-tests-script.test.ts src/lib/testing/expect-behavior.ts` -> pass, no fixes.
- `pnpm vitest run src/dev/check-behavior-tests-script.test.ts src/lib/testing/expect-behavior.test.ts` -> pass (2 files, 11 tests).
- `pnpm run quality:behavior-tests` -> pass (`[behavior-tests] verified registered evidence-bearing suites`).

### Verdict
- PASS for the scoped final-final delta: the suite-local shim bypass class is closed by canonical import identity enforcement and corresponding regression coverage, with prior runtime anti-forgery controls preserved.

### Residual Risk
- Moderate residual risk only from out-of-scope surfaces (global delivery/readiness lanes not evaluated in this review). No material blocker found in the reviewed delta itself.

### Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e7b45-6f2c-7fc1-a63f-4ab0fc0ea2ec/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-041-hidden-dependency-guard-agent-native-final-final.md
- findings:
  - useful_findings: canonical helper identity check now mechanically prevents suite-local shim spoofing
  - avoided_false_positive: no unsupported claim about PR/CI/merge readiness; scoped verdict only
- failures_or_blockers:
  - missing template/contract paths under `agents/` in this checkout (non-blocking for scoped review artifact)
- improvement_opportunities:
  - align coordinator/runtime assumptions for review template and contracts path discovery in repo
- strengths:
  - defense-in-depth retained (command exactness, repo-local vitest pinning, runtime trace token ownership, suite-stack validation)
  - targeted regression test added for the previously exploitable shim path
- validation_evidence:
  - biome format pass
  - vitest targeted suite pass
  - quality:behavior-tests pass
- next_action:
  - coordinator may synthesize this as a no-new-findings PASS for the final import-identity hardening slice

WROTE: artifacts/reviews/pu-041-hidden-dependency-guard-agent-native-final-final.md
