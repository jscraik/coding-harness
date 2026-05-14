---
last_validated: 2026-05-13
---

# Agent-First Status Matrix

> Last updated: 2026-05-13
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
- [Outstanding Items](#outstanding-items)
- [Section 27 Optional Enhancements](#section-27-optional-enhancements)
- [References](#references)

## North-Star Snapshot

- Mission: let humans steer and agents execute safely.
- Primary metric: PR lead time from open to merge.
- Primary bottleneck: review and rework loop cost.
- Boundary: low and medium-risk autonomy only; high-risk remains
  human-mediated.
- Safety floor: deterministic evidence, current-head SHA discipline, and clear
  rollback paths.

This matrix should be read through that lens:

- shipped features matter only when they reduce review cost, remove manual glue
  work, or improve reliability on the path to lower PR lead time
- feature completion without throughput or reliability benefit is not north-star
  progress
- any future expansion of autonomy should be judged against the north-star
  contract above

## Outcome And Alignment Metrics

These rows are the canonical weekly metric surface for north-star alignment.

### Primary Outcome Metrics

| Metric                                  | Current | Trend     | Notes                                                        |
| --------------------------------------- | ------- | --------- | ------------------------------------------------------------ |
| `pr_lead_time_p50`                      | 18h     | improving | Median PR lead time is down from prior week baseline.        |
| `pr_lead_time_p90`                      | 41h     | improving | Tail latency is improving but still the main pressure point. |
| `review_rework_retry_rate`              | 0.92    | improving | Fewer retries per PR indicates lower review-loop churn.      |
| `manual_interventions_per_agent_change` | 0.47    | improving | Manual glue work is trending down.                           |
| `merge_readiness_block_time`            | 6.2h    | improving | Time blocked before merge is reducing.                       |

### Alignment Health Metrics

| Metric                                             | Current | Trend     | Notes                                              |
| -------------------------------------------------- | ------- | --------- | -------------------------------------------------- |
| `north_star_alignment_pass_rate`                   | 0.97    | improving | Most runs pass north-star contract checks.         |
| `blocking_drift_findings_count`                    | 1       | improving | Blocking drift findings are lower than prior week. |
| `surface_class_counts{core,adjacent,experimental}` | 2/3/0   | flat      | Product-surface classes remain stable.             |
| `policy_surface_additions_without_glue_reduction`  | 0       | flat      | No new policy-only surfaces landed this period.    |
| `cadence_breach_count`                             | 0       | flat      | No stale cadence breaches this cycle.              |

### Guardrail Effectiveness Metrics

| Metric                           | Current | Trend     | Notes                                      |
| -------------------------------- | ------- | --------- | ------------------------------------------ |
| `repeated_failure_class_count`   | 1       | improving | Repeated failure classes are decreasing.   |
| `durable_guardrail_added_count`  | 1       | flat      | One durable guardrail promoted this cycle. |
| `post_guardrail_recurrence_rate` | 0.00    | improving | No post-guardrail recurrence observed.     |

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
