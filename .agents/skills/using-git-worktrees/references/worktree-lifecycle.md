# Worktree Lifecycle Playbook (coding-harness)

## Table of Contents
- [Scope](#scope)
- [Canonical commands](#canonical-commands)
- [Agent execution contexts](#agent-execution-contexts)
- [Creation flow](#creation-flow)
- [Bootstrap flow](#bootstrap-flow)
- [Audit and sorting flow](#audit-and-sorting-flow)
- [Cleanup flow](#cleanup-flow)
- [Repair flow](#repair-flow)
- [Best-practice rationale (Apr 2026)](#best-practice-rationale-apr-2026)
- [Source links](#source-links)

## Scope
Use this playbook for `jscraik/coding-harness` only. It binds upstream git worktree behavior to repository-specific wrappers and governance checks.

## Canonical commands
- Create task worktree: `bash scripts/new-task.sh <slug>`
- Detached creation lane: `bash scripts/new-task.sh --detached <slug>`
- Fresh worktree bootstrap: `make worktree-ready` or `bash scripts/prepare-worktree.sh`
- Inventory: `git worktree list --porcelain`
- Structured inventory + suggestions: `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --repo . --format markdown --include-cleanup`
- Remove clean inactive tree: `git worktree remove <path>`
- Prune stale admin records: `git worktree prune`
- Lock long-lived tree: `git worktree lock --reason "<reason>" <path>`
- Repair moved tree metadata: `git worktree repair <path>`

## Agent execution contexts
- Worktree-first execution:
  - Run the agent inside the target worktree directory when possible.
  - Keep branch ownership single-writer for that path.
- Local-environment execution:
  - Keep Local on its branch and run agent task lanes in detached worktrees.
  - Path-pin all operations (`git -C <target-path> ...` and `--repo <target-path>`) so local shells do not mutate sibling worktrees accidentally.
- Reporting from local environment:
  - Use `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --repo <target-path> --format markdown --include-cleanup` for target-specific inventory.

## Creation flow
1. Choose mode:
   - `branch` for standard task delivery.
   - `detached` when Local must keep the branch checked out.
2. Run `bash scripts/new-task.sh <slug>` (or `--detached`).
3. Enter printed path.
4. Bootstrap with `make worktree-ready`.
5. Run `bash scripts/codex-preflight.sh --stack auto --mode required` and `bash scripts/verify-work.sh --fast`.

## Bootstrap flow
For every newly created worktree, before first push:
1. `bash scripts/prepare-worktree.sh`
2. If detached, allow script to create an attach branch when required.
3. `bash scripts/verify-work.sh --fast`

This repository expects hook and dependency bootstrap to happen before push.

## Audit and sorting flow
1. Generate inventory: `git worktree list --porcelain`.
2. Generate sortable report:
   `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --repo . --format markdown --include-cleanup`
3. Sort into buckets:
   - Active/current
   - Active/dirty
   - Detached candidates
   - Prunable metadata
   - Safe cleanup candidates

## Cleanup flow
1. Confirm branch/PR status before removing worktree.
2. Remove clean inactive trees with `git worktree remove <path>`.
3. Use `--force` only with explicit intent.
4. Run `git worktree prune`.
5. Re-inventory to verify removal.

## Repair flow
Use repair commands when the filesystem was moved or cleaned manually:
1. `git worktree repair <path>` for moved linked worktrees.
2. `git worktree lock <path> --reason "portable or long-lived"` to avoid accidental prune.
3. `git worktree unlock <path>` before intentional removal.

## Best-practice rationale (Apr 2026)
- Git upstream documents that a branch cannot be checked out in multiple worktrees safely; detached mode avoids branch reference contention.
- Git upstream defines `lock`, `prune`, and `repair` as official lifecycle controls for portable/moved worktrees.
- Codex app worktree docs state Codex-managed worktrees are detached by default and explain the same one-branch-per-worktree limitation; this aligns with repo policy to prefer detached mode for background/exploratory lanes.
- GitHub branch hygiene recommends deleting merged/stale branches and supports automatic head-branch deletion after merge; this complements local worktree cleanup.

## Source links
- Git worktree reference: <https://git-scm.com/docs/git-worktree>
- OpenAI Codex app worktrees: <https://developers.openai.com/codex/app/worktrees>
- GitHub automatic branch deletion: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches>
- GitHub branch views (active/stale): <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/viewing-branches-in-your-repository>