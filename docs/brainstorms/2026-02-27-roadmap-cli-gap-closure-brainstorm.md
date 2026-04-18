---
date: 2026-02-27
topic: roadmap-cli-gap-closure
last_validated: 2026-04-18
---

# Roadmap/CLI Gap Closure Brainstorm

## Table of Contents
- [What We're Building](#what-were-building)
- [Why This Approach](#why-this-approach)
- [Key Decisions](#key-decisions)
- [Success Criteria](#success-criteria)
- [Non-Goals](#non-goals)
- [Resolved Questions](#resolved-questions)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We're Building
We are closing the mismatch between the strategic roadmap narrative and the actually shipped harness CLI surface so the repo is a reliable system of record for agent-first workflows.

The target outcome is truth-first parity: command surface, tests, and docs all agree on what is implemented now; near-term roadmap claims are translated into explicit, scoped follow-up work that preserves existing contract compatibility.

## Why This Approach
We considered three paths:

1. **Docs-only correction now** (fastest, but leaves runtime/test gaps unresolved).
2. **Full behavior expansion first** (high risk, slower, and obscures what is currently true).
3. **Truth-first staged closure (recommended)**: P0 align runtime/docs/tests immediately, P1 close concrete behavior/schema gaps with compatibility safeguards, P2 clean narrative debt.

We choose Approach 3 because it minimizes ambiguity quickly while avoiding over-design and reducing breakage risk.

## Key Decisions
- **Decision 1: Prioritize operational truth over roadmap polish.**
  P0 focuses on wiring and exposing currently documented commands, plus README/usage/test parity.
- **Decision 2: Preserve backward compatibility for contract consumers.**
  P1 merge-policy schema support must accept both legacy and roadmap forms and normalize internally.
- **Decision 3: Treat governance/evidence claims as explicit capability gaps.**
  Preflight doc-drift + SHA checks and evidence model expansion are scoped as P1, not implied complete.
- **Decision 4: Separate implementation truth from strategy messaging.**
  P2 adds a status matrix and marks speculative roadmap items as planned.


## Success Criteria
- CLI help, dispatch, and README command index are mutually consistent for roadmap-critical commands.
- Existing contract consumers continue to work without schema migration breakage.
- New roadmap-aligned behaviors are explicitly marked as implemented vs planned.

## Non-Goals
- No full MCP orchestration rewrite in this iteration.
- No broad architecture refactor outside parity and governance gaps already identified.
- No breaking CLI rename; roadmap terminology is additive via alias only.

## Resolved Questions
- **Should we do all changes in one pass?** No. We will use P0/P1/P2 staging to reduce regression risk.
- **Should roadmap terminology be dropped or supported?** Supported via alias (risk-policy-gate -> policy-gate) for parity.
- **Should we break existing contract shape?** No. Compatibility is required.

## Open Questions
- None for brainstorm scope.

## Next Steps
→ /prompts:workflow-plan for implementation sequencing, task breakdown, and verification commands.
