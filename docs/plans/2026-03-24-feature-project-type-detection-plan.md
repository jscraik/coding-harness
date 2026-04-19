---
title: Project Type Auto-Detection — Implementation Plan
type: feature
status: draft
date: 2026-03-24
deepened: 2026-03-24
spec: docs/specs/2026-03-24-feature-project-type-detection-spec.md
origin: docs/brainstorms/2026-03-24-project-type-detection-brainstorm.md
risk: low
plan_depth: standard
linear: JSC-71
execution_posture: test-first
last_validated: 2026-04-18
---

# Project Type Auto-Detection — Implementation Plan

> **Enhancement Summary (2026-03-24 deepening pass)**
>
> Three material gaps resolved against live code (`src/cli.ts`, `src/lib/init/scaffold.ts`, `src/lib/init/cli.ts`):
> 1. **Contract write mechanism corrected:** `harness.contract.json` is a rendered template in `TEMPLATES[]` — not a parsed object. The plan now specifies the correct approach: add `projectType` to `TemplateRenderContext` and update the `render()` function in `scaffold.ts`. No free-floating `atomicWrite` needed.
> 2. **JSON flag gap resolved:** `--json` is not in `InitOptions` today; `src/cli.ts` handles it inline. P2 now specifies adding `json?: boolean` to `InitOptions` and wiring it in `src/cli.ts`, consistent with how all other commands handle it.
> 3. **Rollout validation step 2 made concrete:** Replaced vague "Tauri repo fixture" with a temp-dir setup pattern consistent with the existing test suite.

## Table of Contents
- [Context and Constraints](#context-and-constraints)
- [High-Level Technical Design](#high-level-technical-design)
- [Implementation Phases](#implementation-phases)
- [Acceptance Criteria](#acceptance-criteria)
- [Rollout and Validation](#rollout-and-validation)
- [Execution Ledger](#execution-ledger)

---

## Context and Constraints

**Spec source:** `docs/specs/2026-03-24-feature-project-type-detection-spec.md`

**Key constraints from spec (non-negotiable):**
- Detection is read-only (`detectProjectType` has zero write calls) → SA15
- `"unknown"` never blocks init → I4
- Auto-detection never overwrites an existing `projectType` on re-init → I2
- `--project-type` always wins, even over stored value → I3
- `"unknown"` is not a valid `--project-type` argument → I6
- Warning suppressed in `--json` mode → I7
- Glob patterns use `picomatch` (already in `dependencies`; no new dep required)
- All 18 SA-IDs must pass; 10 DoD checkboxes must be cleared

**Repo patterns to follow:**
- New library modules live in `src/lib/<name>/` — e.g., `src/lib/project-type/`
- Module exports use `.js` ESM extensions
- Pure functions preferred; result types use `{ ok: true; value: T } | { ok: false; error: E }` discriminated unions
- `detectPackageManager()` in `src/lib/init/scaffold.ts` is a direct analogue: pure fn, `existsSync`-based, priority-ordered checks
- Tests use Vitest; test files colocated with source (`detector.test.ts` next to `detector.ts`)
- New optional fields on `HarnessContract` follow jsdoc comment pattern (`/** description */`)

---

## High-Level Technical Design

```
harness init [--project-type <type>] [--json]
  │
  └── src/cli.ts («init» branch)
        │  Parse --project-type, --json flags → pass into InitOptions
        │
        └── runInit() [src/lib/init/cli.ts]
              │
              ├── normalizeCIProvider()            ← existing, unchanged
              │
              ├── validate --project-type value    ← NEW: reject "unknown"
              │
              ├── detectProjectType(dir, override) ← NEW — pure, read-only
              │     ├── override present? → return OVERRIDE_RULE_NAME result
              │     └── scan 7 rules in priority order
              │           (picomatch for glob signals, existsSync for exact)
              │
              ├── compute projectTypeToWrite
              │     ├── existing harness.contract.json has projectType?
              │     │     └── no --project-type flag → keep stored value
              │     └── otherwise → use detectionResult.projectType
              │
              ├── pass projectTypeToWrite into TemplateRenderContext  ← KEY
              │
              ├── template loop (unchanged)
              │     └── harness.contract.json render() reads
              │           context.projectType and includes it in JSON output
              │
              └── return InitOutput with projectTypeDetection field

  runInitCLI() receives result:
    ├── if options.json → JSON.stringify(result.output) to stdout
    └── else if projectTypeDetection.projectType === "unknown" → console.warn
```

**How `projectType` gets into `harness.contract.json`:**
`harness.contract.json` is rendered by a `render(pm, context)` function in `src/lib/init/scaffold.ts` (inside the `TEMPLATES` array). The contract is NOT parsed and re-written as a JSON object inside `runInit()`. The correct mechanism is:
1. Add `projectType?: ProjectType` to `TemplateRenderContext` (in `src/lib/init/types.ts`)
2. Pass `projectTypeToWrite` into `createTemplateRenderContext(...)` (in `src/lib/init/cli.ts`)
3. In the `harness.contract.json` `render()` function in `scaffold.ts`, add `...(context.projectType ? { projectType: context.projectType } : {})` to the rendered JSON object

**How upgrade-safety (I2) is enforced:**
Before building the render context, read the existing contract's `projectType` using `detectContractVersion`-style `try/JSON.parse/catch` (already used at line 303 of `migration.ts`). If an existing value is found and no `--project-type` flag was passed, use the stored value — meaning the rendered template will carry the original type and `atomicWrite` will see an unchanged file (or the template will be skipped on re-init because the file exists and `--force` is absent).

> **Execution note:** On re-init without `--force`, the template loop skips `harness.contract.json` because it already exists. This means `projectType` is preserved automatically for the re-init case — the upgrade-safety invariant I2 is satisfied by the existing skip logic, not by a new guard. Only first-time installs (`--force` or new repo) write a fresh contract. An explicit `--project-type` flag passed on re-init WILL update the contract because the implementer must pass `--force` to overwrite existing files, or check whether a targeted contract patch (separate `atomicWrite`) is the correct path for that flag-overwrite case. This is an **open question for P2** that the implementer must resolve with a targeted decision.

**New files:**
- `src/lib/project-type/types.ts` — types only
- `src/lib/project-type/detector.ts` — detection logic
- `src/lib/project-type/detector.test.ts` — 18 SA-test cases
- `src/lib/project-type/index.ts` — barrel export

**Modified files:**
- `src/lib/contract/types.ts` — add `projectType?: ProjectType` to `HarnessContract`
- `src/lib/init/types.ts` — add `projectType?: ProjectType` to `InitOptions`, `ContractSchema`, `InitOutput`; add `projectType?: ProjectType` to `TemplateRenderContext`; add `json?: boolean` to `InitOptions`; add `projectTypeDetection?: DetectionResult` to `InitOutput`
- `src/lib/init/scaffold.ts` — update `harness.contract.json` `render()` to include `context.projectType`
- `src/lib/init/cli.ts` — wire detection + render context into `runInit()`; emit warning/JSON in `runInitCLI()`
- `src/cli.ts` — parse `--project-type` and `--json` flags for the `init` command branch

---

## Implementation Phases

### P0 — New detection library (`src/lib/project-type/`)

**Goal:** Create the pure detection module with all 7 rules and full test coverage. Nothing in `init` changes yet.

**Dependencies:** None.

**Files:**
- `src/lib/project-type/types.ts` (create)
- `src/lib/project-type/detector.ts` (create)
- `src/lib/project-type/detector.test.ts` (create)
- `src/lib/project-type/index.ts` (create)

**Approach:**
1. Create `src/lib/project-type/types.ts`:
   - Export `ProjectType`, `OVERRIDE_RULE_NAME`, `DetectionSignal`, `DetectionRule`, `DetectionResult` exactly as in spec
   - `VALID_OVERRIDE_TYPES: ProjectType[]` export for CLI validation (excludes `"unknown"`)

2. Create `src/lib/project-type/detector.ts`:
   - Import `existsSync` from `node:fs`, `resolve` from `node:path`, `picomatch` from `picomatch`
   - Define `DETECTION_RULES: DetectionRule[]` array with the 7 rules in priority order
   - Implement `detectProjectType(targetDir: string, override?: ProjectType): DetectionResult`:
     - Override path: if `override` is defined, return immediately with `OVERRIDE_RULE_NAME`, `confidence: "high"`, `signals: []`
     - Detection loop: for each rule (sorted by `priority`), check all signals:
       - For `type: "directory"`: `existsSync(resolve(targetDir, signal.path))` and `statSync` confirms it is a directory
       - For `type: "file"` with exact `path`: `existsSync(resolve(targetDir, signal.path))`
       - For `type: "file"` with `pattern`: use `picomatch(signal.pattern!)` to build a matcher; run `readdirSync(targetDir)` (root only, non-recursive, cached per call); test each filename
     - First rule where all signals pass → return `DetectionResult` with `confidence: "high"`
     - No rule passes → return `{ projectType: "unknown", matchedRule: null, confidence: "low", signals: [] }`

   > **Execution note:** `readdirSync` in the glob path should be called once per `detectProjectType` invocation and cached within the function scope. Do not call it per-signal.

3. Create `src/lib/project-type/detector.test.ts`:
   - Use `tmp` or `os.mkdtemp` to create real temp dirs — same pattern as existing init tests
   - One `describe` block per SA-group; test SA1–SA18 with exact assertions on `projectType`, `matchedRule`, `confidence`, `signals`
   - SA15 (`detectProjectType` is read-only): spy on `node:fs` write methods using `vi.spyOn` and assert zero calls
   - SA18 (malformed pattern is non-fatal): export `DETECTION_RULES` from `detector.ts` and override it in a test-only copy, injecting a rule with a pattern that causes `picomatch` to throw. Assert that `detectProjectType` returns a result (does not throw) and that the malformed rule is skipped.

**Exit criteria:** `pnpm test src/lib/project-type/detector.test.ts` passes all 18 SA cases. `pnpm typecheck` clean.

---

### P1 — Type surface additions (three files)

**Goal:** Add `projectType` to the three existing type surfaces. No logic changes yet. Fully backward compatible.

**Dependencies:** P0 complete (imports `ProjectType` from the new module).

**Files:**
- `src/lib/contract/types.ts` (modify)
- `src/lib/init/types.ts` (modify ×2: `ContractSchema`, `InitOptions`, `InitOutput`)

**Approach:**
1. `src/lib/contract/types.ts` — in `HarnessContract`, add after `ciProviderPolicy`:
   ```typescript
   /** Auto-detected or operator-specified project type. Absence treated as "unknown" by all readers. */
   projectType?: ProjectType;
   ```
   Import `ProjectType` from `../project-type/types.js`.

2. `src/lib/init/types.ts` — three additions:
   - `InitOptions`: add `projectType?: ProjectType` after `ciProvider?: string`
   - `ContractSchema`: add `projectType?: ProjectType` (already has `[key: string]: unknown` catch-all — still add explicit type for schema-aware migration safety)
   - `InitOutput`: add `projectTypeDetection?: DetectionResult` after `proposedChanges`
   Import `ProjectType`, `DetectionResult` from `../project-type/types.js`.

**Exit criteria:** `pnpm typecheck` passes with zero errors. Existing tests unaffected (run `pnpm test`).

---

### P2 — Wire detection into `runInit()`, update scaffold template, and add CLI flags

**Goal:** Hook detection into `runInit()`, pass `projectType` through `TemplateRenderContext` so scaffold.ts renders it into the contract template, add `--project-type` and `--json` flags to the init arg-parser in `src/cli.ts`, and wire warning/JSON output in `runInitCLI()`.

**Dependencies:** P0 + P1 complete.

**Files (in edit order):**
1. `src/lib/init/types.ts` — add `json?: boolean` to `InitOptions`; add `projectType?: ProjectType` to `TemplateRenderContext`
2. `src/lib/init/scaffold.ts` — update `harness.contract.json` `render()` to include `context.projectType`
3. `src/lib/init/cli.ts` — wire detection into `runInit()`; update `createTemplateRenderContext` call; emit warning/JSON in `runInitCLI()`
4. `src/cli.ts` — parse `--project-type` and `--json` for the `init` command branch

**Approach:**

**Step 1 — Extend `InitOptions` and `TemplateRenderContext` (in `types.ts`):**
```typescript
export interface InitOptions {
  // ... existing fields ...
  json?: boolean;            // emit structured JSON output
  projectType?: ProjectType; // from --project-type flag; undefined = auto-detect
}

export interface TemplateRenderContext {
  // ... existing fields ...
  projectType?: ProjectType; // resolved detection result for contract rendering
}
```

**Step 2 — Update `scaffold.ts` contract render function:**
Locate the `harness.contract.json` entry in `TEMPLATES` (line ~1059 of `scaffold.ts`). Its `render()` function builds a JSON object literal. Add `projectType` conditionally:
```typescript
render: (pm, context) =>
  JSON.stringify(
    {
      version: CURRENT_SCHEMA_VERSION,
      ...(context.projectType ? { projectType: context.projectType } : {}),
      riskTierRules: { ... },
      // ... rest unchanged ...
    },
    null,
    2
  ),
```

**Step 3 — Wire detection into `runInit()` (in `cli.ts`):**

_a. Import:_ Add `detectProjectType`, `VALID_OVERRIDE_TYPES` from `../project-type/index.js`.

_b. Validate override:_ After `normalizeCIProvider` succeeds and before `detectPackageManager`:
```typescript
if (options.projectType !== undefined &&
    !VALID_OVERRIDE_TYPES.includes(options.projectType)) {
  return { ok: false, error: { code: "INVALID_PATH",
    message: `Invalid --project-type "${options.projectType}". ` +
             `Valid values: ${VALID_OVERRIDE_TYPES.join(" | ")}` } };
}
```

_c. Detect:_
```typescript
const detectionResult = detectProjectType(dir, options.projectType);
```

_d. Resolve upgrade-safe `projectTypeToWrite`:_
```typescript
// Read existing stored value (if contract exists)
let existingProjectType: ProjectType | undefined;
try {
  const raw = JSON.parse(readFileSync(resolve(dir, "harness.contract.json"), "utf-8"));
  if (typeof raw?.projectType === "string") {
    existingProjectType = raw.projectType as ProjectType;
  }
} catch { /* file absent or malformed — treat as absent */ }

const projectTypeToWrite: ProjectType =
  options.projectType !== undefined
    ? options.projectType          // explicit flag always wins (AC8)
    : existingProjectType ?? detectionResult.projectType;
```

> **Decision (2026-03-24):** Use a **targeted `atomicWrite` patch** after the template loop when `options.projectType` is explicitly set and the contract already exists. Requiring `--force` alongside `--project-type` is a footgun — users should not need to know about template skip semantics to exercise I3. The patch reads the existing JSON, sets/overwrites only `projectType`, and writes back atomically. This keeps re-init idempotent for all other fields.

_e2. Targeted patch for re-init override (after template loop, before manifest write):_
```typescript
// If --project-type was explicitly given AND the contract already exists,
// the template loop skipped harness.contract.json (file exists, no --force).
// Patch projectType directly so I3 is always honoured.
const contractPath = resolve(dir, "harness.contract.json");
if (options.projectType !== undefined && existsSync(contractPath) && !options.dryRun) {
  try {
    const existing = JSON.parse(readFileSync(contractPath, "utf-8")) as Record<string, unknown>;
    existing.projectType = options.projectType;
    const patchResult = atomicWrite(contractPath, JSON.stringify(existing, null, 2));
    if (!patchResult.ok) return patchResult;
    // Mark as "created" only if not already in the created list
    if (!created.includes("harness.contract.json")) {
      created.push("harness.contract.json");
    }
  } catch {
    // JSON parse failure on existing contract — surface as WRITE_ERROR
    return { ok: false, error: { code: "WRITE_ERROR",
      message: "Could not patch harness.contract.json: file is not valid JSON",
      path: "harness.contract.json" } };
  }
}
```

_e. Pass into render context:_ Update the `createTemplateRenderContext(dir, ciProvider)` call to include `projectType`:
```typescript
const renderContext = createTemplateRenderContext(dir, ciProvider, projectTypeToWrite);
// Also update createTemplateRenderContext signature in scaffold.ts to accept
// an optional third argument: projectType?: ProjectType
```

_f. Add detection result to `InitOutput`:_
```typescript
return {
  ok: true,
  output: { packageManager, created, skipped, projectTypeDetection: detectionResult },
};
```
(Add to all existing early-return `InitOutput` shapes as `projectTypeDetection: undefined` to maintain type safety.)

**Step 4 — Warning + JSON output in `runInitCLI()` (in `cli.ts`):**

> **Plan is authoritative on warning placement:** The spec pseudocode shows the warning inside `runInit()`, but `runInit()` is a pure library function and must not emit console output. The warning belongs in `runInitCLI()` (this step). Spec pseudocode is illustrative only.
```typescript
// After result.ok, before the mode-specific handlers:
if (options.json) {
  console.info(JSON.stringify(result.output, null, 2));
  return EXIT_CODES.SUCCESS;
}

if (result.output.projectTypeDetection?.projectType === "unknown") {
  console.warn(
    "⚠️  Could not auto-detect project type. " +
    "Defaulting to universal template. " +
    "Run `harness init --project-type <cli|desktop|library|web>` to set explicitly."
  );
}
```

**Step 5 — Parse new flags in `src/cli.ts` (init command branch, ~line 758):**
Follow exact pattern of existing flag parsing in the init branch:
```typescript
const jsonFlag = args.includes("--json");
const projectTypeIndex = args.indexOf("--project-type");
const projectTypeValue = getFlagValue(args, projectTypeIndex);

const options = {
  dryRun: dryRunFlag,
  // ... existing ...
  json: jsonFlag,
  ...(projectTypeValue !== undefined ? { projectType: projectTypeValue as ProjectType } : {}),
};
```

**Exit criteria:**
- ✅ Re-init open question resolved: targeted `atomicWrite` patch used (no `--force` required with `--project-type`)
- `pnpm test src/commands/init.test.ts` (or equivalent) passes; SA11 and SA12 tests cover both re-init paths
- `harness init --dry-run` on this repo emits: `"Detected project type: cli (matched rule: cli-ts)"`
- `harness init --project-type robot` exits with code 1, error lists valid values
- `harness init --project-type unknown` exits with code 1
- `harness init --json --dry-run` outputs valid JSON including `projectTypeDetection`
- `pnpm typecheck` and `pnpm lint` pass

---

### P3 — Integration gate and full test sweep

**Goal:** Confirm all 18 SA-IDs pass end-to-end; confirm no regressions; update DoD checklist.

**Dependencies:** P0 + P1 + P2 complete.

**Files:**
- `src/commands/init.test.ts` (add integration tests if separate from unit tests)

**Approach:**
1. Run the full test suite: `pnpm test`
2. Verify each SA-ID is covered (either in `detector.test.ts` or `init.test.ts`):
   - SA11 (upgrade: auto-detection does not overwrite) requires a temp dir with an existing `harness.contract.json` containing `projectType: "cli"`
   - SA12 (upgrade + flag DOES overwrite) similarly
   - SA13/SA14 require JSON output inspection
3. Run `pnpm check` (aggregate: lint + typecheck + test + audit)
4. Review `harness.contract.json` template file — add a `"projectType"` example field with a comment

**Exit criteria:** `pnpm check` passes clean. All 18 SA-IDs covered. 10 DoD items checked.

---

## Acceptance Criteria

| ID | Criterion | Traceable to |
|---|---|---|
| AC1 | `detectProjectType` is a pure function: zero write calls during detection | SA15, I1 |
| AC2 | All 7 project types (incl. `"unknown"`) detected correctly by their signals | SA1–SA7 |
| AC3 | Priority order respected: Tauri beats Vite on coexistence | SA8 |
| AC4 | `--project-type` override wins over detection | SA9 |
| AC5 | `--project-type` invalid value → exit 1 with list of valid values | SA10 |
| AC6 | `--project-type unknown` → exit 1 (not a permitted explicit value) | SA16, I6 |
| AC7 | Re-init without flag preserves existing `projectType` | SA11, I2 |
| AC8 | Re-init WITH flag overwrites existing `projectType` | SA12, I3 |
| AC9 | `"unknown"` emits `console.warn` in non-JSON mode | SA13 |
| AC10 | `"unknown"` does NOT emit `console.warn` in JSON mode; appears in structured output | SA14, I7 |
| AC11 | `projectTypeDetection` present in `--json` output on normal init | SA17 |
| AC12 | `picomatch` error on malformed pattern: rule skipped, init completes | SA18 |
| AC13 | `HarnessContract.projectType` is optional; existing contracts type-check | Spec — System Boundary |
| AC14 | `pnpm check` passes with zero new errors | DoD |

---

## Rollout and Validation

**Rollout:** Single PR. No feature flag needed (the feature is additive; absence of `projectType` is backward-compatible).

**Validation steps:**
1. Run `harness init --dry-run` on this repo → must detect `"cli"` via `cli-ts` rule (this repo has `src/cli.ts`)
2. Create a temp fixture dir with `mkdir -p /tmp/tauri-fixture/src-tauri`; run `harness init --dry-run /tmp/tauri-fixture` → must detect `"desktop"` via `tauri` rule
3. Run `harness init --dry-run --json` on this repo → output is valid JSON; `projectTypeDetection.projectType === "cli"`; `projectTypeDetection.matchedRule === "cli-ts"`
4. Run `harness init --project-type web --dry-run` → `projectTypeDetection.matchedRule === "override"`; human output includes `"web"`; no warning
5. Run `harness init --project-type robot` → exit code 1; error message lists `cli | desktop | library | web`
6. Run `harness init --project-type unknown` → exit code 1 (I6)
7. `pnpm check` passes

**Rollback:** Additive-only change. No data migration. To rollback: revert the PR; contracts with `projectType` field continue to work because `ContractSchema` and `HarnessContract` accept `[key: string]: unknown`.

**Docs required (docs-gate):** This change touches `init_scaffolding` category:
- Update `README.md` — add `--project-type` flag to the `harness init` command reference
- Update `AGENTS.md` — add note about auto-detection under harness init guidance

---

## Execution Ledger

| Phase | Status | Exit criteria met |
|---|---|---|
| P0 — Detection library | `complete` | ☑ |
| P1 — Type surface additions | `complete` | ☑ |
| P2 — Wire into `runInit()` + CLI flag | `complete` | ☑ |
| P3 — Integration gate + full sweep | `complete` | ☑ |
