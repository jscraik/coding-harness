## Agent-Native Architecture Review

### Summary
This rereview covered the PU-019 / GAP-008 context-health hardening changes in `src/lib/agent-readiness/context-health.ts`, `src/commands/agent-readiness.test.ts`, and `.harness/core/agent-readiness-contract.md`. The updated implementation preserves agent-native intent: active-route refs now accept safe repo-relative paths beyond hardcoded prefixes while filtering unsafe tokens, external-horizon remains free of misleading local refresh commands, and contract docs now clearly scope projection-level refresh guidance as advisory. No new agent-native parity regressions were found in the reviewed surfaces.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Provide active route artifact refs for context health | .harness/active-artifacts.md consumption in src/lib/agent-readiness/context-health.ts:86 | `harness agent-readiness --json` / context-health projection builder | n/a (CLI surface) | Must-have | Pass |
| Refresh local active artifact context | src/lib/agent-readiness/context-health.ts:121 and :151 | `artifact-routine --active-index ... --json` suggestion | n/a (CLI surface) | Should-have | Pass |
| Refresh external horizon evidence | src/lib/agent-readiness/context-health.ts:225 | none (intentionally no local command suggestion) | n/a (CLI surface) | Must-have | Pass |
| Interpret projection refresh commands safely | .harness/core/agent-readiness-contract.md:59 | Contract guidance for consumers | n/a (governance docs) | Must-have | Pass |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Template/contract artifact path guidance unavailable in checkout** -- command evidence: `nl -ba agents/templates/review-artifact.md` and `nl -ba agents/contracts.json` returned "No such file or directory". Suggestion: if these paths are expected by coordinator policy, add or point reviewers to the in-repo canonical equivalents to avoid reviewer variance.

### What's Working Well
- `extractRepoRelativeBacktickPaths` call site is now constrained by safety filtering while remaining path-prefix agnostic for repo-relative refs (`src/lib/agent-readiness/context-health.ts:91-99`).
- External horizon still avoids false-local freshness affordances by keeping `suggestedRefreshCommands: []` (`src/lib/agent-readiness/context-health.ts:244`).
- Contract language now explicitly marks `contextHealth.suggestedRefreshCommands` as projection-level advisory and surface-specific (`.harness/core/agent-readiness-contract.md:59-63`).
- Focused regression coverage exists for both accepted safe refs and rejected unsafe tokens (`src/commands/agent-readiness.test.ts:192-267`).

### Validation Evidence
- `pnpm vitest run src/commands/agent-readiness.test.ts` -> pass (1 file, 18 tests).
- `pnpm exec biome check src/lib/agent-readiness/context-health.ts src/commands/agent-readiness.test.ts` -> pass.
- `git diff --check -- src/lib/agent-readiness/context-health.ts src/commands/agent-readiness.test.ts .harness/core/agent-readiness-contract.md` -> pass (no output).

### Score
- **4/4 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

## Accountability Receipt
- status: complete
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6821-0c9c-7223-a20b-3df08600ad49/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-019-gap-008-context-health-agent-native-rereview.md
- findings:
  - useful_findings: 1 observation (missing expected reviewer template/contract paths); 0 parity defects
  - avoided_false_positive: Did not flag external_horizon missing refresh command as defect; verified this is intentional and safety-preserving.
  - evidence_quality: High for inspected code/docs/tests; medium for repo-wide template policy due to missing expected files.
  - followed_scope: Strictly limited to requested files and focused validation commands.
  - reusable_learning: Projection-level refresh guidance should remain advisory to prevent accidental claim-support escalation.
  - coordinator_score: 9/10 (clear reroute target and validation expectations enabled fast closure)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - Add discoverable in-repo location for reviewer artifact templates/contracts if policy expects them.
- strengths:
  - Safety hardening and regression tests are aligned and explicit.
  - Documentation now reflects implementation intent for advisory refresh semantics.
- validation_evidence:
  - pnpm vitest run src/commands/agent-readiness.test.ts (pass, 18 tests)
  - pnpm exec biome check src/lib/agent-readiness/context-health.ts src/commands/agent-readiness.test.ts (pass)
  - git diff --check target files (pass, no issues)
- next_action:
  - Coordinator can treat PU-019/GAP-008 agent-native lane as ready unless another reviewer reports cross-surface concerns.

WROTE: artifacts/reviews/pu-019-gap-008-context-health-agent-native-rereview.md
