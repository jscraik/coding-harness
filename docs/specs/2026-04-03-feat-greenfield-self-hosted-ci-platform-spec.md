---
title: Greenfield Self-Hosted CI Platform with Infisical
type: feat
status: draft
date: 2026-04-03
deepened: 2026-04-03
origin: docs/brainstorms/2026-04-03-greenfield-self-hosted-ci-platform-requirements.md
risk: high
spec_depth: full
ui_required: false
---

# Greenfield Self-Hosted CI Platform with Infisical

## Enhancement Summary

**Deepened on:** 2026-04-03
**Mode:** targeted-confidence
**Key areas improved:** lifecycle gates, trust boundaries, failure promotion rules, observability, validation, cutover safety

- Tightened the platform lifecycle with explicit readiness, promotion, degradation, and rollback semantics instead of relying on broad cutover prose.
- Clarified service identity ownership, trust boundaries, and secret-handling constraints so planning does not have to infer what may or may not hold sensitive state.
- Strengthened the failure model and acceptance matrix around route separation, secret rotation, and cutover gating.
- Resolved the `CheckBridge` contract to use Drone's native GitHub commit status publication with a pinned status context name, rather than leaving v1 open-ended between commit-status and check-run models.
- Defined the Drone state contract for v1: persistent on-host state for restart-level recovery, plus deterministic repo re-enrollment for full host replacement.
- Scoped self-hosted cutover explicitly to this repository only and limited trusted execution to trusted internal change sources.
- Added a non-colliding staging publication mode so rehearsal can prove the self-hosted path before the canonical `pr-pipeline` context transfers authority.

> **External grounding refreshed:** 2026-04-03 against current DigitalOcean `doctl`, Drone, Infisical, and Cloudflare primary docs. The contract assumes Drone's documented GitHub OAuth path for v1, Infisical Machine Identity for Compose-backed services, and a locally managed Cloudflare Tunnel config with explicit ingress ordering and catch-all behavior.

## Table of Contents
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants / Safety Requirements](#invariants--safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

## Problem Statement

The current operating model combines two unstable dependencies:

1. runtime secrets distributed through a `.env`-centric path that has proven fragile under 1Password-managed state
2. CI execution delegated to CircleCI-hosted workflows that are vulnerable to plan and credit limits

The user wants a pipeline built from scratch that replaces both failure classes at once. The replacement must be deterministic to provision, deterministic to rebuild, and deterministic to operate. It must also preserve one stable GitHub required-check surface during cutover so the reset does not create a second outage in branch protection and merge policy.

This spec defines the contract for a greenfield self-hosted CI platform built on:

- DigitalOcean for compute
- `doctl` plus cloud-init for provisioning
- Drone for CI orchestration
- Infisical for runtime secrets
- Cloudflare Tunnel and Access for exposure control
- GitHub as the system of record for pull requests and required checks

## Goals

1. Replace 1Password-managed real `.env` runtime dependence with Infisical-backed runtime secret delivery.
2. Replace CircleCI-hosted execution with self-hosted CI execution on user-controlled infrastructure.
3. Ensure the platform can be provisioned and rebuilt from a CLI-first operator path rather than dashboard memory.
4. Preserve a single stable GitHub required-check surface named `pr-pipeline` during cutover.
5. Keep UI protection and webhook ingress separate so human authentication does not break machine delivery.
6. Make failure states diagnosable through explicit health checks, logs, and operator verification.
7. Constrain v1 self-hosted cutover to this repository only so migration risk stays local and auditable.

## Non-Goals

- Adding Drone as a first-class `activeProvider` enum value in harness contracts for v1
- Building a custom UI or replacing the Drone UI
- Multi-host high availability, autoscaling runners, or multi-region execution in v1
- Artifact storage, advanced remote caching, or build-farm optimization in v1
- Kubernetes, Swarm, Nomad, or other orchestration layers beyond Docker Compose on a single host
- Replacing GitHub as the system of record for pull requests, reviews, or branch protection
- Preserving CircleCI internal topology beyond what is necessary to keep `pr-pipeline` stable at the GitHub edge

## System Boundary

**Owns**

- a bootstrap package for a single DigitalOcean CI host using `doctl` and cloud-init
- a host runtime package that starts:
  - Cloudflared
  - Drone server
  - Drone Docker runner
- a persistent Drone server state directory for restart-level recovery
- an Infisical-authenticated runtime secret model for the Drone services
- a GitHub-facing status publication contract that preserves `pr-pipeline`
- a cutover and rollback model for transitioning from hosted CI to the self-hosted platform
- an operator verification path proving end-to-end readiness
- a structured verification artifact written to a deterministic repo-local path during operator-driven cutover work

**Does not own**

- changing downstream repository test commands or app-specific build logic
- changing coding-harness provider schemas or CLI provider enumerations in v1
- running or self-hosting Infisical itself
- changing GitHub PR review semantics or CodeRabbit policy
- long-term scaling beyond a single-host platform

**System context**

```text
GitHub
  |- PR events
  |- branch protection
  \- required check: pr-pipeline
       |
       v
Cloudflare edge
  |- UI hostname protected by Access
  \- webhook-safe hostname or path
       |
       v
DigitalOcean CI host
  |- cloudflared
  |- drone server
  |- drone docker runner
  \- Infisical-authenticated secret retrieval
```

## Core Domain Model

### Platform entities

| Entity | Purpose | Owned state |
| --- | --- | --- |
| `BootstrapConfig` | Canonical operator input for provisioning | region, size, image, tags, SSH keys, cloud-init file path |
| `CIHost` | The single DigitalOcean machine that runs the platform | droplet id, hostname, tunnel config, Compose project |
| `TunnelRoute` | Cloudflare routing contract | protected UI hostname, webhook-safe hostname or path, ingress ordering |
| `SecretIdentity` | Non-interactive Infisical workload identity | service identity credentials, environment scope, access policy |
| `DroneServer` | CI control plane | GitHub OAuth config, server host/proto, RPC secret, repository enablement |
| `DroneStateStore` | Restart-safe persistent control-plane state | mounted `/data` path, repo enablement metadata, local database file, deterministic re-enrollment inputs |
| `DroneRunner` | Job execution agent | RPC host/proto/secret, runner capacity, docker socket binding |
| `CheckBridge` | GitHub-facing publication surface | Drone-native GitHub commit status contexts `pr-pipeline-staging` in staging and `pr-pipeline` in primary, never both on the same SHA at the same time |
| `CutoverState` | Migration position of the repo | hosted-primary, self-hosted-staging, cutover-ready, self-hosted-primary, rollback |
| `CutoverRepoScope` | Repository enrollment boundary for v1 | current repository only during cutover; no multi-repo migration fan-out in v1 |
| `PlatformReadinessState` | Operational posture of the CI host | provisioned, bootstrapping, secrets-ready, routes-ready, runner-ready, staging, primary, degraded, rollback |
| `VerificationProbe` | Deterministic operator proof of readiness | infra health, secret access, webhook receipt, runner registration, check publication |

### Secret classes

| Class | Examples | Storage rule |
| --- | --- | --- |
| `Bootstrap-only secret` | DigitalOcean API token, initial Cloudflare tunnel credential placement, initial Infisical machine identity bootstrap | Never committed; operator-managed outside repo; minimal set only |
| `Runtime platform secret` | Drone GitHub OAuth client id and secret, Drone RPC secret, service auth values | Stored in Infisical and injected at runtime |
| `Derived runtime config` | service hostnames, runner name, capacity | Template-controlled; may live in checked-in examples |

### Service identities

| Identity | Scope | May read | Must not read |
| --- | --- | --- | --- |
| `drone-server-identity` | Drone server process only | GitHub OAuth config, Drone RPC secret, server-local configuration secrets | runner-only or future app-specific execution secrets |
| `drone-runner-identity` | Drone runner process only | runner connectivity secret material and any explicitly approved execution-time platform secrets | Drone server OAuth credentials or unrelated operator secrets |
| `operator-bootstrap-identity` | manual bootstrap or rebuild only | minimum credentials needed to provision host, attach tunnel, and establish service identities | long-lived runtime secret set after services are live |

### Trust boundaries

| Boundary | Trusted side | Untrusted or lower-trust side | Required rule |
| --- | --- | --- | --- |
| GitHub webhook edge | webhook-safe route and Drone server receiver | public Internet | requests must be routable without human Access flow and must not share a policy that can silently block delivery |
| Human UI access | Access-protected UI hostname | anonymous or non-authorized browser traffic | UI requires identity gate; webhook path does not inherit UI-only access semantics |
| Secret retrieval | scoped Infisical service identity | host shell sessions, checked-in env files, unrelated services | each service can fetch only its own platform secrets |
| Job execution | Drone runner container execution | host control-plane configuration and operator secrets | CI job execution must not require broad host secret visibility beyond the explicitly injected runtime set |

### Contract stance for v1

The repo's existing governance surfaces still assume `circleci` or `github-actions` as provider categories. This spec does **not** require a simultaneous harness schema expansion to represent Drone. Instead, v1 treats the self-hosted platform as an external CI runtime that must preserve the GitHub-edge contract (`pr-pipeline`) while productized provider support remains future work.

V1 cutover scope is explicitly limited to **this repository only**. The platform does not attempt a workspace-wide or multi-repository migration during the first rollout.

## Main Flow / Lifecycle

### 1. Bootstrap lifecycle

1. Operator authenticates `doctl`.
2. Operator provisions the CI host using a checked-in bootstrap package and cloud-init file.
3. Cloud-init installs Docker, Docker Compose support, Cloudflared, and base host dependencies.
4. Cloud-init or first-run bootstrap writes non-secret service configuration and prepares directories.
5. Bootstrap creates a persistent Drone server state directory mounted to `/data` for restart-level continuity on the active host.
6. Bootstrap places only the minimum external credentials needed for:
   - Cloudflare tunnel operation
   - Infisical service authentication
7. Compose starts Cloudflared, Drone server, and Drone runner.

### 2. Runtime secret lifecycle

1. Each long-lived service authenticates to Infisical non-interactively.
2. Each service retrieves only the secrets scoped to its workload.
3. Secret material is injected into the service process at startup.
4. Secret fetch failure prevents service readiness and is surfaced as a hard startup error.
5. Secret rotation is handled by service restart or controlled credential refresh; v1 does not rely on in-process hot rotation semantics.

**v1 secret decision**

- Use **service-level Infisical machine identities** rather than one host-wide human login session.
- Use **runtime injection** rather than checked-in real `.env` files.
- Use checked-in env files only as examples or templates.
- Treat secret rotation as an operator-visible event that requires readiness re-verification before the platform returns to `primary`.

### 2a. Control-plane state decision

- The Drone server persists its local state on a mounted `/data` path for normal restart and in-host recovery.
- V1 full-host replacement does **not** require a database-preserving restore workflow. Instead, it requires deterministic recreation of Drone control-plane state for this repository only using bootstrap inputs, repo enablement steps, and post-bootstrap verification.
- This keeps v1 rebuild semantics simple and repo-scoped while still avoiding ad hoc manual rediscovery.

### 2b. Execution trust policy

- V1 self-hosted execution is limited to this repository and **trusted internal branches / pull requests** during cutover.
- Pull requests originating from forks or other untrusted sources must not receive trusted self-hosted execution or pull-request-readable secrets on the Docker-socket runner.
- If untrusted PR coverage is needed later, it must use a separately specified isolation strategy or remain on the pre-existing trusted CI path until such isolation exists.

### 3. Edge and access lifecycle

1. Cloudflared starts from a locally managed tunnel configuration file.
2. A protected UI hostname routes to the Drone server UI.
3. A webhook-safe route remains publicly reachable for GitHub webhook delivery.
4. Access policies apply only to the human-facing surface, never to the webhook route in a way that blocks GitHub delivery.
5. Ingress ordering is explicit and ends with a catch-all deny or `http_status:404` route so unmatched traffic never falls through unpredictably.

### 4. Pull request execution lifecycle

1. GitHub emits a webhook for a PR event.
2. The webhook reaches the Drone server through the webhook-safe route.
3. Drone schedules a pipeline onto the Docker runner.
4. The runner executes the repo-defined jobs.
5. Internal job fan-out is allowed, but the platform must expose exactly one canonical GitHub **status-check surface** named `pr-pipeline` when it becomes primary.
6. GitHub branch protection evaluates `pr-pipeline` as the stable public CI surface.

If any internal job required to satisfy the canonical CI contract fails, the published `pr-pipeline` result must fail. The bridge must not publish success while any gated internal leg remains incomplete or red.

**v1 CheckBridge decision**

- The platform uses Drone's native GitHub **commit status** publication path.
- In `self-hosted-staging`, the publication context is pinned to `pr-pipeline-staging`.
- In `self-hosted-primary`, the publication context is pinned to `pr-pipeline`.
- V1 does **not** introduce a parallel GitHub Check Run publisher with the same name.
- If richer GitHub Checks semantics are desired later, they must be added as a separate migration because GitHub treats a status and a check with the same required name as independently required.

**staging publication strategy**

- While CircleCI remains authoritative for this repository, Drone must not publish the canonical `pr-pipeline` context on the same PR SHA.
- Staging verification uses the non-canonical context `pr-pipeline-staging` on this repository so the self-hosted path can be observed without colliding with the current authority.
- Promotion to `self-hosted-primary` includes switching the status context from `pr-pipeline-staging` to `pr-pipeline` in a controlled cutover window for this repository.

### 5. Cutover lifecycle

| State | Meaning | Exit condition |
| --- | --- | --- |
| `hosted-primary` | CircleCI remains authoritative | self-hosted stack bootstrapped and verified |
| `self-hosted-staging` | self-hosted stack runs verification or limited dry-run traffic on this repository | webhook delivery, runner registration, and non-colliding staging publication proven |
| `cutover-ready` | self-hosted stack is ready to own PR execution for this repository | branch-protection-safe `pr-pipeline` publication handoff confirmed |
| `self-hosted-primary` | self-hosted stack owns PR CI execution | sustained healthy execution |
| `rollback` | hosted CI resumes authority | self-hosted path degraded or unsafe |

The cutover contract requires **stable external check continuity**. The internal engine may change; the GitHub required-check surface may not drift during transition.

**Promotion gate**

The platform may only move from `self-hosted-staging` to `cutover-ready` when all of the following are true in the same verification window:

1. the Drone server is reachable
2. the runner is registered and accepting work
3. service identities can retrieve required Infisical secrets
4. GitHub webhook delivery is confirmed through the webhook-safe route
5. a representative PR pipeline publishes `pr-pipeline-staging` successfully while CircleCI still owns the canonical context
6. the controlled handoff step for this repository can switch the publication context to `pr-pipeline` without leaving two authorities active on the same SHA

If any one of these fails after entering `self-hosted-primary`, the platform transitions to `degraded` and rollback becomes the default safe action until the failure class is understood.

### 6. Rebuild lifecycle

1. Replace the host by rerunning the same bootstrap package with current operator credentials.
2. Recreate the mounted Drone state directory and service configuration from the bootstrap package.
3. Reattach Cloudflare tunnel credentials and Infisical service bootstrap secrets.
4. Start Compose services.
5. Deterministically re-enable this repository and restore the expected webhook / status-publication configuration.
6. Re-run the verification probe set.
7. Return the platform to `self-hosted-primary` only after all readiness checks pass.

### 7. Readiness state machine

| State | Meaning | Required evidence to advance |
| --- | --- | --- |
| `provisioned` | host exists but runtime is not yet configured | cloud-init or bootstrap package begins successfully |
| `bootstrapping` | host is installing base dependencies and runtime files | Docker, Cloudflared, and service config present |
| `secrets-ready` | service identities are configured and secret retrieval succeeds | Drone server and runner can read required Infisical values |
| `routes-ready` | UI and webhook routes are configured correctly | protected UI route and webhook-safe route both validate |
| `runner-ready` | control plane can accept CI work | Drone runner registered and healthy |
| `staging` | self-hosted platform can execute verification runs | representative CI run executes but is not yet primary |
| `primary` | self-hosted platform is authoritative | `pr-pipeline` publication and branch-protection-safe cutover confirmed |
| `degraded` | primary platform has failed one or more critical gates | operator triage or rollback decision required |
| `rollback` | authority moves back to prior trusted path | hosted CI or previous trusted authority restored |

## Interfaces and Dependencies

### External platform dependencies

**DigitalOcean**
- `doctl compute droplet create` supports `--user-data-file`, which may contain shell script or cloud-init YAML and is the required v1 bootstrap entrypoint.
- The CI host must be provisioned through a repeatable CLI flow, not only through the dashboard.

**Drone**
- Use the documented **GitHub OAuth application** server mode for v1.
- The Drone server must be publicly reachable by domain or IP for webhook receipt.
- The Docker runner must connect with `DRONE_RPC_HOST`, `DRONE_RPC_PROTO`, and `DRONE_RPC_SECRET`, and it requires `/var/run/docker.sock` binding.
- Drone's embedded database defaults to `/data/database.sqlite`; v1 therefore requires an explicit mounted `/data` path for restart-level persistence.

**Infisical**
- Use `infisical run --` or equivalent runtime injection semantics for service startup.
- For Compose-based services, prefer **Machine Identity** as the recommended authentication model.
- Service identities must be scoped per workload rather than using a single shared human session.

**Cloudflare**
- Use a locally managed tunnel configuration file with explicit ingress rules and a required catch-all rule.
- Access rules must protect the UI surface.
- The webhook route must either be on a separate hostname or use a narrower path-level rule that remains publicly reachable.

### External contract choices fixed by this spec

| Concern | v1 decision | Why |
| --- | --- | --- |
| Drone GitHub integration | GitHub OAuth application | current documented Drone server path is simpler and more established for v1 than introducing GitHub App-specific contract work |
| Runner topology | Docker runner on the same host as the server | smallest meaningful reset with controlled blast radius |
| Drone state model | mounted `/data` path for restart continuity plus deterministic repo re-enrollment for full host replacement | gives clear rebuild semantics for a single-repo v1 without introducing external database scope |
| Secret identity model | Infisical Machine Identity per long-lived service | removes human session dependence and keeps scopes narrow |
| Tunnel management | locally managed Cloudflared config file | deterministic ingress ordering and rebuildability |
| Cutover repo scope | current repository only | reduces migration risk and lets v1 rebuild semantics stay repo-specific |
| Public CI signal | single canonical `pr-pipeline` status-check surface in primary | preserves branch-protection continuity during migration |
| Staging publication mode | `pr-pipeline-staging` before primary handoff | avoids status-context collisions while CircleCI still owns `pr-pipeline` |
| Check publication primitive | GitHub commit status context via Drone native status publishing | Drone documents configurable status name via `DRONE_STATUS_NAME`; this avoids introducing a same-name GitHub Check Run requirement in v1 |
| Untrusted PR policy | self-hosted cutover excludes fork / untrusted PR execution | prevents Docker-socket runner trust escalation before an isolation design exists |

### Repo-grounded compatibility dependencies

- `.harness/ci-required-checks.json` currently maps many governed checks to the GitHub-facing check name `pr-pipeline`.
- `.harness/memory/LEARNINGS.md` records that `pr-pipeline` remains the expected branch-protection context even when work fans out internally.
- `README.md` positions `ci-migrate` as the repo's mechanism for staged migration, rollback, and parity evidence. This spec aligns with that posture but does not require immediate implementation changes to `ci-migrate`.

### Chosen v1 interface contracts

| Interface | Contract |
| --- | --- |
| GitHub -> Drone | GitHub webhook reaches Drone via webhook-safe route |
| Drone server -> runner | RPC over configured host/protocol/secret |
| Service -> Infisical | non-interactive service identity authentication and startup-time secret injection |
| GitHub <- CheckBridge | `pr-pipeline-staging` in staging for rehearsal, `pr-pipeline` only in primary |
| Operator -> platform | `doctl` bootstrap plus deterministic verification commands |
| Platform -> operator | health evidence sufficient to decide promote, hold, degrade, or rollback without shell forensics being the primary diagnostic path |

## Invariants / Safety Requirements

| ID | Invariant |
| --- | --- |
| `INV1` | Real runtime secrets are never committed into repo-managed `.env` files. |
| `INV2` | The bootstrap-only secret set remains minimal and does not expand to include ordinary runtime secrets. |
| `INV3` | Every long-lived service authenticates to Infisical non-interactively; human login sessions are never a production dependency. |
| `INV4` | The CI UI and webhook ingress must not share an Access policy that can block GitHub webhook delivery. |
| `INV5` | GitHub sees exactly one canonical required-check surface named `pr-pipeline` during cutover. |
| `INV6` | The host is disposable: rebuild must rely on the bootstrap package, not undocumented manual edits. |
| `INV7` | Failure to retrieve secrets or register the runner prevents readiness and must not degrade silently into partial service. |
| `INV8` | v1 does not require harness provider-schema changes; compatibility is preserved at the GitHub edge. |
| `INV9` | The bootstrap package, Compose files, and checked-in examples must not contain live secret values or multiline private key material. |
| `INV10` | The platform must not log raw secret values, persisted secret snapshots, or decrypted secret payloads as part of normal operation or verification. |
| `INV11` | Promotion to `primary` is blocked until route separation, secret retrieval, runner health, and canonical check publication all pass in the same readiness window. |
| `INV12` | Degraded primary state defaults to rollback-preferred behavior; the platform may not remain authoritative indefinitely while canonical check publication is broken. |
| `INV13` | v1 publishes `pr-pipeline` as a GitHub commit status context, not as a same-name combination of status and check run. |
| `INV14` | The Drone server has an explicit mounted `/data` state path for restart continuity, and full host replacement uses deterministic repo re-enrollment for this repository rather than ad hoc manual reconstruction. |
| `INV15` | Self-hosted cutover in v1 applies only to this repository and only to trusted internal change sources. |
| `INV16` | While CircleCI remains authoritative, Drone must not publish the canonical `pr-pipeline` context on the same PR SHA; staging uses `pr-pipeline-staging` instead. |
| `INV17` | Every operator verification run writes a structured artifact with `schema_version: 1` to a deterministic repo-local artifact path. |

## Failure Model and Recovery

### Failure classes

| Class | Symptom | Required response |
| --- | --- | --- |
| `BOOTSTRAP_FAILURE` | host not provisioned or cloud-init incomplete | fail provisioning, surface exact failing step, reprovision from bootstrap package |
| `SECRET_AUTH_FAILURE` | Infisical authentication or fetch fails | keep affected service unready, emit startup error, do not fall back to stale checked-in env |
| `SECRET_ROTATION_FAILURE` | rotated credentials break one service but not others | move platform to `degraded` unless affected service is non-critical; rerun readiness verification after correction |
| `EDGE_ROUTE_FAILURE` | UI unreachable or webhook route misrouted | fail verification, inspect cloudflared config and Access policy scope |
| `ACCESS_POLICY_COLLISION` | UI access policy starts intercepting webhook traffic | treat as a critical cutover blocker; separate the route policy before any promotion |
| `RUNNER_REGISTRATION_FAILURE` | runner cannot ping Drone server | keep platform in staging, inspect RPC config and Docker socket binding |
| `STATE_REENROLLMENT_FAILURE` | rebuilt host starts, but repository enablement or webhook/state recreation for this repository fails | keep platform non-primary; rerun deterministic enrollment steps instead of hand-editing state |
| `CHECK_PUBLICATION_FAILURE` | jobs run but GitHub does not receive `pr-pipeline` | treat as cutover blocker; do not promote self-hosted primary |
| `STAGING_PUBLICATION_COLLISION` | staging run attempts to publish `pr-pipeline` while CircleCI still owns the canonical context | treat as a cutover safety failure; revert to `pr-pipeline-staging` before continuing |
| `DUAL_SIGNAL_COLLISION` | both a status and a check run named `pr-pipeline` become required simultaneously | treat as contract drift; remove or rename the non-canonical publisher before promotion |
| `PARTIAL_PRIMARY_FAILURE` | UI is healthy but canonical check publication or webhook delivery is broken | transition to `degraded`; UI health alone is insufficient to stay primary |
| `CUTOVER_DRIFT` | branch protection expects different check than platform publishes | pause migration and repair edge contract before proceeding |
| `UNTRUSTED_PR_EXECUTION` | fork or otherwise untrusted PR is routed onto the trusted self-hosted runner path | block execution or remove it from self-hosted cutover scope immediately |
| `HOST_FAILURE` | droplet becomes unhealthy or lost | rebuild from bootstrap package and rerun verification probes |

### Recovery rules

- Recovery must prefer **rebuild over hand-repair** when a failure leaves host state ambiguous.
- Rollback must preserve PR safety by restoring the previously trusted CI authority before merge policies are relaxed.
- Secret failures must be corrected in Infisical or service identity configuration, never by committing secrets into repo files.
- Rebuild of a lost host restores service continuity by deterministic recreation for this repository, not by requiring operators to rediscover repo-enablement steps manually.
- Check publication failures are treated as first-order failures even if the internal pipeline succeeds.
- Same-name status-plus-check publication is treated as a configuration bug because it can turn one required surface into two independently required surfaces.
- Staging publication collisions are treated as cutover blockers because they make rehearsal evidence ambiguous.
- Untrusted PR routing onto the trusted runner path is treated as a security failure, not a workflow nuisance.
- Verification must be rerun after any credential rotation, route-policy change, or runner re-registration before the platform can return to `primary`.
- Recovery status is not complete until the canonical `pr-pipeline` status-check surface is observed again from the self-hosted path.

## Observability

### Required health signals

The platform must expose or make inspectable:

1. host bootstrap completion
2. cloudflared service health
3. Drone server health
4. Drone runner registration health
5. Infisical authentication success or failure per service
6. GitHub webhook receipt
7. canonical status publication for `pr-pipeline`
8. current `PlatformReadinessState`
9. last successful end-to-end verification timestamp
10. current cutover authority (`hosted-primary`, `self-hosted-primary`, or `rollback`)
11. current publication mode (`pr-pipeline-staging` or `pr-pipeline`)
12. current repository cutover scope and trusted-source policy

### Required operator verification probes

The verification path must prove, in order:

1. the host exists and is reachable
2. Cloudflared is running with the expected ingress configuration
3. the Drone server is reachable on the protected UI route
4. the webhook route accepts GitHub delivery
5. the runner is connected to the Drone server
6. the services can authenticate to Infisical and read required secrets
7. a staging test pipeline can complete and publish `pr-pipeline-staging`
8. the cutover handoff can switch the publication context to `pr-pipeline` for this repository without overlapping authorities
9. the platform records enough evidence to decide promote versus rollback without reading ad hoc shell history

### Logging expectations

- Cloudflared logs must show tunnel startup and route evaluation failures.
- Drone server logs must show webhook processing and repository dispatch.
- Drone runner logs must show server connectivity and job execution.
- Secret-auth failures must identify the failing service and auth step.
- Verification output must produce a deterministic pass/fail summary that can block cutover.

### Evidence contract

Each verification run must produce a compact evidence record containing:

- `schema_version: 1`
- verification start and finish time
- target host identity
- target repository identity
- readiness state before and after verification
- pass/fail result for each critical probe
- observed staging or canonical publication result
- promote / hold / rollback recommendation

The evidence record is written to:

- `.harness/artifacts/ci-platform-verification/<timestamp>.json`

The evidence record may still be ephemeral in v1, but it must be structured enough that planning can later decide whether to persist it into a formal cutover artifact.

## Acceptance and Test Matrix

| ID | Contract statement | Verification proof |
| --- | --- | --- |
| `SA1` | The CI host can be provisioned from a CLI-first flow using `doctl` and a checked-in cloud-init or equivalent bootstrap file. | Fresh-host bootstrap run completes without dashboard-only configuration steps beyond initial credential setup. |
| `SA2` | The bootstrap package produces a disposable host that can be rebuilt from the same source artifacts. | Rebuild rehearsal or documented replay uses the same bootstrap inputs and reaches ready state. |
| `SA3` | Real runtime secrets are not stored in committed `.env` files. | Repo artifact review shows templates only; runtime secrets are retrieved from Infisical. |
| `SA4` | Drone server and runner start successfully on the single v1 host. | Service logs show server readiness and successful runner registration. |
| `SA5` | Each long-lived service authenticates to Infisical non-interactively using a workload-scoped identity. | Startup verification proves secret retrieval for each service without human login state. |
| `SA6` | The Drone UI is protected for human users without blocking webhook delivery. | Protected UI requires Access; webhook route still receives GitHub delivery successfully. |
| `SA7` | The self-hosted pipeline can execute a representative PR workload on the Drone runner. | Test pipeline completes on the runner and records job logs. |
| `SA8` | GitHub receives one canonical required-check result named `pr-pipeline` from the self-hosted platform. | Pull request shows `pr-pipeline` status from the self-hosted path. |
| `SA9` | Cutover to self-hosted CI does not leave branch protection in an indeterminate state. | Migration rehearsal proves `pr-pipeline` continuity before hosted CI is retired. |
| `SA10` | Secret-auth, runner-registration, and check-publication failures are surfaced as hard readiness failures. | Fault-injection or controlled misconfiguration causes startup/verification to fail explicitly. |
| `SA11` | The platform includes a rollback path that restores trusted CI authority if self-hosted execution becomes unhealthy. | Rollback procedure is documented, rehearsable, and leaves one trusted required-check path. |
| `SA12` | An operator verification path proves host health, edge health, secret access, runner connectivity, and check publication end to end. | Deterministic verification summary passes only when all critical subsystems are healthy. |
| `SA13` | Secret rotation or identity replacement requires an explicit readiness re-check before the platform may remain or return to `primary`. | Controlled credential rotation triggers a new verification window before promotion or return-to-service. |
| `SA14` | Webhook ingress remains reachable even when the UI route is Access-protected. | Route validation proves webhook delivery succeeds while anonymous UI access remains blocked. |
| `SA15` | The platform emits a structured verification evidence record that supports promote, hold, degrade, or rollback decisions. | Verification output includes `schema_version: 1`, readiness state, probe results, publication mode, artifact path, and final recommendation. |
| `SA16` | The platform publishes `pr-pipeline` as one canonical GitHub commit status context without creating a same-name GitHub Check Run requirement in v1. | Pull request and commit-status inspection show exactly one canonical required surface for `pr-pipeline`. |
| `SA17` | Drone control-plane state survives ordinary service restarts and full host replacement has deterministic repo-state recreation for this repository. | Restart rehearsal preserves enabled repo state on the active host, and rebuild rehearsal recreates the repo enrollment / webhook path without ad hoc operator guesswork. |
| `SA18` | Self-hosted execution during cutover does not route fork or otherwise untrusted PRs onto the trusted Docker-socket runner path. | Event-policy verification and rehearsal show untrusted PRs are blocked, withheld from trusted execution, or remain on the pre-existing trusted CI path. |
| `SA19` | Staging verification does not collide with the canonical `pr-pipeline` publisher while CircleCI remains authoritative. | Rehearsal publishes `pr-pipeline-staging` during staging and only switches to `pr-pipeline` during the controlled cutover window. |

## Open Questions

- How much of the cutover should later be formalized into `ci-migrate` versus kept as a platform-specific operational runbook?

## Definition of Done

- A standard-spec artifact exists at the canonical `docs/specs/` path.
- The spec clearly defines boundary, lifecycle, dependencies, invariants, failure classes, recovery, and observability.
- The spec resolves the v1 architecture decisions needed before planning:
  - single DigitalOcean host
  - Drone as CI control plane
  - Infisical as runtime secret source
  - Cloudflare-protected UI with webhook-safe ingress
  - stable GitHub status-check surface `pr-pipeline`
  - GitHub OAuth for Drone server auth
  - service-level Infisical identities
  - mounted Drone `/data` state path plus deterministic repo-only state recreation on full rebuild
  - Drone-native commit status publication with `DRONE_STATUS_NAME=pr-pipeline-staging` in staging and `DRONE_STATUS_NAME=pr-pipeline` in primary
  - self-hosted cutover limited to this repository and trusted internal change sources
- The Acceptance and Test Matrix contains stable `SA` IDs that planning can reference directly.
- `ui_required` remains `false` because the work does not require a companion UI contract before planning.
