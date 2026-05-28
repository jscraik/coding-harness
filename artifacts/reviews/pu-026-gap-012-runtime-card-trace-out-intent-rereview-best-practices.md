# PU-026 Intent Re-review - best-practices-researcher
## Scope
Reviewed only the PU-026 GAP-012 intent artifact for runtime-card `--trace-out` implementation readiness:

- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json`

Context cross-checks used for compatibility/evidence:
- `contracts/agent-run-event.schema.json`
- `src/commands/runtime-card-args.ts`
- `src/commands/runtime-card.ts`

## Findings
1. Severity: low  
Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:54`, `:70`, `:79`  
Validation ownership: introduced by current intent patch  
Impacted behavior: The intent requires emitting a `precondition:blocked` event for path validation failures, including invalid `--trace-out` destinations. When `--trace-out` is itself invalid (absolute/traversal/non-canonical), there may be no valid canonical event stream destination to append that blocked event, which can produce inconsistent implementations (silent fail vs fallback stream).  
Remediation: Clarify one deterministic rule in the intent before implementation:
- either invalid `--trace-out` is a parse/runtime error with no trace emission, or
- blocked validation events must be emitted to a separate pre-declared fallback canonical run stream independent of user-provided `--trace-out`.
Confidence: high

2. Severity: low  
Evidence: `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-026-gap-012-runtime-card-trace-out-intent.json:60`, `:114`  
Validation ownership: introduced by current intent patch  
Impacted behavior: The intent splits error behavior into parse-only usage errors (no trace file) and runtime failures (error trace required), but does not explicitly classify `--trace-out` path rejection as parse-time or runtime-time. This can diverge test expectations across implementations.  
Remediation: Add one explicit classification sentence (for example: “`--trace-out` path contract violations are treated as parse-time usage errors with exit 2 and no trace emission.”) and align tests accordingly.  
Confidence: high

## Verdict
PASS_WITH_NON_BLOCKING_NOTES

WROTE: /Users/jamiecraik/dev/coding-harness/artifacts/reviews/pu-026-gap-012-runtime-card-trace-out-intent-rereview-best-practices.md

