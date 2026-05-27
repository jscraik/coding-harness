# PU-027 GAP-011 Skill Density - Simplify Lens

## Status

pass

## Scope

Reviewed commit b062dd0219a4eaa3843f1c7bfa96646f4b29a43d for unnecessary abstraction, excess surface area, and avoidable governance spread.

## Simplification Assessment

The slice is scoped to the smallest useful enforcement point: `scripts/validate-packaged-skill.cjs`. It avoids a new command, dependency, schema package, or LLM scoring path.

Evidence:

- `scripts/validate-packaged-skill.cjs:470` uses deterministic token normalization instead of semantic scoring.
- `scripts/validate-packaged-skill.cjs:497` and `scripts/validate-packaged-skill.cjs:505` keep executable/advisory proof checks as simple filesystem predicates.
- `scripts/validate-packaged-skill.cjs:684` applies a fixed overlap threshold and allowlist check.
- `src/dev/validate-packaged-skill-script.test.ts:86` keeps coverage in one focused test suite with temporary fixture skills.

## Findings

No blocking simplification issue remains for recording R090.

The implementation is longer than the previous validator, but the added length corresponds to concrete acceptance criteria: metadata parsing, trigger extraction, class-specific validation, overlap policy, report output, and tests. Extracting modules now would add navigation cost before there is enough reuse pressure.

## Validation Evidence

- `pnpm exec biome check --write scripts/validate-packaged-skill.cjs src/dev/validate-packaged-skill-script.test.ts` -> pass after formatting
- `pnpm vitest run src/dev/validate-packaged-skill-script.test.ts` -> pass
- `pnpm skill:validate` -> pass
