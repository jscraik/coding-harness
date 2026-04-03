---
title: Greenfield Self-Hosted CI Platform Implementation Plan
type: feat
status: active
date: 2026-04-03
requirements: docs/brainstorms/2026-04-03-greenfield-self-hosted-ci-platform-requirements.md
spec: docs/specs/2026-04-03-feat-greenfield-self-hosted-ci-platform-spec.md
deepened: 2026-04-03
plan_type: standard-plan
---

# Greenfield Self-Hosted CI Platform Implementation Plan

## Enhancement Summary

**Deepened on:** 2026-04-03
**Mode:** targeted-confidence
**Key areas improved:** phase-gated sequencing, contract/bootstrap coverage, canonical verification alignment, promotion safety, self-hosted authority modeling

- Added explicit dependency and hold-condition logic to each implementation unit so execution can stop safely instead of drifting into premature cutover work.
- Strengthened the risk section into an operational risk register with concrete detection signals and hold responses for status collisions, trust-boundary leaks, rebuild gaps, and verification blind spots.
- Expanded system-wide impact and documentation parity expectations so `ci-migrate`, branch protection, bootstrap templates, and verification artifacts evolve together during execution.
- Tightened `P1`, `P2`, and `P3` so transition-state work includes the real contract/bootstrap surfaces, `provider-adapter` does not silently widen v1 scope, self-hosted publication authority is modeled explicitly, and self-hosted verification stays pinned to existing canonical entrypoints.

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Frame](#problem-frame)
- [Requirements Trace](#requirements-trace)
- [Scope Boundaries](#scope-boundaries)
- [Context and Research](#context-and-research)
- [Key Technical Decisions](#key-technical-decisions)
- [Open Questions](#open-questions)
- [High-Level Technical Design](#high-level-technical-design)
- [Implementation Units](#implementation-units)
- [System-Wide Impact](#system-wide-impact)
- [Risks and Dependencies](#risks-and-dependencies)
- [Acceptance Criteria](#acceptance-criteria)
- [Documentation and Operational Notes](#documentation-and-operational-notes)
- [Execution Ledger](#execution-ledger)
- [Sources and References](#sources-and-references)

## Overview

This plan turns the approved greenfield CI platform spec into an execution sequence for this repository.

The implementation goal is to replace the current brittle combination of 1Password-managed `.env` workflows and CircleCI plan-limited execution with a repo-owned, reproducible platform built around:

- DigitalOcean provisioned via `doctl`
- Drone as the v1 CI control plane
- Cloudflare Tunnel plus Access for operator-facing UI exposure
- Infisical as the runtime secret source
- a stable GitHub required status surface preserved as `pr-pipeline` during cutover

This is a high-risk, multi-surface change, so the plan keeps the internals greenfield while preserving the required-check edge contract already depended on by this repository.

## Problem Frame

The current pain is not one isolated workflow failure. It is a compound operational problem:

- local and hosted secret handling has become fragile when `.env` material depends on external UI state
- CircleCI failures can be caused by hosted-plan or billing limits rather than repository correctness
- the repository still needs one stable GitHub required-check contract during migration
- the replacement platform must be reproducible enough to rebuild, validate, and cut over without inventing undocumented operator steps

The deepened spec already resolved the architectural questions. The remaining job is to sequence implementation so we can ship the new platform without colliding with the existing `pr-pipeline` status surface or weakening CI trust boundaries.

## Requirements Trace

| Requirement / Spec Anchor | Plan Response |
| --- | --- |
| CLI-first DigitalOcean bootstrap (`R1`, `SA1`, `SA2`) | Build a repo-owned bootstrap bundle using `doctl` plus cloud-init templates and verification guidance. |
| Rebuildable, disposable host with defined continuity (`R2`, `SA17`) | Encode restart continuity via mounted Drone `/data` and full-host replacement via deterministic repo-only re-enrollment. |
| Infisical as runtime secret source (`R4`, `SA4`, `SA5`) | Keep real secrets out of committed `.env`; implement template and entrypoint patterns around runtime injection. |
| UI protected, webhook ingress reachable (`R11`, `R12`, `SA6`, `SA14`) | Separate Cloudflare Access-protected UI exposure from webhook-safe ingress routing. |
| Canonical required status continuity (`R9`, `SA8`, `SA9`, `SA16`) | Preserve `pr-pipeline` as the production commit-status context while staging uses `pr-pipeline-staging`. |
| No dual-signal collision (`INV13`, `SA16`) | Keep v1 publication on Drone native commit-status only; do not introduce a same-name check-run publisher. |
| Trusted-source-only v1 runner policy (`INV15`, `SA15`, `SA18`) | Restrict self-hosted runner execution to this repo and trusted internal PRs only during cutover. |
| Verification evidence artifact (`SA13`, `SA19`) | Standardize `.harness/artifacts/ci-platform-verification/<timestamp>.json` with schema-guided evidence capture. |

## Scope Boundaries

In scope for this plan:

- repo-owned bootstrap artifacts and templates for the new platform
- harness control-plane changes needed to model staging versus primary cutover safely
- required-check continuity work for `pr-pipeline`
- trusted-versus-untrusted event handling contracts for v1
- verification artifact generation and operator-facing rollout evidence
- documentation updates needed to keep repo guidance accurate

Out of scope for this plan:

- multi-repo rollout beyond this repository
- autoscaling or split-host runners in v1
- replacing Drone native commit-status publication with a custom GitHub Checks bridge
- Kubernetes, external databases, or artifact storage services in v1
- generalizing the harness provider schema to fully model Drone as a first-class active provider in this pass

## Context and Research

The plan is grounded in both the approved spec and the current repository implementation.

Current repo signals that shape this plan:

- [README.md](/Users/jamiecraik/dev/coding-harness/README.md) already documents a `harness ci-migrate` lifecycle with `prepare`, `verify`, `commit`, `sync-branch-protection`, and `promote-mode`.
- [docs/agents/17-ci-required-checks.md](/Users/jamiecraik/dev/coding-harness/docs/agents/17-ci-required-checks.md) distinguishes between harness-managed check metadata and the single GitHub surface the repo actually requires.
- [.harness/restore-manifest.json](/Users/jamiecraik/dev/coding-harness/.harness/restore-manifest.json) currently records CircleCI as the live provider, so cutover logic must be additive and staged rather than rewritten in one step.
- [src/commands/ci-migrate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/ci-migrate.ts) and [src/lib/ci/branch-protect-sync.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/branch-protect-sync.ts) already provide the command and branch-protection seams we should extend rather than bypass.
- [.harness/memory/LEARNINGS.md](/Users/jamiecraik/dev/coding-harness/.harness/memory/LEARNINGS.md) records that branch protection and harness metadata still expect canonical `pr-pipeline`, so staging must not emit the production context before the real handoff window.

External references that informed the implementation ordering:

- DigitalOcean `doctl compute droplet create --user-data-file`
- Drone server/provider and Docker runner docs
- Drone `DRONE_STATUS_NAME` docs
- Infisical runtime injection and Docker Compose guidance
- GitHub required-status collision guidance
- Cloudflare Tunnel configuration and ingress management docs

## Key Technical Decisions

1. Use `standard-plan` mode
The spec is already approved and materially deepened. This plan focuses on execution sequencing, not re-litigating architecture.

2. Treat the platform as greenfield internally but compatibility-safe externally
We will not mirror CircleCI internals. We will preserve only the edge contract that matters during cutover: one canonical production status context named `pr-pipeline`.

3. Keep Drone off the active-provider enum in v1
The repository already has working `ci-migrate` seams built around current providers. The fastest safe path is to extend transition-state modeling and cutover evidence first, without expanding the full provider model in the same pass.

4. Use `pr-pipeline-staging` as the only rehearsal publication context
This is the clean answer to the technical review finding about status-surface collision. It lets us rehearse end-to-end without corrupting current `pr-pipeline` evidence while CircleCI is still authoritative.

5. Restrict v1 execution to this repository and trusted internal PRs only
A Docker-socket runner is not an acceptable place to casually add untrusted fork execution. The plan encodes that limitation as a deliberate v1 safety boundary.

6. Prefer deterministic repo-owned templates over prose-only setup
The user asked for a pipeline built from scratch. That means repo-visible templates, verification examples, and operational artifacts, not just a runbook.

## Open Questions

Resolved for this plan:

- v1 scope is this repository only during cutover.
- Full host replacement will use deterministic repo-only re-enrollment rather than off-host database restoration in v1.
- Production publication remains Drone native commit status, not GitHub Checks.

Deferred but non-blocking:

- Whether a later pass should promote Drone to a first-class harness provider instead of staying in transition-state handling.
- Whether a later pass should add off-host persistence or backup for Drone state once the single-repo cutover is stable.

## High-Level Technical Design

The implementation path is intentionally layered.

Execution sequencing follows one deliberate rule: artifact and safety-contract work must land before promotion mechanics. That means the bootstrap bundle, transition-state model, and required-check safeguards are not parallel nice-to-haves. They are the preconditions for any real cutover rehearsal.

### Layer 1: Bootstrap Bundle

A repo-owned example bundle under `docs/examples/ci-platform/` will define:

- DigitalOcean bootstrap inputs
- cloud-init installation flow
- Docker Compose services for Drone and supporting runtime pieces
- Cloudflare Tunnel configuration templates
- Infisical runtime-injection entrypoint pattern
- verification artifact examples

### Layer 2: Harness Cutover Control Plane

The current `ci-migrate` control plane will be extended to understand:

- staging versus primary status publication
- repo-only self-hosted rollout state
- trusted-source restrictions
- deterministic rebuild expectations
- verification artifact paths and promote-blocking evidence

### Layer 3: Required-Check Handoff Safety

The branch-protection and migration surfaces must support:

- `pr-pipeline-staging` rehearsal
- `pr-pipeline` as the only canonical production context
- explicit warnings or hard failures if both staging and primary publication are misconfigured or if a dual-signal surface is introduced

### Layer 4: Operator Verification

A verification workflow must produce a structured artifact proving:

- platform reachability
- staging publication health
- production publication isolation before cutover
- trusted-source enforcement behavior
- restart continuity and deterministic rebuild path documentation

## Implementation Units

Execution should move strictly in phase order. Later units may prepare context, but they should not ship ahead of the earlier unit's exit criteria because each phase narrows a different failure class:

- `P0` removes bootstrap ambiguity
- `P1` removes transition-state ambiguity
- `P2` removes required-check ambiguity
- `P3` removes verification ambiguity
- `P4` is the controlled cutover preparation layer that depends on all earlier ambiguity being resolved

If a unit exposes contract drift that the current spec does not already permit, pause and refresh the plan or spec before continuing.

### P0. Bootstrap Bundle and Repo-Owned Templates

Goal:
Create the deterministic bootstrap and operator artifact set that makes the self-hosted platform reproducible from repo state.

Depends on:
None. This is the execution starting point because every later unit assumes the artifact layout and operator vocabulary created here.

Files to create:

- [docs/examples/ci-platform/README.md](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform/README.md)
- [docs/examples/ci-platform/digitalocean-cloud-init.template.yaml](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform/digitalocean-cloud-init.template.yaml)
- [docs/examples/ci-platform/docker-compose.template.yml](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform/docker-compose.template.yml)
- [docs/examples/ci-platform/cloudflared-config.template.yml](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform/cloudflared-config.template.yml)
- [docs/examples/ci-platform/infisical-entrypoint.template.sh](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform/infisical-entrypoint.template.sh)
- [docs/examples/ci-platform/verification-artifact.template.json](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform/verification-artifact.template.json)

Key tasks:

- encode `doctl`-first droplet provisioning with a `--user-data-file` cloud-init path
- template restart continuity around mounted Drone `/data`
- document full-host replacement as repo-only deterministic re-enrollment
- encode separate UI and webhook ingress expectations in Cloudflare config examples
- show Infisical as runtime source of truth, with `.env.example` shape only where documentation is needed

Verification:

- artifact set exists and aligns to spec decisions
- docs include a Table of Contents and explicit operator sequencing
- template filenames and fields are internally consistent

Exit criteria:

- the bootstrap bundle can be followed without inventing missing files or secret-handling patterns
- the artifact naming and directory layout are stable enough that later units can reference them without placeholder paths

Hold conditions:

- stop if the template set implies committing live secrets, multiline private keys, or a UI-dependent bootstrap step
- stop if the artifact layout conflicts with existing `docs/examples/` conventions strongly enough that later units would need to rename paths again

### P1. Self-Hosted Transition State Modeling in Harness

Goal:
Extend the harness control plane so the self-hosted rollout can be tracked, verified, and promoted safely without forcing Drone into the active-provider enum in v1, while still making internal authority semantics for `pr-pipeline` explicit.

Depends on:
`P0`, because transition-state fields and examples need stable bootstrap and evidence artifact paths.

Files to create:

- [src/lib/ci/self-hosted-transition.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/self-hosted-transition.ts)
- [src/lib/ci/self-hosted-transition.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/self-hosted-transition.test.ts)

Files to modify:

- [src/commands/ci-migrate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/ci-migrate.ts)
- [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts)
- [src/lib/contract/json-schema.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/json-schema.ts)
- [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- [.harness/ci-required-checks.json](/Users/jamiecraik/dev/coding-harness/.harness/ci-required-checks.json)
- [.harness/restore-manifest.json](/Users/jamiecraik/dev/coding-harness/.harness/restore-manifest.json)
- [src/lib/init/rollback.ts](/Users/jamiecraik/dev/coding-harness/src/lib/init/rollback.ts)
- [docs/examples/ci-migrate/ci-provider-transition-status.template.json](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-migrate/ci-provider-transition-status.template.json)

Likely tests to create or modify:

- [src/commands/ci-migrate.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/ci-migrate.test.ts)
- [src/commands/contract.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/contract.test.ts)
- [src/lib/contract/validator.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.test.ts)
- [src/lib/ci/self-hosted-transition.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/self-hosted-transition.test.ts)
- [src/lib/init/rollback.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/init/rollback.test.ts)

Key tasks:

- model repo-only self-hosted cutover metadata separately from existing provider selection
- encode staging context `pr-pipeline-staging` and production context `pr-pipeline`
- encode trusted-source-only policy for v1 runner use
- encode verification artifact path expectations and promote-blocking conditions
- make full-host replacement semantics explicit in transition-state documentation and validation
- define the internal authority model for a self-hosted `pr-pipeline` publisher, including what remains provider-authoritative during rehearsal, what flips at promotion time, and which fields record that authority without pretending Drone is an active provider
- define required-check manifest semantics for rehearsal versus promotion, including how `activeProvider`, `sourceAppSlug`, `sourceAppId`, and `githubCheckName` behave before and after the self-hosted publisher becomes canonical
- extend `ci-migrate` lifecycle semantics so `bootstrap`, `verify`, `sync-branch-protection`, and `promote-mode` can reason about self-hosted authority handoff without requiring stale CircleCI-only success text or terminal `circleci-only` assumptions to stand in for the real rollout state
- extend the shared contract schema, contract validation, and transition-artifact validators together so `harness contract schema`, `harness contract validate`, `harness ci-migrate verify`, and bootstrap output all agree on the same self-hosted transition shape
- update bootstrap messaging, restore-manifest expectations, and draft-artifact defaults in `ci-migrate` so the self-hosted rollout path no longer depends on CircleCI-only operator wording or CircleCI-only lifecycle milestones

Verification:

- targeted tests for transition-state parsing and validation
- contract validation and schema export prove the richer transition-state shape without adding Drone to the active-provider enum
- required-check manifest and restore-manifest handling prove that rehearsal can coexist with CircleCI as the current provider while still modeling the upcoming self-hosted production authority cleanly
- failure cases for illegal publication overlap and missing trusted-source rules
- failure cases for stale CircleCI-only lifecycle wording or promote checks that would misclassify the self-hosted path

Exit criteria:

- `ci-migrate` surfaces, shared contract validation, required-check manifest semantics, and draft transition artifact output can represent the self-hosted rollout without ambiguous status publication, stale publisher authority, or undocumented rebuild behavior

Hold conditions:

- stop if the transition-state model cannot express staging versus primary publication without mutating the current live provider contract too early
- stop if the model implicitly requires adding Drone as a first-class active provider to proceed in v1
- stop if rehearsal requires lying in `.harness/ci-required-checks.json` about who currently publishes canonical `pr-pipeline`
- stop if promotion semantics cannot clearly explain when CircleCI ceases to be the internal authority for `pr-pipeline`

### P2. Required-Check and Branch-Protection Handoff

Goal:
Preserve `pr-pipeline` continuity while making staging safe and visible, and define how GitHub ruleset source authority changes when the self-hosted publisher takes over.

Depends on:
`P1`, because branch-protection logic should consume one coherent transition-state model rather than invent its own staging semantics.

Files to modify:

- [src/lib/ci/branch-protect-sync.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/branch-protect-sync.ts)
- [.harness/ci-required-checks.json](/Users/jamiecraik/dev/coding-harness/.harness/ci-required-checks.json)
- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [docs/agents/17-ci-required-checks.md](/Users/jamiecraik/dev/coding-harness/docs/agents/17-ci-required-checks.md)

Likely tests to create or modify:

- [src/lib/ci/branch-protect-sync.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/branch-protect-sync.test.ts)

Key tasks:

- make staging versus primary contexts explicit in sync planning
- forbid promotion when staging is still the only healthy surface
- preserve one canonical production status context only
- define ruleset source-authority behavior for `pr-pipeline`, including how stale CircleCI `app_id` bindings are detected, removed, or replaced when the self-hosted publisher becomes canonical
- keep required-check manifest semantics aligned with the ruleset handoff so rehearsal does not prematurely relabel production authority, while promotion updates manifest metadata and ruleset source authority together
- update repo docs so `pr-pipeline` terminology is unambiguous: status-check surface generically, commit-status context specifically
- guard against a future same-name check-run publisher being introduced by mistake
- keep `provider-adapter` out of the required file target set for v1 unless implementation proves branch-protection sync cannot consume existing required-check manifest and transition-state inputs without widening provider modeling

Verification:

- tests for staging-only, primary-only, collision, and orphaned-context scenarios
- tests for stale CircleCI-app ownership on `pr-pipeline` and for the promoted self-hosted source-authority outcome
- docs and code use consistent terminology after the commit-status decision

Exit criteria:

- branch-protection logic, required-check manifest semantics, and docs no longer leave room for `pr-pipeline` collision, ambiguous staging behavior, or stale CircleCI source authority after promotion

Hold conditions:

- stop if the proposed sync logic would emit canonical `pr-pipeline` while CircleCI is still authoritative
- stop if the branch-protection model cannot distinguish staging from primary without requiring two overlapping authorities on the same SHA
- stop if promotion would preserve CircleCI `app_id` ownership on `pr-pipeline` after the self-hosted publisher becomes canonical

### P3. Verification Workflow and Evidence Artifacts

Goal:
Create the self-hosted verification logic and evidence path behind the repository's existing canonical verification surfaces.

Depends on:
`P1` and `P2`, because verification must inspect the actual transition-state and publication contracts, not a guessed future model.

Files to create:

- [scripts/verify-self-hosted-ci-platform.ts](/Users/jamiecraik/dev/coding-harness/scripts/verify-self-hosted-ci-platform.ts)
- [.harness/artifacts/ci-platform-verification/.gitkeep](/Users/jamiecraik/dev/coding-harness/.harness/artifacts/ci-platform-verification/.gitkeep)

Files to modify:

- [src/commands/ci-migrate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/ci-migrate.ts)
- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [docs/agents/02-tooling-policy.md](/Users/jamiecraik/dev/coding-harness/docs/agents/02-tooling-policy.md)

Likely tests to create or modify:

- [src/commands/ci-migrate.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/ci-migrate.test.ts)
- [src/lib/ci/self-hosted-transition.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/self-hosted-transition.test.ts)

Key tasks:

- keep `harness ci-migrate verify` as the canonical operator-facing migration verification command
- keep `bash scripts/verify-work.sh` as the canonical repo-local verification entrypoint and explicitly leave it out of self-hosted cutover proof gathering; repo-local verification remains preflight plus repo-code validation, not CI-authority verification
- emit a structured `schema_version: 1` evidence artifact into `.harness/artifacts/ci-platform-verification/<timestamp>.json`
- validate staging publication, trusted-source enforcement, and route separation evidence
- capture restart continuity checks and deterministic rebuild checklist coverage
- fail closed if production `pr-pipeline` is emitted during rehearsal or if trusted-source enforcement is absent
- if `scripts/verify-self-hosted-ci-platform.ts` exists, wire it only behind `harness ci-migrate verify`; it must not be invoked by `bash scripts/verify-work.sh` and must not be documented as a new top-level operator command

Verification:

- targeted script tests if script logic is extracted into testable modules
- successful local dry run against fixture data
- artifact shape matches the spec and example template
- README and tooling-policy docs still point to the existing canonical verification surfaces after the self-hosted probes are introduced, and they explicitly state that `verify-work.sh` does not perform cutover-authority verification

Exit criteria:

- operators use one deterministic migration-verification command (`harness ci-migrate verify`) and one deterministic artifact path to judge promote versus hold, while repo-local verification continuity remains anchored to `bash scripts/verify-work.sh`, which intentionally does not delegate to self-hosted cutover probes

Hold conditions:

- stop if the artifact cannot prove publication mode, trusted-source policy, and readiness state in one place
- stop if verification can pass while the platform still lacks evidence for rollback-preferred behavior
- stop if the planned verification flow would require maintainers to choose between two competing "canonical" commands for the same decision

### P4. Cutover Readiness and Controlled Promotion Path

Goal:
Make the repository ready to execute the actual cutover window after the earlier units land.

Depends on:
`P0` through `P3`. This phase is documentation and readiness synthesis, not a substitute for unfinished earlier units.

Files to modify:

- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [docs/agents/17-ci-required-checks.md](/Users/jamiecraik/dev/coding-harness/docs/agents/17-ci-required-checks.md)
- [docs/specs/2026-04-03-feat-greenfield-self-hosted-ci-platform-spec.md](/Users/jamiecraik/dev/coding-harness/docs/specs/2026-04-03-feat-greenfield-self-hosted-ci-platform-spec.md) only if implementation reveals contract drift

Operational artifacts to produce during execution:

- one or more `.harness/artifacts/ci-platform-verification/<timestamp>.json` files
- a controlled `ci-migrate` transition-status update proving staging success before production promotion

Key tasks:

- rehearse on `pr-pipeline-staging` only while CircleCI stays authoritative
- sync docs and operator steps around the exact promote window
- define rollback instructions that revert publication authority without changing trusted-source boundaries
- confirm branch protection will observe only the canonical production surface at promotion time

Verification:

- `ci-migrate` state and verification artifact agree on readiness
- no docs contradictions remain between README, agent docs, and examples

Exit criteria:

- repository is ready for a controlled production cutover without reopening architecture decisions

Hold conditions:

- stop if the rehearsal path cannot prove `pr-pipeline-staging` success without touching canonical `pr-pipeline`
- stop if rollback would leave the repository without one clearly trusted CI authority

## System-Wide Impact

Expected impact areas:

- CI migration command surfaces under `src/commands/`, `src/lib/ci/`, `src/lib/contract/`, and `.harness/`, especially transition-state interpretation, internal publication authority modeling, branch-protection sync, shared contract validation and schema export, required-check manifest semantics, and draft transition-artifact bootstrapping
- branch protection synchronization logic and required-check documentation, where staging versus primary publication must remain explicit and non-colliding
- required-check source-authority ownership, where `pr-pipeline` context continuity must be preserved without leaving stale CircleCI app bindings or misleading manifest metadata behind
- repo-owned example bundles and operator workflow docs under `docs/examples/ci-platform/`, which become the canonical bootstrap and rebuild reference surface
- verification artifact paths under `.harness/artifacts/`, which become part of the rollout decision contract rather than ad hoc debugging output
- repository governance guidance in `README.md` and `docs/agents/17-ci-required-checks.md`, which must continue to describe the same public CI contract after the self-hosted path is introduced
- maintainer understanding of restart continuity versus full-host replacement, so service restarts, rebuilds, and rollback are treated as distinct operational cases

This plan intentionally avoids unrelated product/runtime features. The impact is broad inside the control plane, but narrow in product scope.

## Risks and Dependencies

Primary risk register:

| Risk | Why it matters | Detection signal | Mitigation / hold response |
| --- | --- | --- | --- |
| Canonical status collision | Publishing `pr-pipeline` too early or from two authorities can break branch protection and invalidate rollout evidence. | Rehearsal or sync logic shows `pr-pipeline` while CircleCI is still authoritative, or same-SHA status overlap appears. | Keep staging on `pr-pipeline-staging` only, fail closed on overlap, and block promotion until one authority model is proven. |
| Source-authority drift | A correct `pr-pipeline` context with stale CircleCI source ownership can leave GitHub rejecting the new publisher even after nominal cutover. | Ruleset sync output, manifest metadata, or verification artifact still point at CircleCI authority after self-hosted promotion. | Treat source-authority handoff as part of promotion, update manifest and ruleset together, and block promotion if stale CircleCI ownership remains. |
| Trusted-source leakage | A Docker-socket runner handling untrusted PRs would widen host-risk and secret-risk beyond the approved v1 boundary. | Event-policy review or verification artifact cannot prove fork / untrusted exclusion. | Treat trusted-source enforcement as a promote gate and keep untrusted traffic off the self-hosted path until a separate isolation design exists. |
| Transition-state drift | If `ci-migrate`, docs, and templates describe different states, operators will make unsafe cutover decisions. | Transition examples, command behavior, and docs disagree about staging, primary, or rollback semantics. | Update transition-state code, examples, and docs in the same change set; hold rollout if parity is broken. |
| Rebuild gap | Restart continuity and full-host replacement have different semantics; conflating them leads to false recovery confidence. | Validation proves restart continuity but cannot describe deterministic repo-only re-enrollment after host replacement. | Keep rebuild semantics explicit in templates, transition-state docs, and verification evidence before promotion. |
| Verification blind spot | Promotion without one structured artifact invites shell-forensics-driven decisions and weak rollback discipline. | Verification output lacks publication mode, readiness state, or final promote / hold / rollback recommendation. | Require the evidence artifact schema and block promotion until the artifact proves the critical probes together. |

Dependencies:

- access to current spec and brainstorm artifacts
- current harness CI migration command surfaces remaining stable enough to extend
- external operator credentials for DigitalOcean, Cloudflare, GitHub, and Infisical at execution time
- a deliberate production cutover window after rehearsal succeeds

Mitigations:

- keep staging and primary publication contexts distinct
- fail closed on trusted-source violations
- standardize verification artifacts and promote gates
- keep v1 scoped to this repo only

## Acceptance Criteria

### AC1. Repo-Owned Bootstrap Bundle Exists

The repository contains a coherent bootstrap bundle under `docs/examples/ci-platform/` covering DigitalOcean bootstrap, Drone service layout, Cloudflare routing, Infisical runtime injection, and verification artifact examples.

Trace:

- `SA1`, `SA2`, `SA4`, `SA5`, `SA6`, `SA17`

### AC2. Harness Transition State Supports Safe Rehearsal

The harness control plane can represent self-hosted staging using `pr-pipeline-staging`, trusted-source-only runner policy, and deterministic rebuild semantics without changing the live production provider contract prematurely.

Trace:

- `SA8`, `SA9`, `SA15`, `SA17`, `SA18`

### AC3. `pr-pipeline` Continuity Is Preserved Without Collision

Branch-protection, required-check manifest, and migration surfaces preserve one canonical production commit-status context named `pr-pipeline`, reject or clearly flag any staging or dual-signal configuration that would create ambiguity, and prove that stale CircleCI source authority is removed or replaced when the self-hosted publisher becomes canonical.

Trace:

- `INV13`, `SA16`, `SA19`

### AC4. Verification Evidence Is Structured and Promote-Blocking

A deterministic verification path produces `.harness/artifacts/ci-platform-verification/<timestamp>.json` artifacts with enough evidence to promote, hold, or roll back the cutover, and the implementation makes `harness ci-migrate verify` the sole cutover-authority verification command while keeping `bash scripts/verify-work.sh` outside that decision lane.

Trace:

- `SA13`, `SA14`, `SA18`, `SA19`

## Documentation and Operational Notes

Implementation should keep the following docs aligned in the same change set whenever behavior changes:

- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [docs/agents/17-ci-required-checks.md](/Users/jamiecraik/dev/coding-harness/docs/agents/17-ci-required-checks.md)
- [docs/examples/ci-migrate/ci-provider-transition-status.template.json](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-migrate/ci-provider-transition-status.template.json)
- new files under [docs/examples/ci-platform/](/Users/jamiecraik/dev/coding-harness/docs/examples/ci-platform)

Operational parity rules for execution:

- if `P1` changes the transition-state shape, update the example transition-status template in the same unit rather than batching it later
- if `P1` changes internal authority semantics, keep `.harness/ci-required-checks.json`, `.harness/restore-manifest.json`, `ci-migrate` lifecycle wording, and contract validation aligned in the same unit
- if `P2` changes required-check semantics, publication terminology, or ruleset source authority behavior, update `.harness/ci-required-checks.json`, `README.md`, and `docs/agents/17-ci-required-checks.md` before the unit is considered complete
- if `P3` introduces or renames verification artifact fields, keep the example template and the emitted artifact schema in lockstep
- if `P3` adds helper verification logic, keep `harness ci-migrate verify`, `bash scripts/verify-work.sh`, `README.md`, and `docs/agents/02-tooling-policy.md` aligned so no second canonical verification surface is created by accident and so `verify-work.sh` remains explicitly outside cutover-authority verification
- if implementation reveals a genuine contract mismatch with the spec, pause and refresh the spec intentionally instead of letting the plan drift silently

If implementation materially changes cutover semantics, update the spec only to reflect verified contract drift rather than re-opening design decisions casually.

## Execution Ledger

| STEP_ID | status | owner | evidence |
| --- | --- | --- | --- |
| P0 | in_progress | codex | Bootstrap bundle and template set are the first approved execution target from this plan. |
| P1 | pending | codex | Self-hosted transition-state modeling depends on P0 artifact conventions. |
| P2 | pending | codex | Required-check handoff work depends on P1 cutover-state modeling. |
| P3 | pending | codex | Verification artifact workflow depends on P1 and P2 contracts. |
| P4 | pending | codex | Controlled promotion prep depends on successful completion of P0 through P3. |

## Sources and References

Primary repo artifacts:

- [docs/brainstorms/2026-04-03-greenfield-self-hosted-ci-platform-requirements.md](/Users/jamiecraik/dev/coding-harness/docs/brainstorms/2026-04-03-greenfield-self-hosted-ci-platform-requirements.md)
- [docs/specs/2026-04-03-feat-greenfield-self-hosted-ci-platform-spec.md](/Users/jamiecraik/dev/coding-harness/docs/specs/2026-04-03-feat-greenfield-self-hosted-ci-platform-spec.md)
- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [docs/agents/17-ci-required-checks.md](/Users/jamiecraik/dev/coding-harness/docs/agents/17-ci-required-checks.md)
- [src/commands/ci-migrate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/ci-migrate.ts)
- [src/lib/ci/branch-protect-sync.ts](/Users/jamiecraik/dev/coding-harness/src/lib/ci/branch-protect-sync.ts)
- [src/lib/contract/json-schema.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/json-schema.ts)
- [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts)
- [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- [.harness/restore-manifest.json](/Users/jamiecraik/dev/coding-harness/.harness/restore-manifest.json)
- [.harness/memory/LEARNINGS.md](/Users/jamiecraik/dev/coding-harness/.harness/memory/LEARNINGS.md)

Platform documentation used during planning:

- DigitalOcean `doctl` droplet create reference: https://docs.digitalocean.com/reference/doctl/reference/compute/droplet/create/
- Drone GitHub provider docs: https://docs.drone.io/server/provider/github/
- Drone Docker runner installation docs: https://docs.drone.io/runner/docker/installation/
- Drone `DRONE_STATUS_NAME` reference: https://docs.drone.io/server/reference/drone-status-name/
- Infisical Docker and Compose guidance: https://infisical.com/docs/documentation/getting-started/docker and https://infisical.com/docs/integrations/platforms/docker-compose
- GitHub required status-check troubleshooting: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks?apiVersion=2022-11-28
- Cloudflare Tunnel configuration docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/
