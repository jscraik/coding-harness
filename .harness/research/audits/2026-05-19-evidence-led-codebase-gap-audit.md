# 2026-05-19 Evidence-Led Codebase Gap Audit

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Overall Gradecard](#2-overall-gradecard)
- [3. Evidence-to-Code Mapping](#3-evidence-to-code-mapping)
- [4. Post-Deep-Module Agent-Native Backlog](#4-post-deep-module-agent-native-backlog)
- [5. Gap Register](#5-gap-register)
- [6. Contradictions](#6-contradictions)
- [7. Missing Features](#7-missing-features)
- [8. Fix Roadmap](#8-fix-roadmap)
- [9. Highest-Leverage Fixes](#9-highest-leverage-fixes)
- [10. Implementation Advice](#10-implementation-advice)
- [11. Final Recommendation](#11-final-recommendation)

## 1. Executive Summary

Overall maturity grade: **B- / C+**.

The repository is already a real agent control plane, not a documentation-only experiment. It has executable command routing, machine-readable CLI metadata, runtime-card contracts, phase-exit ingestion, PR closeout claim ledgers, CircleCI governance jobs, Project Brain surfaces, skill validation, and source-level invariant checks. The best parts of the codebase already match the evidence documents: repository as control plane, deterministic validators, current-state packets, typed closeout claims, and CI-owned governance.

The main weakness is enforcement depth. Several truth mechanisms exist but are optional at the point an agent makes a decision. The cockpit command can recommend work without a supplied runtime card or phase-exit artifact. Runtime-card can report phase-exit not_run without blockers. The research files are explicitly cold research, but there is no promotion ledger that turns extracted patterns into adopted validators, skills, schemas, or explicit rejects. Some architecture and safety checks exist as scripts or hooks but are not clearly default CI gates.

Top 5 gaps:

1. Evidence artifacts are optional in the cockpit path: src/commands/next.ts defines optional phaseExit and runtimeCard inputs and only blocks when they are supplied.
2. Runtime-card treats missing phase-exit as advisory in local output: a live local run returned phaseExit.status not_run with blockers empty.
3. Evidence-to-policy promotion is missing: the research docs mark themselves cold, but no manifest tracks adopted, deferred, or rejected patterns.
4. Mechanical architecture rules are partly off the main gate: scripts/check-architecture-rules.cjs exists, but package.json check does not call it directly.
5. PR closeout has two concrete verifier defects: Closes JSC references are rejected despite Refs/Closes blocker wording, and missing check SHA metadata can route to wait_for_external_check.

Top 5 risks:

1. Agents can get a safe-looking next command while required runtime evidence is absent.
2. Missing validation evidence can look non-blocking.
3. Good research repeats as prose instead of becoming repo behavior.
4. Structural drift can pass the default gate.
5. Closeout can stall or reject valid PR wording due to verifier-policy contradictions.

Strongest foundations:

- harness next --json is reachable and produced a structured decision packet with nextCommand, evidenceRef, and permission metadata.
- runtime-card/v1 models lifecycle, source freshness, blockers, branch, PR, Linear, artifact, and phase-exit state.
- pr-closeout/v1 has claim evidence fields, current-head discipline, freshness, blocker classes, and missing-context routing.
- .harness/README.md defines authority levels for policy, decisions, execution inputs, secondary context, generated runtime, and scratch.
- CircleCI has broad governance coverage: pr-template, linear-gate, risk-policy-gate, docs-gate, lint, typecheck, test, audit, check, memory, drift health, and security-scan.

Reviewer coverage:

- agent-native-reviewer: usable. Found optional evidence gates and over-narrow agent command discovery.
- adversarial-reviewer: usable. Found the Refs/Closes contradiction and unknown check-SHA wait-loop risk.
- api-contract-reviewer: coverage gap. The response was narrow and stale relative to this audit; API/schema contract findings below come from direct inspection.

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
|---|---:|---|---|---|---|
| Repository as Control Plane | B+ | High | .harness authority map, active-artifacts, contract, instructions, CI manifests, specs, and plans exist. | Research and review artifacts remain secondary context without promotion status. | Add an evidence-pattern adoption manifest and validator. |
| Runtime Truth and Decision Packets | B- | High | next, runtime-card/v1, HePhaseExit/v1, and PR closeout packets exist. | Runtime-card and phase-exit are optional cockpit inputs. | Add required evidence mode and canonical artifact auto-loading. |
| Claim-vs-Evidence Verification | B- | High | PR closeout claims and a source invariant gate exist. | Some verifier rules contradict wording or over-route to external wait. | Patch classifier defects and add fixtures. |
| Mechanical Architecture Enforcement | C+ | Medium | Architecture docs, module-boundary tests, and architecture script exist. | Architecture script is not directly in package check. | Wire architecture:check into check and CI. |
| Harness Runtime Loop | C | Medium | next, workflow contracts, validation-plan, review-gate, pr-closeout form a partial loop. | Attempt budgets and recovery records are fragmented. | Add attempt-ledger/v1 and recovery-event/v1. |
| Trace and Session Evidence | C+ | Medium | replay, tracer libs, run records, session-collector integration, and PR template fields exist. | Not all primary commands emit required run records. | Standardize run-record emission across cockpit, review, and closeout. |
| Context Engineering | B- | High | .harness authority levels, instruction map, glossary, CODESTYLE, and skills exist. | No executable context budget or research freshness gate. | Add context-health budget and stale-context checks. |
| Skills and Workflow Density | B | Medium | Packaged skill validation exists. | --for-agent exposes only next. | Add phased command catalog modes. |
| Recovery and Failure Handling | C+ | Medium | CI retries, preflight recovery text, missing-context classifier, and replay fixtures exist. | No single recovery contract for attempts, stop reasons, and owners. | Add recovery schema and emit it from live commands. |
| Governance and Safety | B | High | Branch protection contract, authz, Semgrep, secret scripts, PR traceability, and review independence exist. | Some safety checks are hook/manual rather than default local check. | Add safety:local and explicit coverage reporting. |

## 3. Evidence-to-Code Mapping

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
|---|---|---|---|---:|---|
| Repository as prompt/control plane | 2026-05-19-matt-pocock-evidence.md lines 53 and 995 | .harness/README.md lines 15-28, harness.contract.json lines 9-20 | implemented_enforced | B+ | High |
| Cold research needs promotion before authority | matt-pocock lines 20-21 and 170 | .harness/README.md lines 67-71 | partial | C | High |
| Ready-for-agent state machine | matt-pocock lines 59 and 391-393 | .harness/active-artifacts.md lines 20-38 plus Linear/gate commands | partial | C+ | Medium |
| Context-window austerity and lazy tool loading | matt-pocock lines 61 and 474-491 | command catalog and skill routing | implemented_not_enforced | C+ | High |
| Deep modules behind simple interfaces | matt-pocock lines 275-286 | docs/architecture/module-boundaries.md lines 26-49 and module-boundary tests | implemented_enforced | B | Medium |
| Runtime cards/current state packets | Ryan evidence runtime-truth pattern | src/lib/runtime/runtime-card.ts lines 151-179 | implemented_not_enforced | B- | High |
| Claim-vs-evidence closeout | Ryan/Eno verification packet pattern | src/lib/pr-closeout/claim-helpers.ts lines 101-120 and check-pr-closeout-truth-contract.cjs lines 31-61 | partial | B- | High |
| Live PR and Linear state refresh | Ryan live-state proof pattern | src/lib/runtime/local-runtime-card.ts lines 150-214 and 245-310 | partial | B- | High |
| Command recommendation gate | Ryan command-truth pattern | src/commands/next.ts lines 134-179 and runtime next output | implemented_enforced | B | High |
| Agent capability catalog | Pocock/Eno tool-density pattern | src/lib/cli/registry/command-capabilities.ts lines 365-385 and 533-547 | partial | C | High |
| Replay and trace evidence | Eno/Ryan session evidence pattern | src/commands/replay.ts lines 1-180 and src/lib/replay/tracer.ts | partial | C+ | Medium |
| Recovery attempts and retry budgets | Ryan/Eno bounded retry pattern | .circleci/config.yml lines 83-97 and run-harness-evals retry fixtures | scaffolded | C | Medium |
| Governance safety and approval | all evidence docs | harness.contract.json lines 14-20 and 178-188, PR template traceability fields | implemented_enforced | B | High |

## 4. Post-Deep-Module Agent-Native Backlog

This section captures the new follow-on work identified during the planning
conversation after the deep module work. It should not interrupt the current
deep-module/trust-boundary implementation lane. Treat it as the next
agent-native context architecture backlog once the runtime and module-boundary
work is stable.

### 4.1 Principles To Encode

These principles should become machine-readable contracts, validators, routing
rules, or closeout evidence. They should not remain standalone doctrine.

| Principle | Agent Contract | Enforcement Candidate |
|---|---|---|
| Canonicity | Classify context before trusting it. Canon can describe current behavior; intent, history, reference, and secondary context cannot prove implementation. | .harness/authority-map.json, harness authority audit --json, PR closeout rejection when not-canon is cited as implementation proof. |
| Localisation | Keep context at the narrowest owning scope. Promote upward only after repeated use proves broader value. | AGENTS authoring audit, promotion evidence requirement for root instructions, scoped instruction placement checks. |
| Verifiability | Completion claims need current verifier, command, runtime, PR/CI, or blocker evidence. | Runtime-card freshness gates, pr-closeout/v1, required evidence mode for harness next, review artifact existence checks. |
| Portability | Codex can be the reference runtime, but durable repo contracts stay harness-owned and provider adapters remain explicit. | Schema naming rules, provider namespace checks, adapter-boundary tests, no provider-specific core contract names without exception. |
| Default-no | Automatically loaded context is excluded by default and must earn inclusion by changing behavior for most work in that scope. | Always-loaded surface budget, AGENTS size and directive-density checks, default-no justification for broad instruction changes. |

### 4.2 Context Architecture To Add

Target architecture:

| Layer | Surface | Load Mode | Agent Purpose |
|---|---|---|---|
| 0 | Authority map | Always/routed by tooling | Decide what can be trusted as current truth. |
| 1 | Root AGENTS.md | Always | Minimal operating baseline and routing rules only. |
| 2 | Scoped AGENTS.md, CODESTYLE.md, codestyle modules | Path/task scoped | Local operational rules and engineering standards. |
| 3 | Skills | Match scoped | Cross-folder procedures and domain workflows loaded on demand. |
| 4 | Roles and reviewers | Risk/explicit scoped | Independent verification, standards, security, and design review. |
| 5 | Connectors and runtime evidence | Task scoped | GitHub, Linear, CI, browser, logs, runtime-card, and live-state proof. |
| 6 | Tests, hooks, gates, validators | Change scoped | Mechanical enforcement and completion evidence. |

Minimal human-facing docs should be limited to:

- a short AGENTS.md authority-map pointer
- one route in docs/agents/01-instruction-map.md
- an optional compact docs/agents/00-authority-map.md explainer

The primary source should be machine-readable:

- .harness/authority-map.json
- scripts/check-authority-map.cjs
- eventual harness authority audit, classify, and explain JSON commands

### 4.3 New Follow-On Gaps

#### GAP-011: Authority Map Registry Is Missing

**Category:** context / authority / agent-native

**Current State:** .harness/README.md defines useful authority levels inside
the .harness subtree, and harness.contract.json has context-integrity truth
sources. There is no repo-wide machine-readable canon/not-canon registry that
agents can query before trusting context.

**Expected State:** The repo has .harness/authority-map.json with authority
classes, artifact rules, always-loaded surfaces, generated projection
provenance, and non-canon proof boundaries.

**Risk:** Agents continue to infer authority from folder names or prose and may
treat intent/history as implementation proof.

**Severity:** High

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Add .harness/authority-map.json and
scripts/check-authority-map.cjs; wire pnpm run authority:check into pnpm check
after initial warning-mode validation stabilizes.

**Acceptance Criteria:** Canon artifacts declare validation hooks; generated
projections declare generator and inputs; non-canon artifacts explicitly cannot
prove current_behavior; always-loaded surfaces are canon and have a reason.

#### GAP-012: AGENTS Authoring Contract Is Not Audited

**Category:** context / default-no / localisation

**Current State:** Root AGENTS.md carries important operational rules, but the
repo lacks a validator that distinguishes behavior-changing instructions from
descriptive filler, over-prioritized directives, duplicate scoped rules, and
scope-mismatched guidance.

**Expected State:** AGENTS files are operational control surfaces. Every line
constrains action, routes context, defines authority, or names validation.

**Risk:** Always-loaded context grows, priority flattens, and agents spend token
budget on prose that does not change behavior.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P1

**Recommended Fix:** Extend the authority validator or add harness instructions
audit --json to report descriptive filler, MUST/NEVER density, stale path
references, duplicate root/nested rules, and rules placed broader than their
owning scope.

**Acceptance Criteria:** Root and scoped AGENTS files produce structured audit
results; broad instruction changes require localisation/promotion evidence or a
tracked exception.

#### GAP-013: Canon Hygiene Cleanup Is Not Planned As A Codebase Pass

**Category:** cleanup / maintainability / agent-native examples

**Current State:** The repo has strong standards and validators, but existing
files can still teach agents old or contradictory patterns. There is no ranked
cleanup pass for the most agent-visible canonical surfaces.

**Expected State:** The repo audits and cleans high-copy-risk canon first:
instructions, codestyle, docs/agents/**, schemas, command help, validators, and
high-traffic source/tests.

**Risk:** Agents follow written standards while copying non-standard local
examples from frequently opened files.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add harness canon audit --json or an audit mode under
authority tooling. Classify findings as agent_fixable, agent_refactorable,
human_decision_required, defer_to_normal_work, or do_not_change.

**Acceptance Criteria:** The audit ranks findings by visibility, authority
impact, fixability, owner, and suggested validation. Cleanup starts with P0/P1
surfaces instead of broad repo rewrites.

#### GAP-014: Canon Maintenance Loop Is Missing

**Category:** maintenance / ownership / stale-state prevention

**Current State:** Canonical docs often carry validation metadata, and
governance checks exist, but canonical artifact ownership/freshness is not
uniformly checked across agent-facing context.

**Expected State:** Canonical non-code artifacts have owner, authority class,
freshness or validation command, and a review/deletion condition. Scheduled
context scans detect stale canon, broken references, duplicate rules,
contradictions, and missing provenance.

**Risk:** Canon rots quietly and agents keep trusting stale operating context.

**Severity:** Medium-high

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add owner/freshness requirements for authority-map canon
entries and a scheduled scanner report before introducing autonomous fixer
workers.

**Acceptance Criteria:** Scanner can distinguish canon from not-canon; canon
must be internally consistent; not-canon may disagree but cannot be cited as
current truth.

#### GAP-015: Validation Expectations Are Not Agent-Native Enough

**Category:** testing / validation loop / workflow skill

**Current State:** The repo has strong validation scripts and codestyle rules,
but agents still need a compact way to ask which tests or production paths are
required for a changed file set.

**Expected State:** Agents can request test expectations as structured output:
required validation, minimum production-path proof, acceptable blockers, and
evidence fields.

**Risk:** Agents either over-run broad gates or under-prove behavior with weak
or self-affirming tests.

**Severity:** Medium

**Fix Grade:** Post-deep-module P2

**Recommended Fix:** Add or extend a command such as harness testing
expectations with file inputs and JSON output, backed by codestyle testing
rules, related-test mapping, runtime-card closeout rules, and quality
self-affirming checks.

**Acceptance Criteria:** For CLI/source/runtime changes, the command names
focused tests, production-path smoke evidence, broader gates, and blocked
validation requirements.

#### GAP-016: Outcome Metrics Need Context-Health Counters

**Category:** observability / outcome metrics / context hygiene

**Current State:** The north-star status matrix tracks PR lead time, review
retry rate, manual interventions, guardrail recurrence, and related throughput
metrics. It does not yet track authority-map and canon-hygiene health.

**Expected State:** Outcome reporting distinguishes productivity gains from
context bloat and records whether agent-native context is getting healthier.

**Risk:** Token usage or feature velocity can rise while canon quality,
authority clarity, or context-load efficiency gets worse.

**Severity:** Medium

**Fix Grade:** Post-deep-module P3

**Recommended Fix:** Add metrics such as canon_drift_findings_count,
stale_canon_count, not_canon_cited_as_truth_count,
always_loaded_context_lines, authority_unknown_count,
post_guardrail_recurrence_rate, and token_usage_per_merged_pr.

**Acceptance Criteria:** Metrics appear in status or runtime evidence without
making raw token growth a north-star success proxy. Token growth only counts as
positive when paired with lower manual intervention, lower rework, or lower PR
lead time.

### 4.4 Sequencing After Deep Module Work

1. Add authority registry and validator in warning mode.
2. Add compact AGENTS and instruction-map routing only; avoid long human docs.
3. Add AGENTS authoring audit and default-no budget checks.
4. Run canon hygiene audit against P0/P1 surfaces.
5. Promote deterministic authority checks into pnpm check.
6. Add scheduled context scanner report.
7. Add validation-expectations command or skill-backed structured output.
8. Add context-health metrics to status/runtime evidence.

### 4.5 Non-Goals

- Do not classify all docs/ as canon. Authority is per artifact or governed
  glob, not per broad directory.
- Do not make docs human-only. This repo intentionally uses agent-operational
  docs, but they must be classified and routed.
- Do not rewrite 20-30 percent of the repo by principle alone. Let the audit
  rank cleanup by agent visibility and fixability.
- Do not treat raw token usage as success unless throughput and review quality
  improve with it.

## 5. Gap Register

### GAP-001: Cockpit Evidence Is Optional

**Category:** runtime / verification

**Current State:** HarnessNextOptions defines phaseExit and runtimeCard as optional. Blocking logic only runs when those values are supplied. A local run of node --import tsx src/cli.ts next --json recommended validation-plan with evidence refs git:status and command-catalog only.

**Expected State:** PR, CI, and closeout modes should fail closed when current runtime-card and phase-exit evidence are missing or stale.

**Evidence Basis:** Runtime truth packets and ready-for-agent gates require current state before action.

**Code Evidence:** src/commands/next.ts lines 42-58 and 159-179; src/commands/next.test.ts has explicit artifact tests but not required-artifact mode.

**Risk:** False-success recommendations; agents continue despite missing CI, PR, Linear, or closeout proof.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:** Add --evidence required|optional or mode-specific enforcement. In --mode pr and --mode ci, auto-load canonical runtime-card and phase-exit artifacts or emit failureClass required_evidence_missing.

**Suggested Software / Method:** TypeScript validator, Vitest fixtures, jq CLI smoke tests.

**Files Likely To Change:** src/commands/next.ts, src/commands/next.test.ts, src/commands/next-decisions.ts, docs for harness next.

**Validation Command:** pnpm vitest run src/commands/next.test.ts && node --import tsx src/cli.ts next --json --mode pr | jq '.status,.failureClass'

**Acceptance Criteria:** PR mode without required evidence blocks; explicit valid evidence passes; stale or invalid evidence blocks; local exploratory mode is explicit.

### GAP-002: Runtime Card Allows phaseExit.not_run Without a Blocker

**Category:** runtime / traceability

**Current State:** node --import tsx src/cli.ts runtime-card --json --repo . returned phaseExit.status not_run and blockers empty.

**Expected State:** Missing required phase-exit should be a structured blocker for closeout, PR, CI, or autonomy-sensitive modes.

**Evidence Basis:** Claim-vs-evidence verification and runtime card patterns require missing proof to be machine-actionable.

**Code Evidence:** src/lib/runtime/runtime-card.ts lines 61-67 permits not_run; lines 240-244 only treat selected lifecycle values as blocking; runtime-evidence-producer.ts lines 47-68 omits phase-exit when not_run.

**Risk:** Missing validation proof appears non-blocking to harness next --runtime-card.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:** Add runtime-card context local|pr|ci|closeout and mark phaseExit.not_run as a blocker outside local mode. Include a phase_exit source with freshness missing and failureClass phase_exit_missing.

**Suggested Software / Method:** Runtime-card schema extension, Vitest fixtures, CLI smoke test.

**Files Likely To Change:** src/lib/runtime/local-runtime-card.ts, src/lib/runtime/runtime-card.ts, src/lib/runtime/runtime-evidence-producer.ts, src/commands/runtime-card.test.ts.

**Validation Command:** pnpm vitest run src/commands/runtime-card.test.ts src/lib/runtime/local-runtime-card.test.ts

**Acceptance Criteria:** Closeout/PR runtime cards block on missing phase-exit; local cards are explicitly advisory; runtime-evidence-bundle preserves missing phase-exit state.

### GAP-003: Research Patterns Have No Adoption Ledger

**Category:** context / governance / validation

**Current State:** Evidence files say they are cold research, not instruction surfaces. .harness/README.md correctly says secondary context cannot drive implementation unless admitted, but there is no adopted/deferred/rejected manifest.

**Expected State:** High-value evidence patterns should have lifecycle status, target surface, owner, and validation command.

**Evidence Basis:** Pocock's repo-as-prompt, thin documentation, and durable memory patterns; Ryan/Eno runtime control-plane patterns.

**Code Evidence:** .harness/README.md lines 67-71; no validator found for .harness/research/deep promotion status.

**Risk:** Useful patterns remain inert and are rediscovered repeatedly.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Add .harness/research/evidence-patterns.json plus scripts/validate-evidence-patterns.cjs. Track source refs, status, target surface, validation, and explicit rejection/defer reason. Wire it into pnpm check or docs-gate.

**Suggested Software / Method:** JSON Schema or Node shape validator, jq, markdown line-reference checker.

**Files Likely To Change:** .harness/research/evidence-patterns.json, scripts/validate-evidence-patterns.cjs, package.json, docs.

**Validation Command:** node scripts/validate-evidence-patterns.cjs --json && pnpm check

**Acceptance Criteria:** Every current deep evidence file has tracked pattern disposition; adopted patterns point to code, tests, docs, or an explicit issue; missing refs fail.

### GAP-004: Architecture Rule Script Is Not a Default Gate

**Category:** architecture / validation

**Current State:** scripts/check-architecture-rules.cjs checks cycles, command cross-imports, auth crypto usage, GitHub lib filesystem separation, and diagram freshness. package.json check does not call it directly. CircleCI has many jobs but no explicit architecture rule job.

**Expected State:** Architecture drift should fail in the default validation path.

**Evidence Basis:** Deep-module and navigable-file-system evidence treats structure as agent infrastructure.

**Code Evidence:** scripts/check-architecture-rules.cjs lines 10-16 and 357-384; package.json lines 49-100; .circleci/config.yml lines 403-474.

**Risk:** Architecture can drift while default checks pass.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Add architecture:check to package.json and include it in pnpm check. Add a CircleCI job or ensure the check job runs it. Require owner/reason/date for baseline entries.

**Suggested Software / Method:** Existing Node script first; dependency-cruiser, madge, or ts-morph only if local script becomes insufficient.

**Files Likely To Change:** package.json, .circleci/config.yml, scripts/check-architecture-rules.cjs, .architecture-baseline.txt.

**Validation Command:** pnpm run architecture:check && pnpm check

**Acceptance Criteria:** Existing repo passes; command cross-import fixtures fail; baselined issues are visible and owned.

### GAP-005: Agent-Facing Command Discovery Is Too Narrow

**Category:** skills / context / agent-native

**Current State:** commands --json --for-agent returns one command: next. The full catalog has 70 commands and includes runtime-card, pr-closeout, review-gate, validation-plan, evidence-verify, and replay.

**Expected State:** Agents need a compact but useful first-contact rail with phase-specific verifier and handoff commands.

**Evidence Basis:** Tool-density and context austerity: expose the right tools without flooding context.

**Code Evidence:** src/lib/cli/registry/command-capabilities.ts lines 365-385 and 533-547; runtime output from commands --json --for-agent.

**Risk:** Agents miss native validators and invent ad hoc shell flows.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Add --for-agent modes: orient, verify, review, handoff. Keep next as default; expose validation-plan, runtime-card, evidence-verify, review-gate, and pr-closeout in bounded modes.

**Suggested Software / Method:** CLI catalog schema v3 additive fields and Vitest assertions.

**Files Likely To Change:** src/lib/cli/registry/command-capabilities.ts, src/lib/cli/command-registry.ts, src/cli.test.ts.

**Validation Command:** node --import tsx src/cli.ts commands --json --for-agent --mode verify | jq '.commands[].name'

**Acceptance Criteria:** Agent catalog remains compact; verifier and handoff commands are discoverable; tests prevent accidental catalog bloat.

### GAP-006: PR Body Contract Rejects Closes Despite Saying Refs/Closes

**Category:** verification / governance

**Current State:** hasLinearReference only matches Refs JSC-123, while the blocker says Refs/Closes.

**Expected State:** Runtime enforcement and operator-facing policy text must agree.

**Evidence Basis:** Claim-vs-evidence and repo-as-control-plane patterns require deterministic wording contracts.

**Code Evidence:** src/lib/pr-closeout/evidence.ts lines 52-55; src/lib/pr-closeout/blockers.ts lines 121-127.

**Risk:** Legitimate closeout PRs can be blocked.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Accept both Refs and Closes, or change all policy text to Refs only. Because repo workflow distinguishes Refs in review and Closes at full completion, accepting both is the safer implementation.

**Suggested Software / Method:** Regex fixture tests.

**Files Likely To Change:** src/lib/pr-closeout/evidence.ts, src/lib/pr-closeout.test.ts.

**Validation Command:** pnpm vitest run src/lib/pr-closeout.test.ts -t Linear

**Acceptance Criteria:** Refs JSC-1 and Closes JSC-1 pass; missing or malformed references block.

### GAP-007: Unknown Check SHA Routes to External Wait

**Category:** verification / recovery

**Current State:** If checks pass but head SHA metadata is missing, requiredChecksAreCurrent returns false, freshness becomes unknown, claim blockers are non-fixable, and status maps check blockers to wait_for_external_check.

**Expected State:** Missing SHA metadata should be classified as a verifier/provider evidence gap, not an external check wait, unless a check is actually pending.

**Evidence Basis:** Runtime truth and failure classification patterns.

**Code Evidence:** src/lib/pr-closeout/claim-helpers.ts lines 53-62; claim-builders.ts lines 41-60 and 89-113; claims.ts lines 22-26; status.ts lines 72-80.

**Risk:** Closeout stalls in a wait loop that cannot resolve without better evidence collection.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Split unknown freshness into provider_metadata_missing versus pending_external_check. Route provider metadata gaps to tool or harness_gates blockers with codex_can_fix_now or needs_jamie_decision depending on adapter authority.

**Suggested Software / Method:** Typed blocker cause enum and Vitest fixture.

**Files Likely To Change:** src/lib/pr-closeout/claim-helpers.ts, claim-builders.ts, claims.ts, status.ts, tests.

**Validation Command:** pnpm vitest run src/lib/pr-closeout.test.ts -t SHA

**Acceptance Criteria:** Passing checks without SHA do not produce wait_for_external_check; pending checks still do.

### GAP-008: Runtime Evidence Bundle Synthesizes Empty Gate Evidence

**Category:** traceability / API contract

**Current State:** phaseExitFromRuntimeCard creates a HePhaseExit/v1 object from runtime-card summary state and sets gates to an empty array.

**Expected State:** Consumers should distinguish summary-only projection from gate-backed evidence.

**Evidence Basis:** Evidence packets should not launder summaries into verifier proof.

**Code Evidence:** src/lib/runtime/runtime-evidence-producer.ts lines 47-68.

**Risk:** A downstream consumer can treat summarized phase-exit status as original gate evidence.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add sourceCompleteness summary_only|gate_backed, or do not emit phaseExit unless an original phase-exit artifact was supplied.

**Suggested Software / Method:** Additive schema field and adapter tests.

**Files Likely To Change:** src/lib/runtime/runtime-evidence-bundle.ts, src/lib/runtime/runtime-evidence-producer.ts, tests.

**Validation Command:** pnpm vitest run src/lib/runtime

**Acceptance Criteria:** Consumers can distinguish summary projection from gate evidence.

### GAP-009: Retry and Recovery Are Fragmented

**Category:** recovery / traceability

**Current State:** CircleCI has shell retries, eval fixtures model retry caps, preflight emits recovery text, and missing-context classifier routes some failures. There is no single attempt-ledger or recovery-event contract used by the runtime loop.

**Expected State:** Retryable workflows should record attempt count, first failure, retry decision, owner, stop reason, and next action.

**Evidence Basis:** Bounded retries, stop reasons, failure classification, and replayability.

**Code Evidence:** .circleci/config.yml lines 83-97; scripts/run-harness-evals.mjs retry fixtures; scripts/codex-preflight.sh orchestration; src/lib/missing-context/classifier.ts.

**Risk:** Failures get retried in the wrong layer or handed to the wrong owner.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add attempt-ledger/v1 and recovery-event/v1; emit from review-gate, pr-closeout, runtime-card --live, and CI adapters.

**Suggested Software / Method:** JSONL run records now; OpenTelemetry later if volume justifies it.

**Files Likely To Change:** src/lib/contract/run-record-emitter.ts, src/commands/review-gate-core.ts, src/commands/pr-closeout.ts, src/lib/runtime/local-runtime-card.ts.

**Validation Command:** node --import tsx src/cli.ts replay --list --json plus command-specific tests.

**Acceptance Criteria:** Retryable and non-retryable failures carry attempts, stop reasons, owner, and replayable evidence.

### GAP-010: Secrets and Security Coverage Are Split Across Hooks, Scripts, and CI

**Category:** governance / safety

**Current State:** secrets:staged, semgrep:changed, and Semgrep full scripts exist. CircleCI runs security-scan. pnpm check runs audit but not staged secrets or changed Semgrep.

**Expected State:** Local, CI, release, and closeout safety coverage should be explicit so agents do not overclaim local validation.

**Evidence Basis:** Governance and safety patterns across the evidence docs.

**Code Evidence:** package.json lines 84-86; Makefile lines 94-105; .circleci/config.yml lines 471-474; scripts/check-environment.sh line 250.

**Risk:** A local check pass can be interpreted as broader security proof than it is.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Add safety:local and make verify-work.sh report which safety gates ran, skipped, or are CI-owned.

**Suggested Software / Method:** Existing scripts.

**Files Likely To Change:** package.json, scripts/verify-work.sh, docs.

**Validation Command:** pnpm run safety:local && bash scripts/verify-work.sh --fast

**Acceptance Criteria:** Handoff can truthfully distinguish local safety evidence from CI-owned security gates.

## 6. Contradictions

| Claim | Actual Implementation | Evidence | Severity | Operational Impact | Recommended Fix |
|---|---|---|---|---|---|
| PR body accepts Refs/Closes references. | Regex accepts only Refs. | pr-closeout evidence.ts lines 52-55 and blockers.ts lines 121-127. | Medium | Valid closeout wording can be blocked. | Accept both or change all text to Refs only. |
| Runtime-card is a current-state packet for safe continuation. | Missing phase-exit can be not_run with no blockers. | Runtime-card local command output; runtime-card.ts lines 61-67 and 240-244. | High | Missing validation proof can look non-blocking. | Mode-aware blocking for not_run. |
| Agent command catalog is agent-readable. | --for-agent returns only next. | command-capabilities.ts lines 385 and 533-547; runtime count 1. | Medium | Agents miss native validators. | Add bounded first-contact modes. |
| Architecture is mechanically enforced. | Architecture checker exists but is absent from package check. | check-architecture-rules.cjs and package.json lines 49-100. | Medium | Structural drift may pass default gate. | Add architecture:check to check and CI. |
| Cold research can shape future validators. | No promotion manifest exists. | research docs and .harness/README.md lines 67-71. | High | Reusable insights stay inert. | Evidence pattern lifecycle manifest. |
| Waiting for checks means checks are externally pending. | Missing SHA metadata can map to wait_for_external_check. | pr-closeout status.ts lines 72-80 and claim helper chain. | High | Agent waits instead of fixing evidence adapter. | Split metadata gaps from pending checks. |

## 7. Missing Features

Runtime state:

- Required evidence mode for harness next.
- Mode-aware runtime-card blocking.
- Canonical runtime-card artifact path and freshness gate.

Command selection:

- Agent-facing command catalog modes beyond next.
- Safe verifier recommendation when runtime-card says evidence is missing.

Verification:

- Tests for Closes PR body acceptance.
- Tests for missing check SHA classification.
- Promotion validator for research patterns.

Validation:

- Default architecture:check gate.
- Local safety gate that names secrets and Semgrep coverage.

Architecture enforcement:

- Baseline owner/reason/date requirement.
- Source invariant checks integrated into CI.

Traces:

- Uniform run records for next, runtime-card, review-gate, pr-closeout, and validators.
- Attempt ledger artifacts for retry and stop reasons.

Context:

- Context budget and stale-context check.
- Research pattern promotion queue.
- Authority map registry and authority-check validator.
- AGENTS authoring audit for descriptive filler, priority flattening, and scope mismatch.
- Canon hygiene cleanup audit for high-copy-risk source, tests, schemas, command help, and governance docs.
- Scheduled context scanner for stale canon, broken references, duplicate instructions, and contradiction candidates.

Skills:

- Research-to-validator promotion skill.
- Smaller command-surface bundles by workflow phase.

Recovery:

- Runtime recovery event schema.
- Owner classification for provider metadata gaps versus external waits.

Governance:

- Explicit proof that live PR and Linear state was observed or blocked.
- Clear separation of local, CI, and release safety coverage.

CI/CD:

- Architecture invariant job.
- Runtime-card and phase-exit smoke fixtures.

Observability:

- JSONL trace artifacts attached to validation and closeout.
- Replay fixtures connected to actual command outputs.
- Context-health counters for canon drift, stale canon, unknown authority, not-canon cited as truth, always-loaded context size, and token usage per merged PR.

## 8. Fix Roadmap

### Phase 1 — Critical Trust Boundary Fixes

Objective: eliminate false-success, stale-state, unsafe-command, and missing-evidence risks.

Fixes included: GAP-001, GAP-002, GAP-006, GAP-007.

Files likely affected: src/commands/next.ts, src/commands/next-decisions.ts, src/lib/runtime/local-runtime-card.ts, src/lib/runtime/runtime-card.ts, src/lib/pr-closeout/evidence.ts, src/lib/pr-closeout/claim-helpers.ts, src/lib/pr-closeout/claim-builders.ts, src/lib/pr-closeout/claims.ts, src/lib/pr-closeout/status.ts, related tests.

Validation gates: pnpm vitest run src/commands/next.test.ts src/commands/runtime-card.test.ts src/lib/pr-closeout.test.ts; node --import tsx src/cli.ts next --json --mode pr; node --import tsx src/cli.ts runtime-card --json --repo .

Expected risk reduction: high. This prevents continuation recommendations when required state proof is absent or misclassified.

### Phase 2 — Mechanical Enforcement

Objective: make architecture and evidence promotion fail in CI instead of relying on reviewer memory.

Fixes included: GAP-003 and GAP-004.

Files likely affected: .harness/research/evidence-patterns.json, scripts/validate-evidence-patterns.cjs, scripts/check-architecture-rules.cjs, package.json, .circleci/config.yml.

Validation gates: node scripts/validate-evidence-patterns.cjs --json; pnpm run architecture:check; pnpm check.

Expected risk reduction: medium-high.

### Phase 3 — Runtime Harness Maturity

Objective: make runtime failures replayable and recovery decisions auditable.

Fixes included: GAP-008 and GAP-009.

Files likely affected: src/lib/runtime/runtime-evidence-bundle.ts, src/lib/runtime/runtime-evidence-producer.ts, src/lib/contract/run-record-emitter.ts, src/commands/review-gate-core.ts, src/commands/pr-closeout.ts, src/commands/runtime-card.ts.

Validation gates: pnpm vitest run src/lib/runtime src/commands/replay.test.ts; node --import tsx src/cli.ts replay --list --json.

Expected risk reduction: medium.

### Phase 4 — Context and Skill Compression

Objective: keep hot-path agent context small while making the right tools discoverable.

Fixes included: GAP-005, context budget/staleness report, research-to-skill/gate promotion workflow.

Files likely affected: src/lib/cli/registry/command-capabilities.ts, src/lib/cli/command-registry.ts, src/commands/context-health.ts, packaged skill references.

Validation gates: node --import tsx src/cli.ts commands --json --for-agent --mode verify; pnpm vitest run src/cli.test.ts.

Expected risk reduction: medium.

### Phase 5 — Governance and Scaling

Objective: make autonomy expansion safe only where deterministic evidence and rollback are present.

Fixes included: GAP-010, live PR/Linear observation proof in closeout, maintenance checks for evidence-pattern drift and architecture baseline drift.

Files likely affected: scripts/verify-work.sh, package.json, harness.contract.json, .harness/ci-required-checks.json, docs and PR template guidance.

Validation gates: bash scripts/verify-work.sh --fast; bash scripts/run-harness-gate.sh docs-gate --mode required --json; pnpm check.

Expected risk reduction: medium.

### Phase 6 — Agent-Native Context Authority

Objective: make canon/not-canon, instruction loading, cleanup, maintenance, and
context-health metrics enforceable after the deep module work lands.

Fixes included: GAP-011, GAP-012, GAP-013, GAP-014, GAP-015, GAP-016.

Files likely affected: .harness/authority-map.json,
scripts/check-authority-map.cjs, package.json, AGENTS.md,
docs/agents/01-instruction-map.md, optional compact
docs/agents/00-authority-map.md, context-health or authority CLI command files,
and north-star/status metric surfaces.

Validation gates: pnpm run authority:check; pnpm docs:lint; pnpm run
docs:ubiquitous:guard; pnpm run docs:steering:guard; focused CLI tests for
authority or context-health commands once implemented.

Expected risk reduction: medium-high. This prevents agents from trusting the
wrong artifact class, bloating always-loaded context, or treating cleanup and
maintenance as optional prose.

## 9. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
|---:|---|---|---|---|---|
| 1 | Require evidence in harness next PR/CI modes | Very high | Medium | False safe recommendations | The cockpit is the front door. |
| 2 | Make missing phase-exit block runtime-card closeout/PR mode | Very high | Medium | Missing validation proof | Runtime-card is otherwise too optimistic. |
| 3 | Fix Refs/Closes parser contradiction | Medium | Low | PR closeout churn | Small patch, clear test. |
| 4 | Fix missing check SHA classification | High | Medium | Infinite external waits | Prevents wrong-owner recovery. |
| 5 | Add evidence-pattern promotion manifest | High | Medium | Research staying inert | Converts this audit into durable system work. |
| 6 | Wire architecture check into pnpm check | High | Low-medium | Structural drift | Existing script can be promoted. |
| 7 | Expand agent command catalog modes | Medium | Low-medium | Tool blindness | Agents discover native validators. |
| 8 | Mark runtime evidence summaries as summary-only | Medium | Medium | Evidence laundering | Prevents summaries masquerading as proof. |
| 9 | Add attempt/recovery ledger | Medium | Medium-high | Blind retries | Builds runtime maturity. |
| 10 | Add local safety coverage summary | Medium | Low | Overclaimed validation | Clarifies what local checks prove. |
| 11 | Add authority-map registry and validator | High | Medium | Not-canon cited as truth | Gives agents a machine-readable trust map. |
| 12 | Add AGENTS authoring and default-no audit | Medium-high | Medium | Context bloat and flattened priority | Keeps always-loaded instructions operational. |
| 13 | Add canon hygiene audit and scanner | Medium-high | Medium-high | Stale canon and bad local examples | Makes cleanup and maintenance repeatable. |
| 14 | Add validation-expectations command | Medium | Medium | Weak or over-broad validation | Gives agents structured test obligations. |
| 15 | Add context-health metrics | Medium | Medium | Productivity gains hiding context rot | Pairs throughput with context quality. |

## 10. Implementation Advice

Build first:

- Start with harness next evidence requirements and runtime-card missing phase-exit blocking.
- Patch the two concrete PR closeout verifier contradictions while the files are already active.

Do not build yet:

- Do not introduce a large orchestration framework or OpenTelemetry-first runtime before simple JSONL/run-record emission is uniform.
- Do not add dependency-cruiser or madge until the existing architecture checker is wired and its gaps are proven.

Remove or simplify:

- Avoid adding more secondary research without an adoption status.
- Avoid more first-contact docs if a command catalog mode can carry the same information.

Should become a validator:

- Evidence-pattern adoption status.
- Architecture baseline metadata.
- Runtime-card required-evidence mode.
- PR closeout wording contract.

Should become a schema:

- evidence-pattern/v1.
- attempt-ledger/v1.
- recovery-event/v1.
- runtime evidence sourceCompleteness.

Should become a skill:

- Research promotion: convert a deep evidence file into adopted/deferred/rejected pattern records plus validator candidates.
- Runtime closeout repair: inspect runtime-card, phase-exit, PR closeout, and CI state, then classify owner and next action.

Should become documentation:

- One short operator page explaining local, CI-owned, release-owned, and closeout-owned gates.
- A compact cold-research-to-executable-policy SOP.

Should become CI:

- architecture:check.
- validate-evidence-patterns.
- Runtime-card and phase-exit smoke fixtures.

Should remain manual:

- Strategic choice of which research patterns to adopt.
- High-risk autonomy expansion.
- Reversing or deleting historical .harness artifacts.

## 11. Final Recommendation

Immediate next action: implement Phase 1 as a small trust-boundary patch.

Safest first patch: fix hasLinearReference to accept Refs and Closes, add the missing fixture, then fix missing check SHA classification. This is low-blast-radius and directly removes known verifier contradictions.

Highest-risk missing system: required runtime evidence in harness next. Until next fails closed on missing or stale runtime-card and phase-exit evidence in PR/CI modes, the project is not ready for broader unattended Codex autonomy.

Best validation command to add first: pnpm run architecture:check, wired into pnpm check, because the checker already exists and directly supports the evidence-derived deep-module/control-plane pattern.

Broader Codex autonomy readiness: **not yet** for PR closeout or lifecycle movement without human oversight. The repo is ready for bounded read-only planning, validation recommendation, and focused fixes. It is not ready for unattended closeout until runtime-card, phase-exit, PR closeout, and live PR/Linear state are required, current, and replayably evidenced.
