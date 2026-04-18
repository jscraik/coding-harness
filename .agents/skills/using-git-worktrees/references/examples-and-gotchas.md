# Examples and Gotchas

## Trigger examples
- "Create a detached worktree for JSC-220 and prep it for first push."
- "List all worktrees in this repo and tell me which ones are safe to remove."
- "I moved a worktree folder manually and now git cannot find it; repair it."
- "Sort our worktrees by branch, dirty state, and cleanup priority."
- "Run an agent from local environment but path-pin git commands to a detached worktree."

## Non-trigger examples
- "Teach me git basics for beginners."
- "Create a GitHub project board."
- "Debug failing CI checks unrelated to worktree lifecycle."

## Gotchas this skill should enforce
- The same branch cannot be checked out in multiple worktrees at once.
- Detached mode is often safer for background exploration.
- Deleting worktree folders manually leaves stale `.git/worktrees/*` metadata.
- Always inventory before cleanup and prune after cleanup.
- For this repository, run `scripts/prepare-worktree.sh` before first push from a new worktree.
- When running from local environment, path-pin mutative commands with `git -C <target-path>` or `--repo <target-path>`.

## Troubleshooting quick map
- Error: `fatal: \"<branch>\" is already used by worktree`:
  - Use `--detached` when creating, or switch one checkout away from that branch.
- Worktree appears as `prunable`:
  - Verify path and run `git worktree prune` when confirmed stale.
- New worktree fails pre-push checks:
  - Run `make worktree-ready` and `bash scripts/verify-work.sh --fast`.
