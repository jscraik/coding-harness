---
last_validated: 2026-04-18
---

# Agent-First Implementation Status Matrix

> Last updated: 2026-04-18
> Owner: Jamie Craik
> Review cadence: Per-release or when status changes

This document tracks the implementation status of roadmap claims for the Agent-First Throughput initiative.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Implemented | Feature is complete, tested, and documented |
| 🔶 Partial | Core functionality exists; gaps or edge cases remain |
| 📋 Planned | Specified but not yet implemented |
| ⏸️ Deferred | Out of scope for current phase; may be revisited |

## Phase Implementation Status

### Phase 1: Bootstrap
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Repository structure | ✅ | Standard layout with `src/`, `docs/`, `contracts/` |
| Build system | ✅ | TypeScript + pnpm + Vite |
| Testing framework | ✅ | Vitest with comprehensive coverage |

### Phase 2: Contract Core
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Contract parser | ✅ | JSON schema validation |
| Contract validator | ✅ | Type-safe validation with error codes |
| Risk-tier engine | ✅ | Path-based tier classification |
| Policy gates | ✅ | `policy-gate` command with `--max-tier` |
| Merge policy dual-shape | ✅ | Legacy array + roadmap object support (P1) |

### Phase 3: GitHub Workflows
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| review-gate | ✅ | SHA enforcement, rerun dedupe |
| policy-gate | ✅ | Risk tier enforcement |
| GitHub client | ✅ | Octokit with rate limit handling |
| SHA enforcement | ✅ | Current HEAD SHA validation |

### Phase 4: Installability
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| init command | ✅ | `--dry-run`, `--track`, `--rollback`, `--migrate` |
| Contract scaffolding | ✅ | Full policy output with defaults |

### Phase 5: Evidence + Observability
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| evidence-verify | ✅ | Screenshot + video support (P1) |
| Video evidence | ✅ | MP4/WebM format detection (P1) |
| gardener workflow | ✅ | Nightly maintenance |

### Phase 6: Gardening
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Nightly workflow | ✅ | Scheduled maintenance tasks |
| Stale docs detection | ✅ | Age-based flagging |
| Broken link detection | ✅ | Link validation |

### Phase 7: Memory Policy
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| memory-gate | ✅ | Session/tag enforcement |
| Branch enforcement | ✅ | Memory policy validation |
| Metrics tracking | ✅ | Observation/learning counters |

## Agent-First Throughput v1 Pilot

> Source: [feat-agent-first-throughput-v1-pilot-plan](../plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md)

### Phase 1: Contract + Surface Parity
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| pilotGapCasePolicy | ✅ | Contract type + defaults |
| pilotRollbackPolicy | ✅ | Auto-trigger + manual release |
| pilotAuthzPolicy | ✅ | Least-privilege enforcement |
| check-authz command | ✅ | Token scope validation |
| check-environment command | ✅ | Governance preflight |

### Phase 2: Deterministic Throughput Loop
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Contract-driven remediation | ✅ | Policy loading from contract |
| Current-head SHA filtering | ✅ | Exact match enforcement |
| Low/medium auto-apply | ✅ | Tier-based gating |
| Rerun dedupe | ✅ | Comment marker helper |

### Phase 3: Minimal Gap-Case Workflow
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| gap-case command | ✅ | Open/resolve actions |
| SLA enforcement | ✅ | Configurable default |
| Closure evidence | ✅ | Required when policy enabled |

### Phase 4: Pilot Scorecard + Promotion Gate
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| pilot-evaluate command | ✅ | Promote/hold/rollback outcomes |
| Rollback automation | ✅ | Mode transitions |
| Artifact validation | ✅ | Schema version checks |

## CLI Surface Parity (P0/P1 Gap Closure)

> Source: [feat-roadmap-cli-gap-closure-plan](../plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md)

### P0: Runtime/Docs/Test Truth
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| policy-gate dispatch | ✅ | Wired in CLI |
| risk-policy-gate alias | ✅ | Terminology parity |
| check-authz dispatch | ✅ | Async handling |
| check-environment dispatch | ✅ | Async handling |
| pilot-evaluate dispatch | ✅ | Exit code preservation |
| pilot-rollback dispatch | ✅ | Already wired |
| README parity | ✅ | Command index aligned |
| .gitignore artifacts | ✅ | pilot/ + ui-explore-output/ |

### P1: Capability Gaps
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Merge policy dual-shape | ✅ | Legacy + roadmap support |
| Preflight headSha | ✅ | CLI + types + dispatch test |
| Video evidence support | ✅ | MP4/WebM + schema update |

### P2: Narrative Clarity
**Status:** ✅ Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Status matrix (this doc) | ✅ | Created |
| Strategic docs normalization | ✅ | Strategic status docs and implementation plans now cite this matrix as canonical |
| README link | ✅ | README documentation section links to this matrix |

## Outstanding Items

### Non-Functional Requirements (Partial)
| Item | Status | Notes |
|------|--------|-------|
| Serialized mutation queue | ✅ | Implemented in `src/lib/github/mutation-queue.ts` and `GitHubClient.createIssueComment` |
| Explicit retry/backoff | ✅ | Implemented in `src/lib/github/mutation-queue.ts` with bounded exponential backoff + jitter |
| Authz preflight enforcement | ✅ | Applied in `postRerunCommentIfNeeded` before mutative writes |

### Integration Tests
| Scenario | Status | Notes |
|----------|--------|-------|
| Happy path end-to-end | ✅ | Covered by `src/commands/agent-first-throughput.integration.test.ts` |
| Stale + race mixed path | ✅ | Covered by `src/commands/agent-first-throughput.integration.test.ts` |
| Governance hold contract | ✅ | Added to `postRerunCommentIfNeeded` tests for preflight hold behavior |

## Section 27 Optional Enhancements

| Enhancement | Status |
|-------------|--------|
| Diff budget guardrails | ✅ `harness diff-budget` |
| UI loop commands | ✅ `ui:fast`, `ui:verify`, `ui:explore` |
| Brainstorm/plan workflow | ✅ `brainstorm-gate`, `plan-gate` |

## References

- [Agent-First Throughput v1 Pilot Plan](../plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md)
- [Roadmap/CLI Gap Closure Plan](../plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md)
- [Harness Implementation Plan](../HARNESS_IMPLEMENTATION_PLAN.md)
