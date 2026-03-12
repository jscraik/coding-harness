# Linear Production Workflow — Agent-Optimized Contract

> **Purpose:** Token-efficient, operationally unambiguous workflow for Linear-tracked work.
> **Source:** [13-linear-production-workflow.md](./13-linear-production-workflow.md)

## Table of Contents

- [Abbreviations](#abbreviations)
- [Operating Model](#operating-model)
- [Issue Lifecycle State Machine](#issue-lifecycle-state-machine)
- [Command Surface](#command-surface)
- [Intake Rules](#intake-rules)
- [Label Taxonomy](#label-taxonomy)
- [System Boundaries](#system-boundaries)
- [Definition of Done](#definition-of-done)

---

## Abbreviations

| Abbr | Full |
|------|------|
| LI | Linear Issue |
| LK | Linear Key (e.g., `JSC-37`) |
| PR | Pull Request |
| CH | coding-harness |
| LPW | Linear Production Workflow |

---

## Operating Model

| System | Role |
|--------|------|
| **Linear** | System of record: intake, ownership, prioritization, status |
| **GitHub** | Source of truth: branches, PRs, CI, reviews, merge history |
| **CH** | Execution engine: validation, evidence, handoff enforcement |

**Key constraint:** GitHub Issues are NOT the default intake path.

---

## Issue Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Triage ──► Ready ──► In Progress ──► In Review ──► Done           │
│                           │              │                          │
│                           ▼              │                          │
│                        Blocked ◄─────────┘                          │
│                           │                                         │
│                           └──► Delegated                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### State Transitions

| From | To | Trigger | Agent Action |
|------|-----|---------|--------------|
| Triage | Ready | Triaged, scoped | `harness linear prepare --issue <LK>` |
| Ready | In Progress | Branch created | `harness linear claim --issue <LK> --branch <name>` |
| In Progress | In Review | PR opened | `harness linear handoff --issue <LK> --pr-url <url>` |
| In Review | Done | PR merged | `harness linear close --issue <LK> --pr-url <url>` |
| In Review | In Progress | PR closed without merge | `harness linear claim --issue <LK> --state "In Progress" --no-assign` |
| * | Blocked | External dependency | Label `Blocked`, record unblock action |
| Blocked | In Progress | Unblocked | Remove `Blocked`, resume work |
| * | Delegated | Handed off | Assign to delegate, record context |

---

## Command Surface

### Quick Reference

```bash
# Generate branch/PR metadata from issue
harness linear prepare --issue <LK> --field branch

# Enforce contract policy (CI/local)
harness linear-gate --branch <name> --pr-title <title> --pr-body <body>

# Claim issue + create branch
harness linear claim --issue <LK> --branch <name> [--workspace <path>]

# Handoff to review
harness linear handoff --issue <LK> --pr-url <url> [--evidence-url <url>]

# Close after merge
harness linear close --issue <LK> --pr-url <url>
```

### Command Contracts

| Command | Purpose | Required Inputs | Side Effects |
|---------|---------|-----------------|--------------|
| `prepare` | Generate metadata | `--issue <LK>` | None (stdout only) |
| `linear-gate` | Policy enforcement | `--branch`, `--pr-title`, `--pr-body` | Exit code 0/1 |
| `claim` | Assign + branch | `--issue`, `--branch` | LI→In Progress, assignment |
| `handoff` | Move to review | `--issue`, `--pr-url` | LI→In Review, comment posted |
| `close` | Close after merge | `--issue`, `--pr-url` | LI→Done, comment posted |

Automation lane:
- `.github/workflows/linear-pr-sync.yml` runs on `pull_request` events (`opened`, `reopened`, `closed`) and mirrors lifecycle changes into Linear when `LINEAR_API_KEY` is available.
- It fails closed on ambiguous metadata (more than one Linear key in title/body/branch) and skips when no key is present.

### Output Formats

| Field | Format | Example |
|-------|--------|---------|
| Branch | `codex/<LK>-<slug>` | `codex/jsc-37-enable-linear-automation` |
| PR Title | `<LK>: <title>` | `JSC-37: Enable Linear automation` |
| Link Line | `Refs <LK>` | `Refs JSC-37` |
| Close Line | `Fixes <LK>` | `Fixes JSC-37` |

### Policy Gates (`linear-gate`)

| Check | Requirement |
|-------|-------------|
| `bugs.url` | Points to Linear project |
| `ISSUE_TEMPLATE/config.yml` | Retires GitHub Issues, points to Linear |
| Branch name | `codex/` prefix + LK present |
| PR title | LK present |
| PR body | `Refs <LK>` OR `Fixes <LK>` |

---

## Intake Rules

```
IF reproducible bug/feature/policy-gap/workflow-regression/automation/release:
  CREATE or UPDATE Linear issue
  INCLUDE: repro steps, expected vs actual, evidence, doc links
  LINK: PR/branch/commit once implementation starts

IF matching active/historical issue exists:
  REUSE instead of creating new

IF cross-project:
  MAY track outside coding-harness project
ELSE:
  MUST track in coding-harness project
```

---

## Label Taxonomy

### Core Labels

| Label | Use |
|-------|-----|
| `Bug` | Defects, regressions |
| `Feature` | New capabilities |
| `Improvement` | Enhancements to existing |
| `Docs` | Documentation changes |
| `Research` | Investigation, spikes |
| `Refactor` | Code restructuring |
| `Infra` | Infrastructure, CI |
| `Chore` | Maintenance, deps |
| `Security` | Security-relevant |

### Workflow Labels

| Label | Use |
|-------|-----|
| `Blocked` | External dependency |
| `Automation` | Bot/CI work |
| `Policy` | Governance changes |
| `Agent` | Agent-specific work |
| `Release` | Release milestones |

---

## System Boundaries

| Concern | System |
|---------|--------|
| Intake, ownership, status | Linear |
| PR discussion, CI, reviews, merge | GitHub |
| Durable technical detail | `docs/`, `todos/` |

**Rule:** Do not duplicate verbose/volatile detail in tracker fields — link to repo docs.

---

## Definition of Done

Before `In Review`:

```
□ Linked branch/PR exists
□ pnpm lint ✓
□ pnpm typecheck ✓
□ pnpm test ✓
□ pnpm audit ✓
□ pnpm check ✓
□ CI gates pass (including docs-gate)
□ Evidence attached/summarized
□ Blockers/risks explicit
□ Reviewer can continue without re-deriving context
```

Before `Done`:

```
□ PR merged
□ Required checks passed
□ `Fixes <LK>` in PR body (for auto-close)
  OR manual `harness linear close` executed
□ If PR closed without merge: issue moved back to active state with rationale
```

---

## Cross-References

- Full workflow: [13-linear-production-workflow.md](./13-linear-production-workflow.md)
- Agent governance: [07b-agent-governance.md](./07b-agent-governance.md)
- Validation gates: [04-validation.md](./04-validation.md)
