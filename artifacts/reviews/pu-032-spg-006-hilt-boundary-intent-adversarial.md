# Adversarial Intent Review - PU-032 SPG-006 HILT Boundary

## Scope
- Intent: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-032-spg-006-hilt-boundary-intent.json`
- Goal: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
- Existing module baseline:
  - `src/lib/decision-request/types.ts`
  - `src/lib/decision-request/builder.ts`
  - `src/lib/decision-request/cli.ts`
  - `src/commands/decision-request.test.ts`
  - `contracts/decision-request.schema.json`

## Severity-Ranked Findings

### 1) High - Constraint/acceptance mismatch allows stale-claim boundary to pass as fresh and unblocked
- Evidence:
  - Intent requires: "Stale-state or claim-support-related decision requests must include evidence refs and non-current staleState entries" (`.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-032-spg-006-hilt-boundary-intent.json:38`).
  - Acceptance weakens this to conditional enforcement only "when freshness is stale, missing, or unknown" (`.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-032-spg-006-hilt-boundary-intent.json:45`).
- Failure scenario:
  1. Caller sets `--boundary stale_claim_support` with `--freshness current`.
  2. Builder implements only the acceptance-text condition (gate checks run only for stale/missing/unknown freshness).
  3. Packet is emitted as a valid HILT boundary without non-current stale evidence, even though this is exactly a claim-support freshness boundary.
  4. Downstream operators see a valid governance packet and may treat routine or fresh ambiguity as authority debt.
- Impacted behavior: SPG-006 guard can be bypassed by choosing `freshness=current` for stale-claim-support semantics.
- Remediation: Make acceptance wording and tests enforce non-current staleState + evidenceRefs for claim-support boundaries regardless of declared freshness; reject contradictory tuples (`stale_claim_support + current`) with deterministic usage error.
- Confidence: 90
- Validation ownership: introduced by current patch (intent contract inconsistency).

### 2) Medium - Negative validation command can pass even if routine-uncertainty emits packets
- Evidence:
  - Validation plan includes a routine-uncertainty invocation (`...intent.json:58`) but does not assert non-zero exit, error code, or absence of packet.
- Failure scenario:
  1. Implementation accidentally accepts `--boundary routine_uncertainty` and emits open packet JSON.
  2. Validation command in plan still exits 0 because the command itself executes successfully.
  3. Slice is considered validated despite violating SPG-006 "must not create decision debt for routine uncertainty."
- Impacted behavior: deterministic gate misses the key regression it claims to cover.
- Remediation: Require explicit failure assertion (exit code 2 + `decision-request.*` error code) or wrap with a harness/vitest assertion.
- Confidence: 95
- Validation ownership: introduced by current patch (validation design gap).

### 3) Medium - Closed-taxonomy claim is not currently tied to deterministic schema enum acceptance
- Evidence:
  - Intent claims "closed-taxonomy" boundary types (`...intent.json:36`), but acceptance criteria do not explicitly require schema-level enum closure for `hiltBoundary.boundaryType`; they only require fields exist (`...intent.json:43`).
- Failure scenario:
  1. Builder/CLI checks a bounded list, but schema uses plain string for `boundaryType` (or misses enum update).
  2. Packet validation layer accepts unknown boundary values from non-CLI producers.
  3. Composition failure: CLI enforces closed taxonomy, schema consumers do not; governance logic diverges by producer path.
- Impacted behavior: cross-component contract mismatch undermines machine-readable HILT classification.
- Remediation: Require schema enum for boundaryType and test non-CLI payload rejection in runtime-packet schema validation tests.
- Confidence: 80
- Validation ownership: introduced by current patch unless explicitly specified in implementation/tests.

## Strengths
- Scope is well constrained to `src/lib/decision-request/**` and existing command/test/schema surfaces.
- Intent explicitly preserves `governance_request_only` and `not_closeout_proof` boundaries.
- Stop conditions correctly prevent drift into closeout-claim authority.

## Failures or Blockers
- blocked_local_memory_cli:
  - Command: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu-032-spg-006-adversarial-review" --json`
  - Error: `failed to save PID: failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`
  - Follow-up command with same blocker: `local-memory search "SPG-006 decision-request HILT governance_request_only not_closeout_proof" --session_filter_mode all --json`
- Missing template path:
  - `agents/templates/review-artifact.md` not found in repository path search; produced artifact using contract fields directly.

## Validation Evidence
- `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-032-spg-006-hilt-boundary-intent.json | sed -n 1,280p`
- `nl -ba src/lib/decision-request/types.ts | sed -n 1,220p`
- `nl -ba src/lib/decision-request/builder.ts | sed -n 1,320p`
- `nl -ba src/lib/decision-request/cli.ts | sed -n 1,180p`
- `nl -ba src/commands/decision-request.test.ts | sed -n 1,240p`
- `nl -ba contracts/decision-request.schema.json | sed -n 1,320p`
- `rg -n "claimSupport|evidenceUse|boundary|routine_uncertainty|staleState|not_closeout_proof|governance_request_only" src/lib/decision-request src/commands/decision-request.test.ts contracts/decision-request.schema.json`

## Accountability Receipt
- status: completed_with_findings
- manifest_path: not_provided_by_coordinator
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-intent-adversarial.md
- findings:
  - high: 1
  - medium: 2
  - low: 0
- failures_or_blockers:
  - local-memory CLI permission blocker
  - reviewer template file not found
- improvement_opportunities:
  - tighten acceptance criteria language to remove contradiction with design constraints
  - convert routine-uncertainty validation command into an asserted negative test
  - require schema enum closure for boundary taxonomy
- strengths:
  - scope discipline
  - preserved governance/non-closeout boundary
  - explicit stop conditions
- validation_evidence:
  - command receipts listed above
- next_action:
  - coordinator should require intent patch for finding #1 and validation-plan hardening for finding #2 before implementation starts.
- useful_findings: 3
- avoided_false_positive:
  - Did not flag existing module absence of boundary fields as a defect because this is a pre-implementation intent review.
- evidence_quality: high (line-addressable intent + module baseline evidence)
- followed_scope: yes
- reusable_learning:
  - Intent reviews should force "negative assertion commands" instead of plain invocation for expected-failure cases.
- coordinator_score: 8/10

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-intent-adversarial.md
