---
type: project-brain-domain
status: active
domain: memory-provenance
sources: [.harness/memory/LEARNINGS.md, .harness/README.md, docs/agents/03-local-memory.md]
aliases: [memory-provenance-knowledge]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Memory Provenance Knowledge

**Last verified:** 2026-05-26
**Verification source:** manual
**Confidence:** high
**Owner:** coding-harness maintainers

## Confirmed facts

- Memory citations and rollout/session summaries are provenance surfaces; they should support recall without replacing current repo, PR, CI, or tracker truth.
  - Source: docs/agents/03-local-memory.md
- Project Brain stores durable distilled rules, decisions, and knowledge; runtime databases, caches, and bulk snapshots stay local unless explicitly promoted.
  - Source: .harness/README.md
- Learned-fix promotion requires a durable destination or an explicit skip reason before closeout when the signal is high-value and repeated.
  - Source: AGENTS.md

## Patterns

- Treat memory as routing evidence first, then verify live state when the answer is drift-prone or cheap to refresh.
- Keep cited memory separate from current validation evidence in handoff and PR closeout.

## Gotchas

- Memory-derived facts can be stale even when the cited rollout was accurate at the time.
- Raw session traces and bulky telemetry should not be pasted into PR bodies.

## References

- .harness/memory/LEARNINGS.md
- .harness/README.md
- docs/agents/03-local-memory.md
- src/lib/pr-closeout/
