## Agent-Native Architecture Review

### Summary
The PU-035 SPG-009 intent defines a strong artifact-runtime-surface contract that is aligned with agent-native parity goals: it treats artifacts as inspectable runtime surfaces instead of implicit proof, keeps packets content-minimal, and requires semantic validation before claim support. The slice is close to agent-operable, but two machine-consumption gaps remain: claim reference semantics are not constrained enough for deterministic downstream decisioning, and preview-reference safety boundaries are under-specified for automated consumers.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Classify artifacts as orientation vs claim-support runtime surfaces | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:36-44,46-58 | Planned semantic validator + packet schema manifest entry | Yes (SPG-009 gap in goal) | Must-have | Partial |
| Reject stale/missing/broken artifacts from claim-support eligibility | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:39-41,48-53 | Planned semantic validator | Yes | Must-have | Covered |
| Prevent raw artifact/content leakage into runtime packets | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:32,36,42,114 | Planned schema + semantic validator | Yes | Must-have | Covered |
| Discover packet contract via runtime schema manifest | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:43,55 | Planned manifest update | Yes | Should-have | Covered |

### Findings

#### Warnings (Should Fix)
1. **Claim-reference contract is underspecified for machine decisioning**
Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:39,48,52 and docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:223-225.
Impacted behavior: The intent requires "supported claim refs" but does not define a canonical claim-ref taxonomy, format, or authority source. Different producers could emit incompatible refs while still passing shallow presence checks, reducing cross-agent interoperability for closeout consumers.
Remediation: Add explicit claim-ref shape and allowed vocabulary in the schema/validator contract (for example: namespaced claim ids, origin packet id, and validation authority enum), plus fixtures for unknown/legacy claim ids.
Confidence: 0.82
Validation ownership: introduced by current patch intent surface.

2. **Preview reference safety boundary is not explicit enough for autonomous consumers**
Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:41,54 and docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:216.
Impacted behavior: The intent requires preview presence/currentness but does not explicitly constrain preview reference forms (for example: repo-relative path only vs URI classes). This can allow agents to encounter non-repo or unstable preview targets that are hard to classify safely.
Remediation: Define allowed preview reference classes in schema + semantic validator (for example: repo-relative file preview ids and explicit disallow of network/absolute/home references), and add fixtures for rejected preview URI/path classes.
Confidence: 0.76
Validation ownership: introduced by current patch intent surface.

#### Observations
1. The intent is strong on non-leakage and fail-closed semantics for claim support, including stale front matter, broken preview, lineage mismatch, and unsupported claims. Evidence: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-035-spg-009-artifact-runtime-surface-intent.json:39-44,48-55.
2. The goal-level SPG-009 statement and minimum-proof table align with the intent's validation matrix, reducing drift risk between planning and implementation. Evidence: docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md:216,223-225.

### What's Working Well
- The packet is intentionally narrow and avoids content warehousing, preserving agent-safe inspectability boundaries.
- The manifest discoverability requirement supports runtime-card/receipt consumer onboarding.
- Stop conditions explicitly block accidental promotion of orientation artifacts into delivery proof.

### Score
- **3/4 high-priority capabilities are agent-accessible**
- **Verdict:** NEEDS WORK

WROTE: artifacts/reviews/pu-035-spg-009-artifact-runtime-surface-intent-agent-native.md
