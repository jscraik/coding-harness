---
date: 2026-02-24
topic: contract-surface-parity
status: implemented
implemented: 2026-02-25
plan: docs/plans/2026-02-24-refactor-contract-surface-runtime-parity-plan.md
last_validated: 2026-04-18
---

# Contract Surface Parity

## What We're Building
We are aligning the harness contract so policy intent, schema validation, and runtime behavior all match. Today, `harness init` scaffolds many policy fields in `harness.contract.json`, but only a subset is formally typed and validated. This creates drift: users think a policy is enforced when it may only be documented.

The feature is a contract-surface parity initiative: the scaffolded policy surface becomes the canonical validated surface, with closed-schema enforcement and consistent runtime reads across command entry points. The immediate objective is confidence and determinism: if a field exists in contract scaffolding, it is either enforced or explicitly out of scope (with no silent middle state).

## Why This Approach
We selected **Approach A (big-bang contract unification)** because this repository is a control plane, and policy ambiguity is a foundational risk. A phased adapter approach reduces short-term risk but prolongs inconsistency. Since upcoming additions (review loops, autonomy, quality systems) depend on policy truth, the highest-value move is to cleanly unify now and remove split-brain behavior.

This choice also supports YAGNI: one canonical contract path is simpler than maintaining transitional abstractions and mixed readers.

## Key Decisions
- Use **full contract expansion**: all scaffolded fields are represented in formal contract typing and validation.
- Enforce a **closed schema**: unknown top-level keys fail validation.
- Use **`harness init --migrate`** as the compatibility path for out-of-shape existing contracts.
- Use **TypeScript contract module as source of truth** (`types.ts` + validator); scaffold output must align to it.
- Define v1 done as **schema + runtime parity**.
- For runtime parity in v1, enforce fields with existing command surfaces first: `riskTierRules`, `reviewPolicy`, `evidencePolicy`, `diffBudget`, and `uiLoopPolicy` where applicable.
- Use a **minor contract version bump** (`1.0` → `1.1`) with migration support.

## Resolved Questions
- **Scope strategy?** Full expansion.
- **Unknown key handling?** Closed schema.
- **Migration posture?** Auto-migrate path via `init --migrate`.
- **Canonical source of truth?** TypeScript contract module.
- **v1 completion bar?** Schema + runtime parity.
- **Versioning?** Minor bump.
- **Runtime enforcement scope?** Existing command-surface fields first.

## Open Questions
- None currently.

## Next Steps
- Move to `/workflows:plan` to define implementation sequencing, test matrix, migration behavior details, and acceptance gates.
