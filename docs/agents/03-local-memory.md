---
last_validated: 2026-05-08
---

# Local-memory workflow

## Table of Contents

- [Per-project LEARNINGS.md (file-based)](#per-project-learningsmd-file-based)
- [In-session observe() workflow (state machine)](#in-session-observe-workflow-state-machine)

---

## Per-project LEARNINGS.md (file-based)

Every repository that has coding-harness installed uses `.harness/memory/LEARNINGS.md`
as a durable, append-only knowledge base for repo-specific agent learnings.

Harness also reserves these local helper paths:

| Purpose | Path |
| --- | --- |
| repo-local learned preflight failures | `.harness/memory/codex-learned/` |
| repo-local preflight overrides written by `scripts/codex-learn apply` | `.harness/memory/codex-preflight-overrides.env` |

### Why `.harness/memory/`?

coding-harness already creates a `.harness/` state directory in every project it
is installed in. Storing `LEARNINGS.md` there avoids new dotfiles and keeps all
harness-managed state in one place.

### Bootstrap rule — auto-create at session start

At the **start of every session**, if the repo has a `.harness/` directory,
ensure `.harness/memory/LEARNINGS.md` exists:

```bash
mkdir -p .harness/memory
test -f .harness/memory/LEARNINGS.md || cat > .harness/memory/LEARNINGS.md << 'EOF'
---
schema_version: 1
purpose: Per-project agent knowledge base — repo-specific gotchas and hard-won fixes.
scope: This repo only.
update_policy: |
  Append after any bug, tool failure, or extra-effort fix specific to this repo.
  Universal gotchas go in ~/.codex/instructions/Learnings.md instead.
  Do NOT delete entries. Append only.
  Format: **YYYY-MM-DD [Agent]:** <problem> → <fix>
---

# Learnings

Repo-specific agent knowledge base. Append-only.

> **Scope:** This repo only. Universal gotchas → `~/.codex/instructions/Learnings.md`.
> **Format:** `**YYYY-MM-DD [Agent]:** <problem> → <fix>`
EOF
echo 'Created .harness/memory/LEARNINGS.md'
```

If the repo has **no** `.harness/` directory (harness not installed), skip
creation.

### Writing rule

After any bug, tool failure, or extra-effort fix:

| Fix scope | Write to |
| --- | --- |
| **Repo-specific** (build commands, test runner quirks, lint config, harness config) | `.harness/memory/LEARNINGS.md` |
| **Universal** (CLI quirks, shell PATH, mise trust, tool failures across repos) | `~/.codex/instructions/Learnings.md` |

Format: `**YYYY-MM-DD [Agent]:** <problem> → <fix>`

### Preflight enforcement

Repo-local required preflight must exercise Local Memory instead of relying on
conversation memory or a legacy shell shortcut. The canonical invocation is:

```bash
bash scripts/codex-preflight.sh --stack auto --mode required
```

Compatibility invocations keep the same fail-closed posture. A legacy positional
call such as `bash scripts/codex-preflight.sh coding-harness git,bash CODESTYLE.md`
defaults to required Local Memory mode, and `off` or `optional` must be passed
explicitly when a softer check is intentional. The older stack/mode shorthand
`bash scripts/codex-preflight.sh auto required` is also accepted and must block
when Local Memory is unavailable, stale, or unclassified.

### Session-start read order

1. Read `~/.codex/instructions/Learnings.md` (always).
2. Check `.harness/memory/LEARNINGS.md` — if present, read it and apply
   repo-scoped gotchas. If absent but `.harness/` exists, run the bootstrap
   snippet above.

### `.gitignore` note

Coding-harness uses selective `.harness` tracking by contract:

- `.harness/memory/LEARNINGS.md` is durable repo policy and should be tracked.
- `.harness/memory/codex-learned/` and
  `.harness/memory/codex-preflight-overrides.env` are generated runtime state
  and should stay ignored.
- Curated `.harness` Markdown and JSON contract files should be reviewed like
  docs or policy; backups, databases, caches, run output, and bulk snapshots
  should stay local unless explicitly promoted to fixtures.

---

## In-session observe() workflow (state machine)

## Abbreviations

| Abbr | Meaning |
| --- | --- |
| `L0` | raw observation capture |
| `L1` | interpreted learning capture |
| `SID` | session id (`repo:<name>:task:<id>`) |
| `S` | state |
| `E` | event |
| `G` | guard |
| `A` | action |
| `N` | next state |

## Metadata
| Field | Value |
| --- | --- |
| `owner` | `memory-governance` |
| `max_duration` | `single session` |
| `escalation` | `move to S4 BLOCKED and request precedence decision` |

## Invariants
- Durable writes require `bootstrap` and `search` in the same `SID`.
- No secrets, tokens, credentials, or PII in persisted memory.
- Conflicts require explicit precedence resolution before durable capture.

## States
```txt
S0 PRECHECK (non-terminal)
S1 CAPTURE (non-terminal)
S2 VERIFY (non-terminal)
S3 DURABLE (terminal)
S4 BLOCKED (non-terminal)
```

### State machine

```txt
S0 PRECHECK -> S1 CAPTURE -> S2 VERIFY -> S3 DURABLE
      |             |            |
      +----> S4 BLOCKED <--------+
```

## Transition Table (Canonical)

`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0 PRECHECK` | `bootstrap_ok` | `bootstrap` + `search` completed in same SID | begin durable write candidate | `S1 CAPTURE` |
| `S1 CAPTURE` | `capture_observation` | evidence-backed fact | `observe(level=\"observation\")` | `S2 VERIFY` |
| `S1 CAPTURE` | `capture_learning` | interpreted and evidence-backed | `observe(level=\"learning\")` | `S2 VERIFY` |
| `S2 VERIFY` | `validated` | no secrets/PII + durable value confirmed | persist tags/source/context | `S3 DURABLE` |
| `S2 VERIFY` | `conflict_found` | conflicting guidance unresolved | record conflict and precedence decision request | `S4 BLOCKED` |
| `S4 BLOCKED` | `resolved` | precedence decided with evidence | update docs or memory with rationale | `S3 DURABLE` |

## Error Handling
- `VALIDATION_ERROR`: missing preamble, malformed `SID`, or invalid capture payload.
- `BLOCKED_DEPENDENCY`: unresolved contradiction or missing precedence decision.
- `POLICY_FAIL`: attempted durable write violates minimization/durability policy.
- `SYSTEM_ERROR`: tool/runtime failure during bootstrap/search/observe.

## Idempotency
- Key: `<SID>|<content_hash>|<level>`.
- Replays of same key must no-op or update metadata only.
- Conflict-resolution replays must reference prior conflict entry id.

## Execution Modes
- `STRICT`: block durable writes on any policy or verification failure.
- `ADVISORY`: permit observation staging with warnings; no durable promotion until resolved.

## Dry-Run Simulation
- Evaluate transition guards and outcomes only with no side effects.
- Emit deterministic transition trace output for selected rows.
- No `observe(...)` persistence side effects.

## Observability Logs
```json
{
  "workflow_id": "local-memory",
  "transition_code": "S2:validated",
  "from_state": "S2 VERIFY",
  "to_state": "S3 DURABLE",
  "correlation_id": "repo:coding-harness:task:x",
  "result": "success|blocked|failed"
}
```

## Validation Checklist
- every non-terminal state has >=1 outbound transition
- guards are deterministic for each `(S,E)`
- conflict/failure paths route through blocked/fail semantics
- terminal state `S3 DURABLE` has no outbound transitions
- preamble executed before durable capture

## Intent
Local memory is for durable continuity, not raw scratchpad logs. Use it for repository-level decisions, conventions, and recurring process knowledge.

## Required preamble before durable capture

Run both in the target session:

- `bootstrap(mode="minimal", include_questions=true, session_id="repo:<name>:task:<id>")`
- `search(query="...", session_id="repo:<name>:task:<id>")`

Do not write durable notes before this pre-check.

## Canonical capture pattern

Use `observe(...)` with:

- `level`: `observation` for raw capture, `learning` for interpreted takeaways.
- `content`: factual sentence with direct evidence path.
- `tags`: stable taxonomy (`coding-harness`, `policy`, `validation`).
- Optional `source`: command, log, or file path.

### Example

- **Level:** `observation`
- **Content:** `AGENTS.md currently requires `pnpm check` as mandatory validation gate for repo changes.`
- **Tags:** `["coding-harness","validation","policy"]`
- **Session ID:** `repo:coding-harness:task:agent-docs`

## What counts as durable

- Decision outcomes when instructions are resolved.
- Contradiction resolutions that affect behavior.
- Verification policy changes.

## What should not be durable

- Raw command output dumps.
- Single-session debugging noise.
- Speculative interpretations without evidence.

## Data minimization

- Exclude secrets, tokens, API keys, credentials, and PII.
- If any sensitive value appears in local notes, sanitize before persist.

## Conflict and correction process

When global or local guidance differs:

1. Verify in current `session_id` and repository evidence.
2. Record the conflict and chosen precedence.
3. Update docs or memory only after resolution.
4. Do not overwrite older durable entries without rationale.

## Maintenance cadence

Review memory notes when:

- A recurring ambiguity appears during repeated tasks.
- New validation gates or release rules are adopted.
- Policy ownership changes.

## Executor pseudocode

```txt
run precheck (bootstrap + search with same SID)
if precheck missing: stop at S0
capture candidate observation/learning
verify durable value and sensitivity constraints
persist only when verified; otherwise block and resolve conflict first
```
