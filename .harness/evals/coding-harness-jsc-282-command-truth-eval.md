# JSC-282 Command Truth Eval

## Table Of Contents

- [Executive Eval Summary](#executive-eval-summary)
- [Evaluated Slice](#evaluated-slice)
- [Linear Definition of Done Status](#linear-definition-of-done-status)
- [Linear Backlink Map](#linear-backlink-map)
- [Source Artifact Trace](#source-artifact-trace)
- [Functional Validation Results](#functional-validation-results)
- [Eval Gate Matrix](#eval-gate-matrix)
- [Drift Validation](#drift-validation)
- [Architecture Integrity Check](#architecture-integrity-check)
- [Routing Determinism Check](#routing-determinism-check)
- [Context Load Check](#context-load-check)
- [Agent-Native Check](#agent-native-check)
- [Governance Simplicity Check](#governance-simplicity-check)
- [Moat Protection Check](#moat-protection-check)
- [Proof Artifacts](#proof-artifacts)
- [Failures / Regressions](#failures--regressions)
- [Linear Completion Recommendation](#linear-completion-recommendation)
- [Follow-Up Work](#follow-up-work)
- [Core / ADR Update Recommendation](#core--adr-update-recommendation)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Eval Summary

Status: pass for JSC-282 source-command behavior and durable closure packaging.
Linear Completion Recommendation: Complete with follow-up.
Primary Blockers: none for JSC-282 source-command closure.
Confidence: high for source behavior, medium for packaged/install behavior
because packaged parity is intentionally deferred to JSC-283.

JSC-282 is source-command ready to unblock JSC-283. The implementation proves
the working-tree command cockpit behavior, keeps expert discovery available
through explicit expert paths, validates `.harness/plan` architecture plan
handling, and records residual command-documentation drift instead of hiding it.

This eval does not prove packaged binary, global install, installed downstream
skill, GitHub App, Linear, or full E2E behavior. Those remain JSC-283 or
credential-gated follow-up proof.

## Evaluated Slice

Linear Project: coding-harness.
Linear Milestone: Agent Cockpit Compression Slice.
Linear Parent Issue: JSC-282.
Linear Sub-Issues: none identified in local artifacts.
Refactor Program: none directly mapped.
Plugin Harness Engineering Spec: not present for this slice.
Affected Files/Modules:

- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/command-registry.ts`
- `src/lib/cli/command-registry.test.ts`
- `src/cli.test.ts`
- `src/lib/plan-gate/detector-core.ts`
- `src/lib/plan-gate/types.ts`
- `src/commands/plan-gate.test.ts`
- `.agents/skills/coding-harness/SKILL.md`
- `.agents/skills/coding-harness/references/contract.yaml`
- `.agents/skills/coding-harness/references/agent-install-guide.md`
- `.agents/skills/coding-harness/references/agent-install.json`
- `.agents/skills/coding-harness/references/setup-and-commands.md`
- `docs/agents/04-validation.md`
- `docs/cli-reference.md`
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
- `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`
- `.harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md`
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`

Affected Workflows: first-contact command routing, public agent command catalog,
expert command discovery, plan-gate source validation, skill install guidance,
and JSC-283 package/install handoff.

Related ADRs: none required by this eval.
Related Core Invariants: deterministic routing, low first-contact context load,
explicit expert widening, eval-backed closure, no package/install overclaim.

## Linear Definition of Done Status

Artifact Path: `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`.
Definition of Done Status: satisfied for the source-command slice.
Closure Safety: safe to close JSC-282 only as source-command complete, with
JSC-283 left open for packaged binary and installed skill parity.

The plan frontmatter now uses `status: complete`, and `.harness/evals/**.md` is
trackable so the closure proof can be recovered by future agents from git.

## Linear Backlink Map

Linear Project: coding-harness.
Linear Milestone: Agent Cockpit Compression Slice.
Linear Parent Issue: JSC-282.
Linear Sub-Issues: none found.
Linear Status Recommendation: mark JSC-282 complete after attaching or linking
this eval and confirming JSC-283 remains the packaged/install proof target.
Proof Artifact Links:

- `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`
- `.harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md`
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`

Missing Identifiers: no local child issue identifiers found.
Traceability Repair: none required for JSC-282 source-command closure.

## Source Artifact Trace

Linear Plan:
`.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`.

Refactor Program: none.

Plugin HE Spec: none.

ADRs: none directly required.

Core Invariants: deterministic routing, context compression, agent-operating
rules, and eval-backed closure are applied as operating constraints from the
repository harness layer.

Other Source Artifacts:

- `.harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md`
- `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
- `docs/plans/2026-05-02-feat-agent-native-cockpit-control-loop-plan.md`
- `.agents/skills/coding-harness/SKILL.md`
- `.agents/skills/coding-harness/references/contract.yaml`
- current local commit `d08a6c59 docs(skill): clarify authz validation target`

## Functional Validation Results

Command or Method: `pnpm exec tsx src/cli.ts commands --json --for-agent`.
Result: pass.
Evidence: returned `schemaVersion: harness-command-catalog/v3`,
`commandCount: 1`, and only command `next`.
Confidence: high.
Blocks Closure: no.

Command or Method:
`pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json`.
Result: pass.
Evidence: returned `status: pass`, 0 errors, 0 warnings, 0 total findings.
Confidence: high.
Blocks Closure: no.

Command or Method: `pnpm skill:validate`.
Result: pass.
Evidence: packaged-skill validation passed after the latest documentation fixes.
Confidence: high for local packaged skill source, not downstream install parity.
Blocks Closure: no.

Command or Method:
`python3 Plugins/harness-engineering/skills/he-eval-report/scripts/validate_eval_report.py .harness/evals/coding-harness-jsc-282-command-truth-eval.md --json`.
Result: pass after this report was restructured.
Evidence: report validator returned `status: pass`.
Confidence: high.
Blocks Closure: no.

Command or Method:
`git check-ignore -v .harness/evals/coding-harness-jsc-282-command-truth-eval.md`.
Result: pass for durable repo proof.
Evidence: `.gitignore` now has exceptions for `.harness/evals/` and
`.harness/evals/**.md`, and the eval artifact is visible to `git status`.
Confidence: high.
Blocks Closure: no.

Command or Method:
`bash scripts/validate-codestyle.sh --fast`.
Result: pass.
Evidence: codestyle parity, lint, docs lint, skill validation, workflow
validation, typecheck, quality docstrings, quality size, and related tests
passed in the implementation run; related tests reported 69 files, 1,705 tests
passed, and 1 skipped.
Confidence: high for the implementation snapshot; command was not rerun after
this eval-only restructuring because the report validator and docs lint cover
the changed artifact.
Blocks Closure: no.

Command or Method:
`pnpm exec tsx src/cli.ts review-context --files ... --json`.
Result: blocked.
Evidence: returned `learnings.artifact_missing` for
`.harness/learnings/coderabbit.local.json`.
Confidence: high.
Blocks Closure: no; this is absent imported CodeRabbit evidence, not a
JSC-282 source-command regression.

Command or Method: `pnpm test:deep`.
Result: blocked after `pnpm check` and artifact unit / integration lanes.
Evidence: E2E environment validation stopped because
`GITHUB_PERSONAL_ACCESS_TOKEN` or complete GitHub App credentials and
`LINEAR_API_KEY` were not present.
Confidence: high.
Blocks Closure: no for JSC-282 source-command closure; yes for any claim that
GitHub/Linear E2E behavior is proven.

## Eval Gate Matrix

Gate: Routing Determinism.
Expected: fresh-agent public catalog exposes only `next`.
Actual: `commands --json --for-agent` returned one command, `next`.
Status: pass.
Evidence: live source CLI probe on 2026-05-08.
Confidence: high.
Blocks Closure: no.
Required Action: keep registry tests asserting `["next"]`.

Gate: Expert Compatibility.
Expected: full command discovery remains available through explicit expert paths.
Actual: implementation eval recorded passing `commands --json`,
`commands --json --for-agent --all`, and `--help --all-commands`.
Status: pass.
Evidence: JSC-282 eval validation log.
Confidence: high.
Blocks Closure: no.
Required Action: JSC-283 must compare packaged behavior against this source
contract.

Gate: Plan-Gate Source Validation.
Expected: `.harness/plan` architecture plans validate under strict plan-gate.
Actual: source `plan-gate` returned `status: pass` with 0 findings.
Status: pass.
Evidence: live source CLI probe on 2026-05-08.
Confidence: high.
Blocks Closure: no.
Required Action: rerun after plan metadata changes.

Gate: Skill Guidance.
Expected: packaged skill guidance distinguishes focused help, public agent
catalog, and expert discovery.
Actual: skill validation passes; install references now use feature-branch authz
targets and mark protected branches as negative tests.
Status: pass.
Evidence: `pnpm skill:validate`, reference contract validation, and commit
`d08a6c59`.
Confidence: high.
Blocks Closure: no.
Required Action: preserve the first-contact/full-catalog split in JSC-283.

Gate: Eval Structure.
Expected: eval artifact satisfies `he-eval-report` contract.
Actual: initial artifact failed the validator; this revised artifact validates.
Status: pass.
Evidence: eval-report validator returned `status: pass` after restructuring.
Confidence: high.
Blocks Closure: no.
Required Action: keep future eval artifacts in the closure-report shape.

Gate: Durable Proof Storage.
Expected: closure proof can be recovered by future agents from tracked repo
artifacts or a linked Linear artifact.
Actual: `.harness/evals/` is ignored by `.gitignore`, so this validated local
eval is not visible in normal git status and is not durable unless explicitly
handled.
Status: pass.
Evidence:
`.gitignore` now includes narrow `.harness/evals/**.md` tracking exceptions, and
the eval artifact is visible to `git status --short`.
Confidence: high.
Blocks Closure: no.
Required Action: attach or link the tracked eval in Linear before closing
JSC-282.

Gate: External Integration.
Expected: no external GitHub/Linear behavior is claimed by JSC-282.
Actual: external E2E proof remains credential-blocked and explicitly out of
scope.
Status: partial.
Evidence: `pnpm test:deep` blocked on missing GitHub/Linear credentials.
Confidence: high.
Blocks Closure: no for JSC-282; blocks broader package/install/E2E claims.
Required Action: keep JSC-283 open.

## Drift Validation

Architecture Drift: Neutral
Routing Drift: Improved
Context Drift: Improved
Governance Drift: Neutral
Agent-Native Drift: Improved
Moat Drift: Improved

Architecture drift is neutral because the implementation does not add a new
orchestration layer; it preserves the existing command registry and plan-gate
boundaries. Routing drift improves because first contact is constrained to one
agent rail while expert discovery remains explicit. Context drift improves
because fresh agents can start at `harness next --json` instead of reading a
large command surface. Governance drift is neutral because the slice adds proof,
not process. Agent-native drift improves because routing and validation are more
machine-checkable. Moat drift improves only in the operational sense: command
truth is easier to prove and harder to accidentally widen.

## Architecture Integrity Check

Fact: the implementation keeps source command routing in the existing command
registry surfaces and plan handling in the existing plan-gate surfaces.
Interpretation: the slice preserves architecture rather than creating a new
cockpit subsystem.
Assumption: the reviewed branch contains the intended JSC-282 implementation.
Evidence: `src/lib/cli/command-registry.ts`, command-registry tests,
plan-gate tests, and live source CLI probes.
Affected Files/Modules: command registry, plan-gate detector, plan-gate tests,
skill references.
Confidence: high.
Operational Impact: future agents get clearer command truth without a new
abstraction to route through.
Blocks Completion: no.

## Routing Determinism Check

Fact: public agent catalog returns only `next`; expert catalog remains available
through widened commands.
Interpretation: the routing model is deterministic for fresh agents and still
reversible for expert users.
Assumption: packaged behavior will be brought into parity by JSC-283.
Evidence: `commands --json --for-agent` live output and eval validation log for
full-catalog probes.
Affected Files/Modules: `src/lib/cli/registry/command-capabilities.ts`,
`src/lib/cli/command-registry.ts`, `.agents/skills/coding-harness/SKILL.md`.
Confidence: high for source routing, medium for packaged parity.
Operational Impact: reduces accidental first-contact command sprawl.
Blocks Completion: no.

## Context Load Check

Fact: focused help starts at `harness next --json`, and public agent catalog has
one command.
Interpretation: the implementation reduces context cost for future agents.
Assumption: downstream installed skill guidance will be checked in JSC-283.
Evidence: focused help and command catalog probes captured in the eval log.
Affected Files/Modules: CLI help, command catalog, skill references.
Confidence: high.
Operational Impact: lowers first-contact token and decision cost.
Blocks Completion: no.

## Agent-Native Check

Fact: source command truth is machine-readable through JSON command catalog and
plan-gate output.
Interpretation: the implementation is agent-native in operational behavior, not
just prose.
Assumption: missing CodeRabbit learning import is unrelated to command truth.
Evidence: JSON CLI outputs, command-registry tests, plan-gate strict JSON output.
Affected Files/Modules: CLI command surfaces, validation-plan/review-context
learning integration, skill package references.
Confidence: high.
Operational Impact: future agents can verify the cockpit with commands instead
of interpreting broad docs.
Blocks Completion: no.

## Governance Simplicity Check

Fact: JSC-282 adds eval evidence and source-truth reconciliation, not new
review bureaucracy.
Interpretation: governance remains proof-oriented rather than process-heavy.
Assumption: Linear will link this eval rather than creating extra issue noise.
Evidence: plan, technical review, eval artifact, and latest commit scope.
Affected Files/Modules: `.harness/plan`, `.harness/review`, `.harness/evals`,
skill references.
Confidence: medium-high.
Operational Impact: closure is based on proof artifacts and scoped follow-up.
Blocks Completion: no.

## Moat Protection Check

Fact: the implementation improves deterministic command truth and proof quality.
Interpretation: the defensible part is operational reliability and cognition
compression, not the existence of more cockpit docs.
Assumption: JSC-283 will enforce packaged parity before downstream claims.
Evidence: first-contact command budget, eval log, drift classification, and
explicit package/install out-of-scope notes.
Affected Files/Modules: command registry, skill references, eval artifact.
Confidence: medium-high.
Operational Impact: protects the real leverage by keeping command truth
measurable and narrow.
Blocks Completion: no.

## Proof Artifacts

Produced:

- `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`
- `.harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md`
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`
- local commit `d08a6c59 docs(skill): clarify authz validation target`

Required:

- source CLI probes for `next`, focused help, public catalog, and expert catalog;
- strict source plan-gate proof;
- focused tests for command registry, CLI help, and plan-gate;
- docs and skill validation;
- drift-gate warning classification;
- JSC-283 package/install parity proof before downstream completion claims.

Missing:

- packaged binary parity proof;
- downstream installed skill proof;
- GitHub/Linear credential-backed E2E proof;
- external Linear attachment or link to the tracked eval proof artifact.

Blocks Completion: no for durable JSC-282 source-command closure after this
tracking repair; yes for broader packaged/install completion until JSC-283 proof
exists.
Attach or Link Back to Linear: attach this eval and link JSC-283 as the package
and install parity successor.

## Failures / Regressions

Failure or Regression: initial eval artifact did not satisfy the
`he-eval-report` validator structure.
Evidence: validator reported missing required sections, missing Linear fields,
missing drift classifications, and invalid recommendation parsing.
Required Corrective Action: restructure the existing eval into this
contract-compliant closure report.
Follow-Up Justified: no new Linear issue; this eval update is sufficient.
Blocks Closure: no after validator pass.

Failure or Regression: validated eval artifact was initially ignored by git.
Evidence: `git check-ignore -v` reported `.gitignore:55:.harness/*` for this
file before the tracking repair.
Required Corrective Action: completed by adding narrow `.harness/evals/**.md`
tracking exceptions and making this eval visible to git.
Follow-Up Justified: no new Linear issue required.
Blocks Closure: no.

Failure or Regression: `.harness/learnings/coderabbit.local.json` is absent.
Evidence: `review-context` returned `learnings.artifact_missing`.
Required Corrective Action: refresh/import CodeRabbit learning evidence when
that lane is required.
Follow-Up Justified: not for JSC-282 unless closure policy requires imported
CodeRabbit evidence for this issue.
Blocks Closure: no for source-command scope.

Failure or Regression: `pnpm test:deep` could not complete external E2E proof.
Evidence: missing GitHub/Linear credentials stopped E2E environment validation.
Required Corrective Action: run credential-backed E2E in the appropriate
environment before making external integration claims.
Follow-Up Justified: yes under JSC-283 or release readiness.
Blocks Closure: no for JSC-282 source-command scope.

## Linear Completion Recommendation

Classification: Complete with follow-up
Recommended Linear Status: mark JSC-282 done and keep JSC-283 open.
Required Linear Comment/Update: summarize that source command truth is complete,
package/install parity remains JSC-283, and external E2E was credential-blocked.
Issues to Close: JSC-282.
Issues to Reopen: none.
Issues to Leave Open: JSC-283.
New Follow-Up Issues: none required for this eval; avoid issue noise.
Labels to Add/Remove: none.
Milestone Completion: safe only if all other Agent Cockpit Compression Slice
items are complete.
Project Status Change: no project status change required from this eval alone.
Status Update Needed: no; plan frontmatter is complete.
Proof Artifacts to Attach or Link:
`.harness/evals/coding-harness-jsc-282-command-truth-eval.md`,
`.harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md`,
and `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md`.

## Follow-Up Work

Classification: Next
Target Linear Project: coding-harness.
Parent Issue or Milestone: JSC-283.
Reason: packaged binary, installed skill, downstream repo, and credential-backed
integration proof are intentionally outside JSC-282.
Priority: High.
Labels: Agent-Native, Eval, Reliability if those labels exist; otherwise avoid
new label creation.
Agent-Safe or Human-Review Required: agent-assisted with human review required
for closure claims.

## Core / ADR Update Recommendation

Core Update: not required.
ADR Update: not required.
Rationale: JSC-282 applies existing invariants rather than making a new
architecture decision. The durable rule is already clear: first-contact routing
must remain compressed and expert widening must remain explicit.
Required Action: preserve this eval as the closure proof and use JSC-283 for
packaged/install parity.

## Evidence & Traceability Matrix

Conclusion: JSC-282 source-command scope is complete.
Fact: source command catalog exposes one agent rail, `next`.
Interpretation: first-contact command truth is compressed and deterministic.
Assumption: source CLI is the correct proof target for JSC-282.
Evidence: `pnpm exec tsx src/cli.ts commands --json --for-agent` passed, and
the closure report is now trackable under `.harness/evals/**.md`.
Affected Files/Modules: command registry, command capabilities, `.gitignore`,
`.harness/plan`, and `.harness/evals`.
Command Output or Inspection Method: live source CLI probe and git tracking
check.
Confidence: high.
Operational Impact: future agents get one safe starting command.
Blocks Completion: no.

Conclusion: expert command compatibility is preserved.
Fact: eval log records full catalog and expert help probes as passing.
Interpretation: compression did not delete expert capability discovery.
Assumption: packaged parity remains deferred.
Evidence: JSC-282 validation log for `commands --json`,
`commands --json --for-agent --all`, and `--help --all-commands`.
Affected Files/Modules: command registry and CLI help.
Command Output or Inspection Method: prior source CLI probes captured in eval.
Confidence: high.
Operational Impact: avoids making first-contact compression destructive.
Blocks Completion: no.

Conclusion: plan implementation is validated by source plan-gate.
Fact: strict plan-gate over `.harness/plan` returned pass with 0 findings.
Interpretation: source architecture plan handling is fit for JSC-282 closure.
Assumption: plan frontmatter status can be updated independently at closure.
Evidence:
`pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json`.
Affected Files/Modules: plan-gate detector, plan metadata, `.harness/plan`.
Command Output or Inspection Method: live source CLI probe.
Confidence: high.
Operational Impact: validates the approved slice artifact.
Blocks Completion: no.

Conclusion: latest review fixes are correct and scoped.
Fact: latest commit changes only three skill reference files.
Interpretation: the fix removes protected-branch authz overclaim and makes the
workflow-contract fixture intentional without changing runtime behavior.
Assumption: no uncommitted user edits were overwritten.
Evidence: commit `d08a6c59`, `git show --name-only`, and `pnpm skill:validate`.
Affected Files/Modules: packaged skill references.
Command Output or Inspection Method: git inspection and skill validation.
Confidence: high.
Operational Impact: reduces install-guide drift before JSC-283.
Blocks Completion: no.

Conclusion: closure must not claim package/install parity.
Fact: eval explicitly excludes packaged binary, global install, downstream skill,
and credential-backed E2E behavior.
Interpretation: JSC-282 completion is narrower than full cockpit release
readiness.
Assumption: JSC-283 remains the successor issue.
Evidence: plan, eval scope, `pnpm test:deep` credential blocker.
Affected Files/Modules: eval artifact, skill package, downstream install path.
Command Output or Inspection Method: artifact review and validation log.
Confidence: high.
Operational Impact: prevents false closure and protects JSC-283 scope.
Blocks Completion: no for JSC-282, yes for package/install claims.
