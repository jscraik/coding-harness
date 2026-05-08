---
schema_version: 1
artifact_id: jsc-288-governance-trust-repair-solution
artifact_type: he-compound-solution
canonical_slug: jsc-288-governance-trust-repair
title: JSC-288 Governance Trust Proof
harness_stage: he-compound
date: 2026-05-08
status: solved
traceability_required: true
origin: .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
domain: governance
owner: agent-ops
freshness_review: 2026-06-08
project_brain_status: updated
project_brain_evidence:
  source: ".harness/solutions/2026-05-08-jsc-288-governance-trust-repair-solution.md"
  target: ".harness/knowledge/governance/knowledge.md"
  reason: "Governance trust proof changed the PR evidence and HE eval closeout contract."
---

# JSC-288 Governance Trust Proof

## Table Of Contents

- [Problem](#problem)
- [Resolution](#resolution)
- [Evidence](#evidence)
- [Reusable Rule](#reusable-rule)
- [Maintenance](#maintenance)
- [Project Brain Sync](#project-brain-sync)

## Problem

JSC-288 exposed two related trust failures:

1. PR closeout evidence could treat bootstrap `memory.json` shape as memory
   proof even though the current operational memory surface is Project Brain,
   `.harness/memory/LEARNINGS.md`, and north-star learning-loop evidence.
2. The first JSC-288 eval artifact was useful prose, but failed the canonical
   `he-eval-report` validator because it did not carry the required closeout
   sections, gate matrix, drift classifications, side-effect authorization
   fields, and Linear backlink fields.

Both failures are false-confidence problems: they make the repository look
governed while future agents cannot reliably prove what is current, executable,
or safe to close.

## Resolution

JSC-288 now treats current executable evidence as the trust boundary:

- `.github/PULL_REQUEST_TEMPLATE.md` uses
  `pnpm exec tsx src/cli.ts tooling-audit --path . --json` as the required
  local Project Brain/memory-extension proof.
- The previous required `memory.json` shape proof was removed from the PR
  template.
- `docs/agents/20-project-brain-memory-extension-rollout.md` now marks itself
  as reference context and points to live authority surfaces.
- The eval report was renamed onto the JSC-288 canonical slug and expanded to
  satisfy the canonical `he-eval-report` contract.
- Spec, plan, refactor, and Linear-plan backlinks now point at the canonical
  eval path.

## Evidence

- Linear parent: `JSC-288`.
- Spec:
  `.harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md`
- Plan:
  `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md`
- Eval:
  `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`
- Review artifacts:
  `.harness/review/2026-05-08-JSC-288-governance-truth-inventory.md`,
  `.harness/review/2026-05-08-JSC-288-memory-ownership-decision.md`,
  `.harness/review/2026-05-08-JSC-288-contract-ownership-map.md`,
  `.harness/review/2026-05-08-JSC-288-required-trust-evidence-repair.md`,
  `.harness/review/2026-05-08-JSC-288-governance-prose-compression.md`
- Local commits:
  `d17e3abd docs(harness): add JSC-288 governance trust artifacts`,
  `433522a3 docs(evals): align JSC-288 eval report contract`

Validation rerun after the eval repair:

- `python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/skills/he-eval-report/scripts/validate_eval_report.py .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`
  passed.
- `pnpm exec markdownlint-cli2 .harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md .harness/linear/coding-harness-linear-plan.md .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md .harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md .harness/refactors/governance-contract-memory-simplification.md`
  passed.
- `pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json`
  passed.

## Reusable Rule

Governance trust proof must be executable, current, and validator-clean.
Future agents must not accept:

1. bootstrap placeholder files as proof of current operational memory;
2. prose-only evals as closure proof when a canonical evaluator exists;
3. stale spec, plan, refactor, or Linear-plan backlinks after an artifact is
   renamed onto its canonical slug.

For JSC-288-style work, closure proof requires:

1. a source-truth command that inspects the current governance/memory contract;
2. a canonical HE eval report that passes `validate_eval_report.py`;
3. identity, frontmatter, and Linear traceability lints for the traceable
   spec/plan/eval chain;
4. human review before Linear closure when governed PR-template or instruction
   surfaces changed.

## Maintenance

Owner: agent-ops.

Refresh this solution if PR evidence routing changes, Project Brain memory
proof moves away from `tooling-audit`, the HE eval-report contract changes, or
the repository adopts a different durable operational memory surface.

## Project Brain Sync

Status: updated.

Target:

- `.harness/knowledge/governance/knowledge.md`
- `.harness/knowledge/governance/rules.md`
- `.harness/knowledge/INDEX.md`

Reason:

JSC-288 changes the governance trust contract: memory proof must exercise the
current Project Brain / learning-loop surface, and closure evals must validate
against the canonical HE eval-report contract before Linear closure.
