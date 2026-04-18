# Triage Inbox SLA and Deterministic Routing Policy

**Issue:** JSC-191
**Status:** Active
**Owner:** coding-harness-maintainers

## Purpose

Define a strict triage contract so `Triage` is treated as an inbox lane — not a long-term storage lane.

## SLA Thresholds

| Signal | Threshold | Action |
| --- | --- | --- |
| Triage decision window | 48 hours | Issue must be routed to a target lane |
| Triage warning | 36 hours | Soft alert: approaching SLA breach |
| Triage breach | > 48 hours | Escalation: comment + flag for manual review |

## Required Fields Before Exiting Triage

No non-terminal issue may exit Triage without all of the following:

| Field | Description |
| --- | --- |
| `priority` | Urgent (1), High (2), Normal (3), Low (4) |
| `roadmapLabel` | `Roadmap: Now`, `Roadmap: Next`, or a lane label (A–F) |
| `assignee` | Assigned owner or delegate |
| `projectLink` | Linked to a Linear project |

If any field is missing, the issue bounces back to Triage with a comment listing the missing fields and the metadata completeness percentage.

## Routing Decision Tree

```
Triage → Duplicate?          → Canceled (with duplicate reference)
Triage → Out of scope?       → Canceled (with scope rationale)
Triage → Metadata incomplete?→ Bounce back to Triage (blocked, list missing fields)
Triage → Score pull_now?     → In Progress (if capacity + deps allow)
                              → Todo (if cap reached or deps unresolved)
Triage → Score next_pull?    → Todo (ready queue)
Triage → Score triage_hold?  → Backlog
Triage → Score backlog_or_rescope? → Backlog (with rescope recommendation)
```

## Agent-Safe Fallback

When an agent encounters a triage item with incomplete metadata:

1. Run `validateTriageExitMetadata()` to identify missing fields.
2. Generate a bounce comment with `buildTriageBounceComment()`.
3. Post the comment and leave the issue in Triage.
4. Do **not** promote the issue until all required fields are resolved.

This ensures both manual and agent flows produce the same pass/fail behavior.

## Implementation

The routing policy is implemented in `src/lib/linear/triage-sla.ts`:

- `validateTriageExitMetadata()` — required-field gate
- `routeTriageIssue()` — deterministic routing decision tree
- `checkTriageSla()` — SLA breach detection
- `buildTriageBounceComment()` — agent-safe bounce comment generation

## Validation Evidence

```bash
pnpm vitest run src/lib/linear/triage-sla.test.ts
# 23 tests passing
```

## Acceptance Criteria Tracking

- [x] Explicit SLA for triage decisions (48h)
- [x] Routing decision tree for all target lanes
- [x] Required fields validated before exiting Triage
- [x] Team runbook documented and referenced from AGENTS workflow
