---
title: OpenSSF OSPS Baseline Status
date: 2026-04-09
status: active
version: 2026.02.19
last_validated: 2026-04-18
---

# OpenSSF OSPS Baseline Status

## Summary

This repository targets **OpenSSF OSPS Baseline Level 2** as the minimum posture target for `coding-harness`.

Current posture on 2026-04-09: **In Progress**.

- Baseline level target is now explicit and versioned.
- Scorecard floor policy is codified under `security/openssf-scorecard-policy.json`.
- Continuous scorecard execution is wired through `.github/workflows/openssf-scorecard.yml`.
- Remaining work is focused on raising key-check scores where floors are not yet met.

## Table of Contents
- [Scope](#scope)
- [Target Baseline](#target-baseline)
- [Control Matrix](#control-matrix)
- [Scorecard Policy](#scorecard-policy)
- [Operational Cadence](#operational-cadence)
- [Open Gaps](#open-gaps)
- [References](#references)

## Scope

This status sheet tracks repository-level controls and evidence for OSPS Baseline v2026.02.19 alignment. It is intentionally evidence-linked so reviewers can verify each row from repository artifacts.

## Target Baseline

- **Target:** OSPS Baseline Level 2
- **Version:** 2026.02.19
- **Status:** In Progress
- **Owner:** `coding-harness` maintainers
- **Tracking issue:** `JSC-112`

## Control Matrix

| OSPS control | Requirement summary | Repository evidence | Status |
| --- | --- | --- | --- |
| OSPS-AC-02 | Protected default branch with required checks and review controls | `harness.contract.json` (`branchProtection`), `CONTRIBUTING.md` branch policy | Partial |
| OSPS-AC-03 | Review independence and merge gating are enforced | `harness.contract.json` (`reviewPolicy.enforceReviewerIndependence`), PR template checklist | Met |
| OSPS-AC-04 | Access and auth expectations for mutative automation are documented | `docs/agents/06-security-and-governance.md`, `docs/ai-assistant-security-policy.md` | Met |
| OSPS-BR-06 | Security policy is present and maintained with review cadence | `docs/ai-assistant-security-policy.md` | Met |
| OSPS-DO-02 | Dependency and vulnerability checks are run in CI | `.github/workflows/secret-scan.yml`, `pnpm audit` contract in `package.json` | Partial |
| OSPS-QA-01 | Defined verification gate sequence exists and is auditable | `scripts/validate-codestyle.sh`, `scripts/verify-work.sh`, `docs/agents/04-validation.md` | Met |
| OSPS-GV-01 | Security governance ownership and escalation paths are explicit | `docs/agents/06-security-and-governance.md`, `AGENTS.md` | Met |
| OSPS-GV-03 | Scorecard-based posture tracking and regression handling is active | `.github/workflows/openssf-scorecard.yml`, `security/openssf-scorecard-policy.json`, `scripts/check-scorecard-regressions.mjs` | In Progress |

## Scorecard Policy

Scorecard regression floors are defined in `security/openssf-scorecard-policy.json` and evaluated by `scripts/check-scorecard-regressions.mjs`.

Enforcement mode:

- `pull_request`: `warn` (signal without blocking)
- `push` to `main` and `schedule`: `fail` (fail-closed)

## Operational Cadence

- Scorecard runs on every pull request.
- Scorecard runs on every push to `main`.
- Scorecard runs on a weekly schedule (`Monday 05:17 UTC`).
- Scorecard JSON artifacts are retained in workflow artifacts for audit and trend comparison.

## Open Gaps

1. Raise and stabilize key scorecard checks below policy floors to move `GV-03` to `Met`.
2. Decide whether `openssf-scorecard` should become a required branch-protection check after stability period.
3. Add quarterly posture review to governance cadence once two full scorecard cycles are complete.

## References

- OpenSSF OSPS Baseline: <https://baseline.openssf.org/>
- OpenSSF Scorecard: <https://securityscorecards.dev/>
- Tracking issue: <https://linear.app/jscraik/issue/JSC-112/adopt-openssf-osps-baseline-20260219-and-scorecard-as-the-measurable>
