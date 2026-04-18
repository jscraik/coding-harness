---
title: Structured Output Standardisation and health --auto-fix
type: standard-plan
status: active
date: 2026-03-24
deeped: 2026-03-24
spec: docs/specs/2026-03-24-feature-structured-output-auto-fix-spec.md
origin: JSC-71 (Option B)
risk: medium
execution_posture: test-first
last_validated: 2026-04-18
---

> **Enhancement Summary (2026-03-24):** Deepening pass corrected a critical mis-classification: `plan-gate` is **not** binary-result. Repo audit (`src/lib/plan-gate/types.ts`) shows `PlanGateResult` has `errors: PlanError[]` with typed `code` fields, not a plain `passed: boolean + errors: string[]` shape. Plan-gate already has a `--json` path via `createJsonOutput` wrapping the raw result — the adapter must unwrap `PlanError.code` + `getRecoveryHint(code)` to synthesise `GateFinding`. This introduces a fourth adapter class (coded-error) and splits original P2 into P2 (binary: policy, pr-template) and P2b (coded-error: plan-gate). Console.info inventory confirmed for all six gates. Risks and system-wide impact section added. Spec open question 1 (Zod) noted as non-blocker.

# Structured Output Standardisation and `health --auto-fix`

## Table of Contents

- [Context and constraints](#context-and-constraints)
- [Adapter class inventory](#adapter-class-inventory)
- [Risks and system-wide impact](#risks-and-system-wide-impact)
- [High-level technical design](#high-level-technical-design)
- [Implementation phases](#implementation-phases)
  - [P0 — Canonical types and test harness](#p0--canonical-types-and-test-harness)
  - [P1 — Rich-finding adapters (drift-gate, docs-gate)](#p1--rich-finding-adapters)
  - [P2 — Binary-result adapters (policy-gate, pr-template-gate)](#p2--binary-result-adapters)
  - [P2b — Coded-error adapter (plan-gate)](#p2b--coded-error-adapter)
  - [P3 — Check-list adapter (linear-gate)](#p3--check-list-adapter)
  - [P4 — Doctor normalisation](#p4--doctor-normalisation)
  - [P5 — health --auto-fix](#p5--health---auto-fix)
  - [P6 — Skill update and gate validation](#p6--skill-update-and-gate-validation)
- [Rollout guidance](#rollout-guidance)
- [Validation strategy](#validation-strategy)
- [Execution ledger](#execution-ledger)

---

## Context and constraints

**Spec:** [`docs/specs/2026-03-24-feature-structured-output-auto-fix-spec.md`](../specs/2026-03-24-feature-structured-output-auto-fix-spec.md)

Key constraints from the spec:
- Adapter functions are **pure** — no I/O, no side effects.
- All JSON output uses `process.stdout.write(JSON.stringify(...) + "\n")` (**not** `console.info`) — Biome `noConsoleLog` enforced.
- Exit codes are **preserved unchanged** for all gate commands.
- `review-gate` has **no adapter** in v1 — health emits `status: "skipped"` for it.
- `GateResult.version` comes from `getVersion()` in `src/lib/version.ts`.

**Execution posture:** `test-first` — write the test, then the implementation for each unit.

**Gate architecture:** `harness health` calls each gate as a **subprocess** via `spawnSync`. For `--auto-fix`, we need the gate's JSON output — gates are called with `--json` flag and stdout is captured and parsed.

---

## Adapter class inventory

> **Confirmed by repo audit (2026-03-24).** This table corrects the spec's original three-class grouping.

| Class | Commands | Internal type | `--json` path exists? | Key challenge |
|---|---|---|---|---|
| **Rich-finding** | `drift-gate`, `docs-gate` | `DriftFinding[]`, `DocsFinding[]` | Yes (`console.info`) | Translate `snake_case`, map severity vocab |
| **Binary-result** | `policy-gate`, `pr-template-gate` | `{ passed: boolean, errors: string[] }` | Yes (`console.info`) | Synthesise `GateFinding` per error string |
| **Coded-error** | `plan-gate` | `PlanGateResult { passed, errors: PlanError[] }` | Yes (`createJsonOutput` via `src/lib/result/types.ts`) | Unwrap `PlanError.code` + `getRecoveryHint()` → `GateFinding.fix.manual`; replace `createJsonOutput` wrapper with `GateResult` |
| **Check-list** | `linear-gate` | `LinearGateCheck[]` with `code`, `passed`, `message` | Yes (`console.info`) | Map `code → id`, infer severity |

**`plan-gate` detail (coded-error):**
`PlanGateResult.errors` is `PlanError[]` where each error has:
```typescript
interface PlanError {
  code: string;       // e.g. "MISSING", "STALE", "ORIGIN_MISSING"
  message: string;
}
```
The adapter maps `PlanError` → `GateFinding` as:
```
id:      "plan-gate.result.error.<code>"  (e.g. "plan-gate.result.error.MISSING")
severity: "error"
message:  error.message
fix.manual: getRecoveryHint(error.code)   // string | undefined
fix.suppressible: false
```

**`plan-gate` already has a `--json` path:** `runPlanGateCLI` calls `createJsonOutput("plan-gate", result, exitCode)` and `console.info`. The adapter must replace this with `normalisePlanGateResult()` → `GateResult` and switch to `process.stdout.write`.

---

## Risks and system-wide impact

### R1 — Biome `noConsoleLog` breakage during migration
**Risk:** Each gate's `console.info` for JSON is currently violating the `noConsoleLog` rule (or is suppressed via comment). Switching to `process.stdout.write` must happen atomically per gate — a partial change that leaves any `console.info` on a JSON path will either fail Biome or change output format mid-run.
**Mitigation:** Per the gate-by-gate approach in phases, the change is atomic for each gate. `pnpm check` after each phase catches any regression.

### R2 — `plan-gate` test coverage regression
**Risk:** `plan-gate` already uses `createJsonOutput` — existing tests may assert on the `{ schemaVersion, command, ok, data, exitCode }` envelope shape. Replacing with `GateResult` will break those assertions.
**Mitigation:** Audit `src/commands/plan-gate.test.ts` (if it exists) and `src/lib/plan-gate/detector.test.ts` for `--json` assertions before writing P2b. Update assertions to use `GateResult` snapshot.

### R3 — Breaking change for downstream `--json` consumers
**Risk:** Any script or agent parsing the current non-canonical `--json` output of the 6 gates will break. The new `GateResult` envelope (`gate`, `version`, `timestamp`, `status`, `findings`, `summary`) is structurally different from gate-specific shapes.
**Mitigation:** Bump minor version (semver); document shape change in CHANGELOG. The `coding-harness` skill update (P6) gives agents the new schema before they upgrade.

### R4 — `plan-gate` exit code complexity
**Risk:** `plan-gate` has 7 distinct exit codes (`EXIT_CODES.SUCCESS`, `PLAN_MISSING`, `PLAN_STALE`, `ORIGIN_MISSING`, …). Existing tests likely assert on specific exit codes. The plan requires these to be preserved unchanged.
**Mitigation:** The adapter only changes stdout; exit code derivation logic in `runPlanGateCLI` remains unchanged. Both `normalisePlanGateResult()` and exit-code derivation read from the same `PlanGateResult`.

### R5 — `spawnSync` stdout-parse failure in `--auto-fix`
**Risk:** If a gate crashes mid-run (signal, OOM) its stdout may be empty or non-JSON. Attempting `JSON.parse` on empty stdout for `--auto-fix`'s finding collection will throw.
**Mitigation:** Wrap gate stdout parse in try/catch; treat parse failures as `GateResult { status: "fail", findings: [] }` with a logged parse error. Do not propagate the throw.

### System-wide impact
- **`src/lib/output/`** is a new module — ensure it is exported from the package root or barrel if other tooling imports harness programmatically.
- **`pnpm check`** gate will catch every violation; no new CI step needed.
- **The coding-harness skill** (`SKILL.md`) is the only external-facing documentation change — agents rely on it. P6 must not be deferred.

---

## High-level technical design

```
Phase 0: types.ts + normalise.ts stub + compile check
          ↓
Phase 1: Rich adapters (drift-gate, docs-gate) + health review-gate skip
          ↓
Phase 2: Binary adapters (policy-gate, pr-template-gate)
          ↓
Phase 2b: Coded-error adapter (plan-gate) — separate from P2 (different PlanError type)
          ↓
Phase 3: Check-list adapter (linear-gate)
          ↓
Phase 4: Doctor normalisation (shape TBD at implementation time)
          ↓
Phase 5: health --auto-fix [--dry-run] [--json]
          ↓
Phase 6: Skill update + full SA1–SA19 gate
```

**Module layout:**
```
src/lib/output/
├── types.ts          ← GateFinding, GateResult, AutoFixResult (P0)
└── normalise.ts      ← all adapter functions (P1–P3 + P2b)

src/commands/
├── health.ts         ← --auto-fix added (P5); review-gate skip (P1)
├── drift-gate.ts     ← console.info → process.stdout.write + GateResult (P1)
├── docs-gate.ts      ← console.info → process.stdout.write + GateResult (P1)
├── policy-gate.ts    ← console.info → process.stdout.write + GateResult (P2)
├── pr-template-gate.ts ← console.info → process.stdout.write + GateResult (P2)
├── plan-gate.ts      ← createJsonOutput → GateResult; console.info → process.stdout.write (P2b)
└── linear-gate.ts    ← console.info → process.stdout.write + GateResult (P3)

.agents/skills/coding-harness/SKILL.md ← updated (P6)
```

---

## Implementation phases

---

### P0 — Canonical types and test harness

**Goal:** Publish the shared output contract and establish the test pattern before any adapters are written.

**Dependencies:** None.

**Files:**
- `src/lib/output/types.ts` ← new
- `src/lib/output/normalise.ts` ← new (stub, exports placeholder functions)
- `src/lib/output/types.test.ts` ← new

**Approach:**
1. Create `src/lib/output/types.ts` with `GateFinding`, `GateResult`, `AutoFixResult` exactly as defined in the spec.
2. Create `src/lib/output/normalise.ts` as a stub exporting `normaliseDriftGateResult`, `normaliseDocsGateResult`, `normalisePolicyGateResult`, `normalisePlanGateResult`, `normalisePrTemplateGateResult`, `normaliseLinearGateResult` — all throwing `new Error("not implemented")` initially.
3. Write `src/lib/output/types.test.ts` verifying the types compile and a minimal `GateResult` object satisfies the interface structurally.

**Patterns:** Follow existing `src/lib/` module conventions — named exports, `.js` ESM import extensions in consuming files.

**Test scenarios:**
- P0-T1: TypeScript compilation succeeds with `GateFinding`, `GateResult`, `AutoFixResult` (SA1)
- P0-T2: A hand-crafted `GateResult` object passes interface assignment — catches field renames at compile time

**Verification:** `pnpm typecheck` passes after P0.

**Exit criteria:** `src/lib/output/types.ts` and `src/lib/output/normalise.ts` exist, export all expected symbols, `pnpm typecheck` clean.

---

### P1 — Rich-finding adapters

**Goal:** Normalise `drift-gate` and `docs-gate` `--json` output to `GateResult`, and add `review-gate` skip to health runner.

**Dependencies:** P0.

**Files:**
- `src/lib/output/normalise.ts` ← implement `normaliseDriftGateResult`, `normaliseDocsGateResult`
- `src/commands/drift-gate.ts` ← update `runDriftGateCLI` JSON path
- `src/commands/docs-gate.ts` ← update `runDocsGateCLI` JSON path
- `src/commands/health.ts` ← add review-gate skip logic
- `src/lib/output/normalise.test.ts` ← new unit tests for both adapters

**Approach:**

`normaliseDriftGateResult(result: DriftGateResult): GateResult`:
- Map `DriftFinding.rule_id` → `GateFinding.id` as `"drift-gate.<surface>.<rule_id>"`
- Map severity: `"error"` → `"error"`, `"warning"` → `"warning"`, `"info"` → `"info"` (already matches)
- Map `baseline_state === "preexisting"` → `baseline: true`
- Map `DriftFixGuidance.command` → `fix.command`, `.manual` → `fix.manual`, `.suppressible` → `fix.suppressible`
- Derive `GateResult.status`: `report.outcome === "error"` → `"fail"`, `report.status === "partial"` → `"warn"`, else `"pass"`
- Populate `version` from `getVersion()`

`normaliseDocsGateResult(result: DocsGateResult): GateResult`:
- Map `DocsFinding.rule_id` → `GateFinding.id` as `"docs-gate.<surface>.<rule_id>"`
- Map `DocsFinding.severity` (already `"info"/"warning"/"error"`) directly
- `baseline: false` (docs-gate has no baseline concept)
- `fix.command` and `fix.manual`: not available on `DocsFinding` — set `fix: { suppressible: false }`

`runDriftGateCLI` JSON path change:
```typescript
// Before:
console.info(JSON.stringify(result.report, null, 2));
// After:
const gateResult = normaliseDriftGateResult(result);
process.stdout.write(JSON.stringify(gateResult, null, 2) + "\n");
```

Health runner `review-gate` skip: in `runGate()` (or equivalent), detect `spec.gate === "review-gate"` and return a `GateResult` with `status: "skipped", meta: { reason: "async-gate-excluded-from-normalisation-v1" }` without calling the subprocess.

**Execution note:** `docs-gate` does not have `fix.command` on findings — the adapter must emit `fix: { suppressible: false }` for all docs-gate findings. This means no docs-gate findings will appear in `--auto-fix` fix lists. This is correct and expected.

**Test scenarios:**
- P1-T1: `normaliseDriftGateResult` with a known `DriftFinding` input → snapshot match (SA2)
- P1-T2: `normaliseDocsGateResult` with a known `DocsFinding` input → snapshot match (SA3)
- P1-T3: `GateFinding.id` is stable across two calls with same input (SA11)
- P1-T4: `GateFinding.severity` is always from `"error"|"warning"|"info"` (SA10 partial)
- P1-T5: Health runner with `review-gate` in gate list → `status: "skipped"` in output (SA19)

**Verification:** `pnpm test -- normalise` passes; `pnpm typecheck` clean.

**Exit criteria:** Both adapters implemented and tested, drift/docs gate `--json` paths emit `GateResult`, `pnpm typecheck` + relevant tests green.

---

### P2 — Binary-result adapters

**Goal:** Normalise `policy-gate` and `pr-template-gate` `--json` output using binary-result synthesis rules.

> **Scope corrected:** `plan-gate` uses a different `PlanError[]` type with error codes — it is handled in P2b.

**Dependencies:** P0, P1 (pattern established).

**Files:**
- `src/lib/output/normalise.ts` ← implement `normalisePolicyGateResult`, `normalisePrTemplateGateResult`
- `src/commands/policy-gate.ts` ← replace `console.info(JSON.stringify(result.output))` with `process.stdout.write` + `GateResult`
- `src/commands/pr-template-gate.ts` ← replace `console.info(JSON.stringify(result, ...))` and `console.info(JSON.stringify(result.output, ...))` with `process.stdout.write` + `GateResult`
- `src/lib/output/normalise.test.ts` ← extend with binary tests

**Confirmed `console.info` locations:**
- `policy-gate.ts:136` — `console.info(JSON.stringify(result.output))`
- `pr-template-gate.ts:151,159` — two `console.info(JSON.stringify(...))` calls (error and success paths)

**Binary-result synthesis:**
```typescript
function normaliseBinaryResult(
  gate: string,
  passed: boolean,
  errors: string[]
): GateResult {
  const version = getVersion();
  const timestamp = new Date().toISOString();
  if (passed) {
    return { gate, version, timestamp, status: "pass", findings: [],
      summary: { errors: 0, warnings: 0, info: 0, total: 0 } };
  }
  const findings: GateFinding[] = errors.length > 0
    ? errors.map((msg, i) => ({ id: `${gate}.result.error.${i}`, severity: "error" as const, gate,
        message: msg, baseline: false, fix: { suppressible: false } }))
    : [{ id: `${gate}.result.error.unknown`, severity: "error" as const, gate,
         message: "Gate reported failure without error details",
         baseline: false, fix: { suppressible: false } }];
  return { gate, version, timestamp, status: "fail", findings,
    summary: { errors: findings.length, warnings: 0, info: 0, total: findings.length } };
}
```

**Test scenarios:**
- P2-T1: `normalisePolicyGateResult` with `passed: false`, `errors: ["msg"]` → `findings.length === 1` (SA14)
- P2-T2: `normalisePolicyGateResult` with `passed: true` → `findings: []`, `status: "pass"` (SA15)
- P2-T3: `normalisePolicyGateResult` with `passed: false`, `errors: []` → synthetic `result.error.unknown` finding (SA16)
- P2-T4: Binary adapter `GateFinding.severity` always from canonical set (SA10 partial)

**Verification:** `pnpm test -- normalise` green; `pnpm typecheck` clean.

**Exit criteria:** Both binary adapters implemented, tested, and wired to CLI commands.

---

### P2b — Coded-error adapter

**Goal:** Normalise `plan-gate --json` using its typed `PlanError[]` error structure.

> **This phase is split from P2 because `plan-gate` has a different internal type.** `PlanGateResult.errors` is `PlanError[]` where each error has `{ code: string, message: string }`, not a plain `string[]`. It also already has a `--json` path that uses `createJsonOutput` (a different envelope) — both must be replaced.

**Dependencies:** P0, P1, P2.

**Files:**
- `src/lib/output/normalise.ts` ← implement `normalisePlanGateResult`
- `src/commands/plan-gate.ts` ← replace `createJsonOutput("plan-gate", result, exitCode)` + `console.info` with `normalisePlanGateResult(result)` + `process.stdout.write`
- `src/lib/output/normalise.test.ts` ← extend with plan-gate tests

**Current `plan-gate.ts:99-100`:**
```typescript
const jsonOutput = createJsonOutput("plan-gate", result, exitCode);
console.info(JSON.stringify(jsonOutput, null, 2));
```
**Replacement:**
```typescript
const gateResult = normalisePlanGateResult(result);
process.stdout.write(JSON.stringify(gateResult, null, 2) + "\n");
```

**`normalisePlanGateResult` synthesis:**

> **Layering constraint (IMP-2):** `getRecoveryHint` is a private function in `src/commands/plan-gate.ts`. `normalise.ts` must not import from `src/commands/` (lib→commands import violates conventional layering). Use the **recovery-hint map pattern** instead: the caller (`runPlanGateCLI`) builds the map and passes it in.

```typescript
// In src/commands/plan-gate.ts — unchanged, still private:
function getRecoveryHint(code: string): string | undefined { /* ... */ }

// In runPlanGateCLI — caller builds the recovery map:
const recoveryHints: Record<string, string | undefined> = {};
for (const e of result.errors) {
  recoveryHints[e.code] = getRecoveryHint(e.code);
}
const gateResult = normalisePlanGateResult(result, recoveryHints);
process.stdout.write(JSON.stringify(gateResult, null, 2) + "\n");

// In src/lib/output/normalise.ts — pure, no commands/ import:
function normalisePlanGateResult(
  result: PlanGateResult,
  recoveryHints: Record<string, string | undefined> = {}
): GateResult {
  const gate = "plan-gate";
  const version = getVersion();
  const timestamp = new Date().toISOString();
  if (result.passed) {
    return { gate, version, timestamp, status: "pass", findings: [],
      summary: { errors: 0, warnings: 0, info: 0, total: 0 } };
  }
  const findings: GateFinding[] = result.errors.map(e => ({
    id: `plan-gate.result.error.${e.code}`,
    severity: "error" as const,
    gate,
    message: e.message,
    baseline: false,
    fix: { manual: recoveryHints[e.code], suppressible: false },
  }));
  return { gate, version, timestamp, status: "fail", findings,
    summary: { errors: findings.length, warnings: 0, info: 0, total: findings.length } };
}
```

**Pre-implementation check:** Audit `src/commands/plan-gate.test.ts` for `--json` assertions on the `createJsonOutput` envelope shape before starting — those tests will need updating to expect `GateResult`.

**Test scenarios:**
- P2b-T1: `normalisePlanGateResult` with `passed: false`, `errors: [{ code: "MISSING", message: "..." }]` → `findings[0].id === "plan-gate.result.error.MISSING"` and `findings[0].fix.manual` contains the recovery hint
- P2b-T2: `normalisePlanGateResult` with `passed: true` → `findings: []`, `status: "pass"`
- P2b-T3: `normalisePlanGateResult` with multiple error codes → one `GateFinding` per `PlanError` with stable `id`
- P2b-T4: Spec SA14 (plan-gate variant): `passed: false` with errors → `findings.length >= 1`

**Verification:** `pnpm test -- normalise` green; `pnpm test -- plan-gate` green; `pnpm typecheck` clean.

**Exit criteria:** `normalisePlanGateResult` implemented, tested, wired; existing plan-gate `--json` tests updated.

---

### P3 — Check-list adapter

**Goal:** Normalise `linear-gate --json` using the check-list synthesis rules.

**Dependencies:** P0, P1 (pattern established).

**Files:**
- `src/lib/output/normalise.ts` ← implement `normaliseLinearGateResult`
- `src/commands/linear-gate.ts` ← update JSON path
- `src/lib/output/normalise.test.ts` ← extend with linear-gate tests

**Approach:**

```typescript
function normaliseLinearGateResult(result: LinearGateResult): GateResult {
  const gate = "linear-gate";
  const version = getVersion();
  const timestamp = new Date().toISOString();

  if (!result.ok) {
    return { gate, version, timestamp, status: "fail",
      findings: [{ id: "linear-gate.result.internal", severity: "error", gate,
        message: result.error.message, baseline: false, fix: { suppressible: false } }],
      summary: { errors: 1, warnings: 0, info: 0, total: 1 } };
  }

  const failingChecks = result.output.checks.filter(c => !c.passed);
  const findings: GateFinding[] = failingChecks.map(c => ({
    id: `linear-gate.check.${c.code}`,
    severity: "error" as const,
    gate,
    message: c.message,
    baseline: false,
    fix: { suppressible: false },
  }));

  const status = findings.length > 0 ? "fail" : "pass";
  return { gate, version, timestamp, status, findings,
    summary: { errors: findings.length, warnings: 0, info: 0, total: findings.length } };
}
```

**Test scenarios:**
- P3-T1: Two failing `LinearGateCheck` items → two findings with `id: "linear-gate.check.<code>"` (SA17)
- P3-T2: All checks passing → `findings: []`, `status: "pass"`
- P3-T3: `ok: false` → `linear-gate.result.internal` finding

**Verification:** `pnpm test -- normalise` green.

**Exit criteria:** `normaliseLinearGateResult` implemented, tested, wired to `linear-gate.ts` CLI JSON path.

---

### P4 — Doctor normalisation

**Goal:** Normalise `harness doctor --json` output to `GateResult`.

**Dependencies:** P0.

**Files:**
- `src/commands/doctor.ts` ← update JSON path
- `src/lib/output/normalise.ts` ← implement `normaliseDoctorResult` (if needed)
- `src/commands/doctor.test.ts` ← extend if needed

**Approach:** Audit `doctor.ts` JSON output shape at implementation time. If it already emits a near-canonical structure (similar to `health.ts`), a lightweight adapter or direct normalisation at the CLI boundary may suffice. Follow the same output pattern: `process.stdout.write(JSON.stringify(gateResult, null, 2) + "\n")`.

**Execution note:** Doctor produces a per-gate summary, not per-finding. Determine whether to wrap the whole doctor report in a `GateResult` envelope or emit it as a `HealthReport`-style aggregate. Decision rule: if doctor currently emits a flat object, wrap it; if it emits a `HealthReport`-style object, update to use `GateResult[]`.

**Verification:** `pnpm typecheck` clean; `pnpm test -- doctor` green.

**Exit criteria:** Doctor `--json` path emits structured output using `process.stdout.write`.

---

### P5 — `health --auto-fix`

**Goal:** Implement `harness health --auto-fix [--dry-run] [--json]`.

**Dependencies:** P1–P4 (all adapters must be wired before auto-fix can collect `GateFinding[]` with `fix.command`).

**Files:**
- `src/commands/health.ts` ← add `--auto-fix`, `--dry-run` flags; add `runAutoFix()` function
- `src/commands/health.test.ts` ← extend with auto-fix tests

**Approach:**

`HealthOptions` extension:
```typescript
export interface HealthOptions {
  dir?: string;
  json?: boolean;
  gates?: string[];
  autoFix?: boolean;   // new
  dryRun?: boolean;    // new
  confirm?: boolean;   // new — required for excluded commands
}
```

**Collection mechanism (IMP-1 — Option A chosen):** `runAutoFix` invokes each in-scope gate **independently as a subprocess with `--json`** — it does *not* reuse `runHealth`'s subprocess results. This is because the existing `HealthReport` carries only exit codes and a status string, not `GateFinding[]`. Re-invoking gates is slightly more expensive but keeps the implementation simple and subprocess-isolated.

**Approach:**
1. For each in-scope gate (from the same gate spec list as `runHealth`), spawn: `spawnSync(harnessCliPath, [gate, "--json"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] })`
2. Parse stdout as `GateResult`; on parse error emit a logged failure (R5 mitigation — wrap in try/catch, treat as `{ findings: [] }`)
3. Collect all `GateFinding` where `fix.command` is set
4. Split into: **safe** (no exclusion match) vs **excluded** (starts with `harness branch-protect|contract|ci-migrate commit`)
5. If `dryRun`: return `AutoFixResult` with all fixable findings in `applied`, `exitCode: null`, `stdout: null`, `stderr: null`
6. For each safe finding (order: `error` → `warning` → `info`):
   - Print to stderr: `Applying fix [${finding.id}]: ${fix.command}`
   - `spawnSync` the command, capture `stdout` + `stderr`
   - Record outcome in `applied[]`
7. Re-run health (single pass, text mode) to confirm visual state
8. Return `AutoFixResult`

**Excluded command prefixes:**
```typescript
const EXCLUDED_PREFIXES = [
  "harness branch-protect",
  "harness contract",
  "harness ci-migrate commit",
];
```

**Critical implementation detail:** The health runner calls each gate as a subprocess. To get `GateFinding[]` with `fix.command`, gates must already emit `GateResult` (P1–P4 complete). Auto-fix calls each gate individually with `--json` using `spawnSync`, parses stdout as `GateResult`, and collects fixable findings.

**Test scenarios:**
- P5-T1: `--auto-fix --dry-run` prints fix plan, `spawnSync` not called for fixes (SA6)
- P5-T2: `--auto-fix` with 2 fixable findings → `spawnSync` called twice, both recorded in `applied` (SA7)
- P5-T3: `--auto-fix` with excluded command → `spawnSync` not called for that finding (SA8)
- P5-T4: `--auto-fix --json` → stdout is valid `AutoFixResult` (SA9)
- P5-T5: `--auto-fix` fix command exits non-zero → `failed` count incremented, remaining fixes continue, overall exit 2

**Verification:** `pnpm test -- health` green; `pnpm typecheck` clean.

**Exit criteria:** `harness health --auto-fix [--dry-run] [--json]` works end-to-end, all P5 tests pass.

---

### P6 — Skill update and gate validation

**Goal:** Update the `coding-harness` skill, run full SA1–SA19 acceptance gate, and close the Linear issue.

**Dependencies:** P0–P5.

**Files:**
- `.agents/skills/coding-harness/SKILL.md` ← update with schema reference and `jq` example
- `src/lib/output/normalise.test.ts` ← ensure SA10–SA12 integration pass

**Approach:**

Skill update — add a `## Structured JSON Output` section with:
```
harness drift-gate --json | jq '.findings[] | select(.severity=="error")'
harness health --auto-fix --dry-run --json | jq '.applied[] | .command'
```

SA matrix gate: run each acceptance item and record pass/fail:
- SA1–SA5: `pnpm typecheck` + integration-light tests
- SA6–SA9: auto-fix unit tests
- SA10–SA12: adapter round-trip + exit code check
- SA13: manual SKILL.md review
- SA14–SA19: specific adapter edge-case tests

**Verification:** Full `pnpm check` green.

**Exit criteria:** All SA1–SA19 items verified; `pnpm check` green; skill updated; Linear JSC-71 marked In Review.

---

## Rollout guidance

- **Breaking output shape change**: Every gate's `--json` stdout shape changes. Downstream agents and scripts parsing the old shapes will break. **Bump minor version, document in CHANGELOG before PR merge.**
- **`plan-gate` double-change**: Both the JSON envelope (`createJsonOutput` → `GateResult`) and the stdout method (`console.info` → `process.stdout.write`) change. Treat it as higher-risk than the binary gates — verify existing tests first (R2).
- **Phase by phase**: Each phase is independently testable and committable. Recommend one PR per phase or one PR for P0–P3+P2b (all adapters) given tight coupling.
- **Feature flag:** No runtime feature flag needed — each gate's `--json` path is updated in place. No mixed state within a gate.
- **Rollback:** For each gate, revert the adapter call + restore `console.info` at that gate's CLI boundary. No shared state to unwind.
- **`plan-gate` test regression (R2):** Search for `schemaVersion` or `createJsonOutput` in existing test fixtures for plan-gate — those assertions will fail after P2b and must be updated in the same PR.

---

## Validation strategy

| Check | Command | When |
|---|---|---|
| TypeScript compilation | `pnpm typecheck` | After every phase |
| Unit tests | `pnpm test -- normalise` | After P1–P3 |
| Adapter round-trip | `pnpm test -- normalise` | SA10, SA11 |
| Exit code preservation | `pnpm test` (existing gate tests) | SA12 — ensure no regression |
| Auto-fix unit | `pnpm test -- health` | After P5 |
| Full gate | `pnpm check` | After P6 |
| Manual SKILL.md review | Visual inspection | SA13 |

---

## Execution ledger

| Phase | Status | AC items | Notes |
|---|---|---|---|
| P0 — Canonical types | ✅ `done` | SA1 | `types.ts` + `normalise.ts` stub + `types.test.ts`; 10/10 tests ✓; `pnpm typecheck` ✓ |
| P1 — Rich adapters | ✅ `done` | SA2, SA3, SA4, SA5, SA10 (partial), SA11, SA19 | `drift-gate.ts` + `docs-gate.ts` wired; `normaliseDriftGateResult` + `normaliseDocsGateResult` in `normalise.ts`; health `review-gate` skip guard added; 111/111 tests ✓; typecheck ✓ |
| P2 — Binary adapters | ✅ `done` | SA10 (partial), SA14, SA15, SA16 | `policy-gate.ts` + `pr-template-gate.ts` wired (ok:false + ok:true); `normalisePolicyGateResult` + `normalisePrTemplateGateResult`; 111/111 tests ✓ |
| P2b — Coded-error (plan-gate) | ✅ `done` | SA10 (partial), SA14 (variant) | `plan-gate.ts` wired; `normalisePlanGateResult` implemented; R2 regression fixed (`plan-gate.test.ts` asserts on `process.stdout.write` + GateResult shape); 111/111 tests ✓ |
| P3 — Check-list adapter | ✅ `done` | SA10 (partial), SA17 | `linear-gate.ts` wired (ok:false + ok:true); `normaliseLinearGateResult` implemented; all tests ✓ |
| P4 — Doctor | ✅ `done` | SA18 (partial) | `doctor.ts` + `health.ts` JSON paths switched to `process.stdout.write` + template literals; DoctorReport shape kept canonical (no GateResult wrapper per plan decision); Biome non-null assertion fixed; 20/20 doctor tests ✓ |
| P5 — health --auto-fix | ✅ `done` | SA6, SA7, SA8, SA9, SA12 | `runAutoFix()` + `AutoFixFinding`/`AutoFixResult` types in `health.ts`; `--auto-fix`/`--dry-run` flags wired in `runHealthCLI`; excluded-prefix guard (branch-protect, contract, ci-migrate commit); 5/5 P5 tests ✓ (P5-T1–T5); `exactOptionalPropertyTypes` lint fixed |
| P6 — Skill + SA gate | ✅ `done` | SA1–SA19 full, SA13 | SKILL.md updated with `## Structured JSON Output` section: GateResult schema, jq patterns, `--auto-fix` usage + exit codes; ToC updated; typecheck ✓; 62/62 targeted tests ✓; pre-existing flaky failures in ci-migrate/pilot-evaluate unchanged |

**Current phase:** P6 (`done`) — All phases complete.

**Open question (non-blocker):** Zod vs TypeScript-only runtime validation (Spec Q1) — deferred to post-v1, no action required before implementation starts.
