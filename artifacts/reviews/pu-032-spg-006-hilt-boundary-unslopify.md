# PU-032/SPG-006 HILT Boundary Unslopify Lens

## Scope

Reviewed the slice for stale exports, dead branches, placeholder taxonomy, unreachable test paths, and docs-only behavior.

## Cleanup Ledger

| Item | Classification | Evidence | Action |
| --- | --- | --- | --- |
| `medium` risk tier | stale placeholder | No accepted boundary emitted `medium`; `riskTierFor` only maps HILT categories to `high` or `critical` | Removed from TypeScript and schema |
| `routine_uncertainty` boundary | invalid input | Regression asserts builder and CLI reject it with `decision-request.invalid_boundary` | Kept negative tests |
| Claim-sensitive boundary without proof | false-success risk | Regression asserts `merge_readiness` without evidence and `stale_claim_support` with current freshness fail | Kept negative tests |

## Findings

No material slop findings remain.

The new untracked module `src/lib/decision-request/hilt-boundary.ts` is not orphaned; it is imported by `src/lib/decision-request/builder.ts:14` and exercised through the command tests. The schema change is not docs-only; `node scripts/validate-runtime-packet-schemas.cjs --all` validates the example packet against the updated contract.

## Rollback Notes

Rollback is narrow: revert the HILT-boundary module, remove `hiltBoundary` from `DecisionRequestPacket`, restore schema/example shape, and restore command tests. No persistent data migration is involved.

## Validation Evidence

- `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` -> pass
- `node scripts/validate-runtime-packet-schemas.cjs --all` -> pass
- `pnpm test:deep` -> blocked at E2E credential lane only; unit/integration portions passed before missing GitHub/Linear credentials blocked E2E. The approved env path `~/.codex/.env` is a FIFO with no writer in this runtime.

## Verdict

Unslopify lens approves this slice.
