# Agent-Native Architecture Review

## Summary
This is an intent-level recovery re-review for PU-027 GAP-011 after the tracked-artifact repair. The intent correctly adds tracked reviewer artifact targets under `.harness/review/`, but the persisted review evidence still carries stale `artifacts/reviews/` references and the rerun artifact verification is still failed. Agent-operable closeout remains blocked until tracked evidence is actually present for all required reviewers.

## Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Record required reviewer outputs to tracked review paths | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:192 | Artifact write in shared workspace | yes | must-have | partial |
| Gate implementation on artifact existence (not mailbox-only) | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:259 | Deterministic policy field + verification command | yes | must-have | blocked |
| Preserve historical evidence links with current tracked contract | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:206 | N/A | partial | should-have | mismatch |

## Findings

### Critical (Must Fix)
1. **Tracked artifact contract is not yet satisfied, so implementation start remains blocked** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:253` and `:255` and `:259` -- the intent itself records artifact verification failure and explicitly blocks implementation until review artifacts exist and blockers are resolved.  
Fix: generate and persist all required reviewer artifacts at tracked paths listed in `:193-195` and confirm non-empty via the declared verification command at `:229`.  
Confidence: 100  
Validation ownership: introduced by current patch state (artifact persistence contract changed but not fully completed).

### Warnings (Should Fix)
1. **Stale evidence path namespace can break agent discoverability and future automation joins** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json:206`, `:211`, `:216`, `:236`, `:241`, `:247` -- review evidence still references `artifacts/reviews/*.md`, which conflicts with the repaired tracked namespace under `.harness/review/` (`:193-195`, `:225-227`).  
Recommendation: either remap these fields to tracked artifact paths or mark them explicitly as historical/untracked evidence so downstream readers and tooling do not treat them as current contract outputs.  
Confidence: 90  
Validation ownership: introduced by current patch state.

## Observations
1. **The intent now encodes the right anti-regression policy** -- required tracked paths, verification command, and mailbox-not-sufficient rationale are clearly encoded at `:223-229` and `:257`.

## What's Working Well
- The repair moved required artifact destinations to tracked `.harness/review/` paths.
- The implementation gate is explicit and fail-closed.
- The intent preserves a concrete verification command and stop condition for missing artifacts.

## Score
- **1/2 high-priority capabilities are currently agent-accessible end-to-end**
- **Verdict:** DO NOT PROCEED

WROTE: .harness/review/codex-runtime-evidence-verifier-cockpit/pu-027-gap-011-skill-density-intent-agent-native.md
