# Linear Templates and Saved Views

## Table of Contents

- [Purpose](#purpose)
- [Blocked-routing convention](#blocked-routing-convention)
- [Issue templates](#issue-templates)
- [Saved views](#saved-views)
- [Linear UI setup (manual steps)](#linear-ui-setup-manual-steps)
- [Validation checklist](#validation-checklist)

## Purpose

Define the baseline Linear templates and saved views for the `coding-harness`
project and `Jscraik` team, and capture the blocked-routing decision so it is
consistent and agent-readable.

Template source files live in `src/templates/linear/` and are the authoritative
copy — always edit there first, then paste into Linear UI.

## Blocked-routing convention

**Decision:** `Blocked` stays a **label**, not a workflow status.

### Why

- A blocked issue still has a real primary state (`Todo`, `In Progress`, `In Review`).
- A separate status would overload the workflow with a special case.
- Linear's native `blockedBy` / `blocks` relations carry the dependency graph.
- The `Blocked` label provides visibility and a consistent saved-view filter.

### Protocol

When work cannot proceed:

1. Keep the issue in its real workflow state.
2. Add the `Blocked` label.
3. Add a `blockedBy` relation to the blocking issue when one exists.
4. Add a short blocker note in the latest update or comment.

> [!NOTE]
> Remove the `Blocked` label as soon as the blocker resolves — do not leave
> stale labels on issues that are actively progressing.

## Issue templates

Template files are in `src/templates/linear/`. Each is copy-paste-ready for
Linear → Settings → Team: Jscraik → Templates.

| Template | File | Key sections |
|---|---|---|
| Bug | `src/templates/linear/bug.md` | Goal, Label type, Reproduction, Expected, Actual, Triage inputs, Dependencies, Pull condition, Evidence, Risk, Done when |
| Feature | `src/templates/linear/feature.md` | Goal, Label type, User value, Scope, Constraints, Triage inputs, Dependencies, Pull condition, Evidence, Done when |
| Research | `src/templates/linear/research.md` | Question, Label type, Why now, Inputs, Triage inputs, Dependencies, Pull condition, Output, Recommendation format, Done when |
| Automation | `src/templates/linear/automation.md` | Goal, Label type, Trigger/cadence, Systems, Safety, Triage inputs, Dependencies, Pull condition, Evidence/logs, Done when |
| Release | `src/templates/linear/release.md` | Goal, Scope, Risks, Validation plan, Rollback plan, Done when |

Type-label baseline for this project:

- issue type labels should come from `Bug`, `Feature`, `Improvement`, `Policy`, `Security`
- each issue should carry exactly one primary type label
- `harness linear triage --apply` will add missing primary type labels and normalize multiple primary labels down to one inferred label

## Saved views

Create these in **Linear → My Views** or **Team Views** for `Jscraik`.

### 1. Triage

Filter:
- Team = `Jscraik`
- Status in `Backlog`, `Todo`
- Assignee is empty **or** created in last 7 days (newly arrived work)

### 2. Ready

Filter:
- Team = `Jscraik`
- Status = `Todo`
- Label does **not** include `Blocked`

### 3. In Progress

Filter:
- Team = `Jscraik`
- Status = `In Progress`

### 4. In Review

Filter:
- Team = `Jscraik`
- Status = `In Review`

### 5. Blocked

Filter:
- Team = `Jscraik`
- Label includes `Blocked`

### 6. Delegated

Filter:
- Team = `Jscraik`
- Label includes `Agent`
- Status in `Todo`, `In Progress`, `In Review`

## Linear UI setup (manual steps)

These cannot be configured via API — do them once in Linear.

### Issue templates

1. Go to **Linear → Settings → Team: Jscraik → Templates**
2. Click **New template** for each entry in the table above
3. Set the name exactly as shown (Bug / Feature / Research / Automation / Release)
4. Paste the content from the matching `src/templates/linear/<name>.md` file

### Saved views

1. Go to **Linear → My Views** (or **Team Views → Jscraik**)
2. Create each view with the filters listed above
3. Name them exactly: Triage / Ready / In Progress / In Review / Blocked / Delegated

> [!TIP]
> Pin the **In Progress** and **In Review** views to the sidebar for quick
> access during daily stand-up or agent handoff checks.

## Validation checklist

- [ ] Templates exist in Linear for Bug, Feature, Research, Automation, Release
- [ ] Template content matches `src/templates/linear/*.md` (single source of truth)
- [ ] Six saved views created and named consistently
- [ ] `Blocked` label exists in team label set
- [ ] Primary type labels exist in team label set: `Bug`, `Feature`, `Improvement`, `Policy`, `Security`
- [ ] Blocked-routing protocol documented in onboarding notes

## See also

- [GitHub → Linear automation](./18-github-linear-automation.md)
- [Linear production workflow](./13-linear-production-workflow.md)
- [Linear workflow compact](./16-linear-production-compact.md)
- [JSC-35 baseline doc (Linear native)](https://linear.app/jscraik/document/coding-harness-linear-templates-and-views-baseline-1e8adadc1ae1)
