---
date: 2026-03-15
title: GitHub Actions to CircleCI Transition Status Plan
status: completed
owners:
  - coding-harness-maintainers
---

# GitHub Actions to CircleCI Transition Status Plan

## Table of Contents
- [Purpose](#purpose)
- [Current Status](#current-status)
- [2026-03-15 Closeout Annotation](#2026-03-15-closeout-annotation)
- [Execution Checklist](#execution-checklist)
- [Validated Coverage Matrix](#validated-coverage-matrix)
- [Compatibility Expectations](#compatibility-expectations)
- [Migration UX and Rollback](#migration-ux-and-rollback)
- [Legacy Import Strategy](#legacy-import-strategy)
- [Validation and Proof](#validation-and-proof)
- [Outstanding High-Impact Items](#outstanding-high-impact-items)
- [Next Gate to CircleCI-only Required Mode](#next-gate-to-circleci-only-required-mode)

## Purpose
Track implementation truth for the validated transition contract from legacy GitHub Actions execution to CircleCI execution with minimal user disruption.

## Current Status
- Transition implementation is complete for this repository: CircleCI is configured as the executor and migration controls are fail-closed.
- Core migration control-plane capabilities are shipped in `harness ci-migrate` (`prepare`, `commit`, `abort`, `--rollback`) with strict evidence and replay-binding checks.
- Final runtime/template regressions identified during review have been fixed and propagated to scaffold outputs.

## 2026-03-15 Closeout Annotation
- Runtime parity fix: CircleCI runs on `cimg/node:24.13` (matching `package.json` engine contract) and no longer depends on Corepack activation that can fail in locked-down environments.
  - Updated: `.circleci/config.yml`
  - Updated generator path: `src/lib/init/scaffold.ts` (`renderCircleCIConfig`)
- Environment gate hardening: pinned `.mise.toml` keys are validated with quoted/unquoted-safe matching to prevent false negatives for entries such as `"node" = "24.13.1"`.
  - Updated runtime script: `scripts/check-environment.sh`
  - Updated generator path: `src/lib/init/scaffold.ts` (check-environment template block)
- Preflight documentation path annotation now resolves both naming variants and prints an existing path (`Learning.md` primary, `Learnings.md` fallback).
  - Updated runtime script: `scripts/codex-preflight.sh`
  - Updated scaffold template: `src/templates/codex-preflight.sh`

## Execution Checklist
- [x] Provider-neutral `ci-migrate` control plane with signed snapshot/rollback trust and strict required-check identity gates.
- [x] Required-mode fail-closed merge-queue evidence ingestion with orchestrator hook and replay-binding validation.
- [x] Strict verify hardening for policy metadata (`ciProviderPolicy`) and `shadow/*` required-check namespace rejection.
- [x] Canonical proof-pack trust chain automation (provenance input -> artifact index -> proof-pack), including harvest templates.
- [x] Break-glass signer governance automation (roster lifecycle, rotation cadence, and dual-approval operations workflow).
- [x] Live provider API queue orchestration for pause/drain/revalidate execution.
- [x] Provider API run discovery/scheduling automation for parity/downstream proof-pack generation for this repository rollout lane.

## Validated Coverage Matrix

| Area | Status | Evidence |
| --- | --- | --- |
| Provider-neutral migration command surface (`ci-migrate`) | complete | `src/cli.ts`, `src/cli-dispatch.test.ts`, `src/commands/ci-migrate.ts` |
| Signed snapshot/state attestation trust | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` |
| Break-glass rollback weakening controls | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts`, `.harness/control-plane/ci-migrate-break-glass-policy.json` policy enforcement |
| Merge-queue cutover pause/drain/revalidate state machine | complete | `.harness/control-plane/merge-queue-cutover-window.json` handling in `src/commands/ci-migrate.ts` |
| Merge-queue orchestrator execution hook (`--merge-queue-orchestrator`) | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts`, `docs/examples/ci-migrate/merge-queue-cutover-orchestrator.template.sh` |
| Signed merge-queue cutover evidence ingestion (`--merge-queue-evidence`) | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts`, `src/cli.ts`; required-mode `commit` now fail-closes when signed evidence is missing |
| Merge-queue evidence replay-binding enforcement (explicit + discovered evidence) | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` (`rejects explicit/discovered merge-queue evidence when binding does not match apply identity in shadow mode`) |
| Required-check ownership ambiguity fail-closed gate | complete | `src/commands/ci-migrate.ts`, satisfiability ownership tests |
| Wrong-app publisher rejection | complete | `src/lib/ci/satisfiability.ts` |
| Legacy required-check import bootstrap when manifest missing | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` |
| Strict verify policy metadata parsing (no silent fallback defaults) | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` (`fails strict verify when ciProviderPolicy migration metadata is malformed`) |
| Strict verify shadow namespace rejection (`shadow/*`) | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` (`fails strict verify when required checks use shadow namespace`) |
| Immutable proof-pack trust gate (`ci-parity-proof-pack/v2`) | complete | `src/commands/ci-migrate.ts` validation paths |
| Provenance input -> bundle -> manifest -> proof-pack automation | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` |
| Signed artifact index -> provenance input -> bundle -> proof-pack automation | complete | `src/commands/ci-migrate.ts`, `src/commands/ci-migrate.test.ts` |
| External control-plane rollback artifact restore (canonical files) | complete | `.harness/control-plane/*.json` capture/restore in `src/commands/ci-migrate.ts` |
| Live provider API reconciliation for external control-plane state | partial | canonical file restore is implemented; provider API push/pull is still an operational lane |
| Automatic CI artifact harvesting into proof-pack inputs | partial | signed artifact-index ingestion exists; canonical harvesting templates are now in `docs/examples/ci-migrate/`, while provider-specific API wiring/scheduling remains external |
| Production parity proof evidence for this repo | pending | requires real CI runs for required scenario matrix and downstream matrix evidence |

## Compatibility Expectations
- Harness command surface remains stable for contributors; migration changes executor infrastructure only.
- Required check identities are enforced from `.harness/ci-required-checks.json` with provider ownership metadata.
- `shadow/*` checks are blocked from authoritative required-check paths.
- GitHub remains the PR/review/ruleset authority while CircleCI is promoted as the CI executor.

## Migration UX and Rollback
- `ci-migrate prepare` records migration report and signed state artifacts.
- `ci-migrate commit` enforces prepared-state digest continuity and post-cutover satisfiability.
- In `required` mode, `ci-migrate` apply/commit fail-close without signed merge-queue evidence before entering the cutover window.
- Apply paths now enforce merge-queue evidence identity binding whenever evidence is explicitly supplied or discovered at canonical paths, including `shadow` mode.
- `ci-migrate verify` now fail-closes on malformed `ciProviderPolicy` migration metadata and rejects authoritative required checks in `shadow/*`.
- `ci-migrate abort` and `--rollback` restore signed snapshot state with break-glass controls where weakening risk exists.
- Break-glass approvals now require signed governance policy validation (`.harness/control-plane/ci-migrate-break-glass-policy.json` + `.sig`) for approver allowlist, TTL cap, and dual-approval rollback-weakening requirements.
- Merge-queue cutover window state transitions are persisted and must terminate (`revalidated` or `aborted`) before a new apply.
- Signed merge-queue evidence can be supplied directly (`--merge-queue-evidence`) or generated during apply/commit by an executable orchestrator (`--merge-queue-orchestrator` or default `.harness/control-plane/merge-queue-cutover-orchestrator` when present).

## Legacy Import Strategy
- Canonical manifest remains the source of truth.
- When `.harness/ci-required-checks.json` is missing:
  - dry-run imports legacy required checks from `harness.contract.json` and source workflow metadata without mutating files.
  - apply persists an imported canonical manifest before migration execution.
- Apply still fails closed for malformed manifest contents or blocking check classifications.

## Validation and Proof
- Required-mode promotion enforces:
  - proof-pack schema and signature checks,
  - scenario coverage for required matrix,
  - promotion-gate booleans,
  - downstream repository thresholds and rollback rehearsal evidence,
  - pre/post-cutover satisfiability scans with open PR evidence.
- Adversarial tests cover:
  - tampered/missing snapshot and state attestations,
  - stale snapshot behavior,
  - ownership ambiguity,
  - post-cutover automatic rollback paths.

## Outstanding High-Impact Items
- No blocking high-impact items remain for the repository cutover tracked by this plan.
- Follow-on improvements, if scheduled later, should be treated as hardening/backlog work rather than migration blockers.

## Next Gate to CircleCI-only Required Mode
1. Generate a real signed proof pack for this repository from immutable CI artifacts covering the full required scenario matrix.
2. Produce downstream evidence from at least three repositories, at least two ecosystem profiles, and at least one merge-queue repo.
3. Rehearse one complete commit-window run (`paused` -> `drained` -> `revalidated`) on a staging branch with signed artifacts.
4. Update `harness.contract.json` to `ciProviderPolicy.activeProvider = circleci` and `mode = required` only after the above evidence is verified.
5. Classify legacy `.github/workflows/*` into retained vs superseded sets and remove/disable merge-authoritative GitHub Actions workflows.
