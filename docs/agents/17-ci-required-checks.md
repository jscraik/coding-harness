# 17 — CI Required Checks vs GitHub Branch Protection

## Table of Contents

- [Two separate systems](#two-separate-systems)
- [How they interact](#how-they-interact)
- [ci-required-checks.json schema](#ci-required-checksjson-schema)
- [Orchestration metadata](#orchestration-metadata)
- [How CI providers report checks to GitHub](#how-ci-providers-report-checks-to-github)
- [What to put in GitHub branch protection](#what-to-put-in-github-branch-protection)
- [Using harness ci-migrate](#using-harness-ci-migrate)
- [Doctor alignment check](#doctor-alignment-check)

---

## Two separate systems

The harness maintains **two independent "required checks" concepts** that are often confused:

| System | File / Location | Purpose | Example values |
|--------|----------------|---------|----------------|
| **Harness internal checks** | `.harness/ci-required-checks.json` | Tracks what the harness considers a complete CI run for governance gates | `lint`, `typecheck`, `test`, `audit`, `docs-gate` |
| **GitHub branch protection** | GitHub Ruleset / `harness.contract.json → branchProtection.requiredChecks` | The actual check names GitHub enforces before a PR can merge | `pr-pipeline`, `harness-gates` |

> [!IMPORTANT]
> These systems use **completely different check names**. A project can have 15 harness internal checks but only 2 GitHub branch protection checks. They are independent.

---

## How they interact

```
CI run (CircleCI / GHA)
       │
       │ runs jobs: lint, typecheck, test, audit, docs-gate ...
       │             ↑ tracked in ci-required-checks.json
       │
       │ reports ONE workflow-level status check to GitHub
       │             ↑ this is what GitHub branch protection sees
       ↓
GitHub check run: "pr-pipeline"  ← only this name matters for branch protection
```

When CI jobs or local validation steps invoke `harness linear*` commands, the runner must expose `LINEAR_API_KEY` (or pass `--token` explicitly). If secrets are stored in `~/.codex/.env`, load that file into the active shell/session first, and run `harness symphony-check` when validating secret discovery behavior.

The harness internal checks in `ci-required-checks.json` are used by:
- `harness drift-gate` — to verify all expected checks completed
- `harness doctor` — to validate the manifest is present and aligned
- `harness ci-migrate` — to bootstrap and track the check manifest across migrations

They do **not** create individual GitHub check-run entries when using CircleCI.

---

## ci-required-checks.json schema

Each entry in `.harness/ci-required-checks.json` supports optional canonical orchestration fields. The existing branch-protection mapping field remains `githubCheckName`.

```json
{
  "version": 1,
  "activeProvider": "circleci",
  "requiredChecks": [
    {
      "policyId": "required-check-1",
      "displayName": "lint",
      "sourceAppSlug": "circleci",
      "sourceAppId": "circleci",
      "externalIdPattern": "^lint$",
      "requiredOnEvents": ["pull_request", "merge_group"],
      "freshnessWindowDays": 7,
      "class": "required",
      "githubCheckName": "pr-pipeline",
      "gateId": "lint",
      "executionClass": "read_only_parallel",
      "failureClassDefault": "transient_infra",
      "order": 20,
      "enabled": true
    },
    {
      "policyId": "required-check-7",
      "displayName": "docs-gate",
      "sourceAppSlug": "circleci",
      "sourceAppId": "circleci",
      "externalIdPattern": "^docs-gate$",
      "requiredOnEvents": ["pull_request", "merge_group"],
      "freshnessWindowDays": 7,
      "class": "required",
      "githubCheckName": "harness-gates",
      "gateId": "docs-gate",
      "executionClass": "serial_guarded",
      "failureClassDefault": "contract_policy",
      "order": 40,
      "enabled": true
    }
  ]
}
```

**`githubCheckName`** (optional string): The GitHub check-run name that this internal check is surfaced through in branch protection. If omitted, the check is assumed to be harness-internal only and not directly enforced by GitHub.
**`gateId`** (optional string): Stable gate identity used for resume compatibility. If omitted, `displayName` becomes the default gate identity, so renaming `displayName` also changes the identity tuple and therefore `contractVersion`.
**`executionClass`** (optional): `read_only_parallel` or `serial_guarded`; defaults to `serial_guarded`.
**`failureClassDefault`** (optional): `transient_infra`, `contract_policy`, or `internal_unknown`.
**`order`** (optional positive integer): deterministic execution ordering fallback when orchestration mode is active.
**`enabled`** (optional boolean): explicit gate activation switch.

Use `harness doctor` to verify that all `githubCheckName` values match what the active CI provider actually reports.

---

## Orchestration metadata

`verify-work` and `doctor` now consume one normalized projection of `.harness/ci-required-checks.json` for gate identity and check-alignment terms.

The normalized identity tuple is:

```
gateId + provider(sourceAppSlug) + externalIdPattern + githubCheckName
```

Contract compatibility rules:

- `version` remains the manifest schema version.
- `contractVersion` is derived from the identity tuple when not explicitly set.
- Non-identity field changes (`displayName`, `order`, `enabled`) do not force resume incompatibility when `gateId` is held constant.
- Identity field changes do invalidate resume compatibility for affected gates.

---

## How CI providers report checks to GitHub

### CircleCI

CircleCI reports **one check run per workflow**, not per job:

| CircleCI entity | GitHub check-run name |
|---|---|
| Workflow `pr-pipeline` | `pr-pipeline` |
| Workflow `harness-gates` | `harness-gates` |
| Individual jobs (`lint`, `test`) | ❌ not visible as separate GitHub checks |

> [!NOTE]
> CircleCI jobs appear in the CircleCI UI but **do not create individual GitHub check-run entries**. GitHub branch protection must use the workflow name, not the job name.

### GitHub Actions

GHA reports **one check run per job** under the workflow:

| GHA entity | GitHub check-run name |
|---|---|
| Workflow `pr-pipeline` / job `lint` | `lint` (just the job name) |
| Workflow `pr-pipeline` / job `test` | `test` |

> [!NOTE]
> With GitHub Actions, individual job names **do** appear as separate GitHub check-run entries and can each be required in branch protection.

---

## What to put in GitHub branch protection

### CircleCI (default setup)

Add only these to GitHub branch protection rulesets:

```
pr-pipeline     ← main CI workflow
harness-gates   ← harness gate workflow
```

Run `harness branch-protect` to apply via the contract.

### GitHub Actions (legacy / fallback)

Individual job names are valid:

```
lint
typecheck
test
audit
```

Or workflow-level fan-in names if you use a status aggregation job.

---

## Using harness ci-migrate

`harness ci-migrate status` prints the expected GitHub check-run names for the target provider:

```bash
harness ci-migrate status --provider circleci
# Output includes:
#   GitHub branch protection check: pr-pipeline
#   GitHub branch protection check: harness-gates
```

`harness ci-migrate bootstrap` seeds `.harness/ci-required-checks.json` and adds `githubCheckName` metadata automatically for the target provider.

---

## Doctor alignment check

`harness doctor` runs a `ci:check-alignment` advisory check that warns if:

- `.harness/ci-required-checks.json` is present
- any active-provider CircleCI entries (`sourceAppSlug: "circleci"`) have a `githubCheckName` that looks like a CircleCI job name instead of a workflow name

Entries for non-CircleCI providers (for example `github-actions` check contexts like `security-scan`) are excluded from the CircleCI job-name warning.

**Example warning:**

```
⚠️  ci:check-alignment  ci-required-checks.json has githubCheckName values that look like CircleCI job names, not workflow names: lint. CircleCI reports ONE check run per workflow (e.g. "pr-pipeline"), not per job.
    Fix: Update githubCheckName fields to workflow names (pr-pipeline / harness-gates). See docs/agents/17-ci-required-checks.md
```
