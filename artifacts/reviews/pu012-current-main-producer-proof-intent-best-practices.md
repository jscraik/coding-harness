# PU-012 Current-Main Producer Proof Intent Review

Verdict: pass

## Scope Reviewed

- [docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md)
- [docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml)
- [docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl)
- [.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md](/Users/jamiecraik/dev/coding-harness/.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md)
- [.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md](/Users/jamiecraik/dev/coding-harness/.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md)
- [docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md)
- [src/lib/runtime/codex-runtime-evidence-producer.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts)
- [src/lib/runtime/codex-runtime-evidence-producer.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.test.ts)
- [src/lib/runtime/codex-runtime-source-provenance.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-source-provenance.ts)
- [src/lib/runtime/runtime-evidence-adapter.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/runtime-evidence-adapter.ts)

## Findings

1. No blocking findings found.
   - The intent keeps the bridge boundary narrow and repo-owned at src/lib/runtime/** rather than authorizing Codex-side mutation.
   - The intent preserves the required non-claims around live Codex emission, delivery truth, Linear, Judge/PM, Snyk, and parent-goal completion.
   - The validation floor matches the plan/spec shape and adds the producer-path and provenance checks needed for this boundary.

## Strengths

- The selected boundary is the smallest safe mechanism that still lets Coding Harness validate packet admission without scraping final assistant prose.
- The intent correctly distinguishes current-main proof from later runtime-card, delivery-truth, and closeout work.
- Source provenance is handled as a validated contract surface, not as an inferred claim.
- The producer tests cover the important negative cases: stale source evidence, invalid packets, and write-capable permission downgrades without writable-root evidence.

## Improvement Opportunities

- If PU-012 repairs become necessary, keep the fix confined to src/lib/runtime/** unless a later approved Codex-side ADR/spec explicitly expands the mutation boundary.
- When the validation run happens, keep the evidence split between current-main producer proof and later delivery-truth / closeout truth so the goal board does not overclaim completion.

## Validation Evidence

- Intent lines 28-34, 43-48, 52-77, 89-100, 140-168, and 201-210 align with the plan/spec boundary and the explicit non-claims.
- Plan lines 907-939 authorize the Harness wrapper/import producer path and require commit-SHA or checksum-backed provenance fallback.
- Spec lines 327-337 and 743-754 support the Harness-owned wrapper boundary and separate the producer-boundary selection from later closeout gates.
- Producer source lines 147-188, 191-307 validate explicit wrapper/import facts, unknown-blocker downgrades, and source snapshot admission.
- Source provenance lines 47-159 validate pinned-vs-observed source evidence, including repo-head and blob drift detection.
- Adapter lines 190-271 preserve Codex runtime provenance when projecting into runtime-evidence-bundle/v1.

## Accountability Receipt

- status: pass
- artifact_paths:
  - artifacts/reviews/pu012-current-main-producer-proof-intent-best-practices.md
- findings:
  - none
- failures_or_blockers:
  - none
- improvement_opportunities:
  - Keep any later repair inside src/lib/runtime/** unless a new approved bridge boundary is recorded.
  - Preserve lane separation between producer proof, delivery truth, Linear truth, and Judge/PM readiness.
- strengths:
  - Narrow wrapper/import boundary.
  - Explicit unknown/blocker handling.
  - Provenance validation before packet admission.
  - Clear non-claims for downstream truth lanes.
- validation_evidence:
  - Intent, plan, spec, and runtime source inspection completed.
- next_action:
  - If the PU-012 validation floor runs, keep the resulting evidence scoped to current-main producer proof only.

WROTE: artifacts/reviews/pu012-current-main-producer-proof-intent-best-practices.md
