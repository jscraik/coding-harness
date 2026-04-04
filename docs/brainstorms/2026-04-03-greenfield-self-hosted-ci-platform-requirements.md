---
title: Greenfield Self-Hosted CI Platform with Infisical
date: 2026-04-03
status: draft
spec_required: full
risk_level: high
complexity: large
---

# Greenfield Self-Hosted CI Platform with Infisical

## Table of Contents
- [Problem Frame](#problem-frame)
- [Approaches Considered](#approaches-considered)
- [Chosen Approach](#chosen-approach)
- [Requirements](#requirements)
- [Success Criteria](#success-criteria)
- [Scope Boundaries](#scope-boundaries)
- [Key Decisions](#key-decisions)
- [Dependencies / Assumptions](#dependencies--assumptions)
- [Outstanding Questions](#outstanding-questions)
- [Next Steps](#next-steps)

## Problem Frame

The current CI and secret-management path is creating repeated operator friction instead of reducing it. Two pain points are driving the reset:

1. Secret delivery depends on a `.env`-centric workflow that has proven fragile when backed by 1Password-managed runtime state.
2. CI execution depends on CircleCI workflows and hosted plan limits, which creates operational failures that are outside the repo's direct control.

The user wants a pipeline built from scratch, not another patch on the old stack. The new system should make infrastructure, secret injection, and CI execution deterministic, operator-controlled, and recoverable. It should also reduce the number of moving parts a person has to remember during setup or rebuild.

This brainstorm is therefore about defining the right greenfield platform shape, not preserving CircleCI or 1Password as first-class design constraints. Compatibility with existing GitHub branch protection may still matter during cutover, but it should not dictate the internal architecture.

## Approaches Considered

### Approach A: Minimal greenfield self-hosted stack on one DigitalOcean host (recommended)

Use a single DigitalOcean droplet provisioned by `doctl`, run Drone server and Drone runner on the same host, front the UI with Cloudflare Tunnel and Access, and use Infisical as the runtime secrets source. Keep one stable GitHub check as the public CI signal.

**Pros**
- Removes both current pain sources: 1Password `.env` workflow and CircleCI plan limits
- Smallest operator footprint that still gives full control
- Rebuildable from CLI and templates instead of click-ops
- Clear path to future split-host or multi-runner expansion

**Cons**
- One machine remains a single failure domain in v1
- Requires owning bootstrap, recovery, and GitHub integration details

**Best fit**
- A fast, controlled reset that prioritizes reliability and operator clarity over scale

### Approach B: Keep GitHub as CI orchestrator, self-host runners only

Keep GitHub as the workflow engine, move execution onto self-hosted runners on DigitalOcean, and still adopt Infisical for secret delivery.

**Pros**
- Simplifies GitHub status and webhook behavior
- Fewer new control-plane surfaces than Drone
- Easier for teams already comfortable with GitHub-native CI UX

**Cons**
- Does not fully reset the CI model; it still inherits GitHub Actions workflow and runner semantics
- Less aligned with the original plan's desire for a distinct self-hosted CI control plane
- Lower upside if the intent is to own the whole execution stack

**Best fit**
- Teams that mainly want to escape hosted runtime limits while keeping GitHub-native orchestration

### Approach C: Two-tier Drone platform from day one

Provision separate control-plane and runner hosts immediately, with stronger isolation and more future scaling headroom.

**Pros**
- Better operational separation
- Cleaner scaling story if workload grows quickly
- Stronger basis for future multi-runner capacity or specialized workers

**Cons**
- More complexity than the current problem requires
- More DNS, access, and recovery paths to manage up front
- Higher monthly cost and slower time to first working pipeline

**Best fit**
- Teams already certain they need more than one runner host in the near term

## Chosen Approach

Choose **Approach A: minimal greenfield self-hosted stack on one DigitalOcean host**.

This is the best fit because it attacks the actual failures directly without over-expanding scope:

- `doctl` replaces click-ops with reproducible infrastructure bootstrap
- Infisical replaces `.env`-first secret distribution with runtime injection
- Drone replaces CircleCI-hosted execution and plan-limit coupling
- Cloudflare secures the UI without exposing the host broadly

The recommended architecture is:

```text
GitHub
  |\
  | \ pull requests + statuses
  |  \
  |   -> Webhook ingress
  |
Cloudflare Tunnel
  |- protected UI hostname
  \- webhook-safe ingress path or hostname
        |
DigitalOcean droplet (CLI-provisioned via doctl)
  |- Drone server
  |- Drone runner
  \- Infisical-authenticated runtime secret retrieval
```

The key principle is:

**clean internals, stable edge**

Internally, the system should be rebuilt from scratch around deterministic bootstrap and secret injection. At the GitHub edge, the system should publish one stable required check during cutover so branch protection does not become a second migration problem.

## Requirements

**Bootstrap and provisioning**
- R1. The platform must be provisionable from a CLI-first operator flow using `doctl` rather than requiring the DigitalOcean UI for normal setup.
- R2. The initial host must be disposable and rebuildable from templates and scripts rather than relying on manual in-place configuration.
- R3. The bootstrap flow must install and configure the core platform services required for CI execution, edge access, and operator verification.

**Secret management**
- R4. Infisical must be the source of truth for runtime secrets used by the CI platform.
- R5. Real secrets must not be committed into repo-managed `.env` files; checked-in env files may exist only as examples or templates.
- R6. The platform must use a non-interactive runtime authentication path to Infisical suitable for long-lived automation.
- R7. The secret bootstrap surface outside Infisical must be minimized to the smallest set needed to authenticate infrastructure and secret retrieval.

**CI execution and GitHub integration**
- R8. The CI engine must run on infrastructure controlled by the user rather than depending on CircleCI-hosted plan capacity.
- R9. The platform must publish a single stable GitHub required-check surface for pull requests, even if work is split internally across multiple jobs.
- R10. The system must support a cutover path from the current hosted CI state without leaving the repo in a branch-protection limbo.

**Access and security**
- R11. Human access to the CI UI must be protected by Cloudflare Access or an equivalent identity gate.
- R12. GitHub webhook delivery must remain reachable without being blocked by the same human-auth flow that protects the UI.
- R13. The public network exposure of the host must be minimized, with tunnel-based access preferred over broad inbound service exposure.

**Operations and recovery**
- R14. The platform must include a verification path that proves host health, runner health, secret access, webhook receipt, and GitHub status publication.
- R15. The platform must include a rollback or fallback strategy for CI cutover failure.
- R16. The operator should be able to rebuild or replace the v1 host without reintroducing manual secret copy-paste or UI-dependent setup steps.

## Success Criteria

- A new DigitalOcean host can be provisioned from a documented `doctl`-first flow and reach a ready state without manual dashboard configuration beyond initial credential setup.
- Drone can receive GitHub webhook events and execute CI work on self-hosted infrastructure.
- Infisical supplies the runtime secrets required by the CI stack without relying on committed real `.env` files.
- The CI UI is protected for humans while webhook delivery still works reliably.
- GitHub sees one stable required check during pull request execution.
- The host can be rebuilt from the same bootstrap path after failure or replacement.
- The new platform removes both original pain points: 1Password-managed `.env` dependence and CircleCI plan-limit dependence.

## Scope Boundaries

- Not in scope for v1: autoscaling runners
- Not in scope for v1: multi-region or high-availability CI control plane
- Not in scope for v1: artifact storage or advanced remote build-cache infrastructure
- Not in scope for v1: Kubernetes or container-orchestration adoption
- Not in scope for v1: replacing GitHub as the system of record for pull requests and required checks
- Not in scope for v1: preserving CircleCI internal workflow topology beyond what is necessary for branch-protection-safe cutover

## Key Decisions

- **Use Infisical as the runtime secret source:** This directly addresses the current `.env` fragility and keeps secrets out of repo-managed real env files.
- **Use `doctl` as the normal infrastructure bootstrap path:** The new platform should be reproducible by command, not by memory.
- **Start with one host:** A single-host v1 gives the smallest reliable reset and avoids solving scale before reliability.
- **Use Drone as the v1 CI control plane:** The greenfield platform should reset the execution layer rather than keeping GitHub-hosted orchestration as the default.
- **Preserve `pr-pipeline` during cutover:** This keeps compatibility at the edge while allowing a clean internal redesign underneath.
- **Separate UI protection from webhook ingress:** Human auth and machine delivery must not be coupled in a way that silently breaks builds.

## Dependencies / Assumptions

- The user is willing to operate a DigitalOcean-hosted Linux box and associated credentials.
- The user is rolling out Infisical as the replacement runtime secrets provider.
- GitHub remains the system of record for source control, pull requests, and merge policy.
- Cloudflare is available for Tunnel and Access in the target environment.
- The v1 objective is reliability and operator clarity, not elastic scale.

## Outstanding Questions

### Deferred to Planning

- Affects R6. Technical question: Should Infisical authentication be host-level or service-level for the Drone server and runner in v1?
- Affects R3. Technical question: What should the exact bootstrap artifact set be: shell scripts only, shell plus cloud-init, or shell plus cloud-init plus Compose templates?
- Affects R14. Needs research: What is the smallest useful operator verification command set that proves the full platform is healthy after bootstrap or rebuild?

## Next Steps

-> `/ce:spec`
