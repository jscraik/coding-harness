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
- Source-only governance docs must not be referenced from downstream
  scaffolds. When docs lifecycle, guardrail, or domain-language docs are added
  to the source repository, scaffold tests should prove generated templates use
  downstream-facing contracts instead of linking back to source-only docs.
- Generated shell-script quality guards must prove optional tooling is
  availability-checked before execution. Repo-owned package CLIs may use a
  package-manager probe such as `pnpm exec diagram --version` instead of a
  global `command -v` lookup when the runtime contract intentionally avoids
  depending on a developer-machine binary.
- Generated PR template fixtures must use issue-scoped acceptance evidence:
  acceptance IDs need to be bound to the linked issue key (for example,
  `JSC-999 SA-999-001 -> evidence`), and preparatory/no-completion text must
  name the concrete issue key rather than a generic linked issue.
- Generated PR templates must keep the `Behavior Proof` evidence lane
  synchronized with the repository PR template and validator rules. Observable
  runtime, CLI, generated-artifact, validation, agent-workflow, and user-facing
  documentation changes need proof fields that describe the behavior addressed,
  path tested, evidence observed, untested paths, proof limits, and before
  evidence when available.
- Generated PR templates must keep the `Motivation` section synchronized with
  the repository PR template and validator rules. Generated PR bodies need
  explicit `Motivation`, `Reasoning`, and `Chosen approach` fields near
  the top so maintainers can review intent before implementation detail.

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
pnpm vitest run src/lib/init/scaffold-shell-quality.test.ts
pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts
pnpm vitest run src/commands/docs-gate.test.ts src/lib/pr-template-validator.test.ts
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```
