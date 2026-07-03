---
last_validated: 2026-07-03
---

# Live Canary Readiness

## Table of Contents

- [Purpose](#purpose)
- [Branch Baseline](#branch-baseline)
- [Execution Boundary](#execution-boundary)
- [Initial Canary Matrix](#initial-canary-matrix)
- [Findings](#findings)
- [Next Steps](#next-steps)
- [Evidence](#evidence)

## Purpose

This report starts the live canary branch for validating Coding Harness against
Jamie's downstream repositories before any npm release decision.

The first pass is intentionally read-only. It checks whether the current harness
can orient from downstream repository roots, fail closed on unsafe worktree
state, and preview install scope without writing into those repositories.

## Branch Baseline

- Branch: `codex/live-canary-readiness`
- Base commit: `9ab566544 fix(ci): align required check defaults with code scanning (#459)`
- Source package: `@brainwav/coding-harness@0.15.1`
- Probe binary: `/Users/jamiecraik/dev/coding-harness/dist/cli.js`

The installed `harness` command was not found on `PATH` during the first
sweep, so the first functional probe used the built source-checkout CLI. This is
useful source-package behavior evidence, but it is not installed-package or npm
publication proof.

## Execution Boundary

- No downstream repository write permission was granted for the canary repos.
- Git commands used `GIT_OPTIONAL_LOCKS=0`.
- `harness init --dry-run --json` was used for install-scope preview only.
- Dirty downstream worktrees are treated as canary blockers, not as harness
  failures.

## Initial Canary Matrix

| Repo                 | Branch / state                                                                                       | Dirty? | `orient --json`                                   | `next --json`                     | `init --dry-run --json`                                                   | Initial risk |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- | ------------ |
| `~/dev/agent-skills` | `main...origin/main`                                                                                 | yes    | pass with `status=warn`; `worktree_state_blocked` | fail exit 1 with blocked decision | fail exit 1: `PATH_TRAVERSAL` on symlink `scripts/validate-commit-msg.js` | high         |
| `~/dev/diagram-cli`  | `dependabot/npm_and_yarn/test-deps-412c0fe2be...origin/dependabot/npm_and_yarn/test-deps-412c0fe2be` | yes    | pass with `status=warn`; `worktree_state_blocked` | fail exit 1 with blocked decision | pass; `created=87`, `updated=0`, `skipped=33`, package manager `npm`      | medium-high  |
| `~/dev/knowledge-OS` | `main...origin/main`                                                                                 | yes    | pass with `status=warn`; `worktree_state_blocked` | fail exit 1 with blocked decision | pass; `created=94`, `updated=0`, `skipped=26`, package manager `npm`      | medium-high  |
| `~/dev/x-writer`     | `jscraik/feature/daily-board-agent-native-tightening`                                                | yes    | pass with `status=warn`; `worktree_state_blocked` | fail exit 1 with blocked decision | pass; `created=63`, `updated=0`, `skipped=57`, package manager `pnpm`     | medium       |
| `~/dev/brainwav.io`  | `main...origin/main`                                                                                 | yes    | pass with `status=warn`; `worktree_state_blocked` | fail exit 1 with blocked decision | pass; `created=120`, `updated=0`, `skipped=0`, package manager `npm`      | high         |

## Findings

### F1: Harness correctly refuses clean-worktree recommendations in dirty repos

All five canaries had local work in progress. `orient --json` returned
`status=warn` and routed to a repair decision with
`failureClass=worktree_state_blocked`.

This is the right behavior for first-pass canaries because the harness did not
pretend the repos were safe to mutate.

### F2: `harness next --json` uses non-zero exit for blocked dirty-worktree state

Across all five canaries, `next --json` exited 1 and emitted a blocked
`harness-decision/v1` payload. Treat this as expected fail-closed behavior,
not as a successful next-action recommendation.

### F3: `agent-skills` exposed an internal-symlink dry-run blocker

`agent-skills` first dry-run failed with:

```text
PATH_TRAVERSAL: Symlink detected in path: scripts/validate-commit-msg.js
```

Classification showed `scripts` is a tracked internal symlink to
`Infrastructure/scripts`, and the resolved target stays inside the repository.
Current source now permits internal symlink segments that remain inside the repo
while continuing to reject symlink escapes.

### F4: Initial dry-run scope is broad in not-yet-adopted repos

The dry-run created counts are large for several repos, especially
`brainwav.io` with `created=120` and `skipped=0`. That indicates a first
write-canary should not apply the full scaffold blindly. The next branch step
should classify the minimal profile or upgrade path before any downstream
write. Current source now emits `dryRunPlan` metadata so JSON consumers can see
the selected profile, planned create/skip counts, risk score, risk level, and
recommendation instead of inferring risk from raw arrays.

### F5: Installed-package canary passes

The shell could not find `harness` on `PATH` in any canary cwd during the
first sweep, but the package-installed downstream canary now passes from the
source repo. That proves the packed package can run public
`harness ... --json` commands from a downstream repository cwd without
source-checkout command paths, external credentials, or unexpected dry-run
writes.

This is package-canary evidence, not npm publication, live repo adoption,
remote CI, or merge-readiness evidence.

## Next Steps

1. Convert this first-pass report into a structured JSON or Markdown artifact
   with full command outcomes.
2. Re-run one canary with `--worktree-role dirty-with-justification` only if
   Jamie explicitly wants recommendations despite dirty worktrees.
3. Build or pack the current source before using `dist/cli.js` for
   downstream symlink proof.
4. Select one write-canary repo only after dirty worktree ownership and planned
   writes are reviewed.

Recommended first write-canary after read-only remediation: `diagram-cli`.
It is CLI-shaped and its dry-run showed existing harness-managed surfaces
(`skipped=33`) instead of a completely fresh scaffold. The first downstream
write branch should be in `diagram-cli`, for example
`codex/harness-canary-diagram-cli-profile`, after Jamie confirms downstream
write permission.

## Evidence

Command: `git status --short --branch` in `/Users/jamiecraik/dev/coding-harness` -> pass (clean `main` before branch creation)

Command: `git fetch origin main` -> pass (origin/main fetched)

Command: `git rev-list --left-right --count origin/main...HEAD` -> pass (`0 0`; local `main` matched `origin/main`)

Command: `git switch -c codex/live-canary-readiness` -> pass (created new branch)

Command: `git status --short --branch` -> pass (`## codex/live-canary-readiness` with no dirty files immediately after branch creation)

Command: `test -f /Users/jamiecraik/dev/coding-harness/dist/cli.js` from `/Users/jamiecraik/dev/diagram-cli` -> pass (built CLI exists)

Command: `node /Users/jamiecraik/dev/coding-harness/dist/cli.js orient --json` from `/Users/jamiecraik/dev/diagram-cli` -> pass (`harness-orient/v1`, `status=warn`, `failureClass=worktree_state_blocked`)

Command: bounded read-only canary summary runner over `agent-skills`, `diagram-cli`, `knowledge-OS`, `x-writer`, and `brainwav.io` -> pass (wrote summarized evidence to `/private/tmp/coding-harness-live-canary-summary.json`; no downstream repo write permission granted)

Command: `node --import tsx scripts/run-harness-evals.mjs --scenario package-installed-downstream-canary` -> pass (`status=pass`; `package_canary` tier selected 1, passed 1; 10 package-installed assertions passed)

Command: `/usr/bin/git -C /Users/jamiecraik/dev/agent-skills ls-files -s scripts Infrastructure/scripts/validate-commit-msg.js` -> pass (`scripts` is tracked mode `120000`; target file is tracked mode `100755`)

Command: `/Users/jamiecraik/dev/coding-harness/node_modules/.bin/tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts init --dry-run --json` from `/Users/jamiecraik/dev/agent-skills` -> pass (`scripts/validate-commit-msg.js` appears in `skipped`; no `PATH_TRAVERSAL` error)

Command: `/Users/jamiecraik/dev/coding-harness/node_modules/.bin/tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts init --dry-run --json` from `/Users/jamiecraik/dev/diagram-cli` -> pass (`dryRunPlan.profile=standard`; `riskLevel=high`; `riskScore=84`; `plannedCreates=87`; `plannedSkips=33`)

Command: `/Users/jamiecraik/dev/coding-harness/node_modules/.bin/tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts init --dry-run --json --minimal` from `/Users/jamiecraik/dev/diagram-cli` -> pass (`dryRunPlan.profile=minimal`; `riskLevel=high`; `riskScore=74`; `plannedCreates=87`; `plannedSkips=31`)
