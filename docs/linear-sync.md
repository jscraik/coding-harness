---
last_validated: 2026-04-18
---

# harness linear sync

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [How deduplication works](#how-deduplication-works)
- [Finding object schema](#finding-object-schema)
- [State transitions](#state-transitions)
- [Examples](#examples)
- [Failure modes](#failure-modes)

## Overview

`harness linear sync` promotes gate findings into Linear issues **idempotently** — the same finding synced twice updates the existing issue instead of creating a duplicate.

## Prerequisites

- `LINEAR_API_KEY` environment variable (or `--token` flag)
- A findings JSON file produced by any harness gate (or piped via stdin)

## Usage

```sh
# Sync from a findings file
harness linear sync --findings .harness/findings.json --team JSC

# Dry-run preview (no writes to Linear)
harness linear sync --findings .harness/findings.json --team JSC --dry-run

# Pipe findings from a gate
harness drift-gate --repo-root . --json | jq '.findings' | harness linear sync --findings - --team JSC

# JSON output for CI consumption
harness linear sync --findings findings.json --team JSC --json
```

## How deduplication works

Each finding is fingerprinted with a deterministic SHA-256 of `<team-key>:<finding-id>:<title>` (first 8 hex chars used). When a finding is synced:

1. `searchIssues` is called with the fingerprint label `harness-sync:<fingerprint>`.
2. If an issue is found → **update** (add comment with current context, re-raise priority).
3. If no issue is found → **create** with full context body; fingerprint comment is appended so future syncs can find it.

## Finding object schema

```jsonc
{
  "id": "drift-gate:command.surface.sources.missing",  // required, stable
  "title": "Missing CLI source surface",               // required
  "severity": "error",                                 // optional: error | warn | info
  "description": "The command surface file is missing.", // optional markdown
  "fixCommands": ["touch src/cli.ts"],                 // optional
  "evidenceUrls": ["https://ci.example.com/job/123"],  // optional
  "gate": "drift-gate"                                 // optional, attribution
}
```

## State transitions

```
finding detected
    │
    ▼
harness linear sync
    │
    ├─ fingerprint match found ──► update existing issue
    │       │                         add comment
    │       │                         re-assert priority
    │       └─ finding later absent ─► (no action — agent closes manually)
    │
    └─ no match ──► create new issue
                        full context body
                        fingerprint comment stamped
```

**Note:** `harness linear sync` does not auto-close issues when a finding is resolved. Close issues manually via `harness linear close` after verification, to preserve the audit trail.

## Examples

### CI integration (CircleCI)

```yaml
- run:
    name: Sync findings to Linear
    command: |
      harness drift-gate --repo-root . --json \
        | jq '.findings // []' \
        > /tmp/findings.json
      harness linear sync \
        --findings /tmp/findings.json \
        --team JSC \
        --json
```

### Dry-run before first production sync

```sh
harness linear sync --findings findings.json --team JSC --dry-run
# [dry-run] Synced 3 finding(s): 0 created, 0 updated, 3 skipped
#   [skipped] (dry-run) Missing CLI source surface
#   [skipped] (dry-run) Missing status matrix
#   [skipped] (dry-run) Branch protection not enforced
```

## Failure modes

| Exit code | Meaning |
|---|---|
| 0 | Success |
| 1 | Validation error (missing token, bad findings JSON) |
| 2 | Team not found |
| 3 | Linear permission denied |
| 10 | Unexpected system error |
