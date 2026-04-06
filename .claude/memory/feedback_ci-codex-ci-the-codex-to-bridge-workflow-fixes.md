# CI Responsibility — Learnings

## Root cause: CircleCI free-tier resource_class

- **2026-04-05 [Claude]:** CircleCI free tier only supports `resource_class: medium` for Docker executors. All prior pipelines used `large` or `small`, which queue indefinitely because no runner exists.
  - **Why:** The free-tier plan doesn't provide runners for non-medium resource classes. Pipelines are created but never dispatched (`build_num: null`).
  - **How to apply:** Always use `resource_class: medium` in `.circleci/config.yml` for this repo. If upgrading to a paid plan, validate runner capacity before changing resource_class.

## GitHub webhook was never configured

- **2026-04-05 [Claude]:** All 260 historical CircleCI pipelines had `trigger_type: null` because no GitHub → CircleCI webhook existed. Pipelines were only ever triggered manually or by CircleCI project follows.
  - **Why:** The webhook at `https://circleci.com/hooks/github` was never added to the GitHub repo settings.
  - **How to apply:** If pipelines stop auto-triggering, verify an active CircleCI webhook is present with expected events:
    `gh api repos/jscraik/coding-harness/hooks --jq '.[] | select(.active == true and (.config.url == "https://circleci.com/hooks/github") and ((.events | index("push")) != null) and ((.events | index("pull_request")) != null))'`.
    Recreate if missing.

## CI responsibility matrix is the source of truth

- **2026-04-05 [Claude]:** `docs/ci-responsibility-matrix.md` is the operational source of truth for CI ownership intent. `harness.contract.json`, `.harness/ci-required-checks.json`, and workflow files are executable enforcement artifacts that must be updated in lockstep.
  - **Why:** Prevents duplicate gates, conflicting release paths, and ambiguous merge requirements. Precedence inversion between docs and automation creates silent governance drift.
  - **How to apply:** After any CI config change, update both the matrix and CI contract artifacts together, then run `pnpm workflow:validate` to detect documentation contract issues.

## Current CI state

- **2026-04-05 [Claude]:** CircleCI is the primary PR gate. GitHub Actions owns security scanning and npm publish exclusively. The bridge workflow is dispatch-only emergency fallback.
  - **Why:** Separation of concerns with single ownership per responsibility.
  - **How to apply:** Do not re-enable bridge automatic triggers unless CircleCI runner capacity becomes unavailable. Update the matrix Current State section whenever CI state changes.
