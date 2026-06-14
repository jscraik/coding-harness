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
- Generated PR templates must keep required evidence fields blank by default
  and place example command/status syntax only in Markdown comments. Literal
  placeholder text such as `pass/fail`, `<link / artifact path / comment ID>`,
  or generic merge-rationale prose is intentionally gate-blocking when left in
  a submitted PR body, so scaffold fixtures must prove those placeholders are
  absent from freshly rendered templates and that a completed fixture can still
  satisfy `pr-template-gate`.
- Generated PR templates must keep the `Motivation` section synchronized with
  the repository PR template and validator rules. Generated PR bodies need
  explicit `Motivation`, `Reasoning`, and `Chosen approach` fields near
  the top so maintainers can review intent before implementation detail.
- Generated hook setup must route direct `prek` execution through
  `scripts/run-prek.sh`. The wrapper sets `PREK_HOME` to the worktree cache
  before invoking `prek`, so sandboxed Codex runs and downstream repositories do
  not fall back to a non-writable home-directory cache during hook installation,
  validation, or push triage.
- Generated `prek` hook entries must call leaf adapters such as
  `scripts/hook-pre-commit.sh` and `scripts/hook-pre-push.sh`, while generated
  Make targets stay as manual wrappers around those adapters. This prevents
  recursive hook orchestration and keeps installed hooks, scaffold fixtures, and
  environment drift checks aligned.
- Generated pre-commit adapters must run
  `bash ./scripts/validate-codestyle.sh --fast` after codestyle parity and
  before lint/typecheck so fast local commits cannot skip the codestyle
  enforcement point.
- Generated validation scaffolds must include `scripts/check-node-engine.mjs`
  whenever `scripts/validate-codestyle.sh` is emitted. The checker is part of
  the downstream support-file baseline, so freshly initialized and updated repos
  fail closed on package-engine drift before broader validation runs.
- Generated hook adapters must render package-script commands from the detected
  package manager. Downstream npm or yarn repositories must not receive pnpm-only
  hook commands unless pnpm is the selected package manager.
- The scaffold hook template registry must pass the selected package manager
  into hook renderers so generated adapters, Make targets, and workflow
  fixtures share the same command contract.
- Generated Semgrep bootstrap scripts must not execute `python3` at source time.
  Cache-tag and cache-path discovery must be deferred behind runtime helpers so
  missing `python3` reaches the explicit Semgrep install error path instead of
  failing before bootstrap control flow starts.
- Generated Semgrep executable probes must stay bounded even when `timeout` and
  `gtimeout` are unavailable. The fallback watchdog is part of the hook and CI
  reliability contract because stale scanner binaries must fail fast rather than
  hang pre-push or remote security lanes.

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
