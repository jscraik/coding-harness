---
last_validated: 2026-04-26
---

# Quickstart

## Table of Contents

- [Prerequisites](#prerequisites)
- [Agent-native loop](#agent-native-loop)
- [Local verification](#local-verification)
- [Create a PR](#create-a-pr)
- [Command reference](#command-reference)
- [Where to go next](#where-to-go-next)

## Prerequisites

```bash
node -v   # >= 24.0.0
pnpm -v   # 10.33.0
```

## Agent-native loop

Use `harness next --json` as the first read-only entrypoint when an agent needs
to decide what to do in the current checkout.

```bash
harness next --json
```

Read `nextCommand` from the JSON response, check `safeToRun`, then run the
recommended command when it is safe. Use that command's evidence to continue,
fix the reported issue, or escalate to a human. Run `harness next --json` again
after repo state changes.

```bash
harness next --json
# run the returned nextCommand when safeToRun is true
harness next --json
```

For the full command contract, see
[CLI reference: agent cockpit entrypoint](../cli-reference.md#agent-cockpit-entrypoint).

## Local verification

```bash
pnpm install
bash scripts/validate-codestyle.sh --fast
pnpm check
bash scripts/verify-work.sh --fast
```

Run the codestyle wrapper before aggregate checks when hook-exported `GIT_*`
values may be present; it sanitizes those values before nested `pnpm run`
commands.

## Create a PR

```bash
git checkout -b codex/JSC-XXX-short-description
# ... make changes ...
bash scripts/validate-codestyle.sh
git add -A && git commit
git push -u origin HEAD
```

Run the full gate suite before handoff when behavior or policy surfaces changed:

```bash
bash scripts/verify-work.sh
```

## Command reference


| Command                                                    | Purpose                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm check`                                               | lint + typecheck + test + audit                                                          |
| `pnpm lint`                                                | Biome check                                                                              |
| `pnpm typecheck`                                           | TypeScript compiler no-emit check                                                        |
| `pnpm test`                                                | Vitest run                                                                               |
| `pnpm build`                                               | Compile to dist/                                                                         |
| `harness next --json`                                      | Inspect current state and recommend the next safe existing harness command               |
| `bash scripts/harness-cli.sh source-outline <path> --json` | Inspect TypeScript-family comments and signatures before raw file reads in this checkout |


## Where to go next

- Tooling details: [02-tooling-policy.md](./02-tooling-policy.md)
- Validation gates: [04-validation.md](./04-validation.md)
- Linear workflow: [13-linear-production-workflow.md](./13-linear-production-workflow.md)
- Full instruction map: [01-instruction-map.md](./01-instruction-map.md)
