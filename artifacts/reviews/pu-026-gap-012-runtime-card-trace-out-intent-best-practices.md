# PU-026 GAP-012 Runtime-Card Trace-Out Intent Review (Best Practices)

## Scope
- Reviewed intent only (no implementation): `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json`
- Compared against: `docs/architecture/agent-run-records.md`, `contracts/agent-run-event.schema.json`, `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml`, `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`, and current runtime-card CLI surfaces.

## Findings

### 1) Medium: Trace destination contract can drift from canonical run-record layout
- Severity: Medium
- Validation ownership: introduced by current patch (if intent implemented as-is)
- Evidence:
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:53-55,64` proposes arbitrary repo-relative trace-out JSONL path.
  - `docs/architecture/agent-run-records.md:27-31,79-83` defines canonical event location under `artifacts/agent-runs/<runId>/events.jsonl` and fail-closed discovery order.
- Impacted behavior:
  - Consumers may not discover trace evidence consistently, weakening replayability and future automation that expects canonical run-record paths.
- Remediation:
  - Keep `--trace-out` opt-in, but define canonical recommendation and fallback behavior:
    - default recommended path pattern under `artifacts/agent-runs/<runId>/events.jsonl`
    - if custom path is used, emit an explicit metadata field linking to canonical runId or record why canonical layout is bypassed.
- Confidence: High
- Validation owner: implementation slice owner for PU-026.

### 2) Medium: Intent omits required write semantics for append-safe JSONL traces
- Severity: Medium
- Validation ownership: introduced by current patch (if intent implemented as-is)
- Evidence:
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:24,53-56` asks for a trace writer and hash chain, but does not require atomic append/write semantics.
  - `docs/architecture/agent-run-records.md:84-88` requires temp-copy + append + atomic rename and hash continuity.
- Impacted behavior:
  - A crash or concurrent write can leave truncated or partially-written traces that pass local happy-path tests but fail deterministic replay in CI/closeout.
- Remediation:
  - Add acceptance text and test coverage requiring atomic write semantics aligned with run-record contract, including interruption-safe behavior.
- Confidence: High
- Validation owner: implementation slice owner plus reviewer validating filesystem semantics.

### 3) Low: Validation gates do not explicitly include trace-file schema/hash replay verification command
- Severity: Low
- Validation ownership: introduced by current patch (test contract gap)
- Evidence:
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:76-85` includes runtime-card invocation and runtime packet schema checks.
  - `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md:585-588` expects validated trace file with required event records.
  - `docs/architecture/agent-run-records.md:102` requires event logs hash-valid end-to-end.
- Impacted behavior:
  - A slice can appear complete without proving line-delimited schema validity and hash-chain continuity for emitted traces.
- Remediation:
  - Add one explicit validation command that parses trace JSONL and verifies:
    - each event validates against `agent-run-event/v1`
    - `prevEventHash` continuity to previous `eventHash`
    - required lifecycle events (start/final + error path when applicable).
- Confidence: Medium
- Validation owner: test/validator author in PU-026.

## Positive notes
- Reusing `agent-run-event/v1` and keeping trace output opt-in/advisory is aligned with additive, low-risk rollout principles.
- Intent correctly guards non-goals against closeout-authority expansion.

## Overall
- Material findings: 3 (2 medium, 1 low).
- No critical blockers found for intent approval if the remediations above are incorporated before implementation lock.

WROTE: artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-intent-best-practices.md
