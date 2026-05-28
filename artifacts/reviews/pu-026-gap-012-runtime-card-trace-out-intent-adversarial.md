# Adversarial Review - PU-026 GAP-012 Runtime-Card Trace-Out Intent

## Scope
- Intent reviewed: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json`
- Cross-contract context:
  - `docs/architecture/agent-run-records.md`
  - `contracts/agent-run-event.schema.json`
  - `src/commands/runtime-card.ts`
  - `src/commands/runtime-card-args.ts`

## Findings (Severity-Ordered)

### 1) High - Trace output contract bypasses canonical run-record discovery, causing downstream replay consumers to miss evidence
- Severity: high
- Confidence: 85
- Validation ownership: introduced_by_current_patch
- Evidence:
  - Trigger: Intent defines free-form trace destination as any repo-relative file supplied via `--trace-out` and contract key `traceFile` without requiring canonical run directory layout ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:64](.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:64), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:99](.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:99)).
  - Contract mismatch: Existing run-record consumers resolve event files by canonical precedence under `artifacts/agent-runs/<runId>/events.jsonl` then legacy fallback, and fail closed on invalid canonical files ([docs/architecture/agent-run-records.md:27](docs/architecture/agent-run-records.md:27), [docs/architecture/agent-run-records.md:79](docs/architecture/agent-run-records.md:79), [docs/architecture/agent-run-records.md:82](docs/architecture/agent-run-records.md:82)).
  - Failure outcome: Runtime-card emits trace evidence that exists on disk but is undiscoverable by contract-driven replay/readers, creating a false-negative “no evidence found” state.
- Impacted behavior:
  - Replay and governance tools that follow canonical discovery will ignore the new trace stream.
  - Operators may believe GAP-012 is improving observability while actual consumption paths stay blind.
- Remediation:
  - Require `--trace-out` to default to or enforce canonical run-record placement `artifacts/agent-runs/<runId>/events.jsonl`, or
  - Add an explicit adapter/discovery registration contract in same slice that lets existing consumers discover non-canonical trace files.
  - Add a regression proving canonical consumer discovers runtime-card traces without special-case flags.

### 2) Medium - Intent mandates hash-chain fields but not atomic append semantics, enabling corruption under retries/concurrent executions
- Severity: medium
- Confidence: 78
- Validation ownership: introduced_by_current_patch
- Evidence:
  - Trigger: Intent requires hash-chained JSONL events (`prevEventHash`/`eventHash`) but does not require append atomicity or file-lock discipline ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:56](.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:56), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:73](.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:73)).
  - Existing contract: Agent run records explicitly define temp-copy + append + atomic rename semantics to preserve event-stream integrity ([docs/architecture/agent-run-records.md:86](docs/architecture/agent-run-records.md:86), [docs/architecture/agent-run-records.md:87](docs/architecture/agent-run-records.md:87), [docs/architecture/agent-run-records.md:88](docs/architecture/agent-run-records.md:88)).
  - Failure chain:
    1. Two runtime-card executions target same `--trace-out`.
    2. Both compute next hash from stale tail.
    3. Last writer wins or interleaves writes; one chain branch is lost.
    4. Replay validator flags continuity break or accepts truncated history depending on parser strictness.
- Impacted behavior:
  - Replayability degrades exactly when repeated runs/retries happen, i.e., high-debug-value moments.
- Remediation:
  - Require writer to reuse existing atomic event-write primitive or match its semantics.
  - Add concurrent-write test fixture (same path, overlapping writes) that proves deterministic failure classification instead of silent corruption.

### 3) Medium - Validation gate does not require schema validation of emitted trace file, allowing “green” runs with structurally invalid events
- Severity: medium
- Confidence: 81
- Validation ownership: introduced_by_current_patch
- Evidence:
  - Trigger: Intent validation runs runtime-card command and tests, but has no explicit gate that validates generated `--trace-out` lines against `agent-run-event/v1` schema ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:77](.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:77), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:85](.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:85)).
  - Contract demand: `agent-run-event/v1` has strict enums and required fields; malformed eventType/status/severity/payload shape must be rejected ([contracts/agent-run-event.schema.json:7](contracts/agent-run-event.schema.json:7), [contracts/agent-run-event.schema.json:36](contracts/agent-run-event.schema.json:36), [contracts/agent-run-event.schema.json:52](contracts/agent-run-event.schema.json:52), [contracts/agent-run-event.schema.json:55](contracts/agent-run-event.schema.json:55)).
  - Failure outcome: Implementation could emit near-correct JSONL with a wrong enum or missing required field; tests may still pass if they only assert file existence/contains.
- Impacted behavior:
  - Trace evidence appears present but is unusable for strict downstream verifiers.
- Remediation:
  - Add a gate that parses each emitted line and validates against `contracts/agent-run-event.schema.json`.
  - Include a negative fixture to prove invalid events fail the slice.

## Residual Risks
- Intent leaves runId generation strategy implicit; collision risk remains if runId derivation is low-entropy or deterministic per repo+day.
- Intent does not define trace retention/rotation; large long-lived trace files may accumulate without lifecycle controls.

## Positive Signals
- Reuses existing `agent-run-event/v1` schema instead of introducing a competing format.
- Explicitly keeps trace evidence advisory and non-authoritative for closeout claims.
- Includes repo-bound path constraint and parse-time “no trace file on usage errors” criterion, reducing accidental side effects.

## Accountability Receipt
- status: completed
- artifact_paths:
  - artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-intent-adversarial.md
- findings:
  - high: canonical discovery mismatch for `--trace-out` contract
  - medium: missing atomic append semantics for hash-chained events
  - medium: missing explicit schema-validation gate for emitted trace lines
- failures_or_blockers: none
- improvement_opportunities:
  - bind trace path to canonical run-record layout or ship discovery adapter
  - require atomic write semantics and concurrent-write regression
  - add explicit schema validation of emitted JSONL lines in validation gates
- strengths:
  - additive, opt-in scope
  - clear non-goals against closeout authority creep
  - explicit redaction/sanitization intent
- validation_evidence:
  - reviewed intent and cross-contract files with line-cited evidence only; no implementation edits performed
- next_action:
  - revise intent acceptance/validation contract before implementation begins

WROTE: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-intent-adversarial.md

