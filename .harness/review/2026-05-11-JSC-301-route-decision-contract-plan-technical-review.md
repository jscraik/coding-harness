---
schema_version: 1
artifact_id: jsc-301-route-decision-contract-plan-technical-review
artifact_type: he-code-review-technical-review
canonical_slug: jsc-301-route-decision-contract-plan-technical-review
title: JSC-301 RouteDecision/v1 Contract Plan Technical Review
harness_stage: he-code-review
status: pass
date: 2026-05-11
traceability_required: true
origin: .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md
linear_issue: JSC-301
linear_parent: JSC-300
linear_status: Todo
linear_project: coding-harness
---

# JSC-301 RouteDecision/v1 Contract Plan Technical Review

## Table of Contents

- [Review Target](#review-target)
- [Verdict](#verdict)
- [Findings](#findings)
- [Resolved Findings](#resolved-findings)
- [Material Risks Checked](#material-risks-checked)
- [Evidence Reviewed](#evidence-reviewed)
- [Validation Evidence](#validation-evidence)
- [Residual Risks](#residual-risks)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Recommended Next Step](#recommended-next-step)

## Review Target

Reviewed artifact:

- `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`

Supporting artifacts:

- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md`
- `src/lib/decision/harness-decision.ts`
- `src/lib/decision/harness-decision.test.ts`

Review scope:

- Plan readiness for `JSC-301` implementation.
- Spec and plan alignment for route decision contracts.
- TypeScript public API clarity.
- Validation and mapper behavior.
- Safety boundaries around command strings, redaction evidence, and cockpit
  metadata.
- Guardrails against accidental `JSC-302` or `JSC-304` scope leakage.

## Verdict

Status: pass after revision.

The plan is implementation-ready for `JSC-301` as a bounded contract slice. The
technical review found two blocker-grade contract gaps and one medium design
tradeoff. The blocker-grade gaps were resolved in the plan and supporting spec
before closeout. The remaining medium tradeoff is explicitly deferred to
`JSC-302` because it concerns adapter refresh behavior rather than the initial
contract surface.

## Findings

No unresolved blocker or high-severity findings remain.

## Resolved Findings

| Severity | Finding | Resolution | Evidence |
| --- | --- | --- | --- |
| High | Redaction provenance was present on `RouteDecision` but absent from lifecycle metadata. | Added `redactionsApplied: string[]` to `HarnessDecisionLifecycleRouteMeta`, required mapper preservation, added mapper provenance fixture and test scenario, and updated the spec compatibility envelope. | `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`; `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md` |
| High | Shared blocker vocabulary was declared but the plan hardcoded a new union without a canonical source. | Added exported canonical route id and blocker-boundary constants, derived public types from those constants, and required validator tests to reuse those constants. | `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` |
| Medium | Collision policy rejects any existing `meta.lifecycleRoute` with no idempotent same-value path. | Kept deterministic rejection for `JSC-301`; deferred idempotent refresh semantics to `JSC-302` because repeated adapter execution is outside the initial contract slice. | `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` |

## Material Risks Checked

| Risk | Result |
| --- | --- |
| Public API ambiguity | Mitigated by explicit exported constants, interfaces, validation result type, type guard, and mapper signatures. |
| Validation behavior drift from existing decision contract | Mitigated by requiring `{ valid, errors }`, accumulated deterministic strings, and `isRouteDecision` mirroring `isHarnessDecision`. |
| Command execution safety | Mitigated by keeping `targetCommand` metadata-only and forbidding parser, shell, or top-level command promotion in `JSC-301`. |
| Cockpit behavior mutation | Mitigated by mapper constraints that preserve all top-level `HarnessDecision` fields and only attach nested `meta.lifecycleRoute`. |
| Redaction metadata loss | Mitigated by preserving `redactionsApplied` in the nested lifecycle metadata envelope. |
| Vocabulary drift | Mitigated by exported canonical route id and blocker-boundary constants. |
| Scope leakage into `harness next` or public `harness route --json` behavior | Mitigated by allowed-file limits and stop rules that block edits to `src/commands/next.ts` or public CLI surfaces in `JSC-301`. |

## Evidence Reviewed

Repository evidence:

- `CODESTYLE.md`
- `codestyle/08-typescript.md`
- `codestyle/18-code-review.md`
- `codestyle/19-development-workflow.md`
- `src/lib/decision/harness-decision.ts`
- `src/lib/decision/harness-decision.test.ts`

Harness Engineering evidence:

- `<USER_HOME>/dev/agent-skills/Plugins/harness-engineering/skills/he-plan/SKILL.md`
- `<USER_HOME>/dev/agent-skills/Plugins/harness-engineering/skills/he-plan/references/deepening-review.md`
- `<USER_HOME>/dev/agent-skills/Plugins/harness-engineering/skills/he-code-review/SKILL.md`

Reviewer evidence:

- Subagent `jsc301_plan_reviewer` reviewed the plan and supporting spec as a
  technical plan gate before implementation.

## Validation Evidence

Completed before this review artifact was written:

- Command: `python3 <USER_HOME>/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` -> pass
- Command: `python3 <USER_HOME>/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` -> pass
- Command: `python3 <USER_HOME>/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` -> pass
- Command: `pnpm markdownlint .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` -> pass

Pending after this artifact is written:

- Re-run Harness Engineering artifact linters across the updated plan, updated
  spec, and this review artifact.
- Re-run markdownlint across the updated plan, updated spec, and this review
  artifact.

## Residual Risks

| Risk | Owner | Handling |
| --- | --- | --- |
| Same-value lifecycle-route idempotency may be useful once `JSC-302` repeatedly attaches route metadata. | `JSC-302` | Keep `JSC-301` deterministic rejection; design idempotent refresh only when adapter behavior exists. |
| The future public `harness route --json` command may need a stricter output schema than the internal mapper envelope. | `JSC-304` | Do not expose public CLI in `JSC-301`; require a separate expert exposure spec. |
| Existing `harness next` tests may reveal hidden coupling when the new module is imported. | `JSC-301` implementation | Run the focused route-decision, harness-decision, and next regression tests before handoff. |

## Linear Work Item Contract

Issue: `JSC-301`.

Parent: `JSC-300`.

Status expectation: keep `Todo` until implementation starts.

Blocked follow-on work:

- `JSC-302` remains blocked by `JSC-301`.
- `JSC-303` remains blocked by `JSC-302`.
- `JSC-304` remains blocked by `JSC-303`.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Artifact coverage |
| --- | --- | --- |
| `JSC-300` | Parent | This review keeps `JSC-301` bounded to the internal contract needed before adapter or automation loop work. |
| `JSC-301` | `SA-301-001` through `SA-301-014` | Plan is pass after review for `RouteDecision/v1`, validation, mapper, and focused tests. |
| `JSC-302` | Follow-on | Idempotent refresh behavior and runtime `harness next` attachment remain deferred here. |
| `JSC-303` | Follow-on | No executable loop behavior is admitted by this plan review. |
| `JSC-304` | Follow-on | No public `harness route --json` command is admitted by this plan review. |

## Recommended Next Step

Proceed to `JSC-301` implementation only after explicit user approval.
Implementation should start with the type contract and constants, then validator,
then mapper, then focused tests.
