# 17 — CI Required Checks vs GitHub Branch Protection

## Table of Contents

- [Two separate systems](#two-separate-systems)
- [How they interact](#how-they-interact)
- [ci-required-checks.json schema](#ci-required-checksjson-schema)
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

Each entry in `.harness/ci-required-checks.json` supports an optional `githubCheckName` field to explicitly declare which GitHub branch-protection check name this entry rolls up into:

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
      "githubCheckName": "pr-pipeline"
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
      "githubCheckName": "harness-gates"
    }
  ]
}
```

**`githubCheckName`** (optional string): The GitHub check-run name that this internal check is surfaced through in branch protection. If omitted, the check is assumed to be harness-internal only and not directly enforced by GitHub.

Use `harness doctor` to verify that all `githubCheckName` values match what the active CI provider actually reports.

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
- any entries have a `githubCheckName` that does not match the active provider's expected workflow name pattern

**Example warning:**

```
⚠️  ci:check-alignment  ci-required-checks.json has entries with githubCheckName "quality-gates"
                         but active provider is circleci — expected "pr-pipeline" or "harness-gates"
    Fix: Update githubCheckName fields or run: harness ci-migrate sync-branch-protection
```
