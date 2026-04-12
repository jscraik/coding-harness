# CLI Reference

## Table of Contents
- [Purpose](#purpose)
- [Machine-readable command catalog](#machine-readable-command-catalog)
- [Gate JSON Envelope](#gate-json-envelope)
- [Unknown command guardrails](#unknown-command-guardrails)
- [Bootstrap and governance](#bootstrap-and-governance)
- [Review and policy gates](#review-and-policy-gates)
- [Linear and workflow operations](#linear-and-workflow-operations)
- [Pilot, remediation, and automation](#pilot-remediation-and-automation)
- [Drift, search, and evidence](#drift-search-and-evidence)

## Purpose

This file contains the extended command catalog for Coding Harness.

For repo-facing onboarding and common workflows, start at [`README.md`](../README.md).

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

When an unknown command is invoked with `--json`, harness returns suggested commands with catalog-derived guardrail metadata (`mutability`, `retryability`, `requiredFlags`, and `safeFirstAlternatives`) so agents can choose a safe fallback path.

## Bootstrap and governance

Taxonomy note: section headings in this document represent command families. They are not additional callable top-level commands.

| Command | Purpose |
| --- | --- |
| `commands` | Emit the versioned machine-readable command capability catalog (`--json`) |
| `init` | Scaffold or update harness-managed repo surfaces (`--project-type`, `--json`, `--dry-run`, `--force`, `--track`, `--update`, `--migrate`, `--minimal`, `--issue-tracker`) |
| `eject` | Safely remove harness-managed files and templates, including legacy Greptile artifacts, while preserving custom non-Greptile CI workflows (`--dry-run`, `--force`) |
| `check` | Zero-config repo health snapshot — works before full setup |
| `doctor` | Check all gate prerequisites (tools, files, config, CI) |
| `health` | Unified gate status scorecard across all gates |
| `contract` | Validate `harness.contract.json` or print the JSON Schema (`init`, `validate`, `schema`) |
| `upgrade` | Safely upgrade harness in an existing repo (`--dry-run` supported) |
| `ci-migrate` | Stage, verify, commit, abort, sync branch protection, or promote CI mode |
| `branch-protect` | Configure GitHub branch protection rulesets |
| `verify-work` | Run canonical repo-local verification (fresh or resume mode) |
| `verify-coderabbit` | Verify CodeRabbit configuration and remote wiring |
| `preset` | List and inspect bundled presets |
| `symphony-check` | Validate `WORKFLOW.md`, Linear config, and transition-table readiness |

## Review and policy gates

| Command | Purpose |
| --- | --- |
| `policy-gate` | Validate policy expectations from changed files |
| `preflight-gate` | Run fast policy checks before expensive work |
| `review-gate` | Enforce merge-readiness and SHA-linked review checks |
| `docs-gate` | Enforce documentation parity for governed changes |
| `plan-gate` | Validate plan IDs, traceability, and acceptance evidence |
| `brainstorm-gate` | Validate brainstorm artifacts |
| `prompt-gate` | Validate prompt template usage |
| `pr-template-gate` | Validate PR template completion and placeholder replacement |
| `license-gate` | Validate open-source license expectations |
| `check-authz` | Validate authorization policy for mutative operations |
| `check-environment` | Validate pilot environment governance checks |
| `local-memory-preflight` | Run the structured Local Memory preflight smoke checks |
| `blast-radius` | Determine required checks from changed files |
| `risk-tier` | Classify changed files by risk tier |
| `diff-budget` | Enforce diff budget constraints |
| `observability-gate` | Check metrics cardinality limits |
| `silent-error` | Detect silent error-handling anti-patterns |
| `memory-gate` | Validate local-memory workflow compliance |

## Linear and workflow operations

| Command | Purpose |
| --- | --- |
| `linear` | Claim, hand off, close, prepare, or sync Linear work from one command family |
| `linear prepare` | Pre-fill branch name, PR title, body, and closing line from a Linear issue |
| `linear sync` | Promote harness findings into Linear issues idempotently |
| `linear-gate` | Enforce Linear-first intake, branch naming, and PR linkage |
| `workflow:generate` | Generate compact workflow specs from annotated markdown |

## Pilot, remediation, and automation

| Command | Purpose |
| --- | --- |
| `pilot-evaluate` | Evaluate pilot metrics and determine promotion readiness |
| `pilot-rollback` | Move pilot mode between autonomous and manual states |
| `simulate` | Run counterfactual policy simulation |
| `automation-run` | Execute idempotent automation playbooks |
| `gap-case` | Manage production gap cases |
| `remediate` | Plan and run deterministic remediation for findings |
| `replay` | Re-run policy checks from saved snapshots |

## Drift, search, and evidence

| Command | Purpose |
| --- | --- |
| `drift-gate` | Evaluate consistency drift across governance surfaces |
| `org-audit` | Scan multi-repo governance and drift posture |
| `tooling-audit` | Audit managed repo tooling baselines |
| `gardener` | Detect stale docs and broken links |
| `context-health` | Generate advisory context-integrity scorecards |
| `search` | Run hybrid lexical and semantic search; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used |
| `context` | Search indexed plans, specs, and brainstorms; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used |
| `index-context` | Build the local semantic-search index |
| `evidence-verify` | Validate screenshot and evidence artifacts |
| `ui:fast` | Run a Storybook-first local UI loop |
| `ui:verify` | Run Playwright smoke verification with evidence capture |
| `ui:explore` | Run agent-browser exploratory testing |
