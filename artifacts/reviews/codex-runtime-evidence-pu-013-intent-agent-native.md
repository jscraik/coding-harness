## Agent-Native Intent Review — PU-013

### Scope Reviewed
- Intent: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-013-intent.json`
- Plan (PU-013 and FR/SA trace sections): `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md`
- Spec (FR-004..FR-007, runtime-card advisory constraints): `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md`
- Current implementation surfaces named by intent:
  - `src/commands/runtime-card.ts`
  - `src/commands/next-decision-meta.ts`
  - `src/commands/next-runtime-card.ts`
  - `src/lib/runtime/codex-runtime-evidence-adapter.ts`
  - `src/lib/runtime/runtime-card-validation.ts`
  - `src/lib/runtime/runtime-card-codex-runtime-validation.ts`

### Verdict
No material blocker found for starting PU-013 implementation from this intent.
The intent is bounded, implementable, and aligned with advisory-only cockpit authority.

### Findings

#### Warnings (Should Fix Before or During PU-013)

1. **Guardrail is now present, but implementation parity still needs explicit verification in PU-013 tests**
   - Evidence:
     - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-013-intent.json:134` now includes stop-condition protection for `runtime-card --evidence` repository boundary reads.
     - Coordinator follow-up indicates the intent was patched to include equivalent repo-boundary/path-safety requirements for `harness next --runtime-card` as well.
     - `src/commands/next-runtime-card.ts:18-24` currently accepts absolute artifact paths and reads directly.
   - Why this matters:
     - Intent-level safety policy exists, but runtime behavior must be explicitly asserted in acceptance tests for this unit so the policy does not remain documentary only.
   - Remediation:
     - Add/confirm PU-013 tests that prove `next --runtime-card` either enforces repo containment or intentionally classifies/blocks out-of-bound reads per updated intent policy.

### What’s Working Well
- Intent prevents authority creep and evidence warehousing:
  - No action authority expansion for `harness next` (`.harness/intent/...pu-013-intent.json:50,67-69,136`).
  - No raw prompts/transcripts/review bodies/bulky telemetry in `runtime-card/v1` (`.harness/intent/...pu-013-intent.json:51-53,135`).
- Acceptance criteria are concrete and fail-closed (`.harness/intent/...pu-013-intent.json:63-70`).
- Current evidence claims are accurate against code:
  - Adapter exists (`src/lib/runtime/codex-runtime-evidence-adapter.ts:36-74`).
  - Runtime-card CLI currently ingests evidence as generic JSON at boundary (`src/commands/runtime-card.ts:201-215`).

### Agent-Native Parity Check (Intent Stage)
- User-visible/operator action: provide runtime evidence artifact -> cockpit summary
  - Represented as machine-readable truth: yes (runtime-card schemas + fail-closed error schema).
- User-visible/operator action: ask for next recommendation with runtime context
  - Represented as machine-readable truth: yes (runtime-card metadata projection in next decision meta).
- Human-only/manual hidden step introduced by intent: no.
- Advisory-vs-authority boundary: explicit and preserved.

WROTE: artifacts/reviews/codex-runtime-evidence-pu-013-intent-agent-native.md
