# Documentation layers

## Table of Contents

- [Purpose](#purpose)
- [Layer model](#layer-model)
- [Repo-facing surface (Layer 0)](#repo-facing-surface-layer-0)
- [Quickstart (Layer 1)](#quickstart-layer-1)
- [Core concepts (Layer 2)](#core-concepts-layer-2)
- [Extended governance reference (Layer 3)](#extended-governance-reference-layer-3)
- [Layer routing rules](#layer-routing-rules)
- [Adding new documentation](#adding-new-documentation)
- [Pruning and consolidation](#pruning-and-consolidation)

## Purpose

This document defines the progressive-disclosure model for Coding Harness documentation. Every doc in this repository belongs to exactly one layer. Agents and humans should load only the layers they need for the task at hand.

## Layer model

| Layer | Audience | Purpose | Token budget | Entry point |
| --- | --- | --- | --- | --- |
| **0 — Repo-facing** | All operators | Mandatory baseline: defaults, startup flow, routing | Minimal | `AGENTS.md` |
| **1 — Quickstart** | New users, new agents | Immediate execution without deep governance | Small | `docs/agents/quickstart.md` |
| **2 — Core concepts** | Active contributors | Operational SOPs, tooling contracts, workflow state machines | Medium | `docs/README.md` → task routing |
| **3 — Extended reference** | Maintainers, auditors | Deep governance specs, operational specs, rollout contracts | Large | `docs/agents/01-instruction-map.md` → deep links |

### Invariants

- Layer 0 is auto-discovered by Codex and must stay under 130 lines.
- Layer 1 is the first opened doc for task execution and must stay under 80 lines.
- No doc appears in more than one layer.
- Cross-layer links always point downward (0→1→2→3); never require loading a higher layer to execute a lower-layer task.
- Plans, specs, and ADRs are Layer 3.

## Repo-facing surface (Layer 0)

Single canonical file: **`AGENTS.md`**

Contents:
- Project description
- Mandatory workflow snippet
- Required essentials (runtime/toolchain, baseline gates)
- Startup workflow (4 steps)
- Quality check tiers
- Instruction routing table (compact link map)
- Memory layer reference
- Implementation conventions

What it does **not** contain:
- Detailed SOP steps
- State machine definitions
- Governance escalation procedures
- Tool version requirements
- CI provider details

## Quickstart (Layer 1)

Single canonical file: **`docs/agents/quickstart.md`**

Purpose: get any operator (human or agent) executing common workflows immediately without reading governance docs.

Contents:
- Prerequisites (2-line version check)
- Three hero workflows: install → validate → PR
- Common command reference (5 commands)
- Where to go next (Layer 2 routing)

## Core concepts (Layer 2)

These files define operational contracts for active contributors:

| File | Domain |
| --- | --- |
| `docs/agents/02-tooling-policy.md` | Tooling contracts, command reference |
| `docs/agents/04-validation.md` | Validation gates, check suites |
| `docs/agents/13-linear-production-workflow.md` | Linear issue lifecycle |
| `docs/agents/06-security-and-governance.md` | Security posture, secret handling |
| `docs/agents/08-release-and-change-control.md` | Release process |
| `docs/agents/03-local-memory.md` | Memory/LEARNINGS workflow |
| `docs/README.md` | Layer 2 index and routing |

## Extended governance reference (Layer 3)

Deep-dive operational specs, rollout contracts, and governance detail:

| Category | Files |
| --- | --- |
| Linear operations | `16-linear-production-compact.md`, `18-github-linear-automation.md`, `19-linear-templates.md` |
| Context integrity | `15-context-integrity-compact.md` |
| Review governance | `12-ai-review-governance.md`, `review-gate-*.md` |
| Testing gates | `10-agent-testing-gates.md`, `11-flaky-test-artifacts.md`, `agent-testing-gates-operational-spec.md` |
| Docs governance | `14-docs-gate-rollout.md`, `docs-gate-rollout-operational-spec.md` |
| Release governance | `release-change-control-operational-spec.md` |
| Architecture | `00-architecture-bootstrap.md` |
| Role governance | `07a-role-governance.md`, `07b-agent-governance.md` |
| Audit | `09-audit-trail-policy.md`, `05-contradictions-and-cleanup.md` |
| CI | `17-ci-required-checks.md` |
| Project Brain | `20-project-brain-memory-extension-rollout.md` |
| Plans & specs | `docs/plans/*`, `docs/specs/*` |
| ADRs | `docs/adr/*` |

## Layer routing rules

For agents:

1. Start at Layer 0 (`AGENTS.md`).
2. If executing a common workflow (install, validate, PR), read Layer 1 (`quickstart.md`).
3. If working on a specific domain (tooling, validation, Linear, security), open the single relevant Layer 2 file.
4. Open Layer 3 files only when the task requires operational spec detail, rollout contracts, or deep governance.
5. Never load more than one Layer 3 file per task unless explicitly cross-referencing.

For humans:

1. Start at `README.md` for product overview and install.
2. Use `docs/README.md` to navigate to the relevant section.
3. `docs/agents/` files are task-specific; open only what you need.

## Adding new documentation

1. Assign the new file to exactly one layer.
2. Layer 0 and Layer 1 files must stay within their line budgets.
3. Add cross-references in the parent layer's index.
4. Update `docs/agents/01-instruction-map.md` if the file is in Layer 2 or Layer 3.
5. Update `docs/README.md` if the file adds a new topical section.

## Pruning and consolidation

- If two Layer 3 files cover overlapping territory, merge into one.
- If a Layer 2 doc grows past 300 lines, extract deep detail into a Layer 3 companion.
- If a Layer 3 file is no longer referenced by any Layer 2 file, archive it.
- Review documentation layer assignments quarterly during governance cycles.
