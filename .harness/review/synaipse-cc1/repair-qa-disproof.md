# CC1 repair QA disproof

## Attestation

- Packet: `pkt_synaipsecc1repairqa01` (`pm-child-task-packet/v1`)
- Role: QA Disproof
- Requested runtime: `gpt-5.6-luna` with xhigh reasoning.
- Observed runtime: `gpt-5.6-terra` with xhigh reasoning; the requested Luna
  runtime was not available to this child, so this limitation is recorded rather
  than silently downgraded.
- Immutable target: `cb50e6e2705bde993105c55d7c5690fba14fddcd`
- Target verification: `git rev-parse HEAD` returned the packet target before
  inspection. The only pre-existing dirty path was the PM-provided QA packet.

## Disproof scope

Tried to disprove the CC1 repair by adding an undeclared `mutatesExternal` key
at each closed level of the versioned `meta.recommendationEffects` projection:
the projection itself, `authority`, and `permissionPlan`. Also tried to show
that the change accidentally narrowed the deliberately additive outer `meta`
or legacy `meta.execution.permissionPlan` surfaces.

## Results

No disproof finding. The direct validator probe produced these results:

| Candidate | Expected | Actual |
| --- | --- | --- |
| Baseline recommendation effect | valid | valid |
| Unknown `recommendationEffects.mutatesExternal` | invalid | invalid |
| Unknown `authority.mutatesExternal` | invalid | invalid |
| Unknown `permissionPlan.mutatesExternal` | invalid | invalid |
| Extra outer `meta.extension` | valid | valid |
| Extra legacy `execution.permissionPlan.extension` | valid | valid |

The rejecting diagnostics were assertion-shaped and location-specific:

- `meta.recommendationEffects.mutatesExternal is not allowed`
- `meta.recommendationEffects.authority.mutatesExternal is not allowed`
- `meta.recommendationEffects.permissionPlan.mutatesExternal is not allowed`

## Commands

- Command: `git rev-parse HEAD` -> pass (returned `cb50e6e2705bde993105c55d7c5690fba14fddcd`, matching the packet target).
- Command: `pnpm exec vitest run src/lib/decision/harness-decision.test.ts src/commands/next-decision-meta.test.ts src/commands/next-fitness-report.test.ts --reporter=dot` -> pass (3 files and 34 tests passed).
- Command: `pnpm exec tsc --noEmit` -> pass (completed with no diagnostics).
- Command: `git diff --check 3e9e5f52..cb50e6e2705bde993105c55d7c5690fba14fddcd` -> pass (no whitespace errors).
- Command: `node --import tsx --input-type=module` -> pass (direct six-candidate validator probe rejected every unknown versioned key and accepted both additive compatibility candidates).

## Verdict and claims boundary

`no_findings`. This fresh local QA disproof proves only the packet-listed
validator behavior and focused source/type/diff checks at the immutable target.
It does not prove hosted CI, external provider review, acceptance, PR state,
merge, release, or overall programme readiness. A fresh adversarial review and
the PM's subsequent admission decision remain separate gates.

WROTE: .harness/review/synaipse-cc1/repair-qa-disproof.md
