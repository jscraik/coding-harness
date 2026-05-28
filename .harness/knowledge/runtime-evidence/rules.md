---
type: project-brain-rules
status: active
domain: runtime-evidence
sources: [AGENTS.md, src/lib/runtime, src/lib/delivery-truth]
aliases: [runtime-evidence-rules]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Runtime Evidence Rules

**Rule count:** 1
**Last promoted:** 2026-05-26

## Active rules

- **R-001**: Runtime evidence changes must keep evidence packets advisory, source-provenance-aware, freshness-aware, and separated from merge or closeout authority until an explicit contract migration says otherwise.
  - Severity: must
  - Rationale: Runtime proof can otherwise overstate delivery readiness and hide stale or partial external-state evidence.
  - Last promoted: 2026-05-26
  - Promoted from: .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md#harness-engineering-insights
  - Source: AGENTS.md

## Promotion guide

1. Hypothesis observed 3+ times -> promote to rule
2. Rule contradicted by evidence -> demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
