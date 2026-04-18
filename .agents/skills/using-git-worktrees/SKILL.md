---
name: using-git-worktrees
description: "Use when creating, bootstrapping, auditing, repairing, or cleaning git worktrees in this repository with canonical scripts and validation gates."
metadata:
  lifecycle_state: active
  maturity: stable
  owner: coding-harness-maintainers
  review_cadence: monthly
  last_reviewed: 2026-04-18
  metadata_source: frontmatter
---

# Using Git Worktrees

Operate git worktrees in `coding-harness` using repo-native scripts, branch hygiene, and auditable cleanup.

## Table of Contents
- [Working agreement](#working-agreement)
- [When to use](#when-to-use)
- [Inputs](#inputs)
- [Outputs](#outputs)
- [Principles](#principles)
- [Workflow](#workflow)
- [Validation](#validation)
- [Gotchas](#gotchas)
- [See also](#see-also)
- [Anti-patterns](#anti-patterns)
- [Examples](#examples)

## Working agreement
- Follow repository `AGENTS.md`, `CODESTYLE.md`, and `docs/agents/02-tooling-policy.md` before running mutative git commands.
- Prefer canonical wrappers over ad hoc git flows:
  - `bash scripts/new-task.sh`
  - `bash scripts/prepare-worktree.sh`
  - `make worktree-ready`
- Treat branch ownership as single-writer per worktree; do not keep the same branch checked out in Local and another worktree at the same time.
- Agents may run from a linked worktree or from a local environment, but mutative commands must be path-pinned to the intended checkout (`git -C <path>` or `--repo <path>`).
- Use `zsh -lc` command form and `bash` for scripts.

## When to use
Use this skill when work involves:
- Creating an isolated task worktree from `main` (or another base ref).
- Bootstrapping a fresh worktree before first push.
- Auditing active/stale worktrees and sorting cleanup actions.
- Repairing moved/orphaned worktree metadata.
- Choosing detached mode for exploration or background agent runs.
- Running agents safely in either a worktree path or a local environment without branch contention.

Non-triggers:
- Generic git branching advice outside this repository.
- CI troubleshooting that does not involve worktree lifecycle.
- GitHub-only branch cleanup with no local worktree state.

## Inputs
- Repository root path (default: current repo).
- Task slug and optional base ref.
- Preferred mode: `branch` or `detached`.
- Execution context: `worktree` or `local`.
- Whether cleanup actions are informational only or should be executed.
- Any branch/PR constraints that block removal.

## Outputs
- A worktree lifecycle summary with exact commands and outcomes.
- Optional inventory artifact from `scripts/worktree-report.sh` in markdown or JSON.
- Explicit cleanup recommendations sorted by risk:
  - safe now
  - blocked pending review
  - destructive and confirmation required
- Validation evidence from required gates.

## Principles
- One task equals one worktree equals one branch/thread.
- Detached worktrees are the default safe lane when Local needs branch ownership.
- Bootstrap before first push to avoid hook and dependency drift.
- Inventory before deletion; prune stale metadata after removal.
- Agent execution must be path-pinned so local environment commands cannot mutate sibling worktrees unintentionally.
- Prefer reversible operations and show exact blocker reasons.

## Workflow
1. Classify the request:
   - `create`, `bootstrap`, `audit`, `cleanup`, or `repair`.
2. Resolve execution target:
   - `worktree` context: run commands directly in the target worktree path.
   - `local` context: keep Local branch ownership and create/use detached worktrees for agent execution.
   - For automation from local environment, pin every command with `git -C <target-path>` or `--repo <target-path>`.
3. Create task worktree (Read when: new branch/worktree needed):
   - Use [`references/worktree-lifecycle.md`](./references/worktree-lifecycle.md).
   - Default command: `bash scripts/new-task.sh <slug>`.
   - Use `--detached` when Local must keep the same branch checked out.
4. Bootstrap fresh worktree (Read when: first push from new worktree):
   - Run `make worktree-ready` or `bash scripts/prepare-worktree.sh`.
   - Then run `bash scripts/verify-work.sh --fast` before pushing.
5. Audit/sort worktrees (Read when: many worktrees or cleanup requested):
   - Run `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --repo . --format markdown --include-cleanup`.
6. Cleanup/repair:
   - Inventory first: `git worktree list --porcelain`.
   - Remove only confirmed inactive clean trees: `git worktree remove <path>`.
   - If metadata drift exists after manual moves, run `git worktree repair <path>`.
   - Prune stale admin records: `git worktree prune`.
7. Close with evidence and next action.

## Validation
- Required command checks:
  - `bash scripts/new-task.sh --help`
  - `bash scripts/prepare-worktree.sh --help`
  - `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --help`
- Functional checks:
  - `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --repo . --format markdown --include-cleanup`
  - `bash .agents/skills/using-git-worktrees/scripts/worktree-report.sh --repo . --format json --include-cleanup`
- Readiness gate before first push from a fresh worktree:
  - `bash scripts/verify-work.sh --fast`

## Gotchas
- Git refuses the same branch in two worktrees; use detached mode or switch one side away first.
- Deleting a worktree directory manually leaves stale admin records; use `git worktree remove` and then `git worktree prune`.
- Worktree paths can disappear while metadata remains; treat `prunable` entries as cleanup candidates, not active worktrees.

## See also
| Skill | When to use |
|---|---|
| `coding-harness` | Harness install/bootstrap/update lanes beyond worktree lifecycle. |
| `gh-workflow` | PR and review lifecycle after local worktree changes are ready. |

**Topic map:** `[[git-worktrees]]`

## Anti-patterns
- Running `git worktree remove --force` before checking local changes/branch state.
- Reusing one worktree for multiple unrelated tasks.
- Skipping `prepare-worktree` then debugging avoidable pre-push hook failures.
- Claiming cleanup complete without `git worktree list --porcelain` evidence.

## Examples
- Triggering prompt: "Create a detached worktree for JSC-181, bootstrap it, and show cleanup candidates."
- Triggering prompt: "Run an agent from my local environment but execute all git actions against a detached worktree path."
- Non-triggering prompt: "Explain what a git branch is."
