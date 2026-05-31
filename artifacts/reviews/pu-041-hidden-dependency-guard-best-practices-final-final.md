# PU-041 Hidden Dependency Guard Final-Final Review

## Scope
- Reviewed only the final import-identity hardening delta:
  - `scripts/check-behavior-tests.mjs`
  - `src/dev/check-behavior-tests-script.test.ts`
  - `src/lib/testing/expect-behavior.ts`
- Evaluated whether canonical import identity closes suite-local shim bypasses and whether the delta introduces material blockers.
- Did not evaluate PR readiness, CI mergeability, Linear state, or wider JSC-363 closure.

## Findings (Severity-Ordered)
- None.

## Validation Evidence
- Command: `pnpm exec biome format --write scripts/check-behavior-tests.mjs src/dev/check-behavior-tests-script.test.ts src/lib/testing/expect-behavior.ts`
  - Outcome: pass
  - Evidence: no formatting changes required.
- Command: `pnpm vitest run src/dev/check-behavior-tests-script.test.ts src/lib/testing/expect-behavior.test.ts`
  - Outcome: pass
  - Evidence: 2 test files passed, 11 tests passed.
- Command: `pnpm run quality:behavior-tests`
  - Outcome: pass
  - Evidence: `[behavior-tests] verified registered evidence-bearing suites`.

## Delta Assessment
- The import gate now resolves suite imports to the exact canonical file path `src/lib/testing/expect-behavior.ts` via `resolve(repoRoot, dirname(suitePath), ...)` equality with canonical path evidence (`scripts/check-behavior-tests.mjs`).
- The suite-local shim bypass is explicitly covered with a negative test (`rejects suite-local expectBehavior shims`) so local `./expect-behavior.js` no longer qualifies.
- Existing runtime hardening remains in place:
  - proving command must be exact `pnpm vitest run <suite-path>`
  - execution uses repo-local `node_modules/.bin/vitest`
  - trace env spoofing in registered suites is rejected
  - trace token/stack ownership is checked against suite path.

## Residual Risk
- Low. Main remaining risk is future alias/import-pattern expansion (for example tsconfig path aliases) that may need explicit canonicalization policy if adopted. No current blocker observed in this delta.

## Accountability Receipt
- status: complete
- manifest_path: artifacts/agent-runs/best-practices-researcher-2026-05-31-pu041-final-final/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-041-hidden-dependency-guard-best-practices-final-final.md
- findings:
  - none
- failures_or_blockers:
  - Missing optional template/contract files referenced by agent policy in this checkout: `agents/contracts.json`, `agents/templates/review-artifact.md`. Proceeded with repository-local artifact contract and explicit evidence instead.
- improvement_opportunities:
  - Add a repo-local reviewer artifact template and machine-readable contract path for subagent consistency.
- strengths:
  - Canonical import identity check is explicit and easy to reason about.
  - Regression coverage includes direct adversarial shim case.
  - Runtime proof path remains constrained and reproducible.
- validation_evidence:
  - `pnpm exec biome format --write scripts/check-behavior-tests.mjs src/dev/check-behavior-tests-script.test.ts src/lib/testing/expect-behavior.ts` (pass)
  - `pnpm vitest run src/dev/check-behavior-tests-script.test.ts src/lib/testing/expect-behavior.test.ts` (pass)
  - `pnpm run quality:behavior-tests` (pass)
- next_action:
  - Coordinator can synthesize this lane as covered for the targeted delta without widening claim scope.

## Performance Meta
- useful_findings: validated that the targeted bypass class is closed; no new defects found.
- avoided_false_positive: did not re-flag pre-existing broad-scope readiness concerns outside this delta.
- evidence_quality: high for scoped behavior (direct source inspection plus rerun of exact checks).
- followed_scope: yes
- reusable_learning: canonical file-identity checks should pair with explicit negative tests for local shadow modules.
- coordinator_score: strong handoff readiness for this bounded lane.

WROTE: artifacts/reviews/pu-041-hidden-dependency-guard-best-practices-final-final.md
