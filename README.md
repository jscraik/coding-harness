---
doc_schema: coding-harness-doc/v1
doc_type: product
authority: canon
canon_class: canonical
distribution: source-only
audience: [human-operator, coding-harness-maintainer, codex-agent]
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-07-31
review_cadence: quarterly
maintenance_trigger: [product-surface-change, install-workflow-change, release-contract-change]
semver_impact: minor
validated_by: [pnpm docs:lifecycle]
depends_on: [ARCHITECTURE.md, docs/README.md, harness.contract.json]
---

# SynAIpse

SynAIpse is a small delivery harness for AI-assisted repository work. It helps
an agent understand the named task, take one useful action, run repository
proof, and report local and hosted truth separately. It is not an agent runtime
or a substitute for independent review.

## Start here

Use the job that matches the immediate need.

| Job | Command | Result |
| --- | --- | --- |
| Orient | `harness next --json` | One task-first, read-only next action. |
| Diagnose | `harness check --json` | Fast local health and an actionable failure. |
| Install | `harness init --minimal --dry-run --json` | One-file preview with no surprise writes. |
| Verify | `harness verify-work --fast` | Repository-native focused proof. |
| Close out | `harness pr-closeout --pr <number> --json` | Separate PR, CI, review, finding, and merge truth. |

The [CLI reference](./docs/cli-reference.md) is the complete routine command
catalogue. Internal and expert operations are intentionally absent from the
default journey and require a named consumer or task scope.

## Install

Install the published CLI when you need it outside this source checkout:

```bash
pnpm add -g @brainwav/coding-harness
harness next --json
```

For a source checkout, use the current-tree probe while developing, or build
before exercising the package-facing binary:

```bash
node --import tsx src/cli.ts next --json
pnpm build
pnpm exec harness next --json
```

Preview installation before any writes:

```bash
harness init --minimal --dry-run --json
```

Minimal install creates only `harness.contract.json`. Its compact contract
explicitly selects no CI checks or review policy; it does not infer a workflow,
memory system, docs site, hooks, tracker, or governance pack. Use
`harness contract init --preset standard --force` only when a repository
chooses that broader policy.

## Verify and close out

Use the repository's own focused checks first. `verify-work --fast` keeps
Local Memory out of routine execution: optional mode does not invoke its helper
or daemon and does not block repository proof. Use
`bash scripts/codex-preflight.sh --stack auto --mode required` only for an
explicit Local Memory diagnostic or acceptance lane. `verify-work --fast`
reports local validation only. It does not establish a pull request's CI,
review, approval, merge, release, or deployment state.

After a PR exists, `pr-closeout` reports those external lanes separately. It
does not approve, merge, publish, or release a change.

## Maintainers

Read [AGENTS.md](./AGENTS.md), then [CODESTYLE.md](./CODESTYLE.md). The
[CLI reference](./docs/cli-reference.md) is the checked command catalogue;
[contributor validation](./docs/agents/04-validation.md) owns broader gates.
Keep the stable product surface small and move unselected expert capability out
of the routine path. Keep the truth-bounded recovery status in
[`docs/roadmap/agent-first-status.md`](./docs/roadmap/agent-first-status.md)
and its weekly cadence entry in `harness.contract.json` current together.
Routine corrections stay local, or record `no_system_change` with the reason,
checked scope, and no-durable-destination decision; promote shared guidance only
for a contradictory contract, a crossed safety boundary, or recurrence across
independent work.

## Claims boundary

Local command output and tests prove only their recorded local behavior.
GitHub PR state, CI, review threads, approvals, merge, package publication,
and release each require current evidence from their authoritative system.
