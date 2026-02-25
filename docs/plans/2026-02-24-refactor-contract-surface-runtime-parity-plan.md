---
title: Contract Surface Runtime Parity Refactor
type: refactor
status: implemented
date: 2026-02-24
completed: 2026-02-25
origin: docs/brainstorms/2026-02-24-contract-surface-parity-brainstorm.md
deepened: 2026-02-24
---

# Plan: Refactor Contract Surface and Runtime Parity

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Current-State Contract Surface Matrix](#current-state-contract-surface-matrix)
- [Proposed Solution](#proposed-solution)
- [System-Wide Impact](#system-wide-impact)
- [Implementation Steps](#implementation-steps)
- [Acceptance Criteria](#acceptance-criteria)
- [Success Metrics](#success-metrics)
- [Dependencies and Risks](#dependencies-and-risks)
- [Open Questions](#open-questions)
- [Sources & References](#sources--references)

## Enhancement Summary

**Deepened on:** 2026-02-24  
**Origin brainstorm:** `docs/brainstorms/2026-02-24-contract-surface-parity-brainstorm.md`  
**Sections enhanced:** contract matrix, migration strategy, runtime-consumer parity, test strategy, rollout gates

### Key Improvements Added During Deepening

1. **Explicit contract matrix:** every scaffolded top-level field is mapped across scaffold/type/validator/runtime so parity is measurable.
2. **Version normalization + migration safety:** standardize on `1.1.0`, support legacy `1.0` and `1.0.0`, add idempotent migration with atomic write + backup.
3. **Closed-schema enforcement plan:** reject unknown top-level and nested keys to eliminate silent policy drift.
4. **Runtime consumer unification:** remove ad hoc JSON parsing (especially diff-budget), route all consumers through `loadContract`.
5. **Security hardening details:** recursive prototype-pollution checks and strict validation for nested objects.

### New Considerations Discovered

- `diffBudget` is currently runtime-consumed but not formally validated in `HarnessContract`, creating the highest-risk drift path.
- `uiLoopPolicy` is scaffolded but currently not consumed by `ui-loop` command surfaces.
- Plan-gate-compatible metadata/sections need to stay in allowed values (`status: draft|approved|implemented|superseded`; `## Implementation Steps`).
- No project `docs/solutions/` learnings were found; this plan serves as the institutional baseline for this parity work.

---

## Overview

Unify **contract intent**, **contract validation**, and **runtime enforcement** so `harness.contract.json` is a single trusted source of policy truth.

This implements the brainstorm decision to do a **big-bang contract unification** (see brainstorm: `docs/brainstorms/2026-02-24-contract-surface-parity-brainstorm.md`) before introducing larger agentic subsystems.

## Problem Statement

`harness init` scaffolds a broad policy surface, but `src/lib/contract/types.ts` + `src/lib/contract/validator.ts` currently enforce only a subset. This creates a contract-surface mismatch:

- users configure fields that look official but may be ignored;
- commands read contract data inconsistently (typed loader vs ad hoc JSON reads);
- policy drift is invisible until runtime failures (or never detected).

For an agent control plane, this ambiguity is a foundational reliability bug.

## Scope and Non-Goals

### In Scope

- Expand contract typing/validation to match scaffolded top-level fields.
- Enforce closed-schema validation (unknown keys fail).
- Standardize contract versioning to semver string `1.1.0`.
- Add migration behavior for legacy versions (`1.0`, `1.0.0`) via `harness init --migrate`.
- Move runtime consumers to typed loader contract access.

### Out of Scope (for this refactor)

- Designing new policy domains beyond scaffold parity.
- Building new major subsystems (multi-agent loops, autonomous execution, auto-merge).
- Reworking all command UX unrelated to contract consumption.

## Current-State Contract Surface Matrix

| Top-level field | Scaffolded in `init.ts` | In `HarnessContract` type | Validated in `validateContract` | Runtime-consumed today | V1 target state |
|---|---:|---:|---:|---|---|
| `version` | ✅ | ✅ | ✅ | init/migrate + loader | enforced_runtime |
| `riskTierRules` | ✅ | ✅ | ✅ | `risk-tier`, `policy-gate`, `preflight` | enforced_runtime |
| `mergePolicy` | ✅ | ❌ | ❌ | none | validated_reserved |
| `docsDriftRules` | ✅ | ❌ | ❌ | none | validated_reserved |
| `reviewPolicy` | ✅ | ✅ | ✅ | `review-gate` | enforced_runtime |
| `evidencePolicy` | ✅ | ✅ | ✅ | `evidence-verify` | enforced_runtime |
| `diffBudget` | ✅ | ❌ (`DiffBudget` exists but not on `HarnessContract`) | ❌ | `diff-budget` (ad hoc JSON parse) | enforced_runtime |
| `uiLoopPolicy` | ✅ | ❌ | ❌ | none (current `ui-loop` derives commands heuristically) | enforced_runtime (where applicable) |
| `runtimePolicy` | ✅ | ❌ | ❌ | none | validated_reserved |
| `memoryPolicy` | ✅ | ❌ | ❌ | none | validated_reserved |
| `memoryMaintenancePolicy` | ✅ | ❌ | ❌ | none | validated_reserved |
| `memoryEvalPolicy` | ✅ | ❌ | ❌ | none | validated_reserved |
| `observabilityPolicy` | ✅ | ❌ | ❌ | none | validated_reserved |
| `packageManagerPolicy` | ✅ | ❌ | ❌ | none | validated_reserved |

### V1 Contract Enforcement States

- **`enforced_runtime`**: field is scaffolded, typed, validated, and actively consumed by at least one runtime command path in v1.
- **`validated_reserved`**: field is scaffolded, typed, and validated in v1, but not yet consumed by runtime command behavior. In v1 these fields are accepted and shape-checked only (no runtime side effects), and this must remain explicit in docs/release notes.

### v1 Runtime Guarantee for `validated_reserved`

- **Accepted when valid**: contracts containing `validated_reserved`-classified fields pass validation if their structure and value types are correct.
- **No enforced side effects**: these fields are intentionally not wired into command behavior in v1.
- **No warnings by default**: because they are part of the explicit schema surface, their presence alone is not treated as an error or deprecation signal.
- **Strict envelope, no silent extension**: unknown top-level or nested keys are rejected by schema validation, but known `validated_reserved` keys are preserved and retained.
- **Future-ready**: only explicit follow-up plan changes may promote `validated_reserved` fields to `enforced_runtime`; until then, they remain a documented contract extension point.

**Operational consequence in v1:** contributors can rely on these fields for forward compatibility and documentation, but they must not depend on runtime behavior from them unless implementation explicitly reads them.

**Why this order:** follows the brainstorm’s v1 definition of schema + runtime parity with existing command surfaces first (see brainstorm).

## Proposed Solution

### 1) Canonical Contract Version + Shape

Adopt canonical version string **`1.1.0`** and treat the contract as a closed, semver-versioned interface.

- Accept legacy input versions: `1.0`, `1.0.0`.
- Normalize all written contracts to `1.1.0`.
- Update defaults in `src/lib/contract/types.ts` and template in `src/commands/init.ts`.

### 2) Full Typed Surface + Strict Validation

Expand `HarnessContract` in `src/lib/contract/types.ts` to include all scaffolded top-level fields.

Validation in `src/lib/contract/validator.ts` must:

- reject unknown top-level keys;
- reject unknown nested keys for each policy object;
- validate each field type/shape;
- preserve explicit machine-readable error codes;
- keep recursive forbidden-key checks (`__proto__`, `constructor`, `prototype`).

### 3) Runtime Parity Through One Loader Path

Route all runtime contract reads through `src/lib/contract/loader.ts`:

- replace ad hoc parse in `src/commands/diff-budget.ts` with typed contract access;
- add contract-aware read path for ui policy surfaces where applicable;
- retain deterministic defaults only as explicit fallback policy, not silent shape guessing.

### 4) Migration First, Strictness Second

Phase strict validation behind migration:

1. enable migration and normalization behavior;
2. add contract backup + atomic write on migrate;
3. then enable closed-schema strict rejection by default.

This avoids breaking existing repos before upgrade path is available.

### 5) Alternative Considered (Rejected)

**Staged adapter layer** (temporary dual readers and loose shape compatibility) was rejected because it prolongs ambiguity and duplicates policy logic (see brainstorm).

## System-Wide Impact

### Interaction Graph

`harness.contract.json` → `loadContract` → command policy gates (`risk-tier`, `policy-gate`, `review-gate`, `evidence-verify`, `diff-budget`, preflight checks)

Parity work centralizes this graph so contract behavior changes in one place and propagate deterministically.

### Error Propagation

Validation failures should resolve to consistent `VALIDATION_ERROR` paths across commands, with structured details from `ValidationErrorCode`.

### State Lifecycle Risks

Migration writes are stateful; interrupted writes can corrupt contract files if not atomic. This plan requires backup + temp-file rename semantics.

### API Surface Parity

Any command with `contractPath` or contract-derived defaults must read via loader. No direct `JSON.parse` contract reads remain in command handlers.

### Integration Scenarios

1. Legacy contract (`1.0`) migrates to `1.1.0` and passes all gates.
2. Unknown top-level key fails with explicit validation error.
3. `diff-budget` respects validated contract values (not raw JSON shape assumptions).
4. `ui-loop` behavior remains backward compatible when `uiLoopPolicy` absent.

## Implementation Steps

### Phase 1 — Contract Surface Expansion (Types + Validator)

**Primary files**
- `src/lib/contract/types.ts`
- `src/lib/contract/validator.ts`
- `src/lib/contract/validator.test.ts`

**Tasks**
- Add all scaffolded top-level policy interfaces to `HarnessContract`.
- Add defaults for optional policies where required.
- Add explicit top-level allowed-key set and nested allowed-key validation.
- Add strict validators for:
  - `diffBudget` (`maxFiles`, `maxNetLOC`, optional `overrideLabel`),
  - `uiLoopPolicy` (`fastCommand`, `verifyCommand`, `exploreCommand`, `sloTargets`),
  - remaining scaffolded policy objects.
- Add field-by-field matrix assertions in tests to prevent future drift.

**Research insights applied**
- Keep explicit `ValidationErrorCode` outputs for machine handling.
- Use schema-like invariants without introducing unnecessary runtime schema dependencies.

### Phase 2 — Migration + Version Normalization

**Primary files**
- `src/commands/init.ts`
- `src/commands/init.test.ts`

**Tasks**
- Set `CURRENT_SCHEMA_VERSION` to `1.1.0`.
- Add migration path(s):
  - `1.0` → `1.1.0`
  - `1.0.0` → `1.1.0`
- Migration behavior:
  - normalize version format,
  - inject missing policy defaults,
  - drop/record unknown keys,
  - create backup before writing,
  - write via temp file + atomic rename.
- Ensure migration is idempotent (second run is no-op).

**Research insights applied**
- Atomic replacement and backup reduce corruption risk.
- Semver-normalized version strings avoid downstream comparison ambiguity.

### Phase 3 — Runtime Consumer Parity

**Primary files**
- `src/lib/contract/loader.ts`
- `src/commands/diff-budget.ts`
- `src/commands/diff-budget.test.ts`
- `src/commands/ui-loop.ts`
- `src/commands/ui-loop.test.ts` (create if missing)

**Tasks**
- Replace `diff-budget` raw contract parsing with `loadContract`.
- Add typed resolver helpers for policy defaults (e.g., diff budget + ui loop policy).
- Where applicable, allow `ui-loop` command surfaces to consume `uiLoopPolicy` values from contract.
- Verify no command in `src/commands/**` directly parses contract JSON.

**Research insights applied**
- One loader path improves consistency and prevents split-brain policy reads.

### Phase 4 — Hardening, Docs, and Gates

**Primary files**
- `docs/HARNESS_IMPLEMENTATION_PLAN.md`
- `docs/plans/2026-02-24-refactor-contract-surface-runtime-parity-plan.md`

**Tasks**
- Document new contract semantics and migration expectations.
- Add contract parity checklist for future policy additions.
- Ensure CI/local checks include parity-critical tests.

**Verification gates per phase**
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check`

## Acceptance Criteria

### Functional

- [x] Every top-level field scaffolded by `harness init` is represented in `HarnessContract`.
- [x] Validator enforces closed schema at top-level and nested policy levels.
- [x] `harness init --migrate` upgrades `1.0` and `1.0.0` contracts to `1.1.0`.
- [x] Runtime contract consumers no longer parse contract JSON ad hoc.
- [x] `diff-budget` and applicable `ui-loop` paths consume validated contract values.

### Quality

- [x] Contract validator test matrix covers all scaffolded policy fields.
- [x] Migration tests cover idempotency, backup creation, and interrupted-write rollback behavior.
- [x] Security tests cover prototype-pollution keys at multiple nesting levels.
- [x] Error outputs preserve stable machine-readable codes.

### Compatibility

- [x] Existing valid contracts remain functional after migration.
- [x] Legacy version strings are accepted and normalized.
- [x] Unknown-key behavior is explicit (validation fail or deterministic migrate-drop report).

## Success Metrics

- **Parity coverage:** 100% of scaffolded top-level fields appear in type + validator surface.
- **Runtime parity:** 0 direct `JSON.parse` reads of contract data in command handlers.
- **Migration reliability:** repeated migration runs produce no further file changes.
- **Supportability:** all policy validation failures map to deterministic error codes.

## Dependencies and Risks

### Dependencies

- Existing contract loader/validator architecture in `src/lib/contract/*`.
- `init` migration plumbing in `src/commands/init.ts`.
- Command-level policy consumers in `src/commands/*`.

### Risks and Mitigations

1. **Risk:** strict schema breaks existing custom keys.  
   **Mitigation:** backup + migration report + explicit unknown-key handling.
2. **Risk:** version normalization regressions between `1.0`/`1.0.0`.  
   **Mitigation:** targeted migration tests for both legacy formats.
3. **Risk:** behavior drift during consumer refactor.  
   **Mitigation:** keep defaults explicit and add command-level snapshot/behavior tests.
4. **Risk:** partial write corruption during migration.  
   **Mitigation:** temp-file + atomic rename and backup restore path.

## Open Questions

None blocking for implementation. Follow-up candidate after parity ships: whether `validated_reserved` policies should move to runtime enforcement in a dedicated policy-runtime phase.

## Sources & References

### Origin brainstorm

- `docs/brainstorms/2026-02-24-contract-surface-parity-brainstorm.md`  
  Carried-forward decisions: big-bang unification, closed schema, migrate path, runtime parity first for existing command surfaces.

### Internal references

- `src/commands/init.ts` (scaffold + migration entrypoints)
- `src/lib/contract/types.ts` (current contract model)
- `src/lib/contract/validator.ts` (current validation surface)
- `src/lib/contract/loader.ts` (single loader path)
- `src/commands/diff-budget.ts` (current ad hoc contract read)
- `src/commands/review-gate.ts`
- `src/commands/evidence-verify.ts`
- `src/lib/preflight/validator.ts`

### External references

- [Semantic Versioning 2.0.0](https://semver.org/)
- [node-semver (npm)](https://github.com/npm/node-semver)
- [JSON Schema reference: `additionalProperties`](https://json-schema.org/understanding-json-schema/reference/object)
- [Node.js File System API](https://nodejs.org/api/fs.html)
