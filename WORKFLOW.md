---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "coding-harness-bb735dbbda79"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
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
- [Abbreviations](#abbreviations)
- [Metadata](#metadata)
- [Invariants](#invariants)
- [States](#states)
- [Transition Table (Canonical)](#transition-table-canonical)
- [Error Handling](#error-handling)
- [Idempotency](#idempotency)
- [Execution Modes](#execution-modes)
- [Dry-Run Simulation](#dry-run-simulation)
- [Observability Logs](#observability-logs)
- [Validation Checklist](#validation-checklist)

## Execution contract
| Field | Value |
| --- | --- |
| `owner` | `coding-harness-maintainers` |
| `max_duration` | `12 turns` |
| `escalation` | `Block at S4 BLOCKED with unblock_action payload` |

## Workflow context
- Branch names keep `codex/` prefix and include `LK`.
- One progress comment thread per Linear issue.
- `S2 IN_REVIEW` requires pre-review checks to pass before entry.
- Terminal states (`S3 DONE`, `S4 BLOCKED`) do not auto-transition without explicit events.

## Execution context
You are working on Linear issue `{{ issue.identifier }}`.

Issue title: {{ issue.title }}
Issue state: {{ issue.state }}
Issue URL: {{ issue.url }}

Use only the current workspace root and follow repository instructions:
- `/Users/jamiecraik/.codex/AGENTS.md`
- `AGENTS.md` in repository root
- `docs/agents/13-linear-production-workflow.md`

Do not operate outside the checked-out repository.

## Abbreviations
| Abbr | Meaning |
| --- | --- |
| `LI` | Linear issue |
| `LK` | Linear key (example: `JSC-36`) |
| `PR` | GitHub pull request |
| `S` | State |
| `E` | Event |
| `G` | Guard |
| `A` | Action |
| `N` | Next state |
| `DoD` | Definition of done |

## Metadata
| Field | Value |
| --- | --- |
| `owner` | `coding-harness-maintainers` |
| `max_duration` | `12 turns` |
| `escalation` | `Block at S4 BLOCKED with unblock_action payload` |

## Invariants
- Branch names keep `codex/` prefix and include `LK`.
- One progress comment thread per Linear issue.
- `S2 IN_REVIEW` requires pre-review checks to pass before entry.
- Terminal state `S3 DONE` has no outbound transitions.

## States
```txt
S0 TODO (non-terminal)
S1 IN_PROGRESS (non-terminal)
S2 IN_REVIEW (non-terminal)
S3 DONE (terminal)
S4 BLOCKED (non-terminal)
```

### State machine
```
S0 TODO -> S1 IN_PROGRESS -> S2 IN_REVIEW -> S3 DONE
  |             |                 |
  |             +----> S4 BLOCKED-+
  +-------------------------------+
```

## Transition Table (Canonical)
`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0 TODO` | `start` | issue selected | `harness linear claim --issue <LK> --branch <codex/...> --workspace <path>` | `S1 IN_PROGRESS` |
| `S1 IN_PROGRESS` | `status_tick` | always | update one running progress comment (single thread) | `S1 IN_PROGRESS` |
| `S1 IN_PROGRESS` | `pr_opened` | PR exists | attach/update PR link on LI | `S1 IN_PROGRESS` |
| `S1 IN_PROGRESS` | `handoff_ready` | `pnpm lint && pnpm typecheck && pnpm test && pnpm audit && pnpm check` pass | `harness linear handoff --issue <LK> --pr-url <url> --evidence-url <url[,url]>` | `S2 IN_REVIEW` |
| `S2 IN_REVIEW` | `merged` | required checks pass | `harness linear close --issue <LK> --pr-url <url>` | `S3 DONE` |
| `S1 IN_PROGRESS` | `blocked` | missing auth, secret, or permission | post blocker note, add `Blocked` label when available, record unblock action | `S4 BLOCKED` |
| `S4 BLOCKED` | `unblocked` | dependency restored | remove blocker marker, continue execution | `S1 IN_PROGRESS` |

Command lane (always available):
- `harness linear prepare --issue <LK> --field branch`
- `harness linear claim --issue <LK> --branch <codex/...> --workspace <path>`
- `harness linear handoff --issue <LK> --pr-url <url> --evidence-url <url[,url]>`
- `harness linear close --issue <LK> --pr-url <url>`

GitHub linking invariant:
- branch keeps `codex/` prefix and includes `LK`.
- PR uses `Refs <LK>` for linking or `Fixes <LK>` for merge closeout.

## Error Handling
- `VALIDATION_ERROR`: invalid issue key, malformed branch, or missing required fields.
- `BLOCKED_DEPENDENCY`: missing auth/secret/permission; route to `S4 BLOCKED`.
- `POLICY_FAIL`: required checks, branch policy, or PR reference policy fails.
- `SYSTEM_ERROR`: CLI/runtime/network failure; stop and emit failed command.

## Idempotency
- Idempotency key: `{{ issue.identifier }}|{{ issue.url }}|<event>|<state>`.
- Repeated `status_tick` updates mutate the single running comment, not create duplicates.
- Replayed `pr_opened`/`handoff_ready` must upsert LI links/comments.

## Execution Modes
- `STRICT`: enforce hard-fail for policy/validation violations.
- `ADVISORY`: emit warnings and continue only for non-safety violations.

## Dry-Run Simulation
- Enable dry-run by evaluating guards and transitions with no side effects.
- Emit deterministic transition trace output rows: `S,E,G,A,N,decision`.
- No writes to Linear/GitHub in dry-run mode.

## Observability Logs
```json
{
  "workflow_id": "linear-production",
  "transition_code": "S1:handoff_ready",
  "from_state": "S1 IN_PROGRESS",
  "to_state": "S2 IN_REVIEW",
  "correlation_id": "LK-PR-SHA",
  "result": "success|blocked|failed"
}
```

## Validation Checklist
- non-terminal states have outbound transitions
- deterministic `(S,E)` routing via non-overlapping guards
- failures route to `FAIL`/`BLOCKED`
- terminal states have no outbound transitions
- required checks pass before review transition

## Agent pseudocode
```txt
init:
  assert repo instructions loaded
  assert issue key present

if LI.state == TODO:
  transition(S0 -> S1)

while state in {S1, S4}:
  if blocked:
    transition(* -> S4) with explicit unblock action
  else:
    execute scoped work
    maintain one running LI progress comment
    if PR exists: sync PR URL attachment
    if DoD pre-review checks pass: transition(S1 -> S2)

if state == S2 and PR merged and required checks pass:
  transition(S2 -> S3)
```

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
Only stop for true blockers (`auth`, `secrets`, `permissions`).

Required blocker payload:
- `missing`: what dependency is absent
- `failed_cmd`: exact command that failed
- `unblock_action`: human action required

Do not create a GitHub Issue for routine intake; keep the canonical work item in Linear.
