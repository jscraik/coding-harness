---
title: "feat: Add Evidence + Observability Hooks"
type: feat
status: completed
date: 2026-04-13
plan_id: feat-evidence-observability
origin: docs/brainstorms/2026-02-23-phase-5-evidence-observability-brainstorm.md
---

# feat: Add Evidence + Observability Hooks

## Overview

Implement browser evidence verification and structured logging for the coding-harness CLI. This enables machine-verifiable UI change evidence and CI visibility.

## Problem Statement / Motivation

Without evidence verification:
- Agents can claim UI changes work without proof
- No machine-verifiable artifacts for visual regressions
- CI can't validate that screenshots exist and are valid

Without structured logging:
- No visibility into harness operations
- Can't correlate harness runs with external systems
- Debugging requires console scraping

## Proposed Solution

Add three components:
1. **Evidence Verifier Command** - Validates PNG/JPEG evidence files
2. **Evidence Policy** - Contract field to gate evidence requirements
3. **Structured Logging** - JSON logs with optional OTLP export

(see brainstorm: docs/brainstorms/2026-02-23-phase-5-evidence-observability-brainstorm.md)

## Technical Approach

### Architecture

```
src/
  commands/
    evidence-verify.ts      # Evidence verification command
  lib/
    evidence/
      types.ts              # Evidence schema types
      loader.ts             # Evidence file loading
      validator.ts          # Image format validation
      logger.ts             # Structured JSON logging
    contract/
      types.ts              # Add EvidencePolicy
      validator.ts          # Add evidence policy validation
```

### Implementation Phases

#### Phase 1: Evidence Types and Validation (Foundation)

**Files to create/modify:**
- `src/lib/evidence/types.ts` (new)
- `src/lib/evidence/loader.ts` (new)
- `src/lib/evidence/validator.ts` (new)

**Tasks:**
- [x] Add `EvidenceType`, `EvidenceFile`, `EvidenceCheckResult` types
- [x] Add `EvidenceError` interface with machine-readable codes
- [x] Implement `loadEvidenceFile()` - read and validate file existence
- [x] Implement `validateImageFormat()` - PNG/JPEG magic byte validation
- [x] Add path traversal protection using `realpathSync()` pattern (see todos/001)
- [x] Add file size limit (1MB max per evidence file)

**Key patterns:**
```typescript
// types.ts
export type EvidenceType = "screenshot";

export interface EvidenceFile {
  path: string;
  type: "png" | "jpeg";
  sizeBytes: number;
  dimensions?: { width: number; height: number };
}

export interface EvidenceCheckResult {
  ok: true;
  file: EvidenceFile;
}

export interface EvidenceError {
  ok: false;
  code: "FILE_NOT_FOUND" | "INVALID_FORMAT" | "FILE_TOO_LARGE" | "PATH_TRAVERSAL";
  message: string;
  path: string;
}

export type EvidenceResult = EvidenceCheckResult | { ok: false; error: EvidenceError };
```

**Image validation approach:**
- Check magic bytes: PNG = `89 50 4E 47`, JPEG = `FF D8 FF`
- No external dependencies - pure buffer inspection
- Defer dimension checking (requires image parsing library)

#### Phase 2: Evidence Verifier Command (Core Implementation)

**Files to create/modify:**
- `src/commands/evidence-verify.ts` (new)
- `src/cli.ts` (modify - add command)

**Tasks:**
- [x] Add `runEvidenceVerify()` library function with discriminated union result
- [x] Add `runEvidenceVerifyCLI()` wrapper with console output
- [x] Add `EXIT_CODES` constant (SUCCESS=0, VALIDATION_ERROR=1, FILE_NOT_FOUND=2, PATH_TRAVERSAL=3)
- [x] Add `--files` flag parsing (comma-separated)
- [x] Add `--contract` flag for policy-gated verification
- [x] Add `--json` flag for structured output
- [x] Register command in `cli.ts`
- [x] Add to `printUsage()` help text

**CLI interface:**
```bash
harness evidence-verify --files screenshot1.png,screenshot2.png [--json] [--contract harness.contract.json]
```

**Result pattern:**
```typescript
export interface EvidenceVerifyOutput {
  verified: number;
  failed: number;
  files: EvidenceFile[];
  errors: EvidenceError[];
}

export type EvidenceVerifyResult =
  | { ok: true; output: EvidenceVerifyOutput }
  | { ok: false; error: { code: string; message: string } };
```

#### Phase 3: Evidence Policy in Contract (Integration)

**Files to create/modify:**
- `src/lib/contract/types.ts` (modify)
- `src/lib/contract/validator.ts` (modify)
- `src/commands/init.ts` (modify - update template)
- `contracts/browser-evidence.schema.json` (new)

**Tasks:**
- [x] Add `EvidencePolicy` interface to types.ts
- [x] Add `evidencePolicy?: EvidencePolicy` to `HarnessContract`
- [x] Add `DEFAULT_EVIDENCE_POLICY` constant
- [x] Add `isValidEvidencePolicy()` validation function
- [x] Extend `validateContract()` to validate evidence policy
- [x] Update contract template in init.ts to include `evidencePolicy`
- [x] Create `contracts/browser-evidence.schema.json` JSON Schema

**Contract extension:**
```typescript
export interface EvidencePolicy {
  requiredFor: string[];  // Glob patterns for paths requiring evidence
  allowedTypes: ("png" | "jpeg")[];
  maxFileSizeBytes?: number;
}

// In HarnessContract:
evidencePolicy?: EvidencePolicy;
```

#### Phase 4: Structured Logging (Polish)

**Files to create/modify:**
- `src/lib/evidence/logger.ts` (new)
- `src/commands/evidence-verify.ts` (modify - add logging)
- All commands (optional - add logging calls)

**Tasks:**
- [x] Add `StructuredLogger` class with JSON output
- [x] Add log levels: `debug`, `info`, `warn`, `error`
- [x] Add `--otel-endpoint` flag for OTLP export
- [x] Add `OTEL_EXPORTER_OTLP_ENDPOINT` env var support
- [x] Implement OTLP log export (HTTP/protobuf)
- [x] Add timestamp (ISO 8601), level, message, context fields

**Log format:**
```json
{"timestamp":"2026-02-23T10:00:00Z","level":"info","message":"Evidence verified","evidence_type":"screenshot","path":"ui-login.png","duration_ms":45}
```

**OTLP integration:**
- Defer full tracing (spans, baggage)
- Use HTTP OTLP protocol (`/v1/logs`)
- Non-blocking fire-and-forget export

#### Phase 5: Tests (Quality Gates)

**Files to create/modify:**
- `src/commands/evidence-verify.test.ts` (new)
- `src/lib/evidence/validator.test.ts` (new)

**Tasks:**
- [x] Test PNG/JPEG magic byte validation
- [x] Test invalid/corrupted image detection
- [x] Test file size limit enforcement
- [x] Test path traversal protection
- [x] Test `--json` output format
- [x] Test evidence policy validation in contract
- [x] Test CLI exit codes

**Test patterns (from init.test.ts):**
```typescript
let tempDir: string;
beforeEach(() => {
  tempDir = join(tmpdir(), `harness-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
});
afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});
```

## System-Wide Impact

### Interaction Graph

```
harness evidence-verify
    ├── loadContract() [if --contract]
    │   └── validatePath() → realpathSync() check
    ├── for each file:
    │   ├── validatePath() → realpathSync() check
    │   ├── loadEvidenceFile() → read with size limit
    │   └── validateImageFormat() → magic byte check
    └── logger.info() [if --otel-endpoint]
```

### Error Propagation

| Error Code | Exit Code | Recovery |
|------------|-----------|----------|
| FILE_NOT_FOUND | 2 | Create missing evidence file |
| INVALID_FORMAT | 1 | Fix corrupted image |
| FILE_TOO_LARGE | 1 | Compress or split image |
| PATH_TRAVERSAL | 3 | Use path within project |
| VALIDATION_ERROR | 1 | Fix contract syntax |

### State Lifecycle Risks

- No persistent state - command is read-only
- No partial writes - evidence files not modified
- Safe to re-run after any failure

### Integration Test Scenarios

1. **End-to-end verification:** Create valid PNG, run verify, expect success
2. **Invalid image detection:** Create text file with .png extension, expect failure
3. **Policy gating:** Contract requires evidence for `src/ui/**`, verify blocks without evidence
4. **JSON output:** Run with `--json`, parse output, validate schema

## Acceptance Criteria

### Functional Requirements

- [ ] `harness evidence-verify --files screenshot.png` validates PNG files
- [ ] `harness evidence-verify --files photo.jpg` validates JPEG files
- [ ] Invalid/corrupted images fail with actionable error
- [ ] `--json` flag outputs machine-readable result
- [ ] `evidencePolicy` in contract gates evidence requirements
- [ ] Exit codes follow semantic contract (0=success, 1=validation, 2=not found, 3=permission)

### Non-Functional Requirements

- [ ] No external dependencies for image validation (pure buffer inspection)
- [ ] File size limit: 1MB max per evidence file
- [ ] JSON depth limit: 100 levels (for evidence manifests)
- [ ] Path traversal protection with symlink awareness

### Quality Gates

- [ ] Unit tests for image format validation
- [ ] Integration tests for CLI command
- [ ] Contract validation tests for evidence policy
- [ ] All existing tests still pass (110+ tests)

## Success Metrics

1. `harness evidence-verify` runs in <100ms for 10 files
2. JSON output can be consumed by CI systems
3. Exit codes distinguish failure modes for automation

## Dependencies & Risks

### Dependencies

- Node.js `fs` module for file operations
- `buffer` module for magic byte inspection
- No external npm packages for image validation

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Image format edge cases | LOW | Start with PNG/JPEG only, expand later |
| OTLP compatibility | MEDIUM | Defer OTLP to Phase 5.4, logs-first |
| Evidence policy complexity | LOW | Keep simple glob patterns, defer advanced rules |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-23-phase-5-evidence-observability-brainstorm.md](../brainstorms/2026-02-23-phase-5-evidence-observability-brainstorm.md)
- Key decisions carried forward:
  1. Screenshots only (MVP) - defer traces, logs, HAR files
  2. Manual file path collection - no GitHub artifact download
  3. Logs only for OpenTelemetry - defer full tracing

### Internal References

- Command pattern: `src/commands/init.ts:1104-1201`
- Contract types: `src/lib/contract/types.ts:1-26`
- Path validation: `src/lib/input/validator.ts:22-48`
- Error handling helper: `src/lib/input/sanitize.ts:1-25`

### Institutional Learnings

- **Path traversal bypass:** Use `realpathSync()` on resolved path, handle non-existent paths via parent directory (todos/001)
- **JSON depth limit:** Use reviver function to track depth, max 100 (todos/004)
- **Prototype pollution:** Block `__proto__`, `constructor`, `prototype` keys (todos/005)
- **CLI --json flag:** Always provide structured output for agents (todos/002)
- **Exit code contract:** Semantic codes (0=success, 1=validation, 2=not found, 3=permission) (todos/003)
- **Error codes:** Machine-readable `code` field in all errors (todos/007)

### External References

- PNG signature: `89 50 4E 47 0D 0A 1A 0A`
- JPEG signature: `FF D8 FF`
- OTLP logs protocol: https://opentelemetry.io/docs/specs/otlp/
