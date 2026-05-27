# Adversarial Intent Review: PU-016 Slice Assurance Validator

## Findings (Severity-Ordered)

### 1. HIGH — Cross-map evidence alias lets one artifact satisfy multiple required lanes undetected
- Severity: high
- Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json:49
- Constructed failure scenario:
  1. Receipt includes `slice_skill_lens_results.improve-codebase-architecture.pass.evidence_ref = "artifacts/reviews/shared.md"`.
  2. Receipt also includes `slice_skill_lens_results.testing.pass.evidence_ref = "artifacts/reviews/shared.md"` and the same for `simplify`/`unslopify`.
  3. Intent only forbids reuse for reviewer members (`"Reviewer pass evidence refs cannot be reused across reviewer members."`), not for skill-lens members.
  4. Validator passes all required members despite only one artifact being produced for multiple independent lanes.
- Impacted behavior: Post-R064 done claims can fabricate independent skill-lens coverage with one reused evidence file, defeating the lane-separation contract.
- Remediation: Add acceptance criterion and validator check that pass evidence refs are unique across all required skill-lens members (or enforce per-member artifact namespace with semantic ownership checks).
- Confidence: 90
- Validation ownership: introduced by current patch intent (contract gap)

### 2. HIGH — Freshness check can be bypassed by rewriting old evidence in place
- Severity: high
- Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json:47; .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json:50
- Constructed failure scenario:
  1. Operator reuses an old artifact path that previously satisfied another slice.
  2. They append or touch the file to update mtime without producing new lane-specific evidence.
  3. Contract requires "current evidence_ref" and "non-empty file", but no acceptance text binds evidence to receipt identity or lifecycle unit.
  4. Validator treats touched legacy artifact as fresh and passes the receipt.
- Impacted behavior: Assurance receipt can claim current independent validation while carrying stale semantic evidence, making "done" support non-deterministic under replay.
- Remediation: Require receipt-bound provenance in artifact content or sidecar metadata (receipt ID/lifecycle unit/hash), and fail if artifact provenance does not match the target receipt.
- Confidence: 82
- Validation ownership: introduced by current patch intent (contract gap)

### 3. MEDIUM — changed_files membership check can be satisfied by path-shape tricks without true ownership proof
- Severity: medium
- Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json:47; .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json:50
- Constructed failure scenario:
  1. Receipt records `changed_files` containing a path string variant (`./artifacts/reviews/a.md` vs `artifacts/reviews/a.md`, or normalized-case mismatch depending filesystem behavior).
  2. `evidence_ref` points to the same underlying file but with different lexical form.
  3. If validator uses direct string equality without canonical normalization + samefile resolution, it may either false-pass crafted aliases or false-fail valid refs.
  4. Teams can game the rule by crafting path forms that pass textual checks while obscuring true evidence ownership.
- Impacted behavior: Contract enforcement varies by path formatting rather than file identity, reducing determinism and creating exploit/flake surface.
- Remediation: Canonicalize both `changed_files` and `evidence_ref` to repo-relative normalized paths after symlink-safe resolution, then compare canonical identities.
- Confidence: 74
- Validation ownership: introduced by current patch intent (contract precision gap)

## Residual Risks
- Acceptance criteria do not explicitly require artifact-content schema checks (only file existence/non-empty/current), so semantic quality can still drift even when structural checks pass.
- Historical receipt backfill remains out-of-scope by design; closeout workflows must ensure this validator’s pass is not misinterpreted as retrospective ratification.

## Testing Gaps
- No explicit criterion for negative tests around canonical path normalization collisions (`./x`, `x`, symlink alias, case variants).
- No explicit criterion for provenance-binding tests (artifact reused with new mtime but stale ownership).

## Accountability Receipt
- status: complete
- artifact_paths:
  - artifacts/reviews/codex-runtime-evidence-slice-assurance-validator-intent-adversarial.md
- manifest_path: artifacts/agent-runs/adversarial-reviewer-20260527T000000/manifest.json
- findings:
  - high: 2
  - medium: 1
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness|task:pu-016-slice-assurance-intent-review" --json` failed with `failed to write PID file: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`
- improvement_opportunities:
  - add cross-member uniqueness for skill-lens pass evidence refs
  - bind evidence artifacts to receipt/lifecycle provenance
  - canonicalize path identity checks for changed_files vs evidence_ref
- strengths:
  - intent already fails closed on key structural risks (traversal, absolute refs, duplicate receipt IDs, malformed maps)
  - reviewer-specific evidence-ref reuse is already recognized as a contract concern
- validation_evidence:
  - command: `cat .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json`
  - command: `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-slice-assurance-validator-intent.json`
- next_action:
  - tighten acceptance criteria before implementation start gate is lifted (`reviewStatus` remains `pending`)
- useful_findings: 3 scenario-level contract gaps with exploit chains
- avoided_false_positive: did not flag historical backfill exclusion as defect because intent marks it explicitly out-of-scope
- evidence_quality: direct line-linked intent evidence with executable scenario chains
- followed_scope: reviewed only intent contract and reviewer questions, no implementation mutation
- reusable_learning: fail-closed validators need provenance-binding and canonical path identity checks to prevent semantic aliasing
- coordinator_score: high confidence actionable
WROTE: artifacts/reviews/codex-runtime-evidence-slice-assurance-validator-intent-adversarial.md

