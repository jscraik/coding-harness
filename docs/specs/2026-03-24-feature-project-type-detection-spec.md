---
title: Project Type Auto-Detection
type: feature
status: draft
date: 2026-03-24
deepened: 2026-03-24
origin: docs/brainstorms/2026-03-24-project-type-detection-brainstorm.md
risk: low
spec_depth: lite
ui_required: false
linear: JSC-71
last_validated: 2026-04-18
---

# Project Type Auto-Detection — Lite Spec

> **Enhancement Summary (2026-03-24 deepening pass)**
>
> Four weaknesses resolved against the live codebase (`src/lib/init/`, `src/lib/contract/types.ts`):
> 1. **Domain model tightened:** `DetectionRule` gains a mandatory `name: string` field (required for `matchedRule` output). Glob pattern evaluation strategy (`picomatch` at detection time) made explicit. `OVERRIDE_RULE_NAME` constant declared.
> 2. **Lifecycle concretised:** Exact insertion point in `runInit()` named (after `normalizeCIProvider`, before template loop). `InitOptions` gains `projectType?: ProjectType`. Contract write strategy clarified: detection writes only to `harness.contract.json` via `atomicWrite`; no migration path needed because `HarnessContract` will receive the new optional field.
> 3. **Interfaces corrected:** `HarnessContract` (canonical TypeScript source) must gain `projectType?: ProjectType`. `ContractSchema` (migration surface in `lib/init/types.ts`) must mirror it. JSON output shape corrected to match real `InitOutput` extension pattern.
> 4. **Failure model hardened:** `"unknown"` warning suppressed in `--json` mode (structured only). `--non-interactive` flag interaction documented. `SA15` added.

## Table of Contents
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants and Safety Requirements](#invariants-and-safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Definition of Done](#definition-of-done)

---

## Problem Statement

`harness init` writes template files without knowing the project type. This causes:

1. Invalid checks fire (e.g., `command.surface.sources.missing` on a desktop app)
2. `init` cannot make safe diff-before-write decisions without knowing what the project expects
3. Gate suppressions (JSC-63) have no typed field to read from; suppressions are a manual workaround today

The fix is to detect project type once, persist it as a typed field, and let all downstream consumers (gates, init templates, tier selection) read it without re-scanning.

---

## Goals

1. Detect `projectType` from filesystem signals before any `init` writes occur
2. Persist detected type as `projectType` in `harness.contract.json`
3. Accept `--project-type <type>` as an explicit override that always wins
4. Maintain backward compatibility: contracts without `projectType` → `"unknown"`, behaviour unchanged
5. Provide a deterministic, fully-tested detection library usable by any future consumer (gates, health, MCP)

---

## Non-Goals

- Monorepo detection (multiple types in one repo)
- Changing gate suppression logic (downstream consumer of `projectType`, separate work)
- Project type migration (changing type after first init)
- Interactive prompting during `"unknown"` — only a warning, never blocking
- MCP exposure of `projectType`

---

## System Boundary

**Owns:**
- `src/lib/project-type/detector.ts` — detection logic and signal resolution
- `src/lib/project-type/types.ts` — `ProjectType` union type and `DetectionResult`
- `src/lib/contract/types.ts` — add `projectType?: ProjectType` to `HarnessContract`
- `src/lib/init/types.ts` — add `projectType?: ProjectType` to `InitOptions` and `ContractSchema`
- `src/lib/init/cli.ts` (`runInit`) — reads detection result, writes `projectType` to contract via `atomicWrite`
- `harness.contract.json` (the template file) — gains `"projectType"` example field

**Does not own:**
- Gate suppression based on `projectType` (future work)
- JSON Schema publication endpoint (JSC-69 scope)
- Schema migration path — `projectType` is optional, so no migration step is required; absence defaults to `"unknown"` at all read sites

---

## Core Domain Model

```typescript
// src/lib/project-type/types.ts

export type ProjectType = "cli" | "desktop" | "library" | "web" | "unknown";

/** Canonical name used when --project-type override is supplied */
export const OVERRIDE_RULE_NAME = "override" as const;

export interface DetectionSignal {
  type: "file" | "directory";
  path: string;       // repo-relative path (exact match) OR undefined if pattern used
  pattern?: string;   // glob pattern matched with picomatch against root entries, e.g. "vite.config.*"
}

export interface DetectionRule {
  name: string;                // canonical rule identifier, used in DetectionResult.matchedRule
  projectType: ProjectType;
  signals: DetectionSignal[];  // ALL must match (AND within rule; first-match-wins across rules)
  priority: number;            // lower number = checked first
}

export interface DetectionResult {
  projectType: ProjectType;
  matchedRule: string | null;   // rule name, OVERRIDE_RULE_NAME, or null for "unknown"
  confidence: "high" | "low";   // high = explicit match or override; low = "unknown"
  signals: string[];            // matched signal paths for structured logs
}
```

**How glob signals are evaluated:** `picomatch` (a direct production dependency — `picomatch@^4.0.3` in `package.json`) is used to match `pattern` values against the filenames in `targetDir` (root level only, non-recursive). `existsSync` is used for exact `path` entries. No network access. Detection is fully synchronous.

**Signal priority table** (lower priority number = checked first):

| Priority | Rule `name` | Signal(s) | → `projectType` |
|---|---|---|---|
| 1 | `tauri` | dir `src-tauri/` (exact) | `desktop` |
| 2 | `cli-ts` | file `src/cli.ts` (exact) | `cli` |
| 3 | `cli-js` | file `src/cli.js` (exact) | `cli` |
| 4 | `vite` | pattern `vite.config.*` at root | `web` |
| 5 | `next` | pattern `next.config.*` at root | `web` |
| 6 | `nuxt` | pattern `nuxt.config.*` at root | `web` |
| 7 | `library` | file `src/index.ts` (exact, no earlier match) | `library` |
| — | — | no rule matched | `unknown` |

Rules are evaluated in priority order. **First match wins.** Tauri always wins over Vite because a Tauri + Vite project is a desktop app, not a web app.

---

## Main Flow / Lifecycle

### Detection flow (read-only, runs before any init writes)

Insertion point in `runInit()` in `src/lib/init/cli.ts`: **after `normalizeCIProvider` succeeds and before the `templates` loop**.

```typescript
// src/lib/init/cli.ts — inside runInit(), after normalizeCIProvider succeeds:
const detectionResult = detectProjectType(dir, options.projectType);

if (detectionResult.projectType === "unknown" && !options.dryRun) {
  // Warn only in non-JSON mode; JSON output carries structured result
  if (!options.json) {
    console.warn(
      "⚠️  Could not auto-detect project type. " +
      "Defaulting to universal template. " +
      "Run `harness init --project-type <cli|desktop|library|web>` to set explicitly."
    );
  }
}
```

`detectProjectType` signature:

```typescript
export function detectProjectType(
  targetDir: string,
  override?: ProjectType,
): DetectionResult
```

- If `override` is provided and valid, skip all signal scanning; return `{ projectType: override, matchedRule: OVERRIDE_RULE_NAME, confidence: "high", signals: [] }`
- Else: evaluate rules in priority order; return first match
- If no rule matches: return `{ projectType: "unknown", matchedRule: null, confidence: "low", signals: [] }`

### Contract write flow

`harness.contract.json` is written via `atomicWrite` inside `runInit()`. The detection result is merged into the contract object just before `atomicWrite`:

```typescript
// Load existing contract (or start from default):
const existingContract = loadContractIfExists(dir); // returns null if absent

const projectTypeToWrite: ProjectType =
  existingContract?.projectType ?? detectionResult.projectType;

// projectType is written as a top-level field in the contract object.
// On upgrade (contract already has projectType), existing value is preserved.
```

**Upgrade-safe invariant:** When `existingContract.projectType` is already set, detection runs, but its result is never used to overwrite the stored value — unless `--project-type` was explicitly passed on the CLI.

**Exception: `--project-type` is always authoritative.** Even on re-init of an upgading repo that already has `projectType: "cli"`, passing `--project-type web` WILL overwrite because the flag is explicit operator intent.

---

## Interfaces and Dependencies

### `InitOptions` addition (`src/lib/init/types.ts`)

```typescript
export interface InitOptions {
  // ... existing fields ...
  projectType?: ProjectType;  // from --project-type flag; undefined = auto-detect
}
```

### `HarnessContract` addition (`src/lib/contract/types.ts`)

```typescript
export interface HarnessContract {
  // ... existing fields ...
  /** Auto-detected or operator-specified project type */
  projectType?: ProjectType;
}
```

Field is optional with no default in `DEFAULT_CONTRACT` — absence is treated as `"unknown"` at all read sites.

### `ContractSchema` addition (`src/lib/init/types.ts`)

```typescript
export interface ContractSchema {
  // ... existing fields ...
  projectType?: ProjectType;
}
```

Required because `schema-migrate.ts` uses `ContractSchema` for contract read/write operations.

### CLI flag

```
harness init --project-type <cli|desktop|library|web>
```

Validated against the `ProjectType` union (excluding `"unknown"` — operators cannot explicitly set `"unknown"`). Invalid values → exit code 1, error listing valid values.

**Interaction with `--dry-run`:** Detection runs during dry-run. The detected type is included in dry-run output but `harness.contract.json` is not written.

**Interaction with `--non-interactive`:** Detection is always silent (read-only). `"unknown"` warning is emitted in non-interactive mode unless `--json` is active.

### `harness.contract.json` schema addition

```jsonc
{
  // ... existing fields ...
  "projectType": "cli"  // "cli" | "desktop" | "library" | "web" — absence = "unknown"
}
```

---

## Invariants and Safety Requirements

| # | Invariant |
|---|---|
| I1 | Detection is always read-only; no filesystem writes occur in `detectProjectType` |
| I2 | An existing `projectType` in the contract is never overwritten by auto-detection on re-init |
| I3 | `--project-type` always wins over auto-detection AND over any existing `projectType` in the contract |
| I4 | `"unknown"` produces a warning but never blocks `init` |
| I5 | Detection result is deterministic for a given set of filesystem signals |
| I6 | `"unknown"` is not a permitted value for `--project-type` (auto-only) |
| I7 | Warning output is suppressed in `--json` mode; detection result appears only in structured output |

---

## Failure Model and Recovery

| Failure | Behaviour |
|---|---|
| `targetDir` not found | Init fails early with existing path-validation error (pre-existing behaviour, no change) |
| Signal file unreadable (permissions) | Treat signal as absent; continue with remaining rules |
| `--project-type` receives invalid value | Exit code 1(`INVALID_PATH`), error listing valid types (not `"unknown"`) |
| `--project-type unknown` (explicit) | Exit code 1 — `"unknown"` is invalid as an override target |
| Contract write fails | Existing `atomicWrite` error handling (pre-existing, no change) |
| All signals absent (`"unknown"`) | Warn in non-JSON mode; continue with universal template |
| `picomatch` throws on malformed pattern | Catch per-rule; treat rule signals as absent and continue; log at debug level |

No new fatal error paths. All new failures degrade safely: either warn and continue or use existing `INVALID_PATH` exit.

---

## Observability

**Human-readable mode:**
- `console.warn` on `"unknown"` detection when not in `--json` mode
- `console.info` on successful detection: `"ℹ  Detected project type: <type> (matched rule: <name>)"`

**JSON mode (`--json` flag):**

The existing `InitOutput` type gains `projectTypeDetection`:

```typescript
// src/lib/init/types.ts
export interface InitOutput {
  packageManager: string;
  created: string[];
  skipped: string[];
  updateCheck?: UpdateCheckInfo;
  proposedChanges?: ProposedChange[];
  projectTypeDetection?: DetectionResult;   // ← new, always present on normal init
}
```

JSON output shape:

```json
{
  "packageManager": "pnpm",
  "created": ["harness.contract.json"],
  "skipped": [],
  "projectTypeDetection": {
    "projectType": "cli",
    "matchedRule": "cli-ts",
    "confidence": "high",
    "signals": ["src/cli.ts"]
  }
}
```

For `"unknown"`:

```json
{
  "projectTypeDetection": {
    "projectType": "unknown",
    "matchedRule": null,
    "confidence": "low",
    "signals": []
  }
}
```

---

## Acceptance and Test Matrix

| ID | Scenario | Input | Expected output |
|---|---|---|---|
| SA1 | Tauri repo detection | `src-tauri/` dir present | `projectType: "desktop"`, `matchedRule: "tauri"` |
| SA2 | CLI repo detection (TypeScript) | `src/cli.ts` exists | `projectType: "cli"`, `matchedRule: "cli-ts"` |
| SA3 | CLI repo detection (JavaScript) | `src/cli.js` exists, no `src-tauri/` | `projectType: "cli"`, `matchedRule: "cli-js"` |
| SA4 | Vite web repo detection | `vite.config.ts` at root, no Tauri/CLI | `projectType: "web"`, `matchedRule: "vite"` |
| SA5 | Next.js web repo detection | `next.config.js` at root | `projectType: "web"`, `matchedRule: "next"` |
| SA6 | Library detection | `src/index.ts` only, no other signals | `projectType: "library"`, `matchedRule: "library"` |
| SA7 | Unknown (no signals) | Empty dir | `projectType: "unknown"`, `matchedRule: null`, `confidence: "low"` |
| SA8 | Tauri + Vite coexist (priority) | Both `src-tauri/` and `vite.config.ts` | `projectType: "desktop"`, `matchedRule: "tauri"` |
| SA9 | Explicit override wins over detection | `--project-type web` on a Tauri repo | `projectType: "web"`, `matchedRule: "override"`, `confidence: "high"` |
| SA10 | Invalid override flag | `--project-type robot` | Exit code 1, error listing `cli\|desktop\|library\|web` |
| SA11 | Upgrade: auto-detection does NOT overwrite existing value | Contract has `projectType: "cli"`, no `--project-type` flag | Stored value `"cli"` unchanged; no warning |
| SA12 | Upgrade: `--project-type` flag DOES overwrite existing value | Contract has `projectType: "cli"`, `--project-type web` flag | Stored value updated to `"web"` |
| SA13 | Unknown emits `console.warn` in non-JSON mode | No signals, no `--json` | `console.warn` called exactly once |
| SA14 | Unknown does NOT emit `console.warn` in JSON mode | No signals, `--json` flag | `console.warn` not called; `projectTypeDetection.projectType === "unknown"` in JSON |
| SA15 | Detection is read-only | Spy on `writeFileSync`/`atomicWrite` during `detectProjectType` call | Zero write calls from within `detectProjectType` |
| SA16 | `"unknown"` rejected as `--project-type` value | `--project-type unknown` | Exit code 1, error message |
| SA17 | JSON output includes `projectTypeDetection` on successful init | `harness init --json` on CLI repo | `projectTypeDetection` present and correct |
| SA18 | `picomatch` error on malformed pattern is non-fatal | Inject malformed pattern into a rule | Rule skipped; next rule evaluated; init completes |

---

## Definition of Done

- [ ] `src/lib/project-type/types.ts` exports `ProjectType`, `OVERRIDE_RULE_NAME`, `DetectionSignal`, `DetectionRule`, `DetectionResult`
- [ ] `src/lib/project-type/detector.ts` implements `detectProjectType` as a pure function (no side effects); uses `picomatch` for glob signals and `existsSync` for exact paths
- [ ] All 18 acceptance tests (`SA1`–`SA18`) pass
- [ ] `src/lib/contract/types.ts` — `HarnessContract` gains optional `projectType?: ProjectType`
- [ ] `src/lib/init/types.ts` — `InitOptions` gains `projectType?: ProjectType`; `ContractSchema` gains `projectType?: ProjectType`; `InitOutput` gains `projectTypeDetection?: DetectionResult`
- [ ] `src/lib/init/cli.ts` (`runInit`) — detection runs after `normalizeCIProvider`, before template loop; contract patched with `projectTypeToWrite`; warning suppressed in `--json` mode
- [ ] `--project-type <cli|desktop|library|web>` CLI flag wired, validated, and `"unknown"` rejected
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (all existing + new)
