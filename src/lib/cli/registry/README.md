# Command Registry

## Table of Contents

- [Adapter Shapes](#adapter-shapes)
- [Public Metadata](#public-metadata)
- [Validation](#validation)

## Adapter Shapes

Use `defineCommandSpec` for command specs that only provide public metadata
and forward raw CLI args to one runner. Keep a bespoke factory when the spec
assembles options, composes multiple runners, owns compatibility behavior, or
needs command-specific parsing before dispatch.

## Public Metadata

The command name, aliases, summary, example, and error label are agent-facing
CLI contract fields. Treat changes to those fields as user-visible command
contract changes.

## Validation

Run the command-spec tests after changing registry adapters:

```bash
pnpm vitest run src/lib/cli/registry/define-command-spec.test.ts src/lib/cli/registry/command-specs.test.ts
```
