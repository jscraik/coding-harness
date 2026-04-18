---
title: Structured Output Standardisation and health --auto-fix
type: standard-spec
status: draft
date: 2026-03-24
deeped: 2026-03-24
origin: JSC-71 brainstorm (Option B) + existing command audit
risk: medium
spec_depth: lite
ui_required: false
last_validated: 2026-04-18
---

> **Enhancement Summary (2026-03-24, pass 1):** Deepened after command audit revealing three adapter shape classes (rich-finding, binary-result, async). Added explicit adapter synthesis rules for binary-result gates (`policy-gate`, `pr-template-gate`). Excluded `review-gate` from v1 scope (async, network-dependent). Added stdout discipline invariant from Learnings (`process.stdout.write` not `console.info` for JSON). Expanded Failure Model with adapter-specific error cases. Added SA14–SA19 covering binary-result synthesis, async exclusion, stdout discipline, and `linear-gate` check mapping. Resolved Open Question 2.
>
> **Correction (2026-03-24, pass 2 — deepen-plan cross-check):** `plan-gate` is **not** binary-result. Repo audit of `src/lib/plan-gate/types.ts` confirms `PlanGateResult.errors` is `PlanError[]` with typed `code` fields, not `string[]`. Reclassified as **coded-error** — fourth adapter class added to table. Spec SA14 remains valid for `policy-gate` and `pr-template-gate`; `plan-gate` SA coverage is handled via P2b in the implementation plan.

# Structured Output Standardisation and `health --auto-fix`

## Table of Contents

- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Migration Notes and Compatibility Strategy](#migration-notes-and-compatibility-strategy)
- [Main Flow and Lifecycle](#main-flow-and-lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants and Safety Requirements](#invariants-and-safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

---

## Problem Statement

Coding agents consume `harness` CLI output by shelling out and parsing text. Two problems block reliable agent consumption:

1. **Schema fragmentation**: Every gate command defines its own per-gate types (`DriftFinding`, `DocsFinding`, `GateResult`, …) with inconsistent field names (`snake_case` in drift-gate, `camelCase` in health), inconsistent severity vocabularies (`"error"/"warning"/"info"` vs `"ok"/"warning"/"error"`), and no shared output contract. Agents cannot write stable parsers.

2. **No self-healing**: `harness health` identifies findings but cannot fix them. Agents must parse human-readable text, invent fix commands, and hope the output is stable. `harness remediate` exists but targets CodeQL/Codex findings, not harness gate findings.

---

## Goals

1. Define a canonical **`GateFinding`** and **`GateResult`** schema shared across all gate commands.
2. Publish those types in `src/lib/output/types.ts` as the single authoritative output contract.
3. Audit existing `--json` paths on the 9 highest-value gate commands and align their output to the canonical schema (adapter pattern — internal types stay gate-specific, output is normalised at the CLI boundary).
4. Add `harness health --auto-fix` that runs all applicable gates, collects findings with `fix.command` set, and applies each fix in sequence with a dry-run preview before execution.
5. Update the `coding-harness` skill to document the stable schema so agents can rely on it.

---

## Non-Goals

- MCP server (`harness mcp-serve`) — deferred to JSC-71 v2.
- Full `--json` normalisation for all 50+ commands — v1 covers the gate commands surfaced by `harness health` and `harness doctor`.
- Per-project check exemptions ([JSC-70](https://linear.app/jscraik/issue/JSC-70)).
- Publishing a JSON Schema to `schema.brainwav.io` — deferred.
- Structured logging to `artifacts/harness/logs/` — deferred.
- `harness insights` local telemetry — deferred.
- Changing exit codes — all existing exit code contracts are preserved.

---

## System Boundary

```
┌─────────────────────────────────────────────────────┐
│  src/lib/output/                                     │
│  ├── types.ts        ← GateFinding, GateResult        │
│  └── normalise.ts    ← per-gate adapter functions     │
└──────────────┬──────────────────────────────────────┘
               │ used by
┌──────────────▼──────────────────────────────────────┐
│  src/commands/                                       │
│  ├── health.ts       ← --auto-fix added              │
│  ├── doctor.ts       ← --json normalised             │
│  ├── drift-gate.ts   ← --json normalised (rich)      │
│  ├── docs-gate.ts    ← --json normalised (rich)      │
│  ├── policy-gate.ts  ← --json normalised (binary)    │
│  ├── plan-gate.ts    ← --json normalised (binary)*   │
│  ├── linear-gate.ts  ← --json normalised (checklist) │
│  └── pr-template-gate.ts ← --json normalised (binary)│
│  // review-gate: v1 EXCLUDED — emits status:skipped  │
└─────────────────────────────────────────────────────┘
               │ consumed by
┌──────────────▼──────────────────────────────────────┐
│  agents consuming harness JSON output                │
│  .agents/skills/coding-harness/SKILL.md (updated)   │
└─────────────────────────────────────────────────────┘
```

> \* `plan-gate` internal result type assumed binary; verify at implementation time before writing adapter.

**In-scope commands** (v1): `drift-gate`, `docs-gate`, `policy-gate`, `plan-gate`, `linear-gate`, `pr-template-gate`, `doctor`, `health`.

**Explicitly excluded from v1:**
- `review-gate` — async gate with GitHub API network dependency; its `jsonOutput` object is already near-canonical but the async lifecycle and potential 429/503 errors require a separate adapter design. Defer to v2.
- `remediate`, `ci-migrate`, `org-audit`, `tooling-audit`, `context-health`, and all others — out of scope.

> **Consequence:** The `harness health` scorecard currently includes `review-gate`. In v1, `harness health --json` will emit a `GateResult` with `status: "skipped"` and `meta.reason: "async-gate-excluded-from-normalisation-v1"` for `review-gate`.

---

## Core Domain Model

### Adapter shape classes

Command audits revealed three distinct internal output shapes that adapters must handle:

| Class | Commands | Internal shape | Adapter challenge |
|---|---|---|---|
| **Rich-finding** | `drift-gate`, `docs-gate` | `DriftFinding[]` / `DocsFinding[]` with `rule_id`, `severity`, `message`, `path` | Translate `snake_case` fields, map `rule_id → id`, map severity vocabulary |
| **Binary-result** | `policy-gate`, `pr-template-gate` | `{ passed: boolean, errors: string[] }` — no per-finding array | **Synthesise** one `GateFinding` per error string; `findings: []` when `passed === true` |
| **Coded-error** | `plan-gate` | `PlanGateResult { passed: boolean, errors: PlanError[] }` where `PlanError = { code: string, message: string }` | Map each `PlanError.code` → `id` as `"plan-gate.result.error.<code>"`; populate `fix.manual` from `getRecoveryHint(code)`; already has `--json` path via `createJsonOutput` — must be replaced |
| **Check-list** | `linear-gate` | `LinearGateCheck[]` with `code`, `passed`, `message` | Map `code → id`, infer `severity` from `passed` (false → error, true → info) |

### `GateFinding`

```typescript
/**
 * Canonical finding shape emitted by every gate command under --json.
 * Gate-internal types are adapted to this shape at the CLI boundary.
 */
export interface GateFinding {
  /** Stable dot-scoped ID: "<gate>.<surface>.<rule>" e.g. "drift.command.missing"
   *  For binary-result gates: "<gate>.result.error.<index>" (e.g. "policy-gate.result.error.0")
   *  For check-list gates:    "<gate>.check.<code>"        (e.g. "linear-gate.check.ISSUE_KEY_PRESENT")
   */
  id: string;
  /** Severity level — agents must treat "error" as blocking */
  severity: "error" | "warning" | "info";
  /** Gate that produced this finding */
  gate: string;
  /** Human-readable description */
  message: string;
  /** Affected file path relative to repo root (when applicable) */
  path?: string;
  /** Whether this finding was in the pre-existing baseline.
   *  Binary-result gates always emit baseline: false (no baseline concept). */
  baseline: boolean;
  /** Actionable fix guidance */
  fix: {
    /** Exact harness CLI command to resolve (when automatable) */
    command?: string;
    /** Human instruction when no CLI fix exists */
    manual?: string;
    /** Whether the finding can be suppressed */
    suppressible: boolean;
  };
}
```

## Migration Notes and Compatibility Strategy

JSC-180 extends the canonical gate envelope with mandatory remediation fields:

- `status`
- `reason`
- `action_now`
- `action_later`
- `evidence_ref`

Compatibility strategy:

1. Preserve existing canonical fields (`gate`, `version`, `timestamp`, `findings`, `summary`, `meta`) so existing parsers keep working.
2. Add the new decision fields as additive, top-level fields in `GateResult`.
3. Roll out command behavior progressively to remediation-heavy gates first:
- `policy-gate`
- `docs-gate`
- `preflight-gate`
4. Keep JSON output deterministic and machine-parseable; no command-specific wrapper envelopes for these gates.
5. Align non-JSON output to the same decision model so human and agent consumers receive equivalent guidance.

Consumer migration guidance:

1. Continue reading existing fields during transition.
2. Prefer `reason` for short diagnosis.
3. Execute `action_now` first, then `action_later`.
4. Use `evidence_ref` for artifact linking, issue comments, and audit breadcrumbs.

### Binary-result Adapter Synthesis Rules

For `policy-gate`, `plan-gate`, `pr-template-gate`:

```
if result.ok === false (internal error):
  → one GateFinding { id: "<gate>.result.internal", severity: "error", baseline: false,
                      message: result.error.message, fix: { suppressible: false } }

if result.ok === true && !result.output.passed:
  → one GateFinding per error string in result.output.errors:
    { id: "<gate>.result.error.<index>", severity: "error", baseline: false,
      message: errorString, fix: { suppressible: false } }

if result.ok === true && result.output.passed:
  → zero findings (findings: [])
  GateResult.status = "pass"
```

For `linear-gate` (check-list adapter):

```
for each LinearGateCheck check:
  if !check.passed:
    → GateFinding { id: "linear-gate.check.<check.code>", severity: "error",
                    baseline: false, message: check.message, fix: { suppressible: false } }
  // Passing checks do not produce findings
```

### `GateResult`

```typescript
/**
 * Canonical structured output of a single gate run under --json.
 */
export interface GateResult {
  /** Gate identifier — matches the harness subcommand name */
  gate: string;
  /** Semver of the gate implementation */
  version: string;
  /** ISO 8601 timestamp of when the gate ran */
  timestamp: string;
  /** Aggregate status */
  status: "pass" | "warn" | "fail" | "skipped";
  /** All findings (pass, warn, fail) */
  findings: GateFinding[];
  /** Convenience counts */
  summary: {
    errors: number;
    warnings: number;
    info: number;
    total: number;
  };
  /** Short diagnosis of the gate result */
  reason: string;
  /** Immediate actions to resolve blocking findings */
  action_now: string[];
  /** Longer-term actions to improve or automate remediation */
  action_later: string[];
  /** Artifact references for audit trails and issue linking */
  evidence_ref: string[];
  /** Gate-specific metadata (pass-through, not standardised) */
  meta?: Record<string, unknown>;
}
```

### `AutoFixResult`

```typescript
/**
 * Result of harness health --auto-fix
 */
export interface AutoFixResult {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Fixes that were applied (or would be, in dry-run) */
  applied: Array<{
    findingId: string;
    command: string;
    exitCode: number | null;
    /** null in dry-run mode */
    stdout: string | null;
    /** stderr captured from the fix command; null in dry-run mode */
    stderr: string | null;
  }>;
  /** Findings that required manual intervention (no fix.command) */
  manual: GateFinding[];
  /** Counts */
  summary: {
    /** errors + warnings + info (all findings, including passing info findings) */
    total: number;
    applied: number;
    manual: number;
    failed: number;
  };
}
```

### Naming conventions

| Field | Rule |
|---|---|
| All shared types | `camelCase` |
| Gate-internal types | No constraint — adapters translate at boundary |
| `severity` values | `"error" \| "warning" \| "info"` (uniform across all gates) |
| `status` values in `GateResult` | `"pass" \| "warn" \| "fail" \| "skipped"` |
| `gate` field | Must match the CLI subcommand name exactly (e.g. `"drift-gate"`, `"docs-gate"`) |
| `GateResult.version` | Must be populated from `getVersion()` (harness package root) — not per-gate constants |
| `GateResult.summary.total` | `errors + warnings + info` — all findings including info-level |
| `GateResult.reason` | Required: short diagnosis of the gate result |
| `GateResult.action_now` | Required: array of immediate actions (may be empty for pass status) |
| `GateResult.action_later` | Required: array of longer-term actions (may be empty) |
| `GateResult.evidence_ref` | Required: array of artifact references for audit trails |

---

## Main Flow and Lifecycle

### `--json` normalisation flow (per gate)

```
agent calls: harness drift-gate --json
                    │
         runDriftGateCLI()
                    │
         runDriftGate() → DriftGateResult (internal)
                    │
         normaliseDriftGateResult() ← src/lib/output/normalise.ts
                    │
         GateResult (canonical)
                    │
         process.stdout.write(JSON.stringify(gateResult, null, 2) + "\n")
                    │
         exit(gateResult.status === "fail" ? 2 : gateResult.status === "warn" ? 1 : 0)
```

> **Invariant**: Exit codes are unchanged. Normalisation only affects stdout JSON shape.

### `harness health --auto-fix` flow

```
harness health --auto-fix [--dry-run] [--json]
        │
        runHealth() → HealthReport (existing)
        │
        collect findings with fix.command set (from each GateResult)
        │
        if --dry-run: print plan, exit 0
        │
        for each fixable finding (ordered: error → warning → info):
            show: "Applying fix for <id>: <command>"
            spawnSync(command)
            record outcome in AutoFixResult
        │
        re-run health (single pass) to confirm fixes landed
        │
        print AutoFixResult (--json) or human summary
        │
        exit 0 if all applied cleanly, 1 if partial, 2 if any fix failed
```

**Safe auto-fixes** (no confirmation required):
- Seed missing baseline (`harness drift-gate --seed-baseline`)
- Create missing template files (from `harness init` scaffold set)
- Any finding whose `fix.command` is a read-only or idempotent harness subcommand

**Require `--confirm` flag** (or are excluded from auto-fix):
- Contract field mutations (`harness contract ...`)
- Branch protection updates (`harness branch-protect ...`)
- CI config modifications

---

## Interfaces and Dependencies

| Module | Role |
|---|---|
| `src/lib/output/types.ts` | Defines `GateFinding`, `GateResult`, `AutoFixResult` |
| `src/lib/output/normalise.ts` | Per-gate adapter: `normaliseDriftGateResult()`, `normaliseDocsGateResult()`, etc. |
| `src/commands/health.ts` | Adds `--auto-fix`, `--dry-run` to `runHealthCLI()` |
| `.agents/skills/coding-harness/SKILL.md` | Updated schema documentation for agents |

No new runtime dependencies. Adapters are pure functions: `(GateSpecificResult) => GateResult`.

---

## Invariants and Safety Requirements

- **SA-INV1**: `GateFinding.id` must be stable across runs for the same logical finding. Rich-finding gates use `<gate>.<surface>.<rule_id>`; binary-result gates use `<gate>.result.error.<index>`; check-list gates use `<gate>.check.<code>`. Index-based IDs (`error.0`, `error.1`) are acceptable because binary-result error arrays are ordered deterministically.
- **SA-INV2**: Exit codes are preserved unchanged for all gate commands. Normalisation only affects stdout JSON shape.
- **SA-INV3**: `--auto-fix` without `--dry-run` must print each command before executing it. No silent mutations.
- **SA-INV4**: `--auto-fix` must skip any finding whose `fix.command` is absent or whose command starts with `harness branch-protect`, `harness contract`, or `harness ci-migrate commit` without an explicit `--confirm` flag.
- **SA-INV5**: The canonical types in `src/lib/output/types.ts` must be the only public export for shared output shapes. Gate-internal types remain gate-private.
- **SA-INV6**: Adapter functions must be pure (no side-effects, no I/O). They translate gate-specific results to `GateResult` deterministically.
- **SA-INV7**: All JSON output to stdout **must use `process.stdout.write(JSON.stringify(...) + "\n")`**, not `console.info(JSON.stringify(...))`. This is required by the Biome `noConsoleLog` rule enforced in this repo (Learnings 2026-03-16).
- **SA-INV8**: `review-gate` must never be normalised in v1. Any attempt to call a normaliser for `review-gate` must throw at compile time (no exported adapter for it).

---

## Failure Model and Recovery

| Failure | Behaviour |
|---|---|
| Gate process crashes during `--json` | Gate's existing error handling applies; output includes `status: "fail"` and `findings: []` |
| `--auto-fix` command exits non-zero | Finding recorded as `failed` in `AutoFixResult.applied`; remaining fixes continue; overall exit 2 |
| `--auto-fix` fix command produces invalid output | Logged as failed; auto-fix does not retry |
| Adapter throws on unexpected internal type shape | Emit `GateResult` with `status: "fail"` and a single `GateFinding` `{ id: "<gate>.adapter.error", severity: "error" }` describing the adapter error; never propagate a raw thrown exception to stdout |
| Agent passes `--json` to un-normalised command | Command falls back to current text output — no regression |
| Binary-result gate returns empty `errors` array with `passed: false` | Adapter emits one synthetic finding: `{ id: "<gate>.result.error.unknown", message: "Gate reported failure without error details" }` so the finding array is never empty when `status === "fail"` |
| `linear-gate` returns `ok: false` (internal error) before checks run | Adapter emits one finding: `{ id: "linear-gate.result.internal", severity: "error", message: result.error.message }` |
| `review-gate` present in gate list | Adapter lookup finds no registered normaliser → `GateResult { status: "skipped", meta: { reason: "async-gate-excluded-from-normalisation-v1" } }` emitted inline; exit code preserved |

---

## Observability

- All `GateResult` objects include `timestamp` (ISO 8601) for log correlation.
- `AutoFixResult` includes full command, exit code, and stdout for each applied fix.
- No new log files in v1 (deferred to observability policy issue).
- **Stdout discipline**: Per repo convention (Learnings 2026-03-16, Biome `noConsoleLog`), JSON gate output must use `process.stdout.write` not `console.info`. Diagnostics and progress messages use `console.error` (stderr) so that `harness <gate> --json | jq ...` piping is never contaminated by text.
- **Dry-run transparency**: `harness health --auto-fix --dry-run` must write the full `AutoFixResult` plan (with `dryRun: true`) to stdout so agents can parse what would be executed before committing.

---

## Acceptance and Test Matrix

| ID | Criterion | Test approach |
|---|---|---|
| SA1 | `GateFinding` and `GateResult` types exist in `src/lib/output/types.ts` and are exported | TypeScript compilation |
| SA2 | `normaliseDriftGateResult()` converts a `DriftGateResult` to a valid `GateResult` | Unit test: adapter with known input → snapshot |
| SA3 | `normaliseDocsGateResult()` converts a `DocsGateResult` to a valid `GateResult` | Unit test: adapter with known input → snapshot |
| SA4 | `harness drift-gate --json` stdout is a valid `GateResult` | Integration-light test: call `runDriftGateCLI`, parse output |
| SA5 | `harness docs-gate --json` stdout is a valid `GateResult` | Integration-light test |
| SA6 | `harness health --auto-fix --dry-run` prints fix plan and exits 0 without mutating files | Unit test: spy on `spawnSync`, assert not called |
| SA7 | `harness health --auto-fix` applies findings with `fix.command` and records outcomes in `AutoFixResult` | Unit test: stub gate output with 2 fixable findings, verify `spawnSync` called for each |
| SA8 | `harness health --auto-fix` skips findings whose `fix.command` matches the exclusion list | Unit test: assert `spawnSync` not called for excluded commands |
| SA9 | `harness health --auto-fix --json` outputs a valid `AutoFixResult` | Unit test: assert stdout can be parsed and matches schema |
| SA10 | All 6 in-scope gate adapters produce `GateFinding.severity` from `"error"\|"warning"\|"info"` | Unit test: adapter round-trip for each gate |
| SA11 | `GateFinding.id` is stable across two runs with identical input | Unit test: same input → same id |
| SA12 | Exit codes for normalised gate commands are unchanged | Integration test: compare exit codes before/after normalisation |
| SA13 | The coding-harness skill doc documents `GateFinding` and `GateResult` schema with a concrete `jq` example | Manual review |
| SA14 | `policy-gate --json` with a failing result produces ≥1 `GateFinding` (no empty findings when `passed: false`) | Unit test: binary-result adapter with `passed: false, errors: ["msg"]` → `findings.length === 1` |
| SA15 | `policy-gate --json` with `passed: true` produces `findings: []` and `status: "pass"` | Unit test: binary-result adapter with `passed: true` → `findings.length === 0` |
| SA16 | `policy-gate --json` with empty `errors` array and `passed: false` produces one synthetic `"result.error.unknown"` finding | Unit test: adapter synthesis edge-case |
| SA17 | `linear-gate --json` maps each failing `LinearGateCheck.code` to `GateFinding.id` as `"linear-gate.check.<code>"` | Unit test: check-list adapter with two failing checks → two findings with expected ids |
| SA18 | All gate `--json` output uses `process.stdout.write`, not `console.info`, for the JSON payload | Biome lint: `noConsoleLog` rule passes on all gate command files; code review |
| SA19 | `review-gate` included in a `harness health --json` run produces `status: "skipped"` (not an adapter error) | Unit test: health runner with `review-gate` in gate list |

**SA count: 19** (SA1–SA19). New additions SA14–SA19 cover binary-result synthesis, check-list mapping, stdout discipline, and review-gate exclusion.

---

## Open Questions

1. **Runtime-schema validation vs manual validation**: Should `GateResult` be validated at runtime with a schema library when read by agents, or is TypeScript compile-time typing sufficient for v1? (Recommendation: TypeScript-only for v1, runtime schema validation deferred until the schema is published externally.)
2. ~~**Thin gates audit**: Which commands produce per-finding arrays vs binary results?~~ **Resolved 2026-03-24**: Full command audit complete. Three adapter shape classes identified — see Core Domain Model. `review-gate` excluded from v1 (async).
3. **Skill update scope**: The SKILL.md update should include at minimum one concrete `jq` query example (`harness drift-gate --json | jq '.findings[] | select(.severity=="error")'`) to be useful to agents directly. Confirmed in SA13.

---

## Definition of Done

- [ ] `src/lib/output/types.ts` published with `GateFinding`, `GateResult`, `AutoFixResult`
- [ ] `src/lib/output/normalise.ts` with adapters for **6** in-scope gates (rich-finding: `drift-gate`, `docs-gate`; binary-result: `policy-gate`, `plan-gate`, `pr-template-gate`; check-list: `linear-gate`) — no adapter for `review-gate`
- [ ] Each in-scope gate's `--json` path updated to emit canonical `GateResult` using `process.stdout.write`
- [ ] `harness health --auto-fix [--dry-run] [--json]` implemented and tested
- [ ] `harness health --json` emits `status: "skipped"` for `review-gate`
- [ ] All SA1–SA19 acceptance items pass
- [ ] `pnpm check` green (TypeScript + Biome `noConsoleLog` clean)
- [ ] `.agents/skills/coding-harness/SKILL.md` updated with schema reference and `jq` example
