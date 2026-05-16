---
title: CircleCI Snyk Delta Gate Alignment
date: 2026-05-16
module: ci-security
problem_type: ci-failure
evidence:
  - https://github.com/jscraik/coding-harness/pull/254
  - https://circleci.com/gh/jscraik/coding-harness/11537
project_brain_sync: not-required
tags: [circleci, snyk, security-scan, ci, pr-gate]
---

# CircleCI Snyk Delta Gate Alignment

## Command Summary

BLUF: This artifact tells the harness operator or agent how to fix CircleCI's
`snyk-dependency-scan` when it fails a PR that the external GitHub Snyk delta
check has already cleared. It matters because confusing repo-run Snyk reporting
with PR-blocking dependency-delta authority can leave unrelated PRs stuck on
historical whole-repo findings. The durable rule is to keep the pinned CircleCI
Snyk orb, keep `monitor-on-build: false`, and set `fail-on-issues: false` in
both the live config and generated template.

Decision Needed: Do not turn CircleCI Snyk into the dependency-delta authority;
use the external GitHub Snyk PR check for that blocking decision.

Top Risks: Re-enabling `fail-on-issues: true` can block unrelated PRs on
historical whole-repo vulnerability findings, while removing the CircleCI Snyk
lane loses repo-run visibility and weakens the documented CI ownership split.

Next Action: When this failure recurs, confirm the external GitHub Snyk PR
check result, then keep CircleCI Snyk report-only unless the security contract
is intentionally migrated.

## Problem

PR #254 had a failing CircleCI `snyk-dependency-scan` job while the external
`security/snyk (jscraik)` GitHub check passed with "No manifest changes
detected in 1 project." The CircleCI job had access to `SNYK_TOKEN`, so the
failure was not token wiring. The remaining mismatch was policy: CircleCI was
configured to fail on whole-repo Snyk findings, which can block a PR even when
the dependency delta gate has cleared.

## Evidence

- `gh pr checks 254 --watch=false` reported `ci/circleci:
  snyk-dependency-scan` as failed and `security/snyk (jscraik)` as passed.
- `circleci project secret list github jscraik coding-harness --json` showed
  a configured `SNYK_TOKEN` project environment variable.
- `.circleci/config.yml` and `src/templates/circleci-config.yml` both used
  the pinned `snyk/snyk@2.3.0` orb with `fail-on-issues: true`.
- The repository governance docs already separated CircleCI repo-run scanning
  from external app checks such as Semgrep Cloud and GitHub Snyk PR status.

## Root Cause

The CI policy conflated two different Snyk roles. CircleCI's Snyk orb lane was
serving repo-run visibility, but `fail-on-issues: true` made it a blocking
whole-repo vulnerability gate. The external GitHub Snyk PR check was already
providing the PR dependency-delta decision and had cleared this change.

## Fix Or Durable Guidance

Keep the CircleCI Snyk lane installed and authenticated, but configure it as
report-only:

1. Set `fail-on-issues: false` in `.circleci/config.yml`.
2. Set `fail-on-issues: false` in `src/templates/circleci-config.yml`.
3. Keep `monitor-on-build: false` unless external Snyk snapshot writes are
   explicitly approved.
4. Keep the generated-template test asserting the report-only setting.
5. Keep `Snyk` in the Vale vocabulary when changed governance docs name the
   vendor.
6. Keep docs clear that external GitHub Snyk remains the blocking dependency
   delta signal.

## Validation

- Command: `gh pr checks 254 --watch=false` -> fail before fix for
  `ci/circleci: snyk-dependency-scan`; external `security/snyk (jscraik)`
  passed.
- Command: `circleci project secret list github jscraik coding-harness --json`
  -> pass; `SNYK_TOKEN` existed.
- Command: `circleci --skip-update-check config validate .circleci/config.yml`
  -> pass.
- Command: `pnpm vitest run src/lib/init/scaffold-circleci-config-template.test.ts`
  -> pass.
- Command: `pnpm docs:lint` -> pass.
- Command: `pnpm run docs:style:changed` -> pass.
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
  -> pass.
- Command: `python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py .harness/solutions/2026-05-16-circleci-snyk-delta-gate.md --json`
  -> pass after tightening the BLUF.
- Pending after patch: `gh pr checks 254 --watch=false` after push.

## Prevention

- When CircleCI Snyk fails but external GitHub Snyk passes with no manifest
  changes, classify it as a whole-repo-vs-delta gate mismatch before changing
  credentials.
- Do not remove `snyk-dependency-scan`; keep repo-run visibility in CircleCI.
- Do not set `fail-on-issues: true` unless the repository intentionally
  accepts historical vulnerability backlog as a PR-blocking condition.
- Keep live CircleCI config, scaffold template, tests, and security governance
  docs synchronized in the same change.
- Keep `.vale/styles/config/vocabularies/Harness/accept.txt` synchronized when
  vendor names used in changed governance docs are valid project vocabulary.

## Project Brain / Routing

This artifact is the primary learning record. A separate Project Brain rule is
not required yet because the current fix is a CI policy alignment rather than a
new command contract.

## Related Artifacts

- `.circleci/config.yml`
- `src/templates/circleci-config.yml`
- `docs/agents/02-tooling-policy.md`
- `docs/agents/06-security-and-governance.md`
- `docs/ci-responsibility-matrix.md`
