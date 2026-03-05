---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "symphony-pilot-coding-harness-32d853352b38"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Closed
    - Canceled
    - Cancelled
    - Duplicate
polling:
  interval_ms: 10000
workspace:
  root: $SYMPHONY_WORKSPACE_ROOT
hooks:
  after_create: |
    set -euo pipefail
    REPO_URL="${SOURCE_REPO_URL:-https://github.com/jscraik/coding-harness.git}"

    if [ ! -d .git ]; then
      git clone --depth 1 "$REPO_URL" .
    fi

    if command -v mise >/dev/null 2>&1; then
      mise trust >/dev/null 2>&1 || true
    fi

    if command -v pnpm >/dev/null 2>&1; then
      pnpm install --frozen-lockfile || pnpm install
    elif command -v corepack >/dev/null 2>&1; then
      corepack pnpm install --frozen-lockfile || corepack pnpm install
    else
      echo "pnpm/corepack is required in worker environment"
      exit 1
    fi
agent:
  max_concurrent_agents: 3
  max_turns: 12
codex:
  command: "${CODEX_BIN:-codex} -c mcp_servers.greptile.enabled=false app-server"
  approval_policy: on-request
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
---

# Coding Harness Symphony Workflow

## Table of Contents
- [Execution contract](#execution-contract)
- [State handling](#state-handling)
- [Definition of done](#definition-of-done)
- [Blocked policy](#blocked-policy)

## Execution contract
You are working on Linear issue `{{ issue.identifier }}`.

Issue title: {{ issue.title }}
Issue state: {{ issue.state }}
Issue URL: {{ issue.url }}

Use only the current workspace root and follow repository instructions:
- `/Users/jamiecraik/.codex/AGENTS.md`
- `AGENTS.md` in repository root

Do not operate outside the checked-out repository.

## State handling
1. If issue is `Todo`, move it to `In Progress` before editing code.
2. Keep a single running workpad-style progress comment on the issue.
3. Attach or update PR link on the issue once a PR exists.
4. Move issue to `In Review` only when all required checks pass.
5. If blocked by missing auth/secrets/permissions, post a concise blocker note and keep `In Progress`.

## Definition of done
Before handoff, run and pass:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit`
- `pnpm check`

Ensure branch name uses `codex/` prefix.

When creating commits, include this trailer exactly once at the end:
`Co-authored-by: Codex <noreply@openai.com>`

## Blocked policy
Only stop for true blockers (missing required auth, secrets, or permissions).
When blocked, report:
- what is missing,
- what command failed,
- what human action unblocks the run.
