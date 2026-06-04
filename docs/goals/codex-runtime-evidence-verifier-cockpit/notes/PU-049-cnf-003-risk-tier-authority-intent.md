# PU-049 CNF-003 Risk-Tiered Mutation Authority Intent

## Intent Contract

```yaml
intentId: PU-049-CNF-003

objective: Replace the blanket route-decision rule that every mutating route
requires human review with an explicit risk-tiered mutation policy that still
keeps route decisions advisory and non-executable.

ownedAcceptanceIds:

- CNF-003

acceptedFollowUpAcceptanceIds:

- CNF-003 live producer routing remains an accepted follow-up unless the
  existing route-decision module already exposes a narrow producer path that can
  be validated without widening command authority.

claimClasses:

- runtime_orientation
- agent_native_route_policy

excludedClaimClasses:

- command_authority
- delivery_truth
- review_state
- external_state
- tracker_authority
- merge_readiness
- judge_pm_readiness
- goal_completion

deepModuleBoundary:

- RouteDecision owns advisory lifecycle route metadata and mutation policy
  validation.
- DecisionRequest owns high and critical HILT authority boundaries.
- No caller may execute route.targetCommand from route-decision/v1 as authority.
- No delivery-truth or PR-closeout claim may be supported by this slice.

automationPlan:

- Add a small in-process mutation policy contract to route-decision/v1.
- Validate that only low-risk repo-local mutations with current evidence and
  validator ownership may set requiresHuman=false.
- Validate that destructive, external, tracker, production, release, security,
  credential, merge, ambiguous-governance, verifier-disagreement, unknown, and
  goal-completion mutations still require human review.
- Add focused route-decision tests and synchronized architecture/governance docs.

reviewStatus: pending_intent_review
```

## Purpose

Resume the Codex Runtime Evidence Verifier Cockpit goal with a bounded
implementation slice for CNF-003: risk-tiered agent-native mutation authority.

The current `route-decision/v1` validator rejects every mutating route unless
`requiresHuman=true`. That was safe, but it conflicts with the north-star
autonomy boundary: low-risk repo-local autonomy should be allowed when evidence
is deterministic and rollback is clear, while high-risk work remains
human-mediated.

This slice makes that distinction machine-readable. The route decision remains
advisory metadata; it does not make commands executable, authorize delivery
claims, update trackers, merge PRs, or close the parent goal.

## Source Evidence

- Goal addendum:
  `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
- Current route decision validator:
  `src/lib/decision/route-decision.ts`
- Current route decision tests:
  `src/lib/decision/route-decision.test.ts`
- HILT authority taxonomy:
  `src/lib/decision-request/types.ts`
- Decision-request HILT builder:
  `src/lib/decision-request/hilt-boundary.ts`
- Architecture source map:
  `ARCHITECTURE.md`
- Agent-governance docs:
  `docs/agents/00-architecture-bootstrap.md`
  `docs/agents/07b-agent-governance.md`
- North-star autonomy boundary:
  `docs/roadmap/north-star.md`

## Scope

In scope:

- Add a compact mutation policy object or equivalent fields to
  `RouteDecisionLifecycleFields`.
- Preserve `route-decision/v1` as additive advisory metadata over
  `harness-decision/v1`.
- Add closed taxonomies for:
  - mutation scope
  - mutation risk tier
  - mutation evidence freshness
  - validator ownership
  - mutation authority result
- Allow agent-native use only when all of these are true:
  - the route mutates only repo-local state
  - the mutation risk tier is low
  - supporting evidence is current
  - validator ownership is present
  - the route does not require network access
  - the route status and blocker metadata are otherwise valid
- Require human review for high-risk or ambiguous mutation classes, including:
  - destructive actions
  - external mutation
  - tracker authority
  - production operations
  - release actions
  - security-sensitive actions
  - credential or secret access
  - merge readiness
  - public contract owner decisions
  - goal completion
  - verifier disagreement
  - ambiguous governance
  - unknown mutation scope or risk
- Add focused route-decision tests for allowed low-risk repo-local mutation,
  blocked missing evidence, blocked missing validator ownership, and high-risk
  HILT-required mutation.
- Update architecture/governance docs if docs-gate reports architecture-context
  or agent-governance surfaces.
- Update the goal board, state, and receipts after validation.

## Non-Goals

- Do not add a public route command.
- Do not make `route.targetCommand` executable authority.
- Do not change `harness next` recommendation behavior.
- Do not wire delivery-truth, PR closeout, merge readiness, Linear, or
  Judge/PM claim support.
- Do not mutate `/Users/jamiecraik/dev/codex`.
- Do not weaken existing decision-request HILT boundaries.
- Do not classify medium-risk or network-dependent mutation as agent-executable
  in this slice.

## Design Intent

Use one deep-module policy seam inside `src/lib/decision/route-decision.ts`
instead of scattering exception logic across callers.

Expected shape:

- `mutationPolicy.scope` says what kind of state the route would mutate.
- `mutationPolicy.riskTier` separates low-risk repo-local work from
  high/critical HILT boundaries.
- `mutationPolicy.evidenceFreshness` proves whether the supporting evidence is
  current enough for autonomy.
- `mutationPolicy.validatorOwnership` proves whether a deterministic validator
  owns the mutation claim.
- `mutationPolicy.authority` records whether the route is not applicable,
  agent-local, or human-required.

Validation owns the safety rule:

- `mutates=false` must use a not-applicable policy.
- `mutates=true` with `requiresHuman=false` is valid only for
  `scope=repo_local`, `riskTier=low`, `evidenceFreshness=current`,
  `validatorOwnership=present`, `authority=agent_local`, and
  `requiresNetwork=false`.
- Any high-risk, critical, unknown, external, tracker, production, release,
  security, credential, merge, public-contract, goal-completion,
  verifier-disagreement, or ambiguous-governance policy must require human
  review.
- `human_escalation` routes still require human review regardless of mutation
  policy.

## Acceptance Criteria

- Route decisions expose a machine-readable mutation policy.
- Existing non-mutating route fixtures remain valid when they use the
  not-applicable mutation policy.
- A low-risk repo-local mutating route with current evidence and validator
  ownership can validate with `requiresHuman=false`.
- A mutating route with stale/missing/unknown evidence cannot validate with
  `requiresHuman=false`.
- A mutating route without validator ownership cannot validate with
  `requiresHuman=false`.
- High-risk and critical mutation scopes cannot validate with
  `requiresHuman=false`.
- Decision-request high/critical HILT boundary taxonomy remains unchanged and
  continues to represent human escalation requirements.
- Architecture and governance docs continue to state that route decisions are
  advisory and non-executable.
- Goal board and audit-freshness validators pass after receipt update.

## Validation Plan

Run focused validation first:

- `pnpm exec vitest run src/lib/decision/route-decision.test.ts`
- `pnpm exec vitest run src/commands/decision-request.test.ts`
- `pnpm typecheck`
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`

Widen if production source or docs-gate surfaces require it:

- `bash scripts/validate-codestyle.sh --fast`
- `pnpm check`

## Review Requirement

Before implementation, review this intent with:

- `planning-specialist-agent`
- `agent-native-reviewer`
- `adversarial-reviewer`

Before marking the slice done, review the implementation with:

- `improve-codebase-architecture`
- `simplify`
- `unslopify`
- `he-code-review`
- `testing`
- `adversarial-reviewer`
- `agent-native-reviewer`
- `best-practices-researcher`

## Stop Conditions

Stop rather than widening scope if:

- The policy needs a public command or `harness next` behavior change.
- Existing route-decision consumers rely on the blanket HILT invariant in a way
  that cannot be migrated safely in this slice.
- Validation requires external credentials or mutable external services.
- The implementation starts touching delivery-truth, PR closeout, Linear,
  merge-readiness, or Judge/PM authority.
- The slice cannot keep architecture/governance docs synchronized.
