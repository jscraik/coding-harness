---
last_validated: 2026-04-18
---

# Review Gate Workflow Contract

## Table of Contents

- [Transition Table](#transition-table)
- [State Definitions](#state-definitions)
- [Event Definitions](#event-definitions)
- [Guard Conditions](#guard-conditions)
- [Action Definitions](#action-definitions)
- [Error Taxonomy](#error-taxonomy)
- [Idempotency Rules](#idempotency-rules)
- [Invariants](#invariants)
- [Metadata](#metadata)
- [Logging Schema](#logging-schema)
- [Modes](#modes)

---

## Transition Table

| S (source) | E (event) | G (guard) | A (action) | N (next) |
|------------|-----------|-----------|------------|----------|
| IDLE | cmd.review-gate | ¬G_validSha | A_logValidationError | FAILED_VALIDATION |
| IDLE | cmd.review-gate | G_validSha ∧ ¬G_contractLoaded | A_logContractError | FAILED_CONTRACT_LOAD |
| IDLE | cmd.review-gate | G_validSha ∧ G_contractLoaded | A_initClient, A_fetchPR, A_evalPlanTraceability | PR_LOADED |
| PR_LOADED | security.verify | ¬G_shaMatches | A_logShaMismatch | FAILED_SHA_MISMATCH |
| PR_LOADED | security.verify | G_shaMatches | A_startTimer, A_listCheckRuns | CHECK_POLLING |
| CHECK_POLLING | check.poll | G_checkNotFound | A_logCheckMissing | CHECK_MISSING |
| CHECK_POLLING | check.poll | G_checkPassing | A_evalApprovals | APPROVAL_EVALUATION |
| CHECK_POLLING | check.poll | G_checkCompleted ∧ ¬G_checkPassing | A_logCheckFailed | CHECK_FAILED |
| CHECK_POLLING | check.poll | G_checkInProgress ∧ G_timeRemaining | A_waitPollInterval | CHECK_POLLING |
| CHECK_POLLING | check.poll | G_checkInProgress ∧ ¬G_timeRemaining | A_handleTimeout | TIMEOUT_REACHED |
| CHECK_MISSING | finalize | G_success | A_buildOutput | COMPLETE_NOT_VERIFIED |
| CHECK_FAILED | finalize | G_success | A_buildOutput | COMPLETE_NOT_VERIFIED |
| APPROVAL_EVALUATION | approval.eval | G_noApprovers | A_logNoApproval | APPROVAL_FAILED |
| APPROVAL_EVALUATION | approval.eval | G_hasApprovals | A_evalReviewerIndependence | INDEPENDENCE_EVALUATION |
| APPROVAL_FAILED | finalize | G_success | A_buildOutput | COMPLETE_NOT_VERIFIED |
| INDEPENDENCE_EVALUATION | independence.eval | ¬G_independentReviewers | A_logIndependenceFail | INDEPENDENCE_FAILED |
| INDEPENDENCE_EVALUATION | independence.eval | G_independentReviewers | A_evalRequiredChecks | REQUIRED_CHECKS_EVALUATION |
| INDEPENDENCE_FAILED | finalize | G_success | A_buildOutput | COMPLETE_NOT_VERIFIED |
| REQUIRED_CHECKS_EVALUATION | checks.eval | G_requiredChecksFailing | A_logRequiredCheckFail | REQUIRED_CHECKS_FAILED |
| REQUIRED_CHECKS_EVALUATION | checks.eval | G_requiredChecksPassing | A_evalReviewThreads | THREAD_EVALUATION |
| REQUIRED_CHECKS_FAILED | finalize | G_success | A_buildOutput | COMPLETE_NOT_VERIFIED |
| THREAD_EVALUATION | threads.eval | G_unresolvedHumanThreads | A_logUnresolvedThreads | THREADS_FAILED |
| THREAD_EVALUATION | threads.eval | G_allThreadsResolved | A_computeConfidenceRubric | CONFIDENCE_COMPUTED |
| THREADS_FAILED | finalize | G_success | A_buildOutput | COMPLETE_NOT_VERIFIED |
| CONFIDENCE_COMPUTED | finalize | G_noBlockers | A_markVerified | COMPLETE_VERIFIED |
| CONFIDENCE_COMPUTED | finalize | G_hasBlockers | A_buildOutput | COMPLETE_NOT_VERIFIED |
| TIMEOUT_REACHED | timeout.handle | G_timeoutActionFail | A_logTimeoutError | FAILED_TIMEOUT |
| TIMEOUT_REACHED | timeout.handle | G_timeoutActionWarn | A_buildOutput | COMPLETE_TIMEOUT_WARNING |
| * | error.uncaught | G_notFoundError | A_logNotFound | FAILED_NOT_FOUND |
| * | error.uncaught | G_permissionError | A_logPermissionDenied | FAILED_PERMISSION_DENIED |
| * | error.uncaught | G_systemError | A_logSystemError | FAILED_SYSTEM_ERROR |

---

## State Definitions

| State | Type | Description |
|-------|------|-------------|
| IDLE | initial | Workflow entry point, options parsed |
| PR_LOADED | transitional | PR fetched, plan traceability evaluated, SHA match pending |
| CHECK_POLLING | transitional | Polling for check run completion |
| CHECK_MISSING | terminal | Required check run not found for SHA |
| CHECK_FAILED | terminal | Check run completed but not passing |
| APPROVAL_EVALUATION | transitional | Evaluating PR approvals for HEAD SHA |
| APPROVAL_FAILED | terminal | No approvals found for current HEAD SHA |
| INDEPENDENCE_EVALUATION | transitional | Verifying reviewer independence from coding actor |
| INDEPENDENCE_FAILED | terminal | Coding actor is sole approver |
| REQUIRED_CHECKS_EVALUATION | transitional | Verifying additional required checks |
| REQUIRED_CHECKS_FAILED | terminal | One or more required checks not passing |
| THREAD_EVALUATION | transitional | Evaluating unresolved review threads |
| THREADS_FAILED | terminal | Unresolved human review threads remain |
| CONFIDENCE_COMPUTED | transitional | All evaluations complete, confidence scored |
| TIMEOUT_REACHED | transitional | Polling timeout exceeded |
| COMPLETE_VERIFIED | terminal | All checks passed, review verified |
| COMPLETE_NOT_VERIFIED | terminal | Review not verified (blockers present) |
| COMPLETE_TIMEOUT_WARNING | terminal | Timeout reached, warning mode |
| FAILED_VALIDATION | terminal | SHA format validation failed |
| FAILED_CONTRACT_LOAD | terminal | Contract could not be loaded |
| FAILED_SHA_MISMATCH | terminal | Provided SHA doesn't match PR HEAD |
| FAILED_TIMEOUT | terminal | Timeout with fail action |
| FAILED_NOT_FOUND | terminal | PR or resource not found |
| FAILED_PERMISSION_DENIED | terminal | Permission denied (403/401) |
| FAILED_SYSTEM_ERROR | terminal | Unexpected system error |

---

## Event Definitions

| Event | Payload | Description |
|-------|---------|-------------|
| cmd.review-gate | `ReviewGateOptions` | Primary command invocation |
| security.verify | `{ expectedSha: string, actualSha: string }` | SHA comparison check |
| check.poll | `{ checkRuns: CheckRun[], checkName: string }` | Check run polling event |
| approval.eval | `{ reviews: PullRequestReview[], headSha: string }` | Approval evaluation |
| independence.eval | `{ approvers: string[], codingActor: string }` | Reviewer independence check |
| checks.eval | `{ checkRuns: CheckRun[], requiredChecks: string[] }` | Required checks evaluation |
| threads.eval | `{ threads: ReviewThread[], botLogins: Set<string> }` | Thread resolution check |
| timeout.handle | `{ elapsedMs: number, timeoutMs: number }` | Timeout processing |
| finalize | `{ result: ReviewGateOutput }` | Workflow completion |
| error.uncaught | `{ error: unknown }` | Unexpected error |

---

## Guard Conditions

| Guard | Expression |
|-------|------------|
| G_validSha | `validateSha(options.headSha)` returns without throwing |
| G_contractLoaded | `loadContract(options.contractPath)` succeeds |
| G_shaMatches | `pullRequestHeadSha.toLowerCase() === options.headSha.toLowerCase()` |
| G_checkNotFound | `!findReviewCheckRun(checkRuns, options.checkName).found` |
| G_checkPassing | `isCheckRunPassing(checkResult)` returns true |
| G_checkCompleted | `checkResult.status === "completed"` |
| G_checkInProgress | `isCheckRunInProgress(checkResult)` returns true |
| G_timeRemaining | `Date.now() - startTime < timeoutMs` |
| G_noApprovers | `approvers.length === 0` |
| G_hasApprovals | `approvers.length > 0` |
| G_independentReviewers | `independentApprovers.length > 0` (at least one non-coding-actor) |
| G_requiredChecksFailing | `requiredCheckBlockers.length > 0` |
| G_requiredChecksPassing | `requiredCheckBlockers.length === 0` |
| G_unresolvedHumanThreads | `unresolvedHumanThreads.length > 0` |
| G_allThreadsResolved | `unresolvedHumanThreads.length === 0` |
| G_hasBlockers | `additionalBlockers.length > 0` |
| G_noBlockers | `additionalBlockers.length === 0` |
| G_timeoutActionFail | `reviewPolicy.timeoutAction === "fail"` |
| G_timeoutActionWarn | `reviewPolicy.timeoutAction === "warn"` |
| G_notFoundError | `error.name === "NotFoundError"` |
| G_permissionError | `error.name === "ForbiddenError" \|\| error.name === "UnauthorizedError"` |
| G_systemError | `!(error instanceof ContractLoadError) && !G_notFoundError && !G_permissionError` |

---

## Action Definitions

| Action | Description | Idempotent |
|--------|-------------|------------|
| A_logValidationError | Return `VALIDATION_ERROR` for invalid SHA | ✓ |
| A_logContractError | Return contract load error (VALIDATION or SYSTEM) | ✓ |
| A_initClient | Initialize GitHubClient with token/owner/repo | ✓ |
| A_fetchPR | Fetch PR details and verify HEAD SHA | ✓ |
| A_evalPlanTraceability | Run plan gate detector on PR title/body/files | ✓ |
| A_logShaMismatch | Return `VALIDATION_ERROR` for SHA mismatch | ✓ |
| A_startTimer | Record start time for timeout tracking | ✗ |
| A_listCheckRuns | Fetch check runs for PR HEAD SHA | ✓ |
| A_logCheckMissing | Build output with `checkStatus: "not_found"` | ✓ |
| A_logCheckFailed | Build output with check failure details | ✓ |
| A_waitPollInterval | Sleep `Math.min(POLL_INTERVAL_MS, remainingMs)` | ✗ |
| A_handleTimeout | Determine timeout action (fail vs warn) | ✓ |
| A_evalApprovals | List PR reviews, resolve current approvers for SHA | ✓ |
| A_logNoApproval | Build output with "no approvals" blocker | ✓ |
| A_evalReviewerIndependence | Filter approvers excluding coding actor | ✓ |
| A_logIndependenceFail | Build output with independence failure blocker | ✓ |
| A_evalRequiredChecks | Verify all required checks are passing | ✓ |
| A_logRequiredCheckFail | Build output with failing required check details | ✓ |
| A_evalReviewThreads | List and evaluate unresolved review threads | ✓ |
| A_logUnresolvedThreads | Build output with unresolved thread blocker | ✓ |
| A_computeConfidenceRubric | Calculate confidence score (1-5) with rationale | ✓ |
| A_markVerified | Set `verified: true` in output | ✓ |
| A_buildOutput | Construct final `ReviewGateOutput` with all fields | ✓ |
| A_logTimeoutError | Return `TIMEOUT` error | ✓ |
| A_logNotFound | Return `NOT_FOUND` error | ✓ |
| A_logPermissionDenied | Return `PERMISSION_DENIED` error | ✓ |
| A_logSystemError | Return `SYSTEM_ERROR` with sanitized message | ✓ |

---

## Error Taxonomy

| Code | Category | Trigger | Exit Code |
|------|----------|---------|-----------|
| VALIDATION_ERROR | Validation | Invalid SHA format, SHA mismatch, contract load failure | 1 |
| NOT_FOUND | Lookup | PR not found, check run not found, resource missing | 2 |
| PERMISSION_DENIED | Auth | 403 Forbidden, 401 Unauthorized | 3 |
| TIMEOUT | Timeout | Check polling exceeded `timeoutSeconds` with `timeoutAction: fail` | 4 |
| REVIEW_NOT_VERIFIED | Policy | Review gate completed but verification failed (blockers present) | 5 |
| SYSTEM_ERROR | Unknown | Unexpected exception, network failure | 10 |

---

## Idempotency Rules

| Operation | Rule | Enforcement |
|-----------|------|-------------|
| PR Fetch | PR data fetched once at start | Cached in `pullRequest` variable |
| Check Polling | Each poll fetches fresh check runs | No caching; fresh data per iteration |
| Approval Evaluation | Reviews fetched once per call | No caching; fresh data each invocation |
| Thread Resolution | Bot-only thread auto-resolution | Idempotent: resolving already-resolved threads is no-op |
| Rerun Comment | Comment deduplication by SHA | `hasRerunCommentForSha` prevents duplicates |
| Confidence Rubric | Deterministic calculation | Same inputs always produce same score/rationale |

---

## Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-1 | SHA must be validated before use | `validateSha()` at function entry |
| INV-2 | Provided SHA must match PR HEAD | Explicit comparison before polling |
| INV-3 | Polling must respect timeout | `Date.now() - startTime < timeoutMs` check each iteration |
| INV-4 | Approvals must be for current HEAD SHA | `commitId === headSha` filter in `resolveCurrentApprovers` |
| INV-5 | Reviewer independence requires at least one non-coding-actor approver | `independentApprovers.length > 0` check |
| INV-6 | Required checks must be complete and passing | Status `completed` + conclusion `success` |
| INV-7 | Unresolved human threads block verification | Bot-only threads may be auto-resolved |
| INV-8 | Confidence score 5 requires all gates passing | `policy_gate_status === "pass" && plan_traceability_status === "pass" && actionableCount === 0` |
| INV-9 | Timeout action determines terminal state | `timeoutAction: fail` → error; `warn` → `needsRerun: true` |

---

## Metadata

| Field | Value |
|-------|-------|
| owner | `team/codex-infra` |
| max_duration | 600s (10 minutes, configurable via `timeoutSeconds`) |
| escalation | File issue with `Review` + `CI` labels |
| domain | pull-request-verification |
| critical_path | true |
| sla | P1 - Blocks merge pipeline |

---

## Logging Schema

```typescript
interface ReviewGateWorkflowLog {
  workflow_id: string;           // UUID v4 per invocation
  transition_code: string;       // "S-E-G-A-N" compact form
  from_state: string;            // Source state name
  to_state: string;              // Destination state name
  correlation_id: string;        // `${workflow_id}:${prNumber}`
  result: "verified" | "not_verified" | "timeout" | "error";
  timestamp: string;             // ISO 8601
  metadata: {
    pr_number: number;
    head_sha: string;            // Full SHA
    check_name: string;
    timeout_seconds: number;
    poll_interval_ms: number;
    poll_iterations: number;
    owner: string;
    repo: string;
  };
  evaluations: {
    policy_gate_status: "pass" | "fail" | "pending" | "missing";
    plan_traceability_status: "pass" | "fail" | "missing";
    approval_count: number;
    independent_approvers: number;
    required_checks_passing: boolean;
    unresolved_threads: number;
  };
  confidence_rubric: {
    score: 1 | 2 | 3 | 4 | 5;
    level: "low" | "medium" | "high";
  };
  blockers: string[];
  error?: {
    code: string;
    message: string;
  };
}
```

---

## Modes

### STRICT Mode

- SHA mismatch is fatal (no bypass)
- All required checks must pass
- All human review threads must be resolved
- Reviewer independence strictly enforced
- Timeout action `fail` halts workflow

### ADVISORY Mode

- Warnings for non-critical check failures
- Best-effort thread resolution
- Relaxed reviewer independence (configurable)
- Timeout action `warn` returns `needsRerun: true`
- Allows partial verification with blockers listed

### Dry-Run Simulation

| State | Dry-Run Behavior |
|-------|------------------|
| IDLE | Validate inputs, no client initialization |
| PR_LOADED | Mock PR data, skip SHA comparison |
| CHECK_POLLING | Return mock check status, no polling |
| APPROVAL_EVALUATION | Mock approval data |
| CONFIDENCE_COMPUTED | Compute confidence with mock data |

---

## Abbreviations

| Abbreviation | Expansion |
|--------------|-----------|
| PR | Pull Request |
| SHA | Secure Hash Algorithm (commit hash) |
| HEAD | Latest commit on branch |
| CI | Continuous Integration |
| POLL_INTERVAL_MS | 5000ms (5 seconds) |
| API | Application Programming Interface |
