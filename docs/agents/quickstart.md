# Quickstart

## Prerequisites

```bash
node -v   # >= 24.0.0
pnpm -v   # 10.33.0
```

## Hero workflows

### Install and validate

```bash
pnpm install
pnpm check            # lint + typecheck + test + audit
bash scripts/validate-codestyle.sh --fast
```

### Create a PR

```bash
git checkout -b codex/JSC-XXX-short-description
# ... make changes ...
bash scripts/validate-codestyle.sh
git add -A && git commit
git push -u origin HEAD
```

### Run the full gate suite

```bash
bash scripts/verify-work.sh
```

## Command reference

| Command | Purpose |
| --- | --- |
| `pnpm check` | lint + typecheck + test + audit |
| `pnpm lint` | Biome check |
| `pnpm typecheck` | TypeScript compiler no-emit check |
| `pnpm test` | Vitest run |
| `pnpm build` | Compile to dist/ |

## Where to go next

- Tooling details: [02-tooling-policy.md](./02-tooling-policy.md)
- Validation gates: [04-validation.md](./04-validation.md)
- Linear workflow: [13-linear-production-workflow.md](./13-linear-production-workflow.md)
- Full instruction map: [01-instruction-map.md](./01-instruction-map.md)
