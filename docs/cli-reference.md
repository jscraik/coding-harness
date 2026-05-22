---
last_validated: 2026-05-18
---

# CLI Reference

## Table of Contents

- [Purpose](#purpose)
- [Agent cockpit entrypoint](#agent-cockpit-entrypoint)
- [Machine-readable command catalog](#machine-readable-command-catalog)
- [Gate JSON Envelope](#gate-json-envelope)
- [Unknown command guardrails](#unknown-command-guardrails)
- [Bootstrap and governance](#bootstrap-and-governance)
- [Review and policy gates](#review-and-policy-gates)
- [review-gate north-star evidence](#review-gate-north-star-evidence)
- [Linear and workflow operations](#linear-and-workflow-operations)
- [Pilot, remediation, and automation](#pilot-remediation-and-automation)
- [Drift, search, and evidence](#drift-search-and-evidence)

## Purpose

This file contains the extended command catalog for Coding Harness.

For repo-facing onboarding and common workflows, start at [`README.md`](../README.md).

## Agent cockpit entrypoint

Use `harness next --json` as the read-only agent cockpit entrypoint. It
inspects changed files from git by default, emits a `HarnessDecision`, and
points `nextCommand` at an existing command instead of inventing a new workflow.

```bash
harness next --json
```

Optional overrides:

```bash
harness runtime-card --json --live \
  --out .harness/runtime/JSC-311.json \
  --evidence-out .harness/runtime/JSC-311-evidence.json
harness runtime-card --json --evidence .harness/runtime/session-evidence.json --out .harness/runtime/JSC-311.json
harness next --json --files src/cli.ts docs/cli-reference.md
harness next --json --phase-exit .harness/runs/phase-exit.json
harness next --json --runtime-card .harness/runtime/JSC-311.json
harness next --json --mode pr
```

`--phase-exit` accepts a local `HePhaseExit/v1` JSON artifact. When supplied,
`harness next` normalizes the phase-exit result into `meta.hePhaseExit` and
blocks the recommendation if the artifact reports `commitAllowed=false` or
`exitAllowed=false`.

`--runtime-card` accepts a local `runtime-card/v1` JSON artifact that summarizes
the current branch, PR, tracker, artifact, and phase-exit lifecycle state. When
supplied, `harness next` normalizes the card into `meta.runtimeCard` and blocks
the recommendation if the card reports blockers or a blocking lifecycle such as
`ci_blocked`, `blocked`, or `stale`.

Use `harness runtime-card --json` to produce the first local-only runtime card
from git state and `.harness/active-artifacts.md`. Add `--live` when the card
should also refresh bounded GitHub PR and Linear issue state. Live provider
failures are recorded as explicit runtime-card blockers instead of being treated
as validation evidence. Add `--phase-exit <path>` to collapse a local
`HePhaseExit/v1` artifact into the runtime card. Add `--evidence <path>` to
adapt a normalized `runtime-evidence-bundle/v1` artifact from a session,
collector, CI job, or manual adapter without exposing collector storage details
to `harness next`. Use `--out <path>` when the card should be persisted for a
later `harness next --runtime-card <path>` call. Use `--evidence-out <path>`
to persist a reusable `runtime-evidence-bundle/v1` that can be consumed by a
later `harness runtime-card --evidence <path>` run without reassembling PR,
Linear, source, and blocker state by hand.

First-slice routing is intentionally small:

| State                               | Recommended command                              |
| ----------------------------------- | ------------------------------------------------ |
| No changed files                    | `harness check --json`                           |
| Git state unavailable               | `harness doctor --json`                          |
| Changed files, `local` or `ci` mode | `harness validation-plan --files <files> --json` |
| Changed files, `pr` mode            | `harness review-context --files <files> --json`  |

## Machine-readable command catalog

For agent planning and command safety routing, prefer the machine-readable capability catalog:

```bash
harness commands --json
```

## Gate JSON Envelope

For gate commands in JSON mode, consume the canonical decision envelope fields:

- `status`
- `reason`
- `action_now`
- `action_later`
- `evidence_ref`

Compatibility strategy:

- Treat these fields as stable contract surfaces for automation.
- Treat `meta` as additive; consumers should ignore unknown keys.

## Unknown command guardrails

By default, unknown commands fail closed with suggestions. In `--json` mode, harness returns suggested commands with catalog-derived guardrail metadata (`mutability`, `retryability`, `requiredFlags`, and `safeFirstAlternatives`) so agents can choose a safe fallback path.

Fuzzy typo/case correction is opt-in via `--allow-fuzzy` (or `HARNESS_ALLOW_FUZZY_COMMANDS=1`).

## Bootstrap and governance

Taxonomy note: section headings in this document represent command families. They are not additional callable top-level commands.

| Command             | Purpose                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commands`          | Emit the versioned machine-readable command capability catalog (`--json`)                                                                                                                                                                                                                                                                                                                    |
| `init`              | Scaffold or update harness-managed repo surfaces (`--project-type`, `--json`, `--dry-run`, `--force`, `--track`, `--update`, `--migrate`, `--minimal`, `--issue-tracker`)                                                                                                                                                                                                                    |
| `eject`             | Safely remove harness-managed files and templates, including legacy Greptile artifacts, while preserving custom non-Greptile CI workflows (`--dry-run`, `--force`)                                                                                                                                                                                                                           |
| `check`             | Zero-config repo health snapshot — works before full setup                                                                                                                                                                                                                                                                                                                                   |
| `next`              | Read-only agent cockpit entrypoint that recommends the next safe existing command (`--json`, optional `--files`, optional `--phase-exit`, optional `--runtime-card`, optional `--mode local\|pr\|ci`)                                                                                                                                                                                        |
| `runtime-card`      | Build a `runtime-card/v1` artifact from git, harness evidence, normalized evidence bundles, and optional live provider state (`--json`, optional `--live`, optional `--repo`, optional `--issue`, optional `--phase-exit`, optional `--evidence`, optional `--out`, optional `--evidence-out`)                                                                                               |
| `pr-closeout`       | Build a read-only `pr-closeout/v1` report from normalized evidence or live GitHub CLI state, including PR metadata, check state, Coding Harness closeout gates, CLI availability, dirty worktree state, and AI session/traceability completeness (`--json`, `--input <path>` or `--pr <number>`, optional `--repo`, optional `--gates`, compatibility `--phase-exit`, optional `--env-file`) |
| `fleet-plan`        | Build an agent-native remediation plan from a harness upgrade matrix artifact (`--from`, `--json`)                                                                                                                                                                                                                                                                                           |
| `doctor`            | Check all gate prerequisites (tools, files, config, CI)                                                                                                                                                                                                                                                                                                                                      |
| `audit`             | Comprehensive governance state check with actionable recommendations                                                                                                                                                                                                                                                                                                                         |
| `brain`             | Project Brain knowledge, rules, and quality management (status, query, add, preflight, stale)                                                                                                                                                                                                                                                                                                |
| `health`            | Unified gate status scorecard across all gates                                                                                                                                                                                                                                                                                                                                               |
| `contract`          | Validate `harness.contract.json` or print the JSON Schema (`init`, `validate`, `schema`)                                                                                                                                                                                                                                                                                                     |
| `upgrade`           | Safely upgrade harness in an existing repo (`--dry-run`, `--json` preview supported)                                                                                                                                                                                                                                                                                                         |
| `ci-migrate`        | Stage, verify, commit, abort, sync branch protection, or promote CI mode                                                                                                                                                                                                                                                                                                                     |
| `branch-protect`    | Configure GitHub branch protection rulesets                                                                                                                                                                                                                                                                                                                                                  |
| `verify-work`       | Run canonical repo-local verification (fresh or resume mode)                                                                                                                                                                                                                                                                                                                                 |
| `verify-coderabbit` | Verify CodeRabbit configuration and remote wiring                                                                                                                                                                                                                                                                                                                                            |
| `preset`            | List and inspect bundled presets                                                                                                                                                                                                                                                                                                                                                             |
| `symphony-check`    | Validate `WORKFLOW.md`, Linear config, and transition-table readiness                                                                                                                                                                                                                                                                                                                        |

In CI mode, `harness next --mode ci --json` recommends `harness fleet-plan --from artifacts/harness-upgrade-matrix-dev.json --json` when the upgrade-matrix artifact exists.

## Review and policy gates

| Command                  | Purpose                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `policy-gate`            | Validate policy expectations from changed files                                                                                                                                                     |
| `preflight-gate`         | Run fast policy checks before expensive work                                                                                                                                                        |
| `review-gate`            | Validate SHA-linked review readiness (review check + review-policy required checks)                                                                                                                 |
| `docs-gate`              | Enforce documentation parity for governed changes                                                                                                                                                   |
| `plan-gate`              | Validate plan IDs, traceability, and acceptance evidence across `docs/plans/**.md` and HE `.harness/plan/**.md` artifacts                                                                           |
| `brainstorm-gate`        | Validate brainstorm artifacts                                                                                                                                                                       |
| `prompt-gate`            | Validate prompt template usage                                                                                                                                                                      |
| `pr-template-gate`       | Validate PR template completion and placeholder replacement                                                                                                                                         |
| `rule-lifecycle-gate`    | Validate governance rules have owner, evidence, enforcement, freshness, and retirement metadata                                                                                                     |
| `license-gate`           | Validate open-source license expectations                                                                                                                                                           |
| `check-authz`            | Validate authorization policy for mutative operations                                                                                                                                               |
| `check-environment`      | Validate pilot environment governance checks                                                                                                                                                        |
| `local-memory-preflight` | Run the structured Local Memory preflight smoke checks                                                                                                                                              |
| `artifact-gate`          | Check generated artifact changes against the artifact provenance registry                                                                                                                           |
| `artifact-routine`       | Validate `.harness/active-artifacts.md` route-driving specs and plans for owner, freshness, reference integrity, runtime-output boundaries, and stale artifact classification before implementation |
| `runtime-budget`         | Build `command-runtime-budget/v1` evidence from measured command durations and budgets                                                                                                              |
| `ci-ownership-gate`      | Validate CircleCI primary ownership plus CodeRabbit and Semgrep required checks                                                                                                                     |
| `blast-radius`           | Determine required checks from changed files                                                                                                                                                        |
| `risk-tier`              | Classify changed files by risk tier                                                                                                                                                                 |
| `pattern-scope`          | Build a pattern-scope artifact from steering feedback and changed files                                                                                                                             |
| `diff-budget`            | Enforce diff budget constraints                                                                                                                                                                     |
| `observability-gate`     | Check metrics cardinality limits                                                                                                                                                                    |
| `silent-error`           | Detect silent error-handling anti-patterns                                                                                                                                                          |
| `memory-gate`            | Validate local-memory workflow compliance                                                                                                                                                           |

## review-gate north-star evidence

When `harness.contract.json` defines `northStar` governance and the changed
files match a governed product surface, `review-gate` enforces a PR-body
decision contract in addition to the existing SHA, approvals, and required
check rules.

Required PR-body lines:

- `lead_time_path: yes. Evidence: <ref>`
- `manual_glue: yes. Evidence: <ref>`
- `agent_reliability: yes. Evidence: <ref>`
- `safety_floor: yes. Evidence: <ref>`

Blocking behavior:

- Missing question lines or missing `Evidence:` references produce
  `review_evidence_incomplete`.
- Any answer other than `yes` produces `review_evidence_contradiction`.

Compatibility:

- Repos without `northStar` configuration keep legacy `review-gate` behavior.
- Repos with `northStar` configured only enforce these decisions when the diff
  touches a governed surface declared under `productSurface.surfaces`.

## Linear and workflow operations

| Command             | Purpose                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linear`            | Claim, hand off, close, prepare, or sync Linear work from one command family                                                                                                                   |
| `linear-gate`       | Enforce Linear-first intake, branch naming, and PR linkage                                                                                                                                     |
| `pr-closeout`       | Classify pull-request closeout state before handoff or merge, including required metadata, checks, Coding Harness closeout gates, review state, tool evidence, and AI session/trace references |
| `workflow:generate` | Generate compact workflow specs from annotated markdown                                                                                                                                        |

## Pilot, remediation, and automation

| Command          | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `pilot-evaluate` | Evaluate pilot metrics and determine promotion readiness |
| `pilot-rollback` | Move pilot mode between autonomous and manual states     |
| `simulate`       | Run counterfactual policy simulation                     |
| `automation-run` | Execute idempotent automation playbooks                  |
| `gap-case`       | Manage production gap cases                              |
| `remediate`      | Plan and run deterministic remediation for findings      |
| `replay`         | Re-run policy checks from saved snapshots                |

## Drift, search, and evidence

| Command               | Purpose                                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drift-gate`          | Evaluate consistency drift across governance surfaces                                                                                                                                                                             |
| `org-audit`           | Scan multi-repo governance and drift posture                                                                                                                                                                                      |
| `tooling-audit`       | Audit managed repo tooling baselines                                                                                                                                                                                              |
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
| `source-outline`      | Inspect TypeScript-family signatures and comments before opening implementations, with optional single-symbol implementation unwrapping via `--symbol`                                                                            |
| `index-context`       | Build the local semantic-search index                                                                                                                                                                                             |
| `evidence-verify`     | Validate screenshot and evidence artifacts                                                                                                                                                                                        |
| `ui:fast`             | Run a Storybook-first local UI loop                                                                                                                                                                                               |
| `ui:verify`           | Run Playwright smoke verification with evidence capture                                                                                                                                                                           |
| `ui:explore`          | Run agent-browser exploratory testing                                                                                                                                                                                             |

Use `source-outline` as the first read for TypeScript-family source files:

```bash

bash scripts/harness-cli.sh source-outline src/commands/search.ts --json
bash scripts/harness-cli.sh source-outline src/commands/search.ts --symbol runSearchCLI --json
```

In downstream repositories that consume the packaged CLI directly, use the same
command shape through `harness source-outline <path>`.

After instruction discovery, use `AI/context/diagram-context.md` as the compact
architecture map. It combines architecture, dependency, database, and ERD
Mermaid diagrams; use `.diagram/manifest.json` when a focused diagram file is
enough.
