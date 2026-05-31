# Project Brain CLI Modules

## Table of Contents

- [Ownership Map](#ownership-map)
- [Rule Grammar](#rule-grammar)
- [Validation](#validation)

## Ownership Map

| Surface | Owner |
| --- | --- |
| CLI flag parsing | `cli-args.ts` |
| Public result shapes | `cli-types.ts` |
| Search command | `query-cli.ts` |
| Staleness command | `stale-cli.ts` |
| Status command | `status-cli.ts` |
| Preflight command | `preflight-cli.ts` |
| Rule markdown grammar | `rules.ts` |
| Project Brain validation | `brain-validator.ts`, `lint-*.ts` |

Git environment handling for Project Brain preflight must use the shared
`sanitizeGitEnvironment` helper instead of local `GIT_*` deletion so packaged
and source-checkout validation follow the same trust-boundary rule.

Presenter logic currently lives inside each command module. If a command grows
large enough to extract a presenter, keep the presenter beside the command and
add a command-level test proving the CLI path uses it.

## Rule Grammar

Project Brain active rules use this markdown list grammar:

```md
- **R-id**: Rule text.
```

`parseBrainRules` is the shared parser for that grammar. Near-miss entries are
ignored by the parser and should be caught by Project Brain linting when they
appear in tracked knowledge files.

## Validation

Run focused Project Brain tests after parser or CLI-output changes:

```bash
pnpm vitest run src/lib/project-brain/rules.test.ts src/lib/project-brain/cli.test.ts
```

Expected result: the command exits 0 and proves rule identifiers stay unique,
durable destinations remain explicit, and Project Brain learning rules continue
to reject incomplete governance records. On failure, treat the output as a
Project Brain contract blocker and update either the rule fixture or the
validator before relying on the rule set as goal evidence.
