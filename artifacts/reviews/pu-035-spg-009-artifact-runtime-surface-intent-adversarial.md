# Adversarial Intent Review: PU-035 SPG-009 Artifact Runtime Surface

## Scope
- Reviewed intent only: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json`
- No implementation code reviewed.

## Findings (Severity-Ordered)

### 1) High — Symlink escape can satisfy repo-relative path checks while reading outside repository
- Severity: high
- Evidence:
  - Intent requires repo-relative traversal-free paths and forbids absolute/home paths ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:38](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:38), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:54](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:54)).
  - Claim-support acceptance only checks existence/size/checksum/freshness/lineage, not canonicalized resolved path containment ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:48](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:48)).
- Failure scenario:
  1. Artifact path is set to `artifacts/reviews/current.md` (repo-relative, no traversal tokens).
  2. `artifacts/reviews/current.md` is a symlink to a file outside repo root.
  3. Validator checks path string + exists + size + checksum and marks claim-support eligible.
  4. Packet now legitimizes external filesystem content through a nominally bounded path.
- Impacted behavior:
  - Breaks the repo-boundary guarantee for claim-support evidence.
- Remediation:
  - Require `realpath` containment under repo root before read/checksum.
  - Reject symlinks for claim-support artifacts or require explicit symlink policy with target containment checks.
  - Add explicit negative fixture for repo-relative symlink escape.
- Confidence: 75
- Validation ownership: introduced by current patch (intent gap).

### 2) High — Preview bypass via unchecked `not_applicable` lets preview-required surfaces support claims
- Severity: high
- Evidence:
  - Preview may be `not_applicable` and broken preview blocks claims only when preview is applicable ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:41](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:41), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:51](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:51)).
  - Intent classifies many surface kinds including screenshot/doc/pdf/report ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:37](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:37)).
- Failure scenario:
  1. Producer emits `surfaceKind: screenshot` or `pdf`.
  2. Sets `preview.status = not_applicable` despite preview actually being expected for reviewer inspection.
  3. Validation path skips preview integrity branch and allows claim support if other fields pass.
- Impacted behavior:
  - Claim-support can pass for non-reviewable artifacts by downgrading preview requirement to `not_applicable`.
- Remediation:
  - Define deterministic preview applicability matrix by `surfaceKind`.
  - Validate `not_applicable` only for explicitly exempt kinds; reject otherwise.
  - Add fixtures: `surfaceKind requires preview + not_applicable` => fail.
- Confidence: 75
- Validation ownership: introduced by current patch (intent gap).

### 3) Medium — Freshness and lineage checks can be replayed without anchoring to live repository head
- Severity: medium
- Evidence:
  - Claim-support requires lineage head SHA match with packet head SHA ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:39](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:39), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:53](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:53)).
  - Intent does not require packet `headSha` to equal current git HEAD or declared target/base context.
- Failure scenario:
  1. Old artifact packet is replayed with internally consistent lineage + packet SHA.
  2. Freshness timestamp is updated to current (or within threshold) without proving commit-local recency.
  3. Validator passes because it checks self-consistency, not branch-tip anchoring.
- Impacted behavior:
  - Stale evidence can appear current and claim-support-eligible.
- Remediation:
  - Require optional strict mode (or default in claim-support mode) that resolves current repo HEAD and rejects mismatches.
  - If detached or unavailable, classify as blocked for claim-support.
  - Add replay fixture: internally consistent packet with non-tip SHA => fail claim-support.
- Confidence: 50
- Validation ownership: introduced by current patch (intent gap).

### 4) Medium — Secret/content leakage guard is pattern-based and can be bypassed through allowed fields
- Severity: medium
- Evidence:
  - Intent forbids “raw prompt/transcript/secret-like keys” and raw media blobs ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:32](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:32), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:54](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:54)).
  - No explicit field-level max lengths or disallowed value patterns are defined in intent acceptance.
- Failure scenario:
  1. Producer stores secret-bearing values in a permitted textual field (e.g., lineage/source ref note) using non-obvious key names.
  2. Key-name denylist does not trigger.
  3. Packet remains schema-valid and may pass semantic checks.
- Impacted behavior:
  - Sensitive or bulky payload can leak into packet via non-blocked fields.
- Remediation:
  - Add allowlist-first field semantics and strict max-size constraints for all free-text fields.
  - Add value-level detectors for high-entropy tokens and known secret formats.
  - Add fixture with secret-like value in allowed field => fail.
- Confidence: 50
- Validation ownership: introduced by current patch (intent gap).

## Residual Risks
- The intent is strong on “fail closed” framing, but replay-proofing and preview applicability need tighter machine-checkable contracts before implementation starts.
- Claim-support correctness depends on semantic validator strictness; intent should explicitly require these edge-case fixtures now to avoid “schema valid but unsafe” implementation drift.

## Testing Gaps To Add Before Implementation
- Symlink escape negative test under repo-relative artifact path.
- Surface-kind preview applicability matrix tests.
- Replay test: lineage/packet SHA match each other but not current HEAD.
- Secret-in-allowed-field leakage test (value-based, not key-name-only).

## Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/adversarial-reviewer-pu-035-spg-009-intent/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-intent-adversarial.md
- findings:
  - 4 total (2 high, 2 medium)
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu-035-spg-009-intent-review" --json` failed with `failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`.
- improvement_opportunities:
  - Encode repo-root anchoring and preview applicability as deterministic validator rules rather than prose constraints.
- strengths:
  - Intent already states fail-closed claim-support semantics and explicit stale/preview/lineage categories.
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json`
  - `rg -n "SPG-009|ArtifactRuntimeSurface|artifact" docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
- next_action:
  - Tighten intent acceptance criteria with the four missing negative fixtures before implementation.
- useful_findings: 4
- avoided_false_positive: did not flag implementation-only defects because no implementation exists.
- evidence_quality: file-line anchored, scenario-reproducible.
- followed_scope: yes (intent + goal context only).
- reusable_learning: claim-support contracts need explicit “applicability matrix” and “repo-head anchoring” rules.
- coordinator_score: 0.91

WROTE: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-intent-adversarial.md
