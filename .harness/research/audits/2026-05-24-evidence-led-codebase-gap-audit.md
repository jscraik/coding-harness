# Evidence-Led Codebase Gap Audit

Generated: 2026-05-24

Primary evidence document:

- .harness/research/deep/2026-05-24-jamie-craik-operational-telemetry-evidence.md

Target codebase:

- .

Researcher coverage:

- Local audit: completed with direct code, script, config, and runtime command
  inspection.
- adversarial-reviewer: completed via mailbox JSON findings. The requested
  artifact file was not produced, so the finding content is used as corroborating
  evidence only, not as artifact-first proof.
- agent-native-reviewer: blocked by subagent tool execution failure
  (exec cell not found), no artifact produced.
- api-contract-reviewer: did not execute the assigned audit and produced no
  artifact.

Reviewer coverage status: partial. The local audit compensates by inspecting the
runtime surfaces directly, but future audit workflows should use a
reviewer-coverage manifest before relying on subagent review as proof.

Validation evidence for this audit:

- Command: bash scripts/codex-preflight.sh --mode optional -> pass (repo root,
  stack, git config, and required binaries available)
- Command: pnpm architecture:check -> pass (0 errors, 4 advisory warnings)
- Command: pnpm exec tsx src/cli.ts next --json -> pass (returned
  harness-decision/v1, safe read-only validation-plan recommendation)
- Command: pnpm exec tsx src/cli.ts runtime-card --json --repo . -> pass
  (returned runtime-card/v1, local Linear freshness unknown, phase exit not run)
- Command: node scripts/validate-evidence-patterns.cjs --json -> fail
  (deep_evidence_untracked for the new 2026-05-24 operational telemetry evidence
  document; also reported validationCommands: [])
- Command: node scripts/validate-evidence-patterns.cjs --strict-adopted --json
  -> fail (same deep_evidence_untracked; strict mode did not execute commands
  because manifest validation failed first)
- Command: node scripts/validate-audit-references.cjs .harness/research/deep/2026-05-24-jamie-craik-operational-telemetry-evidence.md --json
  -> fail (partial; one referenced implementation note exists but is gitignored)

External research used to tighten recommendations:

- Command: ctx7 library zod "json schema validation parse safeParse" -> pass
  (resolved /colinhacks/zod as a high-reputation TypeScript-first schema library)
- Command: ctx7 docs /colinhacks/zod "JSON Schema z.toJSONSchema safeParse discriminated unions"
  -> pass (safeParse returns a discriminated union and discriminated unions are a
  first-class schema pattern)
- Command: ctx7 library ajv "json schema validate errors standalone" -> pass
  (resolved /ajv-validator/ajv as a high-reputation JSON Schema validator)
- Command: ctx7 docs /ajv-validator/ajv "strict mode compile JSON Schema errors standalone validation"
  -> pass (Ajv strict mode prevents ignored or ambiguous schema elements and
  standalone validation can compile schemas into deterministic validation modules)
- Command: ctx7 library dependency-cruiser "forbidden dependency rules cli validate"
  -> pass (resolved /sverweij/dependency-cruiser for dependency validation)
- Command: ctx7 docs /sverweij/dependency-cruiser "forbidden rules validate command TypeScript"
  -> pass (forbidden rule sets, TypeScript config, and validation output are
  supported directly)
- Command: ctx7 library opentelemetry-js "logs traces semantic conventions node sdk"
  -> pass (resolved /open-telemetry/opentelemetry-js)
- Command: ctx7 docs /open-telemetry/opentelemetry-js "NodeSDK traces logs resource exporter"
  -> pass (NodeSDK resources and correlated logs are viable export mechanisms)
- Command: ctx7 library vitest "test fixtures snapshots cli" -> pass
  (resolved /vitest-dev/vitest)
- Command: ctx7 docs /vitest-dev/vitest "fixtures snapshot testing CLI run" -> pass
  (snapshot/update flows and fixture-style integration tests are documented)

Research disposition: use these as implementation constraints, not new scope.
Repo-native validators and JSONL receipts stay canonical; external tools should
only reduce parser fragility, improve deterministic schema validation, or provide
better import-graph evidence.

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Overall Gradecard](#2-overall-gradecard)
- [3. Evidence-to-Code Mapping](#3-evidence-to-code-mapping)
- [4. Gap Register](#4-gap-register)
- [5. Contradictions](#5-contradictions)
- [6. Missing Features](#6-missing-features)
- [7. Fix Roadmap](#7-fix-roadmap)
- [8. Highest-Leverage Fixes](#8-highest-leverage-fixes)
- [9. Implementation Advice](#9-implementation-advice)
- [10. Final Recommendation](#10-final-recommendation)

## 1. Executive Summary

Overall maturity grade: **B-**.

The codebase is materially ahead of a docs-only harness. It has a real CLI
command registry, harness next decision packets, runtime-card/v1, pr-closeout/v1,
run-record schemas, architecture checks, steering-feedback guards,
evidence-pattern validation, root-surface classification, reviewer coverage
validation, and audit-reference validation. The strongest foundations are
executable and mostly repo-native.

The main weakness is uneven enforcement depth. Several high-value trust surfaces
exist, but the system still has places where a proof-looking artifact can pass
without executing the proof it names, where local runtime truth can recommend
next work without live tracker/PR freshness, where root hygiene is documented but
not mechanically checked against git ls-files, and where trace/run-record
emission is command-specific rather than universal.

Top 5 gaps:

1. Evidence-pattern validation can be wired into pnpm check without executing
   adopted pattern validation commands.
2. Root hygiene has a classification document but no tracked, executable
   root-hygiene-classification/v1 validator.
3. Runtime cards and harness next distinguish local evidence from live truth,
   but local mode still permits action recommendations with unknown Linear and
   missing PR state.
4. Run-record and trace infrastructure exists, but only selected command families
   emit canonical run records.
5. Reviewer artifact discipline exists as a validator, but review-swarm
   orchestration is not automatically coupled to a manifest and gate.

Top 5 risks:

1. False success: adopted evidence can remain stale because its declared command
   was never run by the default gate.
2. Dirty worktree contamination: untracked research artifacts can unexpectedly
   fail global validation, while unrelated dirty files can influence runtime
   recommendations.
3. Authority flattening: implementation notes, research reports, active specs,
   and executable validators can still be retrieved as if they have equal force.
4. Tool availability drift: a workflow may assume Browser, GitHub, Linear, or
   review tooling is callable without a captured runtime capability snapshot.
5. Partial closeout truth: pr-closeout/v1 is strong for PRs, but there is no
   generalized delivery-truth receipt that every complete, green, tidy, or ready
   claim must pass through.

Strongest existing foundations:

- src/cli.ts:49-108 makes harness next --json the first-contact agent rail, and
  src/lib/cli/command-registry.ts:52-128 publishes a machine-readable command
  catalog.
- src/commands/next-runner.ts produces harness-decision/v1 packets from git
  state, command catalog, runtime-card, and phase-exit sources.
- src/lib/runtime/runtime-card-validation.ts:24-277 validates runtime-card/v1
  including branch, PR, Linear, artifacts, sources, blockers, attempt ledger, and
  recovery event.
- src/lib/pr-closeout/types.ts:96-116 defines claim-level PR closeout evidence
  with status, source, head SHA, freshness, blocker class, missing context, and
  verification timestamp.
- scripts/check-steering-feedback-contract.cjs:8-89 encodes repeated-steering
  admission rules and required repository surfaces into a gate.

Highest-leverage next fixes:

1. Tighten research:evidence:validate so implementation-backed/adopted evidence
   cannot pass without runnable proof or an explicit tracked exception, using a
   discriminated result shape for pass/fail/blocked evidence.
2. Add scripts/validate-root-hygiene-classification.cjs backed by a
   root-hygiene-classification/v1 JSON contract, then generate or verify the
   Markdown classification from that contract.
3. Add a delivery-truth receipt generator that composes runtime-card,
   pr-closeout, active artifact, GitHub, Linear, dirty state, and validation
   evidence through a schema-validated claim model.
4. Add a tool-availability snapshot to runtime-card and closeout evidence, with
   missing tools blocking only dependent validation.
5. Make review-swarm use produce a reviewer manifest and run
   validate-reviewer-coverage.cjs before synthesis, with Vitest fixtures for
   mailbox-only, missing-artifact, blocked, and complete reviewer cases.

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Repository as Control Plane | B | High | Strong durable surfaces exist across .harness, docs, ADRs, harness.contract.json, root instructions, package scripts, and validators. | Source roles are not consistently machine-readable; root classification is docs-only. | Add authority metadata and a root-hygiene validator. |
| Runtime Truth and Decision Packets | B- | High | harness next and runtime-card/v1 are reachable and validated. | Local mode can proceed with unknown Linear and absent PR state. | Require live evidence or explicit unknown blockers for closeout/claiming modes. |
| Claim-vs-Evidence Verification | B | High | pr-closeout/v1 models claims with source, freshness, head SHA, and blocker class. | Claim enforcement is mostly PR-closeout scoped; unsupported language is not generally blocked. | Add delivery-truth/v1 and closeout-language validation. |
| Mechanical Architecture Enforcement | C+ | High | Custom architecture script and structural tests enforce cycles, command facades, diagram freshness, and known seams. | Rules are hand-rolled and warning-heavy; no full dependency-boundary model for every layer. | Add a generated boundary manifest plus ts-morph/dependency graph checks. |
| Harness Runtime Loop | C+ | Medium | Attempt ledgers and recovery events exist in runtime-card, pr-closeout, replay, remediate, and pilot flows. | No universal retry/attempt policy across all CLI commands. | Add shared attempt-ledger middleware for registry commands. |
| Trace and Session Evidence | C+ | High | Canonical run records exist with hash chain and sensitive-field checks; selected commands emit them. | Emission is not universal and many decision commands only report JSON to stdout. | Make run-record emission opt-out for command specs that change state or make claims. |
| Context Engineering | C+ | Medium | Project Brain, active artifacts, command catalog, source outline, context commands, and evidence manifests exist. | Hot/cold context and authority-role separation are not consistently enforced by validators. | Add source-role metadata and context-budget/routing checks. |
| Skills and Workflow Density | C+ | Medium | Skill validation and packaged harness skill surfaces exist; agent rail currently exposes only next. | Skill overlap and review-swarm invocation are not gated by workflow density metrics. | Add skill inventory density checks and workflow win-condition fixtures. |
| Recovery and Failure Handling | C+ | High | Recovery classifiers exist for PR closeout, runtime-card, replay, worktree, env-backed validation, and steering failures. | Blind retry prevention is not uniformly enforced across all commands and scripts. | Centralize retry classification and repeated-error research receipts. |
| Governance and Safety | B | High | Branch policy, PR gates, secrets checks, Semgrep/Snyk posture, path traversal guards, and artifact validators are present. | Approval/tool capability boundaries are partly external to repo runtime truth. | Add runtime capability snapshots and destructive-action receipts. |

## 3. Evidence-to-Code Mapping

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
| --- | --- | --- | --- | --- | --- |
| Steering feedback as operational telemetry | .harness/research/deep/2026-05-24-jamie-craik-operational-telemetry-evidence.md:100-148 | scripts/check-steering-feedback-contract.cjs:8-89, package.json:73, package.json:50 | implemented_enforced | B | High |
| Claim-vs-evidence closeout | evidence doc:149-194 | src/lib/pr-closeout/types.ts:96-116, src/lib/pr-closeout/evaluator.ts:59-141, src/commands/pr-closeout.ts | implemented_enforced for PR closeout; partial globally | B- | High |
| Non-destructive root hygiene classification | evidence doc:195-240 | docs/architecture/root-surface-classification.md:19-89, docs/README.md:68-69 | documented_only | C | High |
| Fresh authority before implementation | evidence doc:242-284 | src/commands/next-runner.ts, src/lib/runtime/local-runtime-card-assembly.ts:67-77, .harness/active-artifacts.md | partial | B- | High |
| Seam discovery before code mutation | evidence doc:285-325 | src/lib/architecture/module-boundaries.test.ts, scripts/check-architecture-rules.cjs:262-286 | implemented_enforced for selected seams | B- | Medium |
| Validator creation as trust-boundary repair | evidence doc:326-370 | scripts/validate-evidence-patterns.cjs, scripts/validate-audit-references.cjs, scripts/validate-reviewer-coverage.cjs, package.json:50 | partial | C+ | High |
| Artifact-first subagent review | evidence doc:371-411 | scripts/validate-reviewer-coverage.cjs:205-320 | implemented_not_enforced by default | C | High |
| Dirty worktree isolation | evidence doc:413-454 | src/commands/next-runner.ts:68-80, src/lib/pr-closeout/types.ts:203-212 | partial | B- | High |
| Scope authority before downscope | evidence doc:456-493 | Steering admission docs and guard patterns; no first-class scope-authority/v1 schema found | scaffolded | C | Medium |
| Unknown-flag false-pass prevention | evidence doc:1061-1088 | scripts/validate-evidence-patterns.cjs:36-104, scripts/validate-audit-references.cjs:47-86, scripts/validate-reviewer-coverage.cjs:25-87 | implemented_enforced for inspected scripts | B | High |
| Runtime capability snapshot | evidence doc:1186-1218 | Runtime-card sources support tool-like source kinds, but no explicit tool availability snapshot beyond PR closeout tool enum | partial | C | High |
| Authority ladder | evidence doc:1220-1249 | Research manifest statuses exist; harness.contract.json has policy and product surfaces; source-role metadata is incomplete | partial | C+ | Medium |
| Evidence promotion gate | evidence doc:1267-1270 | scripts/validate-evidence-patterns.cjs, .harness/research/evidence-patterns.json | partial; default does not run proof commands | C | High |
| Stale-reference validator | evidence doc:1277-1279 | scripts/validate-audit-references.cjs:281-320 and related reference classification | implemented_enforced when run | B | High |

## 4. Gap Register

### GAP-001: Adopted Evidence Does Not Execute Proof in Default Gate

**Category:** validation

**Current State:**

package.json:50 wires pnpm research:evidence:validate into pnpm check.
package.json:78 defines that script as node scripts/validate-evidence-patterns.cjs.
The validator defaults runValidationCommands and strictAdopted to false at
scripts/validate-evidence-patterns.cjs:36-45. The command run during this audit
returned validationCommands: [].

**Expected State:**

Implementation-backed or adopted evidence should either execute its declared
validation command, cite a current tracked receipt, or carry a tracked exception.

**Evidence Basis:**

The evidence report says validator creation is trust-boundary repair and that
research pattern promotion should not become adopted harness policy without
runnable proof or a tracked exception.

**Code Evidence:**

- package.json:50
- package.json:78
- scripts/validate-evidence-patterns.cjs:36-45
- scripts/validate-evidence-patterns.cjs:383-420

**Risk:**

False success. A stale or broken implementation-backed pattern can pass the
aggregate gate because the validator checked shape but not runtime proof.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Change research:evidence:validate to strict mode after deciding the intended
local-in-progress policy:

- preferred: node scripts/validate-evidence-patterns.cjs --strict-adopted --json
- or: make strict adopted checking the in-script default for CI, with an explicit
  local escape hatch.

Model command proof as a discriminated result:

- passed: command, exit code 0, captured timestamp, and optional receipt path;
- failed: command, exit code, stderr/stdout summary, and blocking pattern id;
- blocked: blocker class, reason, owner, and explicit exception or follow-up id.

Add regression fixtures for adopted patterns with missing, failing, blocked, and
passing validation commands.

**Suggested Software / Method:**

Node.js validator, Zod safeParse-style discriminated result handling for
in-process TypeScript/JavaScript code, JSON Schema plus Ajv strict mode if the
contract is published as a repo artifact, Vitest fixture tests, jq for
machine-readable CI summaries.

**Files Likely To Change:**

- package.json
- scripts/validate-evidence-patterns.cjs
- tests or src fixture surface for validator behavior
- .harness/research/evidence-patterns.json

**Validation Command:**

node scripts/validate-evidence-patterns.cjs --strict-adopted --json

**Acceptance Criteria:**

- Adopted/implementation-backed entries with declared proof commands execute in
  CI/default mode.
- Missing proof command fails unless a tracked exception is present.
- Blocked proof is distinct from failed proof and must name a blocker class.
- Unknown flags exit 2.
- JSON output includes executed command status.
- pnpm check no longer reports evidence validation pass without proof.

### GAP-002: Untracked Deep Research Drafts Poison Global Validation

**Category:** validation / workflow

**Current State:**

deepEvidenceFiles reads every Markdown file in .harness/research/deep from the
filesystem at scripts/validate-evidence-patterns.cjs:160-168, and
validateManifest fails each file missing from the manifest at
scripts/validate-evidence-patterns.cjs:371-379. The current run fails
deep_evidence_untracked for the new operational telemetry extraction.

**Expected State:**

Global readiness gates should fail on unregistered tracked evidence, but local
scratch or in-progress research should have a clear tracked/draft boundary.

**Evidence Basis:**

Dirty worktree isolation and authority flattening patterns require local drafts,
tracked evidence, and promoted rules to remain distinguishable.

**Code Evidence:**

- scripts/validate-evidence-patterns.cjs:160-168
- scripts/validate-evidence-patterns.cjs:371-379
- command result: deep_evidence_untracked

**Risk:**

Unrelated local research drafts can fail pnpm check, creating noisy blockers and
encouraging agents to edit manifest state before evidence is ready.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Decide and encode one policy:

- track-only: inspect git ls-files .harness/research/deep '*.md' instead of raw
  directory entries;
- draft-aware: allow untracked files only under .harness/research/deep/drafts;
- strict: require all files but add a harness research register flow that creates
  manifest entries atomically.

**Suggested Software / Method:**

Git tracked-file enumeration, JSON manifest validator, explicit draft directory.

**Files Likely To Change:**

- scripts/validate-evidence-patterns.cjs
- .harness/research/README.md if present or a new research workflow note
- package.json only if command mode changes

**Validation Command:**

git ls-files .harness/research/deep '*.md' && node scripts/validate-evidence-patterns.cjs --json

**Acceptance Criteria:**

- Tracked deep evidence missing from manifest fails.
- Untracked local drafts either do not fail or fail with a specific draft-policy
  message.
- The validator reports whether it inspected tracked files, all files, or drafts.

### GAP-003: Rejected Evidence Is Collapsed Into Deferred Summary Status

**Category:** governance / traceability

**Current State:**

normalizePatternStatus maps rejected to deferred at
scripts/validate-evidence-patterns.cjs:154-157, and summary counts use the
normalized status at scripts/validate-evidence-patterns.cjs:422-443.

**Expected State:**

Rejected, deferred, documented-only, and implementation-backed are distinct
authority decisions.

**Evidence Basis:**

Authority flattening is a named failure mode in the evidence report. Rejection is
an intentional governance state, not a weaker deferral.

**Code Evidence:**

- scripts/validate-evidence-patterns.cjs:154-157
- scripts/validate-evidence-patterns.cjs:422-443

**Risk:**

Dashboards or agents consuming status summary data cannot distinguish later from
intentionally no, which can reactivate rejected patterns.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Preserve rejected as a first-class summary count. If UI consumers need a
collapsed display status, expose both canonicalStatus and displayStatus.

**Suggested Software / Method:**

Fixture-driven validator tests and JSON schema examples.

**Files Likely To Change:**

- scripts/validate-evidence-patterns.cjs
- evidence-pattern validator tests

**Validation Command:**

node scripts/validate-evidence-patterns.cjs --json | jq '.statusSummary'

**Acceptance Criteria:**

- rejected appears in status summary when present.
- Existing adopted alias handling remains explicit.
- Tests cover rejected/deferred/adopted distinctions.

### GAP-004: Root Hygiene Is Documented But Not Mechanically Enforced

**Category:** architecture / validation

**Current State:**

docs/architecture/root-surface-classification.md:19-89 defines categories,
current files/directories, deferred cleanup, and validation commands. No
validate-root-hygiene-classification script or package script was found.

**Expected State:**

Top-level tracked root entries should be mechanically compared against a
classification table or JSON receipt.

**Evidence Basis:**

The evidence report says root cleanup requires classifying every top-level
tracked file or directory and recommends root-hygiene-classification/v1.

**Code Evidence:**

- docs/architecture/root-surface-classification.md:19-89
- docs/README.md:68-69
- no matching script found by root-surface search

**Risk:**

The repo can drift after root cleanup while docs still claim none remaining at
root; agents may again conflate scaffold/source-map work with ROOT hygiene.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Add scripts/validate-root-hygiene-classification.cjs that:

- enumerates git ls-files top-level entries;
- reads a machine-readable JSON sidecar as the source of truth;
- verifies the Markdown table is generated from or synchronized with the JSON
  sidecar;
- requires every tracked top-level file/dir to have one classification;
- verifies deferred entries include owner/reason;
- verifies moved/deleted legacy paths have archived evidence or explicit
  destructive authorization;
- emits exactly one root-hygiene-classification/v1 JSON object.

Wire it into pnpm docs:root-archive:links or add pnpm docs:root-surface:guard
and include it in pnpm check.

**Suggested Software / Method:**

Node.js, git ls-files -z to avoid path parsing ambiguity, JSON Schema with Ajv
strict mode for the classification contract, Markdown generated from JSON rather
than parsed as authority, docs-gate.

**Files Likely To Change:**

- scripts/validate-root-hygiene-classification.cjs
- package.json
- docs/architecture/root-surface-classification.md
- docs/README.md
- validator fixture tests

**Validation Command:**

node scripts/validate-root-hygiene-classification.cjs --json

**Acceptance Criteria:**

- Every tracked top-level entry is classified exactly once.
- Added root files fail until classified.
- Removed/moved root files fail if the classification still lists stale entries.
- Deferred entries require reason and owner.
- Markdown root classification cannot drift from the JSON contract.
- The report can be attached to future ROOT cleanup PRs.

### GAP-005: Runtime Card Local Mode Reports Unknown Live Truth Without Blocking

**Category:** runtime / claim-vs-evidence

**Current State:**

The runtime-card command produced runtime-card/v1 with branch main, dirty state
false, no PR, Linear freshness unknown, and phase exit not_run, but no blockers.
fallbackLinear explicitly sets freshness to unknown and an actionRequired string
at src/lib/runtime/local-runtime-card-assembly.ts:67-77.

**Expected State:**

Local runtime-card generation should be allowed for orientation, but claim-making
or closeout modes should fail closed when PR/Linear truth is unknown.

**Evidence Basis:**

The evidence report separates local code/test status, remote checks, review
threads, tracker state, branch/worktree state, and merge readiness.

**Code Evidence:**

- src/lib/runtime/local-runtime-card-assembly.ts:67-77
- runtime command output from this audit
- src/lib/runtime/runtime-card-validation.ts:175-189

**Risk:**

Agents may treat a valid runtime-card schema as complete runtime truth even when
live tracker or PR state was not refreshed.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Add a claimMode or requiredFreshness option to runtime-card/next/closeout
consumers. In claim/closeout mode, unknown Linear or missing PR state should
become blockers unless explicitly marked not applicable with reason.

**Suggested Software / Method:**

Runtime-card schema extension, closeout gate adapter, command option
--require-live or --claim-mode closeout, Vitest fixtures.

**Files Likely To Change:**

- src/commands/runtime-card.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- src/lib/runtime/runtime-card-validation.ts
- src/commands/next-runner.ts
- runtime-card tests

**Validation Command:**

pnpm vitest run src/lib/runtime/local-runtime-card.test.ts src/commands/runtime-card.test.ts

**Acceptance Criteria:**

- Orientation mode still emits local cards with unknown live truth.
- Claim/closeout mode blocks on unknown Linear or missing PR truth.
- The JSON report distinguishes valid schema from sufficient evidence.

### GAP-006: Harness Next Exposes Only One Public Agent Rail

**Category:** context / routing

**Current State:**

harness commands --json --for-agent returned a harness-command-catalog/v3 with
one command: next. This is intentionally thin, but it means all richer agent
affordance relies on next picking the right command.

**Expected State:**

Thin surface is good, but next must be heavily validated because it is the only
public routing rail.

**Evidence Basis:**

The repo's north star is a thin surface with strong guardrails and durable
memory. The evidence report emphasizes routing and context separation.

**Code Evidence:**

- src/cli.ts:49-108
- src/lib/cli/command-registry.ts:52-128
- command output: public agent catalog count 1

**Risk:**

If next omits a gate, agents may never discover the safer specialized command.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Add focused regression fixtures for next routing across evidence-led audit, root
cleanup, PR closeout, validation planning, and repeated-steering admission
scenarios. Keep public surface thin, but make routing evidence-rich.

**Suggested Software / Method:**

Vitest table tests, command-catalog snapshots, scenario fixtures.

**Files Likely To Change:**

- src/commands/next-runner.ts
- src/commands/next*.test.ts
- src/lib/cli/registry/*

**Validation Command:**

pnpm vitest run src/commands/next*.test.ts src/lib/cli/registry/*.test.ts

**Acceptance Criteria:**

- next routes each major workflow to a command with required evidence.
- Missing evidence produces blockers, not generic suggestions.
- Command catalog snapshots remain stable.

### GAP-007: Run-Record Emission Is Not Universal

**Category:** traceability / runtime

**Current State:**

Run-record infrastructure is strong. It defines manifest/event schemas, hash
chains, path traversal checks, and sensitive-key rejection at
src/lib/contract/run-records-core.ts:180-356. But code search shows
emitTerminalRunRecord is used by selected commands such as automation-run,
pilot-rollback, pilot-evaluate, review-gate, replay, and remediate.

**Expected State:**

Commands that mutate state, make delivery claims, or generate evidence should
emit canonical run records by default or record an explicit n.a. reason.

**Evidence Basis:**

Trace/session evidence patterns require replayable tool-call records, command
outputs, verifier results, recovery events, and final status records.

**Code Evidence:**

- src/lib/contract/run-records-core.ts:180-356
- src/commands/replay-run-record.ts:1-170
- src/lib/review-gate/run-record.ts
- rg output showing selected emitters only

**Risk:**

Trace evidence remains fragmented. A JSON command result may be useful, but it
does not provide a hash-chained, replayable record by default.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Extend command specs with runRecordPolicy: required, optional, or none. Registry
dispatch should provide a shared finalizer for required commands. Read-only
orientation commands can remain optional. Keep the repo's JSONL/hash-chained run
record as the canonical evidence source; if OpenTelemetry is added, use it as an
export adapter with service/resource attributes and correlated logs, not as the
only local proof surface.

**Suggested Software / Method:**

Command registry metadata, shared run-record finalizer, Vitest contract tests,
optional OpenTelemetry NodeSDK/log exporter adapter after local JSONL receipts
are complete.

**Files Likely To Change:**

- src/lib/cli/command-types.ts
- src/lib/cli/command-registry.ts
- src/lib/contract/run-record-emitter-core.ts
- selected command specs/tests

**Validation Command:**

pnpm vitest run src/lib/contract/run-records.test.ts src/lib/cli/command-registry.test.ts

**Acceptance Criteria:**

- Claim-making commands have explicit run-record policy.
- Required commands emit run-record paths in JSON output.
- Sensitive key and hash-chain protections remain enforced.

### GAP-008: Reviewer Coverage Validator Exists But Is Not Workflow-Coupled

**Category:** review / governance

**Current State:**

scripts/validate-reviewer-coverage.cjs:205-320 rejects mailbox-only, missing,
outside-repo, unreadable, empty, blocked, and no-WROTE reviewer artifacts. The
requested subagents in this audit produced partial mailbox output and no artifact
files.

**Expected State:**

Whenever a plan or user request names subagent researchers/reviewers, the
workflow should create a reviewer manifest and run the coverage validator before
using review output.

**Evidence Basis:**

Artifact-first subagent review is explicit in the evidence report. Mailbox text
is not proof.

**Code Evidence:**

- scripts/validate-reviewer-coverage.cjs:8-11
- scripts/validate-reviewer-coverage.cjs:205-320
- current audit subagent results: two failed/no artifact, one mailbox findings

**Risk:**

Reviewer swarms create the appearance of assurance while only mailbox text is
available. Coverage gaps are not recorded unless the coordinator does it
manually.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Add a helper, for example harness reviewer-manifest --roles ... --json, or a
script that writes artifacts/reviews/reviewer-coverage-manifest.json. Require
validate-reviewer-coverage.cjs before synthesizing requested swarm output. Add
fixture tests for complete, missing artifact, mailbox-only, blocked runtime, and
outside-repo artifact cases so the manifest is enforced as a workflow contract,
not just a standalone script.

**Suggested Software / Method:**

JSON manifest, existing validator, reviewer artifact convention,
reviewer-coverage-receipt/v1, Vitest fixture-driven script tests.

**Files Likely To Change:**

- scripts/validate-reviewer-coverage.cjs only if report shape needs extension
- new scripts/create-reviewer-coverage-manifest.cjs or CLI wrapper
- review workflow docs/tests

**Validation Command:**

node scripts/validate-reviewer-coverage.cjs --manifest artifacts/reviews/reviewer-coverage-manifest.json --json

**Acceptance Criteria:**

- A reviewer plan cannot synthesize from mailbox-only results without a coverage
  gap.
- Missing artifacts have precise blocker classes.
- Blocked subagents remain visible in the final receipt.

### GAP-009: Audit References Validator Treats Ignored Existing Evidence As Partial

**Category:** traceability / governance

**Current State:**

The audit-reference validator found one cited implementation note that exists but
is gitignored: .harness/implementation-notes/2026-05-23-jsc-331-trust-boundary-governed-implementation-notes.html.
It returned status partial with blocker class ignored_or_untracked_references.

**Expected State:**

Research artifacts should cite tracked, durable evidence or explicitly classify
ignored/local evidence as non-portable.

**Evidence Basis:**

Stale/broad audit references and authority flattening are identified failure
modes. The validator itself is the right primitive, but source docs still contain
non-portable citations.

**Code Evidence:**

- scripts/validate-audit-references.cjs:281-320
- command result from this audit

**Risk:**

Future readers cannot reproduce audit evidence from a clean checkout.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Either promote the referenced implementation note into a tracked Markdown summary
or change the evidence report to classify the ignored HTML note as local-only
supporting material, not primary evidence.

**Suggested Software / Method:**

Audit-reference validator, tracked Markdown summaries, source-role metadata.

**Files Likely To Change:**

- .harness/research/deep/2026-05-24-jamie-craik-operational-telemetry-evidence.md
- possibly .harness/implementation-notes tracked summary

**Validation Command:**

node scripts/validate-audit-references.cjs .harness/research/deep/2026-05-24-jamie-craik-operational-telemetry-evidence.md --json

**Acceptance Criteria:**

- No missing, ignored, or untracked primary evidence refs.
- Local-only refs are either removed or explicitly classified outside the
  validator's primary evidence set.

### GAP-010: Architecture Enforcement Is Real But Narrow

**Category:** architecture

**Current State:**

scripts/check-architecture-rules.cjs:10-17 enforces cycles, command
cross-imports, auth crypto warnings, GitHub lib filesystem imports, and diagram
freshness. The audit run passed with 4 warnings for auth-boundary commands.

**Expected State:**

Mechanical architecture enforcement should cover all critical layer boundaries
and make warnings actionable or baselined with owner/reason/date.

**Evidence Basis:**

The improve-codebase-architecture skill emphasizes deep modules, information
hiding, and agent-safe boundaries. The evidence report emphasizes seam discovery
before mutation.

**Code Evidence:**

- scripts/check-architecture-rules.cjs:10-17
- scripts/check-architecture-rules.cjs:56-79
- scripts/check-architecture-rules.cjs:262-308
- pnpm architecture:check output

**Risk:**

Warnings can normalize architecture debt. Hand-written import parsing can miss
new TypeScript syntax or semantic boundaries.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**

Add a boundary manifest for core layers and use dependency-cruiser as the first
import-graph engine, with the existing Node script as the fail-closed wrapper.
Model forbidden dependencies as named rules with error severity where possible,
configure tsConfig resolution explicitly, and reserve ts-morph for semantic checks
that dependency-cruiser cannot express. Convert repeated warnings into baselined
exceptions with owner/reason/date or errors.

**Suggested Software / Method:**

dependency-cruiser forbidden rules, TypeScript tsConfig resolution, ts-morph for
semantic-only checks, existing Node script as fail-closed wrapper. Avoid adding
madge unless a second graph engine is needed for a specific blind spot.

**Files Likely To Change:**

- scripts/check-architecture-rules.cjs
- .architecture.yml
- .architecture-baseline.txt
- src/lib/architecture/module-boundaries.test.ts

**Validation Command:**

pnpm architecture:check

**Acceptance Criteria:**

- Boundary rules are data-driven.
- Known exceptions have owner/reason/date.
- New unauthorized cross-layer imports fail.

### GAP-011: Tool Availability Is Not Captured As Runtime Truth

**Category:** runtime / recovery

**Current State:**

PR closeout has a limited tool enum at src/lib/pr-closeout/types.ts:214-226 for
codex_env, github_cli, circleci_cli, coderabbit_cli, and snyk_cli. Runtime-card
sources have kinds, but there is no general tool-availability snapshot for
Browser, Linear, MCP, local memory, or subagent runtime health.

**Expected State:**

Tool-dependent validation should start from a runtime capability snapshot and
mark unavailable tools as blockers or deferred evidence.

**Evidence Basis:**

The evidence report identifies runtime tool availability assumption as a failure
mode and recommends a capability snapshot.

**Code Evidence:**

- src/lib/pr-closeout/types.ts:214-226
- src/lib/runtime/runtime-card-validation.ts:58-67
- current subagent coverage failures

**Risk:**

Agents may claim Browser, reviewer, GitHub, Linear, or MCP proof without the tool
being callable in the current runtime.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Introduce runtime-capability-snapshot/v1 and include it in runtime-card and
pr-closeout evidence. Keep it read-only and local: command availability, MCP
availability, subagent role availability, browser availability, credential
presence classification without secret values. Represent capability checks as
available, unavailable, or unknown so dependent validation can block precisely
without turning every missing optional tool into a global failure.

**Suggested Software / Method:**

Node.js probes, command --json, no-secret env inspection, runtime-card source
adapter, Ajv strict validation if the snapshot is stored as a JSON artifact.

**Files Likely To Change:**

- src/lib/runtime/*capability*.ts
- src/commands/runtime-card.ts
- src/lib/pr-closeout/types.ts
- runtime-card/pr-closeout tests

**Validation Command:**

pnpm vitest run src/lib/runtime/*.test.ts src/lib/pr-closeout/*.test.ts

**Acceptance Criteria:**

- Tool-dependent proof includes capability state.
- Missing capability blocks only dependent validation.
- Secrets are never printed.

### GAP-012: Delivery Truth Is PR-Closeout Scoped Instead Of General Claim Scoped

**Category:** claim-vs-evidence / governance

**Current State:**

pr-closeout/v1 is strong, but there is no general delivery-truth/v1 receipt for
non-PR claims such as ROOT tidy, project scaffold sorted, goal complete, main
pulled, branch cleaned, or Judge/PM audit ready.

**Expected State:**

Any high-risk closeout phrase should compile to required evidence surfaces and
fail closed if unsupported.

**Evidence Basis:**

The evidence report says the central failure pattern is claim-vs-evidence drift
and recommends delivery-truth/v1.

**Code Evidence:**

- src/lib/pr-closeout/types.ts:96-116
- src/lib/pr-closeout/evaluator.ts:59-141
- no delivery-truth/v1 source found

**Risk:**

The repo can correctly block PR false-readiness while still allowing false claims
about root hygiene, branch cleanup, goal status, or audit completion.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Create delivery-truth/v1 as an internal schema and CLI/report adapter that can be
invoked by harness next, runtime-card, pr-closeout, and docs gates. Use a
discriminated claim model so each closeout phrase maps to pass, fail, blocked, or
unknown evidence with required source, freshness, head SHA or explicit n.a. reason,
and blocker class.

**Suggested Software / Method:**

Zod safeParse-style discriminated unions for in-process claim validation, JSON
Schema plus Ajv strict mode if receipts are written as stable artifacts,
runtime-card adapter, pr-closeout adapter, claim-language linter.

**Files Likely To Change:**

- src/lib/delivery-truth/*
- src/commands/delivery-truth.ts or internal command spec
- src/commands/next-runner.ts
- src/lib/pr-closeout/*
- tests and CLI docs

**Validation Command:**

pnpm vitest run src/lib/delivery-truth/*.test.ts src/commands/*delivery*.test.ts

**Acceptance Criteria:**

- Claims map to required evidence surfaces.
- Unsupported complete, ready, green, merged, and tidy claims fail with missing
  evidence.
- Blocked, failed, and unknown claims are distinct and machine-readable.
- PR closeout can embed or reference delivery-truth receipts.

## 5. Contradictions

### CONTRADICTION-001: Evidence Promotion Claims Runtime Proof, Default Gate Skips Runtime Proof

**Claim:**

Implementation-backed/adopted research patterns imply executable enforcement or
runnable proof.

**Actual Implementation:**

pnpm check runs node scripts/validate-evidence-patterns.cjs without
--strict-adopted or --run-validation-commands, and the validator defaults those
modes to false.

**Evidence:**

- package.json:50
- package.json:78
- scripts/validate-evidence-patterns.cjs:36-45
- audit command returned validationCommands: []

**Severity:** High

**Operational Impact:**

Agents can cite adopted evidence as implemented while CI only checked the
manifest shape.

**Recommended Fix:**

Make strict adopted validation the default CI path and add explicit exceptions.

### CONTRADICTION-002: Root Classification Says No Legacy Drift Remains, But No Validator Proves It

**Claim:**

docs/architecture/root-surface-classification.md:54 and
docs/architecture/root-surface-classification.md:63 say no legacy/drift entries
remain at root after the slice.

**Actual Implementation:**

The classification is prose/table-driven. No script compares it to tracked
top-level files/directories.

**Evidence:**

- docs/architecture/root-surface-classification.md:47-63
- no root-hygiene validator found by repo search

**Severity:** High

**Operational Impact:**

Future root drift may not be caught, and agents can again overclaim ROOT tidy.

**Recommended Fix:**

Add root-hygiene-classification/v1 and a package gate.

### CONTRADICTION-003: Artifact-First Review Is Required, But Current Subagent Flow Returned Mailbox Text

**Claim:**

Reviewer outputs should be artifact-first and mailbox text is not proof.

**Actual Implementation:**

For this audit, requested reviewers produced no artifact files. One returned
useful mailbox findings, one was blocked, and one did not execute the task.

**Evidence:**

- scripts/validate-reviewer-coverage.cjs:213-223 marks mailbox-only as missing
- current subagent outputs

**Severity:** Medium

**Operational Impact:**

Audit confidence becomes coordinator-dependent unless a manifest gate records the
coverage gap.

**Recommended Fix:**

Generate and validate reviewer manifests for any requested reviewer set.

### CONTRADICTION-004: Runtime Card Is Valid But Not Sufficient For Claiming Completion

**Claim:**

Runtime cards provide current runtime truth.

**Actual Implementation:**

The runtime-card generated in this audit is schema-valid and reports no blockers,
while Linear freshness is unknown, PR state is null, and phase exit is not run.

**Evidence:**

- src/lib/runtime/local-runtime-card-assembly.ts:67-77
- runtime-card command output from this audit

**Severity:** Medium

**Operational Impact:**

Schema validity can be mistaken for evidence sufficiency.

**Recommended Fix:**

Separate orientation validity from claim sufficiency through required freshness
or claim-mode blockers.

## 6. Missing Features

Runtime state:

- delivery-truth/v1 for non-PR closeout claims.
- runtime-capability-snapshot/v1 for tool, MCP, browser, subagent, and credential
  availability.
- Required-freshness profile for runtime-card consumers.

Command selection:

- Scenario fixtures proving harness next routes evidence-led audits, root
  cleanup, PR closeout, and repeated steering to the right command and gates.
- Richer internal command recommendation metadata for required live evidence.

Verification:

- Adopted evidence command execution in default CI.
- Claim-language linter for unsupported complete, ready, green, merged, and tidy
  claims.
- Manifest-backed reviewer coverage in standard review workflows.

Validation:

- Root-hygiene classification validator.
- Source-role/authority metadata validator.
- Evidence-pattern rejected/deferred distinction tests.

Architecture enforcement:

- Data-driven layer boundary manifest.
- Semantic import graph validation beyond hand-written regex parsing.
- Warning ownership/baselining for architecture warnings.

Traces:

- Command-spec run-record policy.
- Default run-record emission for claim-making or mutating commands.
- End-to-end run-record fixture for next -> validation-plan -> closeout.

Context:

- Hot/cold context validator that preserves authority role.
- Research-to-rule promotion workflow.
- Context-budget or source-selection tests for agent-facing command output.

Skills:

- Skill density/inventory check for overlap and workflow win conditions.
- Skill-eval fixture for repeated steering capture and artifact-first review.

Recovery:

- Shared retry-budget and repeated-error research receipt across CLI commands.
- Runtime capability fallback classification.
- Dirty-worktree ledger for branch cleanup and destructive action requests.

Governance:

- Destructive-action receipt for deletion/branch/worktree cleanup commands.
- Approval boundary modeled in repo artifacts, not only external runtime policy.
- Revocation path and human override metadata for automation policies.

CI/CD:

- Strict evidence validation in pnpm check.
- Root-hygiene classification in docs/root gate.
- Reviewer coverage gate when a manifest is present.

Observability:

- Capability snapshot and run-record policy emitted in JSON reports.
- Machine-readable closeout of validation command outcomes.

## 7. Fix Roadmap

### Phase 1 — Critical Trust Boundary Fixes

**Objective:**

Reduce false-success, stale-state, unsafe-command, and missing-evidence risk.

**Fixes Included:**

- GAP-001: strict adopted evidence validation.
- GAP-004: root-hygiene classification validator.
- GAP-005: runtime-card claim-mode/live-freshness blockers.
- GAP-008: reviewer coverage manifest coupling.
- GAP-012: first minimal delivery-truth/v1 for claim language.

**Files Likely Affected:**

- package.json
- scripts/validate-evidence-patterns.cjs
- scripts/validate-root-hygiene-classification.cjs
- docs/architecture/root-surface-classification.md
- src/lib/runtime/*
- src/commands/runtime-card.ts
- src/lib/delivery-truth/*

**Validation Gates:**

- node scripts/validate-evidence-patterns.cjs --strict-adopted --json
- node scripts/validate-root-hygiene-classification.cjs --json
- pnpm vitest run src/lib/runtime/*.test.ts src/lib/delivery-truth/*.test.ts
- pnpm run docs:steering:guard

**Expected Risk Reduction:**

False proof and overclaiming risk drops substantially because claims must be
backed by executed proof or explicit blockers.

### Phase 2 — Mechanical Enforcement

**Objective:**

Move architecture and authority rules from prose into structural gates.

**Fixes Included:**

- GAP-003: rejected/deferred evidence distinction.
- GAP-010: data-driven architecture boundary manifest.
- Source-role/authority metadata validator.
- Warning ownership for architecture warnings.

**Files Likely Affected:**

- scripts/check-architecture-rules.cjs
- .architecture.yml
- .architecture-baseline.txt
- scripts/validate-evidence-patterns.cjs
- .harness/research/evidence-patterns.json

**Validation Gates:**

- pnpm architecture:check
- node scripts/validate-evidence-patterns.cjs --json
- bash scripts/validate-codestyle.sh --fast

**Expected Risk Reduction:**

Boundary drift becomes visible earlier and authority states remain machine
distinguishable.

### Phase 3 — Runtime Harness Maturity

**Objective:**

Make runtime evidence replayable and failure handling uniform.

**Fixes Included:**

- GAP-007: command-spec run-record policies.
- Shared retry/attempt ledger for command registry.
- Runtime capability snapshot integration.

**Files Likely Affected:**

- src/lib/cli/*
- src/lib/contract/run-record-*.ts
- src/commands/*
- src/lib/runtime/*

**Validation Gates:**

- pnpm vitest run src/lib/contract/run-records.test.ts src/lib/cli/*.test.ts
- pnpm test:artifacts

**Expected Risk Reduction:**

Claims and failures become replayable across sessions instead of dependent on
transient terminal output.

### Phase 4 — Context and Skill Compression

**Objective:**

Keep agent-facing context small while preserving authority boundaries.

**Fixes Included:**

- Command routing fixtures for harness next.
- Source-role metadata for research/notes/specs/validators.
- Skill density and workflow win-condition fixtures.

**Files Likely Affected:**

- src/commands/next-runner.ts
- src/lib/context*
- .harness/research/evidence-patterns.json
- skill validation scripts and fixtures

**Validation Gates:**

- pnpm vitest run src/commands/next*.test.ts
- pnpm skill:validate
- pnpm workflow:validate

**Expected Risk Reduction:**

Agents are less likely to retrieve stale or low-authority material as operative
instruction.

### Phase 5 — Governance and Scaling

**Objective:**

Make approval, destructive action, and multi-agent scaling auditable.

**Fixes Included:**

- Destructive-action receipt.
- Reviewer manifest generation in review workflows.
- Human override and revocation metadata for automation policies.
- CI check parity between generated contracts and live required checks.

**Files Likely Affected:**

- harness.contract.json
- .harness/ci-required-checks.json
- src/lib/pr-closeout/*
- scripts/validate-reviewer-coverage.cjs
- governance docs

**Validation Gates:**

- pnpm codestyle:parity
- pnpm codex:agents:guard
- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- bash scripts/verify-work.sh --fast

**Expected Risk Reduction:**

Broader Codex autonomy can scale without collapsing into untracked reviewer,
permission, or deletion decisions.

## 8. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
| --- | --- | --- | --- | --- | --- |
| 1 | Make adopted evidence validation execute proof by default | High | Medium | False-success evidence promotion | It fixes an active failing trust boundary in pnpm check. |
| 2 | Add root-hygiene classification validator | High | Medium | ROOT/scaffold overclaiming | It directly addresses repeated user steering and current docs-only status. |
| 3 | Add runtime-card claim mode requiring live freshness | High | Medium | Stale-state closeout | Runtime-card already exists; this sharpens sufficiency. |
| 4 | Add minimal delivery-truth/v1 | High | High | Unsupported completion claims | It generalizes strong PR closeout discipline beyond PRs. |
| 5 | Require reviewer coverage manifests for requested swarms | High | Low | Mailbox-only review proof | The validator already exists; workflow coupling is missing. |
| 6 | Preserve rejected evidence status | Medium | Low | Authority flattening | Small change, clear governance benefit. |
| 7 | Add runtime capability snapshot | Medium | Medium | Claimed-but-unavailable tool proof | Current subagent failure shows why this matters. |
| 8 | Add command run-record policy | Medium | High | Non-replayable claim paths | Existing run-record primitives can be reused. |
| 9 | Add architecture boundary manifest | Medium | Medium | Narrow custom architecture enforcement | Makes architecture checks easier to evolve. |
| 10 | Add next routing scenario fixtures | Medium | Medium | Thin rail misrouting | Since only next is public to agents, routing tests are high leverage. |

## 9. Implementation Advice

Build first:

- Tighten research:evidence:validate and add the root-hygiene validator. These
  are small, deterministic, and directly tied to observed failures. Implement
  them as schema-backed contracts first, then generate or verify human-facing
  Markdown from those contracts.

Do not build yet:

- A broad multi-service orchestration layer for every external truth surface.
  First make delivery-truth/v1 compile local/runtime/PR/Linear evidence from
  already existing adapters.
- A new observability stack as the primary proof store. Keep JSONL/hash-chained
  receipts canonical, then export them to OpenTelemetry if cross-system
  correlation becomes necessary.

Remove or simplify:

- Do not keep rejected evidence collapsed into deferred status. That
  simplification destroys governance intent.
- Do not add more root cleanup prose without a validator.

Should become a validator:

- Root-hygiene classification.
- Claim-language support for complete, ready, green, merged, and tidy.
- Review-swarm artifact coverage.
- Evidence-pattern strict proof execution.
- Architecture boundary manifest rules backed by dependency-cruiser.

Should become a schema:

- delivery-truth/v1
- runtime-capability-snapshot/v1
- root-hygiene-classification/v1
- scope-authority/v1
- reviewer-coverage-receipt/v1

Should become a skill:

- Evidence-led audit could become a bounded skill only after the validator stack
  exists. The skill should orchestrate probes and output, not define authority in
  prose.

Should become documentation:

- The draft/tracked policy for .harness/research/deep.
- When local runtime-card evidence is sufficient for orientation versus
  insufficient for closeout.

Should become CI:

- Strict adopted evidence validation.
- Root-hygiene classification.
- Reviewer coverage when a manifest is present.
- Architecture boundary manifest validation.
- Audit-reference validation for promoted research artifacts.

Should remain manual:

- Final Judge/PM audit.
- Explicit destructive cleanup approval.
- High-risk autonomy expansion and override decisions.

## 10. Final Recommendation

Immediate next action:

- Patch research:evidence:validate so implementation-backed/adopted evidence
  cannot pass without executed proof or an explicit tracked exception.

Safest first patch:

- Add tests around scripts/validate-evidence-patterns.cjs for strict adopted
  validation using pass/fail/blocked fixtures, then update package.json:78 to use
  the strict mode once the current local-in-progress evidence policy is resolved.

Highest-risk missing system:

- delivery-truth/v1. PR closeout is strong, but the same claim-vs-evidence
  discipline is not yet generalized to ROOT, scaffold, branch cleanup, goal
  status, and audit completion claims.

Best validation command to add first:

- node scripts/validate-root-hygiene-classification.cjs --json. Implement it
  against root-hygiene-classification/v1 JSON first, validate the schema in strict
  mode, and treat the Markdown document as synchronized presentation.

Readiness for broader Codex autonomy:

- Not yet ready for broad autonomy. The project is ready for bounded autonomy on
  low/medium-risk slices where harness next, runtime-card, pr-closeout, and
  existing validators provide deterministic evidence. Broader autonomy should
  wait until adopted evidence proof execution, root-hygiene validation,
  delivery-truth receipts, reviewer coverage manifests, and capability snapshots
  are enforced.
