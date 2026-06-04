---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - automation-maintainer
  - release-operator
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - dependency-refresh-change
  - toolchain-change
  - release-contract-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/automations/README.md
  - docs/guardrails/package-and-scaffold-release.md
  - docs/agents/08-release-and-change-control.md
---

# Dependency and toolchain refresh runbook

## Table of Contents

- [Purpose](#purpose)
- [Machine Identity](#machine-identity)
- [Source Of Truth](#source-of-truth)
- [Workflow](#workflow)
- [Stop Conditions](#stop-conditions)
- [Validation](#validation)

## Purpose

Use this runbook for recurring dependency, package-manager, Node, pnpm, tool,
and scaffold-runtime refreshes that can affect downstream installs or CI.

## Machine Identity

Automation ID: dependency-and-toolchain-refresh.
Cursor: dependency/tool name plus current version and target version.
Output lane: package and scaffold release support.

## Source Of Truth

Use current evidence in this order:

1. package.json, lockfile, mise/toolchain config, and repo scripts.
2. Release notes or upstream docs for the changed dependency.
3. Generated scaffold fixtures and CI templates when downstream behavior can
   change.
4. Prior automation output only as supporting context.

## Workflow

1. Identify the dependency or toolchain delta.
2. Classify SemVer, downstream scaffold, and CI impact.
3. Update the smallest source surface and generated fixture required.
4. Run narrow tests for the touched dependency or scaffold path.
5. Widen to package, docs, and release gates when public contracts change.
6. Record rollback path and any deferred follow-up.

## Stop Conditions

Stop when upstream guidance is unavailable, credentials are missing, the update
requires a major migration decision, or validation cannot prove the touched path.

## Validation

Use exact commands and outcomes in refresh closeout. Minimum lanes:

- Command: `pnpm docs:lifecycle` -> required after runbook metadata,
  authority, lifecycle, package, or scaffold documentation changes.
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
  -> required when docs-gate, governed documentation, scaffold release, or
  toolchain authority behavior changes.
- Command: `pnpm test:related` -> required when source, templates, fixtures,
  validators, or generated scaffold behavior changes.
- Command: `pnpm check` -> required before package or release handoff.

If a command is blocked by external services, credentials, or unavailable
tooling, record the blocker and the smallest fallback command that still proves
the touched path.
