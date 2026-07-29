# Init module

`src/lib/init/` implements `harness init`: CLI argument parsing, target
inspection, scaffold selection, contract rendering, and rollback-aware writes.
The public command stays in `src/commands/init.ts`; command registration stays
in `src/lib/cli/registry/init-command-spec.ts`.

## Minimal mode

`init --minimal` emits only `harness.contract.json`. The contract records the
schema version plus explicit empty CI-check and review-check selections. It
does not infer a tracker, workflow, memory system, hooks, docs site, or policy
pack. Consumers recognize that exact raw shape and report their optional
review, CI, and tracker routes as not applicable rather than silently loading
full defaults.

`projectType` may be included when the caller explicitly selects or detects a
supported type. Any other policy belongs to an explicit standard or full
contract, not the minimal scaffold.

## Change boundaries

- Keep scaffold templates, the compact-contract predicate, loader behavior, and
  their focused tests aligned.
- Preserve target path safety and rollback behavior. Relative in-repository
  symlinks are allowed; absolute or escaping links are blocked.
- Run focused init and compact-contract tests, then
  `bash scripts/run-harness-gate.sh docs-gate --mode required --json` when
  operator-facing scaffold behavior changes.
