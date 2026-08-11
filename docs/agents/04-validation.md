---
last_validated: 2026-08-09
---

# Validation and closeout

## Table of Contents

- [Routine route](#routine-route)
- [Validation by change](#validation-by-change)
- [Failure and retry](#failure-and-retry)
- [Credentialed checks](#credentialed-checks)
- [Pull request closeout](#pull-request-closeout)
- [Steering feedback](#steering-feedback)
- [Evidence format](#evidence-format)

## Routine route

Use the smallest gate needed for risk, then widen only when changed behavior or
repository policy requires it. Required gates remain fail-closed. The routine
sequence is:

```text
harness next --json
make the bounded change
harness verify-work --fast
harness pr-closeout --pr <number> --json
```

`harness verify-work --fast` is the integrated local route. Keep local tests,
runtime evidence, hosted checks, review, merge, release, and cleanup as separate
claims. Green checks do not prove complete closeout.

## Validation by change

Run focused behavioral tests first, then the applicable repository gates:

| Change | Required proof |
| --- | --- |
| Governed docs | `bash scripts/run-harness-gate.sh docs-gate --mode required --json`, `pnpm docs:lifecycle`, `pnpm docs:layer-budgets` |
| Production TypeScript | `pnpm run quality:docstrings`, `pnpm run quality:size`, `pnpm run test:related` |
| Tests | `pnpm run quality:self-affirming` |
| Static policy or generated contracts | `pnpm check:static` plus the focused validator or generator test |
| Runtime or artifact behavior | `pnpm test:deep` |
| Routine integrated handoff | `bash scripts/verify-work.sh --fast` |

Use `bash scripts/validate-codestyle.sh --fast` while iterating and the full
`bash scripts/validate-codestyle.sh` when the changed surface requires it. Do
not replace a required wrapper with a collection of underlying commands.

When validation exposes a fixable blocker in a touched file or required gate,
fix it in the same pass and rerun the narrowest proving command. Defer it only
when it crosses authority, credentials, destructive action, unrelated
ownership, or a tracked exception with an exact reason and owner.

## Failure and retry

Stop at the first failure, fix the demonstrated cause, and rerun from that
boundary. `bash scripts/verify-work.sh --resume-from <gate-id>` may reuse passed
gates only when repository, provider, schema, contract, and fingerprint still
match. Otherwise start a fresh run.

Classify failure as `contract_policy`, `internal_unknown`, `transient_infra`,
missing credential, or unrelated owned state. A missing external service blocks
only the claim it would prove. After two failed repairs at the same boundary,
request a scope or owner decision instead of an unchanged third retry.

## Credentialed checks

Use the Configs-owned wrapper for a fixed-output, value-blind canary:

```bash
CONFIGS_ROOT="${CODEX_CONFIGS_ROOT:-$HOME/dev/configs}"
AUTH_ENV_FILE="${CODEX_AUTH_ENV_FILE:-$HOME/.codex/.env}"
bash "$CONFIGS_ROOT/codex/scripts/run-auth-backed.sh" \
  --env-file "$AUTH_ENV_FILE" \
  --canary REQUIRED_ENV_NAME
```

Run each authorized authenticated stage through a fresh wrapper call:

```bash
CONFIGS_ROOT="${CODEX_CONFIGS_ROOT:-$HOME/dev/configs}"
AUTH_ENV_FILE="${CODEX_AUTH_ENV_FILE:-$HOME/.codex/.env}"
bash "$CONFIGS_ROOT/codex/scripts/run-auth-backed.sh" \
  --env-file "$AUTH_ENV_FILE" \
  --require-env REQUIRED_ENV_NAME -- <child command>
```

The mounted file is a 1Password-owned FIFO. Never read the FIFO and never source
the FIFO; do not print values, copy it, or reuse one stream across stages. A
passing canary
proves injection only; it does not prove a provider request or hosted result.

## Pull request closeout

Before creating or updating a PR, write a repository-relative scope file and
run:

```bash
python3 ~/.codex/scripts/pr-readiness.py \
  --phase create --scope-file <scope-file> --write-receipt
python3 ~/.codex/scripts/pr-readiness.py \
  --phase update --scope-file <scope-file> --write-receipt
```

Write the PR body through a non-interpreting body file and validate it with
`bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file <path>
--json`. Preserve the repository template sections and checklist text.

Review-thread truth comes from GitHub GraphQL `reviewThreads` with
`isResolved` and `isOutdated`. Flat comments and review summaries are
insufficient. `harness pr-closeout` reports hosted lanes but does not replace
independent review or authorize merge.

## Steering feedback

Treat feedback as an observed local defect first. Finish the bounded repair or
record `no_system_change` with its reason and checked scope. Add a durable
control only when the existing contract conflicts, a safety boundary is
crossed, or the same failure recurs across independent work. Put that control
in the smallest existing validator, test, or instruction surface; do not create
a parallel lifecycle or standalone policy artifact.

When this threshold is met, search the affected module family, name siblings
changed or deliberately left unchanged, and run the narrowest regression that
disproves recurrence. Run `pnpm run docs:steering:guard` when changing this
contract.

## Evidence format

Report every material command exactly:

```text
Command: <exact command> -> pass|fail|blocked (<reason>)
```

State what the evidence proves and what remains unproved.
