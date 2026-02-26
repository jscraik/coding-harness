---
status: complete
resolved_date: 2026-02-26
incorporated_in_plan: docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md
priority: p1
issue_id: "027"
tags: [code-review, security, privacy, observability]
dependencies: []
---

# Add data leakage and retention controls for pilot artifacts

The plan introduces multiple artifact logs (`artifacts/pilot/*.json/jsonl`) and incident summaries without explicit redaction, retention, and access constraints.

## Problem Statement
Telemetry and incident artifacts may capture sensitive strings (tokens, URLs, identifiers) unless strict redaction and retention rules are defined.

## Findings
- Artifact collection is detailed (PR snapshots, remediation events, rollback events, incident logs).
- Gap-case open/resolve fields allow free-text summary/note and URLs.
- Security review flagged missing redaction + allowlist controls.

## Proposed Solutions
### Option 1: Add mandatory data handling policy for pilot artifacts
**Approach:** Define prohibited content patterns, URL sanitization, retention window, and access controls in acceptance criteria.
**Pros:** Prevents accidental sensitive-data persistence.
**Cons:** Requires extra implementation checks.
**Effort:** 2-4 hours (plan + enforcement design)
**Risk:** Low

### Option 2: Rely on operator discipline
**Approach:** Keep as advisory notes only.
**Pros:** Minimal immediate effort.
**Cons:** High leak risk.
**Effort:** <1 hour
**Risk:** High

## Recommended Action
Use Option 1.

## Technical Details
- Add requirements:
  - redact secrets/PII before write
  - sanitize `evidenceUrl` (https-only, host allowlist, strip sensitive query params)
  - retention + artifact cleanup policy
  - non-commit policy for pilot artifacts

## Resources
- Plan file sections: data collection methods and gap-case fields.

## Acceptance Criteria
- [x] Redaction and forbidden-content policy is explicit.
- [x] URL validation/canonicalization rules are explicit.
- [x] Artifact retention window and access policy are documented.
- [x] Plan states pilot artifacts are operational data, not committed source artifacts.

## Work Log
### 2026-02-25 - Initial Discovery
**By:** Codex
**Actions:** Consolidated security findings around artifact data handling.

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
- Operational artifacts need explicit redaction, retention, and access controls to avoid accidental leakage.

## Notes
P1: security/compliance blocker.
