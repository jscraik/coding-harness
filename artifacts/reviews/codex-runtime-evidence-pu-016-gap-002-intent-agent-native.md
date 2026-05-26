## Agent-Native Architecture Review

### Summary
This intent is tightly scoped to the GAP-002 false-success closeout bug and preserves the thin-verifier boundary by constraining mutation to PR closeout classifier behavior plus focused tests. Agent integration is present and first-class in this slice because execution, validation, and review artifacts are all machine-addressable (`automationPlan`, `reviewPlan`, explicit artifact paths, and blocked-before-implementation policy). Overall parity assessment: strong, with one implementation-readiness gap that should be tightened before mutation starts.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Change required-check pass classification | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:28,52-54 | File edits in scoped module (`src/lib/pr-closeout/evidence.ts`) | Yes (`inScope`, `deepModuleBoundary`) | Must have | Covered |
| Verify neutral/skipped cannot satisfy closeout pass claims | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:93-100 | Deterministic test commands (`pnpm vitest run ...`) | Yes (`automationPlan`) | Must have | Covered |
| Gate implementation on review evidence | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:108-123 | Artifact-first review workflow | Yes (`reviewPlan`, `implementationStartPolicy`) | Must have | Covered |
| Keep slice from drifting into external-state/delivery-truth rewrites | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:28,60-69,125-130 | Scope/stop-condition controls | Yes | Should have | Covered |
| Capture memory + receipt proof for closeout traceability | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:18-27,84 | Receipt + Project Brain inputs | Yes | Should have | Covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Gap locus vs allowed-edit surface mismatch** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:37-40` and `:52-55` -- Current evidence identifies `src/lib/pr-closeout/claim-builders.ts` as part of the regression path, but `inScope` excludes that file. If the regression needs even a small guard in claim builders, implementers will either violate scope or silently under-fix. Recommendation: either (a) add `src/lib/pr-closeout/claim-builders.ts` to `inScope`/`guardedPathGlobs`, or (b) add an explicit invariant note that no claim-builder mutation is permitted because all behavior is routed through `isPassingCheck`.

#### Observations
1. **Agent-operability is strong and explicit** -- The intent includes machine-actionable review blockers (`reviewStatus`, `implementationStartPolicy`) and deterministic commands, so agents can run the full slice without hidden human-only approvals.
2. **One portability assumption may age poorly** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json:26` references an absolute home-path memory file. This is acceptable in the current repo context but may reduce reproducibility for non-Jamie environments; consider mirroring required memory references into repo-local surfaces when possible.

### What's Working Well
- The slice is narrowly bounded to closeout classification logic and tests, which avoids architecture spillover.
- Acceptance criteria correctly encode the core trust-boundary rule: required checks only pass on explicit success-style conclusions.
- Review requirements are artifact-first and blocking, which supports agent-native execution and verifiable coordination.
- Stop conditions explicitly prevent accidental expansion into runtime-card, review-state, external-state, and delivery-truth rewrites.

### Score
- **5/5 high-priority capabilities are agent-accessible**
- **Verdict:** PASS (with one scope-tightening warning)
WROTE: artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-intent-agent-native.md
