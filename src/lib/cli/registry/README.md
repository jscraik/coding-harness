# CLI Registry

## Table of Contents

- [Purpose](#purpose)
- [Command Spec Authoring](#command-spec-authoring)
- [Validation](#validation)

## Purpose

This directory owns the command registry metadata that agents and users see
through command dispatch, help, suggestions, and capability catalogs.
Command names, aliases, summaries, examples, and error labels are public
agent-facing metadata, even when the command implementation lives elsewhere.

## Command Spec Authoring

Use `defineCommandSpec` for simple adapters that only supply metadata and
forward the remaining CLI args to one runner. This keeps pass-through command
specs consistent without creating one-off object shapes.

Use a bespoke factory when the command spec owns parsing, composes multiple
runners, preserves compatibility behavior, or needs custom execution glue.

When adding or migrating a command spec:

- Keep local ESM imports on `.js` paths.
- Preserve command metadata unless the user-facing contract is intentionally
  changing.
- Search sibling `*-command-spec.ts` files before adding a new pattern.
- Add or update tests when metadata, aliases, examples, or dispatch behavior
  change.

## Validation

Run the narrow registry tests with `pnpm run test:registry` (or equivalent test
target) and assert the process exits with code 0 and all tests pass. Then run
`pnpm typecheck` and assert it exits 0 with no type errors. On any failure,
capture the failing test or typecheck output, fix the helper signature/imports
or revert the registry-only change, and re-run until both commands succeed. If
failures persist, notify the registry owners.
