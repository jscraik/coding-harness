---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p1
issue_id: "025"
tags: [code-review, security, authz, github]
dependencies: []
---

# Add least-privilege authz controls for automated mutations

The plan currently describes automated remediation and rerun comment posting without explicit least-privilege token and branch protection controls.

## Problem Statement
Without explicit authz constraints, automation could run with broad credentials or write to unsafe branches, expanding blast radius.

## Findings
- Automated mutative actions are in scope (commit/comment/rerun flow).
- No explicit requirement for GitHub App/fine-grained scopes, branch allowlist, or protected-branch deny policy.
- Security review flagged this as P1.

## Proposed Solutions
### Option 1: Add hard security gates in acceptance criteria
**Approach:** Require minimal scopes, repo/branch allowlists, and preflight permission checks.
**Pros:** Clear and enforceable.
**Cons:** Adds setup work for pilot repos.
**Effort:** 2-4 hours
**Risk:** Low

### Option 2: Document recommendations only
**Approach:** Keep as best-practice notes, no hard gate.
**Pros:** Lower short-term friction.
**Cons:** High chance of unsafe defaults.
**Effort:** 30-60 minutes
**Risk:** High

## Recommended Action
Use Option 1.

## Technical Details
- Update plan sections: Non-Functional Requirements, Acceptance Criteria, Phase 2 hardening.
- Add explicit requirements:
  - fine-grained token or GitHub App
  - no direct writes to protected/default branches
  - preflight auth scope verification

## Resources
- GitHub least-privilege and REST best-practice references already listed in the plan.

## Acceptance Criteria
- [x] Plan requires least-privilege credential model.
- [x] Plan requires branch/repo allowlists.
- [x] Plan requires preflight permission check before mutative actions.
- [x] Plan explicitly disallows writes to protected/default branch.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Captured security-sentinel finding for missing authz controls.

### 2026-02-26 - Completed
**By:** Codex
**Actions:** Resolved all acceptance criteria in the v1 pilot plan and marked TODO as complete.

### 2026-02-26 - Approved for Work
**By:** Codex Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- Least-privilege and branch protection controls must be explicit for mutative automation.

## Notes
P1: security risk and merge blocker.
