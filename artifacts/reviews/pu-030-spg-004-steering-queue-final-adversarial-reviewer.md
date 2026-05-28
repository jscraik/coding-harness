# Adversarial Review - PU-030 SPG-004 SteeringQueue Final

STATUS: complete

## Findings (severity-ranked)

### 1) High - Cross-scope selection collapse can route continuation to the wrong workstream
- Severity: high
- Validation ownership: introduced by current patch
- Confidence: 75
- Evidence:
  - Trigger: packet contains two independent applicable items from different scopes.
  - Execution path: selector ignores `scopeRef` and sorts all applicable items globally in one list ([src/lib/steering-queue/steering-queue.ts:508](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:508), [src/lib/steering-queue/steering-queue.ts:513](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:513), [src/lib/steering-queue/steering-queue.ts:524](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:524)).
  - Composition failure: a lower-priority item in scope A can be dropped indefinitely if scope B keeps producing higher-priority applicable items because `selectedItemId` is singular and global ([src/lib/steering-queue/steering-queue.ts:302](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:302)).
  - Contract conflict: intent invariant states deterministic winner should be for items in the same continuation scope, not cross-scope global arbitration ([intent.json:70](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-030-spg-004-steering-queue-intent.json:70)).
- Impacted behavior: deferred steering for one scope can be starved or mis-prioritized by unrelated scope traffic.
- Remediation: either (a) enforce one-scope-per-packet invariant in builder/validator, or (b) compute deterministic winners per `scopeRef` and expose a scoped selection map instead of one global `selectedItemId`.

### 2) Medium - Cyclic supersession makes selection comparator non-transitive and can produce runtime-dependent winners
- Severity: medium
- Validation ownership: introduced by current patch
- Confidence: 75
- Evidence:
  - Trigger: three applicable items with cyclic supersession references (A supersedes B, B supersedes C, C supersedes A).
  - Execution path: comparator is pairwise and only checks direct `supersedes.includes(other.id)` ([src/lib/steering-queue/steering-queue.ts:522](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:522), [src/lib/steering-queue/steering-queue.ts:523](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:523)).
  - Cascade: non-transitive comparator can produce unstable `.sort()` order when graph has cycles; selected winner then varies by sort behavior and input ordering, despite deterministic-claim contract ([src/lib/steering-queue/steering-queue.ts:514](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:514)).
- Impacted behavior: selection can flip across runs for identical logical state when supersession data is cyclic or contradictory.
- Remediation: validate `supersedes` as DAG (reject cycles) before selection, or topologically rank supersession lineage and fail closed on cycle detection.

### 3) Medium - Duplicate instruction source refs can silently flip stale/applicable verdicts by ingestion order
- Severity: medium
- Validation ownership: introduced by current patch
- Confidence: 50
- Evidence:
  - Trigger: `instructionSources` contains duplicate `instructionRef` entries with different texts (e.g., one stale copy and one fresh copy).
  - Execution path: builder collapses sources into a `Map` keyed by `instructionRef`; last occurrence wins silently ([src/lib/steering-queue/steering-queue.ts:280](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:280), [src/lib/steering-queue/steering-queue.ts:281](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:281)).
  - Composition failure: hash-verification path reads the post-collapse value only, so upstream source ordering controls whether precondition becomes `instruction_hash_mismatch` or passes ([src/lib/steering-queue/steering-queue.ts:398](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:398), [src/lib/steering-queue/steering-queue.ts:409](/Users/jamiecraik/dev/coding-harness/src/lib/steering-queue/steering-queue.ts:409)).
- Impacted behavior: identical logical inputs from different ingestion orders can alter stale classification and downstream selected item.
- Remediation: reject duplicate `instructionRef` values before map construction, or require identical normalized text for duplicate refs and fail validation otherwise.

## Residual Risks
- Semantic validator does not explicitly enforce “one-scope packet” or supersession acyclicity, so mis-prioritization failure modes remain possible even if schema validation passes.

## Testing Gaps
- No regression tests for cross-scope arbitration.
- No regression tests for cyclic supersession graphs.
- No regression tests for duplicate `instructionSources` refs with conflicting text.

## Accountability Receipt
- status: complete
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6c5c-a20e-7b92-837b-a79dd144de5c/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-030-spg-004-steering-queue-final-adversarial-reviewer.md
- findings:
  - 3 (1 high, 2 medium)
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu030-final-adversarial" --json` failed with `failed to save PID: open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`.
- improvement_opportunities:
  - add semantic checks for supersession DAG and scope partitioning.
  - add duplicate-instruction-source invariant checks.
- strengths:
  - pointer-only schema and semantic raw-key rejection are consistently enforced.
  - explicit stale-precondition taxonomy improves forensic traceability.
- validation_evidence:
  - `zsh -lc nl