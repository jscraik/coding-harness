---
title: OpenSSF OSPS Baseline and Scorecard Adoption Plan
type: feat
status: active
date: 2026-04-09
issue: JSC-112
plan_id: feat-openssf-osps-baseline-scorecard
---

# OpenSSF OSPS Baseline and Scorecard Adoption Plan

## Enhancement Summary

**Planned on:** 2026-04-09  
**Issue:** `JSC-112`  
**Mode:** `standard-plan`  
**Key areas improved:** explicit baseline declaration, measurable scorecard floor policy, CI-backed regression enforcement, and public status visibility.

- Declares target OSPS posture for this repository and tracks current status in a control matrix.
- Adds a continuous OpenSSF Scorecard workflow for pull requests, `main`, and scheduled runs.
- Adds policy-floor regression checks for aggregate and key Scorecard checks with warn/fail behavior.
- Adds visible security posture references in repository docs.

## Table of Contents
- [Overview](#overview)
- [Problem Frame](#problem-frame)
- [Requirements Trace](#requirements-trace)
- [Scope Boundaries](#scope-boundaries)
- [Implementation Units](#implementation-units)
- [Validation Plan](#validation-plan)
- [Risks and Mitigations](#risks-and-mitigations)
- [Execution Ledger](#execution-ledger)
- [Sources and References](#sources-and-references)

## Overview

Implement `JSC-112` by defining a concrete OpenSSF OSPS baseline target and enforcing OpenSSF Scorecard as a recurring, machine-checked security floor for this repository.

## Problem Frame

Security posture expectations were partially documented but not represented as a single measurable baseline with continuous score tracking and explicit key-check regression handling. This created avoidable ambiguity for maintainers and reviewers.

## Requirements Trace

- **R1:** Declare target OSPS baseline level and current status.
- **R2:** Publish a control matrix linking repository evidence to OSPS controls.
- **R3:** Run OpenSSF Scorecard continuously in CI.
- **R4:** Fail or warn on key-check regressions with explicit policy floors.
- **R5:** Surface posture status visibly in repository docs.

## Scope Boundaries

- In scope:
  - OSPS target and status documentation.
  - Scorecard CI workflow and artifact retention.
  - Scorecard regression policy and evaluator script.
  - README status references.
- Out of scope:
  - Immediate branch-protection wiring changes for new check names.
- Organization-wide policy rollout changes outside `coding-harness`.

## Implementation Units

- [x] **P1: Baseline declaration and OSPS control matrix**
  - Files: `docs/security/2026-04-09-openssf-osps-baseline-status.md`
  - Requirements: `R1`, `R2`
- [x] **P2: Continuous OpenSSF Scorecard CI integration**
  - Files: `.github/workflows/openssf-scorecard.yml`
  - Requirements: `R3`
- [x] **P3: Policy-floor regression evaluator**
  - Files: `security/openssf-scorecard-policy.json`, `scripts/check-scorecard-regressions.mjs`
  - Requirements: `R4`
- [x] **P4: Visible status references and governance docs sync**
  - Files: `README.md`, `docs/agents/02-tooling-policy.md`, `docs/agents/06-security-and-governance.md`
  - Requirements: `R5`

## Validation Plan

- `bash scripts/validate-codestyle.sh --fast`
- `bash scripts/validate-codestyle.sh`
- `pnpm check`
- `bash scripts/verify-work.sh`

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Scorecard output schema drift | Fail closed in regression script when expected fields are missing. |
| Noisy failures on pull requests | Use `warn` mode on `pull_request`, `fail` mode on `main` and scheduled runs. |
| Workflow drift from policy docs | Keep policy file and docs in the same change set; call out in `docs/agents` governance docs. |

## Execution Ledger

STEP_ID | status (pending|in_progress|completed) | owner | evidence
P1 | completed | codex | `docs/security/2026-04-09-openssf-osps-baseline-status.md` added with target level and OSPS control matrix.
P2 | completed | codex | `.github/workflows/openssf-scorecard.yml` added for pull request, `main`, and scheduled scorecard runs.
P3 | completed | codex | `security/openssf-scorecard-policy.json` and `scripts/check-scorecard-regressions.mjs` added for threshold-based warn/fail enforcement.
P4 | completed | codex | `README.md`, `docs/agents/02-tooling-policy.md`, and `docs/agents/06-security-and-governance.md` updated with scorecard posture references.

## Sources and References

- Linear issue: `JSC-112`
- OpenSSF OSPS Baseline v2026.02.19
- OpenSSF Scorecard action docs
- `docs/ai-assistant-security-policy.md`
