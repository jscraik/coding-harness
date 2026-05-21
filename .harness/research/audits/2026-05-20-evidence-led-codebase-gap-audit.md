# 2026-05-20 Evidence-Led Codebase Gap Audit

## Table of Contents

- [Audit Metadata](#audit-metadata)
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

## Audit Metadata

- **Audit date:** 2026-05-20
- **Target codebase:** `<repo-root>`
- **Primary skill:** `improve-codebase-architecture`
- **Evidence inputs:**
  - `.harness/research/audits/2026-05-19-evidence-led-codebase-gap-audit.md`
  - all Markdown files under `.harness/research/deep/`, including the 2026-05-18 source extractions, 2026-05-19 agent-RFT and agent-ready evidence, and `2026-05-20-agent-ready-code-patterns-evidence.md`.
- **Reviewer coverage:** `agent-native-reviewer`, `adversarial-reviewer`, `api-contract-reviewer`, and local API-contract inspection incorporated. The first expanded adversarial reviewer returned only a readiness handshake and was replaced; the final API-contract reviewer confirmed the duplicate `pr-closeout/v1` contract fork.
- **Method:** inspected live code, command entrypoints, runtime flows, schemas, validators, package scripts, CI files, harness instructions, `.harness` authority surfaces, and targeted runtime commands. Documentation-only claims are not treated as implementation.
- **Existing worktree note:** unrelated active edits existed before this audit in architecture, review-gate, CI migrate, docs, generated architecture artifacts, and CI migration extraction work. This audit does not interpret those dirty files as completed work unless live code paths were inspected. Fresh runtime probes showed `commands`, `next`, and `runtime-card` are importable; the CI migration extraction still has split helper ownership that should be finished before delivery.

Expanded deep evidence inventory:

- `.harness/research/deep/2026-05-18-coding-harness-evidence.md`: environment as product surface, repository as agent operating system, dynamic evidence, tool registry authority, trace history, deterministic verification, agent-owned observability, full delivery lifecycle delegation, maintenance agents.
- `.harness/research/deep/2026-05-18-praveen-govindaraj-evidence.md`: environment-first engineering, repository single source of truth, static/dynamic context pairing, automated maintenance agents, bug reproduction from operational evidence, autonomy tiering.
- `.harness/research/deep/2026-05-18-ryan-lopopolo-evidence.md`: zero-human-code forcing function, failure-driven decomposition, one-minute loop, repo text as agent OS, missing-context telemetry, review disagreement, full PR lifecycle delegation.
- `.harness/research/deep/2026-05-18-sean-grove-evidence.md`: specification as source artifact, clause-addressable policy, embedded challenge prompts, incident-to-spec loop, specification toolchain, precedent bank.
- `.harness/research/deep/2026-05-18-tejas-evidence.md`: harness as stable anchor, prompt-invariant improvement, controlled tool registry, trace history, deterministic claim-vs-trace verification, harness-owned recovery.
- `.harness/research/deep/2026-05-19-agent-rft-evidence.md`: shared language, grill-with-docs, ADRs, deep modules, validation bottleneck, issue triage state machine, out-of-scope records, context-window discipline.
- `.harness/research/deep/2026-05-19-agent-rft-patterns-evidence.md`: production-mirror eval data, trajectory IDs, file-selection F1, fact recall, tool-call budget, isolated trajectories, strict final-outcome graders.
- `.harness/research/deep/2026-05-19-eno-reyes-evidence.md`: verification as autonomy boundary, automated validation stack, flaky builds as adoption blockers, readiness analytics, customer issue to production feedback loop.
- `.harness/research/deep/2026-05-19-matt-pocock-evidence.md`: clarification before implementation, thin high-leverage docs, ubiquitous language, progressive disclosure, deep modules, regression-test-first bugs.
- `.harness/research/deep/2026-05-19-ryan-lopopolo-evidence.md`: humans steer agents execute, missing-context telemetry, environment inversion, review disagreement protocol, full PR lifecycle delegation, disposable runs with mandatory learning.
- `.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md`: proof-carrying boundary transformation, validation artifacts, changed-behavior proof, filesystem layout as agent UX, codemap before atlas, structural failure classification, evidence freshness.

Status vocabulary used below:

- `implemented_enforced`: production path exists, is wired, and has meaningful validation.
- `implemented_not_enforced`: production path exists but can be bypassed or is not required by a gate.
- `non_enforced` from the request is normalized to `implemented_not_enforced` in tables.
- `documented_only`: described in docs or audit text but no reachable implementation was found.
- `scaffolded`: type, schema, or helper exists but is not part of an executed workflow.
- `partial`: meaningful implementation exists but material behavior is missing.
- `contradicted`: repo says two incompatible things, or implementation violates the stated contract.
- `missing`: no meaningful implementation found.
- `unreachable`: implementation exists but no current runtime path uses it. When tests exist but no runtime path was found, the gap text also labels it `tested_but_unreachable`.
- `overbuilt`: more machinery exists than the reachable workflow justifies.

## 1. Executive Summary

**Overall maturity grade: C+**

Coding Harness has a strong control-plane foundation: root instructions are explicit, `.harness` has an authority map, evidence-pattern adoption is validated, command discovery exists, runtime cards exist, PR closeout is schema-backed, architecture rules are tested, and CircleCI runs broad governance checks. This is not a docs-only project.

The gap is sharper than “needs more code.” The codebase is strong at orientation and local governance, but not yet strong enough for the full single-prompt issue-to-merge loop. The riskiest failures are false-success paths: evidence that is summary-only, skipped checks treated as passing, duplicate schemas with the same version name, fuzzy Linear issue matching, and product-driver/video evidence still living mostly as planning language.

**Top 5 gaps:**

1. `Issue-To-Merge Contract` is not implemented as a first-class runtime loop. There is no reachable `issue-loop` command, `bugfix-record/v1`, `product-driver-profile/v1`, `visual-evidence-pair/v1`, or merge-decision gate.
2. Runtime and closeout evidence can still be laundered through summary-only or weak evidence paths. The runtime evidence producer can synthesize phase-exit evidence with empty gates, and PR closeout accepts weak traceability text.
3. Visual bug-fix evidence is partially present but not product-profile driven. Screenshots and video file verification exist, but the harness does not enforce before/after comparable UI evidence or product-specific video capture adapters.
4. Linear bug tracking is not yet a deterministic tracker contract. Existing `linear-sync` uses fuzzy issue search by label text and can update the wrong issue.
5. Several guardrails are documented but not mechanized: reviewer artifact-first outputs, subagent lifecycle ledger, role runtime freshness checks, full trace/session evidence, permission tiers, and observability extraction.

**Top 5 risks:**

1. Agent claims “ready to merge” while CI or closeout evidence is stale, skipped, neutral, or summary-only.
2. A bug fix lands without durable reproduction evidence, failure video/screenshot, resolution video/screenshot, or product-driver trace.
3. Linear automation creates or updates the wrong issue, making the tracker look current while routing work incorrectly.
4. Duplicate schema names let old and new `pr-closeout/v1` meanings coexist, which weakens agent-native contract reliability.
5. Context and skill sprawl reappear because authority, maintenance, internal evals, and observability are not yet fully wired into runtime gates.

**Strongest existing foundations:**

1. `.harness/README.md` defines an explicit authority map with policy, decision, execution-input, secondary-context, generated-runtime, and scratch classes.
2. `.harness/research/evidence-patterns.json` and `scripts/validate-evidence-patterns.cjs` turn selected research into validated adoption metadata.
3. `runtime-card/v1` is a real code path and captures branch, PR, Linear, active artifact, phase-exit, blocker, attempt, and recovery state.
4. `harness next` already supports required evidence mode with a real fail-closed path through `--evidence required`.
5. `scripts/check-architecture-rules.cjs` and `src/lib/architecture/module-boundaries.test.ts` give the repo a meaningful mechanical architecture enforcement base.

**Highest-leverage next fixes:**

1. Add a P0 false-success patch that blocks summary-only phase-exit evidence from satisfying required evidence.
2. Tighten PR closeout so skipped/neutral checks, stale checks, and arbitrary text traceability cannot count as complete required evidence.
3. Introduce the minimal `issue-loop` schema set before building the full loop: `bugfix-record/v1`, `product-driver-profile/v1`, `visual-evidence-pair/v1`, `linear-bug-tracker/v1`, and `merge-decision/v1`.
4. Add deterministic Linear bug tracker creation/update rules: required templates, labels, exact issue identity, duplicate prevention, and dry-run fixtures.
5. Add `review-artifact-ledger/v1` and a verifier command so review swarms are artifact-first in code, not only in `AGENTS.md`.

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
|---|---:|---|---|---|---|
| CLI Runtime Health and Helper Ownership | B- | High | Fresh smoke probes for `commands`, `next --evidence required`, `runtime-card`, and `pnpm typecheck` pass. | In-progress CI migration extraction still has split helper ownership that should be completed before delivery. | Finish the repo-bound path extraction and add command catalog importability smoke coverage. |
| Repository as Control Plane | B+ | High | Authority map, active artifacts, evidence-pattern manifest, AGENTS, CODESTYLE, CI contracts, and roadmap surfaces exist. | Maintenance and promotion are not yet uniformly gated for all new context types. | Keep `.harness` authority classes and add scanners for stale/duplicated canonical context. |
| Runtime Truth and Decision Packets | B- | High | `runtime-card/v1` and `harness-decision/v1` exist; `next --evidence required` blocks when evidence is missing. | Local/default paths still allow optional evidence and summary-only phase-exit packets. | Make required evidence default for issue/PR modes and reject summary-only phase-exit when used as gate evidence. |
| Claim-vs-Evidence Verification | C | High | PR closeout claims, evidence policy, evidence-verify, runtime-card sources, and check metadata exist. | Weak evidence can satisfy strong claims: skipped/neutral checks, basename matching, free-text traceability, no age freshness. | Add claim evidence provenance checks, strict CI conclusion policy, artifact binding, and freshness-window enforcement. |
| Mechanical Architecture Enforcement | B | High | Architecture rules, baseline ratchet, module-boundary tests, and Effect containment checks exist. | Some boundaries are still taste/documentation-led and not command-family complete. | Continue deep-module ratchets; add command catalog exhaustiveness and duplicate-schema guards. |
| Harness Runtime Loop | C- | High | `next`, `runtime-card`, `validation-plan`, `pr-closeout`, `review-gate`, `replay`, `remediate`, and pilot commands exist. | No full `Issue-To-Merge Contract` loop with reproduction, visual proof, PR feedback, CI remediation, and merge decision. | Build minimal `issue-loop` orchestrator and schemas before adding automation depth. |
| Trace and Session Evidence | C | Medium | `agent-run-manifest/v1`, event JSONL, terminal run records, and runtime evidence bundles exist. | Core cockpit commands do not consistently emit run records; `harness-run-context/v1` appears unreachable. | Wire trace/run records into `next`, `runtime-card`, `pr-closeout`, review swarms, and issue-loop. |
| Context Engineering | B- | Medium | Hot/cold authority is explicit in `.harness`; evidence patterns are validated; skills are routed. | Context scanners, contradiction detection, skill lifecycle state, and default-no enforcement are incomplete. | Add canonical-context scanner and skill package/lifecycle contract validation. |
| Skills and Workflow Density | C+ | Medium | Local skill exists and command catalog gives agent-facing modes. | Skills are not yet tied to package lifecycle, evals, permission profiles, or product profiles. | Add skill package contract and eval-backed lifecycle states before broad new skills. |
| Recovery and Failure Handling | C | High | Attempt ledger, recovery event types, replay/remediate surfaces, preflight, and validation gates exist. | Retry budgets, deterministic recovery handlers, stale-state classification, and async approval states are incomplete. | Add recovery taxonomy and terminal run-record emission for all control-plane commands. |
| Governance and Safety | C+ | High | Approval posture, branch workflow, CI ownership, CODESTYLE, PR closeout, and security checks exist. | Permission tiers, destructive-action gates, subagent artifact enforcement, and Linear/GitHub authority separation are partial. | Add permission/environment profiles, role freshness checks, and artifact-ledger gates. |
| Product Driver and Visual Evidence | D+ | High | UI loop and screenshot/video file validation exist. | No product-driver profile or before/after visual evidence contract; Browser is not modeled as one adapter among several. | Add product-driver adapters and evidence-pair gate for bug fixes. |
| Issue-to-Merge Autonomy | D | High | Pieces exist across PR closeout, validation, UI exploration, evidence verify, and Linear sync. | Full lifecycle is documented but not reachable as one contract. | Implement `issue-loop` as an artifact-first state machine with hard stop reasons. |
| Internal Evals and Observability | D+ | Medium | Repo has tests and local session/collector ecosystems available outside the codebase. | No harness-owned `coding-harness.json` extraction profile, OTEL mapping, or eval pack proving issue-loop behavior. | Add collector profile, trace schema, and offline eval cases for false-success and product-driver failures. |

## 3. Evidence-to-Code Mapping

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
|---|---|---|---|---:|---|
| CLI control plane importability | All deep evidence expects executable harness loop | `src/commands/ci-migrate-core.ts`; `src/lib/ci/repo-bound-paths.ts`; `node --import tsx src/cli.ts ...` smoke probes | partial | B- | High |
| Authority map: canon vs non-canon and source-of-truth classes | `.harness/README.md` | `.harness/README.md` authority levels and tracking policy | implemented_enforced | B+ | High |
| Evidence adoption manifest | `.harness/research/evidence-patterns.json` | `scripts/validate-evidence-patterns.cjs`; `package.json` `research:evidence:validate` | implemented_enforced | A- | High |
| Agent-ready code pattern adoption | `.harness/research/deep/2026-05-20-agent-ready-code-patterns-evidence.md` | `.harness/research/evidence-patterns.json` adopted entry and target surfaces | partial | B- | Medium |
| Runtime cards/current state packets | 2026-05-19 audit runtime-card sections | `src/lib/runtime/runtime-card.ts`; `src/commands/runtime-card.ts` | implemented_enforced | B | High |
| Required evidence mode for command recommendation | Runtime truth pattern | `src/commands/next-runner.ts`; `src/commands/next-args.ts` | implemented_not_enforced | B- | High |
| Command recommendation front door | Context architecture / thin surface | `src/lib/cli/command-registry.ts`; `src/commands/next.ts` | implemented_enforced | B | High |
| Agent-facing command catalog | Thin surface / professional output | `src/lib/cli/registry/command-capabilities.ts`; `src/cli.ts` `commands --for-agent` | partial | C+ | High |
| Production-safe command capability classification | Guardrails | `src/lib/cli/registry/command-capabilities.ts` fallback to `uncategorized` in production | contradicted | D | High |
| Claim-vs-evidence PR closeout | Claim/evidence verification pattern | `src/lib/pr-closeout/types.ts`; `src/lib/pr-closeout/evaluator.ts`; `src/commands/pr-closeout.ts` | partial | C+ | High |
| Duplicate closeout schema prevention | API contract hygiene | `src/lib/pr-closeout/types.ts`; legacy `src/lib/pr-closeout-types.ts` | contradicted | D | High |
| CI check freshness window | Stale-state detection | `.harness/ci-required-checks.json`; `src/lib/pr-closeout/claim-helpers.ts` | implemented_not_enforced | C- | High |
| Runtime evidence bundles | Trace/evidence pattern | `src/lib/runtime/runtime-evidence-bundle.ts`; `src/lib/runtime/runtime-evidence-producer.ts` | partial | C | High |
| Summary-only evidence classification | Runtime truth | `src/lib/runtime/runtime-evidence-producer.ts` emits `summary_only` phase-exit bundles | contradicted | D+ | High |
| Agent run records and JSONL event logs | Trace/session evidence | `src/lib/contract/run-records-core.ts`; `src/lib/contract/run-record-emitter-core.ts` | partial | C | Medium |
| Harness run context packet | Runtime truth / decision packet | `src/lib/contract/harness-run-context.ts` | unreachable | D | Medium |
| Mechanical architecture boundaries | Deep module pattern | `scripts/check-architecture-rules.cjs`; `src/lib/architecture/module-boundaries.test.ts` | implemented_enforced | B+ | High |
| Effect migration | Effect work remaining | `docs/architecture/module-boundaries.md`; current Effect imports in bounded modules | scaffolded | C- | Medium |
| Evidence file verification | Claim/evidence verification | `src/commands/evidence-verify.ts`; `src/lib/evidence/validator.ts`; `src/lib/evidence/types.ts` | implemented_enforced | B- | High |
| Evidence policy binding to claims | Claim/evidence verification | `src/lib/evidence/policy.ts` basename and singular/plural matching | partial | C- | High |
| Product-driver profile for Browser/video/simulator | Issue-to-merge/product loop | No reachable `product-driver-profile/v1` implementation found | missing | F | High |
| Bugfix record and visual evidence pair | Issue-to-merge/product loop | No reachable `bugfix-record/v1` or `visual-evidence-pair/v1` implementation found | missing | F | High |
| Linear bug tracker templates and labels | Linear production workflow | `src/commands/linear-sync.ts` fuzzy issue lookup | partial | D+ | High |
| Reviewer artifact-first enforcement | Review swarm contract | `AGENTS.md` policy; no matching runtime artifact verifier found | documented_only | D | High |
| Subagent lifecycle ledger | Hooks/subagent lifecycle pattern | No reachable ledger implementation found | missing | F | Medium |
| Observability extraction profile | Observability and internal evals | `~/.agents/session-collector` and `~/.agents/otel-collector` available, but no harness-owned profile found | documented_only | D | Medium |

## 4. Gap Register

### GAP-000: CI Migration Repo-Bound Path Helper Ownership Is Split

**Category:**  
runtime / validation / architecture

**Current State:**  
In the current checkout, direct CLI probes for `commands --for-agent --mode orient`, `next --evidence required`, and `runtime-card --json` dispatch successfully, and `pnpm typecheck` passes. However, the in-progress CI migration extraction imports repo-bound path helpers from `src/lib/ci/repo-bound-paths.ts` while `src/commands/ci-migrate-core.ts` still retains a local `function resolveRepoBoundPath` declaration later in the file. This is not currently a CLI-wide outage, but it is split helper ownership during a boundary extraction.

**Expected State:**  
The command registry, `next`, `runtime-card`, and other top-level CLI paths must remain importable during refactors. Deep-module extraction work should also leave one clear owner for repo-bound path validation helpers and be guarded by a smoke test that imports the CLI and prints the agent-facing command catalog.

**Evidence Basis:**  
All deep evidence files converge on the same point: the harness is only valuable when the runtime loop is executable. Repository-as-operating-system, deterministic verification, tool registry authority, proof-carrying boundaries, and one-minute feedback all require the CLI front door to start.

**Code Evidence:**  
- `src/commands/ci-migrate-core.ts` imports repo-bound helpers from `../lib/ci/repo-bound-paths.js`.
- The same file still declares a local `function resolveRepoBoundPath(...)` later in the module.
- Runtime probe: `node --import tsx src/cli.ts commands --json --for-agent --mode orient` passed and emitted `harness-command-catalog/v3`.
- Runtime probe: `node --import tsx src/cli.ts next --json --mode local --evidence required` reached the expected `required_evidence_missing` decision path.
- Runtime probe: `node --import tsx src/cli.ts runtime-card --json --repo .` emitted `runtime-card/v1`.
- `pnpm typecheck` passed.

**Risk:**  
Boundary extraction can leave duplicated or shadowed helper ownership, making future edits ambiguous and raising the chance of a later import/runtime regression. It also weakens the proof-carrying boundary transformation pattern from the deep evidence set.

**Severity:**  
Medium

**Fix Grade:**  
P1

**Recommended Fix:**  
Complete the repo-bound path extraction in one small patch: remove or rename the old local helper definitions after call sites use the imported helpers, or back out the import until the extraction is complete. Add a CLI importability smoke test to prevent future partial extractions from breaking the command front door.

**Suggested Software / Method:**  
Vitest startup smoke test, TypeScript compile check, command catalog JSON smoke, module-boundary test for extracted helper ownership.

**Files Likely To Change:**  
- `src/commands/ci-migrate-core.ts`
- `src/lib/ci/repo-bound-paths.ts`
- `src/commands/ci-migrate.test.ts`
- `src/lib/architecture/module-boundaries.test.ts`
- potentially `scripts/check-architecture-rules.cjs`

**Validation Command:**  
- `pnpm vitest run src/commands/ci-migrate.test.ts src/lib/architecture/module-boundaries.test.ts`
- `node --import tsx src/cli.ts commands --json --for-agent --mode orient`
- `node --import tsx src/cli.ts next --json --mode local --evidence required`

**Acceptance Criteria:**  
- CLI import continues to dispatch for `commands`, `next`, and `runtime-card`.
- Command catalog prints valid JSON.
- `next --evidence required` reaches its expected decision path instead of module import failure.
- The extracted helper has exactly one implementation owner.
- Tests prevent duplicate imported/local helper declarations from recurring.

### GAP-001: Issue-To-Merge Contract Is Not A Reachable Runtime Loop

**Category:** runtime / traceability / governance

**Current State:**

The repo has strong pieces: `next`, `runtime-card`, `validation-plan`, `evidence-verify`, `ui:explore`, `pr-closeout`, `review-gate`, `replay`, and `remediate`. The full sequence Jamie expects is not a single reachable contract: validate state, reproduce bug, record failure video, fix, drive product, record resolution video, open PR, handle feedback, remediate CI, escalate only for judgment, and merge.

**Expected State:**

An `Issue-To-Merge Contract` should be a first-class state machine with typed artifacts and hard stop reasons. It should produce durable evidence bundles, not only a PR body or final chat summary.

**Evidence Basis:**

The prior audit and conversation established: thin surface, strong guardrails, durable memory, professional output; issue-loop evidence bundles; Browser as a product-driver adapter; Linear bug tracker issues; and merge only after current evidence and authority are present.

**Code Evidence:**

- No reachable `issue-loop` catalog mode: `commands --for-agent --mode issue-loop` rejects the mode.
- No discovered `src/lib/issue-loop/*`, `src/commands/issue-loop.ts`, `bugfix-record/v1`, `product-driver-profile/v1`, `visual-evidence-pair/v1`, or `merge-decision/v1` implementation.
- `src/lib/cli/registry/command-capabilities.ts` only exposes agent catalog modes `orient`, `verify`, `review`, and `handoff`.

**Risk:**

Agents can complete isolated local steps while the actual issue-to-merge outcome remains unproven. This creates false autonomy: the project looks close to “single prompt to merge,” but the critical product and tracker evidence is not enforced.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:**

Add a minimal `issue-loop` command and schema layer before implementing heavy automation. The first patch should be read-only or dry-run capable and should validate the required artifact contract for an issue loop.

**Suggested Software / Method:**

JSON Schema or Zod-compatible schema definitions, Vitest fixtures, GitHub CLI connector for PR state, Linear API/connector for issue state, Browser product-driver adapter, Playwright/native recorder adapters behind profile contracts, JSONL event trace.

**Files Likely To Change:**

- `src/commands/issue-loop.ts`
- `src/lib/issue-loop/bugfix-record.ts`
- `src/lib/issue-loop/product-driver-profile.ts`
- `src/lib/issue-loop/visual-evidence-pair.ts`
- `src/lib/issue-loop/linear-bug-tracker.ts`
- `src/lib/issue-loop/merge-decision.ts`
- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/command-registry.ts`
- `tests` or colocated `*.test.ts` fixtures for issue-loop artifacts

**Validation Command:**

- `pnpm vitest run src/lib/issue-loop src/commands/issue-loop.test.ts`
- `node --import tsx src/cli.ts commands --json --for-agent --mode issue-loop`
- `node --import tsx src/cli.ts issue-loop verify --record artifacts/issue-loop/fixture/bugfix-record.json --json`

**Acceptance Criteria:**

- A missing reproduction screenshot/video is a hard blocker when the product profile requires it.
- A missing product-driver trace is a hard blocker for UI bugs.
- A missing PR, unresolved required feedback, stale CI, or missing merge authority blocks merge decision.
- The command produces `bugfix-record/v1` and `merge-decision/v1` JSON with stable schema versions.
- The command can run in dry-run mode without mutating GitHub or Linear.

### GAP-002: Product-Driver Profiles And Visual Evidence Pairs Are Missing

**Category:** runtime / validation / traceability

**Current State:**

The repo can explore/capture UI evidence and verify screenshot/video files, but it does not model product-specific driving or recording as a contract. Browser is not encoded as one adapter among several, and video capture is not profile-specific.

**Expected State:**

Every product should declare a `product-driver-profile/v1` with launch, ready check, driver, screenshot support, video support, and required evidence rules. Browser should be the default adapter for web-visible apps, while video should be supplied by Playwright, simulator, OS recorder, or another declared adapter.

**Evidence Basis:**

The issue-loop planning established: Codex Browser should drive browser-visible behavior and capture screenshots, but video capture depends on the product profile. Screenshots and video are first-class evidence.

**Code Evidence:**

- `package.json` includes `harness:ui:capture-browser-evidence` via `ui:explore`.
- `src/lib/evidence/types.ts` includes screenshot and video evidence types.
- `src/lib/evidence/validator.ts` validates screenshot/video file signatures.
- No `product-driver-profile/v1`, `visual-evidence-pair/v1`, video adapter policy, or comparable before/after evidence gate was found.

**Risk:**

A UI bug can be “validated” by tests or a screenshot without proving the same user flow failed before and passed after. Video may be silently omitted or replaced with prose.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Create product-driver and visual-evidence contracts first, then wire Browser and Playwright/native/simulator capture adapters behind them. Treat video as required, optional, or not applicable with a precise product-profile reason.

**Suggested Software / Method:**

Codex Browser adapter, Playwright video, `xcrun simctl io booted recordVideo` for iOS, macOS screenshot/screen recording adapter, JSON Schema, Vitest fixture validation.

**Files Likely To Change:**

- `src/lib/product-driver/profile.ts`
- `src/lib/product-driver/browser-adapter.ts`
- `src/lib/evidence/visual-evidence-pair.ts`
- `src/commands/evidence-verify.ts`
- `src/commands/ui-loop.ts` or a new issue-loop integration

**Validation Command:**

- `pnpm vitest run src/lib/product-driver src/lib/evidence`
- `node --import tsx src/cli.ts evidence-verify --policy fixtures/visual-evidence-pair-required.json --json`

**Acceptance Criteria:**

- A required video cannot be replaced with a screenshot or prose summary.
- Browser screenshot evidence records driver steps and target URL.
- A before/after pair must reference the same route or declared comparable flow.
- Non-visual products can mark video `n.a.` only with product-profile support.

### GAP-003: Linear Bug Tracker Contract Is Unsafe And Under-Specified

**Category:** governance / runtime / recovery

**Current State:**

Linear integration exists, but current sync behavior can search by label text and return the first matching issue. This is not safe enough for creating bug tracker issues from harness runs.

**Expected State:**

The harness should use Linear with required bug templates and labels to create tracker issues, but only through a deterministic `linear-bug-tracker/v1` contract: template identity, label identity, linked run ID, source issue, duplicate policy, dry-run output, and exact update target.

**Evidence Basis:**

The user explicitly asked that Coding Harness use Linear with required bug templates and labels to create bug issues as trackers.

**Code Evidence:**

- `src/commands/linear-sync.ts` has fuzzy issue lookup by label name around `findExistingIssue`.
- No discovered `linear-bug-tracker/v1` schema or duplicate prevention contract.

**Risk:**

The harness may update the wrong Linear issue or create tracker drift. This is especially dangerous because Linear becomes a route authority for future agents.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Add `linear-bug-tracker/v1` with exact issue identity and template/label requirements. Make fuzzy search a discovery helper only, never an update authority.

**Suggested Software / Method:**

Linear API/connector, JSON Schema, dry-run fixtures, exact label IDs, external ID/run ID in issue metadata, deterministic duplicate query.

**Files Likely To Change:**

- `src/lib/linear/bug-tracker.ts`
- `src/commands/linear-sync.ts`
- `src/lib/issue-loop/linear-bug-tracker.ts`
- `docs/agents/13-linear-production-workflow.md`

**Validation Command:**

- `pnpm vitest run src/commands/linear-sync.test.ts src/lib/linear`
- `node --import tsx src/cli.ts linear-sync --dry-run --json` with fixture-backed client or mocked connector

**Acceptance Criteria:**

- Bug issue creation fails if required template or label identity is missing.
- Updates require exact issue ID or exact external run reference.
- Duplicate prevention is deterministic and tested.
- Dry-run output lists exactly what would be created or updated.

### GAP-004: Runtime Evidence Can Synthesize Summary-Only Phase-Exit Packets

**Category:** runtime / validation / traceability

**Current State:**

Runtime evidence bundles can include synthesized phase-exit data with empty gates and `phaseExitSourceCompleteness: "summary_only"`. The bundle schema allows the completeness field to be optional when `phaseExit` exists.

**Expected State:**

Required evidence paths must distinguish gate-backed phase-exit proof from summary-only state. Summary-only evidence may be useful context, but it must not satisfy a required validation or closeout gate.

**Evidence Basis:**

Claim-vs-evidence verification and runtime truth require raw or gate-backed evidence for claims, not polished summaries.

**Code Evidence:**

- `src/lib/runtime/runtime-evidence-producer.ts` can create `phaseExit` with `gates: []` and `phaseExitSourceCompleteness: "summary_only"`.
- `src/lib/runtime/runtime-evidence-bundle.ts` does not require completeness whenever phase-exit data exists.

**Risk:**

Agents can claim validation or phase-exit readiness from summarized state that was never backed by actual gate results.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Make `phaseExitSourceCompleteness` required when `phaseExit` exists. Add a consumer-side rule: summary-only phase-exit cannot satisfy required evidence.

**Suggested Software / Method:**

TypeScript discriminated unions, Vitest negative fixtures, schema validation, `harness next --evidence required` regression tests.

**Files Likely To Change:**

- `src/lib/runtime/runtime-evidence-bundle.ts`
- `src/lib/runtime/runtime-evidence-producer.ts`
- `src/commands/next-runtime-card.ts`
- `src/commands/next-runner.ts`

**Validation Command:**

- `pnpm vitest run src/lib/runtime src/commands/next-runtime-card.test.ts src/commands/next-runner.test.ts`
- `node --import tsx src/cli.ts next --json --mode local --evidence required`

**Acceptance Criteria:**

- A bundle with `phaseExit` but no completeness classification fails validation.
- Summary-only phase-exit is allowed as context but rejected as required gate evidence.
- `next --evidence required` keeps blocking when runtime-card or gate-backed phase-exit evidence is missing.

### GAP-005: PR Closeout Treats Skipped Or Neutral Checks As Passing Evidence

**Category:** validation / governance

**Current State:**

The PR closeout check classifier treats `SUCCESS`, `NEUTRAL`, and `SKIPPED` as passing conclusions.

**Expected State:**

Required checks should pass only when their policy says the conclusion is acceptable. Skipped and neutral conclusions should be blocked or require an explicit per-check allow rule with a recorded reason.

**Evidence Basis:**

Professional output and claim-vs-evidence verification require exact validation outcomes. A skipped check is not proof that the code path was validated.

**Code Evidence:**

- `src/lib/pr-closeout/evidence.ts` includes `NEUTRAL` and `SKIPPED` in the passing conclusion set.
- `src/lib/pr-closeout/blockers.ts` uses conclusion status to decide blocker state.

**Risk:**

A PR can be reported as closeout-ready when required CI never actually ran.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:**

Change required-check policy to default-pass only for `SUCCESS`. Permit `SKIPPED` or `NEUTRAL` only through explicit check policy with reason, owner, and expiry.

**Suggested Software / Method:**

Required-check policy schema, Vitest fixtures for check conclusions, `.harness/ci-required-checks.json` extension for exceptional allowed conclusions.

**Files Likely To Change:**

- `src/lib/pr-closeout/evidence.ts`
- `src/lib/pr-closeout/blockers.ts`
- `.harness/ci-required-checks.json`
- `src/lib/pr-closeout/*.test.ts`

**Validation Command:**

- `pnpm vitest run src/lib/pr-closeout`

**Acceptance Criteria:**

- Required check with `SKIPPED` blocks by default.
- Required check with `NEUTRAL` blocks by default.
- Explicit allow policy requires reason and freshness metadata.

### GAP-006: Evidence Policy Can Match Unrelated Artifacts By Basename

**Category:** validation / traceability

**Current State:**

Evidence policy matching can use basename and singular/plural normalization to decide whether an artifact satisfies a requirement.

**Expected State:**

Evidence should be bound to a claim, run, changed file, product-driver step, or validation command through explicit IDs or artifact manifests. Weak filename similarity should not satisfy required evidence.

**Evidence Basis:**

Claim-vs-evidence verification requires structured evidence, not name resemblance.

**Code Evidence:**

- `src/lib/evidence/policy.ts` uses basename and singular/plural matching in requirement resolution.

**Risk:**

An unrelated screenshot, video, or validation file can satisfy a required evidence slot because it happens to have a similar name.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**

Introduce `evidence-manifest/v1` with `artifactId`, `runId`, `claimId`, `producer`, `createdAt`, `sourceCommand`, and `contentHash`. Permit basename matching only as an advisory suggestion.

**Suggested Software / Method:**

JSON Schema, content hashing, artifact manifest, Vitest negative fixtures, jq-friendly reports.

**Files Likely To Change:**

- `src/lib/evidence/policy.ts`
- `src/lib/evidence/validator.ts`
- `src/lib/evidence/types.ts`
- `src/commands/evidence-verify.ts`

**Validation Command:**

- `pnpm vitest run src/lib/evidence src/commands/evidence-verify.test.ts`

**Acceptance Criteria:**

- Similar artifact basename does not satisfy required evidence.
- Explicit artifact IDs and claim IDs are required for policy satisfaction.
- Evidence verification reports unmatched suggestions separately from accepted evidence.

### GAP-007: Duplicate `pr-closeout/v1` Contracts Coexist

**Category:** api-contract / governance / architecture

**Current State:**

There are two `pr-closeout/v1` type surfaces. The newer `src/lib/pr-closeout/types.ts` contains claims, attempt ledger, recovery event, head SHA, rollback, and missing context fields. The older `src/lib/pr-closeout-types.ts` declares the same schema version but lacks several of those fields and is used by legacy closeout helpers.

**Expected State:**

A schema version should have one canonical meaning. Legacy compatibility should either adapt to the canonical contract or use a distinct legacy schema name.

**Evidence Basis:**

Canonicity and interoperability require explicit authority boundaries. One version string cannot mean two things.

**Code Evidence:**

- `src/lib/pr-closeout/types.ts` declares the current closeout contract.
- `src/lib/pr-closeout-types.ts` declares another `PR_CLOSEOUT_SCHEMA_VERSION = "pr-closeout/v1"`.
- Legacy files `src/lib/pr-closeout-status.ts`, `src/lib/pr-closeout-blockers.ts`, and `src/lib/pr-closeout-harness-gates.ts` import the old type surface.

**Risk:**

Agents, tests, and scripts can validate different documents with the same schema name and disagree about readiness.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**

Migrate legacy helpers to the canonical `src/lib/pr-closeout/*` contract or rename the legacy schema to `pr-closeout-legacy/v0`. Add a duplicate-schema guard that fails when two files export the same schema version string outside an approved alias map.

**Suggested Software / Method:**

ts-morph or rg-based schema constant scanner, Vitest contract tests, architecture rule in `scripts/check-architecture-rules.cjs`.

**Files Likely To Change:**

- `src/lib/pr-closeout-types.ts`
- `src/lib/pr-closeout-status.ts`
- `src/lib/pr-closeout-blockers.ts`
- `src/lib/pr-closeout-harness-gates.ts`
- `scripts/check-architecture-rules.cjs`

**Validation Command:**

- `pnpm vitest run src/lib/pr-closeout src/lib/pr-closeout-status.test.ts`
- `pnpm architecture:check`

**Acceptance Criteria:**

- Only one canonical `pr-closeout/v1` contract remains.
- Legacy compatibility, if needed, has an explicit version name and adapter.
- Architecture check fails on unapproved duplicate schema constants.

### GAP-008: Reviewer Artifact-First Contract Is Policy-Only

**Category:** traceability / governance / skills

**Current State:**

`AGENTS.md` requires one report per reviewer under `artifacts/reviews/<reviewer>.md`, status lines, blocker classifications, and coordinator verification. The codebase does not appear to enforce those artifacts after review swarms run.

**Expected State:**

Review swarms should produce a machine-readable `review-artifact-ledger/v1`. The coordinator should fail closed if expected artifacts are missing, empty, stale, or not integrated.

**Evidence Basis:**

Subagent lifecycle and artifact-first evidence are core agent-native guardrails. Mailbox text is not completion evidence.

**Code Evidence:**

- `AGENTS.md` defines the review swarm contract.
- Existing role guard scripts validate role inventory/text, not actual per-run artifacts.
- No reachable `review-artifacts-verify` command or `review-artifact-ledger/v1` was found.

**Risk:**

The harness can appear to have run a multi-agent review while losing the actual reports or treating mailbox summaries as proof.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**

Add a `harness review-artifacts-verify --json` command and ledger schema. Wire it into review-gate and PR closeout where review swarms are required.

**Suggested Software / Method:**

JSONL ledger, file existence/non-empty checks, artifact freshness timestamps, role IDs, status enum, Vitest fixtures.

**Files Likely To Change:**

- `src/commands/review-artifacts-verify.ts`
- `src/lib/review-artifacts/ledger.ts`
- `src/commands/review-gate-core.ts`
- `src/lib/pr-closeout/evaluator.ts`

**Validation Command:**

- `pnpm vitest run src/lib/review-artifacts src/commands/review-artifacts-verify.test.ts src/commands/review-gate.test.ts`

**Acceptance Criteria:**

- Missing reviewer report blocks when the run expected it.
- Empty report blocks.
- Mailbox/status text alone is ignored as artifact evidence.
- Ledger records requested, completed, blocked, failed-artifact, integrated, and closed reviewers.

### GAP-009: Command Capability Classification Fails Open In Production

**Category:** runtime / governance / architecture

**Current State:**

Uncategorized commands throw in non-production, but production returns `"uncategorized"`. That protects production startup but weakens the command catalog as an enforced contract.

**Expected State:**

Command capability classification should be exhaustive in every environment. Production should fail the catalog build or command registration, not silently degrade.

**Evidence Basis:**

Thin surface and strong guardrails require command intent, mode, safety, and automation profile to be known before agents use a command.

**Code Evidence:**

- `src/lib/cli/registry/command-capabilities.ts` has a production fallback for missing command category.

**Risk:**

New commands can become agent-visible or callable without proper safety classification.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:**

Make unknown command classification fail in all environments. If production fallback is needed for externally installed older commands, require an explicit compatibility allowlist with owner and expiry.

**Suggested Software / Method:**

Exhaustive command metadata tests, `satisfies` maps in TypeScript, architecture check against command registry.

**Files Likely To Change:**

- `src/lib/cli/registry/command-capabilities.ts`
- `src/lib/cli/registry/command-capability-rules.ts`
- `src/lib/cli/command-registry.ts`

**Validation Command:**

- `pnpm vitest run src/lib/cli/registry`
- `node --import tsx src/cli.ts commands --json --for-agent --mode orient`

**Acceptance Criteria:**

- Any registered command missing capability metadata fails tests and catalog generation.
- Production no longer silently labels commands `uncategorized` unless explicitly allowlisted.

### GAP-010: `harness-run-context/v1` Is Scaffolded But Unreachable

**Category:** runtime / traceability

**Current State:**

`src/lib/contract/harness-run-context.ts` defines a rich run context contract, but code search did not find imports or runtime use outside the defining file.

**Expected State:**

The harness run context should be emitted or consumed by runtime-card, issue-loop, review-gate, PR closeout, and run-record flows. If it is not needed, it should be removed to avoid contract theater.

**Evidence Basis:**

Runtime truth should come from reachable packets, not unused schemas.

**Code Evidence:**

- `src/lib/contract/harness-run-context.ts` exists.
- No reachable references to `HarnessRunContext` or `harness-run-context` were found in current code paths.

**Risk:**

Agents and humans may assume there is a canonical run context when actual commands do not produce or consume it.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**

Either wire `harness-run-context/v1` into runtime-card and terminal run records, or delete/defer it until issue-loop needs it.

**Suggested Software / Method:**

Runtime-card adapter, run-record embedding, JSON Schema, reachability test using import graph or direct command fixture.

**Files Likely To Change:**

- `src/lib/contract/harness-run-context.ts`
- `src/lib/runtime/runtime-card.ts`
- `src/lib/contract/run-record-emitter-core.ts`
- `src/commands/issue-loop.ts` when added

**Validation Command:**

- `pnpm vitest run src/lib/contract src/lib/runtime`

**Acceptance Criteria:**

- At least one production command emits or consumes `harness-run-context/v1`.
- Tests prove the packet is reachable through the command path.
- If deferred, docs and exports do not present it as current runtime truth.

### GAP-011: Traceability Can Be Satisfied By Arbitrary Free Text

**Category:** traceability / governance

**Current State:**

PR closeout traceability can be complete when an arbitrary non-empty `aiSessionTraceability` string exists, even without a session ID, trace ID, runtime-card, or artifact reference.

**Expected State:**

Traceability should require at least one structured reference: Codex session ID, session-collector artifact, run record, runtime evidence bundle, PR closeout artifact, or explicit `n.a.` reason from an allowed enum.

**Evidence Basis:**

Professional output requires structured evidence over conversational memory.

**Code Evidence:**

- `src/lib/pr-closeout/evaluator.ts` traceability logic accepts free-text traceability.

**Risk:**

PRs can satisfy traceability with vague prose that cannot be audited later.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Replace free-text completion with `traceability-ref/v1` entries. Permit free text only as description attached to a structured reference.

**Suggested Software / Method:**

JSON Schema, strict enum for trace ref type, artifact existence checks, session-collector integration.

**Files Likely To Change:**

- `src/lib/pr-closeout/evaluator.ts`
- `src/lib/pr-closeout/types.ts`
- `src/lib/pr-closeout/evidence.ts`

**Validation Command:**

- `pnpm vitest run src/lib/pr-closeout`

**Acceptance Criteria:**

- Non-empty prose alone does not complete traceability.
- Structured session/artifact/run refs complete traceability only when valid.

### GAP-012: CI Freshness Window Is Configured But Not Enforced In Closeout

**Category:** validation / stale-state

**Current State:**

`.harness/ci-required-checks.json` carries `freshnessWindowDays`, but closeout freshness logic mainly checks whether check head SHAs match the current head.

**Expected State:**

Required check freshness should include both head SHA and age window. A check from the correct SHA can still be too old if policy says freshness expires.

**Evidence Basis:**

Stale-state detection is a core runtime truth requirement.

**Code Evidence:**

- `.harness/ci-required-checks.json` defines `freshnessWindowDays`.
- `src/lib/pr-closeout/claim-helpers.ts` focuses on head SHA freshness.

**Risk:**

Stale checks can appear current if they match the head SHA but exceed the configured freshness window.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:**

Load required-check policy into closeout evaluation and compare check timestamps against the configured window.

**Suggested Software / Method:**

Required-check policy parser, date arithmetic with deterministic test clock, Vitest fixtures.

**Files Likely To Change:**

- `src/lib/pr-closeout/claim-helpers.ts`
- `src/lib/review-gate/required-checks.ts`
- `src/lib/review-gate/required-check-sources.ts`

**Validation Command:**

- `pnpm vitest run src/lib/pr-closeout src/lib/review-gate`

**Acceptance Criteria:**

- Correct-SHA but expired required check is blocked.
- Fresh check at current head passes.
- Missing timestamp is classified as unknown/blocking, not passing.

### GAP-013: Effect Migration Is Only Partially Real

**Category:** architecture

**Current State:**

The codebase has Effect boundary ideas and some contained Effect usage, but not a canonical service/layer pattern with exemplar modules and migration enforcement.

**Expected State:**

Effect should have a documented and enforced service/layer pattern, one or two end-to-end converted modules, sync facade tests, Effect builder tests, module-boundary import tests, and a migration guide.

**Evidence Basis:**

The Effect work remaining notes state that current Effect work is much less complete than deep-module boundary work.

**Code Evidence:**

- `docs/architecture/module-boundaries.md` documents Effect containment.
- `src/lib/architecture/module-boundaries.test.ts` contains import containment checks.
- Current code includes contained Effect usage but no complete migration guide/exemplar pair.

**Risk:**

Effect can become a scattered style choice instead of an architecture pattern, creating new complexity without guardrail value.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**

Pick one stable control-plane module as the exemplar. Add sync facade plus Effect builder tests. Do not broaden Effect imports until the pattern is proven.

**Suggested Software / Method:**

Effect service/layer docs, Vitest, module-boundary tests, migration guide, public sync facade tests.

**Files Likely To Change:**

- `docs/architecture/effect-deep-modules.md`
- `docs/architecture/module-boundaries.md`
- `src/lib/architecture/module-boundaries.test.ts`
- One selected exemplar under `src/lib/*`

**Validation Command:**

- `pnpm vitest run src/lib/architecture/module-boundaries.test.ts <selected-module-tests>`

**Acceptance Criteria:**

- One exemplar module has a sync facade and Effect builder behind it.
- Effect imports remain allowed only in approved surfaces.
- Migration guide names what not to convert yet.

### GAP-014: Run Records Are Not Universal For Control-Plane Commands

**Category:** traceability / runtime

**Current State:**

Run-record primitives exist, but command coverage is uneven. Several core cockpit commands do not obviously emit terminal run records.

**Expected State:**

Every command that affects agent routing, validation, closeout, remediation, or issue-loop state should emit a terminal run record or structured evidence reference.

**Evidence Basis:**

Trace/session evidence should be replayable and durable.

**Code Evidence:**

- `src/lib/contract/run-records-core.ts` defines run manifests and events.
- `src/lib/contract/run-record-emitter-core.ts` emits terminal records.
- Current emission is concentrated in pilot/replay/remediate/review-gate surfaces, not uniformly in `next`, `runtime-card`, and `pr-closeout`.

**Risk:**

The harness cannot reconstruct why an agent chose a command, why closeout passed, or why a blocker was classified.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**

Add run-record emission to `next`, `runtime-card`, `pr-closeout`, `evidence-verify`, and eventually `issue-loop`.

**Suggested Software / Method:**

JSONL events, terminal run-record emitter, deterministic run ID, artifact refs, snapshot tests.

**Files Likely To Change:**

- `src/commands/next.ts`
- `src/commands/runtime-card.ts`
- `src/commands/pr-closeout.ts`
- `src/commands/evidence-verify.ts`
- `src/lib/contract/run-record-emitter-core.ts`

**Validation Command:**

- `pnpm vitest run src/lib/contract src/commands/next.test.ts src/commands/pr-closeout.test.ts`

**Acceptance Criteria:**

- Core control-plane command runs produce terminal records when `--evidence-out` or equivalent is requested.
- Records include command, status, blocker class, validation refs, and artifact refs.

### GAP-015: Context Maintenance Is Not Yet A Full Canonical Scanner

**Category:** context / governance

**Current State:**

Authority classes and evidence pattern validation exist, but there is no broad scanner for staleness, contradictions, duplicated instructions, broken references, invalid ownership fields, or missing context after recent code changes.

**Expected State:**

Canonical context should be scanned regularly. Canon is expected to agree with itself; non-canon may disagree but must be labeled and routed accordingly.

**Evidence Basis:**

The context architecture principles: canonicity, localisation, verifiability, portability, and default-no; maintenance starts with owners and automated scanners.

**Code Evidence:**

- `.harness/README.md` defines authority levels.
- `.harness/research/evidence-patterns.json` validates selected research adoption.
- No broad canonical-context scanner was found that checks AGENTS, skills, docs, schemas, and generated artifacts together.

**Risk:**

Canonical instructions can drift, duplicate, or contradict each other, making agents load stale or noisy context.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**

Add `harness context-scan --json` that checks canonical surfaces for owner metadata, broken references, duplicate directives, stale target files, and contradictions against authority classes.

**Suggested Software / Method:**

Markdown frontmatter parser, link checker, ripgrep, JSON Schema, CI scheduled scan, owner fields.

**Files Likely To Change:**

- `src/commands/context-scan.ts`
- `src/lib/context-scan/*`
- `.harness/context-policy.json`
- `.circleci/config.yml` or scheduled automation config

**Validation Command:**

- `pnpm vitest run src/lib/context-scan src/commands/context-scan.test.ts`
- `node --import tsx src/cli.ts context-scan --json`

**Acceptance Criteria:**

- Canonical docs without owner metadata fail or warn according to policy.
- Broken canonical links fail.
- Duplicate operational directives are reported with authority classes.
- Non-canonical research remains allowed but clearly classified.

### GAP-016: Observability And Internal Evals Are Not Yet Harness-Owned

**Category:** observability / traceability / validation

**Current State:**

The wider environment has `~/.agents/session-collector` and `~/.agents/otel-collector`, and those can be adapted. The repo does not yet contain a `coding-harness.json` extraction profile or internal eval pack that proves issue-loop, product-driver, permission, and false-success behavior.

**Expected State:**

Coding Harness should define what telemetry it needs to extract: session events, tool calls, subagent starts, artifact expected/written events, validation runs, product-driver captures, Linear/GitHub state changes, and closeout decisions. It should also have offline eval cases for false-success and recovery behavior.

**Evidence Basis:**

The conversation added internal evals and observability as missing pieces. The flywheel requires feedback from runtime evidence into code, validators, skills, and context.

**Code Evidence:**

- External collector directories exist outside this repo.
- No repo-local `coding-harness.json` collector profile or eval pack for issue-loop runtime contracts was found.

**Risk:**

The harness cannot learn systematically from repeated steering, failed runs, missing artifacts, or false closeout claims.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:**

Add a repo-owned observability extraction profile and internal eval fixtures. Keep collectors external, but make Coding Harness own the events and claims it needs.

**Suggested Software / Method:**

OpenTelemetry event taxonomy, JSONL session extraction, `coding-harness.json` profile, offline eval fixtures, fixture scorer with Vitest.

**Files Likely To Change:**

- `.harness/observability/coding-harness.json`
- `src/lib/evals/false-success-cases.ts` or equivalent eval fixtures
- `docs/agents/03-local-memory.md`
- `docs/agents/07b-agent-governance.md`

**Validation Command:**

- `pnpm vitest run src/lib/evals src/lib/observability`
- `jq . .harness/observability/coding-harness.json`

**Acceptance Criteria:**

- The profile names events to extract without leaking secrets.
- Evals catch skipped-check success, summary-only phase-exit, missing visual evidence, missing reviewer artifact, and fuzzy Linear update.

## 5. Contradictions

### CONTRADICTION-001: One Schema Version Means Two Closeout Contracts

- **Claim:** `pr-closeout/v1` is the PR closeout evidence contract.
- **Actual implementation:** Both `src/lib/pr-closeout/types.ts` and legacy `src/lib/pr-closeout-types.ts` declare `pr-closeout/v1` with different fields.
- **Evidence:** Legacy closeout files import the old type surface, while the public facade exports the newer one.
- **Severity:** High
- **Operational impact:** Agents can validate or reason against incompatible closeout shapes.
- **Recommended fix:** Consolidate the schema or rename legacy to an explicit legacy version; add duplicate-schema guard.

### CONTRADICTION-002: CI Freshness Window Exists But Closeout Does Not Enforce Age

- **Claim:** Required checks have freshness windows in `.harness/ci-required-checks.json`.
- **Actual implementation:** Closeout freshness primarily checks head SHA equality.
- **Evidence:** `.harness/ci-required-checks.json` contains `freshnessWindowDays`; closeout claim helpers focus on head SHA freshness.
- **Severity:** Medium
- **Operational impact:** A stale but head-matching check can be over-trusted.
- **Recommended fix:** Consume the freshness window in closeout evaluation.

### CONTRADICTION-003: Review Swarms Require Artifacts But Runtime Does Not Verify Them

- **Claim:** `AGENTS.md` requires one artifact per reviewer and forbids mailbox text as completion evidence.
- **Actual implementation:** Role guard scripts validate role inventory/text, not per-run review artifacts.
- **Evidence:** No reachable review artifact verifier or ledger was found.
- **Severity:** High
- **Operational impact:** Review coverage can be claimed without artifact proof.
- **Recommended fix:** Add `review-artifact-ledger/v1` and `review-artifacts-verify`.

### CONTRADICTION-004: Evidence Supports Video Types But Product Video Is Not Contracted

- **Claim:** Video is first-class evidence for bug fixes where the product profile requires it.
- **Actual implementation:** Evidence validators understand video files, but no product-driver profile or before/after video requirement exists.
- **Evidence:** `src/lib/evidence/types.ts` and validator support video; no product-driver/video adapter contract found.
- **Severity:** High
- **Operational impact:** Agents may omit video while still presenting a bug fix as validated.
- **Recommended fix:** Add product-driver and visual-evidence-pair contracts.

### CONTRADICTION-005: Linear Can Be A Route Authority But Sync Uses Fuzzy Matching

- **Claim:** Linear state should be durable, trusted task lifecycle context.
- **Actual implementation:** `linear-sync` can find an existing issue by label-name search and return the first match.
- **Evidence:** `src/commands/linear-sync.ts` fuzzy search behavior.
- **Severity:** High
- **Operational impact:** The harness can write state to the wrong tracker issue.
- **Recommended fix:** Use exact issue IDs or external run references for updates.

### CONTRADICTION-006: Command Catalog Is Agent-Facing But Not Exhaustive In Production

- **Claim:** The command catalog is the thin agent surface.
- **Actual implementation:** Uncategorized commands can fall back to `uncategorized` in production.
- **Evidence:** `src/lib/cli/registry/command-capabilities.ts` production fallback.
- **Severity:** High
- **Operational impact:** New commands can enter the surface without safety classification.
- **Recommended fix:** Fail command metadata generation for all missing capability classifications.

### CONTRADICTION-007: Harness Run Context Exists But Is Not Runtime Truth

- **Claim:** `harness-run-context/v1` looks like a current run context packet.
- **Actual implementation:** It appears unreferenced outside its defining file.
- **Evidence:** Code search found no reachable imports or command paths.
- **Severity:** Medium
- **Operational impact:** A schema can be mistaken for live runtime behavior.
- **Recommended fix:** Wire it into runtime-card/run-record/issue-loop or remove/defer it.

## 6. Missing Features

### Runtime State

- CLI importability smoke gate for the command registry, `next`, and `runtime-card`.
- `Issue-To-Merge Contract` state machine.
- `bugfix-record/v1` bundle.
- `merge-decision/v1` with authority and blocker fields.
- Required default runtime evidence for issue/PR modes.
- Async approval state machine: `not_required`, `requested`, `pending`, `approved`, `denied`, `expired`, `resumed`, `blocked`.

### Command Selection

- `commands --for-agent --mode issue-loop` catalog mode.
- Production-failing exhaustive command metadata.
- Product-profile-aware command recommendations.
- Command recommendation that refuses product-driver validation gaps for UI bugs.

### Verification

- Gate-backed-only phase-exit evidence for required evidence paths.
- Strict CI conclusion policy.
- Required-check age freshness.
- Structured traceability refs.
- Before/after visual evidence comparison.

### Validation

- `linear-bug-tracker/v1` dry-run fixtures.
- Evidence manifest binding and hash validation.
- Duplicate schema-version guard.
- Review artifact ledger verifier.
- Product-driver profile validation.

### Architecture Enforcement

- Effect service/layer exemplar and migration guide.
- Runtime reachability test for schema contracts.
- Command catalog mode expansion tests.
- Subagent lifecycle ledger architecture boundary.

### Traces

- Run records for `next`, `runtime-card`, `pr-closeout`, and issue-loop.
- Subagent start/expected artifact/written artifact events.
- Product-driver trace schema.
- Raw output refs linked to final claims.

### Context

- Canonical context scanner for AGENTS, skills, docs, schemas, and generated artifacts.
- Owner metadata guard for canonical non-production Markdown.
- Staleness and contradiction scanner.
- Skill package lifecycle state validation.

### Skills

- Skill package contract v1 with manifest, permission profile, environment profile, warmup, artifacts, evals, and lifecycle.
- Internal evals proving skill routing and default-no behavior.
- Skill density/deduplication checks.

### Recovery

- Deterministic recovery handlers for stale branch, missing dependencies, auth/session failure, remote compaction timeout, and CI failure classes.
- Retry budgets and blind-retry prevention.
- Recovery events wired to run records.

### Governance

- Permission profiles and deny semantics applied to harness runs.
- Environment profiles for local/remote/product-specific runs.
- Destructive action gate and revocation path.
- Human escalation classifier for judgment-only boundaries.

### CI/CD

- CI guard for duplicate schema versions.
- CI guard for issue-loop fixture contracts.
- CI guard for reviewer artifact ledgers where review swarms are required.
- CI scheduled context scanner.

### Observability

- `coding-harness.json` collector profile for session/OTEL extraction.
- Event taxonomy for subagent lifecycle, tool calls, artifacts, validation, PR/Linear updates, and closeout.
- Internal evals for false-success, missing evidence, fuzzy tracker, and stale-state cases.

## 7. Fix Roadmap

### Phase 1 — Critical Trust Boundary Fixes

**Objective:**

Eliminate false-success paths before expanding autonomy.

**Fixes included:**

- GAP-004: Block summary-only phase-exit from satisfying required evidence.
- GAP-005: Stop treating skipped/neutral required checks as passing by default.
- GAP-007: Consolidate duplicate `pr-closeout/v1` contracts.
- GAP-011: Replace free-text traceability completion with structured refs.
- GAP-012: Enforce check freshness window in PR closeout.

**Files likely affected:**

- `src/lib/runtime/runtime-evidence-bundle.ts`
- `src/lib/runtime/runtime-evidence-producer.ts`
- `src/commands/next-runtime-card.ts`
- `src/lib/pr-closeout/*`
- `src/lib/pr-closeout-types.ts` and legacy closeout helpers
- `.harness/ci-required-checks.json`

**Validation gates:**

- `node --import tsx src/cli.ts commands --json --for-agent --mode orient`
- `pnpm vitest run src/lib/runtime src/lib/pr-closeout src/commands/next-runtime-card.test.ts`
- `node --import tsx src/cli.ts next --json --mode local --evidence required`
- `pnpm architecture:check`

**Expected risk reduction:**

Major reduction in false-ready, stale-ready, and schema-drift closeout claims.

### Phase 2 — Mechanical Enforcement

**Objective:**

Turn documented guardrails into validators and command gates.

**Fixes included:**

- GAP-006: Replace basename evidence satisfaction with evidence manifests.
- GAP-008: Add reviewer artifact ledger and verifier.
- GAP-009: Make command metadata exhaustive in production.
- GAP-015: Add canonical context scanner.
- Duplicate schema-version architecture guard.

**Files likely affected:**

- `src/lib/evidence/*`
- `src/commands/evidence-verify.ts`
- `src/lib/review-artifacts/*`
- `src/commands/review-artifacts-verify.ts`
- `src/lib/cli/registry/*`
- `scripts/check-architecture-rules.cjs`
- `src/lib/context-scan/*`

**Validation gates:**

- `pnpm vitest run src/lib/evidence src/lib/review-artifacts src/lib/cli/registry src/lib/context-scan`
- `pnpm architecture:check`
- `pnpm check` after the focused tests pass.

**Expected risk reduction:**

Reduces artifact spoofing, missing reviewer evidence, unsafe commands, and context drift.

### Phase 3 — Runtime Harness Maturity

**Objective:**

Make issue and PR work replayable through runtime records and typed state.

**Fixes included:**

- GAP-001: Minimal issue-loop command and state machine.
- GAP-010: Wire or remove `harness-run-context/v1`.
- GAP-014: Emit run records from core cockpit commands.
- Add subagent lifecycle ledger events.
- Add retry budgets and recovery classifications.

**Files likely affected:**

- `src/commands/issue-loop.ts`
- `src/lib/issue-loop/*`
- `src/lib/contract/*`
- `src/commands/next.ts`
- `src/commands/runtime-card.ts`
- `src/commands/pr-closeout.ts`
- `src/lib/recovery/*`

**Validation gates:**

- `pnpm vitest run src/lib/issue-loop src/lib/contract src/commands/next.test.ts src/commands/runtime-card.test.ts src/commands/pr-closeout.test.ts`
- Fixture run: validate a synthetic issue-loop record from open to blocked/ready.

**Expected risk reduction:**

Turns fragmented command outputs into replayable, durable evidence.

### Phase 4 — Context and Skill Compression

**Objective:**

Keep the hot path thin while preserving deep evidence in lazy, validated references.

**Fixes included:**

- Skill package contract v1.
- Skill lifecycle states: available, installed, projected, enabled, warmed, runnable, validated.
- Permission/environment metadata for operational skills.
- Context scanner for canonical surfaces.
- Internal evals for routing and default-no behavior.

**Files likely affected:**

- `.agents/skills/coding-harness/*`
- `docs/agents/01-instruction-map.md`
- `docs/agents/03-local-memory.md`
- `.harness/research/evidence-patterns.json`
- `src/lib/context-scan/*`
- `src/lib/skills/*` if skill package validation is added here.

**Validation gates:**

- `pnpm skill:validate`
- `pnpm research:evidence:validate`
- `node --import tsx src/cli.ts context-scan --json`

**Expected risk reduction:**

Reduces context bloat, stale instructions, and prompt-only enforcement.

### Phase 5 — Governance and Scaling

**Objective:**

Make broader Codex autonomy safe across greenfield, brownfield, web, macOS, Electron, iOS, CLI, and MCP projects.

**Fixes included:**

- GAP-002: Product-driver profiles and video adapters.
- GAP-003: Linear bug tracker contract.
- GAP-016: Observability profile and internal evals.
- Permission and environment profiles for harness runs.
- Human escalation decision contract.

**Files likely affected:**

- `src/lib/product-driver/*`
- `src/lib/linear/*`
- `.harness/observability/coding-harness.json`
- `src/lib/evals/*`
- `docs/agents/13-linear-production-workflow.md`
- `docs/agents/07b-agent-governance.md`

**Validation gates:**

- `pnpm vitest run src/lib/product-driver src/lib/linear src/lib/evals`
- `jq . .harness/observability/coding-harness.json`
- Dry-run issue-loop fixture with Browser profile and Linear tracker fixture.

**Expected risk reduction:**

Moves the harness from repo governance into production software delivery governance.

## 8. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
|---:|---|---|---|---|---|
| 1 | Reject summary-only phase-exit for required evidence | Very high | Medium | False validation and false closeout | Small patch, direct trust-boundary improvement. |
| 2 | Treat skipped/neutral required checks as non-passing by default | Very high | Low | False green CI | Clear code path and easy negative fixtures. |
| 3 | Consolidate duplicate `pr-closeout/v1` contracts | High | Medium | API contract drift | Prevents agents using different closeout meanings. |
| 4 | Add structured traceability refs | High | Medium | Evidence laundering | Converts prose claims into auditable refs. |
| 5 | Enforce CI freshness age windows | High | Medium | Stale-state closeout | Uses existing policy field already present. |
| 6 | Finish CI migration helper extraction and add smoke coverage | Medium | Low/Medium | Helper drift and future import regressions | Current runtime probes pass, but ownership remains split and should be closed before delivery. |
| 7 | Add minimal `issue-loop` schemas | Very high | Medium | Missing issue-to-merge contract | Creates the spine before heavy orchestration. |
| 8 | Add product-driver profile and visual-evidence-pair | Very high | Medium/High | Unproven bug fixes | Makes screenshots/video real acceptance evidence. |
| 9 | Add Linear bug tracker contract | High | Medium | Wrong tracker updates | Required before Linear can be trusted as route authority. |
| 10 | Add reviewer artifact ledger verifier | High | Medium | Missing review evidence | Turns review swarms from policy to enforcement. |

## 9. Implementation Advice

**What to build first:**

Build the false-success patch before the full issue-loop. Specifically: runtime evidence completeness, strict PR closeout check conclusions, duplicate closeout schema consolidation, and structured traceability refs. In parallel, finish the active CI migration helper extraction and keep command-catalog smoke coverage so the CLI cannot regress silently.

**What not to build yet:**

Do not build a full autonomous merge bot first. Do not wire real Linear writes, GitHub merge actions, or native screen recording until dry-run schemas and fixture validators reject bad records.

**What to remove:**

Remove or rename duplicate schema-version surfaces. Remove unreachable contracts if they are not going to be wired in the next phase. Remove basename evidence matching as an acceptance mechanism; keep it only as a suggestion mechanism if useful.

**What to simplify:**

Keep `issue-loop` as an artifact validator first. A small command that validates a complete bugfix record is more valuable than a broad orchestrator that creates weak evidence.

**What should become a validator:**

- Summary-only phase-exit rejection for required evidence.
- Duplicate schema version scanner.
- Review artifact ledger verifier.
- Product-driver profile validator.
- Visual evidence pair validator.
- Linear bug tracker dry-run validator.
- Canonical context scanner.

**What should become a schema:**

- `bugfix-record/v1`
- `product-driver-profile/v1`
- `visual-evidence-pair/v1`
- `product-driver-trace/v1`
- `linear-bug-tracker/v1`
- `merge-decision/v1`
- `review-artifact-ledger/v1`
- `traceability-ref/v1`
- `evidence-manifest/v1`

**What should become a skill:**

The issue-to-merge workflow should eventually become a high-density skill, but only after the CLI contracts exist. The skill should route agents to commands and artifact schemas rather than restating the whole process as prose.

**What should become documentation:**

Only the authority map, product-driver profile authoring guide, Effect migration guide, and issue-loop operator overview need human-facing docs. Most details should live in schemas, validators, command help, and examples.

**What should become CI:**

- Duplicate schema-version guard.
- Architecture/import boundary ratchets.
- Evidence-pattern validation.
- Product-driver fixture validation.
- Context scanner in warning mode first, then required for canonical surfaces.
- PR closeout contract tests.

**What should remain manual:**

Human judgment should remain manual for ambiguous product taste, destructive production actions, security-sensitive permission escalation, merge authority overrides, and disputed reviewer feedback. The harness should prepare the evidence and ask for judgment; it should not pretend to own taste.

## 10. Final Recommendation

**Immediate next action:**

Ship the trust-boundary patch first: reject summary-only phase-exit as required evidence, stop skipped/neutral checks from passing by default, consolidate `pr-closeout/v1`, and require structured traceability refs. Also finish the active `ci-migrate-core.ts` helper ownership cleanup before delivery, because it is not the top autonomy gap but it is a cheap import-regression guard.

**Safest first patch:**

Start with runtime evidence completeness because it is small, local, and foundational: make `phaseExitSourceCompleteness` mandatory whenever `phaseExit` exists, and make consumers reject `summary_only` for required evidence. Then remove the remaining duplicate `resolveRepoBoundPath` ownership and keep a command-catalog smoke test so helper extraction cannot re-break importability.

**Highest-risk missing system:**

The highest-risk missing system is the `Issue-To-Merge Contract`: bugfix record, product-driver profile, visual evidence pair, Linear tracker, PR feedback ledger, CI remediation ledger, and merge decision. Without it, the harness can assist issue work but cannot honestly claim single-prompt issue-to-merge autonomy.

**Best validation command to add first:**

Add focused tests for false-success evidence:

- `pnpm vitest run src/lib/runtime/runtime-evidence-bundle.test.ts src/lib/runtime/runtime-evidence-producer.test.ts src/commands/next-runtime-card.test.ts`

Then add closeout false-green tests:

- `pnpm vitest run src/lib/pr-closeout src/lib/evidence`

**Broader Codex autonomy readiness:**

The project is ready for bounded Codex autonomy in orientation, validation planning, architecture checks, review support, and PR closeout assistance. It is not yet ready for unattended issue-to-merge autonomy across product types. The missing blockers are concrete and fixable: product-driver evidence, Linear tracker identity, strict closeout evidence, run records, reviewer artifact enforcement, and observability/internal evals.

The right path is not a rewrite. Keep the existing control plane, harden the false-success edges, then build the issue-loop as a small schema-backed runtime path with validators before adding more orchestration.
