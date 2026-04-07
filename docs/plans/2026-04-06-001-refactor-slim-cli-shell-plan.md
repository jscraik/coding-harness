---
status: complete
plan_type: refactor
linear_issue: JSC-105
created: 2026-04-06
deepened: true
---

# Refactor: Slim CLI Shell (JSC-105)

## Table of Contents

- [Problem frame](#problem-frame)
- [Acceptance criteria](#acceptance-criteria)
- [Scope boundaries](#scope-boundaries)
- [Architecture decision](#architecture-decision)
- [Target structure](#target-structure)
- [Patterns to follow](#patterns-to-follow)
- [Implementation units](#implementation-units)
- [Test scenarios](#test-scenarios)
- [Dependencies and sequencing](#dependencies-and-sequencing)
- [Risk assessment](#risk-assessment)
- [Deferred to implementation](#deferred-to-implementation)

---

## Problem frame

`src/cli.ts` is 2109 LOC mixing argument parsing, inline command dispatch (36 branches), a 524-line hardcoded `printUsage()`, and process-level error handling. Per JSC-110 architecture sequencing, it should be a thin dispatch shell so command behavior lives in command modules.

**Why now:** Every new command requires touching the monolithic file, and the duplicated `--json` / flag-parsing boilerplate across 36 branches is a maintenance burden that grows with each command addition.

---

## Acceptance criteria

1. Command behavior lives outside `src/cli.ts`
2. New commands can be added without materially increasing CLI-shell complexity
3. Exit codes and JSON output are normalized consistently across command families

---

## Scope boundaries

### In scope

- Migrate 36 inline command branches from `cli.ts` into per-command `CommandSpec` entries
- Replace hardcoded `printUsage()` with registry-generated help
- Slim `cli.ts` to ~150–200 LOC (imports + error handler + registry dispatch + version/help)
- Normalize `--json` flag handling via shared helper in each spec

### Out of scope

- Changing any command's public interface or behavior
- Adding new commands or features
- Refactoring individual command module internals
- Changing the `CommandSpec` type signature (already works for 19 commands)
- Commander.js or other framework adoption (the registry pattern is already proven)

---

## Architecture decision

**Extend the existing `CommandSpec` registry pattern** (already used by 23 commands in `command-registry.ts`) rather than introducing a new framework.

| Option | Pros | Cons |
|--------|------|------|
| **Extend CommandSpec registry** | Proven in this repo, zero new deps, mechanical migration | Each spec still has inline flag parsing (but co-located with its command) |
| **Adopt Commander.js** | Industry standard, auto-generated help | Large rewrite, behavior risk, new dep |
| **Adopt yargs** | Mature, plugin ecosystem | Same as above |
| **Adopt citty (unjs)** | Modern ESM-first | New dep, unproven at this scale |

The registry pattern is already proven. The 23 migrated commands demonstrate it works. The migration is mechanical: move each inline branch's flag parsing into a `CommandSpec.execute()` function and register it.

---

## Target structure

```text
src/cli.ts (~150-200 LOC)
  ├── Fatal error handler + process listeners
  ├── Import all command specs from registry
  ├── run(args): version/help → registry dispatch → unknown command
  └── isDirectExecution() + self-invocation

src/lib/cli/command-registry.ts (expanded)
  ├── CommandSpec type (unchanged)
  ├── ALL command specs (current 23 + migrated remaining = ~56)
  ├── Auto-generated help from specs
  └── dispatchRegistryCommand()

src/commands/*.ts (unchanged behavior)
  └── Each exports run*CLI() functions (existing pattern)
```

---

## Patterns to follow

- `src/lib/cli/command-registry.ts` — existing `CommandSpec` pattern with `name`, `aliases`, `summary`, `errorLabel`, `execute`
- Registry lookup via `COMMAND_INDEX` map
- Help generated from specs via `getRegistryCommandHelpRows()`
- Each spec's `execute(args: string[]): number | Promise<number>` owns its flag parsing and returns exit code
- `--json` normalization via `args.includes("--json")` in each spec's `execute()`
- `printUsage()` replacement: registry-generated help

### `execute` args contract

`dispatchRegistryCommand` calls `spec.execute(args.slice(1))` — the command name itself is stripped before the spec receives `args`. So inside any `execute`, `args[0]` is the first flag or sub-action, never the command name.

```typescript
// cli.ts shell:
spec.execute(args.slice(1))   // "risk-tier --files a.ts" → args = ["--files", "a.ts"]

// spec execute:
execute: (args) => {
  const filesIndex = args.indexOf("--files");  // args[0] would be "--files"
}
```

### Shared flag conventions

All commands share these flag conventions:

| Flag | Type | Default | Meaning |
|------|------|---------|---------|
| `--json` | boolean | false | Machine-readable JSON to stdout |
| `--dry-run` | boolean | false | Preview without writing state |
| `--contract <path>` | string | `harness.contract.json` | Contract file path |
| `--token <value>` | string | env var | API token override |

### Exit code semantics

| Code | Meaning |
|------|---------|
| `0` | Success / gate passed |
| `1` | Failure / gate failed / unknown command |
| `2` | `USAGE_ERROR` — flag present but value missing |
| Command-specific | Some commands define named codes (e.g. `local-memory-preflight`) |

### JSON output envelope

When `--json` is present, every conforming command emits to stdout:

```json
{
  "status": "pass" | "fail" | "warning",
  "command": "<command-name>",
  "exitCode": 0 | 1 | 2,
  "findings": [],
  "errors": []
}
```

> **Current state:** Shape is command-specific. Normalization is deferred to Unit 6/7.

### Dry-run output schema

Commands supporting `--dry-run --json` emit a `plan` array:

```json
{
  "status": "dry-run",
  "plan": [
    { "action": "create" | "update" | "delete", "target": "<path-or-resource>", "reason": "..." }
  ]
}
```

### Confirmation gates

No commands require interactive confirmation by default. `eject` prints a warning without `--force` but is fully non-interactive when `--json` is present.

---

## Implementation units

### Unit 1: Migrate simple pass-through commands (8 commands) ✓ Complete

**Goal:** Move the simplest inline branches (commands that slice args and pass directly) into the registry.

**Commands:** `org-audit`, `tooling-audit`, `preset`, `doctor`, `health`, `eject`, `verify-coderabbit`, `contract`

**Approach:** Add each as a `CommandSpec` in `command-registry.ts` with the same inline `execute()` body currently in `cli.ts`. Remove the corresponding `if` branch from `cli.ts`.

**Files:**
- `src/lib/cli/command-registry.ts` — add 8 specs
- `src/lib/cli/command-registry.test.ts` — add migration tests

**Verification:** `pnpm test` passes; `harness <command>` for each produces identical output.

---

### Unit 2: Migrate flag-parsing commands batch A (8 commands) ✓ Complete

**Goal:** Move commands with simple flag parsing (3–6 flags each) into the registry.

**Commands:** `risk-tier`, `replay`, `gardener`, `memory-gate`, `silent-error`, `brainstorm-gate`, `plan-gate`, `prompt-gate`

**Approach:** Same as Unit 1 — each `CommandSpec.execute()` contains the flag parsing logic currently inline in `cli.ts`. The `run*CLI()` function call remains unchanged. Remove the corresponding `if` branch from `cli.ts`.

> **Note:** `replay` has a positional trace-ID fallback: `args[0]` is used as `traceId` if no `--trace-id` flag is present and the value does not start with `-` (the command name is stripped by `dispatchRegistryCommand` before `execute()` runs). Preserve this exactly.

**Files:**
- `src/lib/cli/command-registry.ts` — add 8 specs
- `src/lib/cli/command-registry.test.ts` — add migration tests

**Verification:** `pnpm test` passes; `harness <command>` for each produces identical output.

---

### Unit 3: Migrate flag-parsing command batch B (7 commands)

**Goal:** Move commands with moderate flag parsing (6–12 flags each).

**Commands:** `blast-radius`, `remediate`, `gap-case`, `observability-gate`, `drift-gate`, `automation-run`, `ui:fast`

**Approach:** Same pattern. Note `ui:fast` is a subcommand-style entry — verify it dispatches correctly via its alias.

**Files:**
- `src/lib/cli/command-registry.ts` — add 7 specs
- `src/lib/cli/command-registry.test.ts` — add migration tests

**Verification:** `pnpm test` passes; `harness <command>` for each produces identical output.

---

### Unit 4: Migrate flag-parsing command batch C (7 commands)

**Goal:** Move remaining inline commands including UI loop and search commands.

**Commands:** `ui:verify`, `ui:explore`, `simulate`, `context`, `search`, `index-context`, `context-health`

**Approach:** Same pattern. Note `simulate` has a separate `printSimulateUsage` function — include it in the spec's `execute()` for the help path.

**Files:**
- `src/lib/cli/command-registry.ts` — add 7 specs
- `src/lib/cli/command-registry.test.ts` — add migration tests

**Verification:** `pnpm test` passes; `harness <command>` for each produces identical output.

---

### Unit 5: Migrate complex/legacy commands (6 commands)

**Goal:** Move the heaviest inline branches.

**Commands:** `init`, `ci-migrate`, `promote-mode`, `diff-budget`, `pilot-evaluate`, `pilot-rollback`, `upgrade`

**Approach:** These have the most flag parsing. `ci-migrate` has multiple sub-modes (`prepare`, `commit`, `abort`, `verify`). Register each mode as a separate spec or handle sub-dispatch within the spec's `execute()`. `pilot-evaluate` has 20+ flags — migrate mechanically, no behavior changes.

**Files:**
- `src/lib/cli/command-registry.ts` — add 6+ specs (more if splitting sub-modes)
- `src/cli.ts` — remove remaining inline branches

**Verification:** `pnpm test` passes; each command produces identical output.

---

### Unit 6: Replace `printUsage()` with registry-generated help

**Goal:** Remove the 524-line hardcoded `printUsage()` and generate help from `CommandSpec` entries.

**Approach:**
1. Each `CommandSpec` already has `name` and `summary`
2. Add optional `category?: string` to `CommandSpec` for grouping (matching current help categories)
3. `getRegistryCommandHelpRows()` already exists — extend it to include categories
4. Replace `printUsage()` body with a call to `renderCommandHelpRows()` using registry data
5. Snapshot `harness --help` output *before migration* and store as a regression fixture

**Files:**
- `src/lib/cli/command-registry.ts` — extend `CommandSpec` with optional `category`; update `getRegistryCommandHelpRows()`
- `src/lib/cli/help-renderer.ts` — add category-aware rendering
- `src/cli.ts` — replace `printUsage()` with registry-based version

**Verification:**
- `harness --help` output matches pre-migration snapshot
- All command names and summaries present
- `pnpm check` passes
- All tests pass
- `src/cli.ts` under 200 lines

---

### Unit 7: Final cleanup and LOC validation

**Goal:** Confirm the acceptance criteria are fully met.

**Checks:**
- `src/cli.ts` is under 200 lines
- No behavioral regression — all existing tests pass
- New command addition test: add a no-op `CommandSpec` and confirm `cli.ts` is not modified

---

## Test scenarios

### Units 1–5 (per batch)

- **Happy path:** Each migrated command runs with typical flags and produces identical output
- **Edge cases:** `--json` flag produces JSON output; unknown flags produce error; missing required flags produce error
- **Error path:** Commands that fail still return correct exit codes
- **JSON normalization:** Each migrated spec's `--json` output is valid JSON

### Unit 6

- **Help output:** `harness --help` lists all commands with correct summaries
- **Category grouping:** Commands appear under correct category headers
- **Unknown command:** `harness nonexistent` prints "Unknown command" and exits 1
- **No args:** `harness` prints help and exits 0

### Unit 7

- **LOC target:** `src/cli.ts` under 200 lines
- **No behavioral regression:** All existing tests pass
- **New command addition:** Can add a new command by only editing `command-registry.ts` + the new command module (zero changes to `cli.ts`)

### Acceptance matrix (stable CA IDs)

| CA | Criterion | Test location | Status |
|----|-----------|---------------|--------|
| CA1 | Every command resolves through `COMMAND_INDEX` | `command-registry.test.ts` — `MIGRATED_COMMAND_NAMES` list | Active |
| CA2 | Aliases resolve to canonical `spec.name` | `command-registry.test.ts` — alias dispatch tests | ✓ |
| CA3 | `getRegistryCommandHelpRows()` emits no duplicates | `command-registry.test.ts` — unique help rows test | ✓ |
| CA4 | All canonical names present in `README.md` | `command-registry.test.ts` — README parity test | ✓ |
| CA5 | Flag-with-missing-value returns `USAGE_ERROR` (not 1) | `command-registry.test.ts` — `local-memory-preflight` tests | ✓ |
| CA6 | Unknown command returns `undefined` from registry; shell exits 1 | `command-registry.test.ts` — unknown command test | ✓ |
| CA7 | `src/cli.ts` under 200 lines | Manual LOC check post-Unit 7 | ✓ 130 LOC |
| CA8 | All commands produce identical output pre/post migration | `pnpm test` after each unit | Active |
| CA9 | New command requires zero changes to `cli.ts` | Smoke test post-Unit 7 | ✓ |
| CA10 | `printUsage()` removed; `harness --help` matches snapshot | Snapshot fixture test in Unit 6 | ✓ |

---

## Dependencies and sequencing

```
Unit 1 → Unit 2 → Unit 3 → Unit 4 → Unit 5
                                          ↓
                               Unit 6 (help) → Unit 7 (cleanup)
```

Units 1–5 are sequential to avoid merge conflicts in `cli.ts`. Unit 6 depends on all commands being in the registry. Unit 7 is final validation.

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Flag parsing behavioral regression | Low | High | Run full test suite after each batch; compare output |
| `--json` flag handling inconsistency | Medium | Medium | All specs use same `args.includes("--json")` pattern |
| `printUsage()` regression | Low | Medium | Pre-migration snapshot comparison of help output |
| Async command handling | Low | High | Registry already handles `Promise<number>` returns |
| Import cycle from registry | Low | Medium | Registry imports command modules (existing pattern); `cli.ts` imports registry only |
| `replay` positional arg regression | Low | High | Explicitly preserve `args[0]` fallback in spec |

---

## Deferred to implementation

- Whether to split `command-registry.ts` into per-command spec files if it grows too large (decide after Unit 5)
- Whether to add `category` field to `CommandSpec` for help grouping (decide in Unit 6)
- Exact LOC target for slimmed `cli.ts` (150–200 is the range; confirm after Unit 7)
