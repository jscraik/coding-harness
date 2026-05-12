---
title: JSC-311 Phase-Exit Validator Proof
date: 2026-05-11
module: src/lib/decision
problem_type: validation
evidence:
  - .harness/specs/2026-05-11-jsc-311-he-phase-exit-evidence-gates-spec.md
  - .harness/plan/2026-05-11-JSC-311-he-phase-exit-evidence-gates-plan.md
  - .harness/evals/2026-05-11-jsc-311-he-phase-exit-evidence-gates-coding-harness-eval.md
  - src/lib/decision/he-phase-exit-core.ts
  - src/lib/decision/he-phase-exit.test.ts
project_brain_sync: explicitly_deferred
tags: [jsc-311, phase-exit, validator, review-gates]
---

# JSC-311 Phase-Exit Validator Proof

## Problem

The JSC-311 HE phase-exit contract needed to prove that skill-backed gates are
evidence-bearing runtime data, not prompt-memory claims. During review, the
first implementation still allowed malformed external gate input to escape the
structured validator path in two places:

- malformed `requiredGates` or `optionalGates` could be passed into `Set`
  construction before being normalized;
- malformed `findings` on `fail` or `blocked` gate results could reach
  cross-field consistency checks before being sanitized.

Both cases violated the intended fail-closed contract because callers expect
deterministic validation errors, not runtime exceptions.

## Evidence

- The JSC-311 spec and plan define the selected slice as a pure TypeScript
  phase-exit evidence contract.
- The correctness review gate found the malformed configuration and malformed
  findings failure modes.
- The implementation now sanitizes gate configuration arrays and findings
  before cross-field checks in `src/lib/decision/he-phase-exit-core.ts`.
- Focused regression coverage lives in `src/lib/decision/he-phase-exit.test.ts`.
- The HE eval report records the final local proof and closure limits.

## Root Cause

The validator mixed structural validation with semantic consistency checks too
early. It detected invalid shapes, but some later checks still read from the
original untrusted object via TypeScript casts. Those casts made TypeScript
happy while leaving JavaScript runtime behavior unsafe for malformed inputs.

## Fix Or Durable Guidance

When a harness contract validates untrusted external data, future agents should
use sanitized runtime values for every cross-field or semantic check.

For gate-like validators:

1. Validate the raw field shape.
2. Return a safe default for malformed collections, such as `[]`.
3. Build the semantic validation object from sanitized values.
4. Run consistency checks against that sanitized object only.
5. Add negative tests that assert malformed input returns `{ valid: false }`
   instead of throwing.

Do not rely on `as SomeContract` casts as proof that cross-field validators are
safe. Casts can document intent, but they do not sanitize runtime data.

## Validation

- `pnpm vitest run src/lib/decision/he-phase-exit.test.ts` -> pass, 22 tests.
- `pnpm vitest run src/lib/decision/route-decision.test.ts` -> pass, 44 tests.
- `pnpm exec tsc --noEmit --pretty false` -> pass.
- `bash scripts/validate-codestyle.sh --fast` -> pass.
- `bash scripts/verify-work.sh --fast` -> pass, run id
  `20260511T214015Z-8050`.
- `python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/skills/he-eval-report/scripts/validate_eval_report.py .harness/evals/2026-05-11-jsc-311-he-phase-exit-evidence-gates-coding-harness-eval.md`
  -> pass.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/evals/2026-05-11-jsc-311-he-phase-exit-evidence-gates-coding-harness-eval.md`
  -> pass.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/evals/2026-05-11-jsc-311-he-phase-exit-evidence-gates-coding-harness-eval.md`
  -> pass.

## Prevention

- Review gates for future contract validators should explicitly look for
  untrusted object casts before semantic checks.
- Tests should include malformed collection fields for any validator that later
  calls `.some`, `.map`, `.filter`, `new Set`, or similar collection APIs.
- Phase-exit or commit-readiness gates should require gate-local evidence for
  `pass`, `fail`, and `blocked`; route-decision context is not gate proof.
- Optional cleanup suggestions from simplify should not displace fail-closed
  validation behavior.

## Project Brain / Routing

Project Brain sync is explicitly deferred in this pass because the user invoked
one reinforcement capture after implementation proof, not a broader memory
maintenance batch. The artifact is discoverable under `.harness/solutions/**`
and can be promoted into `.harness/memory/LEARNINGS.md` during a later
Project Brain sync if this validation pattern recurs.

## Related Artifacts

- `.harness/specs/2026-05-11-jsc-311-he-phase-exit-evidence-gates-spec.md`
- `.harness/plan/2026-05-11-JSC-311-he-phase-exit-evidence-gates-plan.md`
- `.harness/evals/2026-05-11-jsc-311-he-phase-exit-evidence-gates-coding-harness-eval.md`
- `src/lib/decision/he-phase-exit-core.ts`
- `src/lib/decision/he-phase-exit.test.ts`
