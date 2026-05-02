# Governance Rules

**Rule count:** 2
**Last promoted:** 2026-04-30

## Active rules

- **R-001**: Runtime gate work must run Project Brain preflight before edits and update Project Brain with new repeated rules, decisions, or gotchas before closeout.
  - Severity: must
  - Rationale: Gate integration work changes how agents enter, validate, and close out production work. Project Brain preflight preserves relevant governance context before edits, and closeout updates prevent repeated gate lessons from staying trapped in a single PR.
  - Last promoted: 2026-04-27
  - Promoted from: `harness brain add`

- **R-002**: North-star learning-loop closeout must route durable repeated learnings into Project Brain after machine-readable evidence is checked.
  - Severity: should
  - Rationale: `harness learnings gate`, `harness review-context`, and `harness north-star-feedback` keep repeated review evidence enforceable in PRs, while Project Brain keeps the durable why discoverable for future agents and plans.
  - Last promoted: 2026-04-30
  - Promoted from: CodeRabbit learnings operational-evidence tightening

## Deprecated

No deprecated governance rules as of 2026-04-30.

## Promotion guide

1. Hypothesis observed 3+ times -> promote to rule
2. Rule contradicted by evidence -> demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
