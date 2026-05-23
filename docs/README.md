---
last_validated: 2026-04-18
---

# Docs Index

> Documentation is organized into progressive layers. See [documentation layers](./architecture/documentation-layers.md) for the full model.

## Layer 0 — Repo-facing baseline

- [Root README](../README.md) — product overview, install, workflows
- [Root AGENTS](../AGENTS.md) — mandatory operator baseline
- [Root architecture](../ARCHITECTURE.md) — source map, boundaries, invariants

## Layer 1 — Quickstart

- [Quickstart](./agents/quickstart.md) — immediate execution without governance detail

## Layer 2 — Core concepts

### Tooling and validation

- [Tooling policy](./agents/02-tooling-policy.md) — command contracts, required baseline
- [Validation](./agents/04-validation.md) — gate planning and check suites
- [Security and governance](./agents/06-security-and-governance.md) — security posture, secret handling
- [CI responsibility matrix](./ci-responsibility-matrix.md)

### Workflows

- [Linear production workflow](./agents/13-linear-production-workflow.md) — issue lifecycle, states, transitions
- [Release and change control](./agents/08-release-and-change-control.md) — release process
- [Local memory](./agents/03-local-memory.md) — LEARNINGS.md, Local Memory CLI state machine
- [Advanced workflows](./advanced-workflows.md)
- [Linear sync](./linear-sync.md)

### Reference

- [CLI reference](./cli-reference.md)
- [AI assistant security policy](./ai-assistant-security-policy.md)

## Layer 3 — Extended governance reference

- [Instruction map](./agents/01-instruction-map.md) — full task routing and deep links
- [Quality score](./QUALITY_SCORE.md)
- [Agent testing gates](./agents/10-agent-testing-gates.md) + [ops spec](./agents/agent-testing-gates-operational-spec.md)
- [Flaky test artifacts](./agents/11-flaky-test-artifacts.md)
- [Docs-gate rollout](./agents/14-docs-gate-rollout.md) + [ops spec](./agents/docs-gate-rollout-operational-spec.md)
- [AI review governance](./agents/12-ai-review-governance.md) + [ops spec](./agents/review-gate-operational-spec.md) + [workflow contract](./agents/review-gate-workflow-contract.md)
- [Context integrity compact](./agents/15-context-integrity-compact.md)
- [Linear production compact](./agents/16-linear-production-compact.md)
- [GitHub to Linear automation](./agents/18-github-linear-automation.md)
- [Linear templates](./agents/19-linear-templates.md)
- [CI required checks](./agents/17-ci-required-checks.md)
- [Role governance](./agents/07a-role-governance.md) / [Agent governance](./agents/07b-agent-governance.md)
- [Audit trail policy](./agents/09-audit-trail-policy.md)
- [Contradictions and cleanup](./agents/05-contradictions-and-cleanup.md)
- [Architecture bootstrap](./agents/00-architecture-bootstrap.md)
- [Project Brain rollout](./agents/20-project-brain-memory-extension-rollout.md)
- [Planning precedence policy](./agents/22-planning-precedence-policy.md)
- [Tooling inventory](./agents/tooling.md)
- [Release change control ops spec](./agents/release-change-control-operational-spec.md)
- [Linear workflow ops spec](./agents/linear-workflow-operational-spec.md)

### Architecture and planning

- [Documentation layers](./architecture/documentation-layers.md)
- [Blast radius](./architecture/blast-radius.md)
- [Agent run records](./architecture/agent-run-records.md)
- [Runtime-aware harness control plane](./architecture/runtime-aware-harness-control-plane.md)
- [Module boundaries](./architecture/module-boundaries.md)
- [Architecture decision records](./adr/001-result-type-error-handling.md)
- [Plans](./plans/2026-04-08-feat-coding-harness-reliability-orchestration-plan.md)
- [North star](./roadmap/north-star.md)
- [Roadmap status matrix](./roadmap/agent-first-status.md)
- [CLI spec](./cli-specs/2026-04-06-harness-cli-spec.md)
- [Benchmarks](./benchmarks/README.md)

### Templates and examples

- [Prompts](./prompts/workflow-consistency-enforcer.md)
- [CI migrate examples](./examples/ci-migrate/README.md)
- [Workflow artifact registry](./workflow-artifact-registry.json)
- [Symphony + Linear setup](./symphony-linear-setup.md)

## Extending this index

- Assign new files to exactly one layer (see [documentation layers](./architecture/documentation-layers.md)).
- Layer 0 and Layer 1 files have line budgets (130 and 80 respectively).
- Keep leaf detail in the target doc, not in this index.
