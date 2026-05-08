---
schema_version: 1
artifact_id: coding-harness-governance-contract-memory-simplification-eval
artifact_type: he-eval-report
canonical_slug: governance-contract-memory-simplification-eval
title: Governance Contract Memory Simplification Eval
harness_stage: he-eval-report
status: complete
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
implementation_unit: IU-288-006
---

# Governance Contract Memory Simplification Eval

## Table Of Contents

- [Verdict](#verdict)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Eval Scope](#eval-scope)
- [Acceptance Coverage](#acceptance-coverage)
- [Trust Repair Proof](#trust-repair-proof)
- [Validation Outcomes](#validation-outcomes)
- [Residual Risks](#residual-risks)
- [Closure Recommendation](#closure-recommendation)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Evidence Matrix](#evidence-matrix)

## Verdict

JSC-288 is implementation-complete, pending human merge review.

The required PR evidence no longer accepts placeholder `memory.json` shape as
memory proof. The replacement proof is the live source-truth command
`pnpm exec tsx src/cli.ts tooling-audit --path . --json`, plus the retained
north-star learning-loop evidence or explicit `n.a.` reasons.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Linear project | `coding-harness` |
| Linear milestone | `Governance Trust Repair Slice` |
| Plan unit | `IU-288-006` |
| Scope | Evaluate governance, contract, and memory trust repair. |
| Out of scope | Runtime feature changes, contract schema migration, packaged skill behavior changes, and Linear closure. |
| Human review | Required before closing JSC-288 because PR evidence and governed docs changed. |

## Eval Scope

This eval covers the completed implementation units:

| Unit | Status | Evidence |
| --- | --- | --- |
| `IU-288-001` | Complete | `.harness/review/2026-05-08-JSC-288-governance-truth-inventory.md` |
| `IU-288-002` | Complete | `.harness/review/2026-05-08-JSC-288-memory-ownership-decision.md` |
| `IU-288-003` | Complete | `.harness/review/2026-05-08-JSC-288-contract-ownership-map.md` |
| `IU-288-004` | Complete | `.harness/review/2026-05-08-JSC-288-required-trust-evidence-repair.md`; `.github/PULL_REQUEST_TEMPLATE.md` |
| `IU-288-005` | Complete | `.harness/review/2026-05-08-JSC-288-governance-prose-compression.md`; `docs/agents/20-project-brain-memory-extension-rollout.md` |
| `IU-288-006` | Complete | This eval artifact |

## Acceptance Coverage

| Acceptance ID | Result | Evidence |
| --- | --- | --- |
| `SA-288-001` | Pass | Inventory artifact covers seed surfaces with role, owner, enforcement path, freshness, drift risk, disposition, and confidence. |
| `SA-288-002` | Pass | Memory ownership artifact classifies `memory.json`, `.harness/memory/LEARNINGS.md`, Project Brain, review log, and learning-loop evidence. |
| `SA-288-003` | Pass | PR template no longer requires the `memory.json` shape proof. |
| `SA-288-004` | Pass | Contract ownership map preserves `harness.contract.json` as the published aggregate and maps bounded internal contexts. |
| `SA-288-005` | Pass | Prose compression artifact gives keep/reference/link dispositions for Project Brain rollout guidance. |
| `SA-288-006` | Pass | New or retained governance authority is tied to owner, source, validation, and revisit/deletion behavior. |
| `SA-288-007` | Pass | This eval records exact validation outcomes. |
| `SA-288-008` | Pass | Scope stayed limited to governance, memory, contract trust, PR evidence, and one governed rollout note. |
| `SA-288-009` | Pass | Inventory covered all required seed surfaces or recorded no unreadable seed blocker. |
| `SA-288-010` | Pass | Retained required surfaces are executable policy, generated/projection candidates, or canonical human guidance. |
| `SA-288-011` | Pass | First unit remained behavior-preserving inventory. |
| `SA-288-012` | Pass | No extra Linear child issue explosion was introduced. |

## Trust Repair Proof

Facts:

- `.github/PULL_REQUEST_TEMPLATE.md` now requires
  `pnpm exec tsx src/cli.ts tooling-audit --path . --json`.
- The previous `memory.json` `jq` proof is absent from the PR-template required
  local gates and testing evidence.
- `memory.json` remains unchanged and is not used as required PR evidence.
- `tooling-audit` reads the Project Brain memory-extension policy in
  `harness.contract.json`.
- The exact source-truth command passed in this checkout with `successfulRepos:
  1` and `errors: 0`.

Interpretation:

- Placeholder `memory.json` can no longer satisfy required PR evidence.
- Current operational memory proof now points to Project Brain required paths,
  `.harness/memory/LEARNINGS.md`, and learning-loop evidence rather than
  bootstrap shape.

## Validation Outcomes

| Command | Outcome |
| --- | --- |
| `pnpm exec tsx src/cli.ts tooling-audit --path . --json` | pass; `successfulRepos: 1`, `errors: 0`, `findings.total: 0`. |
| `pnpm exec tsx src/cli.ts policy-gate --files docs/agents/20-project-brain-memory-extension-rollout.md,.github/PULL_REQUEST_TEMPLATE.md --contract harness.contract.json --json` | pass; tier `medium`, no findings. |
| `pnpm exec tsx src/cli.ts docs-gate --mode required --json` | pass; 0 errors, 0 warnings, 17 informational required-surface findings. |
| `pnpm exec markdownlint-cli2 docs/agents/20-project-brain-memory-extension-rollout.md .harness/review/2026-05-08-JSC-288-governance-prose-compression.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass; 0 errors. |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/review/2026-05-08-JSC-288-governance-prose-compression.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass. |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/review/2026-05-08-JSC-288-governance-prose-compression.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass. |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/review/2026-05-08-JSC-288-governance-prose-compression.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass. |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/evals/coding-harness-governance-contract-memory-simplification-eval.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass. |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/evals/coding-harness-governance-contract-memory-simplification-eval.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass. |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/evals/coding-harness-governance-contract-memory-simplification-eval.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass. |
| `pnpm exec markdownlint-cli2 .harness/evals/coding-harness-governance-contract-memory-simplification-eval.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | pass; 0 errors. |
| `pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json` | pass; no findings. |
| `git diff --check -- .github/PULL_REQUEST_TEMPLATE.md docs/agents/20-project-brain-memory-extension-rollout.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md .harness/review/2026-05-08-JSC-288-contract-ownership-map.md .harness/review/2026-05-08-JSC-288-required-trust-evidence-repair.md .harness/review/2026-05-08-JSC-288-governance-prose-compression.md .harness/evals/coding-harness-governance-contract-memory-simplification-eval.md` | pass. |
| `bash scripts/validate-codestyle.sh --fast` | pass after final eval/docs edits; command exited 0 with baseline drift-gate warnings, Node `mkdtemp()` portability warnings, and passing test suites. |

## Residual Risks

| Risk | Status | Handling |
| --- | --- | --- |
| Bare `pnpm exec harness tooling-audit --path . --json` package parity currently fails against this checkout. | Known, not blocking JSC-288. | PR template now uses source-truth `pnpm exec tsx src/cli.ts tooling-audit --path . --json`; packaged parity belongs to JSC-283/JSC-282 follow-up lanes. |
| `.harness/learnings/coderabbit.local.json` may be absent. | Known, non-blocking. | PR template keeps explicit `n.a.` evidence path when no local imported learning artifact exists. |
| Human review still required before merge. | Open. | Required because PR evidence and governed docs changed. |

## Closure Recommendation

Do not close JSC-288 until a human review accepts the PR-template evidence
change and governed-doc authority compression.

After human review, JSC-288 may be closed without additional implementation
work if the final closeout reruns the focused gates and records exact outcomes.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status | Evidence |
| --- | --- | --- | --- |
| `JSC-288` | `SA-288-001` through `SA-288-012` | Implementation-complete, human review required before closure | This eval, plan, inventory, memory decision, contract ownership map, trust evidence repair, and prose compression artifacts. |

## Evidence Matrix

| Conclusion | Evidence type | Files | Confidence | Why it matters |
| --- | --- | --- | --- | --- |
| Placeholder memory no longer satisfies required PR evidence. | source diff, validation | `.github/PULL_REQUEST_TEMPLATE.md`; `memory.json`; required trust evidence artifact | High | Removes the core false-trust path. |
| Project Brain/local memory is the accepted replacement trust path. | decision artifact, contract, validation | `.harness/review/2026-05-08-JSC-288-memory-ownership-decision.md`; `harness.contract.json`; `.harness/memory/LEARNINGS.md` | High | Aligns required evidence with current operational memory. |
| Contract compatibility was preserved. | design artifact, validation | `.harness/review/2026-05-08-JSC-288-contract-ownership-map.md`; `harness.contract.json` | High | Prevents JSC-288 from drifting into unapproved contract fragmentation. |
| Governance prose compression did not orphan authority. | docs diff, docs gate | `docs/agents/20-project-brain-memory-extension-rollout.md`; tooling, memory, validation docs | Medium-high | Keeps rollout history while making live authority explicit. |
