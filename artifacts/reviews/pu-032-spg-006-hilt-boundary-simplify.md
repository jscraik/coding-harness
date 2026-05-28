# PU-032/SPG-006 HILT Boundary Simplify Lens

## Scope

Reviewed the current diff for behavior-preserving simplification opportunities.

## Actions Taken

- Removed the unreachable `medium` risk tier from `DecisionRequestRiskTier` and the JSON Schema because all accepted HILT boundaries are either `high` or `critical`.
- Kept `hilt-boundary.ts` as a small policy module rather than inlining the checks back into `builder.ts`; inlining would reduce file count but increase caller-facing complexity.

## Findings

No material simplification findings remain.

The main simplification candidate was the unused `medium` branch. It has been removed from `src/lib/decision-request/types.ts:47`, from `contracts/decision-request.schema.json:124`, and from `riskTierFor` in `src/lib/decision-request/hilt-boundary.ts:104`.

## Skipped

- Did not collapse `blockerClassFor` and `riskTierFor` into one object literal. The switch form is clearer for the current closed union and lets TypeScript expose future missing return coverage.
- Did not add a separate public command family. The existing `decision-request` command is the right narrow surface.

## Validation Evidence

- `pnpm exec biome check --write src/lib/decision-request/types.ts src/lib/decision-request/hilt-boundary.ts contracts/decision-request.schema.json` -> pass
- `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass

## Verdict

Simplify lens approves this slice.
