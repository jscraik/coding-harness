---
date: 2026-03-04
topic: command-metadata-registry
---

# Command Metadata Registry Brainstorm

## Table of Contents
- [What We Are Building](#what-we-are-building)
- [Why This Approach](#why-this-approach)
- [Key Decisions](#key-decisions)
- [Out of Scope for v1](#out-of-scope-for-v1)
- [Success Criteria](#success-criteria)
- [Resolved Questions](#resolved-questions)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We Are Building
A single TypeScript command metadata registry that becomes the source of truth for core CLI commands first, then expands across the full command surface. The registry should drive parser wiring, help output, and command documentation so behavior stays consistent and drift is eliminated.

The primary audience is both humans and AI agents. Human maintainers should update one place when changing command interfaces. AI agents should be able to rely on deterministic, machine-readable command definitions and stable output contracts.

## Why This Approach
Current command definitions are fragmented across dispatcher logic, usage text, docs, and tests (for example /Users/jamiecraik/dev/coding-harness/src/cli.ts, /Users/jamiecraik/dev/coding-harness/README.md, /Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts). A typed manifest plus adapter approach gives the highest leverage with lower migration risk than a full rewrite.

This aligns with YAGNI: start with core commands and existing tooling, avoid new runtime dependencies, and validate that drift decreases before full rollout.

## Key Decisions
- Build a typed manifest plus adapters architecture for v1, not full codegen rewrite.
- Prioritize core commands first to de-risk migration and prove value quickly.
- Optimize for both humans and AI agents from day one.
- Add no new runtime dependencies in v1.
- Define success as no parser/help/docs drift for migrated commands.

## Out of Scope for v1
- Full all-command migration in one pass.
- New CLI framework adoption.
- Deep implementation details (reserved for planning).

## Success Criteria
- For migrated commands, parser behavior, CLI help text, and docs remain synchronized after changes.
- Maintainers update command interface details in one place instead of multiple files.
- AI agents can consume stable, machine-readable command metadata for migrated commands.

## Resolved Questions
- Focus area: metadata registry first.
- Primary user: both human maintainers and AI agents.
- v1 scope: core commands first.
- Main success signal: parser/help/docs stay synchronized.
- Constraint: no new runtime dependencies.

## Open Questions
- None for brainstorming phase.

## Next Steps
Proceed to /prompts:workflow-plan to design the implementation sequence, migration order for core commands, validation gates, and rollout safety checks.
