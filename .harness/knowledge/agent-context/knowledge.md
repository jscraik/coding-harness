---
type: project-brain-domain
status: active
domain: agent-context
sources: [AGENTS.md, CODESTYLE.md, docs/agents/01-instruction-map.md]
aliases: [agent-context-knowledge]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Agent Context Knowledge

**Last verified:** 2026-05-26
**Verification source:** manual
**Confidence:** high
**Owner:** coding-harness maintainers

## Confirmed facts

- AGENTS.md is an instruction-discovery surface and deeper scoped AGENTS.md files override parent files within their subtree.
  - Source: AGENTS.md
- Codex constructs model-visible context from base/developer/user instructions plus available skills, plugins, permissions, and workspace state.
  - Source: AGENTS.md
- Repo-local skills and project-local reviewer roles are part of the harness operating surface, not just documentation.
  - Source: AGENTS.md

## Patterns

- Instruction changes should route through the active discovery boundary before editing implementation behavior.
- Skill, plugin, and agent-role changes should keep agent-native discoverability, runtime freshness, and fallback behavior explicit.

## Gotchas

- File presence alone does not prove a project-local agent role is loaded into the current Codex runtime.
- Duplicating instruction guidance into non-discovered docs can create stale advice without changing agent behavior.

## References

- AGENTS.md
- CODESTYLE.md
- docs/agents/
- .agents/skills/
- .codex/agents/
