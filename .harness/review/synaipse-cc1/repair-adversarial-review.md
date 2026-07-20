# CC1 Repair Adversarial Review — Blocked Target Identity

## Packet and instruction attestation

- Packet: `pkt_synaipsecc1repairadv01`
- Role: `Adversarial Review`
- Requested runtime policy: `gpt-5.6-luna` with `xhigh` reasoning.
- Observed runtime limitation: the available coordinator runtime is `gpt-5.6-terra` with `xhigh` reasoning; no Luna attestation was visible.
- Applicable instruction chain read: `AGENTS.md`, `src/AGENTS.md`, `contracts/AGENTS.md`, and `CODESTYLE.md`.

## Immutable target guard

The packet requires immutable target `63188bcda5855424b2db48f075397e0b938bb73b`. The checked-out worktree instead reports `63188bcde2aa2ae68a6fede7790dfa76e7d0a6a4`.

`git rev-parse --verify 63188bcda5855424b2db48f075397e0b938bb73b` confirms that the packet target exists, but it is not the current checkout. The packet makes target-SHA drift a stop condition, so I did not inspect source behavior or run the packet test commands against the mismatched checkout.

The packet itself also cannot support a strict `pm-child-result/v1` validation: `target.baseline_sha` is the eight-character prefix `3e9e5f52`, while the result schema requires a 40-character SHA, and `evidence.artifact_probe` is absent even though the child-packet schema requires it. This is a packet-authoring defect, separate from the target mismatch.

## Finding

- **P1 — immutable-target mismatch:** given a review packet bound to `63188bcda5855424b2db48f075397e0b938bb73b`, the reviewer should assess exactly that commit; actual `HEAD` is `63188bcde2aa2ae68a6fede7790dfa76e7d0a6a4`. Evidence produced on the current checkout would not be packet-bound. The Project PM must reconcile the intended final SHA, issue a corrected packet if required, then obtain a fresh adversarial review.
- **P1 — malformed child packet:** the packet omits the required artifact-probe binding and uses a short baseline SHA. A result cannot simultaneously satisfy the strict result schema and bind its `baseline_sha` to this packet. The Project PM must issue a schema-valid replacement packet before relying on an adversarial result.

## Commands

- Command: `git rev-parse HEAD` -> fail (returned `63188bcde2aa2ae68a6fede7790dfa76e7d0a6a4`, which differs from packet target `63188bcda5855424b2db48f075397e0b938bb73b`)
- Command: `git rev-parse --verify 63188bcda5855424b2db48f075397e0b938bb73b` -> pass (packet target object exists but is not checked out)
- Command: `PYTHONPATH=/Users/jamiecraik/dev/jamie-brain uv run --project /Users/jamiecraik/dev/jamie-brain python -c '...validate_child_result(...)...'` -> fail (validator reports the packet has no required `artifact_probe` and has invalid short baseline SHA; the structurally valid result cannot bind to that malformed baseline)

## Claims boundary

This is a blocked packet-identity result only. It does not assess the repair, validate the three nested recommendation-effects levels, verify outer-meta or legacy operational-plan compatibility, establish local QA, acceptance, hosted CI, external review, PR state, merge, release, or readiness.

WROTE: .harness/review/synaipse-cc1/repair-adversarial-review.md
