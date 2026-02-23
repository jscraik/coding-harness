---
title: Phase 5 - Evidence + Observability Hooks
type: feat
date: 2026-02-23
status: active
origin: docs/HARNESS_IMPLEMENTATION_PLAN.md Phase 5
---

# Phase 5 - Evidence + Observability Hooks

## What We're Building

A browser evidence verification system and structured logging hooks for the coding-harness CLI:

1. **Evidence Verifier** - CLI command to validate screenshot evidence against a schema
2. **Evidence Policy** - Contract field to require evidence for specific paths/flows
3. **Structured Logging** - JSON logging with optional OTLP export for observability

## Why This Matters

Without evidence verification:
- Agents can claim UI changes work without proof
- No machine-verifiable artifacts for visual regressions
- CI can't validate that screenshots exist and are valid

Without structured logging:
- No visibility into harness operations
- Can't correlate harness runs with external systems
- Debugging requires console scraping

## Key Decisions

### 1. Evidence Type: Screenshots Only (MVP)

Start with PNG/JPEG verification:
- File exists and is readable
- Valid image format (not corrupted)
- Optional: minimum dimensions check

Defer traces, logs, and HAR files until there's proven need.

### 2. Collection: Manual File Path

User provides path to evidence files via CLI flag:
```bash
harness evidence-verify --files screenshot1.png,screenshot2.png
```

Works with any CI tool - no GitHub Actions-specific artifact download logic.

### 3. Observability: Logs Only (OTLP Optional)

Structured JSON logs by default:
```json
{"timestamp":"2026-02-23T10:00:00Z","level":"info","message":"Evidence verified","evidence_type":"screenshot","path":"ui-login.png"}
```

Optional OTLP export via `--otel-endpoint` flag:
```bash
harness init --otel-endpoint http://localhost:4318
```

Defer full tracing (spans, baggage) until there's proven need.

### 4. Evidence Policy in Contract

Add `evidencePolicy` to harness.contract.json:
```json
{
  "evidencePolicy": {
    "requiredFor": ["src/ui/**/*.tsx", "src/components/**/*"],
    "minDimensions": { "width": 800, "height": 600 }
  }
}
```

The `risk-tier` command can check if evidence is required for changed files.

### 5. Evidence Schema (JSON Schema)

Store in `contracts/browser-evidence.schema.json`:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["evidenceType", "files"],
  "properties": {
    "evidenceType": { "const": "screenshot" },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["path"],
        "properties": {
          "path": { "type": "string" },
          "description": { "type": "string" },
          "flowId": { "type": "string" }
        }
      }
    }
  }
}
```

## CLI Interface

```bash
# Verify evidence files
harness evidence-verify --files ui-login.png,ui-dashboard.png

# Verify with contract policy
harness evidence-verify --contract harness.contract.json

# JSON output for CI
harness evidence-verify --files screenshots/*.png --json

# Enable OTLP logging
harness evidence-verify --files ui.png --otel-endpoint http://localhost:4318
```

## Success Criteria

1. `harness evidence-verify` validates PNG/JPEG files
2. Invalid/corrupted images fail with actionable error
3. `--json` flag outputs machine-readable result
4. `evidencePolicy` in contract gates evidence requirements
5. Structured logs emitted for all operations
6. OTLP export works when `--otel-endpoint` provided

## Out of Scope

- Trace/span emission
- GitHub artifact download
- Screenshot comparison/diffing
- Browser automation integration
- HAR file validation
- Video evidence

## Open Questions

None - all decisions resolved through user input.
