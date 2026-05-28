---
type: project-brain-rules
status: active
domain: testing
sources: [src/lib/project-brain/cli.test.ts, src/commands/brain.test.ts, codestyle/17-testing.md]
aliases: [testing-rules]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Testing Rules

**Rule count:** 1
**Last promoted:** 2026-05-26

## Active rules

- **R-001**: Agent-facing CLI discovery fixes must include regression coverage for the exact help or machine-readable path that failed.
  - Severity: should
  - Rationale: Discovery regressions are easy to miss when only functional command paths are tested.
  - Last promoted: 2026-05-26
  - Promoted from: Project Brain setup audit
  - Source: src/lib/project-brain/cli.test.ts

## Promotion guide

1. Hypothesis observed 3+ times -> promote to rule
2. Rule contradicted by evidence -> demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
