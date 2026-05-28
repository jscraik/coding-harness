---
type: project-brain-rules
status: active
domain: agent-context
sources: [AGENTS.md, docs/agents/01-instruction-map.md]
aliases: [agent-context-rules]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Agent Context Rules

**Rule count:** 1
**Last promoted:** 2026-05-26

## Active rules

- **R-001**: Agent-visible instruction, skill, plugin, or role changes must preserve the discovered authority boundary and include an explicit runtime-freshness or fallback story.
  - Severity: must
  - Rationale: Agents act on loaded context, so undiscovered or stale instruction surfaces cannot be treated as effective controls.
  - Last promoted: 2026-05-26
  - Promoted from: Project Brain setup audit with Codex AGENTS/context review
  - Source: AGENTS.md

## Promotion guide

1. Hypothesis observed 3+ times -> promote to rule
2. Rule contradicted by evidence -> demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
