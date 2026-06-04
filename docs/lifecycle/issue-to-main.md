---
doc_schema: coding-harness-doc/v1
doc_type: lifecycle
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - human-operator
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - issue-lifecycle-change
  - pr-closeout-change
  - feedback-loop-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - AGENTS.md
  - docs/agents/13-linear-production-workflow.md
  - .harness/README.md
  - .github/PULL_REQUEST_TEMPLATE.md
---

# Lifecycle Harness

## Table of Contents

- [Purpose](#purpose)
- [Lifecycle](#lifecycle)
- [Truth lanes](#truth-lanes)
- [Feedback loop](#feedback-loop)
- [Documentation lifecycle](#documentation-lifecycle)
- [Distribution boundary](#distribution-boundary)
- [SemVer policy](#semver-policy)
- [Validation](#validation)

## Purpose

This document defines the canonical issue-to-main operating model inside
synAIpse, the AI Delivery Harness currently implemented by the coding-harness
repository.

The short form is:

1. Linear issue
2. Spec
3. Plan
4. Implement
5. Pre-commit and local validation
6. Review
7. Commit and open or update the PR
8. Poll the PR
9. Review the PR with Codex review and CodeRabbit
10. Ensure required checks are green
11. Merge to main
12. Checkout main and pull latest changes

Lifecycle Harness does not treat that as one undifferentiated checklist. It keeps
each stage evidence-backed, separates truth lanes, and routes feedback back
into the smallest durable surface that prevents repeat work.

## Lifecycle

| Stage | Source of truth | Lifecycle Harness responsibility | Exit evidence |
| --- | --- | --- | --- |
| Linear issue | Linear | Preserve issue key, scope, status, and relationship to specs or plans | Linked issue reference and acceptance trace |
| Spec | Harness specs, docs specs, or approved issue text | Convert intent into bounded requirements and acceptance criteria | Spec path or explicit n.a. reason |
| Plan | Harness plan, docs plans, or PR work ledger | Sequence implementation, validation, risk, and rollback | Plan path, slice, or explicit n.a. reason |
| Implement | Source tree | Make the smallest scoped change that satisfies the plan | Changed files and affected-surface classification |
| Pre-commit | Local repo | Run narrow proof first, then required local gates for the touched surface | Exact command outcomes |
| Review | Local review artifacts and PR review tools | Separate self-check, independent review, CodeRabbit, and Codex review | Review artifact refs or blocked reason |
| Commit | Git | Keep the change atomic, branch-scoped, and traceable | Commit hash and branch state |
| PR | GitHub | Open or update the PR with complete evidence fields | PR URL and completed template |
| Poll PR | GitHub and CI | Re-check current PR state instead of trusting stale summaries | Current PR status, checks, and review-thread state |
| Green checks | CircleCI, CodeRabbit, Semgrep Cloud, GitHub checks | Treat every required check as its own lane | Current green check evidence |
| Merge | GitHub | Merge only when local, PR, CI, review, tracker, and merge-readiness lanes agree | Merge commit and closed PR |
| Main sync | Git | Checkout main, pull latest, and remove or archive the completed worktree or branch | Main at latest origin state |

## Truth lanes

Lifecycle Harness keeps these lanes separate:

For the detailed lane contract, see [truth lanes](./truth-lanes.md). For the
claim-family authority rules that decide what each lane can prove, see
[claim authority](../domain/claim-authority.md).

- Local code and tests: what the checkout proves.
- PR state: what GitHub says about the open pull request.
- CI checks: what required check providers currently report.
- Review threads: whether CodeRabbit, Codex review, and human review feedback is resolved or waived.
- Tracker state: what Linear says about the issue and remaining scope.
- Artifact evidence: what tracked receipts, runtime cards, evals, screenshots, or reports prove.
- Merge readiness: whether branch protection and repository policy allow merge now.
- Post-merge state: whether main is checked out and updated after merge.
- Learning state: whether repeated feedback became a durable rule, guard, test, skill, memory entry, or tracked exception.

One lane does not prove another. A green local test run does not prove CI passed.
A resolved review comment does not prove the Linear issue is done. A merged PR
does not prove the local worktree is back on main.

## Feedback loop

The feedback loop fits around every stage, not after the whole cycle.

For durable feedback admission and routing rules, see
[feedback loop](./feedback-loop.md).

Feedback sources include:

- Linear clarification or scope change.
- Spec or plan gaps.
- Failed local validation.
- Pre-commit or hook failures.
- Codex review findings.
- CodeRabbit findings.
- Human review comments.
- CI failures.
- Repeated user steering.
- Repeated command or tooling failures.
- Post-merge drift or follow-up issues.

When feedback appears, Lifecycle Harness classifies it:

| Feedback class | Durable destination |
| --- | --- |
| One-off implementation detail | Current plan, PR body, or implementation note |
| Repeated steering | AGENTS.md, codestyle, validator, Project Brain, skill, or tracked exception |
| Deterministic policy gap | Guard script, schema, docs-gate, or CLI validator |
| Workflow ambiguity | Lifecycle doc, Linear workflow doc, PR template, or harness command output |
| Review pattern | Test fixture, CodeRabbit learning import, north-star feedback loop, or reviewer role instruction |
| Downstream setup risk | Template, packaged skill, harness init or upgrade regression test |

The goal is not to capture every comment forever. The goal is to make the next
occurrence cheaper, clearer, or impossible to miss.

## Documentation lifecycle

Documentation participates in the same lifecycle:

| State | Meaning |
| --- | --- |
| proposed | Drafted but not yet accepted as operating truth |
| experimental | Used in limited scope while the model is being tested |
| active | Current source of truth for its declared scope |
| deprecated | Still present, but planned for replacement or removal |
| superseded | Replaced by a named newer surface |
| archived | Historical evidence, not current instruction |

Every governed document declares its owner, audience, review cadence,
dependencies, lifecycle state, distribution boundary, and SemVer impact in
frontmatter. The manifest at docs/doc-lifecycle-manifest.json is the index for
those declarations.

## Distribution boundary

This document is source-only. It should explain synAIpse itself, but it
must not be copied into downstream projects by harness init or harness upgrade.

Downstream projects should receive only the thin surfaces they need:

- Project-local AGENTS.md
- Harness-managed scripts and checks
- Packaged coding-harness skill
- Generated or scaffolded docs that are intentionally downstream-facing

Source-only governance docs may influence those outputs, but templates must not
reference source-only docs under docs/ or .agents/ directly.

## SemVer policy

Documentation changes can affect SemVer when they change a contract that users
or agents rely on.

| Change | Default SemVer impact |
| --- | --- |
| Typo or clarification in source-only docs | patch |
| New source-only governance model | minor |
| Packaged skill behavior or command guidance change | minor |
| Downstream template contract change | minor |
| Removal or incompatible change to downstream scaffold expectations | major |
| Historical archive only | none |

PR closeout must classify documentation lifecycle impact and SemVer impact so
reviewers can tell whether a documentation change is local explanation,
packaged agent behavior, or downstream project contract.

## Validation

Run pnpm docs:lifecycle.

docs-gate also checks lifecycle metadata when governed documents, the manifest,
schema, or downstream templates change.
