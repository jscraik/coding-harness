---
type: project-brain-domain
status: active
domain: testing
sources: [src/lib/project-brain, src/commands/brain.test.ts, codestyle/17-testing.md]
aliases: [testing-knowledge]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Testing Knowledge

**Last verified:** 2026-05-26
**Verification source:** manual
**Confidence:** high
**Owner:** coding-harness maintainers

## Confirmed facts

- Project Brain mapper and CLI behavior have focused Vitest coverage under src/lib/project-brain/.
  - Source: src/lib/project-brain/cli.test.ts
- Changed CLI behavior should be proved with both unit tests and source CLI smoke commands when practical.
  - Source: codestyle/17-testing.md
- Tests for agent-facing command discovery should cover help paths as well as happy-path JSON output.
  - Source: src/lib/project-brain/cli.test.ts

## Patterns

- Add focused regression tests next to the module that owns the behavior.
- For CLI usage behavior, capture stdout and stderr so help paths do not accidentally degrade into validation errors.

## Gotchas

- A command can have passing API tests while still being hard for agents to discover if --help exits through the wrong layer.

## References

- src/lib/project-brain/*.test.ts
- src/cli.test.ts
- docs/agents/04-validation.md
