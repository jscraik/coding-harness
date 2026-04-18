---
schema_version: 1
status: draft
applies_to:
  - coding-harness
  - linear-triage-control-plane
module: linear-triage-control-plane
date: 2026-04-08
problem_type: workflow
component: development
severity: high
applies_when:
  - coding-harness has a large triage queue and needs deterministic pull order
  - issue type labels drift from template intent across bug, feature, research, and automation work
symptoms:
  - triage work was manually prioritized and prone to context switching
  - issue labels were not consistently aligned with template-defined work types
root_cause: missing workflow step
resolution_type: workflow improvement
tags:
  - linear-triage
  - label-governance
  - coding-harness
  - workflow
last_validated: 2026-04-18
---

# Solution: Deterministic Linear Triage and Type-Label Governance

## Table of Contents
- [Problem](#problem)
- [Why It Happened](#why-it-happened)
- [Implemented Solution](#implemented-solution)
- [Verification Evidence](#verification-evidence)
- [Operational Runbook](#operational-runbook)
- [Prevention](#prevention)
- [Related Artifacts](#related-artifacts)

## Problem

`coding-harness` had a substantial queue of open Linear issues, but triage remained largely manual. This made pull order inconsistent, increased WIP thrash, and allowed issue type labels to drift away from template intent, reducing policy clarity for downstream automation and reviews.

## Why It Happened

The repository had strong Linear workflow guidance, but no single command that:

1. Calculates issue priority with a deterministic score.
2. Enforces lane-level WIP limits and dependency-aware transitions.
3. Applies or corrects type labels in a governed and testable way.

Without that executable control-plane step, triage quality depended on operator memory and ad hoc issue review cadence.

## Implemented Solution

The fix introduced a first-class Linear triage workflow in the harness command surface and wired policy enforcement into reusable library modules.

### 1. Added a dedicated triage command path

- Implemented triage execution in:
  - `src/commands/linear-triage.ts`
- Added dispatch and CLI registration in:
  - `src/lib/cli/command-registry.ts`
  - `src/lib/init/cli.ts`

This gives a deterministic entrypoint for rank/plan/apply behavior instead of ad hoc manual sequencing.

### 2. Encoded triage policy logic into testable modules

- Added scoring model:
  - `src/lib/linear/triage-scoring.ts`
- Added lane and WIP-cap enforcement:
  - `src/lib/linear/triage-lanes.ts`
- Added type-label governance/synchronization:
  - `src/lib/linear/triage-type-labels.ts`
- Extended Linear pagination/client behavior to support triage workloads:
  - `src/lib/linear/client.ts`

This separates policy logic from command wiring and keeps behavior deterministic under test.

### 3. Updated templates and operator docs to match executable policy

- Updated Linear templates:
  - `src/templates/linear/bug.md`
  - `src/templates/linear/feature.md`
  - `src/templates/linear/research.md`
  - `src/templates/linear/automation.md`
- Updated governance/operator docs:
  - `docs/agents/13-linear-production-workflow.md`
  - `docs/agents/16-linear-production-compact.md`
  - `docs/agents/19-linear-templates.md`
- Captured operational plan and source strategy:
  - `docs/plans/2026-04-08-feat-linear-triage-system-operationalization-plan.md`
  - this solution artifact (`Operational Runbook` + `Prevention`) as the durable strategy snapshot

### 4. Added regression coverage for command and policy behavior

- New/updated tests:
  - `src/commands/linear-triage.test.ts`
  - `src/lib/linear/triage-scoring.test.ts`
  - `src/lib/linear/triage-lanes.test.ts`
  - `src/lib/linear/triage-type-labels.test.ts`
  - `src/lib/linear/client.test.ts`
  - `src/cli-dispatch.test.ts`

## Verification Evidence

Validated in commit `684c514` with:

- successful test run across the repository (`vitest` suite passed; 131 files, 2187 tests passed, 9 skipped)
- successful `pnpm build`
- successful branch push and `main` push with required gate scripts completing

These results confirm both command wiring and policy modules integrate cleanly with existing CI/governance paths.

## Operational Runbook

Use this flow for each triage cycle:

1. Run the triage command in report mode to inspect score/rank/lane outcomes.
2. Confirm WIP caps and dependency readiness before any state mutation.
3. Apply controlled promotions from `Triage` to active states.
4. Ensure each active issue has one correct type label and one current `JSC-*` trace path.
5. Re-run triage after merges or cycle-boundary changes to keep ordering current.

## Prevention

- Keep triage policy executable, not doc-only.
- Require type-label normalization as part of every triage apply pass.
- Preserve lane caps and dependency checks as immutable gates unless explicitly revised in docs and tests together.
- Add tests for every new triage rule before enabling it in command behavior.

## Related Artifacts

- Plan: `docs/plans/2026-04-08-feat-linear-triage-system-operationalization-plan.md`
- Strategy source: this solution artifact (`Operational Runbook` + `Prevention`)
- Commit: `684c514` (`feat(linear): add triage workflow and label governance`)
- Related issue lane examples: `JSC-126`, `JSC-131`, `JSC-115`
