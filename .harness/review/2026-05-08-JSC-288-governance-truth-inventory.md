---
schema_version: 1
artifact_id: jsc-288-governance-truth-inventory-review
artifact_type: he-code-review-inventory
canonical_slug: jsc-288-governance-truth-inventory
title: JSC-288 Governance Truth Inventory
harness_stage: he-code-review
status: review-required
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
implementation_unit: IU-288-001
---

# JSC-288 Governance Truth Inventory

## Table Of Contents

- [Scope](#scope)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Inventory Method](#inventory-method)
- [Surface Inventory](#surface-inventory)
- [Seed Detail Checks](#seed-detail-checks)
- [Unknown Owners](#unknown-owners)
- [Placeholder Or Symbolic Evidence](#placeholder-or-symbolic-evidence)
- [Human Decisions Required](#human-decisions-required)
- [Blockers](#blockers)
- [Validation Notes](#validation-notes)
- [Evidence Commands](#evidence-commands)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Accepted Follow-Up Decision](#accepted-follow-up-decision)

## Scope

This artifact completes `IU-288-001` from
`.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md`.

The work is inventory-only. It does not change behavior, contracts, governed
docs, memory data, PR-template requirements, source code, or packaged skill
content.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Linear project | `coding-harness` |
| Linear milestone | `Governance Trust Repair Slice` |
| Plan unit | `IU-288-001` |
| Scope | Inventory required governance truth surfaces only. |
| Out of scope | Behavior changes, contract edits, governed docs edits, PR-template edits, memory edits, and packaged skill edits. |
| Human review | Required before `IU-288-002` starts. |

## Inventory Method

Classification model:

- `executable_policy`: enforced by a command, validator, hook, CI check, test,
  runtime gate, or schema validator.
- `canonical_human_guidance`: active human/agent guidance that remains required
  because the rule cannot yet be fully enforced mechanically.
- `generated_projection`: derived or packaged guidance whose source and drift
  check must be explicit.
- `reference_only_context`: useful background that should not be treated as a
  required execution gate.
- `fixture_or_sample`: sample or bootstrap data that may be structurally valid
  but must not satisfy operational trust on its own.
- `deprecated_or_stale`: legacy or stale material that should be deleted,
  quarantined, or removed from required paths after a replacement is accepted.

## Surface Inventory

| Path | Surface family | Primary role | Current owner | Required or optional | Enforcement path | Freshness signal | Known drift risk | Proposed disposition | Deletion or revisit condition | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `harness.contract.json` | contract | Published aggregate policy contract for branch protection, review policy, docs-gate, tooling policy, CI ownership, and memory policy. | contract/governance owner | Required | `src/lib/contract/validator-core.ts`, `src/lib/contract/policy-validators-core.ts`, `harness policy-gate --contract harness.contract.json --json`, `harness ci-ownership-gate --json`, docs-gate consumers. | `version` and active policy fields; contract validates against typed model. | Aggregate contract is broad; future bounded-context fragmentation could break compatibility if fields move before consumers are mapped. | Keep as executable policy and published aggregate. Add bounded-context ownership map in `IU-288-003` before any fragmentation. | Revisit only after compatibility proof shows all read sites can consume fragments or generated aggregate output. | High |
| `src/lib/contract/types-core.ts` | source-code | Typed mirror and default policy source for contract domains, including `DEFAULT_CONTRACT`, `DEFAULT_TOOLING_POLICY`, memory policy, docs-gate, and CI ownership types. | contract/runtime owner | Required | TypeScript typecheck, contract validators, tests under `src/lib/contract/**`. | Source imports policy constants and exports defaults; tests reference contract field behavior. | Defaults and JSON contract can diverge if schema/default changes are not landed with contract and docs updates. | Keep as executable policy source. Treat as the owned TypeScript domain for contract shape and defaults. | Revisit if contract code is split into bounded contexts with generated aggregate tests. | High |
| `.github/PULL_REQUEST_TEMPLATE.md` | workflow/gate evidence | PR checklist and review evidence contract for humans and agents. | governance/review owner | Required | PR body review, `risk-policy-gate`, review-gate expectations, human review, CodeRabbit/Codex review evidence. | Template currently names exact local gates and structured testing fields. | It requires a `memory.json` shape check that can pass placeholder bootstrap data, so it can imply stronger trust than the file proves. | Keep as canonical human guidance for PR evidence, but mark the `memory.json` line as requiring `IU-288-002` ownership decision before behavior edits. | Revisit in `IU-288-004` after replacement trust evidence is named. | High |
| `memory.json` | memory/evidence | Repo-local memory JSON file currently referenced by the PR template as required local-gate evidence. | unknown | Required by PR template today; operational status undecided | Structural `jq` check in `.github/PULL_REQUEST_TEMPLATE.md`; no freshness/provenance gate found in this unit. | `meta.version` is `1.0`, but content contains bootstrap placeholders such as `replace-with-repo-name`, `bootstrap/init`, and `2026-01-01`. | High: structurally valid placeholder data can satisfy the required PR-template check. | Do not treat as operational trust evidence until `IU-288-002` decides ownership. Candidate dispositions: fixture-only, deprecated, or replaced by `.harness/memory/LEARNINGS.md` plus Project Brain/check evidence. | Revisit immediately in `IU-288-002`; required trust must not depend on this placeholder file without a stronger freshness/provenance rule. | High |
| `.harness/memory/LEARNINGS.md` | memory/governance | Durable repo-specific append-only learning surface. | memory/governance owner | Required by repo guidance and Project Brain contract | `AGENTS.md` session/closeout guidance, `docs/agents/03-local-memory.md`, `toolingPolicy.projectBrainMemoryExtension.requiredPaths`. | Frontmatter declares schema, purpose, scope, and append-only update policy; current entry exists. | It is human-maintained Markdown; without closeout discipline it can become stale or duplicate imported learning artifacts. | Keep as canonical human guidance plus required Project Brain path. Pair with explicit closeout and promotion rules. | Revisit if Project Brain moves to a generated/indexed memory store with equivalent human-readable projection. | High |
| `.harness/knowledge/**` | Project Brain | Curated knowledge domains, hypotheses, and rules for CLI, CI, governance, and tooling. | Project Brain/governance owner | Required when Project Brain extension is enabled | `toolingPolicy.projectBrainMemoryExtension.requiredPaths`, `scripts/check-environment.sh`, `harness tooling-audit --path <repo-root>`. | `.harness/knowledge/INDEX.md` has `Last updated: 2026-05-08`; domain files exist. | Some domains have zero rules, so existence can be mistaken for maturity. Generated/manual status is mixed and not always obvious from filenames. | Keep as required Project Brain surface, but require rule freshness and ownership review before treating domain content as execution authority. | Revisit if requiredPaths are narrowed or generated from a canonical brain source. | Medium |
| `.harness/review-log.md` | review/governance | Periodic review ledger for knowledge, decisions, and quality criteria. | governance/review owner | Required by Project Brain extension | `toolingPolicy.projectBrainMemoryExtension.requiredPaths`; human review cadence. | Last review is recorded as `2026-04-27`. | Review cadence can become symbolic if no gate checks staleness or required review points. | Keep as canonical human guidance and review evidence. Add freshness expectation in later ownership work if it remains required. | Revisit if review log becomes generated from actual review artifacts or replaced by an indexed review registry. | Medium |
| `AGENTS.md` | instruction/governance | Root agent instruction surface and repository operating contract. | repo maintainers | Required | Agent instruction discovery; docs-gate and review expectations; repo workflow enforcement. | `schema_version: 1`; current text references exact gates, CI split, Project Brain, memory, and review independence. | It mixes executable requirements, human guidance, and strategic context; drift risk rises when it duplicates docs-gate and contract rules. | Keep as canonical human guidance. Use it to point to executable gates rather than expand duplicated governance prose. | Revisit if command/gate claims change or if a smaller generated instruction summary replaces duplicated detail. | High |
| `docs/agents/02-tooling-policy.md` | docs/governance | Canonical tooling and command contract reference. | tooling/governance owner | Required governed doc | docs-gate surfaces, `harness.contract.json` tooling policy, `scripts/check-environment.sh`, command wrappers. | `last_validated: 2026-05-07`; names current command contract and Project Brain extension. | High density creates duplication with `AGENTS.md`, security/governance docs, and generated skill references. | Keep as canonical reference for tooling details. Compression should link here instead of copying full command bundles elsewhere. | Revisit when tooling policy fields or wrapper behavior change. | High |
| `docs/agents/03-local-memory.md` | docs/memory | Canonical local-memory workflow and `.harness/memory/LEARNINGS.md` guidance. | memory/governance owner | Required governed doc | docs-gate, local-memory workflow, `AGENTS.md` memory layer. | `last_validated: 2026-05-08`; describes file-based and observe-state-machine workflows. | It can conflict with the PR-template `memory.json` gate unless memory surface ownership is clarified. | Keep as canonical memory workflow guidance. Use `IU-288-002` to decide how it relates to `memory.json`. | Revisit after memory ownership decision and any PR-template replacement. | High |
| `docs/agents/04-validation.md` | docs/validation | Canonical validation gate guidance and evidence reporting. | validation/governance owner | Required governed doc | docs-gate, plan-gate, `bash scripts/validate-codestyle.sh`, `bash scripts/verify-work.sh`, PR evidence. | `last_validated: 2026-04-30`; names baseline gates and PR evidence requirements. | Validation prose can become stale if commands change without docs-gate enforcing matching surfaces. | Keep as canonical validation guidance. Use it to arbitrate PR-template testing fields and closeout evidence. | Revisit when validation wrappers, plan-gate, or PR-template behavior changes. | High |
| `docs/agents/06-security-and-governance.md` | docs/governance | Canonical security and governance reference, including CI ownership, Project Brain scope, and fail-closed rules. | security/governance owner | Required governed doc | docs-gate, CI ownership contract, hook/readiness validation, human review. | `last_validated: 2026-05-07`; names `ciOwnership`, Project Brain project-local scope, and review/gate expectations. | Duplicates command and Project Brain claims with tooling policy and AGENTS; risk is contradiction during future edits. | Keep as canonical governance detail. Future compression should preserve links and remove duplicated prose only after ownership mapping. | Revisit when CI ownership, hook governance, or Project Brain required paths change. | High |
| `docs/agents/07b-agent-governance.md` | docs/governance | Agent governance merge/readiness expectations and required review artifacts. | agent-governance owner | Required governed doc | docs-gate, review-gate, PR review process, CI ownership contract. | Explicitly states missing PR review artifacts, CodeRabbit failure, and docs-gate warnings block merge. | Can become a duplicate authority beside security/governance and AI review governance if no ownership split exists. | Keep as canonical agent-governance guidance until `IU-288-003` maps ownership boundaries. | Revisit when review-gate or CodeRabbit/Codex review authority changes. | Medium |
| `docs/agents/12-ai-review-governance.md` | docs/review | CodeRabbit and AI review authority map. | review-governance owner | Required governed doc | CodeRabbit GitHub check, `.coderabbit.yaml`, branch-protection expectations, `harness verify-coderabbit`. | `last_validated: 2026-04-26`; identifies native GitHub `CodeRabbit` check and local CLI as advisory. | Risk of confusing advisory local CLI output with enforced GitHub App review if copied elsewhere. | Keep as canonical review-governance guidance. Link rather than duplicate in other docs. | Revisit when CodeRabbit workflow or required review check identity changes. | High |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | docs/reference | Rollout/reference guide for Project Brain memory-extension enforcement. | Project Brain/tooling owner | Optional/reference for this repo; required only as migration context | Human reference; validation commands listed; indirect relationship to `toolingPolicy.projectBrainMemoryExtension`. | `last_validated: 2026-04-18`; documents what changed and per-repo rollout checklist. | It can be mistaken for live required policy even though active contract truth is in `harness.contract.json`, docs, and scripts. | Mark as reference-only context unless a later unit makes it a generated/current rollout guide. | Revisit after ownership decision; delete or archive only if all unique rollout guidance is preserved elsewhere. | Medium |
| `.agents/skills/coding-harness/**` governance and memory references | packaged skill projection | Downstream skill guidance, setup commands, and governance reference material. | package/scaffold owner | Required for packaged skill behavior; generated/manual ownership unclear | Packaged skill validation scripts under `.agents/skills/coding-harness/scripts/`; downstream install/update behavior; package tests. | Files are currently modified in the working tree; reference contract validator exists. | High: packaged guidance can drift from root docs and contract if copied manually instead of generated or validated. | Keep as required packaged projection, but `IU-288-002/003` must decide whether governance/memory references are copied, generated, or manually owned. | Revisit when packaged skill generation/validation proves source mapping and update ownership. | Medium |

## Seed Detail Checks

### Pull Request Template Evidence Map

| Template line or field | Proof type | Executable proof or symbolic evidence | Inventory finding |
| --- | --- | --- | --- |
| Dedicated branch and branch-name checklist | symbolic plus review evidence | Human/PR review; branch protection requires PR flow. | Keep as required human guidance. |
| Required local gates checklist | executable plus symbolic | `bash scripts/validate-codestyle.sh`, `pnpm check`, and the current `memory.json` `jq` shape check. | First two commands are executable; `memory.json` is symbolic until freshness/provenance ownership is decided. |
| Hook environment sanitization checklist | executable plus human evidence | `scripts/validate-codestyle.sh` is the named enforcement point. | Keep as required evidence because docs identify the wrapper as the governed proof surface. |
| CodeRabbit and Codex review checklist | external/review evidence | CodeRabbit GitHub check plus independent Codex review artifact or explicit waiver. | Keep; owner is review governance. |
| CodeRabbit Semgrep checklist | external/security evidence | CodeRabbit Semgrep disposition in PR; Semgrep Cloud remains separate required check. | Keep; evidence must distinguish CodeRabbit Semgrep from Semgrep Cloud. |
| North-star learning loop checklist | executable or explicit `n.a.` | `harness learnings gate`, `harness review-context`, and `harness north-star-feedback`. | Keep; do not require when `.harness/learnings/coderabbit.local.json` is absent, but require explicit `n.a.` reason. |
| Merge blocked until required checks pass | external/branch protection evidence | Branch protection and CI required checks. | Keep as human guidance mapped to `harness.contract.json` and required-check docs. |
| Delete branch/worktree after merge | human cleanup evidence | Human/operator closeout. | Optional operational cleanup; not executable policy in this unit. |

### AGENTS Governance Claim Map

| Claim family | Mapped authority | Inventory finding |
| --- | --- | --- |
| Runtime/toolchain and baseline gates | `package.json`, `pnpm-lock.yaml`, `scripts/validate-codestyle.sh`, `scripts/verify-work.sh`, `docs/agents/02-tooling-policy.md`, `docs/agents/04-validation.md`. | Required canonical human guidance with executable command paths. |
| CI ownership split | `harness.contract.json` `ciOwnership`, `.harness/ci-required-checks.json`, `docs/agents/06-security-and-governance.md`, `docs/agents/12-ai-review-governance.md`. | Required; keep contract as executable source and docs as human guidance. |
| Project Brain and memory | `toolingPolicy.projectBrainMemoryExtension.requiredPaths`, `.harness/memory/LEARNINGS.md`, `.harness/knowledge/**`, `.harness/review-log.md`, `docs/agents/03-local-memory.md`. | Required; ownership and freshness need `IU-288-002`. |
| Review independence | CodeRabbit GitHub check, Codex review artifact, `docs/agents/12-ai-review-governance.md`, PR template. | Required human/external evidence; coding agent cannot self-approve. |
| Docs-gate synchronization | `docsGatePolicy`, docs-gate command, `docs/agents/04-validation.md`, `docs/agents/06-security-and-governance.md`. | Required for governed changes; avoid duplicating prose before `IU-288-005`. |

### Project Brain Rule-ID Policy

| Surface | Rule-ID evidence | Inventory finding |
| --- | --- | --- |
| `.harness/knowledge/governance/rules.md` | Active rules `R-001`, `R-002`, and `R-003`; promotion guide requires unique `R-NNN` identifiers. | Rule-ID policy exists for governance domain. Other domains may have zero rules, so path existence is not enough to prove domain maturity. |
| `.harness/knowledge/governance/knowledge.md` | `Last verified: 2026-05-08`, `Verification source: automated`, `Confidence: medium`, `Owner: agent-ops`. | Strongest current Project Brain freshness evidence is governance-domain-specific, not global to every `.harness/knowledge/**` file. |

## Unknown Owners

| Surface | Unknown or disputed ownership | Why it matters | Required next decision |
| --- | --- | --- | --- |
| `memory.json` | Operational owner is unknown. | The file passes the current PR-template structural check while containing placeholder bootstrap data. | `IU-288-002` must decide fixture-only, deprecated, operational with freshness proof, or removed from required trust. |
| `.harness/knowledge/**` | Generated/manual ownership is not explicit per file. | Required path presence does not prove the knowledge is fresh, generated, or operationally reviewed. | `IU-288-002` should assign Project Brain ownership and freshness expectations. |
| `.agents/skills/coding-harness/**` governance references | Projection owner is unclear for governance and memory text. | Downstream packaged guidance can drift from root docs and contract. | `IU-288-003` or later implementation must name source, projection, and drift check. |
| `docs/agents/20-project-brain-memory-extension-rollout.md` | Reference-only versus canonical rollout guide is undecided. | If treated as canonical, it needs freshness and ownership; if reference-only, it should not block runtime trust. | Decide during governance prose compression. |

## Placeholder Or Symbolic Evidence

| Surface | Evidence | Impact |
| --- | --- | --- |
| `memory.json` | Contains `replace-with-repo-name`, `bootstrap/init`, `Harness memory baseline initialized`, and `2026-01-01` placeholder dates. | It can satisfy the PR-template `jq` shape check without proving current memory bootstrap, search, or closeout behavior. |
| `.harness/knowledge/**` | Required path existence is backed by the contract, but some domains report `0 rules`. | Existence checks prove Project Brain structure, not necessarily useful or current rules. |
| `.harness/review-log.md` | Last review is recorded, but no automated staleness gate was found in this unit. | It is valid review evidence only when humans keep it current or a future freshness gate is added. |
| `.agents/skills/coding-harness/**` | Packaged references have validators, but ownership for governance/memory text is not yet explicit. | Downstream skill behavior can look verified while text remains stale unless projection rules are named. |

## Human Decisions Required

1. Decide `memory.json` ownership before changing the PR template, validators, or
   memory gates.
2. Decide whether `.harness/knowledge/**` is required executable evidence,
   curated human guidance, generated projection, or mixed Project Brain state.
3. Decide the bounded contract ownership map before moving or splitting any
   `harness.contract.json` fields.
4. Decide whether the packaged skill governance references are generated from
   root docs, manually owned, or validated projections.
5. Decide whether `docs/agents/20-project-brain-memory-extension-rollout.md`
   remains a live rollout guide or becomes reference-only history.

## Blockers

No seed surface was unreadable during this inventory pass.

Implementation remains blocked beyond `IU-288-001` until ownership decisions are
reviewed. In particular, behavior-changing edits to `.github/PULL_REQUEST_TEMPLATE.md`,
`memory.json`, `harness.contract.json`, `src/lib/contract/**`, `docs/agents/**`,
or `.agents/skills/coding-harness/**` should not proceed until the corresponding
decision/design units are accepted.

## Validation Notes

Validation for this unit should stay inventory-scoped:

- HE artifact identity lint on this file.
- HE frontmatter safety lint on this file.
- HE Linear traceability lint on this file.
- Markdown lint on this file and the plan.
- `git diff --check` scoped to this file and the plan.
- Reviewer seed coverage spot-check.

No runtime behavior changed, so source tests and full `pnpm check` are not
required for this inventory artifact alone unless repository policy is applied
at final PR handoff.

## Evidence Commands

Commands used during inventory:

```bash
git status --short --branch
rg -n "IU-288|Implementation Unit|Governance Truth|Status|Evidence|Review|Complete|Incomplete|reopened|block" .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
find .harness/evidence/jsc-288-phase-heartbeat -maxdepth 1 -type f -print
jq '.redaction // .redaction_status // .status // .' .harness/evidence/jsc-288-phase-heartbeat/redaction-report.json
jq '{branchProtection, reviewPolicy, docsGatePolicy: {enabled:.docsGatePolicy.enabled, mode:.docsGatePolicy.mode, surfaces_count:(.docsGatePolicy.surfaces|length), rules_count:(.docsGatePolicy.rules|length)}, toolingPolicy: {readinessScriptPath:.toolingPolicy.readinessScriptPath, projectBrainMemoryExtension:.toolingPolicy.projectBrainMemoryExtension}, ciOwnership, memoryPolicy}' harness.contract.json
sed -n '1,260p' src/lib/contract/types-core.ts
sed -n '1,240p' .github/PULL_REQUEST_TEMPLATE.md
sed -n '1,220p' .harness/memory/LEARNINGS.md
sed -n '1,160p' memory.json
sed -n '1,220p' .harness/knowledge/INDEX.md
sed -n '1,220p' .harness/review-log.md
rg -n "Project Brain|\\.harness/README|Tracked secondary context|toolingPolicy.projectBrainMemoryExtension|ciOwnership|CodeRabbit|validate-codestyle|Local Memory" AGENTS.md docs/agents/02-tooling-policy.md docs/agents/03-local-memory.md docs/agents/04-validation.md docs/agents/06-security-and-governance.md docs/agents/07b-agent-governance.md docs/agents/12-ai-review-governance.md docs/agents/20-project-brain-memory-extension-rollout.md
rg -n "memory|governance|Project Brain|LEARNINGS|review|contract|docs-gate|policy-gate|required|canonical|generated|owner" .agents/skills/coding-harness/SKILL.md .agents/skills/coding-harness/references/*.md
```

Linear state checked:

- Project: `coding-harness`
- Milestone: `Governance Trust Repair Slice`
- Milestone id: `b4e2bb64-b22b-4f71-8b4a-620474c152e2`
- Progress: `0`

Collector bundle checked:

- `.harness/evidence/jsc-288-phase-heartbeat/harness-engineering-evidence.json`
- `.harness/evidence/jsc-288-phase-heartbeat/skillify-candidates.json`
- `.harness/evidence/jsc-288-phase-heartbeat/index.json`
- `.harness/evidence/jsc-288-phase-heartbeat/redaction-report.json`
- `.harness/evidence/jsc-288-phase-heartbeat/session-collector.json`
- Redaction status: `applied=true`

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status | Evidence |
| --- | --- | --- |
| `JSC-288` | `SA-288-001` | Covered, review required | Inventory artifact exists with required classification columns and seed coverage. |
| `JSC-288` | `SA-288-002` | Covered by follow-up decision | Memory surfaces are classified here; accepted ownership decision is recorded in `.harness/review/2026-05-08-JSC-288-memory-ownership-decision.md`. |
| `JSC-288` | `SA-288-009` | Covered, review required | Required seed surfaces are all inventoried or explicitly marked for ownership decision. |
| `JSC-288` | `SA-288-011` | Covered | This unit made no behavior-changing edits and only writes this inventory artifact. |

## Accepted Follow-Up Decision

After this inventory, the accepted memory ownership recommendation is to replace
the PR-template `memory.json` proof with Project Brain,
`.harness/memory/LEARNINGS.md`, and north-star learning-loop evidence that proves
current operational memory instead of bootstrap placeholder shape.

The accepted decision artifact is
`.harness/review/2026-05-08-JSC-288-memory-ownership-decision.md`.
