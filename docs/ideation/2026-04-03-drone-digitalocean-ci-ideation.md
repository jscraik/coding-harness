---
title: "Ideation: Drone CI on DigitalOcean with CLI-first bootstrap"
date: "2026-04-03"
status: "proposed"
route: "fresh"
authors:
  - "Codex"
last_validated: 2026-04-18
---

# Ideation: Drone CI on DigitalOcean with CLI-first bootstrap

## Table of Contents
- [Codebase Context](#codebase-context)
- [Ranked Ideas](#ranked-ideas)
- [Rejection Summary](#rejection-summary)
- [Session Log](#session-log)

## Codebase Context

This repository is not a generic application repo. It is a control plane for agentic development workflows, and its CI layer already has strong expectations around naming, aggregation, and migration contracts. The current CircleCI setup centers on a workflow-level surface that preserves the `pr-pipeline` required check even though work is split across `pr-fast` and `pr-slow`. That contract is reflected both in [.circleci/config.yml](../../.circleci/config.yml) and in [`.harness/ci-required-checks.json`](../../.harness/ci-required-checks.json), so any self-hosted replacement should preserve that external check identity rather than treating Drone as a standalone clean slate.

The repo also already treats Cloudflare-adjacent tooling as normal, and it contains migration and governance surfaces for CI orchestration rather than a separate self-hosting bootstrap system. There is no existing Drone implementation in the codebase, which means a direct “swap CircleCI for Drone” move would create both operational drift and product drift unless we explicitly define how Drone fits into the harness’s required-check and parity model.

That grounding changes the recommendation. The best improvements are not “more infrastructure.” They are the additions that make a Drone lane reproducible, contract-preserving, and automation-friendly for this repo’s current shape.

## Ranked Ideas

### 1. Add a `doctl`-first infrastructure bootstrap lane

**Description**

Introduce a CLI-first provisioning path built around `doctl` instead of relying on the DigitalOcean UI for droplet setup. The lane should cover project selection, SSH key registration, tags, firewall rules, droplet creation, and cloud-init delivery. Treat the UI as a fallback, not the primary runbook.

**Rationale**

This directly improves the original plan’s weakest implementation point: it is still mostly manual. A `doctl` lane makes infrastructure creation reproducible, scriptable, and reviewable. It also fits the repo’s broader preference for command-contract workflows over click-ops. For this specific repo, reproducibility matters because CI migration work should be demonstrable and repeatable if the environment has to be rebuilt.

**Implementation shape**

- Create a bootstrap script or documented command sequence that wraps:
  - `doctl auth init`
  - `doctl compute ssh-key list` and optional registration
  - `doctl compute firewall create`
  - `doctl compute droplet create`
  - cloud-init attachment for first-boot Docker and Cloudflared setup
- Store only templates and docs in-repo; never store tokens or private infrastructure credentials.
- Prefer idempotent command generation over one-off shell snippets.

**Downsides**

The DigitalOcean CLI becomes another operator dependency, and the first pass has to decide how much abstraction belongs in this repo versus a separate example or scaffold.

**Confidence**

High

**Complexity**

Medium

**Status**

Keep

### 2. Preserve `pr-pipeline` via a Drone-to-GitHub status bridge

**Description**

Design the Drone migration so that branch protection still sees `pr-pipeline` as the stable required surface, even if Drone executes multiple underlying stages. This could be implemented through a small status bridge, a GitHub check publisher step, or a migration contract that maps Drone results back onto the existing required-check name.

**Rationale**

This is the highest-leverage repo-specific idea. The current repo already depends on `pr-pipeline` as the canonical required check. If a Drone migration replaces that with new check names, then the infrastructure move also becomes a branch-protection migration, a docs migration, and a harness-governance migration. Preserving the external check name sharply reduces blast radius.

**Implementation shape**

- Keep Drone jobs internally split for fast and slow work.
- Add a final status publication step that emits a single GitHub Check or Status named `pr-pipeline`.
- Validate parity against the existing required-check JSON and CI migration docs before cutover.

**Downsides**

It adds a small compatibility layer, and that layer must be maintained. However, removing it would push more migration work onto every downstream consumer of the CI contract.

**Confidence**

High

**Complexity**

Medium

**Status**

Keep

### 3. Separate UI access from webhook ingress at the edge

**Description**

Refine the Cloudflare pattern so the human-facing Drone UI and GitHub webhook ingress are not coupled behind the same Cloudflare Access gate. Use either a separate hostname or an explicit bypass policy for the webhook path.

**Rationale**

This addresses a likely failure mode in the original plan. Cloudflare Access is good for protecting the UI, but if it sits in front of the same hostname or path GitHub needs to reach for webhook delivery, builds can fail in a way that looks like Drone instability. Separating those concerns makes the deployment more robust without making it much more complex.

**Implementation shape**

- Use a protected hostname such as `ci.example.com` for the UI.
- Use an ingress-safe hostname or path such as `ci-hook.example.com` or `/hook` with explicit bypass.
- Document this as a non-optional deployment rule.

**Downsides**

This slightly increases DNS and tunnel configuration complexity, but it prevents a more expensive debugging class later.

**Confidence**

High

**Complexity**

Low

**Status**

Keep

### 4. Package the install as a self-hosted CI bootstrap bundle

**Description**

Instead of a prose-only setup guide, define a single bootstrap bundle that includes a cloud-init template, a Compose file, Cloudflared service configuration, and an operator runbook. The goal is that the first server setup is almost entirely generated rather than hand-assembled.

**Rationale**

This turns the plan from “a list of commands” into a reusable install surface. That matters because CI infrastructure tends to be rebuilt only when something goes wrong, and prose-only setup guides are fragile under pressure. A bundle also gives the repo a cleaner way to express what is part of the supported self-hosted story.

**Implementation shape**

- `docker-compose.yml` for Drone server and runner
- cloud-init example for Ubuntu first boot
- Cloudflared service config
- operator env template with explicit secret placeholders
- short verification checklist for webhook health, runner health, and GitHub status publication

**Downsides**

This is more work than writing a guide, and it risks becoming a maintenance burden if the repo does not actually intend to own self-hosted CI bootstrap as a productized path.

**Confidence**

Medium-high

**Complexity**

Medium-high

**Status**

Keep

### 5. Add secrets discipline as part of the bootstrap, not as an afterthought

**Description**

Improve the implementation by standardizing how secrets are injected into Drone and supporting services. Avoid raw multiline secrets inside `.env` files and prefer secret references or runtime injection compatible with deterministic CLI workflows.

**Rationale**

The original plan includes brittle secret handling patterns, especially around PEM material. This repo already values governance and deterministic setup flows, so secret handling should be part of the initial design rather than an optional hardening pass.

**Implementation shape**

- Use file mounts or secret files for PEM data instead of inline env values.
- Keep the env template free of command substitution.
- If the operator already uses a CLI-backed secret manager, document the injection flow rather than encouraging copy-paste.

**Downsides**

This adds setup choices and may require selecting a preferred secret workflow, which can introduce policy questions if the repo wants to stay provider-neutral.

**Confidence**

High

**Complexity**

Low-medium

**Status**

Keep

### 6. Add a rollback-first operating model for the self-hosted lane

**Description**

Treat rollback and rebuild as first-class parts of the proposal. Before switching CI ownership, define how to snapshot, rebuild, or replace the runner host with minimal downtime and how to revert the GitHub-side integration if Drone becomes unhealthy.

**Rationale**

This is a strong operational idea because the whole motivation for leaving CircleCI is control. That control only pays off if recovery is also owned. A rollback-first model would keep the migration honest and reduce fear around cutover.

**Implementation shape**

- Rebuild instructions using the same `doctl` bootstrap path
- documented fallback to previous hosted CI while branch-protection surfaces remain stable
- operational checks for tunnel, webhook delivery, runner registration, and final GitHub status publication

**Downsides**

It adds process overhead and may feel premature before a first successful installation exists.

**Confidence**

Medium

**Complexity**

Medium

**Status**

Keep

### 7. Make Drone a first-class `ci-migrate` target in the harness

**Description**

Extend the harness so Drone becomes an explicit migration target rather than an off-repo manual experiment. That would let the same control plane reason about parity, required checks, and migration evidence across CircleCI and Drone.

**Rationale**

This is the most ambitious and most repo-aligned idea. If this repository wants to be a control plane for CI governance, then self-hosted Drone support could become a real capability rather than a one-off deployment note. It also aligns with the repo’s existing `ci-migrate` framing in the README.

**Implementation shape**

- new migration target or mode for Drone
- parity checks against existing workflow contracts
- generated docs or manifests for status mapping and cutover validation

**Downsides**

This is a strategic product expansion, not just an implementation improvement. It carries the largest maintenance cost and should only move forward if there is real appetite to support Drone beyond one deployment.

**Confidence**

Medium

**Complexity**

High

**Status**

Keep as strategic bet

## Rejection Summary

| Idea | Why it was rejected now |
| --- | --- |
| Start with Kubernetes or managed orchestration | Too much infrastructure complexity for the current goal; it solves scale before reliability and repeatability are proven. |
| Separate runner host from day one | Useful later, but it increases operational footprint before a single-box path has been validated. |
| Build autoscaling runners immediately | Premature for a low-concurrency bootstrap and distracts from preserving the current CI contract. |
| Add artifact storage and cache services in v1 | Helpful eventually, but not necessary to prove cutover, GitHub signaling, and runner stability. |
| Keep UI and webhook ingress behind the same Access-protected endpoint | High risk of silent webhook breakage and avoidable operational confusion. |
| Inline PEM and secret material directly in `.env` | Brittle, unsafe, and hard to rotate; it recreates the same class of secret-handling failure the broader workflow is trying to avoid. |

## Session Log

- Reviewed the current repo CI contract and verified that the canonical required-check surface is still `pr-pipeline`.
- Verified there is no existing Drone implementation in the repo, so the ideation needed to focus on fit and migration boundaries rather than extension of an existing subsystem.
- Shaped the ideas around contract preservation, CLI-driven reproducibility, and self-hosted operational safety instead of pure infrastructure breadth.
