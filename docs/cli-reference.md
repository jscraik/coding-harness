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
- [Local execution](#local-execution)
- [Drift, search, and evidence](#drift-search-and-evidence)

## Purpose

This file contains the extended command catalog for Coding Harness.

For repo-facing onboarding and common workflows, start at [`README.md`](../README.md).

## Agent cockpit entrypoint

Use `harness next --json` as the sole routine first-contact entrypoint. It
emits the compact next-action decision and SynAIpse cockpit state for the
current repository. Use `harness orient --json` only for legacy cold-start
compatibility when a caller explicitly needs the older `harness-orient/v1`
packet, which wraps the read-only context surfaces and local truth-lane
caveats.

```bash
harness next --json
harness orient --json # legacy compatibility only
```

The `harness next --json` decision inspects changed files from git by
default, emits a `HarnessDecision`, and points `nextCommand` at an
existing command instead of inventing a new workflow. The decision includes
`cockpitLane` so operators and agents can branch through the five product
lanes: `orient`, `prove`, `repair`, `review`, and
`handoff`.

Optional overrides:

```bash
harness runtime-card --json --live \
  --out .harness/runtime/JSC-311.json \
  --evidence-out .harness/runtime/JSC-311-evidence.json
harness runtime-card --json --evidence .harness/runtime/session-evidence.json --out .harness/runtime/JSC-311.json
harness runtime-card --json --trace-out artifacts/agent-runs/<runId>/events.jsonl
harness next --json --files src/cli.ts docs/cli-reference.md
harness next --json --phase-exit .harness/runs/phase-exit.json
harness next --json --runtime-card .harness/runtime/JSC-311.json
harness next --json --pr-closeout artifacts/pr-closeout/pr-closeout.json
harness next --json --mode pr
```

Replace `<runId>` with a fresh run identifier for each trace-out attempt.

`--phase-exit` accepts a local `HePhaseExit/v1` JSON artifact. When supplied,
`harness next` normalizes the phase-exit result into `meta.hePhaseExit` and
blocks the recommendation if the artifact reports `commitAllowed=false` or
`exitAllowed=false`.

`--pr-closeout` accepts a local `pr-closeout/v1` JSON artifact. When omitted,
`harness next` auto-loads `artifacts/pr-closeout/pr-closeout.json` if that
artifact exists. When supplied, `harness next` normalizes the report into
`meta.prCloseout` and blocks handoff recommendations until the report passes
the `pr-closeout/v1` validation contract, including rejection of shallow,
stale, incomplete, or false-ready closeout artifacts.

Stacked-PR reports may include `stackState`. Stable or explicitly
not-applicable stack evidence can continue; unstable or required unknown stack
state remains a branch blocker until parent, lower-layer, and base evidence is
current.

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
Linear, source, and blocker state by hand. Use `--trace-out
artifacts/agent-runs/<runId>/events.jsonl` with a fresh run id when the run
should also append a canonical replay-ready `agent-run-event/v1` JSONL stream
and sibling run manifest. Existing or pre-claimed run ids fail closed before
the first event append so replay evidence does not blend multiple executions.
Trace output is opt-in audit/orientation evidence only; it does not prove
closeout, review coverage, CI, Linear alignment, or merge readiness.

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

Agents that need a bounded rail set should start with the curated agent catalog:

```bash
harness commands --json --for-agent
```

Use `--mode orient`, `--mode verify`, `--mode review`, or `--mode handoff` to
request a compact phase-specific rail.

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
| `agent-readiness`   | Audit agent-readable instructions, artifacts, capabilities, approval gates, traceability, and context freshness (`--json`, optional path, optional `--repo-root`)                                                                                                                                                                                                                            |
| `agent-native-ratchets` | Emit an `agent-native-ratchets/v1` packet for ratchet discovery (`--json`)                                                                                                                                                                                                                                                                                                                   |
| `agent-rework`      | Emit an `agent-rework/v1` packet from local rework evidence (`--json`)                                                                                                                                                                                                                                                                                                                       |
| `orient`            | Emit a compact cold-start `harness-orient/v1` packet with next, session-context, agent-readiness context health, preflight receipt status, architecture refs, Project Brain refs, and truth-lane warnings (`--json`, optional `--repo-root`)                                                                                                                                            |
| `init`              | Scaffold or update harness-managed repo surfaces (`--project-type`, `--json`, `--dry-run`, `--force`, `--track`, `--update`, `--migrate`, `--minimal`, `--issue-tracker`)                                                                                                                                                                                                                    |
| `job`               | Submit, reconnect, wait for, list, or cancel durable local execution tickets (`job submit\|status\|wait\|list\|cancel`, `--json`)                                                                                                                                                                                                         |
| `eject`             | Safely remove harness-managed files and templates, including legacy Greptile artifacts, while preserving custom non-Greptile CI workflows (`--dry-run`, `--force`)                                                                                                                                                                                                                           |
| `check`             | Zero-config repo health snapshot — works before full setup                                                                                                                                                                                                                                                                                                                                   |
| `next`              | Read-only agent cockpit entrypoint that recommends the next safe existing command (`--json`, optional `--files`, optional `--phase-exit`, optional `--runtime-card`, optional `--pr-closeout`, optional `--fitness-report`, optional `--mode local\|pr\|ci`)                                                                                                                                 |
| `runtime-card`      | Build a `runtime-card/v1` artifact from git, harness evidence, normalized evidence bundles, and optional live provider state (`--json`, optional `--live`, optional `--repo`, optional `--issue`, optional `--phase-exit`, optional `--evidence`, optional `--out`, optional `--evidence-out`, optional `--trace-out artifacts/agent-runs/<runId>/events.jsonl`)                             |
| `session-context`   | Emit a read-only `session-context/v1` orientation packet for repo, issue, branch, artifact, runtime-card, review-evidence, stale-state, and traversal hints (`--json`, optional `--repo-root`)                                                                                                                                                                                               |
| `session-distill`   | Emit a `session-distill/v1` packet for resumed agents (`--json`)                                                                                                                                                                                                                                                                                                                             |
| `reviewer-decision` | Emit a `reviewer-decision/v1` packet from review coverage evidence (`--json`, optional `--manifest`, optional `--reviews-dir`)                                                                                                                                                                                                                                                               |
| `governance-decision-surface` | Emit a `governance-decision-surface/v1` packet from governance lifecycle evidence (`--json`)                                                                                                                                                                                                                                                                                                  |
| `decision-request`  | Emit a read-only `decision-request/v1` governance packet for a bounded HILT authority boundary, including intent, authority, options, evidence refs, boundary class, expiry/freshness, escalation metadata, and stale-state classification (`--json`, `--intent`, `--default-option`, `--boundary`, repeated `--option id=label`, optional repeated `--tradeoff id=text`)                    |
| `pr-closeout`       | Build a read-only `pr-closeout/v1` report from normalized evidence or live GitHub CLI state, including PR metadata, check state, Coding Harness closeout gates, CLI availability, dirty worktree state, and AI session/traceability completeness (`--json`, `--input <path>` or `--pr <number>`, optional `--repo`, optional `--gates`, compatibility `--phase-exit`, optional `--env-file`) |
| `fleet-plan`        | Build an agent-native remediation plan from a harness upgrade matrix artifact (`--from`, `--json`)                                                                                                                                                                                                                                                                                           |
| `doctor`            | Check gate prerequisites without changing the repository by default (`--json`, optional `--dir`); add `--write-artifact` only when a north-star classification sidecar is intentionally required.                                                                                                                        |
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

`decision-request` accepts only real HILT authority boundaries for `--boundary`:
`destructive_action`, `external_mutation`, `credential_or_secret_access`,
`security_sensitive_action`, `public_contract_change`, `release_action`,
`permission_escalation`, `stale_claim_support`, `merge_readiness`,
`tracker_authority`, and `goal_completion`. Claim-sensitive boundaries
(`stale_claim_support`, `merge_readiness`, `tracker_authority`, and
`goal_completion`) require at least one non-empty `--evidence` ref and
non-current stale-state evidence; routine uncertainty must stay in local
investigation rather than becoming a decision-request packet.

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
| `fitness`                | Normalize repository fitness findings from existing harness gates                                                                                                                                   |
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

## Local execution

`harness run` is the first local-only execution-coordinator slice. It runs one
explicit command without a shell, records stdout and stderr under
`artifacts/agent-runs/<runId>/`, and emits `harness-execution-result/v1` when
`--json` is supplied.

```bash
harness run --command node --json -- --version
harness run --command pnpm --lane validation --timeout-seconds 120 --json -- test:related
```

Use `--request-key` to make reconnects explicit, `--parallel-safe` only for a
read-only command that is safe to overlap, and repeat `--lane` to characterize
resource ownership. The result proves only local process execution;
hosted-CI, review-thread, tracker, and merge-readiness claims remain
`not_checked`.

`harness job` adds the persistent local Conductor slice. Submission writes a
`harness-execution-job/v1` ticket beneath the same artifact root and launches a
detached local worker. A later process can reconnect by ticket or request key;
the scheduler persists queue ownership, resource conflicts, cancellation
requests, worker identity, terminal status, and the linked execution result.

```bash
harness job submit --command pnpm --request-key related-tests --lane validation --json -- test:related
harness job status --ticket <ticket> --json
harness job wait --ticket <ticket> --timeout-seconds 900 --json
harness job list --json
harness job cancel --ticket <ticket> --json
```

Every `harness job ... --json` invocation returns the
`harness-execution-job-response/v1` envelope with `operation`, `outcome`,
`timedOut`, `job`, and `jobs`. A `wait` deadline reports `outcome:
"wait_timeout"` while the ticket remains non-terminal; that signal describes
the polling deadline, not a process execution timeout.

The default policy is FIFO for conflicting local resource lanes. Parallel-safe
read jobs can overlap; a reused request key with a changed fingerprint fails
closed. Stale workers are classified as local `environment_failure` so a
reconnected operator can decide whether to retry. Job and result claims remain
local-only: hosted CI, review threads, tracker state, and merge readiness stay
`not_checked`.

| Command | Purpose |
| ------- | ------- |
| `run` | Execute one local process with resource-lane conflict and artifact result tracking |
| `job submit` | Queue a durable local execution ticket and return its request-key identity |
| `job list` | List durable local tickets after stale-worker recovery |
| `job status` | Read one ticket without losing its persisted result or claims boundary |
| `job wait` | Reconnect and wait for one ticket to become terminal |
| `job cancel` | Cancel a queued ticket or request cancellation from its running worker |

## Drift, search, and evidence

| Command                         | Purpose                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drift-gate`                    | Evaluate consistency drift across governance surfaces                                                                                                                                                                             |
| `org-audit`                     | Scan multi-repo governance and drift posture                                                                                                                                                                                      |
| `tooling-audit`                 | Audit managed repo tooling baselines                                                                                                                                                                                              |
| `feedback-loop-audit`           | Validate the local feedback-loop ledger so audit findings, cross-loop gaps, and recommended next steps have closure state, owner, action, delay, failure-class, and evidence refs                                                 |
| `gardener`                      | Detect stale docs and broken links                                                                                                                                                                                                |
| `context-health`                | Generate advisory context-integrity scorecards                                                                                                                                                                                    |
| `prompt-context-drift:write`    | Write the prompt-context drift report for the current repo                                                                                                                                                                        |
| `prompt-context-drift:validate` | Validate a prompt-context drift report for the current repo                                                                                                                                                                       |
| `learnings`                     | Import local operational review evidence, run exact-file learning gates, and generate high-usage promotion candidates via `learnings import`, `learnings gate`, and `learnings promote`                                           |
| `review-context`                | Generate PR review context from changed files and imported operational learnings, including validation-plan entries and an advisory `review-learning-closeout/v1` artifact with match, promotion, and explicit non-promotion evidence                                                                            |
| `validation-plan`               | Recommend repo-canonical validation commands from changed files and imported validation-contract learnings, with network-required commands separated                                                                              |
| `north-star-feedback`           | Measure learning hits, gate blocks/warnings, promotion candidates, promoted learnings, high-usage unenforced learnings, review-thread count, and validation reruns from imported learning evidence and optional run artifacts     |
| `artifact-gate`                 | Check changed generated artifacts against `.harness/artifact-provenance.json` so template/source edits accompany runtime mirrors                                                                                                  |
| `artifact-routine`              | Validate `.harness/active-artifacts.md` route-driving specs and plans for owner, freshness, reference integrity, runtime-output boundaries, and stale artifact classification before implementation                               |
| `ci-ownership-gate`             | Validate that CircleCI owns the primary PR workflow while CodeRabbit and Semgrep Cloud remain independent required checks                                                                                                         |
| `search`                        | Run hybrid lexical and semantic search; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used       |
| `context`                       | Search indexed plans, specs, and brainstorms; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used |
| `source-outline`                | Inspect TypeScript-family signatures and comments before opening implementations, with optional single-symbol implementation unwrapping via `--symbol`                                                                            |
| `index-context`                 | Build the local semantic-search index                                                                                                                                                                                             |
| `evidence-verify`               | Validate evidence files and browser evidence manifests, including screenshot presence, viewport coverage, non-blank PNG checks, and console policy enforcement                                                                    |
| `ui:fast`                       | Run a Storybook-first local UI loop                                                                                                                                                                                               |
| `ui:verify`                     | Run Playwright smoke verification with evidence capture                                                                                                                                                                           |
| `ui:explore`                    | Run agent-browser exploratory testing                                                                                                                                                                                             |

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
