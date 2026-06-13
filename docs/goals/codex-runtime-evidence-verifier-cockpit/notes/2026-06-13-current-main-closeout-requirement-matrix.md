---
schema_version: 1
doc_schema: coding-harness-doc/v1
doc_type: lifecycle
authority: supporting
canon_class: evidence
distribution: source-only
audience:
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-13
last_reviewed: 2026-06-13
review_cadence: on-change
maintenance_trigger:
  - goal-closeout-evidence-change
  - judge-pm-readiness-change
semver_impact: patch
validated_by:
  - jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl
  - python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .
  - python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit
  - node scripts/validate-goal-kanban-script.cjs .harness/implementation-notes/goal-kanban-board.html
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
  - git diff --check
depends_on:
  - docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
  - docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml
  - docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl
---

# Current-Main Closeout Requirement Matrix

## Table of Contents
- [Scope](#scope)
- [Current Verdict](#current-verdict)
- [Requirement Matrix](#requirement-matrix)
- [Blocked Lanes](#blocked-lanes)
- [Next Safe Action](#next-safe-action)
- [Validation Evidence](#validation-evidence)

## Scope

This artifact reconciles current `main` at
`f93229d434b801047df943accc390d98327aedd9` after PR #424 merged and was pulled
back. It does not claim Judge/PM readiness, release readiness, Linear
field-text currency, or parent-goal completion.

Inputs checked:

- `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
- `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml`
- `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md`
- `docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl`
- `.harness/active-artifacts.md`
- `.harness/implementation-notes/goal-kanban-board.html`
- `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
- `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md`

## Current Verdict

Implementation work appears complete enough that no new feature slice should start from this audit alone. Parent-goal completion is still blocked because the final proof lanes are not all satisfied.

Current blockers:

- Independent reviewer artifacts for the live PU-015 Judge/PM packet are missing.
- Linear JSC-363 field-text currency remains an owner or external-state blocker beyond route-alignment comment `81cfdd41-ff0e-4df1-b884-c01789e30a50`.
- Documentation accuracy is validated by current local gates, but final Judge/PM ratification has not accepted every PU/GAP/SPG row.
- The final Judge/PM-ready claim is not supported; the packet remains `status: blocked` with `blockerCode: missing_reviewer_artifact`.

## Requirement Matrix

| Requirement | Current Classification | Evidence | Meaning |
| --- | --- | --- | --- |
| PU-000 | Complete for intent/baseline proof; final closeout still depends on this matrix. | Historical intent and board receipts, plus current goal-board validator pass at R511/R512. | Do not reopen unless current-main evidence contradicts the baseline. |
| PU-001 through PU-008 | Implemented or historically receipt-backed; no current feature gap found in this audit. | Receipt search finds historical coverage across R005, R007, R012, R015, R017, R020, R026, and later schema/runtime receipts. | Treat as implemented provenance, not active work. |
| PU-009 through PU-011 | Implemented as review/external/delivery/root hygiene foundations, with PU-011 requiring final ratification because direct receipt-key search is indirect. | Focused closeout tests are referenced in `notes/execution-tracker.md`; current goal-board and docs-gate validators pass. | Do not start feature work; include PU-011 in Judge/PM ratification scope. |
| PU-012 | Implemented and merged as current-main producer proof. | Receipt search points to R363 and current route evidence keeps runtime-card selection on JSC-363. | No active implementation lane unless runtime-card regresses. |
| PU-013 | Implemented and current-main proof remains valid. | Runtime-card validator passed on current main: `runtime-card --json --repo .` selects JSC-363 active spec and plan. | Runtime cockpit projection is not reopened. |
| PU-014 | Implementation evidence exists for PR/CI/review/root/delivery surfaces, but final closeout remains blocked by Linear field-text and reviewer-artifact lanes. | PR #413 through PR #424 provenance, R511, and current packet. | This is closeout proof work, not a new product implementation slice. |
| PU-015 | Generated and blocked. | `notes/2026-06-12-pu015-live-judge-pm-audit-packet.json` is current at PR #424/R511 and remains blocked on `missing_reviewer_artifact`. | The next safe work is reviewer-artifact disposition and final audit, not feature coding. |
| PU-016 | Partially satisfied by current docs/tracker validators; final documentation and instruction accuracy require Judge/PM acceptance. | `docs-gate`, goal-board, Kanban script, audit-freshness, and `git diff --check` pass after the post-PR424 refresh. | Keep documentation accuracy as a closeout lane until Judge/PM accepts the matrix. |
| GAP-001 through GAP-012 | Adopted and substantially implemented through prior lifecycle slices; final acceptance remains Judge/PM-classified rather than self-approved. | Goal gap table, receipts including R117/R130/R181/R245, and current R511/R512 freshness. | No new feature slice is selected by this audit; unresolved acceptance is proof/ratification, not discovered missing code. |
| SPG-001 through SPG-012 | Adopted into the goal and substantially represented by runtime packet/schema/receipt work; final acceptance remains Judge/PM-classified. | System-prompt gap table, receipts R182/R189 and later runtime/evidence receipts. | Do not copy system prompt internals; final audit must classify acceptance or owner-accepted follow-up. |
| Codex-native current-main refinement addendum | Implemented across current-main refinement slices where evidence exists; final acceptance remains blocked by PU-015 proof lanes. | Goal addendum rows and merged PR provenance through PR #424. | No current implementation lane selected unless Judge/PM identifies a concrete missing addendum row. |
| Audit freshness | Passing. | `check-goal-audit-freshness.py` selects current receipt anchored to `f93229d4`. | Audit source hash is current for this closeout pass. |
| Goal board and Kanban tracker | Passing. | `check-goal-board.py` and `validate-goal-kanban-script.cjs` pass after the R511/R512 refresh. | The route tracker is usable as the next operator surface. |
| Delivery-truth separation | Preserved. | Packet and tracker continue to separate local validation, PR truth, CI truth, review truth, Linear truth, and merge readiness. | No merge-ready or parent-complete claim is made from local validation alone. |

## Blocked Lanes

| Lane | Blocker | Owner / Authority | Required Disposition |
| --- | --- | --- | --- |
| Independent reviewer artifacts | Required artifacts for `adversarial-reviewer`, `agent-native-reviewer`, and `best-practices-researcher` are missing from the live PU-015 packet. | Review swarm / coordinator. | Collect current artifacts or record explicit blocker evidence after one focused retry. |
| Linear field-text currency | Current repo-truth comment exists, but live field text has not been fetched, updated, or owner-accepted as historical. | Linear owner / coordinator with Linear access. | Refresh Linear fields or record owner acceptance/blocker. |
| Final Judge/PM readiness | Packet is current but blocked. | Judge/PM closeout authority. | Rerun Judge/PM packet only after reviewer and Linear dispositions are resolved or explicitly blocked. |
| Parent goal completion | Completion contract requires accepted PU/GAP/SPG classification. | Goal owner / Judge/PM. | Accept this matrix, request a concrete missing row repair, or mark the goal blocked with current evidence. |

## Next Safe Action

Run one bounded closeout slice:

1. Collect or explicitly block the three independent reviewer artifacts for the current PU-015 packet.
2. Refresh Linear JSC-363 field text or record owner acceptance/blocker.
3. Rerun the Judge/PM packet and this requirement matrix.
4. If every lane is accepted, prepare the final goal closeout claim. If any lane remains blocked, mark the parent goal blocked with current evidence instead of starting another feature slice.

## Validation Evidence

The post-PR424 tracker repair passed:

- `jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/notes/2026-06-12-pu015-live-judge-pm-audit-packet.json >/dev/null`
- `jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl >/dev/null`
- `python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`
- `python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
- `node scripts/validate-goal-kanban-script.cjs .harness/implementation-notes/goal-kanban-board.html`
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
- `git diff --check`
