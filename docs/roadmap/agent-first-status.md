---
last_validated: 2026-07-11
---

# Agent-First Status Matrix

> Last updated: 2026-07-11
> Owner: Jamie Craik
> Review cadence: Weekly

This document tracks implementation status against the project north star, not
just feature completion.

The canonical north-star contract lives in
[north-star.md](./north-star.md).

## Table of Contents

- [North-Star Snapshot](#north-star-snapshot)
- [Outcome And Alignment Metrics](#outcome-and-alignment-metrics)
- [Legend](#legend)
- [Phase Implementation Status](#phase-implementation-status)
- [Agent-First Throughput v1 Pilot](#agent-first-throughput-v1-pilot)
- [CLI Surface Parity (P0/P1 Gap Closure)](#cli-surface-parity-p0p1-gap-closure)
- [Portable Installability Roadmap](#portable-installability-roadmap)
- [Eval And Trace Roadmap](#eval-and-trace-roadmap)
- [Outstanding Items](#outstanding-items)
- [Section 27 Optional Enhancements](#section-27-optional-enhancements)
- [References](#references)

## North-Star Snapshot

- Mission: let a solo developer with limited cognitive bandwidth orchestrate
  agentic software work to professional standards through compact orientation,
  executable guardrails, durable memory, and evidence-based handoff.
- Mnemonic: Thin Surface. Strong Guardrails. Durable Memory. Simplicity /
  Minimalism. Self Improvement. Professional Output.
- Personal standards: moral courage, self-discipline, respect for others,
  integrity, loyalty to self and others, and selfless commitment.
- Primary metric: PR lead time from open to merge.
- Primary bottleneck: review and rework loop cost.
- Boundary: low and medium-risk autonomy only; high-risk remains
  human-mediated.
- Safety floor: deterministic evidence, current-head SHA discipline, and clear
  rollback paths.
- Expected outcome: portable agent operating system. Coding Harness should make
  Codex behave like a software engineer, not merely a code generator, across
  greenfield and brownfield projects.
- Product bar: zero customer integration ceremony. Dropped-in agents should
  diagnose, bootstrap, validate, and explain blockers themselves.
- Leverage model: encode domain expertise into point-to-point agent outcomes,
  not generic artifacts that customers must adapt by hand.

This matrix should be read through that lens:

- shipped features matter only when they reduce review cost, remove manual glue
  work, or improve reliability on the path to lower PR lead time
- feature completion without throughput or reliability benefit is not north-star
  progress
- any future expansion of autonomy should be judged against the north-star
  contract above

## Outcome And Alignment Metrics

These rows are the canonical weekly metric surface for north-star alignment.
Each row links to the evidence index that names the contract, gate, receipt, or
curated weekly-review source behind the value.

### Primary Outcome Metrics

| Metric                                  | Current | Trend     | Evidence                                                                         | Notes                                                        |
| --------------------------------------- | ------- | --------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pr_lead_time_p50`                      | 18h     | improving | `agent-first-status-evidence.json:metrics.pr_lead_time_p50`                      | Median PR lead time is down from prior week baseline.        |
| `pr_lead_time_p90`                      | 41h     | improving | `agent-first-status-evidence.json:metrics.pr_lead_time_p90`                      | Tail latency is improving but still the main pressure point. |
| `review_rework_retry_rate`              | 0.92    | improving | `agent-first-status-evidence.json:metrics.review_rework_retry_rate`              | Fewer retries per PR indicates lower review-loop churn.      |
| `manual_interventions_per_agent_change` | 0.47    | improving | `agent-first-status-evidence.json:metrics.manual_interventions_per_agent_change` | Manual glue work is trending down.                           |
| `merge_readiness_block_time`            | 6.2h    | improving | `agent-first-status-evidence.json:metrics.merge_readiness_block_time`            | Time blocked before merge is reducing.                       |

### Alignment Health Metrics

| Metric                                             | Current | Trend     | Evidence                                                                                   | Notes                                              |
| -------------------------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `north_star_alignment_pass_rate`                   | 0.97    | improving | `agent-first-status-evidence.json:metrics.north_star_alignment_pass_rate`                  | Most runs pass north-star contract checks.         |
| `blocking_drift_findings_count`                    | 1       | improving | `agent-first-status-evidence.json:metrics.blocking_drift_findings_count`                   | Blocking drift findings are lower than prior week. |
| `surface_class_counts{core,adjacent,experimental}` | 2/3/0   | flat      | `agent-first-status-evidence.json:metrics.surface_class_counts`                            | Product-surface classes remain stable.             |
| `policy_surface_additions_without_glue_reduction`  | 0       | flat      | `agent-first-status-evidence.json:metrics.policy_surface_additions_without_glue_reduction` | No new policy-only surfaces landed this period.    |
| `cadence_breach_count`                             | 0       | flat      | `agent-first-status-evidence.json:metrics.cadence_breach_count`                            | No stale cadence breaches this cycle.              |

### Guardrail Effectiveness Metrics

| Metric                           | Current | Trend     | Evidence                                                                  | Notes                                      |
| -------------------------------- | ------- | --------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| `repeated_failure_class_count`   | 1       | improving | `agent-first-status-evidence.json:metrics.repeated_failure_class_count`   | Repeated failure classes are decreasing.   |
| `durable_guardrail_added_count`  | 1       | flat      | `agent-first-status-evidence.json:metrics.durable_guardrail_added_count`  | One durable guardrail promoted this cycle. |
| `post_guardrail_recurrence_rate` | 0.00    | improving | `agent-first-status-evidence.json:metrics.post_guardrail_recurrence_rate` | No post-guardrail recurrence observed.     |

Tie-back to north-star contract:

- Outcome trend is interpreted against `primaryMetric=pr_lead_time` and `primaryBottleneck=review_rework_loop`; green feature rows without improving throughput-path metrics are not treated as successful status.

## Legend

| Status         | Meaning                                              |
| -------------- | ---------------------------------------------------- |
| ✅ Implemented | Feature is complete, tested, and documented          |
| 🔶 Partial     | Core functionality exists; gaps or edge cases remain |
| 📋 Planned     | Specified but not yet implemented                    |
| ⏸️ Deferred    | Out of scope for current phase; may be revisited     |

## Phase Implementation Status

### Phase 1: Bootstrap

**Status:** ✅ Complete

| Component            | Status | Notes                                              |
| -------------------- | ------ | -------------------------------------------------- |
| Repository structure | ✅     | Standard layout with `src/`, `docs/`, `contracts/` |
| Build system         | ✅     | TypeScript + pnpm + `tsc` build                    |
| Testing framework    | ✅     | Vitest with comprehensive coverage                 |

### Phase 2: Contract Core

**Status:** ✅ Complete

| Component               | Status | Notes                                      |
| ----------------------- | ------ | ------------------------------------------ |
| Contract parser         | ✅     | JSON schema validation                     |
| Contract validator      | ✅     | Type-safe validation with error codes      |
| Risk-tier engine        | ✅     | Path-based tier classification             |
| Policy gates            | ✅     | `policy-gate` command with `--max-tier`    |
| Merge policy dual-shape | ✅     | Legacy array + roadmap object support (P1) |

### Phase 3: GitHub Workflows

**Status:** ✅ Complete

| Component       | Status | Notes                            |
| --------------- | ------ | -------------------------------- |
| review-gate     | ✅     | SHA enforcement, rerun dedupe    |
| policy-gate     | ✅     | Risk tier enforcement            |
| GitHub client   | ✅     | Octokit with rate limit handling |
| SHA enforcement | ✅     | Current HEAD SHA validation      |

### Phase 4: Installability

**Status:** ✅ Complete

| Component            | Status | Notes                                             |
| -------------------- | ------ | ------------------------------------------------- |
| init command         | ✅     | `--dry-run`, `--track`, `--rollback`, `--migrate` |
| Contract scaffolding | ✅     | Full policy output with defaults                  |

### Phase 5: Evidence + Observability

**Status:** ✅ Complete

| Component         | Status | Notes                           |
| ----------------- | ------ | ------------------------------- |
| evidence-verify   | ✅     | Screenshot + video support (P1) |
| Video evidence    | ✅     | MP4/WebM format detection (P1)  |
| gardener workflow | ✅     | Nightly maintenance             |

### Phase 6: Gardening

**Status:** ✅ Complete

| Component             | Status | Notes                       |
| --------------------- | ------ | --------------------------- |
| Nightly workflow      | ✅     | Scheduled maintenance tasks |
| Stale docs detection  | ✅     | Age-based flagging          |
| Broken link detection | ✅     | Link validation             |

### Phase 7: Memory Policy

**Status:** ✅ Complete

| Component          | Status | Notes                         |
| ------------------ | ------ | ----------------------------- |
| memory-gate        | ✅     | Session/tag enforcement       |
| Branch enforcement | ✅     | Memory policy validation      |
| Metrics tracking   | ✅     | Observation/learning counters |

## Agent-First Throughput v1 Pilot

> Source: [feat-agent-first-throughput-v1-pilot-plan](../plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md)

### Phase 1: Contract + Surface Parity

**Status:** ✅ Complete

| Component                 | Status | Notes                         |
| ------------------------- | ------ | ----------------------------- |
| pilotGapCasePolicy        | ✅     | Contract type + defaults      |
| pilotRollbackPolicy       | ✅     | Auto-trigger + manual release |
| pilotAuthzPolicy          | ✅     | Least-privilege enforcement   |
| check-authz command       | ✅     | Token scope validation        |
| check-environment command | ✅     | Governance preflight          |

### Phase 2: Deterministic Throughput Loop

**Status:** ✅ Complete

| Component                   | Status | Notes                        |
| --------------------------- | ------ | ---------------------------- |
| Contract-driven remediation | ✅     | Policy loading from contract |
| Current-head SHA filtering  | ✅     | Exact match enforcement      |
| Low/medium auto-apply       | ✅     | Tier-based gating            |
| Rerun dedupe                | ✅     | Comment marker helper        |

### Phase 3: Minimal Gap-Case Workflow

**Status:** ✅ Complete

| Component        | Status | Notes                        |
| ---------------- | ------ | ---------------------------- |
| gap-case command | ✅     | Open/resolve actions         |
| SLA enforcement  | ✅     | Configurable default         |
| Closure evidence | ✅     | Required when policy enabled |

### Phase 4: Pilot Scorecard + Promotion Gate

**Status:** ✅ Complete

| Component              | Status | Notes                          |
| ---------------------- | ------ | ------------------------------ |
| pilot-evaluate command | ✅     | Promote/hold/rollback outcomes |
| Rollback automation    | ✅     | Mode transitions               |
| Artifact validation    | ✅     | Schema version checks          |

## CLI Surface Parity (P0/P1 Gap Closure)

> Source: [feat-roadmap-cli-gap-closure-plan](../plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md)

### P0: Runtime/Docs/Test Truth

**Status:** ✅ Complete

| Component                  | Status | Notes                       |
| -------------------------- | ------ | --------------------------- |
| policy-gate dispatch       | ✅     | Wired in CLI                |
| risk-policy-gate alias     | ✅     | Terminology parity          |
| check-authz dispatch       | ✅     | Async handling              |
| check-environment dispatch | ✅     | Async handling              |
| pilot-evaluate dispatch    | ✅     | Exit code preservation      |
| pilot-rollback dispatch    | ✅     | Already wired               |
| README parity              | ✅     | Command index aligned       |
| .gitignore artifacts       | ✅     | pilot/ + ui-explore-output/ |

### P1: Capability Gaps

**Status:** ✅ Complete

| Component               | Status | Notes                       |
| ----------------------- | ------ | --------------------------- |
| Merge policy dual-shape | ✅     | Legacy + roadmap support    |
| Preflight headSha       | ✅     | CLI + types + dispatch test |
| Video evidence support  | ✅     | MP4/WebM + schema update    |

### P2: Narrative Clarity

**Status:** 🔶 Partial

| Component                         | Status | Notes                                                                              |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Status matrix (this doc)          | ✅     | Created                                                                            |
| Strategic docs normalization      | ✅     | Strategic status docs and implementation plans now cite this matrix as canonical   |
| README link                       | ✅     | README documentation section links to this matrix                                  |
| Ready-backlog narrative coherence | 🔶     | Keep this phase partial until status narrative and backlog lifecycle stay aligned. |

## Portable Installability Roadmap

This roadmap now treats portability as a product outcome, not a later packaging
task. The target is an installable Codex-native control plane that can land in
greenfield and brownfield repos while preserving local project truth.

Portability means adapting to each repo with the smallest useful surface, not
installing every harness capability everywhere.

The portability bar is no longer merely that `harness init` can be run by a
human. Agents dropped into a greenfield or brownfield workspace must be able to
self-orient, detect the local stack, run dry-run setup, identify credentials or
permission blockers, and select validation lanes without the customer wiring the
repo by hand first.

### Adoption Levels

| Level                          | Status     | Purpose                                                                                    | Proof Needed                                                                                                                        |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Level 0: Diagnose only         | 📋 Planned | Inspect repo state with no writes.                                                         | `harness init --dry-run --json` reports stack, existing surfaces, conflicts, proposed writes, and rollback plan.                    |
| Level 1: Thin operator surface | 🔶 Partial | Let dropped-in agents self-bootstrap the minimum Codex orientation and validation mapping. | `harness init` now scaffolds the GitBook public-docs contract and a repo-owned private-context reference without writing to Jamie Brain; brownfield patch-or-skip proof remains outstanding. |
| Level 2: Guardrails            | 🔶 Partial | Add executable checks for repeated PR/review failures.                                     | Metadata gates, rule lifecycle, review-context, and PR closeout evidence catch known failure classes before remote CI or merge.     |
| Level 3: Runtime evidence      | 🔶 Partial | Feed current repo truth into `runtime-card`, `pr-closeout`, and `harness next`.            | Missing integrations degrade to `unknown`; available git/PR/CI/Linear/session evidence changes recommendations deterministically.   |
| Level 4: Compounding memory    | 🔶 Partial | Convert failures into Project Brain, solutions, evals, and fixtures.                       | `he-reinforce` outputs map to durable rules only when evidence proves recurrence or resolution.                                     |

Unknown-provider semantics:

| Adoption Level | `unknown` Means                                                                          | Blocks Promotion?                                                             |
| -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Level 0        | Provider or local surface is absent or unreadable during diagnosis.                      | No, but it must appear in the installability report.                          |
| Level 1        | Required local validation or instruction ownership is ambiguous.                         | Yes, until skipped with an explicit reason or mapped to a local command.      |
| Level 2        | A governance gate cannot prove PR metadata, rule lifecycle, or required-check ownership. | Yes for the affected guardrail.                                               |
| Level 3        | CI, PR, Linear, session, or runtime evidence is unavailable.                             | Yes only when that provider is required by the repo contract or active phase. |
| Level 4        | A learning cannot be tied to evidence, scope, owner, or retirement condition.            | Yes; keep it as a hypothesis, not a durable rule.                             |

### Live Canary Repos

Live repos are canaries, not playgrounds. The first pass is read-only. Stable
failures become installer rules and fixtures only after the canary evidence is
understood.

| Repo                              | Role                                              | First Pass                                                           | Status     |
| --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
| `~/dev/agent-skills` (brownfield) | Brownfield repo with mature eval/workout patterns | Audit install state, eval model, and old/new harness surfaces.       | 📋 Planned |
| `~/dev/diagram-cli` (brownfield)  | Brownfield CLI with project-specific workflow     | Audit command discovery, validation mapping, and local instructions. | 📋 Planned |
| `~/dev/design-system` (product)   | Product/design repo                               | Audit visual/evidence workflow and frontend validation fit.          | 📋 Planned |
| `~/dev/x-writer` (active product) | Active app/product repo                           | Audit non-destructive adoption and runtime-card degradation.         | 📋 Planned |

Read-only canary command shape:

```bash
pwd
git status --short --branch
harness --version || true
harness doctor --json || true
harness init --dry-run --json || true
harness next --json || true
```

Brownfield safety rules:

| Rule                                                                               | Reason                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| No writes on first pass.                                                           | Preserve local project truth while classifying install risk.        |
| Always create a branch before applying.                                            | Keeps adoption reversible and reviewable.                           |
| Capture a before manifest.                                                         | Enables rollback and generated-surface ownership.                   |
| Never overwrite `AGENTS.md`, CI, scripts, or PR templates without a patch preview. | These are local governance surfaces, not blank scaffolding targets. |
| Prefer minimal profile first.                                                      | Protects the thin surface principle.                                |
| Record failures as installer evidence.                                             | Turns real portability pain into eval cases and guardrails.         |

## Eval And Trace Roadmap

The internal `agent-skills` repository (a reference repo demonstrating proof patterns for agent evaluation) provides the reference pattern for proving behavior:
structural mode for fast local iteration, trusted-live mode for real runner proof,
and release-ready mode for retained current-run evidence. Coding Harness should
reuse that shape instead of inventing a separate proof culture.

For high-level workflow skills, add a capture-the-flag-style win condition:
plant an observable flag in the UI, repository, product state, or tool surface,
run the skill, retain the session or trace evidence, let Codex reflect on each
failed attempt, commit targeted skill or harness improvements, and rerun until
the flag is captured or the blocker is named. This is the proof pattern for
workflows like logging in, uploading attachments and starting a chat, or
granting a group access to a workplace agent.

External AI workflow material reinforces the same loop: instrument real
executions, capture nested spans, curate production failures into datasets, add
human labels or expected outputs, then score future runs. Coding Harness should
use that vocabulary where it helps, while keeping data repo-local and portable.

The 2026-05-18 Coding Harness evidence consolidation keeps this roadmap pointed
at the same north star: trace-backed claim verification, missing-context
classification, deterministic recovery handlers, and no-secret trace hygiene are
roadmap refinements only when they reduce review or rework cost. They do not
justify a broader command surface or a new governance lane.

### Proof Modes

| Mode          | Purpose                | Required Evidence                                                                                            |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Structural    | Fast local confidence. | Schemas, command output shape, fixture dry-runs, and static validators pass.                                 |
| Trusted live  | Behavioral confidence. | Real Codex/session/CI/git/PR inputs run successfully against a live or canary repo.                          |
| Release-ready | Closeout confidence.   | Current-run evidence index records branch, commit SHA, `generatedAt`, commands, outcomes, and residual risk. |

### Trace Model

| Trace Concept | Coding Harness Meaning                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trace         | One PR loop, install attempt, canary audit, phase exit, or review remediation run.                                                                               |
| Span          | A named operation such as `doctor`, `init-dry-run`, `runtime-card`, `linear-gate`, `ci-state`, `review-context`, `validator`, `tool-call`, or `human-feedback`.  |
| Score         | Operational quality signal such as install safety, evidence freshness, next-action correctness, rollback completeness, stack health, or review-rework reduction. |
| Dataset       | Curated cases from canaries, CI failures, review failures, session collector evidence, and Project Brain solutions.                                              |
| Flag          | An observable workflow win condition that proves a skill closed the loop against live or canary product state.                                                   |

### Trace Execution Contract

| Span               | Command Or Source                                                   | Required Artifact                                                                                                         | Pass/Fail/Unknown Semantics                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doctor`           | `harness doctor --json`                                             | Doctor JSON or blocked command reason.                                                                                    | Pass when repo prerequisites are healthy; fail on required setup errors; unknown when command is absent in a canary repo.                                      |
| `init-dry-run`     | `harness init --dry-run --json`                                     | Installability report with proposed writes, conflicts, and rollback plan.                                                 | Pass when no unsafe overwrite exists; fail on locally owned required-surface conflict; unknown only before the command exists.                                 |
| `runtime-card`     | `harness runtime-card --json` or current runtime-card artifact      | `runtime-card/v1` evidence.                                                                                               | Pass when current evidence is fresh; fail on stale or contradictory evidence; unknown when optional providers are unavailable.                                 |
| `next`             | `harness next --json`                                               | `HarnessDecision` JSON.                                                                                                   | Pass when a safe next command and stop conditions are explicit; fail when required sources are blocked; unknown sources must stay visible in `meta`.           |
| `linear-gate`      | `harness linear-gate --json`                                        | Gate JSON with issue key and PR metadata result.                                                                          | Pass when metadata is current; fail before PR handoff if required references are missing; unknown if Linear is not part of the repo contract.                  |
| `pr-closeout`      | `harness pr-closeout --pr <number> --json` or normalized input      | `pr-closeout/v1` evidence with PR state, check state, tool state, dirty worktree state, and AI session/traceability refs. | Pass when closeout evidence is complete; fail on red checks, missing PR metadata, missing traceability, unresolved review blockers, or blocked required tools. |
| `ci-state`         | CI provider adapter or required-check mapping                       | CI/check evidence tied to branch and SHA.                                                                                 | Pass when required checks match current head; fail on red, stale, or missing required checks; unknown for optional providers.                                  |
| `reinforcement`    | `he-reinforce` output, solution record, or Project Brain update     | Solution, rule, fixture, or explicit skip reason.                                                                         | Pass when lesson has evidence and scope; fail when it would create stale doctrine; unknown remains a hypothesis.                                               |
| `claim-verifier`   | Trace, environment, PR, CI, or runtime evidence                     | Claim-vs-evidence result with checked facts and blocker class.                                                            | Pass when the claimed outcome matches independent evidence; fail on false success, missing verifier, or contradictory state.                                   |
| `recovery-handler` | Deterministic setup, auth, environment, CI, or review recovery path | Redacted recovery event with authority, action, resume state, and verifier impact.                                        | Pass when recovery is scoped, trace-visible, and verified; fail when it hides a real failure, leaks secrets, or lacks rollback.                                |
| `missing-context`  | PR comment, failed gate, discarded run, page, or user correction    | Classified missing-context record with durable destination or explicit rejection.                                         | Pass when the lesson has scope, owner, validation, and retirement condition; fail when it would become unbounded doctrine.                                     |

Canary audit artifacts should include resolved path, git remote, branch, commit
SHA, detected harness version, existing managed or locally owned surfaces, dry-run
writes, conflicts, rollback plan, provider availability, validation commands,
scores, and residual risk.

### Next Evaluation Slices

| Slice                              | Status     | Outcome                                                                                                                                |
| ---------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Live repo installability matrix    | 📋 Planned | Read-only audit across the four canary repos.                                                                                          |
| Minimal greenfield fixture         | 📋 Planned | Deterministic proof that fresh install creates only the thin operator surface.                                                         |
| Brownfield old-harness fixture     | 📋 Planned | Regression proof for managed and locally owned surface detection and rollback.                                                         |
| Runtime-card partial-adoption eval | 🔶 Partial | `harness next` remains useful when Linear, CI, Project Brain, or session evidence is unavailable.                                      |
| PR stack-health eval               | 📋 Planned | Upper PR work pauses when lower stack layers are red, behind, or conflicted.                                                           |
| Workflow skill flag eval           | 📋 Planned | High-level skills prove login, upload/chat, access-grant, and closeout flows by capturing explicit flags with retained trace evidence. |
| Claim-vs-evidence closeout eval    | 📋 Planned | Agent completion claims fail when PR, CI, runtime, or trace evidence contradicts them.                                                 |
| Recovery-handler safety eval       | 📋 Planned | Repeated setup/auth/environment blockers recover only with scoped authority, redacted traces, rollback, and verifier proof.            |
| Missing-context promotion eval     | 📋 Planned | Repeated failures become durable rules only with evidence, scope, owner, validation, and retirement condition.                         |

## Codex Alignment Assessment

Codex upstream is moving toward a runtime control plane with profiles,
workspace roots, permissions, diagnostics, memory extensions, lifecycle events,
trace IDs, and remote execution patterns. Coding Harness should align to the
stable concepts, not mirror every upstream feature as a harness feature.

Roadmap admission rule:

```text
Adopt Codex signals, not Codex sprawl.
```

The signals worth admitting now are workspace identity, permission scope,
trace IDs, lifecycle evidence, memory provenance, diagnostics, strict parsing,
and effective-root reporting. They directly support the north-star contract by
reducing PR closeout ambiguity, review or rework cost, and brownfield install
risk.

The concepts to defer are broad profile catalogs, remote executor registration,
daemon-style remote control, marketplace or share APIs, and app-server extension
surface area. They may become useful later, but adopting them before local PR
closeout, stack health, doctor, and runtime evidence are mature would increase
the visible operating surface without proven PR-lead-time benefit.

Current implication: deepen the existing cockpit and evidence commands before
adding new operator-facing modes.

### Current PR Closeout Slice

The active JSC-328 follow-up is now split between implemented local
pre-handoff evidence consumption and the remaining live PR integrations:

```text
Make PR closeout evidence stack-aware and review-thread-aware,
then let harness next consume pr-closeout/v1 as pre-handoff evidence.
```

This is still the highest-value next step because it directly targets the
primary bottleneck: review and rework coordination during PR closeout. It also
builds on current shipped surfaces instead of introducing a new command family.
The 2026-05-18 evidence consolidation strengthens this priority: the next slice
should make PR closeout a claim-vs-evidence verifier, not a checklist that can
trust an agent's final statement.

Implemented in the current local slice:

- `harness next --json --pr-closeout <path>` consumes `pr-closeout/v1` evidence
  before clean-worktree handoff and preserves compact closeout metadata.
- Non-ready closeout evidence produces a repair-phase blocker instead of a
  ready-to-merge recommendation.
- False-ready or shallow closeout artifacts are rejected as invalid evidence
  before they can unblock handoff.
- The agent-next-action parity eval now proves catalog discoverability, stale
  prompt-context promotion, non-ready closeout blocking, and false-ready artifact
  rejection together.

Remaining scope for the next slice:

- Add a GitHub review-thread adapter so unresolved GitHub and CodeRabbit review
  threads become live pr-closeout/v1 evidence instead of chat memory.
- Add parent or base PR stack-state evidence so upper PR work pauses when lower
  stack layers are red, behind, conflicted, or not merged.
- Interpret CodeRabbit and required-check state where available through the
  existing PR/check evidence path, without making CodeRabbit self-approval.
- Add claim-vs-evidence classification so an agent's ready/complete claim is
  rejected when PR, CI, review-thread, stack, runtime, or trace evidence
  disagrees.
- Define the small contract for pr-green-sweep to call
  harness pr-closeout --json instead of duplicating closeout classification
  inside agent-skills.

Definition of done:

- A stacked PR with a red, conflicted, or not-merged lower PR produces a
  `pause_above_unstable_stack` or equivalent non-ready recommendation.
- Unresolved review threads prevent a ready-to-merge recommendation unless the
  evidence explicitly marks them non-blocking.
- harness next --json can discover current PR closeout evidence without an
  explicit artifact path and surface the same readiness blocker.
- Ready/complete claims are accepted only when current evidence agrees, and
  false-success cases produce a named blocker rather than a successful closeout.
- Unknown optional providers remain visible as unknown; required providers
  block only when the repo contract or active phase requires them.
- The pr-green-sweep skill consumes the harness report shape rather than
  rebuilding GitHub, CircleCI, CodeRabbit, or Snyk classification logic.

Rejected alternatives:

- Do not add a broad profile system next. Existing local, pr, and CI
  next-action modes are enough until evidence proves another profile removes
  operator load.
- Do not start remote executor or daemon work next. The local PR closeout loop
  still contains higher-frequency coordination failures.
- Do not deepen Project Brain provider behavior before PR closeout consumption
  lands. Durable memory helps most after the live closeout truth is structured.

## Outstanding Items

### Non-Functional Requirements (Partial)

| Item                        | Status | Notes                                                                                       |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Serialized mutation queue   | ✅     | Implemented in `src/lib/github/mutation-queue.ts` and `GitHubClient.createIssueComment`     |
| Explicit retry/backoff      | ✅     | Implemented in `src/lib/github/mutation-queue.ts` with bounded exponential backoff + jitter |
| Authz preflight enforcement | ✅     | Applied in `postRerunCommentIfNeeded` before mutative writes                                |

### Integration Tests

| Scenario                 | Status | Notes                                                                 |
| ------------------------ | ------ | --------------------------------------------------------------------- |
| Happy path end-to-end    | ✅     | Covered by `src/commands/agent-first-throughput.integration.test.ts`  |
| Stale + race mixed path  | ✅     | Covered by `src/commands/agent-first-throughput.integration.test.ts`  |
| Governance hold contract | ✅     | Added to `postRerunCommentIfNeeded` tests for preflight hold behavior |

## Section 27 Optional Enhancements

| Enhancement              | Status                                  |
| ------------------------ | --------------------------------------- |
| Diff budget guardrails   | ✅ `harness diff-budget`                |
| UI loop commands         | ✅ `ui:fast`, `ui:verify`, `ui:explore` |
| Brainstorm/plan workflow | ✅ `brainstorm-gate`, `plan-gate`       |

## References

- [Agent-First Throughput v1 Pilot Plan](../plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md)
- [Roadmap/CLI Gap Closure Plan](../plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md)
- [Harness Implementation Plan](../HARNESS_IMPLEMENTATION_PLAN.md)
