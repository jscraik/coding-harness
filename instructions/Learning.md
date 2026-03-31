# Learning

- **2026-03-31 [Codex]:** Pushes from brand new temp worktrees can fail pre-push because hooks execute in that worktree and dependencies may be missing. In this repo, pre-push runs `pnpm test`, so run `pnpm install` in the same worktree before first push.
