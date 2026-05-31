# Init Deep Module

## Table of Contents

- [Purpose](#purpose)
- [Boundaries](#boundaries)
- [Documentation Alignment](#documentation-alignment)
- [Validation](#validation)

## Purpose

`src/lib/init/` owns the reusable implementation behind `harness init`: option
projection, downstream scaffold templates, contract/default migration helpers,
and generated repository setup surfaces. Public command entrypoints should stay
thin and delegate into this deep module.

## Boundaries

- `src/commands/init.ts` remains the compatibility facade.
- `src/commands/init-command-spec.ts` remains the command-registry adapter.
- `src/lib/init/cli-args.ts` owns raw argument projection and init-mode
  validation.
- Scaffold template changes must keep generated downstream docs, PR templates,
  workflow files, and regression fixtures synchronized.
- Generated PR template fixtures must use issue-scoped acceptance evidence:
  acceptance IDs need to be bound to the linked issue key (for example,
  `JSC-999 SA-999-001 -> evidence`), and preparatory/no-completion text must
  name the concrete issue key rather than a generic linked issue.

## Documentation Alignment

Changes to init scaffolding can alter what downstream repositories receive.
When this module changes, classify documentation impact in the PR body and
update any affected root docs, governed docs, generated template docs, and this
module README. If a documentation surface is not affected, record `n.a.` with a
concrete reason in the PR `Documentation impact` field.

## Validation

Use the narrowest relevant checks first, then widen when scaffold behavior or
operator guidance changes:

```bash
pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts
pnpm vitest run src/commands/docs-gate.test.ts src/lib/pr-template-validator.test.ts
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```
