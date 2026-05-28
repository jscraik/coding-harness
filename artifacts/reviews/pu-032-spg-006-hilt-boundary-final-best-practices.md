# PU-032 / SPG-006 Final HILT-Boundary Re-review

## Scope Reviewed
- contracts/decision-request.schema.json
- src/dev/validate-runtime-packet-schemas-script.test.ts
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/commands/decision-request.test.ts
- docs/cli-reference.md

## Findings (Severity-ranked)
- No material issues found in the scoped surfaces.

## Verification Against Review Questions

1. Runtime and schema alignment for whitespace-only evidence refs
- Confirmed aligned.
- Schema now rejects whitespace-only refs via `pattern: "\\S"` on `evidenceRefs[]` in `contracts/decision-request.schema.json:82-88`.
- Runtime claim-sensitive guard trims refs before deciding presence (`ref.trim().length > 0`) in `src/lib/decision-request/hilt-boundary.ts:86-89`.
- Packet emission path also normalizes refs by trimming and dropping empties in `src/lib/decision-request/builder.ts:163-165`.
- Claim-sensitive blank-ref regression is covered in runtime tests at `src/commands/decision-request.test.ts:333-346`.

2. External packet/schema regression coverage
- Confirmed covered.
- Schema validator regression mutates the decision-request example to `evidenceRefs = ["   "]` and expects manifest validation failure with `must match pattern \\S` in `src/dev/validate-runtime-packet-schemas-script.test.ts:270-301`.
- This is the externally-authored packet path (schema/manifest validation), independent from CLI/runtime builder behavior.

3. Remaining gaps in scoped HILT-boundary contract
- No material gaps identified in the scoped files.
- Claim-sensitive boundaries enforce both:
  - at least one non-empty evidence ref after trimming; and
  - non-current stale-state evidence (`stale|missing|unknown`) via `src/lib/decision-request/hilt-boundary.ts:82-94`.
- `stale_claim_support` additionally forbids `freshness=current` at `src/lib/decision-request/hilt-boundary.ts:95-103`.
- CLI docs now reflect this boundary requirement in `docs/cli-reference.md:152-160`.

## Residual Risks
- Low: schema allows empty `evidenceRefs` arrays in general (only claim-sensitive boundaries require non-empty refs at runtime). This is intentional per current contract, but consumers ingesting external packets should continue relying on semantic validators for boundary-specific constraints.
- Low: boundary-specific semantic checks remain split between JSON Schema (shape) and runtime logic (cross-field policy), so future changes should keep both regression lanes updated together.

## Validation Evidence
- Reported by coordinator-run commands (post-fix):
  - `pnpm exec biome check --write contracts/decision-request.schema.json src/dev/validate-runtime-packet-schemas-script.test.ts` (pass)
  - `pnpm vitest run src/commands/decision-request.test.ts src/lib/cli/command-registry.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --reporter=dot` (pass, 229 tests)
  - `node scripts/validate-runtime-packet-schemas.cjs --all` (pass)

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-final-best-practices.md
