# PU-046 Intent Review (Best Practices)

## Scope reviewed
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md

## Recommendation
- Status: proceed_with_guardrails
- Summary: The intent is directionally correct and respects current connector authority boundaries, but one pre-mutation blocker must be resolved: confirm the attachment target is actually owner-visible in Linear (not only a local repo path).

## Findings (severity-ranked)

### 1) High - "Owner-visible attachment" is required, but the intended attachment target is a repo-local path that may not be visible to Linear readers
- Severity: high
- Evidence:
  - intent artifact states owner-visible requirement: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:12
  - planned attachment artifact is a local markdown path: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:38-40
  - acceptance criterion requires visible attachment in Linear: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:86
- Impacted behavior: If create_attachment receives a non-resolvable local path, the mutation may fail or produce a non-actionable attachment, leaving tracker-scope ambiguity unresolved.
- Remediation: Before mutation, define an externally resolvable attachment target (for example, a committed permalink, PR-hosted artifact link, or approved shared doc URL) and record it explicitly in the intent or execution receipt.
- Confidence: high
- Validation ownership: coordinator/executor of PU-046 mutation.

### 2) Medium - Validation steps are correct in sequence but under-specified for reproducibility and audit replay
- Severity: medium
- Evidence:
  - pre/post read + mutation sequence exists: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:49-61
  - mutation command is named but payload shape is not captured in intent: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:55-56
- Impacted behavior: Future auditors can confirm that a mutation happened, but cannot deterministically replay exactly what attachment URL/title/content was sent.
- Remediation: In the receipt row for PU-046, record exact mutation arguments (redacting secrets), returned attachment ID/URL, and post-mutation fetch evidence.
- Confidence: high
- Validation ownership: coordinator/executor.

### 3) Low - Scope reconciliation is attached to Linear, but there is no explicit stale/superseded handling plan for future attachments
- Severity: low
- Evidence:
  - intent chooses attachment as narrow mutation due connector limits: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:39-40
  - acceptance requires recording whether issue-field update remains blocked: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:89
- Impacted behavior: Repeated reconciliation notes can accumulate without clear supersession semantics, increasing reader confusion.
- Remediation: Add one line in the note/receipt declaring supersession policy (for example, "latest PU-046 attachment supersedes earlier scope notes until issue fields are writable").
- Confidence: medium
- Validation ownership: coordinator/executor.

## Strengths observed
- Intent explicitly preserves lane separation and non-goals (no false completion claims): /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-046-linear-scope-reconciliation-intent.json:42-47
- Goal-level guidance correctly treats Linear as ownership/planning truth, not runtime proof: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:95
- Plan boundary explicitly prohibits mutating external systems from plan text alone, matching intent-first control: /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md:250

## Pass/Block decision
- Decision: conditional_pass
- Condition to proceed: verify attachment target is externally resolvable and owner-visible before calling create_attachment; then capture exact mutation evidence in PU-046 receipt/state update.

WROTE: artifacts/reviews/pu-046-linear-scope-reconciliation-intent-best-practices.md

