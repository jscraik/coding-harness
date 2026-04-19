---
title: Project Type Auto-Detection for harness init
date: 2026-03-24
status: draft
spec_required: lite
risk_level: low
complexity: medium
last_validated: 2026-04-18
---

# Project Type Auto-Detection for harness init

## Table of Contents
- [What We're Building](#what-were-building)
- [Why It Matters](#why-it-matters)
- [Options Considered](#options-considered)
- [Chosen Approach](#chosen-approach)
- [Key Decisions](#key-decisions)
- [Constraints / Non-Goals](#constraints--non-goals)
- [Success Criteria](#success-criteria)
- [Open Questions](#open-questions)
- [Recommended Next Step](#recommended-next-step)

## What We're Building

A heuristic file-system scanner that runs at `harness init` time to detect the project type (`cli`, `desktop`, `library`, `web`), persists the result as `projectType` in `harness.contract.json`, and enables gates to suppress checks that don't apply to the detected project type.

## Why It Matters

The root cause of three major pain-points from the trace-narrative upgrade:

1. **JSC-56 / JSC-57** — `init` blindly overwrites files. It can't no-op or diff-before-write unless it knows what the project expects.
2. **JSC-63** — `drift-gate` fires `command.surface.sources.missing` on desktop apps that have no CLI. No way to suppress without knowing project type.
3. **JSC-71 (criterion 5 + 6)** — "Convention over configuration" and "operating model tiers" both require a known project type to select the right default template set and tier.

Without project type detection, every downstream improvement (idempotent init, per-type gate suppression, tier selection) is blocked on the human manually knowing to set a field the schema doesn't even document yet.

## Options Considered

### Option A — Heuristic file/directory detection at init time (recommended)

Scan a fixed priority-ordered list of signal files and directories at the start of `harness init`. Derive `projectType` from first match. Persist to contract. Provide a `--project-type` override flag for when auto-detection is wrong.

**Pros:**
- Pure read operation — zero side effects before consent
- Deterministic and fully testable (mock filesystem)
- No external dependencies
- Directly improves JSC-63 gate suppression

**Cons:**
- Can misclassify monorepos or hybrid projects (e.g., Tauri + web frontend)
- Signal ordering must be maintained carefully (e.g., Tauri should win over `vite.config.*`)

**Best fit:** 95%+ of real solo and team projects.

### Option B — Interactive prompt at init time

Ask: "What type of project is this? (cli/desktop/library/web)". Store the answer. No inference.

**Pros:** Always accurate. No false-positives.

**Cons:** Blocks agent-run `--non-interactive` init. Adds ceremony to every first-time install. Defeats the "zero-config start" goal of JSC-71.

**Best fit:** Only valid as a fallback when detection produces `"unknown"`.

### Option C — Require `projectType` as a mandatory contract field; no auto-detection

Fail `init` if `projectType` is absent. Make humans and agents set it explicitly.

**Pros:** Explicit. No false-positives.

**Cons:** Worse UX than today. Moves ceremony earlier, not eliminates it. No help for brownfield repos upgrading from 0.7.x.

**Best fit:** Reject.

## Chosen Approach

**Option A** (heuristic detection) with **Option B as a fallback** when the scan returns `"unknown"` and `--non-interactive` is not set.

Signal priority order (highest wins):

| Signal | Detected `projectType` |
|---|---|
| `src-tauri/` directory exists | `desktop` |
| `src/cli.ts` or `src/cli.js` exists | `cli` |
| `vite.config.*` or `next.config.*` or `nuxt.config.*` exists | `web` |
| `src/index.ts` exists, no CLI/web signals | `library` |
| None of the above | `unknown` |

When `unknown`, `init` logs a warning and continues using a conservative universal template. No blocking. `--project-type <type>` always overrides.

Field added to `harness.contract.json`:
```json
{
  "projectType": "cli" | "desktop" | "library" | "web" | "unknown"
}
```

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Where detection runs | Start of `harness init`, before any writes | Read-only; must run before template selection |
| Failure mode when unknown | Warn + continue with universal defaults | Blocking would break brownfield upgrades |
| Override mechanism | `--project-type <type>` CLI flag | Agents can always override; humans can fix misdetection |
| Persistence | `harness.contract.json` `projectType` field | Single source of truth; gates read it directly |
| Gate suppression | Gates check `projectType` to skip inapplicable checks | Decoupled: detection only writes; gates only read |
| Monorepo handling | Detect as `unknown`, let human/agent override | Monorepo detection deferred to future scope |

## Constraints / Non-Goals

- **Not in scope:** monorepo detection, multiple project types in one repo
- **Not in scope:** MCP server (separate JSC-71 criterion)
- **Not in scope:** changing any gate logic in this spec — gate suppression is a downstream consumer of `projectType`, documented as future work
- **Not in scope:** project type migration (e.g., changing from `library` to `cli`)
- Contract field is additive — existing contracts without `projectType` default to `"unknown"` and behave as today

## Success Criteria

1. `harness init` on a Tauri repo detects `desktop` without a flag
2. `harness init --project-type web` sets `web` regardless of what the detector finds
3. `harness init` on a repo with no signals logs a warning and completes with `unknown`
4. `harness.contract.json` gains `projectType` field after init
5. Existing contracts without `projectType` continue to work (backward compat)
6. Detection logic has ≥90% unit-test coverage; all 5 project types plus `unknown` are tested

## Open Questions

None blocking the spec.

## Recommended Next Step

→ `ce-spec` (lite) to define the interface contract, acceptance IDs, and failure model before planning.
