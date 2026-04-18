---
last_validated: 2026-04-18
---

# Brainstorm: Coding Harness Gap Analysis

**Date:** 2026-02-22
**Origin:** `/Users/jamiecraik/dev/coding-harness/docs/HARNESS_IMPLEMENTATION_PLAN.md`
**Status:** MERGED into implementation plan (Section 33-34)
**Merged:** 2026-02-22

---

## What We're Exploring

The implementation plan is comprehensive but the repository is 0% implemented. This brainstorm identifies conceptual gaps in the plan itself - decisions, edge cases, and considerations that need to be addressed before execution.

---

## Gap Analysis Findings

### Implementation Gap (Critical)

The plan specifies a complete repository structure but none of it exists:

- No `package.json` or TypeScript workspace
- No `src/` directory with CLI commands
- No `contracts/` with JSON schemas
- No `templates/` for installer scaffolding
- No `AGENTS.md` at repository root
- Repository is not initialized as git repo

**Impact:** Phase 1 cannot start until bootstrap is complete.

### Summary: Decisions Made

| Gap Area | Decision |
|----------|----------|
| Rollback strategy | Full rollback support with restore points |
| Testing strategy | Hybrid: fixtures + CI integration |
| Schema migration | Auto-migration when contract changes |
| Concurrent agent PRs | Branch naming convention (Phase 3) |
| Non-pnpm targets | Detect from lock file, abstract operations |
| Agent timeout | 10 min default, fail PR on timeout |
| API rate limiting | Exponential backoff with jitter |

### Open Question

| Topic | Status |
|-------|--------|
| OTel integration | Defer to Phase 5, explore options then |

---

## Resolved Decisions

### 1. Rollback Strategy
**Decision:** Full rollback support required

The `harness init` command must:
- Create a restore point before any modifications
- Support `harness init --rollback` to revert all changes
- Track all files created/modified in a manifest

**Rationale:** Users must be able to safely experiment with harness adoption without risking repository corruption.

### 2. Testing Strategy
**Decision:** Hybrid approach - fixtures + CI integration

- **PR tests:** Real fixture repos in temp directories (fast, deterministic)
- **Nightly CI:** Integration tests against real GitHub (high confidence, catches API drift)
- **Unit tests:** Mocked tests for pure logic (contract validation, risk-tier engine)

**Rationale:** Fast PR feedback loop + long-term confidence without slowing development.

### 3. Schema Migration
**Decision:** Auto-migration when contract schema changes

When `harness.contract.json` schema evolves (v1 -> v2):
- Harness detects outdated contract version
- Auto-migrates with backwards-compatible defaults
- Logs migration changes for user review
- Preserves user customizations where possible

**Rationale:** Reduces friction for harness upgrades; manual migration creates adoption barriers.

---

## Open Questions

### Q1: OTel Integration Approach
**Context:** User has OTel collector at `~/.agents/otel-collector/`
**Status:** Defer to Phase 5 (Evidence + observability hooks). Explore direct emission vs. logs-only at that time.

---

## Resolved Edge Case Decisions

### 1. Concurrent Agent PRs
**Decision:** Use branch naming convention with agent ID

Branch format: `<type>/<agent-id>/<slug>` (e.g., `feat/agent-42/user-auth`)

This avoids lock file complexity and merge queue overhead. Revisit if scale becomes an issue.

### 2. Non-pnpm Package Managers
**Decision:** Detect from lock file, abstract operations

- Read `pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock` to detect manager
- Abstract install/run commands behind `PackageManager` interface
- Harness internals remain pnpm-only

### 3. Agent Timeout Handling
**Decision:** 10 minute default, fail PR on timeout

Add to `reviewPolicy` contract:
```json
{
  "reviewPolicy": {
    "timeoutSeconds": 600,
    "timeoutAction": "fail"
  }
}
```

### 4. GitHub API Rate Limiting
**Decision:** Exponential backoff with jitter

Add `retry-policy.ts` with documented strategy:
- Base delay: 1s
- Max delay: 60s
- Jitter: ±20%
- Max retries: 5

---

## Recommended Plan Additions

### Add to Section 9 (Repository Layout)

```
src/
  lib/
    rollback-manager.ts      # NEW: restore point creation/restoration
    package-manager.ts       # NEW: abstract npm/yarn/pnpm detection
    retry-policy.ts          # NEW: API rate limit handling

templates/repo/
  .harness/
    restore-manifest.json    # NEW: tracks installer changes for rollback
```

### Add to Section 4 (Contract)

```json
{
  "reviewPolicy": {
    "timeoutSeconds": 600,
    "timeoutAction": "fail"
  },
  "observabilityPolicy": {
    "provider": "otel|logs|none",
    "collectorEndpoint": "http://localhost:4318"
  },
  "packageManagerPolicy": {
    "allowedManagers": ["pnpm", "npm", "yarn"],
    "requiredManager": null
  }
}
```

### Add to Section 6 (Acceptance Criteria)

13. Rollback command restores target repo to pre-install state
14. Schema migration runs automatically with user-visible log
15. Harness detects and adapts to target package manager
16. API rate limits trigger documented retry/backoff behavior

---

## Sources

- `/Users/jamiecraik/dev/coding-harness/docs/HARNESS_IMPLEMENTATION_PLAN.md`
- Repository research: structure analysis, gap identification
- User dialogue: decisions on rollback, testing, migration, edge cases
- `/Users/jamiecraik/.codex/instructions/tooling.md` - testing/observability guidance
