# Evidence-Led Codebase Gap Audit

Date: 2026-05-22

Target repository: coding-harness

Primary evidence documents:

- .harness/research/deep/2026-05-22-harness-source-synthesis-evidence.md
- .harness/research/evidence-patterns.json

Skills applied:

- improve-codebase-architecture: live architecture walk, deep-module and boundary framing.
- testing: smallest meaningful proof, reachable validation, and blocked-proof classification.
- coding-harness: source-repo command truth, harness next, runtime-card, evidence and governance surfaces.

Researcher coverage:

- Requested researchers: agent-native-reviewer, api-contract-reviewer, adversarial-reviewer.
- Runtime result: blocked_runtime. Fresh reviewer agents did not produce the requested dated artifact reports before timeout or closure, so this audit does not use mailbox text as completion evidence.
- Audit impact: reviewer swarm reliability is recorded as GAP-012. Findings below rely on direct code-tree inspection and runnable commands.

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
- [Validation Evidence](#validation-evidence)

## 1. Executive Summary

Overall maturity grade: C+.

The codebase is not a blank slate. It already has real harness foundations:
runtime-card/v1, runtime-evidence-bundle/v1, pr-closeout/v1, harness next,
command catalogs, Project Brain scaffolding, evidence-pattern validation,
architecture checks, memory gates, CircleCI governance lanes, and JSONL run
records. The main gap is not vocabulary. The main gap is that several
evidence-derived claims are still optional, partially wired, or split across
docs, tests, and scripts rather than enforced as one reachable runtime
contract.

Top 5 gaps:

1. Adopted research validation is too weak by default. Every adopted pattern has
   a validationCommand, but scripts/validate-evidence-patterns.cjs does not run
   those commands unless --run-validation-commands is passed.
2. Runtime evidence source merging can hide worse evidence. The adapter
   prepends synthetic provenance and keeps the first duplicate source kind/ref,
   so real blocked evidence with the same identity can be shadowed.
3. Linear evidence matching is case-sensitive in runtime-card assembly.
   Evidence issue keys that differ only by case are discarded into fallback
   unknown state.
4. session-closeout/v1 and harness-run/v1 exist in code/tests but are not yet a
   visible closeout-grade CLI gate or required operational proof path.
5. Reviewer swarm artifact contracts are documented but not mechanically
   verified by a first-class receipt, so requested reviewers can fail silently
   unless the coordinator manually notices.

Top 5 risks:

1. False success: adopted research can be marked implemented without proving its
   target validation command.
2. Stale state: audit and closeout claims can cite files that no longer exist
   unless reference verification is part of the gate.
3. Blocker masking: runtime-card source deduplication can preserve the more
   optimistic synthetic source and drop a later blocked one.
4. Unreachable assurance: schemas and tests for session closeout can look mature
   while no routine command path requires them.
5. Agent coordination drift: subagent review coverage can be treated as done
   from status text rather than artifact evidence.

Strongest existing foundations:

1. harness next produces a live decision packet from git state and command
   catalog evidence.
2. runtime-card/v1 and runtime-evidence-bundle/v1 are implemented with schema
   validation and tests.
3. pr-closeout/v1 carries claim-vs-evidence fields, blocker classification, head
   SHA, freshness, and live GitHub probing.
4. The command registry exposes mode-specific agent catalogs and expected
   artifacts.
5. Architecture enforcement is reachable through scripts/check-architecture-rules.cjs
   and module-boundary tests wired into the repo gate family.

Highest-leverage next fixes:

1. Make adopted evidence validation executable by default in a strict mode and
   wire that strict mode into the relevant check lane.
2. Fix runtime evidence merge precedence so blocked or worse freshness evidence
   cannot be hidden by synthetic provenance.
3. Normalize issue-key comparisons in runtime-card assembly.
4. Promote session-closeout/v1 or harness-run/v1 into a visible closeout command
   or required pr-closeout evidence input.
5. Add reviewer-coverage-receipt/v1 for requested subagent artifacts.

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
|---|---|---|---|---|---|
| Repository as Control Plane | B | High | AGENTS, CODESTYLE, Project Brain, evidence manifest, goals, implementation notes, CI contracts, and architecture artifacts exist. | Active evidence can remain docs-only or validated only by metadata. | Add strict evidence adoption validation and audit reference checks. |
| Runtime Truth and Decision Packets | B- | High | harness next and runtime-card/v1 produce current local state packets. | Some provider evidence is optional and source merging can preserve optimistic duplicates. | Harden runtime evidence adapter and issue-key normalization. |
| Claim-vs-Evidence Verification | C+ | High | pr-closeout/v1 blocks missing required closeout evidence and supports live PR checks. | Research adoption, reviewer coverage, and audit references are not equally enforced. | Extend evidence gates and add reviewer coverage receipts. |
| Mechanical Architecture Enforcement | B- | High | architecture check passes with warning output; module boundary tests exist. | Auth-boundary crypto rule is advisory and high-value checks are split across scripts and tests. | Convert critical warnings into explicit allowlisted delegation checks. |
| Harness Runtime Loop | C | Medium | attempt ledger and recovery events exist for runtime-card paths. | No unified retry budget or recovery handler across critical commands. | Add command-run attempts and stop reasons to run records. |
| Trace and Session Evidence | C | High | agent-run-event/v1, agent-run-manifest/v1, harness-run/v1, and session-closeout/v1 exist. | Some are tested but not required by a visible closeout lane. | Promote harness-run/session-closeout into CLI or pr-closeout requirements. |
| Context Engineering | B- | Medium | Evidence manifest separates adopted and deferred research; .harness is the portable context namespace. | Hot/cold context and source promotion are not enforced beyond the manifest. | Add context index and strict adopted-pattern target classification. |
| Skills and Workflow Density | C+ | Medium | Skills are present and command catalogs are mode-specific. | Default agent catalog exposes only next, which is safe but too thin for first-contact discovery. | Add mode hints or a compact default rail with commands and runtime-card. |
| Recovery and Failure Handling | C | Medium | Worktree, hook, runtime-card, remediation, and verify-work recovery surfaces exist. | Repeated retry prevention is not a central runtime invariant. | Add retry-classification events and a blind-retry guard. |
| Governance and Safety | B | High | Secret handling, permissions, branch protection, CircleCI ownership, Semgrep/Snyk, and PR closeout contracts are documented and partially enforced. | Approval and reviewer coverage evidence still rely on coordinator discipline. | Add structured approval/reviewer receipts and enforce in closeout-grade checks. |

## 3. Evidence-to-Code Mapping

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
|---|---|---|---|---|---|
| Environment-first harness engineering | 2026-05-22-harness-source-synthesis-evidence.md, Environment-First Harness Engineering | AGENTS.md, .harness/README.md, scripts/validate-evidence-patterns.cjs, src/commands/next-support.ts | partial | B- | High |
| Outer harness loop owns completion | Source synthesis, Outer Harness Loop Owns Completion | src/commands/pr-closeout/live.ts, src/lib/pr-closeout/claims.ts, src/lib/runtime/local-runtime-card.ts | implemented_not_enforced | C+ | High |
| Verification is autonomy boundary | Source synthesis, Verification Is The Autonomy Boundary | scripts/verify-work.sh, pnpm check, src/commands/evidence-verify.ts | partial | B- | High |
| Specification as executable control plane | Source synthesis, Specification As Executable Control Plane | .harness/research/evidence-patterns.json, scripts/validate-evidence-patterns.cjs | implemented_not_enforced | C | High |
| Deep modules with small facades | Source synthesis, Deep Modules With Small Agent-Facing Facades | src/commands/* facades, src/lib/* domain modules, module-boundary tests | partial | B- | Medium |
| Runtime observability as feedback loop | Source synthesis and attached observability diagrams | runtime-card, runtime-evidence-bundle, pr-closeout live probes | partial | C | Medium |
| Chrome or browser validation loop | Attached DevTools diagram | No first-class browser validation command found for general harness proof | missing | D | Medium |
| Context compression and knowledge encoding | Source synthesis, limits of agent knowledge diagram | .harness/research/evidence-patterns.json, docs/goals/jsc-331-trust-boundary-governed-implementation/goal.md | partial | C+ | High |
| Claim-vs-evidence verification | Source synthesis, Failure Modes And Mitigations | pr-closeout/v1, evidence-verify, runtime-card | partial | C+ | High |
| Reviewer swarm artifact-first outputs | AGENTS review swarm contract | Subagent contract in instructions; no dated artifacts for this run | non_enforced | D | High |
| Session closeout | Repo source inspection | src/lib/session/session-closeout.ts and tests | tested_but_unreachable | C- | High |
| Harness run projection | Repo source inspection | src/lib/contract/harness-run.ts and tests | implemented_not_enforced | C | High |

## 4. Gap Register

### GAP-001: Adopted research validation commands are optional

**Category:** validation / governance

**Current State:** scripts/validate-evidence-patterns.cjs requires every
pattern to declare validationCommand. It only executes those commands when
--run-validation-commands is passed. The source synthesis pattern is marked
adopted and points at goal/module-layout surfaces, but its validationCommand is
only the metadata validator.

**Expected State:** Adopted research should have a strict validation mode that
runs or verifies the declared validation command before implementation claims
are considered current.

**Evidence Basis:** Source synthesis says adopted patterns need status, owner,
target surfaces, validation command, and an executable authority boundary.

**Code Evidence:** scripts/validate-evidence-patterns.cjs parses
--run-validation-commands and conditionally executes commands. The manifest
entry 2026-05-22-harness-source-synthesis is status adopted.

**Risk:** The repo can claim a research pattern is adopted while only proving
that metadata fields exist.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:** Add a strict adopted mode, for example
node scripts/validate-evidence-patterns.cjs --strict-adopted --json, that runs
validationCommand for adopted entries or verifies a recent validation receipt.
Wire it into pnpm check or the relevant docs/steering gate.

**Suggested Software / Method:** Node validator, JSON receipt, jq-readable
output, CircleCI docs or memory lane.

**Files Likely To Change:** scripts/validate-evidence-patterns.cjs,
package.json, .circleci/config.yml, docs/agents/04-validation.md,
.harness/research/evidence-patterns.json.

**Validation Command:** node scripts/validate-evidence-patterns.cjs
--strict-adopted --json

**Acceptance Criteria:** Adopted entries fail when their validation command is
missing, fails, is stale, or targets only narrative surfaces without an explicit
docs_only classification.

### GAP-002: Runtime evidence source dedupe can mask blockers

**Category:** runtime / traceability

**Current State:** src/lib/runtime/runtime-evidence-adapter.ts prepends a
synthetic runtime_evidence source and then deduplicates sources by kind/ref,
keeping the first occurrence. If the bundle also contains a source with the
same identity but worse freshness or blocked status, the adapter can keep the
synthetic source.

**Expected State:** Source merging should preserve the most conservative
evidence, not merely the first source. Blocked, stale, or failed evidence should
win over current/usable evidence for the same identity.

**Evidence Basis:** Source synthesis emphasizes runtime truth, blocker
detection, claim-vs-evidence verification, and traceable evidence packets.

**Code Evidence:** src/lib/runtime/runtime-evidence-adapter.ts uniqueSources
uses first occurrence. The producer has a similar first-wins dedupe in
src/lib/runtime/runtime-evidence-producer.ts.

**Risk:** A runtime card can look more usable than the underlying source bundle.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:** Replace first-wins dedupe with severity-aware merge:
blocked beats usable, stale beats current only when paired with worse status,
and richer metadata should be merged rather than dropped.

**Suggested Software / Method:** Pure TypeScript comparator plus Vitest
regression fixtures.

**Files Likely To Change:** src/lib/runtime/runtime-evidence-adapter.ts,
src/lib/runtime/runtime-evidence-producer.ts,
src/commands/runtime-card.test.ts,
src/lib/runtime/local-runtime-card.test.ts.

**Validation Command:** pnpm vitest run src/commands/runtime-card.test.ts
src/lib/runtime/local-runtime-card.test.ts

**Acceptance Criteria:** A duplicate source with blocked status appears in the
runtime card as blocked and cannot be hidden by synthetic provenance.

### GAP-003: Runtime-card Linear evidence matching is case-sensitive

**Category:** runtime / stale-state

**Current State:** src/lib/runtime/local-runtime-card-assembly.ts uses a strict
string equality check between args.evidence.linear.issueKey and args.issueKey.
detectIssueKey normalizes detected keys to uppercase, but external bundle
inputs can still differ by case.

**Expected State:** Issue-key comparisons should normalize case before deciding
whether to accept provider evidence.

**Evidence Basis:** The source synthesis calls stale-state prevention and
runtime decision packets critical harness requirements.

**Code Evidence:** local-runtime-card-assembly.ts lines around the linear
assignment compare raw strings.

**Risk:** Valid Linear evidence can be discarded, causing unknown freshness or
missing blocker state.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Normalize both issue keys with the same helper before
comparison and add a regression for lowercase evidence bundle issue keys.

**Suggested Software / Method:** Small TypeScript helper and Vitest fixture.

**Files Likely To Change:** src/lib/runtime/local-runtime-card-assembly.ts,
src/lib/runtime/local-runtime-card.test.ts.

**Validation Command:** pnpm vitest run src/lib/runtime/local-runtime-card.test.ts

**Acceptance Criteria:** Runtime card accepts evidence for jsc-311 when the
card issue key is JSC-311 and marks mismatched issue keys as fallback only when
they differ semantically.

### GAP-004: session-closeout/v1 is tested but unreachable

**Category:** traceability / governance

**Current State:** src/lib/session/session-closeout.ts and
src/lib/session/session-closeout.test.ts exist. Search did not find a visible
CLI command or closeout path that requires this artifact.

**Expected State:** Session closeout should be reachable from a command or a
required pr-closeout input when the user asks for delivery closeout.

**Evidence Basis:** Source synthesis says final status records, replayable
evidence, and closeout proof define trustworthy agent completion.

**Code Evidence:** session-closeout/v1 is present in library code and tests but
not found in command registry paths.

**Risk:** The schema can pass tests without affecting real handoff behavior.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Add harness session-closeout emit or integrate
session-closeout/v1 as an accepted pr-closeout evidence artifact.

**Suggested Software / Method:** CLI command spec, JSON Schema validation,
Vitest CLI fixture.

**Files Likely To Change:** src/lib/session/session-closeout.ts,
src/lib/cli/registry/command-capability-rules.ts, src/commands/pr-closeout.ts,
src/commands/pr-closeout.test.ts.

**Validation Command:** pnpm vitest run src/lib/session/session-closeout.test.ts
src/commands/pr-closeout.test.ts

**Acceptance Criteria:** A closeout command can emit or validate
session-closeout/v1, and missing required fields block closeout.

### GAP-005: harness-run/v1 projection is not an operational gate

**Category:** traceability / claim-vs-evidence

**Current State:** src/lib/contract/harness-run.ts builds a derived
harness-run/v1 read model and validates exit/status consistency. It is useful,
but not yet a required command or PR closeout input.

**Expected State:** Critical harness commands should produce or accept a
harness-run/v1 projection so command outcomes become replayable.

**Evidence Basis:** Runtime observability and claim-vs-evidence patterns call
for trace/session evidence, command outputs, verifier results, and final status
records.

**Code Evidence:** src/lib/contract/run-record-emitter-core.ts writes
agent-run-manifest/v1 and agent-run-event/v1. src/lib/contract/harness-run.ts
derives harness-run/v1. Command registry integration was not found.

**Risk:** Run evidence remains an internal capability instead of a routine
handoff proof.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Add an evidence-verify or pr-closeout mode that accepts
harness-run/v1 and enforces success/exit consistency for closeout-grade claims.

**Suggested Software / Method:** Existing harness-run validator, pr-closeout
claim matrix, JSON artifact fixtures.

**Files Likely To Change:** src/commands/evidence-verify.ts,
src/commands/pr-closeout.ts, src/lib/contract/harness-run.ts tests.

**Validation Command:** pnpm vitest run src/commands/evidence-verify.test.ts
src/commands/pr-closeout.test.ts

**Acceptance Criteria:** A failed run cannot satisfy a pass claim, and a
successful run with missing verifier references is classified as blocked or
unknown.

### GAP-006: Default agent command catalog is too thin

**Category:** context / skills

**Current State:** The default for-agent command catalog exposes only next.
Mode-specific catalogs expose runtime-card, commands, validation-plan,
evidence-verify, review-context, review-gate, and pr-closeout.

**Expected State:** First-contact catalog should stay compact but make the
available modes discoverable without requiring the agent to guess flags.

**Evidence Basis:** The source synthesis favors compact context and dense,
executable skills over broad prompt prose.

**Code Evidence:** src/lib/cli/registry/command-capability-rules.ts defines
AGENT_CATALOG_COMMAND_NAMES.default as next only.

**Risk:** Agents can miss the executable surfaces that would reduce narrative
guessing.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Keep default safe, but add mode hints or include commands
and runtime-card in the default for-agent rail with concise descriptions.

**Suggested Software / Method:** Command registry metadata and snapshot tests.

**Files Likely To Change:** src/lib/cli/registry/command-capability-rules.ts,
src/lib/cli/command-registry.test.ts.

**Validation Command:** pnpm vitest run src/lib/cli/command-registry.test.ts

**Acceptance Criteria:** harness commands --json --for-agent shows next plus a
machine-readable explanation of available modes or includes runtime-card and
commands by default.

### GAP-007: Auth-boundary architecture rule is advisory

**Category:** architecture / security

**Current State:** node scripts/check-architecture-rules.cjs --format json
passes but emits four warnings for auth-boundary commands that do not directly
import node:crypto. The warning asks humans to verify delegated signing.

**Expected State:** If delegated crypto is allowed, the architecture rule should
verify that delegation mechanically, or the rule should fail for direct
violations with an allowlist.

**Evidence Basis:** The evidence calls for mechanical architecture enforcement
and deterministic guardrails over reminders.

**Code Evidence:** Warnings for src/commands/ci-migrate.ts,
src/commands/check-authz.ts, src/commands/branch-protect.ts, and
src/commands/evidence-verify.ts.

**Risk:** Auth/security boundaries can drift while the architecture gate still
passes.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Add an explicit delegated-crypto allowlist that points to
the lib module providing signing or hashing, and fail when the command has
neither a direct import nor a valid delegated proof.

**Suggested Software / Method:** Static import graph check, JSON allowlist,
ts-morph or dependency-cruiser if needed.

**Files Likely To Change:** scripts/check-architecture-rules.cjs,
docs/architecture/module-boundaries.md, tests for architecture rules.

**Validation Command:** node scripts/check-architecture-rules.cjs --format json

**Acceptance Criteria:** Current legitimate delegations pass without warnings;
missing delegation fails.

### GAP-008: Adopted source synthesis targets planning surfaces, not enforcement

**Category:** governance / validation

**Current State:** The 2026-05-22-harness-source-synthesis pattern is adopted,
but its target surfaces are a goal, state file, and module-layout report. Its
validation command is the metadata validator, not an implementation gate.

**Expected State:** An adopted source synthesis should either be classified as
planning_only or point at executable enforcement surfaces for the adopted
patterns.

**Evidence Basis:** The source synthesis warns that plans should reduce future
action ambiguity and that following an audit should not be confused with
implementing missing code.

**Code Evidence:** .harness/research/evidence-patterns.json entry
2026-05-22-harness-source-synthesis.

**Risk:** Adoption language can imply implementation completion.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Extend manifest status or target classification with
planning_adopted, implementation_adopted, and docs_only, then require different
validation for each.

**Suggested Software / Method:** Manifest schema update and validator tests.

**Files Likely To Change:** .harness/research/evidence-patterns.json,
scripts/validate-evidence-patterns.cjs, docs/agents/04-validation.md.

**Validation Command:** node scripts/validate-evidence-patterns.cjs --json

**Acceptance Criteria:** Planning-only adoption is explicit and cannot be
mistaken for implemented_enforced.

### GAP-009: Runtime retry budget is not generalized

**Category:** recovery / runtime

**Current State:** src/lib/runtime/local-runtime-card-attempts.ts attaches an
attempt ledger and recovery event, but the runtime-card path uses a fixed
attempt index and maxAttempts value. Recovery ownership is not a general
command-run invariant.

**Expected State:** Critical harness commands should emit attempt counts, retry
budgets, recovery classification, and stop reasons.

**Evidence Basis:** Ryan, Agent-RFT, and source synthesis patterns emphasize
bounded loops, failure classification, and recovery strategies.

**Code Evidence:** local-runtime-card-attempts.ts hardcodes one attempt in the
runtime-card attachment path.

**Risk:** Repeated failures can degrade into blind retries without a structured
runtime event.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add a reusable command attempt ledger helper and require
critical commands to write retry classification into run records.

**Suggested Software / Method:** JSONL trace events, command wrapper, Vitest
fixtures.

**Files Likely To Change:** src/lib/contract/run-record-emitter-core.ts,
src/lib/runtime/local-runtime-card-attempts.ts, command tests.

**Validation Command:** pnpm vitest run src/lib/contract/harness-run.test.ts src/lib/runtime/local-runtime-card.test.ts

**Acceptance Criteria:** A second repeated failure without classification fails
the guard or emits a blocker event.

### GAP-010: Full observability stack is documented-only

**Category:** observability / traceability

**Current State:** The attached diagrams describe logs, OTLP metrics, OTLP
traces, Vector, Victoria Logs, Victoria Metrics, Victoria Traces, LogQL, PromQL,
TraceQL, and Codex feedback loops. The repo has local runtime evidence
artifacts, but no source-owned Vector/Victoria stack implementation was found.

**Expected State:** For this repo, the immediate need is not to build a full
external observability stack. The need is to keep local JSONL/runtime evidence
queryable and clearly distinguish local evidence completion from external
observability future work.

**Evidence Basis:** Source synthesis says runtime observability matters, while
also warning against confusing future gaps with completed implementation.

**Code Evidence:** runtime-card and run-record code exists. No Vector/Victoria
deployment or query command was found in the inspected source tree.

**Risk:** Status docs may imply broader observability than the repo can prove.

**Severity:** Low

**Fix Grade:** P3

**Recommended Fix:** Add a decision note that local JSONL/runtime-card is the
current source-owned observability layer and external stack integration is a
separate tracked lane.

**Suggested Software / Method:** ADR, harness.contract capability flag, future
validator if implemented.

**Files Likely To Change:** docs/agents/00-architecture-bootstrap.md,
docs/roadmap/agent-first-status.md, harness.contract.json.

**Validation Command:** bash scripts/run-harness-gate.sh docs-gate --mode
required --json

**Acceptance Criteria:** Docs no longer blur local evidence artifacts with the
full external observability stack.

### GAP-011: Audit reference verification is not first-class

**Category:** claim-vs-evidence / validation

**Current State:** This thread previously exposed a browser-loading failure:
the referenced evidence artifact was not available as expected. There is no
dedicated validator that checks audit files for referenced local file existence
and classification.

**Expected State:** Audit artifacts should verify local file references,
validation commands, and claimed runtime statuses before being used as
implementation plans.

**Evidence Basis:** Source synthesis explicitly records the claim-vs-filesystem
failure and says browser-loadable artifacts must be real files.

**Code Evidence:** No audit-reference validator was found. evidence-patterns
validates manifest sources and targets, not arbitrary audit references.

**Risk:** A polished audit can send future agents toward missing files or stale
plans.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Add scripts/validate-audit-references.cjs to scan audit
Markdown for repo-local paths, confirm existence, and require an explicit
missing/future classification for absent paths.

**Suggested Software / Method:** Node Markdown scanner, path allowlist, JSON
output.

**Files Likely To Change:** scripts/validate-audit-references.cjs, package.json,
docs/agents/04-validation.md.

**Validation Command:** node scripts/validate-audit-references.cjs
.harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json

**Acceptance Criteria:** Missing referenced files fail unless explicitly marked
future or external.

### GAP-012: Reviewer swarm coverage is not captured as a receipt

**Category:** governance / review / traceability

**Current State:** The review swarm contract requires artifact-first outputs,
but this run produced no dated reviewer artifacts. The coordinator had to
record that manually.

**Expected State:** Review swarms should produce reviewer-coverage-receipt/v1:
requested roles, completed roles, artifact paths, missing artifacts, retry
attempts, blocker class, and synthesis coverage gap.

**Evidence Basis:** The evidence emphasizes agent coordination logic,
governance, review processes, and structured evidence over conversational
memory.

**Code Evidence:** No reviewer coverage receipt schema or validator was found.
AGENTS defines the policy but not the artifact.

**Risk:** Reviewer absence can disappear into narrative, especially in long
threads.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Add a reviewer coverage receipt schema and validate it in
review/audit workflows when subagents are requested.

**Suggested Software / Method:** JSON artifact, validator, review synthesis
template, optional harness command.

**Files Likely To Change:** src/lib/pr-closeout/claims.ts or
src/lib/contract/harness-run.ts, scripts or commands for review coverage,
docs/agents/07b-agent-governance.md.

**Validation Command:** pnpm vitest run src/lib/pr-closeout.test.ts src/lib/contract/harness-run.test.ts

**Acceptance Criteria:** Missing requested reviewer artifacts become structured
blocked_runtime evidence and cannot be summarized as completed coverage.

## 5. Contradictions

| Claim | Actual Implementation | Evidence | Severity | Operational Impact | Recommended Fix |
|---|---|---|---|---|---|
| Adopted evidence patterns are implementation authority. | validationCommand is required but not run by default. | scripts/validate-evidence-patterns.cjs conditional execution. | High | Adoption can become a label instead of proof. | Add strict adopted validation and CI wiring. |
| Runtime evidence sources preserve current truth. | First-wins source dedupe can keep optimistic synthetic sources. | runtime-evidence-adapter source merging. | High | Blockers can be masked. | Use severity-aware merge. |
| Reviewer swarms require artifact-first outputs. | This run produced no dated reviewer artifacts and no receipt gate. | Requested reviewer artifacts absent. | Medium | Coverage can be overclaimed. | Add reviewer-coverage-receipt/v1. |
| Session closeout is a reusable closeout contract. | session-closeout/v1 is tested but not reachable as a routine command. | src/lib/session/session-closeout.ts plus missing command registry path. | Medium | Closeout assurance stays optional. | Promote into CLI or pr-closeout input. |
| Architecture rules mechanically protect boundaries. | Auth-boundary crypto rule passes with warnings that require human verification. | check-architecture-rules warning output. | Medium | Security delegation can drift. | Add allowlisted delegated proof or fail. |

## 6. Missing Features

Runtime state:

- Strict adopted research validation receipts.
- Runtime-card merge precedence for worse duplicate evidence.
- Case-normalized issue-key matching for provider evidence.

Command selection:

- First-contact command catalog mode hints.
- Explicit strict validation command for evidence adoption.

Verification:

- Audit reference validator.
- Reviewer coverage receipt validator.
- Harness-run acceptance in pr-closeout or evidence-verify.

Validation:

- Strict adopted-pattern gate.
- Critical architecture warnings promoted to enforced checks.

Architecture enforcement:

- Delegated auth crypto proof.
- Unified placement of high-value module boundary checks.

Traces:

- Required harness-run/v1 for closeout-grade claims.
- Reviewer coverage JSON artifact.

Context:

- Hot/cold context index that distinguishes cold research, adopted planning,
  adopted implementation, active goals, and generated artifacts.

Skills:

- Skill density and overlap inventory for repo-local harness skills.
- Artifact-first review workflow guard.

Recovery:

- Generic retry classification events.
- Blind-retry prevention gate.

Governance:

- Approval/reviewer receipt capture.
- Explicit external observability lane classification.

CI/CD:

- Strict evidence-pattern mode wired into check lane.
- Audit reference validator wired into docs or research lane.

Observability:

- Queryable local run evidence index before external Vector/Victoria stack work.

## 7. Fix Roadmap

### Phase 1 - Critical Trust Boundary Fixes

Objective: reduce false-success, stale-state, and missing-evidence risk.

Fixes included:

- GAP-001 strict adopted evidence validation.
- GAP-002 severity-aware runtime evidence source merge.
- GAP-003 case-normalized issue-key matching.
- GAP-011 audit reference validation.

Files likely affected:

- scripts/validate-evidence-patterns.cjs
- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/runtime-evidence-producer.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- scripts/validate-audit-references.cjs
- package.json

Validation gates:

- node scripts/validate-evidence-patterns.cjs --strict-adopted --json
- pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts
- node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-22-evidence-led-codebase-gap-audit.md --json

Expected risk reduction: high. This prevents the most damaging false-success
and stale-state classes.

### Phase 2 - Mechanical Enforcement

Objective: move advisory architecture and planning-only adoption into explicit
machine-readable status.

Fixes included:

- GAP-007 auth-boundary delegation proof.
- GAP-008 manifest status classification.
- GAP-006 compact command catalog mode hints.

Files likely affected:

- scripts/check-architecture-rules.cjs
- .harness/research/evidence-patterns.json
- src/lib/cli/registry/command-capability-rules.ts
- docs/agents/04-validation.md

Validation gates:

- node scripts/check-architecture-rules.cjs --format json
- node scripts/validate-evidence-patterns.cjs --json
- pnpm vitest run src/lib/cli/command-registry.test.ts

Expected risk reduction: medium-high. This turns ambiguous adoption and
architecture reminders into explicit state.

### Phase 3 - Runtime Harness Maturity

Objective: make run evidence, retry classification, and closeout artifacts part
of routine execution.

Fixes included:

- GAP-004 session-closeout CLI or pr-closeout input.
- GAP-005 harness-run/v1 closeout integration.
- GAP-009 generalized retry budget.
- GAP-012 reviewer coverage receipt.

Files likely affected:

- src/commands/pr-closeout.ts
- src/commands/evidence-verify.ts
- src/lib/contract/harness-run.ts
- src/lib/session/session-closeout.ts
- src/lib/runtime/local-runtime-card-attempts.ts
- docs/agents/07b-agent-governance.md

Validation gates:

- pnpm vitest run src/commands/pr-closeout.test.ts src/commands/evidence-verify.test.ts
- pnpm vitest run src/lib/session/session-closeout.test.ts src/lib/contract/harness-run.test.ts

Expected risk reduction: high for delivery lanes, medium for routine research
lanes.

### Phase 4 - Context and Skill Compression

Objective: keep context discoverable without making every artifact hot-path.

Fixes included:

- Hot/cold context index.
- Skill density and overlap inventory.
- Source promotion policy for research-to-code authority.

Files likely affected:

- .harness/research/evidence-patterns.json
- .harness/README.md
- docs/agents/01-instruction-map.md
- docs/agents/03-local-memory.md

Validation gates:

- pnpm run docs:steering:guard
- node scripts/validate-evidence-patterns.cjs --json

Expected risk reduction: medium. This reduces context noise and routing drift.

### Phase 5 - Governance and Scaling

Objective: separate local source-owned proof from external observability and
approval systems.

Fixes included:

- GAP-010 external observability lane classification.
- Approval/reviewer receipts.
- Future Vector/Victoria integration only after local JSONL query layer is
  stable.

Files likely affected:

- harness.contract.json
- docs/roadmap/agent-first-status.md
- docs/agents/06-security-and-governance.md
- docs/agents/00-architecture-bootstrap.md

Validation gates:

- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- pnpm check

Expected risk reduction: medium. This prevents overclaiming broad autonomy or
observability maturity.

## 8. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
|---|---|---|---|---|---|
| 1 | Strict adopted evidence validation | High | Medium | False implementation claims | It makes research adoption executable. |
| 2 | Runtime evidence severity-aware merge | High | Low | Blocker masking | Small code change, high trust impact. |
| 3 | Case-normalized Linear evidence match | High | Low | Stale or unknown provider state | Small fix that improves runtime-card truth. |
| 4 | Audit reference validator | High | Medium | Missing file and stale audit claims | Directly addresses the browser-loading failure class. |
| 5 | Reviewer coverage receipt | Medium | Medium | Silent review gaps | Turns subagent failures into structured evidence. |
| 6 | harness-run closeout integration | High | Medium | Unreplayable command claims | Connects existing schema to delivery proof. |
| 7 | session-closeout reachability | Medium | Medium | Tested but unused closeout schema | Converts test-only assurance into runtime behavior. |
| 8 | Auth-boundary delegated proof | Medium | Medium | Security drift | Replaces human warning review with a gate. |
| 9 | Manifest adoption status classification | Medium | Low | Planning vs implementation ambiguity | Prevents future audit confusion. |
| 10 | Retry classification events | Medium | Medium | Blind retries | Makes recovery behavior visible. |

## 9. Implementation Advice

What to build first:

- Build the strict adopted evidence validator and runtime evidence merge fixes
  first. They are small, testable, and directly reduce false-success risk.

What not to build yet:

- Do not build the full Vector/Victoria observability stack before local
  runtime-card, harness-run, reviewer coverage, and JSONL evidence are enforced.

What to remove:

- Remove or downgrade any audit language that says adopted when the target is
  planning-only and no implementation gate exists.

What to simplify:

- Keep the default agent rail compact, but add mode discovery instead of
  expanding it into the full expert catalog.

What should become a validator:

- Adopted evidence strict mode.
- Audit reference existence checks.
- Reviewer coverage receipt checks.
- Delegated auth-boundary proof.

What should become a schema:

- reviewer-coverage-receipt/v1.
- validation-receipt/v1 for adopted research commands.
- Optional audit-reference-report/v1.

What should become a skill:

- A narrow evidence-led-audit skill only after the validators exist, so the
  skill can call deterministic checks rather than re-explain audit behavior.

What should become documentation:

- External observability stack status should be documented as a future lane,
  separate from current local runtime evidence.

What should become CI:

- Strict adopted evidence validation and audit reference validation.

What should remain manual:

- Final interpretation of broad architecture tradeoffs and whether a research
  source should be promoted from deferred to implementation authority.

## 10. Final Recommendation

Immediate next action: implement GAP-001, GAP-002, and GAP-003 as the first
patch set.

Safest first patch: GAP-003, because issue-key normalization is narrow and easy
to prove with a runtime-card regression.

Highest-risk missing system: strict claim-vs-evidence enforcement for adopted
research and audit references. Without that, future agents can mistake
planning, docs, or stale artifacts for implemented code.

Best validation command to add first:

node scripts/validate-evidence-patterns.cjs --strict-adopted --json

Broader Codex autonomy readiness: not ready for broad autonomy. The project is
ready for bounded Codex work inside paths that already have runtime-card,
pr-closeout, evidence-verify, and repo gate coverage. Broader autonomy should
wait until research adoption, reviewer coverage, audit references, and run
evidence are mechanically enforced.

## Validation Evidence

- Command: node --import tsx src/cli.ts next --json -> pass. It returned
  action_required and recommended validation-plan from live git status.
- Command: node --import tsx src/cli.ts commands --json --for-agent --mode
  verify -> pass. It exposed next, runtime-card, validation-plan, and
  evidence-verify for verify mode.
- Command: node scripts/check-architecture-rules.cjs --format json -> pass
  with four warnings for auth-boundary crypto delegation.
- Command: jq over .harness/research/evidence-patterns.json -> pass. It showed
  2026-05-22-harness-source-synthesis as adopted with planning/module-layout
  target surfaces.
- Command: reviewer subagent artifact check -> blocked. Requested reviewer
  artifacts were not produced before timeout/closure, so the audit records this
  as blocked_runtime rather than review evidence.
