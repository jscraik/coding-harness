# PU-048 CNF-002 Intent Review

status: pass_with_scope_constraints
reviewed_intent: docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-048-cnf-002-env-permissions-intent.md

## Findings

No material blockers before implementation.

## Scope Constraints

- Keep implementation inside `src/lib/runtime/codex-runtime-evidence-*` and focused tests unless validation proves another directly associated surface is required.
- Treat environment facts as explicit input only; do not synthesize them from writable roots, thread identity, source provenance, or local shell environment.
- Require blocker classifications for stale cwd, approval-scope mismatch, and missing sandbox-policy refs when permission facts would otherwise look claim-capable.
- Preserve CNF-001 nullable `clientUserMessageId` behavior and do not widen steering-queue behavior in this slice.

## Evidence Checked

- `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml` CNF-002 requirement.
- `src/lib/runtime/codex-runtime-evidence-types.ts` packet shape.
- `src/lib/runtime/codex-runtime-evidence-producer.ts` producer normalization seam.
- `src/lib/runtime/codex-runtime-evidence-validation.ts` validator seam.

## Implementation Approval

Proceed with a narrow deep-module extension for environment-scoped permission evidence.

WROTE: artifacts/reviews/pu048-cnf-002-intent-review.md
