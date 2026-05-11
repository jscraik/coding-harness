---
schema_version: 1
artifact_id: jsc-301-route-decision-contract-spec-technical-review
artifact_type: he-code-review-technical-review
canonical_slug: jsc-301-route-decision-contract-spec-technical-review
title: JSC-301 RouteDecision/v1 Contract Spec Technical Review
harness_stage: he-code-review
status: pass
date: 2026-05-11
traceability_required: true
origin: .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md
linear_issue: JSC-301
linear_parent: JSC-300
linear_status: Todo
linear_project: coding-harness
---

# JSC-301 RouteDecision/v1 Contract Spec Technical Review

## Table Of Contents

- [Review Target](#review-target)
- [Verdict](#verdict)
- [Findings](#findings)
- [Resolved Review Findings](#resolved-review-findings)
- [Material Risks Checked](#material-risks-checked)
- [Evidence Reviewed](#evidence-reviewed)
- [Validation Evidence](#validation-evidence)
- [Residual Risks For he-plan](#residual-risks-for-he-plan)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Recommended Next Step](#recommended-next-step)

## Review Target

- Spec:
  `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- Linear issue: `JSC-301`
- Parent issue: `JSC-300`
- Downstream issues: `JSC-302`, `JSC-303`, `JSC-304`
- Review date: 2026-05-11
- Review type: technical spec gate before `he-plan`

## Verdict

Pass after revision.

The spec is suitable for `he-plan`. The review initially found contract
ambiguity around unsafe route attachment, cross-field invariants,
`action_required` blocker semantics, and merge behavior for existing
`meta.lifecycleRoute`. Those risks were resolved in the spec before this review
artifact was finalized.

The resulting contract keeps lifecycle routing advisory, prevents
`targetCommand` from becoming execution authority, requires validation for
cross-field semantics, and blocks silent metadata overwrite. That is enough for
`JSC-301` to proceed as a pure TypeScript contract and fixture slice.

## Findings

No blocking findings remain.

## Resolved Review Findings

| Severity | Original finding | Resolution |
| --- | --- | --- |
| High | `safeToUse: false` attachment policy was ambiguous. | The spec now explicitly allows valid unsafe routes to attach only as nested advisory evidence and forbids them from changing top-level cockpit action fields. |
| High | Cross-field invariants were under-specified. | The spec now requires validator enforcement for `human_escalation`, `none`, `mutates`, `safeToUse`, status, `failureClass`, and `blockerBoundary` relationships. |
| Medium | `action_required` boundary semantics were nondeterministic. | The spec now includes a status and boundary truth table that distinguishes no-blocker action-required states from recoverable route blockers. |
| Medium | Merge behavior was undefined when `meta.lifecycleRoute` already existed. | The spec now requires the default mapper to reject existing lifecycle route metadata instead of silently overwriting it. |

## Material Risks Checked

| Risk | Review result |
| --- | --- |
| Second cockpit authority plane | Pass. `RouteDecision/v1` remains advisory, and `HarnessDecision/v1` remains the cockpit action envelope. |
| `harness next` behavior regression | Pass. The spec makes `src/commands/next.ts` runtime integration out of scope for the first unit and requires existing tests to continue passing. |
| Command injection through route metadata | Pass. `targetCommand` is metadata only, free-form text is never shell-interpolated, and shell-like input requires fixture coverage. |
| Unsafe metadata treated as actionable | Pass. `safeToUse: false` may only attach as nested advisory evidence and cannot affect top-level cockpit fields. |
| Silent metadata overwrite | Pass. Existing `meta.lifecycleRoute` must be rejected by the default mapper. |
| Weak blocked-route taxonomy | Pass. Blocked and failed route decisions require non-empty `failureClass` and non-`none` `blockerBoundary`. |
| Ambiguous action-required recovery | Pass. The truth table allows recoverable `action_required` route blockers without forcing command-specific failure classes. |
| TypeScript implementation drift | Pass. The spec requires public JSDoc, `.js` import extensions, type-only imports, explicit guards, and no `Record<string, any>`. |
| Linear scope drift | Pass. `JSC-301` owns only contract and mapper semantics; `JSC-302`, `JSC-303`, and `JSC-304` remain separate downstream decisions. |

## Evidence Reviewed

- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:70`
  through line 72 constrain the slice to contract freeze without public
  `harness route --json` or `harness next` behavior changes.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:148`
  through line 174 define the Linear work item boundary and block closure if
  implementation changes top-level cockpit behavior under `JSC-301`.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:341`
  through line 360 define validation requirements for schema, route ids,
  failure class, blocker boundary, arrays, and metadata typing.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:366`
  through line 380 define the attachment policy, invalid-route behavior, and
  default metadata collision handling.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:404`
  through line 420 define additive mapping rules that preserve top-level
  `HarnessDecision` fields.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:453`
  through line 472 define command-safety and `human_escalation` requirements.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:474`
  through line 499 define cross-field invariants and the status/boundary truth
  table.
- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md:671`
  through line 688 define acceptance IDs, including cross-field validation and
  mapper collision tests.
- `src/lib/decision/harness-decision.ts` defines the current
  `HarnessDecision` schema, operational metadata, and validation model.
- `src/commands/next.ts` emits `HarnessDecision` for `harness next`.
- `src/commands/next.test.ts` and `src/lib/decision/harness-decision.test.ts`
  cover current failure-class behavior.
- `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md`
  provides the existing cockpit recovery vocabulary and `blockerBoundary`
  direction.

## Validation Evidence

- Command:
  `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
  -> pass
- Command:
  `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
  -> pass
- Command:
  `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
  -> pass
- Command:
  `pnpm markdownlint .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
  -> pass

## Residual Risks For he-plan

- The implementation plan must decide whether `withLifecycleRouteMeta` returns
  a validation result or throws on existing `meta.lifecycleRoute`; the spec only
  requires deterministic rejection.
- The implementation should keep route-decision tests independent from
  `src/commands/next.ts` until `JSC-302`; otherwise the contract slice may
  accidentally become adapter work.
- If `targetCommand` proves too tempting as command authority during
  implementation, `he-plan` should remove it or rename it before coding.
- The route id `heartbeat` is admitted as advisory vocabulary only. Any runtime
  heartbeat behavior belongs to `JSC-303`.
- Live Linear status should be refreshed before `he-plan`; this review validates
  the artifact and local source evidence, not current external tracker state.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-301` |
| Parent issue | `JSC-300` |
| Downstream issues | `JSC-302`, `JSC-303`, `JSC-304` |
| Project | `coding-harness` |
| Execution route | `he-plan` -> `he-work` |
| Required first unit | Pure `RouteDecision/v1` TypeScript contract, validator, mapper, and fixtures |
| Explicitly blocked | Public `harness route --json`, runtime `harness next` behavior changes, resume/automation execution |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Review result |
| --- | --- | --- |
| JSC-300 | SA-301-004, SA-301-005, SA-301-010, SA-301-011 | Pass. Parent integration remains advisory until later slices. |
| JSC-301 | SA-301-001 through SA-301-014 | Pass. Contract, validation, mapper, safety, and traceability are specified. |
| JSC-302 | SA-301-004, SA-301-005, SA-301-006, SA-301-010, SA-301-014 | Pass. Adapter can consume the mapper without redefining schema semantics. |
| JSC-303 | SA-301-002, SA-301-003, SA-301-007, SA-301-008, SA-301-009, SA-301-013 | Pass. Resume and automation fixtures inherit stable route failure semantics. |
| JSC-304 | SA-301-011 | Pass. Public route command exposure remains a later explicit decision. |

## Recommended Next Step

Run `he-plan` against
`.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`.

The plan should start with a pure implementation unit:

1. Add `src/lib/decision/route-decision.ts`.
2. Add `src/lib/decision/route-decision.test.ts`.
3. Prove schema validation, cross-field invariants, unsafe-input handling, and
   mapper collision behavior.
4. Run the focused validation listed in the spec before considering `JSC-302`.
