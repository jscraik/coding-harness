---
schema_version: 1
tool_name: harness
linear_issue: JSC-105
created: 2026-04-06
status: active
audience: dual-mode
maturity: production-grade
---

# Harness CLI — Implementation Contract

## Table of Contents

- [Strategic alignment](#strategic-alignment)
- [Command model](#command-model)
- [Type-safe signatures](#type-safe-signatures)
- [Response envelope and exits](#response-envelope-and-exits)
- [Safety and dry-run spec](#safety-and-dry-run-spec)
- [Verification checklist (CA IDs)](#verification-checklist-ca-ids)

---

## Strategic alignment

**Problem:** `src/cli.ts` mixed argument parsing, 36 inline command dispatch branches, a 524-line hardcoded `printUsage()`, and process-level error handling in a single 2109-LOC file. Every new command required modifying the monolith, and duplicated `--json`/flag-parsing boilerplate compounded with each addition.

**Goal:** Slim `cli.ts` to ~150–200 LOC (imports + error handler + registry dispatch + version/help). All command behavior lives in `command-registry.ts` `CommandSpec` entries. New commands can be added without touching `cli.ts`.

**Audience:** Dual-mode — human operators running gates interactively, and autonomous agents driving CI/CD workflows. Both require deterministic, machine-readable output.

**Architecture decision:** Extend the existing `CommandSpec` registry pattern (proven with 23 commands already migrated) rather than adopting Commander.js or yargs. Zero new dependencies.

---

## Command model

The harness CLI uses a flat command namespace. Commands that have sub-actions use a positional argument:

```
harness <command> [action] [--flags]
```

### Command tree (full)

Commands are grouped by domain. `[R]` = in registry (`command-registry.ts`). `[I]` = still inline in `cli.ts`. `[✓]` = migration complete.

#### Governance gates (all registry)
| Command | Canonical name | Aliases | Status |
|---------|---------------|---------|--------|
| Linear workflow | `linear` | — | [R] ✓ |
| Linear gate | `linear-gate` | — | [R] ✓ |
| PR template gate | `pr-template-gate` | `pr-template-check` | [R] ✓ |
| Policy gate | `policy-gate` | `risk-policy-gate` | [R] ✓ |
| Evidence verify | `evidence-verify` | — | [R] ✓ |
| Preflight gate | `preflight-gate` | — | [R] ✓ |
| Review gate | `review-gate` | — | [R] ✓ |
| Branch protect | `branch-protect` | — | [R] ✓ |
| Check authz | `check-authz` | — | [R] ✓ |
| Check environment | `check-environment` | — | [R] ✓ |
| Docs gate | `docs-gate` | — | [R] ✓ |
| License gate | `license-gate` | `license-check` | [R] ✓ |
| Symphony check | `symphony-check` | `symphony:check` | [R] ✓ |
| Workflow generate | `workflow:generate` | `workflow-generate` | [R] ✓ |
| Local memory preflight | `local-memory-preflight` | — | [R] ✓ |

#### Harness management (in registry)
| Command | Status |
|---------|--------|
| `org-audit` | [R] ✓ |
| `tooling-audit` | [R] ✓ |
| `preset` | [R] ✓ |
| `doctor` | [R] ✓ |
| `health` | [R] ✓ |
| `eject` | [R] ✓ |
| `verify-coderabbit` | [R] ✓ |
| `contract` | [R] ✓ |

#### Remaining inline branches (pending migration — Units 2–5)
| Command | Unit | Notes |
|---------|------|-------|
| `risk-tier` | 2 | Simple flag parsing |
| `replay` | 2 | Positional trace ID |
| `gardener` | 2 | Simple |
| `memory-gate` | 2 | Simple |
| `silent-error` | 2 | Simple |
| `brainstorm-gate` | 2 | Simple |
| `plan-gate` | 2 | Simple |
| `prompt-gate` | 2 | Simple |
| `blast-radius` | 3 | Moderate flags |
| `remediate` | 3 | Moderate flags |
| `gap-case` | 3 | Moderate flags |
| `observability-gate` | 3 | Moderate flags |
| `drift-gate` | 3 | Moderate flags |
| `automation-run` | 3 | Moderate flags |
| `ui:fast` | 3 | Subcommand-style |
| `ui:verify` | 4 | Subcommand-style |
| `ui:explore` | 4 | Subcommand-style |
| `simulate` | 4 | Has separate `printSimulateUsage` |
| `context` | 4 | Moderate flags |
| `search` | 4 | Moderate flags |
| `index-context` | 4 | Moderate flags |
| `context-health` | 4 | Moderate flags |
| `init` | 5 | Heaviest — interactive mode |
| `ci-migrate` | 5 | Sub-modes: prepare/commit/abort/verify |
| `promote-mode` | 5 | Sub-mode of ci-migrate family |
| `diff-budget` | 5 | Heavy flags |
| `pilot-evaluate` | 5 | Heaviest — 20+ flags |
| `pilot-rollback` | 5 | Complex options type |
| `upgrade` | 5 | Complex options type |

#### Help and meta
| Flag | Behavior |
|------|---------|
| `--version`, `-v` | Print version and exit 0 |
| `--help`, `-h` | Print usage and exit 0 |
| (no command) | Print usage and exit 0 |
| (unknown command) | Print "Unknown command: X" and exit 1 |

### Sub-action commands (positional dispatch)

```
harness linear <claim|handoff|close|prepare|sync> [flags]
harness ci-migrate <prepare|commit|abort|verify> [targetDir] [flags]
harness gap-case <open|resolve> [flags]
```

---

## Type-safe signatures

### `CommandSpec` interface

```typescript
interface CommandSpec {
  name: string;                                          // canonical command name
  aliases?: string[];                                    // resolved to same spec
  summary: string;                                       // one-line for help output
  example?: string;                                      // usage example for suggestion output
  errorLabel: string;                                    // prefix for fatal error messages
  execute: (args: string[]) => number | Promise<number>; // args[0] is the first sub-action/flag (command name stripped by dispatcher)
}
```

### Shared flag conventions (all commands)

| Flag | Type | Default | Meaning |
|------|------|---------|---------|
| `--json` | boolean | false | Emit machine-readable JSON to stdout |
| `--dry-run` | boolean | false | Preview changes without writing state |
| `--contract <path>` | string | `harness.contract.json` | Path to contract file |
| `--token <value>` | string | env | API token override |

### Command: `linear`

```typescript
harness linear <action> [options]

// action: "claim" | "handoff" | "close" | "prepare" | "sync"
// --issue <id-or-url>       Linear issue ID or URL
// --team <key>              Linear team key/name
// --state <name>            Override target workflow state
// --assignee <uuid-or-me>   Claim assignee
// --no-assign               Skip assignee update
// --comment <text>          Add handoff/closure note
// --branch <name>           Include branch in Linear comment
// --workspace <path>        Include worktree path in comment
// --pr-url <url>            Attach PR URL
// --evidence-url <csv>      Comma-separated evidence URLs
// --links <csv>             Comma-separated reference URLs
// --branch-prefix <str>     Override generated branch prefix (default: codex)
// --field <name>            branch|pr-title|pr-body|link-line|closing-line|issue-url
// --findings <path|->       (sync only) findings JSON file
// --token <key>             Override LINEAR_API_KEY
// --json
```

### Command: `pilot-evaluate` (heaviest)

```typescript
harness pilot-evaluate [options]

// --artifacts <dir>          Artifacts directory (required)
// --contract <path>
// --output <path>            Write evaluation JSON to file
// --lane <name>              advisory|health
// --kill-switch              Force manual safe mode
// --evaluation-mode          local|pr|merge_group
// --rollout-stage            shadow|advisory|enforced
// --client-family            codex|claude_family|gemini_family|kimi_family|custom
// --execution-mode           interactive|automation|ci
// --operator-type            human_directed|automation|autonomous
// --override-scope           advisory_hold|temporary_unblock|temporary_promote
// --override-reason <text>
// --override-ticket <ref>
// --override-approved-by <csv>
// --override-created-at <iso>
// --override-expires-at <iso>
// --json
```

### Command: `local-memory-preflight` (strict flag validation)

```typescript
harness local-memory-preflight [options]

// --config <path>      Path to local-memory config.yaml  ← missing value → exit USAGE_ERROR
// --daemon-log <path>  Path to daemon.log                ← missing value → exit USAGE_ERROR
// --json
```

> Note: Uses `inspectFlagValue` (not `getFlagValue`) to detect the case where a flag is
> present but its value is another flag (e.g. `--config --json`). Returns `USAGE_ERROR`
> exit code, not 1, for this condition.

---

## Response envelope and exits

### Exit codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Gate passed or dry-run completed |
| `1` | Failure | Gate failed, validation error, or unknown command |
| `2` | Usage error | `USAGE_ERROR` — missing required flag value |
| Other | Command-specific | Some commands (e.g. `local-memory-preflight`) define named exit codes |

### JSON output envelope

All `--json` commands emit to stdout. Shape varies by command, but every conforming command should include:

```json
{
  "status": "pass" | "fail" | "warning",
  "command": "<command-name>",
  "exitCode": 0 | 1 | 2,
  "findings": [],
  "errors": []
}
```

> **Current state:** JSON output shape is command-specific. The registry pattern
> enables future normalization — each `CommandSpec.execute()` can adopt a shared
> envelope helper. This is deferred to Unit 6/7 of JSC-105.

### Process-level error handling (cli.ts shell responsibility)

```typescript
// Fatal error handler — catches all unhandled rejections and exceptions
function handleFatalError(type: string, error: unknown): never {
  console.error(`${type}:`, sanitizeError(error));
  if (process.env.DEBUG === "1") {
    console.error("Full error (DEBUG mode):", error);
  }
  process.exit(1);
}

process.on("unhandledRejection", ...)
process.on("uncaughtException", ...)
```

Secrets are never logged raw — `sanitizeError()` is applied to all error values.

---

## Safety and dry-run spec

### Dry-run commands

The following commands support `--dry-run`:

| Command | Dry-run behavior |
|---------|-----------------|
| `linear sync` | Preview findings sync without writing to Linear |
| `branch-protect` | Print planned ruleset changes without applying |
| `eject` | List files that would be deleted without deleting |
| `workflow:generate` | Print generated spec without writing output file |
| `init` | Preview scaffold changes without writing |
| `ci-migrate` | Preview migration plan without applying |
| `remediate` | Preview remediation plan without executing |

### Dry-run plan schema

Commands emitting `--dry-run` + `--json` must include a `plan` array:

```json
{
  "status": "dry-run",
  "plan": [
    { "action": "create" | "update" | "delete", "target": "<path-or-resource>", "reason": "..." }
  ]
}
```

### Confirmation gates

No commands require interactive confirmation by default. The `eject` command warns
without `--force`, but is non-interactive when `--json` is present.

---

## Verification checklist (CA IDs)

### CA1 — Registry dispatch completeness
Every command reachable via `harness <name>` resolves through `COMMAND_INDEX`.
- **Test:** `MIGRATED_COMMAND_AND_ALIAS_NAMES` list matches `COMMAND_INDEX` keys.
- **Current state:** 31 canonical commands registered. 20 inline branches pending (Units 3–5).

### CA2 — Alias resolution
Aliases resolve to the canonical `CommandSpec.name`, not their own name.
- **Test:** `dispatchRegistryCommand("risk-policy-gate", [])?.spec.name === "policy-gate"`.
- **Status:** ✓ Covered by `command-registry.test.ts`.

### CA3 — Unique help rows
`getRegistryCommandHelpRows()` emits exactly one row per canonical command (no duplicates from aliases).
- **Test:** `new Set(names).size === names.length`.
- **Status:** ✓ Covered by `command-registry.test.ts`.

### CA4 — README parity
Every canonical command name in `MIGRATED_COMMAND_NAMES` appears in `README.md`.
- **Test:** `compareRegistryToReadme(MIGRATED_COMMAND_NAMES, readmeCommands).missingInReadme === []`.
- **Status:** ✓ Covered by `command-registry.test.ts`.

### CA5 — Usage error path (flag-with-missing-value)
`local-memory-preflight` with `--config <next-flag>` returns `USAGE_ERROR` (not 1).
- **Test:** Covered by two tests in `command-registry.test.ts`.
- **Status:** ✓ Covered.

### CA6 — Unknown command exits 1
`dispatchRegistryCommand("nonexistent-command", [])` returns `undefined`. Shell exits 1 with error message.
- **Test:** `expect(dispatchRegistryCommand("unknown", [])).toBeUndefined()`.
- **Status:** ✓ Covered by `command-registry.test.ts`.

### CA7 — LOC target
`src/cli.ts` under 200 lines after all units complete.
- **Current state:** 1710 LOC (down from 2109). Target: ~150–200.
- **Status:** Pending Units 2–7.

### CA8 — No behavioral regression
All commands produce identical output before and after migration.
- **Approach:** Run `pnpm test` after each unit. Compare `harness --help` output snapshot.
- **Status:** Active — run after each unit merge.

### CA9 — New command addition test
A new command can be added by editing only `command-registry.ts` + new command module. Zero changes to `cli.ts`.
- **Approach:** Post-Unit 7 smoke test: add a no-op `CommandSpec` and confirm `cli.ts` is not modified.
- **Status:** Pending Unit 7.

### CA10 — printUsage() replaced
`cli.ts` no longer contains a hardcoded `printUsage()` function.
- **Approach:** `harness --help` output verified against pre-migration snapshot.
- **Status:** Pending Unit 6.

---

## Migration progress tracker

| Unit | Commands | Status |
|------|----------|--------|
| Unit 1 (simple pass-through) | org-audit, tooling-audit, preset, doctor, health, eject, verify-coderabbit, contract | ✓ Complete |
| Unit 1b (governance gates, already in registry) | linear, linear-gate, pr-template-gate, policy-gate, evidence-verify, preflight-gate, review-gate, branch-protect, check-authz, check-environment, docs-gate, license-gate, symphony-check, workflow:generate, local-memory-preflight | ✓ Complete |
| Unit 2 (batch A — simple) | risk-tier, replay, gardener, memory-gate, silent-error, brainstorm-gate, plan-gate, prompt-gate | ✓ Complete |
| Unit 3 (batch B — moderate) | blast-radius, remediate, gap-case, observability-gate, drift-gate, automation-run, ui:fast | Pending |
| Unit 4 (batch C — remaining) | ui:verify, ui:explore, simulate, context, search, index-context, context-health | Pending |
| Unit 5 (complex) | init, ci-migrate, promote-mode, diff-budget, pilot-evaluate, pilot-rollback, upgrade | Pending |
| Unit 6 | Replace printUsage() | Pending |
| Unit 7 | Final cleanup + LOC validation | Pending |
