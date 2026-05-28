---
type: project-brain-rules
status: active
domain: memory-provenance
sources: [.harness/memory/LEARNINGS.md, docs/agents/03-local-memory.md, AGENTS.md]
aliases: [memory-provenance-rules]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Memory Provenance Rules

**Rule count:** 1
**Last promoted:** 2026-05-26

## Active rules

- **R-001**: Memory-backed claims must identify whether they are routing context, durable rule evidence, or current validation evidence before being used for closeout.
  - Severity: must
  - Rationale: Memory is valuable for recall, but delivery readiness requires current repo and external-state proof.
  - Last promoted: 2026-05-26
  - Promoted from: Project Brain setup audit with Codex memory-citation review
  - Source: AGENTS.md

## Promotion guide

1. Hypothesis observed 3+ times -> promote to rule
2. Rule contradicted by evidence -> demote back to hypothesis
3. Each rule gets a unique R-NNN identifier within its domain
