# CI Rules

**Rule count:** 1
**Last promoted:** 2026-06-01

## Active rules

- **R-001**: CircleCI API or job-log triage must use the approved private env
  surface `~/.codex/.env` before reporting CircleCI credentials unavailable.
  - Severity: must
  - Rationale: Repeated JSC-363 CI triage required CircleCI API/log access after
    stale or opaque checks. The repo already records env-backed validation
    recovery in `.harness/memory/LEARNINGS.md`, but leaving the rule out of
    Project Brain made future agents rediscover it through operator steering.
  - Last promoted: 2026-06-01
  - Promoted from: operator steering, `.harness/memory/LEARNINGS.md`, and
    JSC-363 Goal Governor receipts.
  - Operating contract: never print or persist secret values; if
    `~/.codex/.env` is missing, unreadable, a FIFO without a writer, or does
    not contain the required variable names, record that concrete blocker
    separately from `missing credentials` and use public GitHub check evidence
    only for lanes it actually proves.
  - Env-surface probe contract: first test that `~/.codex/.env` is a regular
    readable file before sourcing it. If it is a pipe, socket, missing, or
    unreadable, do not source it; classify the blocker as
    `blocked_env_fifo_timeout` when the approved env surface is a FIFO/no-writer
    path, or as the concrete missing/unreadable file class otherwise, then use
    only already-authenticated CLIs or public GitHub check evidence for the
    lanes those sources prove. Bounded CircleCI API/log triage may load the env
    file only after the regular-file probe passes.
  - Placeholder normalization: route-truth artifacts may redact the home
    directory as `<REDACTED_HOME_PATH>/.codex/.env`; local command execution
    maps that placeholder to the operator-local `~/.codex/.env` path.

## Promotion guide

1. Hypothesis observed 3+ times → promote to rule
2. Rule contradicted by evidence → demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
