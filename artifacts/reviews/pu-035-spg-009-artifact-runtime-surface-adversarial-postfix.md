# Adversarial Postfix Review - PU-035 / SPG-009 ArtifactRuntimeSurface/v1

## Scope Reviewed
- src/lib/artifact-runtime-surface/**
- scripts/validate-artifact-runtime-surface.cjs
- contracts/artifact-runtime-surface.schema.json
- contracts/examples/artifact-runtime-surface.example.json
- contracts/runtime-packet-schemas.manifest.json
- src/dev/validate-runtime-packet-schemas-script.test.ts

## Findings (Severity Ordered)
No material adversarial findings remain in the reviewed scope.

## Prior Finding Re-Verification

1. Stale artifact mislabeled current via forged `headSha/currentHeadSha`: **fixed**
- Evidence: `scripts/validate-artifact-runtime-surface.cjs:100-102` resolves live repo HEAD via `readGitHead(repoRoot)`.
- Evidence: `scripts/validate-artifact-runtime-surface.cjs:213-217` rejects when `currentHeadSha` does not match live repository HEAD.
- Evidence: `src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts:209-227` asserts standalone validator failure for live-head mismatch.
- Impacted behavior: claim-support packets can no longer be accepted by the standalone semantic validator with forged/stale head values.

2. Secret-like content evasion in allowed fields: **fixed**
- Evidence: `src/lib/artifact-runtime-surface/validation-constants.ts:125-126` expands `SECRET_VALUE_PATTERN`.
- Evidence: `src/lib/artifact-runtime-surface/validation-helpers.ts:194-200` rejects secret-like scalar values in any allowed string field.
- Evidence: `scripts/validate-artifact-runtime-surface.cjs:21-22, 434-435` applies equivalent CJS-side rejection.
- Evidence: `src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts:178-184` validates rejection path.
- Impacted behavior: token/JWT/Bearer/private-key style values are rejected even when field names are otherwise allowed.

3. Unknown fields accepted by standalone CJS validator: **fixed**
- Evidence: `scripts/validate-artifact-runtime-surface.cjs:23-60` defines allowed key sets for packet and nested objects.
- Evidence: `scripts/validate-artifact-runtime-surface.cjs:133-157, 341-345` enforces unknown-key rejection at top-level and nested structures.
- Evidence: `src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts:230-255` asserts rejection for injected unknown fields.
- Impacted behavior: CJS validator now matches schema strictness for additionalProperties=false semantics across packet/nested objects.

4. Path/symlink/reference bypasses: **fixed**
- Evidence: `scripts/validate-artifact-runtime-surface.cjs:295-333` validates resolved and real paths stay under repo root, rejects symlink escapes, checks file-size/checksum against disk.
- Evidence: `src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts:186-207` asserts symlink-escape rejection.
- Evidence: `src/lib/artifact-runtime-surface/validation-helpers.ts:74-97, 99-116` and `scripts/validate-artifact-runtime-surface.cjs:348-357, 360-375` enforce traversal-free repo-relative path and preview:file constraints.
- Impacted behavior: claim-support artifact references are constrained to in-repo files with on-disk integrity checks.

5. Example instability due future HEAD drift: **fixed**
- Evidence: `contracts/examples/artifact-runtime-surface.example.json:7-10, 37-41` is now `audit_trail` with null head fields and unsupported claimSupport.
- Evidence: `src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts:258-286` asserts checked-in example passes standalone validator and remains orientation/audit-trail shape.
- Impacted behavior: public example remains stable across future repository commits.

## Validation Evidence
- `node scripts/validate-artifact-runtime-surface.cjs contracts/examples/artifact-runtime-surface.example.json --repo-root .` -> pass (exit 0)
- `pnpm -s vitest src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --run` -> 36 tests passed (exit 0)

## Residual Risks
- TypeScript validator (`validateArtifactRuntimeSurface`) enforces internal claim-support consistency but does not itself resolve live git HEAD; live-head freshness remains owned by standalone runtime semantic validation. This is acceptable only where the workflow contract guarantees CJS semantic validation in claim-support lanes.

## Accountability Receipt
- status: complete
- artifact_paths: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-adversarial-postfix.md
- manifest_path: n/a (coordinator did not request run manifest path override and no default manifest contract was provided for this custom artifact filename)
- findings: none material; all prior adversarial scenarios re-verified as fixed
- failures_or_blockers: none
- improvement_opportunities: add an explicit integration gate proving claim-support packet producers always run standalone live-head semantic validation before closeout
- strengths: strong parity between TS/CJS forbidden-value guards, strict unknown-key checks, and concrete symlink/root containment tests
- validation_evidence:
  - node scripts/validate-artifact-runtime-surface.cjs contracts/examples/artifact-runtime-surface.example.json --repo-root . (pass)
  - pnpm -s vitest src/lib/artifact-runtime-surface/artifact-runtime-surface.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts --run (pass)
- next_action: keep standalone semantic validator as mandatory lane for claim-support evidence packets

WROTE: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-adversarial-postfix.md
