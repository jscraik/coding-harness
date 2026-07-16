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
- `scaffold-gitbook-templates.ts` owns the downstream `.gitbook.yaml`,
  `docs/public/`, GitBook privacy validator, and logical
  `.harness/project-context-ref.json`. The project reference is portable input
  for SynAIpse's Jamie-local registrar; it must not contain Jamie Brain paths or
  private context bodies. CircleCI runs the generated readiness validator before
  the general docs gate.
- Packaged files under `src/templates/` are reserved for generated scaffold
  assets and helper fragments consumed by init renderers. Manual setup payloads,
  such as Linear UI copy-paste templates, belong with their operator docs rather
  than the scaffold package surface.
- Generated memory baselines must always emit a non-empty `repo` value. When a
  target repository has no package name, the scaffold falls back to the target
  directory name so `memory-gate` can validate non-package repositories.
- Source-only governance docs must not be referenced from downstream
  scaffolds. When docs lifecycle, guardrail, or domain-language docs are added
  to the source repository, scaffold tests should prove generated templates use
  downstream-facing contracts instead of linking back to source-only docs.
- Generated codestyle scaffolds must emit the machine-readable policy index
  alongside the prose modules: `coding-policy.json`,
  `contracts/coding-policy.schema.json`, and
  `scripts/validate-coding-policy.cjs`. The scaffold registry and root
  template tests should prove these files are included so downstream agents can
  validate policy routing and claim boundaries without relying on prose-only
  discovery.
- Generated package scripts must expose the public policy-routing entrypoints
  documented by the scaffolded codestyle pack: `coding-policy:route`,
  `coding-policy:route:changed`, `coding-policy:route:branch`, and
  `coding-policy:validate`. Generated docs should point cold agents at these
  package scripts instead of raw validator internals so downstream command
  examples remain runnable after `harness init`.
- Generated pnpm audit commands must call `pnpm run audit`, preserving the
  repository-owned transport and scope-policy guard instead of dispatching the
  pnpm built-in audit client directly. Generated commands first require a
  declared `package.json > scripts.audit` entry and fail with an actionable
  error when that repository-owned transport is absent.
- Generated environment checks must stay aligned with the repo runtime contract:
  Python and uv remain preflight dependencies, while Ralph is not required for
  `coding-harness` or downstream scaffold execution.
- Generated shell-script quality guards must prove optional tooling is
  availability-checked before execution. Repo-owned package CLIs may use a
  package-manager probe such as `pnpm exec diagram --version` instead of a
  global `command -v` lookup when the runtime contract intentionally avoids
  depending on a developer-machine binary.
- Generated PR template fixtures must use issue-scoped acceptance evidence:
  acceptance IDs need to be bound to the linked issue key (for example,
  `JSC-999 SA-999-001 -> evidence`), and preparatory/no-completion text must
  name the concrete issue key rather than a generic linked issue.
- Generated PR templates must keep the `Release Boundary` lane synchronized
  with the repository PR template and validator rules. Generated PR bodies need
  explicit `Release mode`, `Done line`, `Explicit non-goals`,
  `Allowed polish`, `Deferred polish / follow-up work`, and `Promotion rule`
  fields so downstream maintainers can review Prototype, Portfolio, Product,
  and Harness work against the selected release standard.
- Generated PR templates must keep the `Behavior Proof` evidence lane
  synchronized with the repository PR template and validator rules. Observable
  runtime, CLI, generated-artifact, validation, agent-workflow, and user-facing
  documentation changes need proof fields that describe the behavior addressed,
  path tested, evidence observed, untested paths, proof limits, and before
  evidence when available.
- Generated PR templates must keep the `Durable evidence map` compact table
  synchronized with the repository PR template and validator rules. Evidence-heavy
  PRs need table columns for artifact, durable reference, schema/version,
  producer command, digest, replay command, and authority so local-only
  artifacts can be paired with durable receipts, PR comments, CI artifacts,
  GitHub checks, or runtime-card references.
- Generated PR templates must keep required evidence fields blank by default
  and place example command/status syntax only in Markdown comments. Literal
  placeholder text such as `pass/fail`, `<link / artifact path / comment ID>`,
  or generic merge-rationale prose is intentionally gate-blocking when left in
  a submitted PR body, so scaffold fixtures must prove those placeholders are
  absent from freshly rendered templates and that a completed fixture can still
  satisfy `pr-template-gate`.
- Generated PR templates must keep the `What Problem This Solves` section
  synchronized with the repository PR template and validator rules. Generated PR bodies need
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
  fail closed on package-engine drift before broader validation runs. If the
  ambient shell is below the required Node floor but mise can resolve the pinned
  repository Node, the checker should retry through that pinned runtime before
  producing the fail-closed diagnostic.
- Generated required-check manifests and contract branch-protection defaults must
  use `security-scan` as the required security status check and `CodeRabbit`
  as the independent review status check. Semgrep Cloud scanner execution may
  remain inside the CircleCI-owned security lane, but it must not be emitted as
  a separate required GitHub status context unless the required-check authority
  model is intentionally changed.
- Generated CircleCI scaffolds must include
  `scripts/resolve-circleci-pr-ref.sh` whenever `pr-template` or
  `linear-gate` jobs are emitted. Those jobs should call the shared helper
  instead of carrying separate inline PR-context resolution logic, and the helper
  must remain part of the downstream support-file baseline.
- Generated CircleCI scaffolds must include
  `scripts/read-circleci-pr-metadata.sh` whenever `pr-template` or
  `linear-gate` jobs are emitted. Those jobs should prefer authenticated
  GitHub CLI metadata, then fall back to the public GitHub REST pull endpoint
  for public repositories when CircleCI has stale or invalid GitHub credentials.
- Generated CircleCI governance jobs must keep authenticated GitHub CLI steps
  separate from public tool bootstrap. Prefer
  `GITHUB_PERSONAL_ACCESS_TOKEN` for `gh`-backed PR lookups when it is
  available, but run `mise install` bootstrap helpers with `GH_TOKEN`,
  `GITHUB_TOKEN`, and `GITHUB_PERSONAL_ACCESS_TOKEN` unset so expired or
  PR-scoped tokens do not break public aqua/GitHub release downloads.
- Generated Python validation scaffolds must include `scripts/run-uv-python.sh`
  whenever uv-backed type, artifact, or governance helpers are emitted. The
  wrapper owns repo-scoped `UV_CACHE_DIR` and `UV_PROJECT_ENVIRONMENT` defaults
  so downstream validation paths do not copy uv setup across package scripts or
  hook helpers.
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
- Normal `harness init --dry-run --json` output includes `dryRunPlan`
  advisory metadata with the selected profile, planned create/skip counts, risk
  score, risk level, and operator recommendation. This helps downstream canaries
  identify broad write scopes before applying files, including cases where
  `--minimal` still plans a high-risk number of writes.
- Init path safety permits relative symlink segments that resolve inside the
  target repository, such as `scripts -> Infrastructure/scripts`, so brownfield
  repositories can preview or update repo-owned scaffold files. Absolute
  symlink targets and symlink escapes remain blocked before dry-runs, updates,
  backups, or tracked writes can follow them.
- Init migration writes must create temporary files with exclusive-create
  semantics before the final rename. This keeps scaffold and migration writes
  fail-closed when a stale or competing temp path already exists instead of
  silently overwriting unexpected content.
- Codex preflight symlink tests must pass path inputs as shell arguments rather
  than interpolating them into sourced shell snippets. This keeps fixture paths
  and generated symlink targets inside the same shell-boundary contract as the
  production preflight helpers.

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
pnpm vitest run src/commands/init.test.ts src/lib/memory/validator.test.ts
bash scripts/check-environment.sh
pnpm vitest run src/lib/init/scaffold-shell-quality.test.ts
pnpm vitest run src/lib/init/scaffold-doc-templates.test.ts
pnpm vitest run src/commands/docs-gate.test.ts src/lib/pr-template-validator.test.ts
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```
