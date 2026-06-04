# PU-054 Closeout Delivery-Truth Consumption Intent

Intent status: ready for review before implementation.

## Scope

Implement the smallest delivery-truth consumption seam for PU-014 by deriving delivery-truth/v1 verdicts from the validated pr-closeout state-packet bridge added in PU-053.

This slice is limited to claim-level delivery-truth consumption for state
already represented by the validated closeout packet bridge. It may derive only
the remote-checks-current and review-threads-resolved delivery-truth claims.

It must not derive or assert merge-ready, goal-ready-for-Judge-PM,
Linear-state-aligned, or root-surface-tidy claims.

## Target Deep Modules

- src/lib/pr-closeout/
- src/lib/delivery-truth/
- focused tests under the same module families

## In Scope

- Add an opt-in report option so buildPrCloseoutReport can consume verifier-owned state packets and project derived delivery-truth/v1 verdicts.
- Keep ordinary pr-closeout reports unchanged unless the new option is supplied.
- Use existing composeDeliveryTruth policy where possible so evidence receipt validation, claim-support evidence use, freshness, head SHA, and source-scope checks remain enforced.
- Cover positive and negative behavior with focused tests.
- Update architecture/governance docs only if the implemented seam changes the documented module boundary.

## Out of Scope

- No public delivery-truth command.
- No merge, auto-merge, Linear mutation, tracker closeout, Judge/PM-ready claim, or goal completion claim.
- No derived merge-ready or goal-ready-for-Judge-PM verdict from state packets.
- No derived Linear-state-aligned verdict until a first-class Linear source packet exists.
- No derived root-surface-tidy verdict; root-hygiene remains a separate module lane.
- No live Codex Desktop producer extraction.
- No final requirement audit.
- No broad rewrite of pr-closeout or delivery-truth internals.

## Acceptance Criteria

- A pr-closeout report can derive and consume delivery-truth verdicts from state packets when the option is supplied.
- Existing callers without the option preserve current behavior.
- Derived verdicts keep PR/CI, review, Linear, and merge readiness as separate claim lanes.
- The opt-in seam derives only remote-checks-current and review-threads-resolved verdicts.
- The seam never derives merge-ready, goal-ready-for-Judge-PM, Linear-state-aligned, or root-surface-tidy verdicts.
- Pending, missing, stale, orientation-only, or non-claim-support state evidence blocks delivery-truth closeout support.
- Focused pr-closeout, delivery-truth, and architecture-boundary tests pass.

## Review Notes

This slice is a bridge, not final closeout. Passing local tests may prove the seam, but it does not prove remote CI, review-thread truth, Linear field-text currency, Judge/PM readiness, or parent goal completion.
