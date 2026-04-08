# Docs Gate Rollout and Operations

## Table of Contents

- [Overview](#overview)
- [Verify-Work Lifecycle Alignment](#verify-work-lifecycle-alignment)
- [Rollout Phases](#rollout-phases)
- [Promotion Thresholds](#promotion-thresholds)
- [Demotion and Rollback Triggers](#demotion-and-rollback-triggers)
- [Metrics Tracking](#metrics-tracking)
- [Operator Runbook](#operator-runbook)
- [Artifact Interpretation](#artifact-interpretation)
- [Downstream Adoption](#downstream-adoption)

## Overview

This document defines the rollout procedures for promoting `docs-gate` from advisory to required posture, as well as operational guidance for maintaining healthy enforcement.

Tracked workflow artifact families are part of the governed surface for this repository. In addition to governance, tooling/runtime, and architecture-context docs, `docs-gate` now tracks workflow-authoritative route/runbook docs such as `docs/agents/01-instruction-map.md`, `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/10-agent-testing-gates.md`, `docs/agents/13-linear-production-workflow.md`, `docs/agents/14-docs-gate-rollout.md`, `docs/agents/15-context-integrity-compact.md`, and `docs/agents/16-linear-production-compact.md`, alongside compound-engineering artifacts in `docs/adr/`, `docs/specs/`, `docs/plans/`, and `docs/brainstorms/`.

These repo-local workflow documents are the `coding-harness` mirrors for higher-level compound-routing guidance such as `compound-engineering-router`: the gate verifies the in-repo route map, validation runbooks, and release/testing workflow docs that operators actually execute from this repository, rather than trying to enforce an external absolute-path skill file from CI.

Current posture in this repository:
- **Mode**: `advisory` (monitoring, non-blocking)
- **Target**: `required` (blocking on drift)
- **Phase**: Evidence collection

## Verify-Work Lifecycle Alignment

Docs-gate rollout decisions should stay aligned with the current `verify-work` lifecycle:

- Run-state path: `.harness/runs/<run-id>/`.
- Required artifacts: `run.json`, `gates/<gate-id>.json`, and `summary.json`.
- Fast-mode classes: `read_only_parallel` and `serial_guarded`.
- Resume command: `bash scripts/verify-work.sh --resume-from <gate-id>`.
- Resume compatibility tuple: `repoRoot`, `providerClass`, `schemaVersion`, `contractVersion` with reused gates already `passed`.

If rollout changes alter gate identity or compatibility fields, rerun `verify-work` and `harness doctor` before promoting docs-gate posture.

## Rollout Phases

### Phase 1: Shadow/Advisory (Current)

- `docs-gate` runs in CI on every PR and merge group
- Artifacts are uploaded on every terminal path
- Findings are logged but do not block merge
- Operator reviews artifacts to establish baseline quality

### Phase 2: Required (Harness Repo)

Promotion criteria:
- At least 30 evaluated harness PRs across 7 consecutive days
- False-positive rate below 5%
- No unresolved `trust_mismatch` bugs
- Maintainer sign-off recorded

### Phase 3: Required (Downstream)

Promotion criteria:
- At least 50 evaluated downstream PRs across 3+ upgraded repos over 14 days
- False-positive rate below 3%
- Bootstrap-gap rate below 10%
- Verified downgrade path documented and tested

## Promotion Thresholds

| Phase Transition | PR Count | Window | False-Positive Rate | Additional Conditions |
|------------------|----------|--------|---------------------|----------------------|
| 1 → 2 | 30 | 7 days | < 5% | No unresolved trust-mismatch, maintainer sign-off |
| 2 → 3 | 50 | 14 days | < 3% | Bootstrap-gap < 10%, downgrade path verified |

### Required Evidence for Promotion

Before each promotion, capture:

1. **Metrics snapshot**: Export from `artifacts/consistency-gate/docs-gate-report.json` files
2. **Category breakdown**: Which rules produce the most findings
3. **Resolution rate**: Percentage of findings resolved before merge
4. **Sign-off record**: Dated maintainer approval with rationale

## Demotion and Rollback Triggers

### Automatic Demotion Conditions

Freeze or demote to advisory immediately if any of the following occur:

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Policy-weakening bypass | Any verified instance | Freeze promotion, investigate |
| False-positive blocking | 2+ in 24 hours | Demote to advisory |
| Blocking failure rate | > 15% across 20 recent evaluations OR 24-hour window with 10+ evaluations | Demote to advisory |
| Trust-mismatch regression | Any unresolved recurring event | Halt promotion, fix source loading |
| Required-check rename drift | Any silent rename | Demote, restore stable identity |

### Demotion Procedure

1. Update `harness.contract.json` `docsGatePolicy.mode` to `"advisory"`
2. Update `.circleci/config.yml` `pr-pipeline` job `docs-gate` step `--mode` flag to `advisory`
3. Document the triggering event in this file under "Rollout History"
4. Notify contributors of the temporary posture change
5. Fix root cause before re-promoting

## Metrics Tracking

### Key Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| False-positive rate | Findings that were incorrect or overly strict / Total findings | Phase 1: < 5%, Phase 2+: < 3% |
| Bootstrap-gap rate | Evaluations that could not determine policy / Total evaluations | < 10% |
| Trust-mismatch count | Failures to load protected truth | 0 unresolved |
| Blocking failure rate | Findings that blocked merge / Total evaluations | < 15% |
| Resolution rate | Findings fixed before merge / Total findings | Track for quality |

### Capturing Metrics

From each `docs-gate-report.json`:

```bash
# Extract summary metrics
cat artifacts/consistency-gate/docs-gate-report.json | jq '{
  date: .generated_at,
  outcome: .outcome,
  finding_count: .summary.finding_count,
  error_count: .summary.error_count,
  warning_count: .summary.warning_count,
  categories: .categories
}'
```

### Aggregation

Store aggregated metrics in `ops/metrics/docs-gate/rollout-metrics.jsonl`:

```json
{"date":"2026-03-10","pr_number":123,"outcome":"ok","finding_count":0,"false_positive":false}
{"date":"2026-03-10","pr_number":124,"outcome":"drift_detected","finding_count":2,"false_positive":false,"categories":["ci_workflow"]}
```

## Operator Runbook

### Daily Operations

1. **Check artifact uploads**: Verify `docs-gate-report.json` is present in CI artifacts
2. **Review findings**: Scan for unexpected categories or high-volume rules
3. **Track false positives**: Document any incorrect findings for tuning

### Weekly Review

1. **Metrics summary**: Calculate rolling false-positive and blocking-failure rates
2. **Category analysis**: Identify which change categories produce the most findings
3. **Promotion readiness**: Assess if threshold criteria are met

### Promotion Checklist

Before promoting to required mode:

- [ ] Threshold window met (days/PRs)
- [ ] False-positive rate below target
- [ ] No unresolved trust-mismatch events
- [ ] Bootstrap-gap rate acceptable (downstream only)
- [ ] Downgrade path documented and tested (downstream only)
- [ ] Maintainer sign-off recorded
- [ ] Rollout announcement drafted for contributors

### Incident Response

**Finding**: Unexpected `trust_mismatch` errors
- Check CircleCI `pr-pipeline` job logs for trusted-base loading errors
- Verify `.circleci/config.yml` `pr-pipeline` job has correct `GH_TOKEN` / `GITHUB_PERSONAL_ACCESS_TOKEN` wiring
- Review recent changes to workflow or contract loading

**Finding**: High false-positive rate on specific rule
- Review rule definition in `harness.contract.json`
- Consider adjusting severity or rule scope
- Document tuning decision

**Finding**: Bootstrap gaps in downstream repos
- Verify `init --update` was run after package upgrade
- Check contract version compatibility
- Provide clear remediation instructions

## Artifact Interpretation

### Report Schema

```json
{
  "schemaVersion": "docs-gate-report/v1",
  "command": "docs-gate",
  "mode": "advisory",
  "status": "success",
  "outcome": "drift_detected",
  "generated_at": "2026-03-10T12:00:00Z",
  "summary": {
    "finding_count": 2,
    "error_count": 1,
    "warning_count": 1
  },
  "findings": [...]
}
```

### Outcome Meanings

| Outcome | Meaning | Required Mode Action |
|---------|---------|---------------------|
| `ok` | No drift, all required docs present | Pass |
| `drift_detected` | Missing or stale required documentation | Fail (exit 10) |
| `bootstrap_gap` | Missing wiring/policy for evaluation | Fail (exit 11) |
| `trust_mismatch` | Cannot load protected truth sources | Fail (exit 12) |
| `policy_error` | Invalid contract or rule schema | Fail (exit 13) |
| `runtime_error` | Evaluation failure | Fail (exit 14) |

### Finding Categories

- `cli_surface`: Command/help surface changes
- `contract_policy`: Contract policy changes
- `ci_workflow`: CI workflow changes
- `branch_protection_or_required_checks`: Required check changes
- `init_scaffolding`: Init/template changes
- `tooling_runtime`: Local toolchain, readiness, and hook policy changes
- `architecture_context`: Diagram context and architecture artifact changes
- `workflow_authority`: Routing indexes, validation and change-control runbooks, rollout docs, and compact operational workflow guides
- `adr_artifact`: Architecture decision record artifacts under `docs/adr/`
- `spec_artifact`: Specification artifacts under `docs/specs/`
- `plan_artifact`: Execution plan artifacts under `docs/plans/`
- `brainstorm_artifact`: Brainstorm artifacts under `docs/brainstorms/`
- `agent_governance`: Agent governance changes
- `unknown_governance_change`: Unmatched governance-sensitive changes

## Downstream Adoption

### Upgrade Path

For repositories upgrading to docs-gate enforcement:

1. **Install/update harness package**:
   ```bash
   npm install -g @brainwav/coding-harness@latest
   # or
   pnpm add -D @brainwav/coding-harness@latest
   ```

2. **Preview the safe upgrade path**:
   ```bash
   harness upgrade --dry-run
   ```
   This previews the additive upgrade path for existing installs.

3. **Apply the upgrade**:
   ```bash
   harness upgrade
   ```
   This adds `docsGatePolicy` defaults and workflow wiring without re-rendering tracked templates wholesale.

4. **Verify configuration**:
   - Check `harness.contract.json` has `docsGatePolicy` section
   - Verify workflow includes docs-gate job
   - Confirm local hooks if desired

5. **Start in advisory mode**:
   - Set `docsGatePolicy.mode` to `"advisory"`
   - Monitor for 1-2 weeks before considering required mode

### Bootstrap Gap Remediation

If downstream repo shows `bootstrap_gap`:

1. Check contract version: must be 1.3.0+ for `docsGatePolicy`
2. Run `harness upgrade --dry-run` to preview additive contract changes
3. Apply updates: `harness upgrade`
4. If tracked baseline files are missing, re-scaffold them with `harness init --update`
5. Verify: `harness docs-gate --mode advisory --trigger local`

### Expected Timeline

- **Week 1**: Package upgrade, init update, advisory mode monitoring
- **Week 2-3**: Evaluate false-positive rate, tune rules if needed
- **Week 4+**: Consider promotion to required mode if thresholds met

## Rollout History

| Date | Phase | Event | Evidence |
|------|-------|-------|----------|
| 2026-03-10 | 1 | Initial advisory deployment | Implementation complete, docs updated |

---

**Owner**: Implementation team
**Review cadence**: Weekly during rollout, monthly after stabilization
**Contact**: Linear project or GitHub discussion
