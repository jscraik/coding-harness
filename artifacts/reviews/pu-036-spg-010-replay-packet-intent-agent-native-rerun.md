## Agent-Native Intent Rerun Review (PU-036 SPG-010)

### Status
PASS with no new material blockers in the amended intent.

### Scope Reviewed
- Intent artifact only: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json`
- Objective: verify closure of prior intent-level findings (digest/integrity, hookExecutionIdentity spoofing, stale/head freshness gate, agent-discoverable command surface) and identify any new intent-level blocker.

### Closure Check Against Prior Findings

1. **Per-ref digest/integrity gap: CLOSED**
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:41` requires replay-critical refs to be content-bound with `sha256` plus 64-char digest and digest-match validation for repo refs requiring existence.
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:60-61,67` adds explicit rejection criteria for missing/invalid hashes, digest mismatch, and filesystem-existence/path containment constraints.

2. **hookExecutionIdentity spoofing gap: CLOSED**
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:42-43` requires hook provenance plus hookExecutionIdentity with hook file digest and resolved command digest.
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:63` adds rejection criterion when hook provenance is missing required identity elements.

3. **Stale/head freshness gate gap: CLOSED**
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:47-48` requires `observedHeadSha`, `currentHeadSha`, `ttlSeconds`, freshness fields, and downgrade semantics.
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:64-65` enforces orientation-use rejection unless current plus head match plus TTL valid; stale/expired only allowed as `audit_trail` with blocker/stale reason.

4. **Agent-discoverable command-surface gap: CLOSED**
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:51,69` adds explicit discoverability constraint and acceptance criterion.
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:78` adds machine-readable command-catalog validation (`commands --json --all` plus `jq` replay command assertion).

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Discoverability proof checks command presence, not full replay-packet workflow invocation**
- Severity: Observation
- Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:69,78`
- Impacted behavior: Intent proves replay command discoverability and schema-manifest exposure, but not necessarily end-to-end replay-packet generate/validate completion from one recommendation surface.
- Remediation: Optional hardening in implementation review: add one narrow test/assertion linking discoverability to concrete replay-packet validation action path.
- Confidence: 0.61
- Validation ownership: pre-existing tradeoff (not a blocker in this amended intent).

### Residual Risks
- Main residual risk is implementation drift: schema and semantic validator could under-enforce one or more newly-added constraints despite sufficient intent language.
- Main residual risk is test granularity: final confidence depends on negative-case fixtures aligning to each rejection axis listed in acceptance criteria.

### Validation Ownership Summary
- Prior blocker classes (digest/integrity, hook identity, freshness/head gating, discoverability) are addressed in this intent revision.
- No newly introduced intent-level blocker detected.

### Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6ef8-d921-7a91-9767-ce8318f57c7c/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-036-spg-010-replay-packet-intent-agent-native-rerun.md
- findings:
  - useful_findings: prior four blockers verified closed with line evidence
  - avoided_false_positive: did not re-raise prior gaps once explicitly encoded in constraints, acceptance, and validation
- failures_or_blockers: none
- improvement_opportunities:
  - add optional end-to-end discoverability-to-invocation assertion in implementation validation
- strengths:
  - acceptance criteria now encode explicit reject conditions for all four prior risk classes
  - validation plan now includes machine-readable command-surface proof
- validation_evidence:
  - zsh -lc "nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json | sed -n '1,220p'"
  - zsh -lc "rg -n 'digest|hookExecutionIdentity|freshness|commands --json --all|agent-discoverable' .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json artifacts/reviews/pu-036-spg-010-replay-packet-intent-agent-native.md"
- next_action:
  - proceed to implementation with this amended intent and verify each encoded rejection rule in implementation review
- positive_performance:
  - evidence_quality: high
  - followed_scope: yes (intent-only)
  - reusable_learning: use explicit closure matrix for intent reruns
  - coordinator_score: 9/10

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-intent-agent-native-rerun.md
