# Coding Harness

Status: [CircleCI main](https://app.circleci.com/pipelines/github/jscraik/coding-harness?branch=main) | [npm package](https://www.npmjs.com/package/@brainwav/coding-harness) | [Apache-2.0 license](LICENSE) | [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/jscraik/coding-harness)

Coding Harness is a CLI control plane for repositories that use AI coding
agents. Coding Harness exists to let a solo developer with limited cognitive
bandwidth orchestrate agentic software work to professional standards through
compact orientation, executable guardrails, durable memory, and evidence-based
handoff.

Thin surface. Strong guardrails. Durable memory. Professional output.

Expected outcome: Coding Harness becomes a portable agent operating system that
makes Codex behave like a software engineer, not merely a code generator, across
greenfield and brownfield projects with zero customer integration ceremony.

Its primary metric is PR lead time: reducing time from open to merge by
shrinking the review and rework loop while keeping humans in the steering role
and preserving strict evidence, SHA, and rollback discipline.

It is best thought of as the layer around the agents, not the agent runtime
itself. It helps you make a repo safer to automate by giving it a contract,
repo-local verification scripts, review policy, CI migration tooling, and
artifact-backed rollout checks.

For the source map, stable boundaries, and architecture invariants, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

The shortest honest description of the project today is:

- it helps a solo developer steer agentic software work safely
- it reduces PR lead time by making review and rework cheaper
- it gives downstream repos repo-local verification and preflight scripts
- it validates review, docs, plan, and authorization policy before merge
- it supports staged CI migration, rollback, and autonomy expansion with
  artifact-backed evidence

## Table of Contents

- [Start Here](#start-here)
- [Lite Mode (Solo And Small Team)](#lite-mode-solo-and-small-team)
- [North Star](#north-star)
- [Why Teams Use It](#why-teams-use-it)
- [What It Is Best At Today](#what-it-is-best-at-today)
- [Security Posture Baseline](#security-posture-baseline)
- [Installation](#installation)
- [Repo-local Wrapper](#repo-local-wrapper)
- [Repo-local Verification](#repo-local-verification)
- [Common Workflows](#common-workflows)
  - [Hero Workflow 1: Bootstrap a repository](#hero-workflow-1-bootstrap-a-repository)
  - [Hero Workflow 2: Start work on an issue](#hero-workflow-2-start-work-on-an-issue)
  - [Hero Workflow 3: Submit a change for review](#hero-workflow-3-submit-a-change-for-review)
  - [Learning-loop closeout](#learning-loop-closeout)
  - [Advanced: Migrate CI with rollback and proof](#advanced-migrate-ci-with-rollback-and-proof)
  - [Advanced: Validate a Symphony workflow contract](#advanced-validate-a-symphony-workflow-contract)
  - [Advanced: Evaluate a pilot before expanding autonomy](#advanced-evaluate-a-pilot-before-expanding-autonomy)
- [Command Index](#command-index)
- [Requirements](#requirements)
- [Local Development](#local-development)
- [Packaged Codex Skill](#packaged-codex-skill)
- [Issue Reporting](#issue-reporting)
- [Trust Artifacts](#trust-artifacts)

## Start Here

For agents, start with the cockpit decision packet:

```bash
harness next --json
```

When a local runtime artifact already exists, pass it into the same read-only
cockpit command so blockers and lifecycle state are reflected in the decision:

```bash
harness runtime-card --json --live \
  --out .harness/runtime/JSC-311.json \
  --evidence-out .harness/runtime/JSC-311-evidence.json
harness next --json --runtime-card .harness/runtime/JSC-311.json
```

`harness --help` now keeps first contact intentionally narrow and points agents
at `harness next --json`. Use `harness --help --all-commands` or
`harness commands --json` only when you need the full expert command surface.

Get from zero to a governed, agent-ready repository in five steps (standard path):

```bash
# 1. Install
pnpm add -g @brainwav/coding-harness

# 2. Preview what harness will scaffold (no writes)
harness init --dry-run

# 3. Apply and track the scaffold
harness init --track

# 4. Validate the contract file
harness contract validate

# 5. Check overall repo health
harness health --json
```

That is the minimum viable path. The common routes beyond this are:

- **Agent cockpit loop** — run `harness next --json`, inspect `safeToRun`, then
  execute `nextCommand` only when it is safe; see
  [CLI reference](./docs/cli-reference.md#agent-cockpit-entrypoint).
- **[Bootstrap a repository](#hero-workflow-1-bootstrap-a-repository)** — dry-run, init, contract validate, health, upgrade
- **[Start work on an issue](#hero-workflow-2-start-work-on-an-issue)** — linear prepare, preflight, policy gates
- **[Submit a change for review](#hero-workflow-3-submit-a-change-for-review)** — docs-gate, review-gate, linear sync

For CI migration, pilot evaluation, or workflow contracts, see the [advanced workflows](#advanced-migrate-ci-with-rollback-and-proof) below.

## Lite Mode (Solo And Small Team)

Use lite mode when you want a low-friction setup first and governance depth later.

```bash
# 1. Minimal scaffold for solo/small-team adoption
harness init --minimal --track

# 2. Minimal policy contract (alias of minimal)
harness contract init --preset lite --force

# 3. Validate and inspect quickly
harness contract validate
harness check --json
```

Lite mode intentionally omits heavier surfaces such as docs-drift policy, diff
budget policy, evidence policy defaults, and full governance policy sections.
It keeps the contract focused on gate dispatch essentials.

Upgrade path from lite to standard:

```bash
harness contract init --preset standard --force
harness contract validate
```

That upgrade preserves your lightweight adoption start while adding the
recommended default policy layers for team-scale operation.

## North Star

Coding Harness is not trying to maximize governance surface area. Its canonical
north star is the contract below; every README summary, roadmap update,
decision question, and governed PR-body decision should derive from these same
terms.

| Contract field        | Canonical meaning                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mission               | Let a solo developer with limited cognitive bandwidth orchestrate agentic software work to professional standards through compact orientation, executable guardrails, durable memory, and evidence-based handoff. |
| Mnemonic              | Thin surface. Strong guardrails. Durable memory. Professional output.                                                                                                                                             |
| Primary metric        | Reduce `PR lead time` from open to merge.                                                                                                                                                                         |
| Primary bottleneck    | Shrink the review and rework loop.                                                                                                                                                                                |
| Autonomy boundary     | Automate low and medium-risk work only when evidence is deterministic and rollback is clear; keep high-risk changes human-mediated.                                                                               |
| Safety floor          | Preserve evidence quality, current-head SHA discipline, bounded remediation, rollback paths, and independent review.                                                                                              |
| Durable learning rule | Turn repeated failures into guardrails, tests, prompts, policy checks, or explicit exceptions instead of repeated review comments or chat reminders.                                                              |
| Product bar           | Zero customer integration ceremony: dropped-in agents diagnose, bootstrap, validate, and explain blockers themselves instead of requiring the customer to wire the harness by hand.                               |
| Leverage model        | Encode scarce expert knowledge into agents that deliver point-to-point outcomes just in time, rather than making users adapt generic dashboards, docs, or workflows.                                              |
| Workflow proof        | High-level skills prove reliability through explicit win conditions, retained trace evidence, self-reflection, and iterative refinement, not instruction prose alone.                                             |
| Failure signal        | If Jamie gives the same steering twice, or a user must manually translate expert judgment into repeated one-off instructions, the harness has failed to encode the principle.                                     |

That means a feature, document, policy, or artifact is north-star aligned only
when it reduces PR lead time directly, lowers review or rework cost, removes
manual glue work, improves agent reliability, or strengthens the safety floor.
Adding process without one of those outcomes is not progress.

The canonical statement of that contract lives in
[docs/roadmap/north-star.md](./docs/roadmap/north-star.md).
The weekly status surface is
[docs/roadmap/agent-first-status.md](./docs/roadmap/agent-first-status.md),
and its review cadence is mirrored in `harness.contract.json` so
`drift-gate --mode health` can fail closed on stale north-star evidence.
The roadmap and status metadata were last synchronized on 2026-05-18 as part
of the Coding Harness evidence alignment refresh.
The `preflight-gate` product-surface cadence evidence was refreshed on
2026-05-21 after source and test review; future `harness.contract.json`
cadence refreshes are contract-policy changes and must keep the docs-gate
required surfaces synchronized.

North-star command outputs also use canonical artifact contracts so agents can
carry evidence between tools without guessing path or schema names. Current
stable artifact paths include
`.harness/guardrails/north-star/drift-findings.json` for `drift-gate`,
`.harness/guardrails/north-star/surface-classification-snapshot.json` for
`doctor`, and `.harness/guardrails/north-star/alignment-decision.json` for
review-gate alignment decisions.

## Why Teams Use It

Teams usually adopt Coding Harness for one of four jobs:

- **Bootstrap a repo once, then keep it aligned.** `harness init` can scaffold
  `harness.contract.json`, `WORKFLOW.md`, PR templates, CodeRabbit defaults,
  repo-local verification scripts, and rollback metadata instead of leaving
  each repo to invent its own setup. Generated downstream PR, workflow, and
  worktree surfaces use `jscraik/feature/*` for agent-created branches.
  The customer-facing bar is that an agent dropped into the workspace can run
  the diagnosis and dry-run setup path itself, then report named blockers when
  credentials, permissions, or local tools are missing.
- **Put policy in code instead of chat reminders.** Commands like
  `docs-gate`, `plan-gate`, `review-gate`, `linear-gate`, `check-authz`, and
  `local-memory-preflight` make governance expectations runnable.
- **Change CI and review workflow without losing trust.** `ci-migrate`,
  `branch-protect`, `verify-coderabbit`, and parity-proof tooling exist for
  controlled migration rather than "edit YAML and hope".
- **Expand autonomy gradually.** Pilot evaluation, rollback, workflow-contract
  validation, remediation, and evidence verification give teams a way to ask
  "should this be automated further?" with artifacts instead of instinct.

## What It Is Best At Today

The code, tests, and recent history point to a few especially strong surfaces.

- **Governed bootstrap and upgrade.** `init`, `upgrade`, and `eject` are
  mature command families. They support dry runs, tracked updates, rollback,
  interactive review, minimal mode, and repo-specific scaffolding decisions.
- **CI migration with proof and rollback.** `ci-migrate` is one of the deepest
  tested surfaces in the repo. It supports prepare, verify, commit, abort,
  branch-protection sync, proof packs, and merge-queue cutover evidence.
- **Review and governance gates.** `review-gate`, `docs-gate`,
  `ci-ownership-gate`, `verify-coderabbit`, `linear-gate`, `check-authz`, and
  `doctor` are current, active surfaces. This repo now assumes CodeRabbit, not
  Greptile, as the primary AI review path.
- **Pilot control-plane evaluation.** `pilot-evaluate`, `pilot-rollback`,
  remediation, gap-case management, and workflow-contract scorecards are real
  product surfaces with substantial test coverage.
- **Repo-local verification and preflight.** Harness scaffolds
  `scripts/codex-preflight.sh`, `scripts/verify-work.sh`, and
  `scripts/validate-codestyle.sh` so a downstream repo has a local verification
  contract instead of a loosely documented checklist.
- **Context, search, and multi-repo audit.** `search`, `context`,

  `source-outline`, diagram/ERD context packs, `index-context`,
  `context-health`, `tooling-audit`, and `org-audit` make the project broader
  than "just repo init". It also helps teams inspect governed context and drift
  across repositories.

If you want the highest-confidence paths today, start with `init`, `upgrade`,
`ci-migrate`, `docs-gate` or `review-gate`, `verify-coderabbit`,
`local-memory-preflight`, and `pilot-evaluate`.

## Security Posture Baseline

This repository tracks baseline security posture with OpenSSF OSPS + Scorecard
artifacts that are versioned alongside code.

- Baseline status and control matrix:
  `docs/security/2026-04-09-openssf-osps-baseline-status.md`
- Scorecard floor policy:
  `security/openssf-scorecard-policy.json`
- Regression evaluator:
  `scripts/check-scorecard-regressions.mjs`
- Continuous CI security gate:
  `.circleci/config.yml` (`security-scan` workflow with Semgrep and Snyk)
- External Semgrep Cloud gate:
  GitHub required check `semgrep-cloud-platform/scan`

Security scanning now runs in CircleCI through the `security-scan` workflow,
which runs the repo-owned Semgrep scan and a Snyk dependency scan. GitHub
Actions in this repository is reserved for release publishing only
(`.github/workflows/release-private-npm.yml`).
Semgrep Cloud is enforced separately as an external GitHub App required check.
The machine-readable `harness.contract.json` `ciOwnership` block keeps that split
explicit: CircleCI owns the primary PR gate, CodeRabbit remains the independent
review check, Semgrep Cloud remains independent external security evidence, and
any GitHub Actions fallback workflow must stay manual/emergency-only unless the
contract is intentionally migrated.

## Installation

Published package usage requires registry access to `@brainwav/coding-harness`.

```bash
pnpm add -g @brainwav/coding-harness
harness --help
```

If your team uses `mise`, this also works:

```bash
mise install -g npm:@brainwav/coding-harness
```

The package is best suited to repositories that want a governed local CLI
surface. After installation, the usual next step is not "read every command",
it is to run `harness init --dry-run` in the target repository and inspect the
scaffold plan.

## Repo-local Wrapper

`harness init` now scaffolds `scripts/harness-cli.sh` for downstream repos that
want a repo-local wrapper around the published CLI package.

Use it like this:

```bash
bash scripts/harness-cli.sh verify-coderabbit
```

For script-driven gating in downstream repos, use:

```bash
bash scripts/run-harness-gate.sh <gate-command> [args...]
```

When run from a harness source checkout (`@brainwav/coding-harness`), use
`scripts/run-harness-gate.sh` for fail-closed `pnpm`/`tsx` checks so the repo
does not silently fall back to a different harness binary.

If the wrapper cannot resolve local `@brainwav/coding-harness`, treat that as a
repo bootstrap/install problem, not a harness command failure. In a pnpm repo,
repair it with:

```bash
pnpm install
pnpm add -D @brainwav/coding-harness
pnpm exec harness <command>
```

This matters because downstream repos can standardize on one local command
surface even if contributors use different shells or global setups.

## Repo-local Verification

Use `bash scripts/verify-work.sh` as the canonical repo-local verification
entrypoint. It runs repo-local preflight in `required` Local Memory mode and
then executes the full verification bundle.
Direct `scripts/codex-preflight.sh` usage follows the same default: use
`bash scripts/codex-preflight.sh --stack auto --mode required` for the canonical
path, and treat legacy positional invocations as compatibility-only aliases that
default to required Local Memory mode unless `off` or `optional` is supplied
explicitly.
The verification and worktree bootstrap paths also run
`scripts/check-git-common-config.sh`, which blocks shared non-bare `.git/config`
from pinning `core.worktree`; worktree-local values must live in per-worktree
config so temp worktrees cannot poison the main checkout. If the guard fails,
run `bash scripts/check-git-common-config.sh --repair` from the repository root
so the resolved common Git config is repaired directly.
Fresh worktree bootstrap uses `scripts/prepare-worktree.sh` as the canonical
branch-attach path: detached Codex app worktrees stay disposable until this
repo needs branch-aware validation, then the script creates a deterministic
readiness branch after checking both local and reachable `origin` branch names.
`scripts/new-task.sh` fetches the default remote base before creating task
worktrees and requires explicit `--allow-stale-base` before accepting cached
base risk.

When executable behavior changes, do not stop at broad validation alone. Run
the smallest real code path that exercises the exact production code touched:
prefer the production function, class, CLI command, shell script, validator,
or route directly. If no existing test covers the path, use a temporary local
reproduction harness under `codex-scripts/` and keep that directory gitignored.
If the exact path cannot run because it needs unavailable credentials, external
services, unsafe side effects, or generated runtime state, say so explicitly
and run the nearest meaningful validation instead.

For a quicker local loop, use:

```bash
bash scripts/verify-work.sh --fast
```

The `harness verify-work` CLI wrapper exposes the same verification lane for
automation and supports explicit resume checkpoints:

```bash
harness verify-work --fast --resume-from validate-codestyle-fast
```

Resume gate IDs are validated against the typed validation gate mirror in
`src/lib/validation/gate-specs.ts` before the shell wrapper runs. The shell
script remains the authority for execution order; the typed mirror exists so
CLI dispatch, tests, and automation can fail closed on unknown checkpoint names.

The fast lane now includes changed-file enforcement for public API docstrings,
function/file size, self-affirming test assertions, high-trust behavior-test
assertions, git child-process environment sanitation, and related tests through
`pnpm run quality:docstrings`, `pnpm run quality:size`,
`pnpm run quality:self-affirming`, `pnpm run quality:behavior-tests`,
`pnpm run quality:git-env-sanitizer`, `pnpm run harness:audit-tracking`, and
`pnpm run test:related`. Related tests must find and run a real Vitest-related
path; the gate no longer passes silently when no test covers changed production
source.

For downstream repos, this is one of the most practical parts of harness. It
turns "what do I need to run before handoff?" into a single local command.

## Common Workflows

### Hero Workflow 1: Bootstrap a repository

Start with a preview, then write tracked changes once the diff looks right.

```bash
harness init --dry-run
harness init --track
harness contract validate
harness health --json
```

This is the best path when you want a governed starting point quickly. In the
common case, `init --track` gives you the contract, workflow scaffolding,
review policy surfaces, repo-local verification scripts, and enough metadata to
upgrade or roll back cleanly later.

Generated readiness scripts preserve caller-provided `PATH` precedence before
validation, then add existing user-writable and platform-standard tool
directories only as fallbacks. That lets non-login agent shells find
already-installed tools such as `mise`, Homebrew binaries, `/usr/sbin`, and
`/sbin` without shadowing repo-local test shims, silently installing anything,
or mutating global state.

Use these follow-ups when the repo already has harness material:

```bash
harness init --check-updates
harness upgrade --dry-run
harness upgrade
```

If a legacy `.harness/restore-manifest.json` is missing `ciProvider`, harness
will repair it automatically when the active provider can be inferred from
`harness.contract.json`, an unambiguous CI layout on disk, or the requested or
default init/upgrade provider.

If tracked baseline files are missing and you need to re-scaffold them:

```bash
harness init --update
harness init --interactive
```

To specify or override the detected project type during init:

```bash
harness init --project-type web       # explicit: cli | desktop | library | web
harness init --project-type cli --json  # machine-readable structured output
```

Use the contract surface when you want confidence that the repo policy file is
still valid or you need a schema for editor and automation tooling:

```bash
harness contract validate
harness contract validate --json
harness contract schema > harness.contract.schema.json
```

### Hero Workflow 2: Start work on an issue

Prepare branch context from a Linear issue, run preflight checks, then gate
each file as you work.

```bash
harness linear prepare --issue <KEY>         # pre-fill branch, PR title, closing line
harness preflight-gate --contract harness.contract.json --files <comma-separated-changed-files> --admission-file artifacts/admission/declaration.json
harness policy-gate --contract harness.contract.json --files <comma-separated-changed-files>
harness blast-radius --files <comma-separated-changed-files> --json   # see which gates apply
```

The `linear prepare` command outputs a branch name, PR title, and body fragment
so you never need to construct these by hand or from memory.

For contracts with a `northStar` block (`harness.contract.json` v1.6+), `preflight-gate` requires an admission declaration via `--admission-file <path>`. Use `--skip admission-declaration` only when bypass is explicitly authorized for the run.

`preflight-gate` exit codes are command-specific: `0` for pass, `1` for policy
violations, `3` for contract load or existence failures, and `10` for
unexpected system errors. Automation workflows that need richer categorization should
also consume the JSON payload.

### Hero Workflow 3: Submit a change for review

Gate the change locally before pushing, then confirm review wiring is correct.

```bash
harness docs-gate --mode advisory --json
harness plan-gate --require-plan-id --require-traceability --json
harness review-gate --token "$GITHUB_TOKEN" --owner <owner> --repo <repo> --pr <number> --sha <head-sha>
harness linear sync --findings findings.json --team <TEAM>
```

If `harness.contract.json` declares governed north-star surfaces and your diff
touches one of them, `review-gate` also requires four PR-body decisions:
`lead_time_path`, `manual_glue`, `agent_reliability`, and `safety_floor`. Each
line must answer `yes` and include an `Evidence:` reference. Repos that do not
declare `northStar` governance or do not touch governed surfaces keep the
legacy SHA and review-check behavior.
If `review-gate` returns `review_evidence_incomplete` or
`review_evidence_contradiction`, update the PR body with the required decision
lines and evidence, or roll back high-risk changes until evidence is coherent;
see [review-gate north-star evidence](./docs/cli-reference.md#review-gate-north-star-evidence)
for complete recovery steps.

For repos using CodeRabbit, pair the review-gate with:

```bash
harness verify-coderabbit --json
```

That gives you a concrete local answer for "is the repo-side review wiring
correct?" before you debug GitHub-side behavior.

For AI-assisted PRs, `pr-template-gate` also protects the meta-behavior layer:
PR bodies must name session or traceability evidence, record a pattern scope
inventory when line-level feedback implies a broader design rule, name
Meta-behavior proof and learning/reinforcement when steering feedback is
admitted, and record Repeated-error research when the same error happens twice.
This keeps high-signal review and user steering in the repo operating system
instead of leaving it in a chat transcript.

PR bodies must separate issue traceability from issue closure. `Linear
reference` records `Refs JSC-N`, `Fixes JSC-N`, or `Closes JSC-N`;
`Linked issue relationship` must classify the PR as implementation closure,
preparatory/enabling work, standalone/untracked work, or `n.a.` with reason.
Preparatory PRs that reference a parent issue must state that completed
acceptance IDs are `none` or explicitly say they do not close that acceptance
scope.

PR bodies must also classify `Documentation impact`: list the required root
docs, governed docs, and existing deep-module README files updated by the slice,
or mark each unaffected class `n.a.` with a concrete reason. `docs-gate`
enforces configured governed surfaces and existing deep-module README parity;
use docs-expert or independent reviewer evidence for high-impact docs changes.

```bash
harness pr-template-gate --json
```

A pass means the PR body satisfies the required session/traceability,
meta-behavior, pattern-scope, and repeated-error evidence fields. A fail means
the PR owner must correct the missing or malformed fields before handoff.

### Learning-loop closeout

When a repository has imported CodeRabbit learning evidence, use the learning
loop before PR handoff so repeated review feedback becomes guardrail data
instead of another comment thread.

In this source checkout, run the loop through `scripts/run-harness-gate.sh` so
the command surface comes from `src/cli.ts` rather than a globally installed
`harness` shim:

```bash
bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files <changed-files> --json
bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json
bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json
```

Downstream repos with the published package installed can call the same command
families through `harness`:

```bash
harness learnings gate --source .harness/learnings/coderabbit.local.json --files <changed-files> --json
harness review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json
harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json
```

The `--files` value accepts comma-separated paths or multiple following path
tokens.

If a repeated high-usage learning appears, promote it into a concrete
validator, gate, scaffold regression, generated-artifact rule, review-context
fact, or explicit exception. Use Project Brain for the durable distilled rule or
decision, and keep the imported learning artifact as the machine-readable
evidence source. If no local learning artifact exists yet, record that as `n.a.`
in the PR evidence rather than pretending the loop ran.

### Advanced: Migrate CI with rollback and proof

```bash
harness ci-migrate prepare --provider circleci --dry-run
harness ci-migrate prepare --provider circleci --apply
harness ci-migrate verify --snapshot <snapshot-id>
harness ci-migrate commit --snapshot <snapshot-id>
```

Use `abort` or `--rollback` if parity or external control-plane checks fail.
For cutover follow-through, the same command family also supports:

```bash
harness ci-migrate sync-branch-protection
harness ci-migrate promote-mode
```

### Advanced: Validate a Symphony workflow contract

Coding Harness can scaffold a `WORKFLOW.md`, generate compact workflow specs,
and validate readiness for Symphony-style execution.

```bash
harness workflow:generate --source docs/specs/my-flow.md --output WORKFLOW.md
harness symphony-check
pnpm workflow:validate
```

To keep Linear metadata and findings aligned from the same CLI surface:

```bash
harness linear prepare --issue JSC-123
harness linear sync --findings findings.json --team JSC
```

This is one of the more understated parts of the project today: it is not only
scaffolding repo files, it also includes machinery for defining, checking, and
operating workflow contracts.

### Advanced: Evaluate a pilot before expanding autonomy

```bash
harness pilot-evaluate --artifacts artifacts/pilot --lane health --output artifacts/pilot/result.json
harness pilot-rollback --mode manual
```

This part of the CLI is designed for artifact-backed rollout decisions, not
just dashboard reporting.

## Command Index

The tables below keep README parity with the CLI while staying short. For full
expert command discovery, use `harness --help --all-commands`. Default
`harness --help` is intentionally focused on the agent cockpit entrypoint.

For agent planning and command safety routing, prefer the machine-readable
capability catalog:

```bash
harness commands --json
```

`pattern-scope` and `artifact-routine` are agent-facing advanced commands in
the capability catalog: `pattern-scope` belongs in review lanes that need
sibling-pattern evidence, while `artifact-routine` belongs in verification
lanes before route-driving `.harness` artifacts guide implementation.

Use the catalog directly to choose a safe command before execution:

```bash
# Human workflow: inspect mutative commands and required flags
harness commands --json | jq '
  .commands[]
  | select(.mutability != "read")
  | {name, category, mutability, requiredFlags}'
```

```bash
# Agent workflow: route to read-only alternatives first when available
harness commands --json | jq '
  .commands[]
  | {name, mutability, safeFirstAlternatives}
  | select((.safeFirstAlternatives | length) > 0)'
```

### Bootstrap And Governance

| Command             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands`          | Emit the versioned machine-readable command capability catalog (`--json`)                                                                                                                                                                                                                                                                                                                                                                           |
| `agent-readiness`   | Audit agent-readable instructions, artifacts, capabilities, approval gates, traceability, and context freshness (`--json`, optional path, optional `--repo-root`)                                                                                                                                                                                                                                                                                   |
| `init`              | Scaffold or update harness-managed repo surfaces (`--project-type`, `--json`, `--dry-run`, `--force`, `--track`, `--update`, `--migrate`, `--minimal`, `--issue-tracker`)                                                                                                                                                                                                                                                                           |
| `eject`             | Safely remove harness-managed files and templates, including legacy Greptile artifacts, while preserving custom non-Greptile CI workflows (`--dry-run`, `--force`)                                                                                                                                                                                                                                                                                  |
| `check`             | Zero-config repo health snapshot — works before full setup                                                                                                                                                                                                                                                                                                                                                                                          |
| `next`              | Agent-native cockpit entrypoint that recommends the next safe existing command (`--json`, optional `--files`, optional `--phase-exit`, optional `--runtime-card`, optional `--mode local\|pr\|ci`)                                                                                                                                                                                                                                                  |
| `runtime-card`      | Build a `runtime-card/v1` artifact from git, harness evidence, normalized evidence bundles, and optional live provider state (`--json`, optional `--live`, optional `--repo`, optional `--issue`, optional `--phase-exit`, optional `--evidence`, optional `--out`, optional `--evidence-out`)                                                                                                                                                      |
| `session-context`   | Emit a read-only `session-context/v1` orientation packet for repo, issue, branch, artifact, runtime-card, review-evidence, stale-state, and traversal hints (`--json`, optional `--repo-root`)                                                                                                                                                                                                                                                      |
| `decision-request`  | Emit a read-only `decision-request/v1` governance packet for human or operator escalation, including intent, authority, options, evidence refs, expiry/freshness, escalation metadata, and stale-state classification (`--json`, `--intent`, `--default-option`, repeated `--option id=label`, optional repeated `--tradeoff id=text`)                                                                                                              |
| `pr-closeout`       | Build a read-only `pr-closeout/v1` report from normalized evidence or live GitHub CLI state, including claim/evidence closeout truth, PR metadata, check state, repo-scoped Coding Harness closeout gates, CLI availability, dirty worktree state, and AI session/traceability completeness (`--json`, `--input <path>` or `--pr <number>`, optional `--repo`, optional `--gates`, compatibility `--phase-exit`, optional shell-style `--env-file`) |
| `fleet-plan`        | Build an agent-native remediation plan from a harness upgrade matrix artifact (`--from`, `--json`)                                                                                                                                                                                                                                                                                                                                                  |
| `audit`             | Audit for configuration drift, parity gaps, and governance posture                                                                                                                                                                                                                                                                                                                                                                                  |
| `doctor`            | Check all gate prerequisites (tools, files, config, CI)                                                                                                                                                                                                                                                                                                                                                                                             |
| `health`            | Unified gate status scorecard across all gates                                                                                                                                                                                                                                                                                                                                                                                                      |
| `brain`             | Query and update Project Brain context artifacts                                                                                                                                                                                                                                                                                                                                                                                                    |
| `contract`          | Validate `harness.contract.json` or print the JSON Schema (`init`, `validate`, `schema`)                                                                                                                                                                                                                                                                                                                                                            |
| `upgrade`           | Safely upgrade harness in an existing repo (`--dry-run`, `--json` preview supported)                                                                                                                                                                                                                                                                                                                                                                |
| `ci-migrate`        | Stage, verify, commit, abort, sync branch protection, or promote CI mode                                                                                                                                                                                                                                                                                                                                                                            |
| `branch-protect`    | Configure GitHub branch protection rulesets                                                                                                                                                                                                                                                                                                                                                                                                         |
| `verify-work`       | Run canonical repo-local verification (fresh or resume mode, with `--resume-from` checked against typed validation gate specs)                                                                                                                                                                                                                                                                                                                      |
| `verify-coderabbit` | Verify CodeRabbit configuration and remote wiring                                                                                                                                                                                                                                                                                                                                                                                                   |
| `preset`            | List and inspect bundled presets                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `symphony-check`    | Validate `WORKFLOW.md`, Linear config, and transition-table readiness                                                                                                                                                                                                                                                                                                                                                                               |

### Review And Policy Gates

| Command                  | Purpose                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `policy-gate`            | Validate policy expectations from changed files                                                                                            |
| `preflight-gate`         | Run fast policy checks before expensive work                                                                                               |
| `review-gate`            | Validate SHA-linked review readiness (review check + review-policy required checks)                                                        |
| `docs-gate`              | Enforce documentation parity for governed changes                                                                                          |
| `plan-gate`              | Validate plan IDs, traceability, and acceptance evidence                                                                                   |
| `brainstorm-gate`        | Validate brainstorm artifacts                                                                                                              |
| `prompt-gate`            | Validate prompt template section requirements while keeping CLI parsing and validation behind the prompt-gate module boundary              |
| `gap-case`               | Manage production gap cases while keeping lifecycle parsing, validation, persistence, and presentation behind the gap-case module boundary |
| `pr-template-gate`       | Validate PR template completion and placeholder replacement                                                                                |
| `rule-lifecycle-gate`    | Validate governance rules have owner, evidence, enforcement, freshness, and retirement metadata                                            |
| `license-gate`           | Validate open-source license expectations                                                                                                  |
| `check-authz`            | Validate authorization policy for mutative operations                                                                                      |
| `check-environment`      | Validate pilot environment governance checks                                                                                               |
| `local-memory-preflight` | Run the structured Local Memory preflight smoke checks                                                                                     |
| `artifact-gate`          | Check generated artifact changes against the artifact provenance registry                                                                  |
| `artifact-routine`       | Validate route-driving `.harness` artifacts before implementation                                                                          |
| `runtime-budget`         | Build safe, read-only `command-runtime-budget/v1` evidence from measured command durations and budgets                                     |
| `ci-ownership-gate`      | Validate CircleCI primary ownership plus CodeRabbit and Semgrep required checks                                                            |
| `blast-radius`           | Determine required checks from changed files                                                                                               |
| `risk-tier`              | Classify changed files by risk tier                                                                                                        |
| `pattern-scope`          | Build a pattern-scope artifact from steering feedback and changed files                                                                    |
| `diff-budget`            | Enforce diff budget constraints                                                                                                            |
| `observability-gate`     | Check metrics cardinality limits                                                                                                           |
| `silent-error`           | Detect silent error-handling anti-patterns                                                                                                 |
| `memory-gate`            | Validate local-memory workflow compliance                                                                                                  |

### Linear And Workflow Operations

| Command             | Purpose                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `linear`            | Claim, hand off, close, prepare, or sync Linear work from one command family                                                                                                                                                   |
| `linear-gate`       | Enforce Linear-first intake, branch naming, and PR linkage                                                                                                                                                                     |
| `pr-closeout`       | Classify pull-request closeout state before handoff or merge, including required claim/evidence status, required metadata, checks, Coding Harness closeout gates, review state, tool evidence, and AI session/trace references |
| `workflow:generate` | Generate compact workflow specs from annotated markdown                                                                                                                                                                        |

The `linear` command is intentionally one public command family. Internally,
action parsing stays in the registry runner while action-specific option
builders and command delegation live behind a separate Linear action adapter
seam, so agents can change one workflow action without widening the CLI
surface.

The `prompt-gate` command follows the same deep-module boundary pattern. The
public command facade stays a compatibility export surface, the registry spec
delegates raw arguments to the prompt-gate CLI adapter, and prompt-template
section validation stays in `src/lib/prompt-gate/` so future prompt changes do
not widen the registry or command facade.

The `gap-case` command follows the same command-registry split pattern. The
public command facade and legacy internal helper facade stay compatibility
export surfaces, the registry spec delegates raw arguments to the gap-case CLI
adapter, and lifecycle validation, persistence, open/resolve behavior, and
result presentation stay in `src/lib/gap-case/` so future production-gap
changes do not widen the registry or command facade.

The `simulate` command also follows the command-registry split pattern. The
public command facade and legacy analysis facades stay compatibility export
surfaces, the registry spec delegates raw arguments to the simulate CLI
adapter, and CLI parsing, simulation orchestration, analysis, recommendations,
and result presentation stay in `src/lib/simulate/` so future counterfactual
simulation changes do not widen the registry or command facade.

The `ci-migrate` command follows the same registry-boundary rule. The public
command facade remains the migration orchestration surface, the registry spec
delegates raw arguments to the ci-migrate CLI adapter, and option projection
plus delegated helper routing stay in `src/lib/ci-migrate/` so future CI
migration actions do not widen the registry or command facade.

The `init` command now follows this deep-module boundary rule as well. The
public command facade stays the init orchestration surface, the registry spec
delegates raw arguments through `init-command-spec.ts`, and raw flag
projection plus issue-tracker validation stay in `src/lib/init/cli-args.ts`
so future bootstrap option changes do not widen the registry core.

The `upgrade` command uses the same split for downstream update work. The
public command facade stays a compatibility export surface, the registry spec
delegates through `upgrade-command-spec.ts`, raw flag projection stays in
`src/lib/upgrade/cli-args.ts`, shared option contracts stay in
`src/lib/upgrade/types.ts`, contract/template helpers stay in
`src/lib/upgrade/`, and upgrade orchestration stays in
`src/lib/upgrade/runner.ts` so future upgrade behavior does not widen the
registry core.

The `brain` command follows the same command-registry split for Project Brain
work. The public command facades stay compatibility export surfaces, the
registry spec delegates through `brain-command-spec.ts`, raw flag projection
stays in `src/lib/project-brain/cli-args.ts`, the dispatcher and public export
surface stay in `src/lib/project-brain/cli.ts`, and subcommand behavior stays
in `src/lib/project-brain/*-cli.ts` so future Project Brain behavior does not
widen the registry core.

The `decision-request` command follows the runtime-cockpit deep-module rule.
The public command facade stays a compatibility export surface, the registry
spec delegates through `decision-request-command-spec.ts`, and packet parsing,
validation, stale-state normalization, and escalation metadata live in
`src/lib/decision-request/`. `decision-request/v1` is governance-request
evidence only; it is not closeout or merge-readiness proof.

Action-review receipts follow the same runtime-cockpit discipline without
becoming a public command surface. `action-review-receipt/v1` lives in
`src/lib/action-review/` and records reviewer independence, canonical actor
identity separation, high-risk action envelopes, allow/block/mismatch
semantics, current evidence refs, and stable validation errors. These receipts
are orientation, governance, and audit artifacts only; they do not authorize
commands, satisfy delivery-truth claims, prove merge readiness, or replace
policy-gate, PR closeout, or human approval.

Replay packets are the replay contract side of the runtime cockpit, not another
closeout proof surface. `replay-packet/v1` lives in `src/lib/replay/` and
records pointer-only replay seeds, content-bound source refs, hook execution
identity, normalized event summaries, stale-state classification, and
redaction status. The standalone validator rejects unsafe paths, SHA-256 drift,
missing hook provenance, stale orientation packets, and raw prompts,
transcripts, command output, screenshots, images, or secret-like fields. Replay
packets can support orientation and audit trails; they do not satisfy
delivery-truth, review-state, external-state, root-hygiene, Judge/PM, or
merge-readiness claims.

### Pilot, Remediation, And Automation

| Command          | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `pilot-evaluate` | Evaluate pilot metrics and determine promotion readiness                  |
| `pilot-rollback` | Move pilot mode between autonomous and manual states                      |
| `simulate`       | Run counterfactual policy simulation through the simulate module boundary |
| `automation-run` | Execute idempotent automation playbooks                                   |
| `gap-case`       | Manage production gap cases through the gap-case module boundary          |
| `remediate`      | Plan and run deterministic remediation for findings                       |
| `replay`         | Re-run policy checks from saved snapshots                                 |

### Drift, Search, And Evidence

| Command               | Purpose                                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drift-gate`          | Evaluate consistency drift across governance surfaces                                                                                                                                                                             |
| `org-audit`           | Scan multi-repo governance and drift posture                                                                                                                                                                                      |
| `tooling-audit`       | Audit managed repo tooling baselines                                                                                                                                                                                              |
| `feedback-loop-audit` | Validate the local feedback-loop ledger so audit findings, cross-loop gaps, and recommended next steps have closure state, owner, action, delay, failure-class, and evidence refs                                                 |
| `gardener`            | Detect stale docs and broken links                                                                                                                                                                                                |
| `context-health`      | Generate advisory context-integrity scorecards                                                                                                                                                                                    |
| `learnings`           | Import local operational review evidence, run exact-file learning gates, and generate high-usage promotion candidates via `learnings import`, `learnings gate`, and `learnings promote`                                           |
| `review-context`      | Generate PR review context from changed files and imported operational learnings, including applicable learned constraints and validation-plan entries                                                                            |
| `validation-plan`     | Recommend repo-canonical validation commands from changed files and imported validation-contract learnings, with network-required commands separated                                                                              |
| `north-star-feedback` | Measure learning hits, gate blocks/warnings, promotion candidates, promoted learnings, high-usage unenforced learnings, review-thread count, and validation reruns from imported learning evidence and optional run artifacts     |
| `artifact-gate`       | Check changed generated artifacts against `.harness/artifact-provenance.json` so template/source edits accompany runtime mirrors                                                                                                  |
| `artifact-routine`    | Validate `.harness/active-artifacts.md` route-driving specs and plans for owner, freshness, reference integrity, runtime-output boundaries, and stale artifact classification before implementation                               |
| `ci-ownership-gate`   | Validate that CircleCI owns the primary PR workflow while CodeRabbit and Semgrep Cloud remain independent required checks                                                                                                         |
| `search`              | Run hybrid lexical and semantic search; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used       |
| `context`             | Search indexed plans, specs, and brainstorms; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used |

| `source-outline` | Inspect TypeScript-family signatures and comments before opening implementations, with optional single-symbol implementation unwrapping via `--symbol` |

| `index-context` | Build the local semantic-search index |
| `evidence-verify` | Validate screenshot and evidence artifacts |
| `ui:fast` | Run a Storybook-first local UI loop |
| `ui:verify` | Run Playwright smoke verification with evidence capture |
| `ui:explore` | Run agent-browser exploratory testing |

For agent source inspection, use `harness source-outline <path>` before opening
raw TypeScript-family files. If implementation detail is needed, unwrap one
symbol at a time with `--symbol <name>` so context growth stays deliberate.

After instruction discovery, use `AI/context/diagram-context.md` as the compact
architecture map; it combines Mermaid architecture, dependency, database, and
ERD diagrams, with `.diagram/manifest.json` available when a narrower diagram
file is enough.
Flow Ops closure-evidence changes that alter source classification or validation
routing are architecture-context changes: refresh and commit
`AI/context/diagram-context.md` with the docs-gate-required governance surfaces.
Generated Codex environment action changes are part of the same readiness story:
when setup, validation routing, branch attachment, or generated test/eval
actions change, update the operator docs that docs-gate reports before pushing
the PR.
If a closure-evidence merge repair also changes generated environment setup or
init scaffolding tests, include the full docs-gate operator-facing documentation
(e.g., README, CONTRIBUTING.md, root agent guidance, security and governance
guides, tooling-policy/security surfaces, architecture bootstrap guide, and any
other operator-facing docs) in the same PR so docs-gate can verify the full
operator-facing contract before push.

## Requirements

- **Node.js:** `>= 24.0.0`
- **Package manager for this repo:** `pnpm@10.33.0`
- **GitHub auth:** required for commands that inspect or mutate remote GitHub
  state, including `branch-protect`, `review-gate`, and remote CodeRabbit checks
- **Linear auth:** required for `linear*` flows and for a clean
  `symphony-check` result
- **Local Memory:** required for repo-local `required` preflight mode and for
  the default `scripts/verify-work.sh` flow scaffolded into downstream repos
- **Ollama/local embeddings:** required for the semantic side of
  `search`, `context`, and `index-context`
- **Browser automation tooling:** required for `ui:verify` and `ui:explore`
  workflows
- **Ralph CLI:** required for environment readiness and CircleCI orb-pinning
  validation (`ralph --version`)
- **Context7 CLI:** required when current dependency documentation lookup is part
  of the agent workflow; managed through mise as `npm:ctx7` and validated by
  `scripts/check-environment.sh`
- **Codex environment actions:** `.codex/environments/environment.toml` must
  keep the required action/icon pairs checked by
  `scripts/check-environment.sh`, including `Context7` and `Release Finalize`

Coding Harness does **not** create secrets for you and does **not** bypass
branch protection or review policy. It also does **not** run your CI provider
or agent runtime for you. Its job is to scaffold, validate, and enforce the
control-plane layer around those systems.

## Local Development

If you are developing this repository itself:

```bash
mise trust            # activate pinned toolchain from .mise.toml
make setup            # installs deps + configures git hooks
pnpm build
node --import tsx src/cli.ts --help
pnpm check
```

Hook setup must go through `make hooks`, `make setup`, or
`node scripts/setup-git-hooks.js`. The wrapper patches generated `prek` shims
for `pre-commit`, `pre-push`, and `commit-msg` after resolving the repo root
with `git rev-parse --show-toplevel`, so `PREK_HOME` points at the active
worktree's `.cache/prek` cache instead of the shared git directory. The
same generated installer derives `.git/hooks` from the resolved worktree root,
and `scripts/check-environment.sh` validates that drift before push.
Environment-only pushes that change only `.codex/environments/environment.toml`
run `scripts/check-environment.sh` instead of the full pre-push governance
suite. Any other changed file keeps the full `make hooks-pre-push` lane.
The full lane passes the branch changed-file list into
`scripts/check-diagram-freshness.sh` so diagram refresh checks do not expand to
unrelated local worktree dirt during push.

When you change executable behavior in this repository, run the smallest real
path that exercises the touched production code before claiming it works. If
you need a throwaway reproduction harness, keep it under `codex-scripts/` so
it stays local-only.

When you change runtime behavior or artifact formats, run the deeper validation
path as well:

```bash
pnpm test:deep
```

## Packaged Codex Skill

The npm package ships a reusable Codex skill at
`.agents/skills/coding-harness/SKILL.md`.

It covers:

- harness install and update workflows
- capability boundaries and safe usage rules
- command discovery and validation expectations
- eval case validation and anti-overfit criteria

Run the packaged-skill validation lane after changing the bundle:

```bash
pnpm skill:validate
```

Repository-local skills follow the same convention:

```bash
.agents/skills/<skill-name>/SKILL.md
```

## Issue Reporting

This repository uses **Linear-first** intake. Create or update work in the
[coding-harness project](https://linear.app/jscraik/project/coding-harness-bb735dbbda79).

## Action Review Governance

This repository uses `action-review-receipt/v1` as a narrow guardian-style receipt contract for high-risk actions:

- **High-risk actions**: merge, release, destructive cleanup, and external tracker mutation envelopes require current evidence refs and head SHA
- **Reviewer independence**: reviewer must not be the same as the requester/producer
- **Canonical actor identity separation**: reviewer and requester canonical identity refs must differ
- **Decision semantics**: allow, block, mismatch, unknown, and `not_applicable`; `not_applicable` is forbidden for high-risk action kinds
- **Docs-gate requirement**: companion documentation surfaces (README, CONTRIBUTING, AGENTS, agent docs) must be updated in the same PR as any action-review governance change
- **Diagrams**: see `AI/context/diagram-context.md` for required architecture diagrams

## Trust Artifacts

Reference outputs for the main trust surfaces are in
[docs/examples/trust-artifacts/](./docs/examples/trust-artifacts/). These
examples let you verify what the harness produces without running the full system.
