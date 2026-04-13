# Linear Templates and Saved Views

## Table of Contents

- [Purpose](#purpose)
- [Workflow boundary](#workflow-boundary)
- [Blocked-routing protocol](#blocked-routing-protocol)
- [Issue templates](#issue-templates)
- [Saved views](#saved-views)
- [Linear UI setup (manual steps)](#linear-ui-setup-manual-steps)
- [Validation checklist](#validation-checklist)
- [See also](#see-also)

## Purpose

Define the baseline Linear templates and saved views for the `coding-harness`
project and `Jscraik` team.

Template source files in `src/templates/linear/` are the authoritative copy:
edit those files first, then paste into Linear UI.

## Workflow boundary

This document is for Linear setup payloads only (templates, views, labels, and
blocked-routing protocol). Canonical lane/state workflow behavior lives in:

- [Linear production workflow](./13-linear-production-workflow.md)
- [Linear workflow compact](./16-linear-production-compact.md)

## Blocked-routing protocol

`Blocked` stays a label overlay, not a workflow status.

When work cannot proceed:

1. Keep the issue in its canonical workflow state.
2. Add the `Blocked` label.
3. Add a `blockedBy` relation to the blocking issue when one exists.
4. Add a short blocker note in the latest update or comment.

Remove the `Blocked` label as soon as the blocker resolves.

## Issue templates

Template files are in `src/templates/linear/`. Each is copy-paste-ready for
Linear -> Settings -> Team -> Templates.

| Template | File |
| --- | --- |
| Bug | `src/templates/linear/bug.md` |
| Feature | `src/templates/linear/feature.md` |
| Research | `src/templates/linear/research.md` |
| Automation | `src/templates/linear/automation.md` |
| Release | `src/templates/linear/release.md` |

Primary type-label baseline:

- Use exactly one of `Bug`, `Feature`, `Improvement`, `Policy`, `Security`.
- `harness linear triage --apply` can add missing primary type labels and
  normalize multiple primary labels down to one inferred label.

## Saved views

Create these in Linear -> My Views or Team Views for `Jscraik`.

| View | Filters |
| --- | --- |
| Triage | Team = `Jscraik`; Status in `Backlog`, `Todo`; Assignee empty or created in last 7 days |
| Ready | Team = `Jscraik`; Status = `Todo`; Label does not include `Blocked` |
| In Progress | Team = `Jscraik`; Status = `In Progress` |
| In Review | Team = `Jscraik`; Status = `In Review` |
| Blocked | Team = `Jscraik`; Label includes `Blocked` |
| Delegated | Team = `Jscraik`; Label includes `Agent`; Status in `Todo`, `In Progress`, `In Review` |

## Linear UI setup (manual steps)

These cannot be configured via API.

### Issue templates

1. Go to Linear -> Settings -> Team -> Templates.
2. Create Bug, Feature, Research, Automation, and Release templates.
3. Paste content from the matching file in `src/templates/linear/`.

### Saved views

1. Go to Linear -> My Views or Team Views.
2. Create each view from the table above with exact names.

## Validation checklist

- [ ] Templates exist in Linear for Bug, Feature, Research, Automation, Release
- [ ] Template content matches `src/templates/linear/*.md`
- [ ] Six saved views exist and names match this document
- [ ] `Blocked` label exists in the team label set
- [ ] Primary type labels exist: `Bug`, `Feature`, `Improvement`, `Policy`, `Security`
- [ ] Blocked-routing protocol is documented in onboarding notes

## See also

- [GitHub -> Linear automation](./18-github-linear-automation.md)
- [Linear production workflow](./13-linear-production-workflow.md)
- [Linear workflow compact](./16-linear-production-compact.md)
- [JSC-35 baseline doc (Linear native)](https://linear.app/jscraik/document/coding-harness-linear-templates-and-views-baseline-1e8adadc1ae1)
