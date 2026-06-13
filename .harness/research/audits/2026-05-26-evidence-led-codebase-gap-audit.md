---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: evidence-led-codebase-gap-audit-2026-05-26
artifact_type: research-audit
canonical_slug: evidence-led-codebase-gap-audit
title: Evidence-Led Codebase Gap Audit and Graded Fix Plan
status: active
date: 2026-05-26
source_type: research
authority: secondary-context
lifecycle_status: reviewed
canonical_destination: docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
owner: coding-harness-maintainers
created: 2026-05-26
last_reviewed: 2026-06-13
review_cadence: on-change
validated_by:
  - pnpm docs:archive-candidates
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - .harness/research/audits/2026-05-20-evidence-led-codebase-gap-audit.md
---

# Evidence-Led Codebase Gap Audit and Graded Fix Plan

Generated: 2026-05-26

Target root: /Users/jamiecraik/dev/coding-harness

Comparison evidence: user-supplied THE_HARNESS.md outside the repository

Primary skills used: improve-codebase-architecture, testing, simplify

Reviewer reports:

- agent-native reviewer report
- api-contract reviewer report
- adversarial reviewer report

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

Overall maturity grade: B

Confidence: High for command, runtime-card, validation, and governance surfaces inspected directly. Medium for session evidence and Local Memory integration because part of that runtime lives outside this checkout and one reviewer hit local PID-write restrictions while probing memory bootstrap behavior.

Coding Harness is not a thin prompt harness. It already contains a substantial typed control plane: command registry, `harness next --json`, runtime cards, delivery-truth packets, PR closeout evidence, review/external state packets, Project Brain surfaces, codestyle parity, architecture checks, and agent-readiness validation. Compared with the Nimbalyst harness example, this project is stronger on machine-readable decision packets and repo-native validators.

The main weakness is that some of the most important trust boundaries are still easier to bypass than the docs imply. A few surfaces can produce pass-looking outcomes while important checks are skipped, downgraded to warnings, not exported as public schemas, or not reachable through a first-class command. That is the difference between a mature control plane and a control plane that still relies on expert operator interpretation.

Top 5 gaps:

1. Local Memory already has CLI surfaces (`local-memory`, `harness local-memory-preflight`, and `memory-gate`), but the legacy preflight path can still bypass the required CLI-backed memory lane and return a pass-looking result.
2. PR closeout can over-credit skipped or neutral CI checks as passing evidence.
3. Runtime packet contracts are mostly TypeScript-only; key `v1` packet schemas are not published under `contracts/`.
4. Session and workstream evidence exists as concepts, but there is no first-class `session-context` command that future agents can traverse.
5. Safety policy has a mismatch between the stated human-mediated floor and the current high/medium warning chain.

Top 5 risks:

1. False-success closeout: agents may declare delivery truth while CI, memory, or required state was skipped.
2. Stale-state continuation: agents can route from older artifacts or context without a mechanical freshness challenge.
3. Contract drift: non-TypeScript consumers cannot validate important packet formats independently.
4. Lost provenance: future runs cannot consistently traverse tickets, docs, sessions, commits, reviews, and runtime evidence as one graph.
5. Approval bypass by downgrade: high-risk operations can be warned rather than blocked when policy chains are misconfigured.

Strongest existing foundations:

- `harness next --json` emits a typed decision packet with safe-to-run, retry, risk, and permission metadata.
- `runtime-card/v1` models lifecycle state, blockers, attempts, recovery events, and evidence sources.
- Repo-contained artifact reads and writes reject absolute paths, off-repo paths, and symlink escapes.
- `pnpm check`, `pnpm architecture:check`, codestyle parity, docs guards, and skill/workflow validators give the repo a real validation backbone.
- Agent-readiness checks inspect instruction surfaces, artifacts, capability proof, approval gates, and traceability surfaces.
- Local Memory already has executable CLI surfaces: the external `local-memory` binary, `harness local-memory-preflight`, and `memory-gate`.

Highest-leverage next fixes:

1. Treat Local Memory as a required CLI capability: make preflight consistently delegate to `harness local-memory-preflight` or the next canonical `harness memory status/validate` surface instead of carrying a weaker legacy branch.
2. Treat skipped and neutral required CI checks as blocked or unknown for PR closeout claims.
3. Publish JSON Schemas for runtime-card, review-state, external-state, delivery-truth, and harness-decision packets.
4. Add a read-only `harness session-context --json` command that traverses issue, PR, branch, commit, runtime-card, review artifact, and session evidence.
5. Align policy-gate risk chains so high-risk actions require human approval or an explicit tracked exception.

Validation evidence gathered during this audit:

| Command | Outcome |
|---|---|
| `node --import tsx src/cli.ts --help` | pass |
| `node --import tsx src/cli.ts next --json` | pass; emitted `harness-decision/v1` with permission plan |
| `node --import tsx src/cli.ts commands --json` filtered for memory commands | pass; listed `local-memory-preflight` and `memory-gate` |
| `pnpm architecture:check` | pass with 4 warnings |
| reviewer artifact size check | pass; all requested reviewer artifacts were non-empty |
| `pnpm markdownlint-cli2 .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md` | pass |
| `node scripts/validate-audit-references.cjs .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md --json` | blocked; zero missing refs, 13 refs rejected as outside current allowed audit-artifact boundary |

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
|---|---|---:|---|---|---|
| Repository as Control Plane | B+ | High | Repo has AGENTS, CODESTYLE, Project Brain, active artifact index, memory, docs, validators, and command registry. | Live sessions/workstreams are not a first-class traversable graph. | Add `session-context/v1` command and use it in closeout and review handoff. |
| Runtime Truth and Decision Packets | A- | High | `harness-decision/v1` and `runtime-card/v1` are real CLI/runtime surfaces. | Some packet contracts are TypeScript-only and not independently schema-validated. | Publish JSON Schemas and schema parity tests for all public packet versions. |
| Claim-vs-Evidence Verification | B | High | PR closeout, delivery truth, review-state, external-state, audit-reference validation, and artifact guards exist. | Skipped/neutral CI and missing reviewer artifacts can still lead to overconfident synthesis unless explicitly guarded. | Fail required skipped/neutral CI claims and wire reviewer artifact coverage into closeout. |
| Mechanical Architecture Enforcement | B | High | `architecture:check` exists and passed in this audit with warnings. | Enforcement is custom, partly warning-based, and not a full import graph contract. | Promote critical warnings to errors and add a focused import-boundary validator before adopting broad tooling. |
| Harness Runtime Loop | B- | Medium | Attempts, blockers, recovery events, verification commands, `verify-work`, and preflight exist. | No unified run-loop command owns retry budget, recovery dispatch, verifier owner, and stop reason end to end. | Add a small `run-loop/v1` packet or extend runtime-card evidence with required attempt/stop metadata. |
| Trace and Session Evidence | C+ | Medium | Session is a source kind and PR closeout requires traceability references. | There is no first-class session/workstream traversal command and no default replayable trace producer. | Build read-only `session-context --json` first, then add replay/export support only after adoption. |
| Context Engineering | B- | Medium | Project Brain, Local Memory docs, learned fixes, skills, and active artifacts separate hot and cold context. | Stale context detection and context-window/skill-density enforcement are not mechanically routine. | Add context-health checks to `agent-readiness` and `harness next` advisory metadata. |
| Skills and Workflow Density | B | Medium | Skills and workflow validators exist, and command registry keeps execution discoverable. | Skill overlap, prompt-prose-only skills, and workflow density are not strongly measured. | Add a skill-density validator that checks trigger overlap, executable assets, and validation hooks. |
| Recovery and Failure Handling | B- | Medium | Preflight, verify-work, worktree checks, PR closeout, and runtime recovery events exist. | Recovery handlers are not yet a deterministic dispatcher keyed by failure class. | Convert the top repeated recovery cases into named recovery actions with tests. |
| Governance and Safety | B | High | Permission plans, authz checks, policy-gate, secret scanning, and approval language exist. | Policy chain can warn where the contract implies human-mediated blocking. | Align `harness.contract.json`, `policy-gate`, and tests so high-risk actions fail closed. |

## 3. Evidence-to-Code Mapping

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
|---|---|---|---|---|---:|
| Root instruction file plus short path-scoped rules | THE_HARNESS.md lines 36 and 46 | `AGENTS.md`, nearest scoped instruction content supplied in this task, `CODESTYLE.md`, `codestyle/README.md`, agent-readiness command surface | implemented_enforced | A- | High |
| Mistakes promoted into durable operating memory | THE_HARNESS.md line 66 | `.harness/memory/LEARNINGS.md`, `docs:steering:guard`, `pnpm check` | partial | B- | Medium |
| Capability tools for logs, tests, browser/screenshot, and environment truth | THE_HARNESS.md line 93 | `package.json` scripts, `contracts/browser-evidence.schema.json`, agent-readiness command surface, `src/commands/ui-loop.ts` | implemented_not_enforced | B- | Medium |
| Durable prompts and structured decision capture | `THE_HARNESS.md` lines 112 and 437 | `src/lib/decision/harness-decision.ts`, `harness next --json` | partial | B | Medium |
| Session-context and workstream traversal tools | THE_HARNESS.md line 122 | `src/lib/runtime/runtime-card.ts`, `src/lib/session/session-closeout.ts`, PR closeout traceability docs | partial | C | Medium |
| Slash commands that are read-only by default and produce structured reports | THE_HARNESS.md line 158 | `src/cli.ts`, `src/lib/cli/command-registry.ts` | implemented_enforced | A- | High |
| Reviewer subagents before risky commits | THE_HARNESS.md line 171 | reviewer reports, `scripts/validate-reviewer-coverage.cjs`, review swarm contract supplied in this task | partial | B | Medium |
| Runtime card and current-state packet | Evidence-derived audit category | `src/commands/runtime-card.ts`, `src/lib/runtime/runtime-card.ts`, `src/commands/next-runtime-card.ts` | implemented_enforced | A- | High |
| Claim-vs-evidence closeout | Evidence-derived audit category | `src/lib/pr-closeout/`, `src/lib/delivery-truth/`, `src/lib/external-state/`, `src/lib/review-state/` | partial | B | High |
| Mechanical architecture enforcement | Evidence-derived audit category | `scripts/check-architecture-rules.cjs`, `pnpm architecture:check` | implemented_not_enforced | B | High |
| Safe command recommendation gates | Evidence-derived audit category | `src/lib/decision/harness-decision.ts`, `src/commands/next.ts`, `src/commands/policy-gate.ts` | partial | B | High |
| Visual regression and browser evidence | THE_HARNESS.md line 93 and gaps section in evidence | `contracts/browser-evidence.schema.json`, `src/commands/ui-loop.ts`, `package.json` `harness:ui:capture-browser-evidence` | scaffolded | C+ | Medium |
| Telemetry on agent behavior and recurrence | THE_HARNESS.md line 122 and gaps section in evidence | `.harness/memory/LEARNINGS.md`, PR closeout traceability, runtime-card source kinds | scaffolded | C | Medium |

## 4. Gap Register

### GAP-001: Local Memory CLI Exists but Preflight Can Bypass It

**Category:** validation / runtime / governance

**Current State:**
The adversarial reviewer found that a legacy positional preflight path disables Local Memory checks while still returning a pass-looking status. This is not because Local Memory cannot be a CLI capability. It already is: the repo exposes `harness local-memory-preflight`, `memory-gate`, and a shell fallback around the external `local-memory` binary. The gap is that preflight still has a compatibility path that can skip the required CLI-backed memory lane.

**Expected State:**
Local Memory should be used as a CLI tool. Required preflight should delegate to the current `harness local-memory-preflight` command, and the planned `harness memory status --json` / `harness memory validate --json` surfaces should become the broader status and validation contract. Any unavailable, stale, or blocked CLI result should fail closed in required mode.

**Evidence Basis:**
`THE_HARNESS.md` treats context, observability, verification, and provenance as separate harness layers. The repo's own AGENTS guidance says Local Memory and Project Brain are part of the required operating surface.

**Code Evidence:**
`scripts/codex-preflight.sh`; `src/commands/local-memory-preflight.ts`; `src/commands/memory-gate.ts`; `src/lib/cli/registry/local-memory-preflight-command-spec.ts`; `src/lib/cli/registry/memory-gate-command-spec.ts`; Local Memory references in repo instruction surfaces; adversarial reviewer report.

**Risk:**
Agents can begin multi-step work with stale or unavailable learned fixes while the bootstrap command still appears green, even though a CLI-backed Local Memory check exists.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:**
First patch the preflight bypass: make legacy positional mode use the same required `harness local-memory-preflight` lane as flag-based required mode, or fail with an explicit optional-mode instruction. Then promote the planned `harness memory status --json` and `harness memory validate --json` commands from the evidence-memory spec as the stable broader memory contract.

**Suggested Software / Method:**
Existing command registry subcommands, JSON result envelope, fixture-backed Local Memory status checks, Bash regression fixture for preflight delegation.

**Files Likely To Change:**
`scripts/codex-preflight.sh`; `src/commands/local-memory-preflight.ts`; `src/commands/memory-gate.ts`; `src/lib/preflight/local-memory.ts`; the nearest existing preflight test file; `docs/agents/02-tooling-policy.md`; `docs/agents/03-local-memory.md` if command guidance changes.

**Validation Command:**
`node --import tsx src/cli.ts local-memory-preflight --json && bash scripts/codex-preflight.sh --stack auto --mode required`

**Acceptance Criteria:**
`harness local-memory-preflight` remains callable as a CLI tool; required preflight delegates to the same CLI-backed lane; legacy invocation cannot skip Local Memory without an explicit optional mode; planned `harness memory status/validate` commands have a clear migration target; regression test fails on the old behavior.

### GAP-002: Skipped or Neutral Required CI Can Be Credited as Passing Closeout Evidence

**Category:** verification / traceability

**Current State:**
The adversarial reviewer found that PR closeout claim builders can treat required check conclusions too broadly. The reviewer cited the required-check evidence and claim-helper logic in `src/lib/pr-closeout/evidence.ts`, `src/lib/pr-closeout/claim-builders.ts`, and `src/lib/pr-closeout/claim-helpers.ts`.

**Expected State:**
Required checks with skipped, neutral, cancelled, timed-out, missing, or stale states must be blocked or unknown for closeout success unless an explicit exception is recorded.

**Evidence Basis:**
The comparison harness emphasizes end-to-end verification and records of what happened. The user's audit rules require tests, CI, PR state, and runtime evidence to prove claims.

**Code Evidence:**
`src/lib/pr-closeout/`, `src/lib/external-state/`, `src/lib/delivery-truth/`.

**Risk:**
False delivery truth. A PR can appear ready while required CI never actually executed.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:**
Introduce a strict required-check conclusion classifier. Only success should satisfy required CI. Skipped/neutral should become `blocked_validation` or `unknown` with the exact check name and source timestamp.

**Suggested Software / Method:**
Table-driven Vitest cases over GitHub check conclusions; JSON fixture for required-check snapshots; Riteway-style assertion shape (`given`, `should`, `actual`, `expected`) implemented as a small Vitest helper rather than a new runner dependency.

**Files Likely To Change:**
`src/lib/pr-closeout/evidence.ts`, `src/lib/pr-closeout/claim-builders.ts`, `src/lib/pr-closeout/claim-helpers.ts`, `src/lib/external-state/`, related tests.

**Validation Command:**
`pnpm test -- src/lib/pr-closeout src/lib/external-state`

**Acceptance Criteria:**
Required skipped/neutral checks never satisfy passing closeout claims; PR closeout output names the blocker class; tests cover success, skipped, neutral, cancelled, missing, and stale states.

**Testing Pattern To Mine From Riteway:**
Use Riteway's assertion grammar for evidence-bearing tests without replacing Vitest:

```ts
expectBehavior({
  given: "required check conclusion is skipped",
  should: "block closeout success with blocked_validation",
  actual: classifyRequiredCheck({ conclusion: "skipped" }),
  expected: { status: "blocked", blockerClass: "blocked_validation" },
});
```

This gives every failing test the same five answers Riteway optimizes for: unit or behavior under test, expected behavior, actual output, expected output, and reproducible input. The harness already has `quality:self-affirming`; the missing improvement is a small evidence-test convention for critical runtime and closeout packets so tests stop mirroring implementation details and start reading like claim/evidence records.

### GAP-003: Public Runtime Packet Schemas Are Missing

**Category:** runtime / validation / API contract

**Current State:**
The API contract reviewer found that key `v1` packets are TypeScript validators/interfaces but not public JSON Schemas under `contracts/`. Existing contract schemas include agent-run and browser evidence schemas, but not runtime-card, review-state, external-state, delivery-truth, or harness-decision.

**Expected State:**
Every public `*/v1` packet emitted by CLI or consumed as artifact evidence should have a schema, example fixture, and parity test.

**Evidence Basis:**
The comparison harness has many tool surfaces, but Coding Harness' advantage is typed machine output. That advantage only holds if consumers can validate the packet outside the implementation module.

**Code Evidence:**
`contracts/`, `src/lib/runtime/runtime-card.ts`, `src/lib/review-state/`, `src/lib/external-state/`, `src/lib/delivery-truth/`, `src/lib/decision/harness-decision.ts`.

**Risk:**
Non-TypeScript consumers, CI scripts, and future agents cannot independently reject drifted packet shapes.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**
Add runtime-card, harness-decision, review-state, external-state-snapshot, and delivery-truth schema files under the existing `contracts/` directory. Add fixtures generated from current CLI output and a parity validator.

**Suggested Software / Method:**
JSON Schema Draft 2020-12; repo-owned schema validation script first. Add AJV only if the dependency is accepted through normal package review.

**Files Likely To Change:**
`contracts/`, an existing scripts validator location, the existing test tree, `package.json`.

**Validation Command:**
`pnpm test -- <contract schema tests> && node <schema validator> --all`

**Acceptance Criteria:**
Every emitted public packet has a schema; sample CLI outputs validate against schemas; schema drift fails CI.

### GAP-004: Session and Workstream Traversal Is Not a First-Class Agent Command

**Category:** traceability / context / runtime

**Current State:**
Runtime cards can reference session sources, PR closeout requires a traceability reference, and Project Brain tracks artifacts. The agent-native reviewer found no first-class command equivalent to the comparison harness' session-context/workstream tools.

**Expected State:**
An agent should be able to ask the repo for the current issue, branch, PR, commit, runtime cards, review artifacts, session references, stale evidence, and next traversal hints in one read-only JSON packet.

**Evidence Basis:**
THE_HARNESS.md line 122 describes session-context and meta-agent tools for sessions, summaries, workstreams, board updates, wakeups, spawned agents, and worktrees.

**Code Evidence:**
`src/lib/runtime/runtime-card.ts`, `.harness/active-artifacts.md`, `.harness/README.md`, `src/lib/session/session-closeout.ts`, `src/lib/cli/command-registry.ts`.

**Risk:**
Future runs have to reconstruct prior work by reading multiple unrelated files and may miss stale or contradictory evidence.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**
Add `harness session-context --json` as a read-only command. Start narrow: current git branch/head, changed files, active artifact references, runtime-card artifacts, review reports, PR/Linear references when locally available, and stale/missing artifact diagnostics.

**Suggested Software / Method:**
JSONL/session evidence ingestion only after the first command exists. Use the existing command registry and repo-contained artifact readers.

**Files Likely To Change:**
New session-context command files under `src/commands/` and `src/lib/`, command registry wiring under `src/lib/cli/registry/`, `docs/cli-reference.md`, tests.

**Validation Command:**
`node --import tsx src/cli.ts session-context --json`

**Acceptance Criteria:**
Command is read-only; output names stale/missing evidence; output links issues, PRs, commits, sessions, runtime cards, and review artifacts when present; command is listed in `harness commands --json`.

### GAP-005: Structured Decision Requests Are Partial

**Category:** governance / context / runtime

**Current State:**
`harness-decision/v1` includes a permission plan, safe-to-run, retry, and risk metadata. It does not yet provide a separate durable `decision-request/v1` artifact for ambiguous, expensive, destructive, or shared-state choices.

**Expected State:**
When an agent needs approval or human judgment, it should emit a small structured decision request with options, tradeoffs, default recommendation, expiry/freshness, and exact evidence references.

**Evidence Basis:**
`THE_HARNESS.md` includes durable prompts and proposed changes that are not applied automatically. The user's rules require approval gates for destructive, expensive, or shared-state actions.

**Code Evidence:**
`src/lib/decision/harness-decision.ts`, `src/commands/policy-gate.ts`, `harness.contract.json`.

**Risk:**
Human approval is present in prose and permission metadata, but not always captured as a reusable artifact that future runs can inspect.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**
Add `decision-request/v1` as an optional artifact emitted by `harness next`, `policy-gate`, or closeout when a human decision is required. Keep it advisory and read-only.

**Suggested Software / Method:**
JSON Schema, small CLI output envelope, no interactive UI required for the first patch.

**Files Likely To Change:**
`src/lib/decision/`, `src/commands/next.ts`, `src/commands/policy-gate.ts`, a new decision-request schema under `contracts/`, tests.

**Validation Command:**
`node --import tsx src/cli.ts next --json`

**Acceptance Criteria:**
High-risk or ambiguous recommendations include a structured decision request; request contains evidence refs and freshness; no command execution authority is granted by the artifact.

### GAP-006: Policy-Gate Risk Chain Contradicts the Stated Safety Floor

**Category:** governance / validation

**Current State:**
The adversarial reviewer found that the contract describes a human-mediated safety floor while the high/medium policy chain can warn and pass. The reviewer cited `harness.contract.json` and `src/commands/policy-gate.ts`.

**Expected State:**
High-risk actions should block for human approval or require an explicit tracked exception. Medium risk can warn only when the contract says warning is acceptable.

**Evidence Basis:**
The comparison harness links capability growth with restraint. The user explicitly asked for approval gates for destructive, expensive, or shared-state actions.

**Code Evidence:**
`harness.contract.json`, `src/commands/policy-gate.ts`, policy-gate tests.

**Risk:**
A governance claim appears stronger than the gate that actually runs.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**
Align `harness.contract.json` and `policy-gate` severity outcomes. If a high-risk gate is intentionally advisory, rename it or add a tracked exception field so the contract stops claiming a floor that is not enforced.

**Suggested Software / Method:**
Contract fixture tests; JSON Schema for policy chain entries; table-driven policy outcome tests.

**Files Likely To Change:**
`harness.contract.json`, `src/commands/policy-gate.ts`, the existing policy-gate tests, `docs/agents/06-security-and-governance.md`.

**Validation Command:**
`node --import tsx src/cli.ts policy-gate --contract harness.contract.json --json`

**Acceptance Criteria:**
High-risk policy scenarios fail or require approval; contract and implementation agree; docs name any advisory-only exceptions.

### GAP-007: Architecture Enforcement Is Useful but Still Too Local

**Category:** architecture / validation

**Current State:**
`pnpm architecture:check` passed during this audit with 4 warnings. The repo has custom architecture rules, but not a full published import graph or dependency-boundary contract.

**Expected State:**
Critical boundaries should be mechanically enforced as errors, and import graph drift should be visible in CI.

**Evidence Basis:**
The audit objective asks for dependency boundary enforcement, import graph validation, structural tests, schema validation, and CI rejection of architecture drift.

**Code Evidence:**
`scripts/check-architecture-rules.cjs`, `package.json` `architecture:check`, warnings from this audit.

**Risk:**
Boundary erosion can accumulate as warnings until the control-plane shape becomes harder to reason about.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**
Promote the current critical warnings to errors one rule at a time. Add an import-boundary validator that covers the command-registry facade pattern before adding broad dependency-cruiser or madge coverage.

**Suggested Software / Method:**
ts-morph or TypeScript compiler API for focused import checks; dependency-cruiser only after a narrow baseline is stable.

**Files Likely To Change:**
`scripts/check-architecture-rules.cjs`, the existing architecture-rule tests, `package.json`, architecture docs.

**Validation Command:**
`pnpm architecture:check`

**Acceptance Criteria:**
Known critical boundary breaches fail; warnings are documented with owners; new command families cannot bypass registry/module split tests.

### GAP-008: Stale Context Detection Is Not Routine Enough

**Category:** context / recovery

**Current State:**
Project Brain, Local Memory CLI/preflight, active artifact indexes, and audit-reference validation exist. Staleness is still distributed across docs and individual commands rather than a routine context-health check.

**Expected State:**
Agents should get a fast stale-context signal before acting on old active artifacts, old runtime cards, old PR state, missing Linear references, stale session summaries, or unhealthy Local Memory CLI/preflight state.

**Evidence Basis:**
The comparison harness lists context as an explicit layer; its gaps mention stale-context detection and context-window monitoring.

**Code Evidence:**
`.harness/active-artifacts.md`, `.harness/README.md`, agent-readiness command surface, `src/commands/next.ts`.

**Risk:**
Agents can route from old artifacts or stale research without realizing that live PR/CI/Linear state has moved.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**
Add `context-health/v1` fields to `agent-readiness` or `harness next`: stale artifacts, missing referenced files, old runtime-card timestamps, unobserved external horizon, Local Memory CLI/preflight state, and suggested refresh command.

**Suggested Software / Method:**
File mtime and git-head checks; runtime-card freshness fields; memory CLI/preflight status packet; no network required for first patch.

**Files Likely To Change:**
Agent-readiness implementation files, `src/lib/decision/`, `src/commands/next.ts`, tests.

**Validation Command:**
`node --import tsx src/cli.ts agent-readiness --json`

**Acceptance Criteria:**
Stale or missing active artifacts are reported as warnings or blockers; `harness next` can recommend a refresh before implementation.

### GAP-009: Reviewer Artifact Coverage Is Not Yet a Universal Closeout Gate

**Category:** verification / traceability

**Current State:**
Reviewer artifact rules are strong in the scoped review-swarm instructions supplied for this task, and `scripts/validate-reviewer-coverage.cjs` exists. This audit required manual coordinator verification of artifacts before synthesis.

**Expected State:**
When a swarm is requested, expected reviewer reports should be declared and validated by a repo command before closeout or audit synthesis.

**Evidence Basis:**
`THE_HARNESS.md` describes subagents and durable records. The user's request explicitly named three reviewers and required adversarial review for gaps.

**Code Evidence:**
Review swarm contract supplied in this task, `scripts/validate-reviewer-coverage.cjs`, reviewer reports.

**Risk:**
Mailbox summaries can be mistaken for artifact proof, or a missing reviewer can be silently omitted from final synthesis.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**
Expose reviewer coverage as a CLI command or wire the script into audit/closeout workflows. Require a small manifest listing expected reviewer artifacts and statuses.

**Suggested Software / Method:**
JSON manifest; existing validator script; no new dependency.

**Files Likely To Change:**
`scripts/validate-reviewer-coverage.cjs`, a new reviewer-coverage command under `src/commands/`, `src/lib/cli/registry/`, docs/tests.

**Validation Command:**
`node scripts/validate-reviewer-coverage.cjs --manifest <reviewer manifest> --json`

**Acceptance Criteria:**
Missing, empty, blocked, and malformed reviewer artifacts fail; successful artifacts must end with the expected `WROTE:` line; closeout can reference the validator output.

### GAP-010: Browser Evidence Exists but Visual Regression Is Not a Routine Gate

**Category:** validation / traceability

**Current State:**
The repo has a browser evidence schema and a `harness:ui:capture-browser-evidence` script. It does not yet look like a routine visual regression or screenshot comparison gate.

**Expected State:**
Frontend/user-visible changes should have a deterministic screenshot or browser-evidence lane with schema validation and failure classification.

**Evidence Basis:**
THE_HARNESS.md line 93 includes renderer/e2e tooling; its gap list calls out visual regression.

**Code Evidence:**
`contracts/browser-evidence.schema.json`, `src/commands/ui-loop.ts`, `package.json` `harness:ui:capture-browser-evidence`.

**Risk:**
User-visible breakage can be missed when tests pass but rendered behavior regresses.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**
Add a small `browser-evidence validate` lane that checks screenshot presence, viewport coverage, nonblank render, console errors, and schema validity. Do not build full visual diffing until this basic lane is green.

**Suggested Software / Method:**
Playwright screenshot metadata, existing browser evidence schema, JSON report fixtures.

**Files Likely To Change:**
`src/commands/ui-loop.ts`, `contracts/browser-evidence.schema.json`, an existing scripts validator location, tests.

**Validation Command:**
`pnpm run harness:ui:capture-browser-evidence`

**Acceptance Criteria:**
Browser evidence output validates; missing screenshots fail; blank screenshots fail; console error policy is explicit.

### GAP-011: Skill Density and Overlap Are Not Mechanically Checked

**Category:** skills / context / simplify

**Current State:**
Skill and workflow validators exist, but the repo does not appear to score skills for density, overlap, executable assets, or prompt-prose-only risk.

**Expected State:**
Skills should be few, high-density, non-overlapping, executable, validated, and tied to real workflows.

**Evidence Basis:**
The comparison harness has CLI-managed skills and a small set of operational layers. The user's audit asks to evaluate skill density and workflow density.

**Code Evidence:**
`package.json` `skill:validate`, skill directories, workflow validators.

**Risk:**
Instruction sprawl can make agent routing expensive and contradictory even when individual skills are well-written.

**Severity:** Low

**Fix Grade:** P3

**Recommended Fix:**
Add a skill-density report: trigger overlap, required executable assets, validator command, owned workflow, last proof, and deprecation candidate.

**Suggested Software / Method:**
Markdown frontmatter parser or simple structured scan; JSON report; no LLM scoring in CI.

**Files Likely To Change:**
`scripts/validate-packaged-skill.cjs`, agent-readiness command surface, skill docs.

**Validation Command:**
`pnpm skill:validate`

**Acceptance Criteria:**
Prompt-only skills are flagged; overlapping triggers are reported; each production skill names a validation path or is marked advisory.

### GAP-012: Replayable Trace Evidence Is Not the Default Runtime Product

**Category:** traceability / observability / recovery

**Current State:**
The repo has session-closeout, runtime-card source kinds, delivery truth, and traceability requirements. It does not yet appear to emit one default replayable JSONL trace for every significant harness run.

**Expected State:**
Important harness runs should produce replayable event evidence: command, inputs, outputs, verifier results, recovery events, stop reason, and final status.

**Evidence Basis:**
The comparison harness puts observability, verification, provenance, and coordination into separate layers. The audit categories require trace event schema, JSONL/session logs, tool-call records, command outputs, verifier results, recovery events, and final status records.

**Code Evidence:**
`src/lib/runtime/runtime-card.ts`, `src/lib/session/session-closeout.ts`, `contracts/agent-run-event.schema.json`, `contracts/agent-run-manifest.schema.json`.

**Risk:**
Agents can report a final state without enough event-level evidence to replay or debug the route.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**
Start with an opt-in `--trace-out` for `runtime-card`, `pr-closeout`, and `verify-work` style commands. Require trace schema validation before making it default.

**Suggested Software / Method:**
JSONL event schema, existing agent-run schemas, append-only trace writer, Vitest fixture replay.

**Files Likely To Change:**
New trace helpers under `src/lib/`, `src/commands/runtime-card.ts`, `src/lib/pr-closeout/`, `contracts/agent-run-event.schema.json`, tests.

**Validation Command:**
`node --import tsx src/cli.ts runtime-card --context local --trace-out <trace output path> --json`

**Acceptance Criteria:**
Trace file validates; every trace has start, command, verifier, recovery/attempt when present, stop reason, and final status records.

### GAP-013: Evidence-Bearing Tests Lack a Standard Behavior Packet Shape

**Category:** validation / traceability

**Current State:**
The repo has a strong Vitest baseline, related-test routing, `quality:self-affirming`, and codestyle guidance for meaningful assertions. What is not yet standardized is the shape of tests for evidence-bearing runtime contracts such as PR closeout, delivery truth, runtime cards, Local Memory preflight, policy-gate, and external-state packets.

**Expected State:**
Tests that prove claim/evidence behavior should use a compact, consistent assertion envelope: `given`, `should`, `actual`, and `expected`, with stable fixture inputs and externally pinned expected outputs.

**Evidence Basis:**
Riteway's current repository describes the five questions every test must answer and exposes a Vitest-compatible `assert({ given, should, actual, expected })` helper. That maps directly to Coding Harness' need for agent-readable validation evidence.

**Code Evidence:**
`codestyle/17-testing.md`, `package.json` test scripts, existing tests under `src/lib/pr-closeout/`, `src/lib/delivery-truth/`, `src/lib/runtime/`, `src/lib/external-state/`, `src/commands/local-memory-preflight.test.ts`, and `src/commands/memory-gate.ts`.

**Risk:**
Critical tests can pass while still being hard for agents to interpret, hard to triage after failure, or accidentally self-affirming because the expected value is derived from the same code path as the actual value.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**
Add a tiny Vitest-native helper, for example `expectBehavior({ given, should, actual, expected })`, and require it for evidence-bearing tests around closeout, policy, runtime packet, Local Memory, and external-state behavior. Do not adopt Riteway as a second runner unless a later migration proves the dependency is worth it.

**Suggested Software / Method:**
Vitest helper; table-driven fixtures; stable JSON snapshots only for public packet examples; extend `quality:self-affirming` or add `quality:behavior-tests` for critical test directories.

**Files Likely To Change:**
`src/lib/testing/behavior-case.ts` or an existing test helper location, `codestyle/17-testing.md`, `package.json`, critical runtime/closeout tests, and the existing quality guard script if enforcing the convention mechanically.

**Validation Command:**
`pnpm run quality:self-affirming && pnpm test -- src/lib/pr-closeout src/lib/delivery-truth src/lib/runtime src/lib/external-state src/commands/local-memory-preflight.test.ts`

**Acceptance Criteria:**
At least one critical closeout or runtime packet test suite uses the behavior helper; failing assertions print `Given ... should ...`; expected values are fixture-pinned; the self-affirming guard still passes; no new test runner is introduced.

## 5. Contradictions

1. Claim: Required Codex preflight protects the Local Memory and learned-fixes operating surface.
Actual implementation: A legacy preflight mode can disable the Local Memory check and still return a pass-looking status.
Evidence: `scripts/codex-preflight.sh` cited by the adversarial reviewer report.
Severity: Critical.
Operational impact: Stale learned fixes can be missed at the exact moment the agent needs them.
Recommended fix: make required preflight consistently delegate to the existing `harness local-memory-preflight` CLI path and fail closed on blocked or stale status.

2. Claim: PR closeout success is evidence-driven and CI-backed.
Actual implementation: Skipped or neutral required checks can be treated too generously by closeout claim logic.
Evidence: `src/lib/pr-closeout/evidence.ts`, `src/lib/pr-closeout/claim-builders.ts`, `src/lib/pr-closeout/claim-helpers.ts` cited by the adversarial reviewer.
Severity: Critical.
Operational impact: A PR can be reported ready without real required-check proof.
Recommended fix: Strict conclusion classifier for required checks.

3. Claim: High-risk actions have a human-mediated safety floor.
Actual implementation: Policy-chain behavior can warn and pass for high/medium risk.
Evidence: `harness.contract.json` and `src/commands/policy-gate.ts` cited by the adversarial reviewer.
Severity: High.
Operational impact: Governance confidence exceeds actual gate behavior.
Recommended fix: Align contract and policy outcomes; require tracked exceptions for advisory-only high-risk paths.

4. Claim: Public `v1` packets are stable machine contracts.
Actual implementation: Several important packets are TypeScript-only and lack public JSON Schemas.
Evidence: `contracts/` inventory and the api-contract reviewer report.
Severity: High.
Operational impact: External scripts and future agents cannot independently validate drift.
Recommended fix: Publish schemas and parity tests.

5. Claim: Future runs can traverse prior work through linked tickets, docs, files, sessions, and commits.
Actual implementation: Many links exist, but no first-class command assembles them into one read-only session/workstream packet.
Evidence: `.harness/active-artifacts.md`, runtime-card source kinds, PR closeout traceability, and the agent-native reviewer report.
Severity: Medium.
Operational impact: Future agents must rediscover context manually and may miss a stale or missing source.
Recommended fix: Add `harness session-context --json`.

## 6. Missing Features

Runtime state:

- First-class `session-context/v1` packet.
- Default runtime-card freshness challenge inside `harness next` for stale artifacts.
- Unified run-loop packet for verifier owner, retry budget, stop reason, and recovery handler.

Command selection:

- Structured `decision-request/v1` artifact for choices needing human approval.
- Policy-gate outcome alignment for high-risk operations.
- Explicit command recommendation block when required external state is stale or unobserved.

Verification:

- Strict required-check classifier for skipped/neutral CI.
- Riteway-style `given/should/actual/expected` assertion helper for evidence-bearing tests.
- Reviewer artifact coverage command integrated into audit/closeout workflows.
- First failing test or validation proof attached to recovery events.

Validation:

- JSON Schemas for runtime-card, harness-decision, review-state, external-state, delivery-truth, and decision-request.
- CI-facing schema parity tests for emitted packet examples.
- Stronger import-boundary validator for command facade and deep-module contracts.

Architecture enforcement:

- Import graph report with ownership of warnings.
- Ratchet that promotes repeated architecture warnings into errors.
- Published architecture contract for packet/schema ownership.

Traces:

- Default JSONL trace output for significant harness commands.
- Replay command or validator for trace files.
- Recovery event trace fields wired into command outputs.

Context:

- Context-health report for stale active artifacts, old runtime cards, missing evidence, and context-window risk.
- Skill-density report for overlap and prompt-only skills.
- Source-promotion policy from research/audit into active plan or decision surfaces.

Skills:

- Mechanical check that every operational skill has executable validation or is explicitly advisory.
- Trigger-overlap and deprecation report.
- Small skill acceptance fixtures for repeated workflow misses.

Recovery:

- Deterministic recovery dispatcher keyed by failure class.
- Blind retry prevention event in runtime traces.
- Stale branch and CI failure recovery actions as command-level routines.

Governance:

- `decision-request/v1` and approval artifact trail.
- Revocation/expiry fields for decisions that authorize shared-state changes.
- High-risk policy exception registry.

CI/CD:

- Schema parity in `pnpm check`.
- Reviewer coverage gate for PR closeout where review swarms were requested.
- Browser evidence validation for UI-affecting changes.

Observability:

- Agent behavior recurrence dashboard or JSON report.
- Session/workstream graph export.
- Context freshness and mistake recurrence metrics.

## 7. Fix Roadmap

### Phase 1 - Critical Trust Boundary Fixes

Objective: Remove false-success, stale-state, unsafe-command, and missing-evidence risk before adding more capability.

Fixes included: GAP-001, GAP-002, GAP-006, and the minimal reviewer coverage part of GAP-009.

Files likely affected: existing Local Memory command and preflight files under `src/commands/`, `src/lib/preflight/`, and `scripts/`, `src/lib/pr-closeout/`, `src/lib/external-state/`, `src/commands/policy-gate.ts`, `harness.contract.json`, `scripts/validate-reviewer-coverage.cjs`, tests.

Validation gates: `node --import tsx src/cli.ts local-memory-preflight --json`, `bash scripts/codex-preflight.sh --stack auto --mode required`, focused pr-closeout tests, `node --import tsx src/cli.ts policy-gate --contract harness.contract.json --json`, reviewer coverage validator.

Expected risk reduction: Critical false-green closeout and preflight downgrade paths are blocked, and Local Memory becomes reusable by commands beyond preflight.

### Phase 2 - Mechanical Enforcement

Objective: Convert public contracts and architecture boundaries into deterministic CI-verifiable artifacts.

Fixes included: GAP-003, GAP-007, and GAP-013.

Files likely affected: `contracts/`, an existing scripts validator location, `scripts/check-architecture-rules.cjs`, a small Vitest behavior helper, the existing test tree, `codestyle/17-testing.md`, `package.json`.

Validation gates: schema validator, `pnpm architecture:check`, `pnpm run quality:self-affirming`, focused behavior-helper tests, `pnpm check`.

Expected risk reduction: Packet drift and architecture boundary drift become mechanically visible.

### Phase 3 - Runtime Harness Maturity

Objective: Make prior work and current runtime state traversable, replayable, and failure-classified.

Fixes included: GAP-004, GAP-012, and the run-loop part of GAP-008.

Files likely affected: new session-context command files under `src/commands/` and `src/lib/`, new trace helpers under `src/lib/`, `src/commands/runtime-card.ts`, `contracts/agent-run-event.schema.json`, docs/tests.

Validation gates: `node --import tsx src/cli.ts session-context --json`, runtime-card trace validation, trace replay fixture tests.

Expected risk reduction: Future runs can traverse evidence instead of reconstructing it from scattered files.

### Phase 4 - Context and Skill Compression

Objective: Keep the agent hot path small while preserving durable evidence and learned fixes.

Fixes included: GAP-008 and GAP-011.

Files likely affected: agent-readiness implementation files, `src/lib/decision/`, skill validators, `.harness/README.md`, relevant docs.

Validation gates: `node --import tsx src/cli.ts agent-readiness --json`, `pnpm skill:validate`, context-health tests.

Expected risk reduction: Stale artifacts and overlapping skills become visible before they confuse routing.

### Phase 5 - Governance and Scaling

Objective: Add durable approval artifacts, audit trails, and maintenance surfaces without overbuilding orchestration.

Fixes included: GAP-005 plus policy exception registry and recurrence reporting.

Files likely affected: `src/lib/decision/`, a new decision-request schema under `contracts/`, `src/commands/policy-gate.ts`, docs/governance, tests.

Validation gates: `harness next --json`, `policy-gate --json`, decision-request schema validation.

Expected risk reduction: More autonomy is possible because restraint is recorded, reviewable, and revocable.

## 8. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
|---:|---|---|---|---|---|
| 1 | Make preflight consistently use `harness local-memory-preflight` | Very high | Low-medium | Stale learned-fix execution | Uses the CLI capability that already exists, then closes the downgrade path. |
| 2 | Strict CI conclusion classifier for closeout | Very high | Medium | False PR readiness | Prevents the most damaging delivery-truth failure. |
| 3 | Align policy-gate high-risk behavior | High | Medium | Unsafe command approval drift | Makes capability and restraint match. |
| 4 | Publish runtime packet JSON Schemas | High | Medium | Contract drift | Converts TypeScript-only contracts into repo-wide machine contracts. |
| 5 | Add `session-context --json` | High | Medium | Lost provenance | Makes future runs traverse prior work instead of guessing. |
| 6 | Add Riteway-style behavior assertions for evidence tests | Medium-high | Low | Self-affirming or opaque tests | Makes critical test failures agent-readable without changing runners. |
| 7 | Wire reviewer artifact coverage into closeout/audit | Medium-high | Low | Missing reviewer synthesis | Uses existing script and current review-swarm contract. |
| 8 | Add context-health stale artifact checks | Medium-high | Medium | Stale context routing | Keeps `harness next` from trusting old active artifacts. |
| 9 | Promote critical architecture warnings | Medium | Medium | Boundary erosion | Tightens the existing validator before adding tools. |
| 10 | Add opt-in JSONL trace output | Medium | Medium | Unreplayable runs | Builds on existing agent-run schemas. |

## 9. Implementation Advice

Build first:

- GAP-001 and GAP-002. They are concrete, scoped, and directly reduce false-success risk. For GAP-001, use the existing `harness local-memory-preflight` CLI boundary first, then patch preflight so every required path calls it consistently.
- GAP-003 immediately after, because schema parity will make later runtime maturity work safer.
- GAP-013 as a cheap testing quality ratchet while fixing GAP-002, because the same closeout tests can become the first behavior-packet examples.
- GAP-004 once the trust boundary fixes are in place, because session traversal is the missing bridge between strong local packets and future-run autonomy.

Do not build yet:

- A broad orchestration daemon.
- A large visual regression platform.
- Full cross-session knowledge graph automation.
- General-purpose dependency graph tooling before the current focused architecture rules have explicit error/warning ownership.

Remove or simplify:

- Any preflight compatibility path that owns hidden Local Memory behavior or silently weakens required checks.
- Any closeout helper that treats non-success required CI states as success.
- Any duplicated policy language that claims enforcement stronger than the actual command behavior.
- Any test that derives expected values from the same classifier or serializer under test.

Should become a validator:

- Public packet schema parity.
- Reviewer artifact coverage.
- Context freshness for active artifacts and runtime cards.
- Skill density and trigger overlap.
- High-risk policy-chain consistency.
- Evidence-bearing test shape for closeout, runtime packet, Local Memory, policy, and external-state suites.

Should become a schema:

- `runtime-card/v1`
- `harness-decision/v1`
- `decision-request/v1`
- `review-state/v1`
- `external-state-snapshot/v1`
- `delivery-truth/v1`
- `session-context/v1`
- `local-memory-status/v1`

Should become a skill:

- A narrow closeout-truth skill only after the stricter CI and reviewer validators exist.
- A recovery-handler design skill only after the top repeated failure classes are captured as code.

Should become documentation:

- Human explanation of the packet/schema ownership model.
- A short testing convention that maps Riteway's `given/should/actual/expected` shape onto this repo's Vitest helper and fixture rules.
- Policy exception rules for advisory-only safety gates.
- Session-context usage in agent handoff.

Should become CI:

- Schema parity.
- Critical architecture rules.
- Docs and contract sync for governance surfaces.
- Reviewer coverage only when a review-swarm manifest is present.

Should remain manual:

- Final human approval for destructive, expensive, shared-state, or publication actions.
- Selecting which high-level product direction a gap roadmap should pursue.
- Deciding when an advisory high-risk exception is acceptable.

## 10. Final Recommendation

Immediate next action: use the existing Local Memory CLI surface consistently, then fix the two false-success lanes: Local Memory preflight downgrade and skipped/neutral CI closeout classification.

Safest first patch: update `scripts/codex-preflight.sh` so required preflight delegates to `harness local-memory-preflight` on every required path and legacy positional mode cannot silently disable Local Memory checks. Then promote the planned `harness memory status --json` / `harness memory validate --json` commands as the broader status contract.

Highest-risk missing system: strict closeout evidence classification. Until skipped and neutral required checks are blocked or unknown, broader Codex autonomy can overstate delivery readiness.

Best validation command to add first: a focused pr-closeout fixture command that proves required check conclusions classify success, skipped, neutral, cancelled, stale, and missing states correctly.

Ready for broader Codex autonomy: not for unattended closeout or shared-state changes yet. The project is ready for bounded, read-only, validation-guided autonomy using `harness next --json`, runtime cards, and review artifacts. It needs the P0 trust-boundary fixes and public schemas before it should be trusted to make stronger delivery claims without Jamie rechecking the horizon.
