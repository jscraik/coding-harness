---
schema_version: 1
status: draft
applies_to:
  - coding-harness
  - codex-launch-workflow
  - git-worktree-bootstrap
module: tooling-worktree-entry
date: 2026-04-20
problem_type: regression
component: worktree-launch-automation
severity: medium
applies_when:
  - codex is launched from main for new feature work
  - multiple feature threads run concurrently in the same repository
symptoms:
  - launching from main could route into a non-unique branch/worktree context
  - detached worktree auto-attach used a legacy codex prefix instead of the repository standard
  - branch collision checks only validated local refs and could miss existing origin heads
root_cause: inconsistent worktree branch-prefix defaults and incomplete uniqueness checks across local and remote refs
resolution_type: bug fix
tags:
  - worktrees
  - branch-naming
  - codex-enforced
  - new-task
  - prepare-worktree
last_validated: 2026-04-20
---

# Solution: Enforce Unique Task Worktrees with `jscraik/feature`

## Table of Contents
- [Problem](#problem)
- [Why It Happened](#why-it-happened)
- [Implemented Solution](#implemented-solution)
- [Verification Evidence](#verification-evidence)
- [Prevention](#prevention)
- [Related Artifacts](#related-artifacts)

## Problem

Feature work launched from `main` needed to auto-create a dedicated worktree and branch per task so concurrent threads do not collide. The existing behavior could still reuse branch identifiers in some scenarios and had inconsistent branch-prefix defaults, which reduced isolation guarantees for multi-thread work.

## Why It Happened

Worktree entry logic and supporting helpers evolved across multiple scripts/templates but retained mixed defaults and partial uniqueness checks.

1. Task branch naming defaults were split between legacy `codex/...` and desired `jscraik/feature/...` patterns.
2. Task slug collision checks in `scripts/codex-enforced` initially only considered local refs.
3. Detached HEAD bootstrap branch auto-attach behavior needed to align with the same prefix and branch-isolation contract used by task creation.

## Implemented Solution

The fix standardized branch/worktree policy and tightened uniqueness checks across runtime, scaffolding, and docs.

### 1. Main-branch guard now creates dedicated task worktrees with explicit prefix

- `scripts/codex-enforced` and `src/templates/codex-enforced.sh` now define `WORKTREE_BRANCH_PREFIX="jscraik/feature"`.
- Launches from `main` create a new task worktree via `scripts/new-task.sh --bootstrap --branch-prefix "jscraik/feature" ...` and re-launch Codex in that new worktree.

### 2. Task slug collision checks include local and remote branch heads

- `scripts/codex-enforced` now checks both:
  - local refs: `refs/heads/jscraik/feature/<slug>`
  - remote refs: `origin/jscraik/feature/<slug>` (via `git ls-remote --heads origin ...`)
- On collision, the helper suffixes the slug (`-1`, `-2`, ...) until unique.

### 3. Detached worktree branch auto-attach aligned to `jscraik/feature`

- `scripts/prepare-worktree.sh` now auto-attaches detached worktrees as `jscraik/feature/<repo>-worktree-<short-sha>`.
- `scripts/new-task.sh` default branch prefix changed to `jscraik/feature` and now refuses creation if the same branch already exists on origin.

### 4. Generated scaffold/runtime parity updated

- Corresponding generated and policy surfaces were updated to preserve contract parity:
  - `src/lib/init/scaffold.ts`
  - `src/lib/policy/tooling-baseline.ts`
  - `src/commands/init.test.ts`
  - `AGENTS.md`, `CONTRIBUTING.md`, `docs/agents/02-tooling-policy.md`, `docs/agents/06-security-and-governance.md`

## Verification Evidence

Validated in-repo with workflow gate evidence and committed tooling changes.

Command outcomes:
- `bash scripts/codex-preflight.sh --stack auto --mode required` -> pass (warning: Local Memory helper timeout fallback)

Delivery evidence:
- Commit containing behavior changes: `31cecabbdfcdd61b2c9e570e26caa32c93f0e9cb`
- Branch carrying the fix: `codex/init-release-scaffold-2026-04-19-r2`

## Prevention

- Keep one canonical branch prefix for task/worktree automation and generated scaffold outputs.
- Always validate uniqueness against both local and origin heads before creating task branches.
- Treat `main` as a protected entry context for feature work and immediately re-home runs into dedicated task worktrees.
- Keep docs and generated templates in parity whenever branch/worktree policies change.

## Related Artifacts

- Commit: `31cecabbdfcdd61b2c9e570e26caa32c93f0e9cb` (`fix(tooling): align task branch prefix and worktree guards`)
- Modified policy/runtime surfaces:
  - `scripts/codex-enforced`
  - `scripts/new-task.sh`
  - `scripts/prepare-worktree.sh`
  - `src/templates/codex-enforced.sh`
  - `src/lib/init/scaffold.ts`
  - `src/lib/policy/tooling-baseline.ts`
  - `src/commands/init.test.ts`
  - `AGENTS.md`
  - `CONTRIBUTING.md`
  - `docs/agents/02-tooling-policy.md`
  - `docs/agents/06-security-and-governance.md`
