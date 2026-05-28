# PU-032/SPG-006 HILT Boundary Architecture Lens

## Scope

Reviewed the decision-request deep-module change for architecture depth, module locality, and agent navigation cost.

Files reviewed:

- `src/lib/decision-request/hilt-boundary.ts`
- `src/lib/decision-request/builder.ts`
- `src/lib/decision-request/types.ts`
- `contracts/decision-request.schema.json`
- `src/commands/decision-request.test.ts`

## Findings

No material architecture findings remain.

The change adds a real module seam instead of expanding the public command facade: `buildHiltBoundary` owns the closed HILT taxonomy, risk tier mapping, blocker class mapping, and claim-sensitive evidence checks in `src/lib/decision-request/hilt-boundary.ts:11`, `src/lib/decision-request/hilt-boundary.ts:25`, and `src/lib/decision-request/hilt-boundary.ts:32`. The packet builder delegates at `src/lib/decision-request/builder.ts:117`, preserving the builder as orchestration rather than scattering boundary policy across CLI parsing, packet assembly, and tests.

The contract remains additive and read-only: `DecisionRequestPacket` now requires `hiltBoundary` at `src/lib/decision-request/types.ts:91`, while `claimSupport` remains `not_closeout_proof` at `src/lib/decision-request/types.ts:27`.

## Deep Module Fit

- Leverage for callers: callers provide `--boundary`; they do not need to know the claim-sensitive stale-state rules.
- Locality for maintainers: adding or changing a boundary is concentrated in `hilt-boundary.ts`, the type union, and the JSON Schema enum.
- North-star fit: prevents routine uncertainty from becoming a human escalation artifact, reducing review/rework loops caused by false HILT requests.

## Validation Evidence

- `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass
- Live PR #309 check refresh with `gh pr checks 309 --repo jscraik/coding-harness --watch=false` -> pass at refresh time

## Residual Risk

The taxonomy is intentionally closed; future real HILT categories require synchronized updates to TypeScript, JSON Schema, examples, and tests.

## Verdict

Architecture lens approves this slice. No further architecture deepening is needed before independent reviewer review.
