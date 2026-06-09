# PU-013 Harness Next Clean Worktree Repair Skill Lenses

## Scope

- Slice: `harness next` clean-worktree-state repair.
- Branch: `codex/jsc-363-next-clean-worktree-state`.
- Base: `8003f0f84c07f80e93400d4c8f46378d83398142`.
- Files reviewed: `src/commands/next-runner-inputs.ts`,
  `src/commands/next.test.ts`, and synchronized goal tracker surfaces.

## Simplify

Status: pass.

Evidence: the production change preserves empty stdout only for the clean-status
command that needs empty output as evidence. Other git metadata commands keep
the previous null-on-empty behavior.

## Improve Codebase Architecture

Status: pass.

Evidence: the change stays in the existing `next` input boundary and does not
move worktree-state authority into `runtime-card`, evidence storage, PR closeout,
or merge-readiness code.

## Sy Review

Status: pass.

Evidence: `harness next` remains advisory. The repair changes classification of
local worktree state only; it does not execute actions, merge PRs, update Linear,
or collapse local truth into external truth.

## Testing

Status: pass with E2E blocker disclosed.

Evidence:

- `pnpm vitest run src/commands/next.test.ts` passed.
- `pnpm lint -- src/commands/next-runner-inputs.ts src/commands/next.test.ts`
  passed.
- `pnpm typecheck` passed.
- `pnpm run quality:docstrings` passed.
- `pnpm run quality:size` passed.
- `pnpm run test:related` passed.
- `bash scripts/validate-codestyle.sh --fast` passed.
- `pnpm check` passed when run sequentially.
- `pnpm test:deep` reached the E2E tail and blocked because GitHub and Linear
  credentials were not visible in the process environment and
  `<REDACTED_HOME_PATH>/.codex/.env` is a FIFO in this sandbox.

## Independent Reviewers

Status: blocked_runtime.

Evidence: no `spawn_agent` tool is exposed in this runtime, so
`adversarial-reviewer`, `agent-native-reviewer`, and
`best-practices-researcher` cannot be launched from this thread. This artifact
does not self-approve the slice; it records the blocker for PR review and final
goal closeout.

## Non-Claims

- No PR exists yet for this branch.
- CI, CodeRabbit, review-thread state, mergeability, Linear field text,
  documentation accuracy, root hygiene, Judge/PM readiness, and parent-goal
  completion remain unclaimed.
