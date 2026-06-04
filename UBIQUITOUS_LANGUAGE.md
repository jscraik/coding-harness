# UBIQUITOUS_LANGUAGE.md

## Table of Contents
- [Scope](#scope)
- [Canonical Terms](#canonical-terms)
- [Aliases and Terms to Avoid](#aliases-and-terms-to-avoid)
- [Relationships and Lifecycle](#relationships-and-lifecycle)
- [Prompt Translations](#prompt-translations)
- [Example Dialogue](#example-dialogue)
- [Flagged Ambiguities](#flagged-ambiguities)
- [Decision Log](#decision-log)
- [Source Notes](#source-notes)

## Scope
This glossary defines shared language for work in `/Users/jamiecraik/dev/coding-harness` so user prompts, agent actions, and repo governance terms stay aligned.

## Canonical Terms
| Term | Definition |
| --- | --- |
| synAIpse | The product and brand name for the AI Delivery Harness currently implemented by the coding-harness repository. Use this for external product language and concept docs. |
| AI Delivery Harness | The product category and descriptor for synAIpse: a governed system for moving AI-assisted software work from issue intake to merged main with evidence, review, and learning loops intact. |
| Coding Harness | The TypeScript control-plane repository that governs agentic development, review workflows, and validation contracts. |
| Lifecycle Harness | The issue-to-main operating model inside synAIpse: Linear issue, spec, plan, implementation, local validation, review, PR polling, independent review, green checks, merge, main sync, and feedback-loop capture. |
| Truth Lane | A separately observed source-of-truth lane such as local code, local validation, PR metadata, CI checks, review threads, tracker state, artifact evidence, merge readiness, or synced main. One lane does not prove another unless a current contract explicitly joins them. |
| Claim Authority | The documented permission for a doc, artifact, gate, receipt, or external source to support a specific delivery claim. Claim authority must name freshness, source, head SHA when relevant, and the lane it proves. |
| Guardrail | A durable standard, validator, schema, runbook, or review rule that prevents a repeated failure class from staying as chat-only guidance. |
| Runbook | A versioned operational workflow that defines purpose, trigger, source of truth, cursor, validation evidence, stop conditions, and feedback-loop behavior for repeated human or agent work. |
| Codex Runtime | The agent execution environment that owns sessions, permissions, workspace roots, tools, hooks, lifecycle events, and memory contributors. |
| Harness Control Plane | The Coding Harness interpretation layer that turns Codex/runtime evidence into repo workflow policy, validation lanes, PR evidence, Project Brain context, and safe next-action recommendations. |
| Expected Outcome Contract | The canonical outcome that Coding Harness must preserve: a portable agent operating system that makes Codex behave like a software engineer, not merely a code generator, across greenfield and brownfield projects with zero customer integration ceremony. |
| Portable Agent Operating System | The product shape where a dropped-in agent can self-orient, diagnose, bootstrap or upgrade safely, select validation, carry traceable evidence, and close the loop without the customer manually wiring the environment. |
| Zero Customer Integration Ceremony | The product bar that setup, diagnosis, validation routing, and blocker explanation are agent-owned; missing tools, credentials, permissions, or repo conventions become named blockers rather than customer homework. |
| Codex-Aligned, Harness-Stable | The architecture posture that prefers Codex runtime contracts when available while exposing them through stable harness interfaces instead of private Codex internals. |
| Codex Subtree | The `codex/` configuration surface that owns runtime config, agents, hooks, automations, and related verification scripts. |
| Control Plane | The canonical set of config files, scripts, and policies that decides how agents execute and validate work. |
| Canonical-only | The policy that requires using the documented, source-of-truth path instead of ad hoc or duplicate alternatives. |
| Wrapper Command | A repository-defined script entrypoint (for example in `scripts/` or `pnpm` scripts) that should be preferred over equivalent one-off commands. |
| Validation Lane | A scoped set of required checks used to prove a specific change surface is correct and compliant. |
| Validation Failure Classifier | A read-only classifier that turns one validation command observation into an actionable failure bucket such as introduced regression, pre-existing drift, environment/tooling failure, unrelated dirty worktree, missing credential, expected fixture stderr, or unknown failure. |
| Decision Contract | The stable machine-readable output schema family behind `HarnessDecision`, gates, and next-step recommendations. |
| Decision Source | Input evidence used to build a decision, such as git state, local artifacts, PR state, Linear state, command catalogs, or validation results. |
| Recommended Command | A wrapper command suggested by `harness next` or another decision surface as the next safe action; it is guidance, not executable authority by itself. |
| Operational Meta | Decision metadata that explains mode, file source, friction class, delay class, permission plan, source errors, and supporting evidence visibility. |
| Command Facade | The CLI/options adapter layer that parses user input, loads boundary artifacts, invokes command core behavior, and renders command output. |
| Command Core | The pure behavior layer that owns command decisions and should be easiest to test without terminal or filesystem setup. |
| Output Renderer | The layer that turns a command result into human output or a JSON contract without changing command behavior. |
| Control Surface | A documented repo artifact, command, schema, or generated evidence pack that agents are expected to use when making or validating workflow decisions. |
| Public Facade | The supported import or command entrypoint callers use for a deep module; implementation files stay hidden behind it. |
| Agent-Safe Boundary | A narrow, tested work area where agents can change behavior without leaking implementation detail or weakening surrounding contracts. |
| Manifest Assembler | The component that gathers focused specs, metadata, or command records into a governed manifest without owning each command's behavior. |
| Command Catalog Assembler | The registry component that assembles command specs into the published command catalog while workflow-specific parsing stays in focused adapters. |
| Command Adapter | A focused command layer that owns one command family's option parsing, delegation, and usage-error mapping. |
| CLI Option Adapter | The command-adapter responsibility for translating CLI flags into the command core's typed options without moving business behavior into the registry. |
| Runner Adapter | A focused adapter that delegates parsed command intent to runner functions and keeps execution plumbing out of registry catalogs. |
| Review Evidence Adapter | A provider-specific adapter that converts review-system evidence, such as CodeRabbit findings, into harness-readable review context. |
| Live Evidence Adapter | A boundary that reads current external or local state and turns it into a typed harness evidence snapshot. |
| Gate Result Adapter | A normalisation boundary that converts one gate's native output into the canonical gate-result shape. |
| Agent-Safe Work Area | A named doctor/runtime support boundary where agents can change checks or provider behavior without widening a command facade. |
| Deep Module Boundary | A stable public interface that hides richer implementation, has seam tests for caller-visible behavior, and gives agents a safe local work area. |
| Effect Boundary | An approved deep module entrypoint where `effect` may appear because typed failures, runtime sequencing, providers, retries, or resource handling would otherwise leak to callers. |
| Architecture Context Pack | The generated architecture evidence set, including `.diagram/**` and `AI/context/diagram-context.md`; it is evidence, not hand-written narrative. |
| Projection Surface | A generated, packaged, mirrored, or emitted surface that should be updated through its canonical source rather than patched directly. |
| Required Check Identity | The exact check name and owner contract used by branch protection and readiness validation, such as CircleCI, CodeRabbit, Semgrep Cloud, or GitHub Actions ownership. |
| Tracer Proof | The smallest production-like command, test, or executable path that proves an architecture-sensitive change without over-running unrelated validation. |
| Operation Profile | A bounded operating mode, such as `triage`, `fix`, `review`, `ci-babysit`, `linear-mutate`, or `release`, that names intent, allowed evidence, stop conditions, and required validation. |
| Harness Run Context | The `harness-run-context/v1` packet that records local runtime evidence such as repo identity, worktree roots, session IDs, trace IDs, workspace roots, permissions, targets, blockers, and lifecycle status. |
| PR Closeout Evidence | The `pr-closeout/v1` report that classifies PR readiness from PR metadata, check state, review blockers, dirty worktree state, CLI/tool availability, and AI session/traceability references. |
| Closeout Completion | The workflow state where PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and continuation/heartbeat state are all classified. Green checks are only validation evidence; they do not by themselves prove closeout completion. |
| Run Record | Durable run evidence under `artifacts/agent-runs/<runId>/`, including terminal manifests, event streams, and additive companion artifacts. |
| Runtime Evidence | Structured evidence about what actually happened during a run, including profile, roots, permissions, sessions, traces, validation, review artifacts, blockers, and lifecycle state. |
| Ablation Run | A controlled evaluation that removes a prompt, tool, context source, rule, gate, or workflow surface to prove whether behavior regresses or whether the removed surface was ceremony. |
| Distillation | The compression of large evidence sets such as labels, rollouts, tool calls, review threads, traces, and feedback into smaller rules, fixtures, prompts, or gates that preserve the useful behavior. |
| Organizational RLHF | The harness pattern of turning expert correction from onboarding, review, apprenticeship, incidents, and repeated work into evals, rules, memory, gates, and examples that shape future agent behavior. |
| Systems Thinking | The operating habit of spotting recurring blockers, designing systematic ways for people or agents to overcome them, and explaining how code carries that leverage. |
| Repeat-Feedback Admission | The stop-the-line process for handling high-signal steering the user has had to give more than once: infer the principle, search related surfaces, choose a durable destination, add an executable guard or tracked exception, and report the evidence before feature work resumes. |
| Current-Session Steering Admission Record | The proof packet created when Jamie says the agent is not permitted to proceed: feedback class, inferred principle, searched surfaces, durable destination, executable guard or tracked exception, forbidden recurrence behavior, and validation command. |
| Repeated-Error Research Pass | The required escalation when the same command, test, or runtime error happens twice: stop local retries, research trusted web or upstream sources, list 3-5 candidate fixes, choose the most efficient repo-fit fix, implement it, and record the evidence in PR closeout. |
| Env-Backed Validation Recovery | The required recovery step before calling a credentialed validation lane blocked: check `~/.codex/.env` for required variable names without printing values, load it into the exact validation command when present, and only then classify missing or unavailable credentials. |
| Tool Promotion Threshold | The decision rule for turning repeated judgment into infrastructure: if the same judgment is needed twice, or a failure mode can recur across slices, promote it into the smallest durable primitive that changes future behavior, such as a validator, guard script, CLI helper, workflow hook, fixture, or scoped skill. Keep one-off implementation knowledge in implementation notes, plan evidence, or PR closeout evidence. Create or update a skill only for a reusable routed workflow with explicit inputs, artifacts, validation, ownership, and review expectations. |
| CircleCI Env-Backed API Triage | The required recovery path before calling a CircleCI API, CircleCI log, or CircleCI job lane unavailable: load `~/.codex/.env` with `set -a; source ~/.codex/.env; set +a`, resolve `CIRCLECI_TOKEN`, `CIRCLE_TOKEN`, or `CIRCLE_API_TOKEN` without printing values, and use bounded network calls such as `curl --max-time` before classifying the API lane as blocked. |
| Safe PR Body File Handoff | The required handoff pattern for PR body or pull request body updates that contain Markdown, backticks, command snippets, or validation output: write a non-interpreting body file, pass it with `gh pr create --body-file` or `gh pr edit --body-file`, and validate it with `pr-template-gate --pr-body-file` instead of embedding content in shell interpolation, command substitution, or a raw `--body` string. |
| Workflow Skill | A high-level skill that completes a user-visible workflow end to end, such as logging in, uploading attachments and starting a chat, or granting a group access to a workplace agent. Workflow skills must be validated by outcome evidence, not only instruction readability. |
| Capture-The-Flag Eval | A workflow eval with an explicit flag or observable win condition planted in the target UI, product, repository, or tool surface. Capturing the flag proves the agent closed the loop for that scenario. |
| Skill Workout | An iterative skill-hardening run where Codex attempts a workflow, reflects on failures, commits targeted skill or harness improvements, and reruns until the flag is captured within the intended reliability and wall-clock constraints. |
| Win Condition | The concrete observable result that proves a workflow completed, such as a captured flag, created access grant, uploaded attachment, resolved review thread, passing gate, or retained trace artifact. |
| Steering Feedback | High-signal user correction about agent behavior, priorities, terminology, or operating assumptions. Repeated steering must become a gate, schema, scaffold, validation rule, Project Brain decision, tracked issue, or explicit exception before feature work continues. |
| Agent Engineering Proof Loop | The synthesized closeout loop for turning a local signal into engineering behavior: observe context, orient to the implied principle, decide scope and destination, act through the narrowest durable surface, and close out with validation, maintainability, traceability, and handoff evidence. |
| Pattern-Generalization Pass | The required follow-up after line-level or example-based feedback: name the implied design/API principle, search sibling implementations and similar classes of misbehavior, update the shared pattern when appropriate, or record why the correction is intentionally local. |
| Pattern Scope Inventory | Closeout evidence for pattern-generalization work: the inferred principle, sibling implementations or similar misbehavior classes searched, siblings changed, siblings intentionally left unchanged with reasons, and deferred follow-ups with tracker or evidence. |
| Principle Signal | Any concrete correction that may reveal the user's broader design model, including example-based feedback, named-function feedback, review comments, single-line corrections, or language such as "generally", "same pattern", "similar class", or "across everything". |
| OODA Horizon | The scope over which an agent observes, orients, decides, and acts. Single-turn horizons are insufficient when a decision has horizontal impact across adjacent organizational activity or vertical impact across stacked trajectories. |
| Horizontal Horizon | Adjacent organizational activity that may share or consume a decision, including sibling PRs, Linear issues, skills, docs, automations, live repo activity, and review or CI surfaces. |
| Vertical Horizon | Stacked trajectories where one decision depends on lower-layer work, blocks higher-layer work, or changes the meaning of prior evidence, including stacked PRs, follow-up branches, roadmap slices, and runtime evidence chains. |
| Reflected Context | Recovered target-lane context from a resumed window, session collector, runtime evidence, or agent reflection packet used to observe horizontal activity across compaction, harness, repo, machine, or environment boundaries. |
| Unobserved Horizon | A declared coverage gap where relevant horizontal or vertical context likely exists but could not be queried through local evidence, resumed context, session collector, or another reflected-context surface. |
| Code Production | Generating a patch or task answer, including benchmark-style success, without necessarily proving repo orientation, design judgment, validation, maintainability, traceability, or handoff quality. |
| Software Engineering Proof | Evidence that a change was made with appropriate repo orientation, scoped design judgment, pattern generalization, validation, maintainability review, traceability, and professional handoff. |
| Workspace Root Evidence | The explicit repository, worktree, selected cwd, readable root, and writable root evidence used to prove an operation is acting in the intended workspace. |
| Permission Context | The runtime sandbox, permission profile, network state, and root access evidence available to a harness operation. |
| Lifecycle Status | A bounded status value that distinguishes active work from waiting on CI, waiting on review, waiting on user input, waiting on auth, merge-conflict blockers, required-check blockers, ready-to-merge, merged, or closed states. |
| Project Brain Provider | A harness-readable memory surface that lets agents list, read, search, and route active Project Brain artifacts without relying on chat history or manual recall. |
| Outcome Closeout Schema | A machine-readable closeout packet that summarizes changed items, proof, blockers, handoffs, and claim boundaries from structured source events instead of prose-only status. |
| North-Star Contract | The canonical mission, metric, bottleneck, autonomy boundary, safety floor, and decision rubric in `docs/roadmap/north-star.md`; summaries and governed PR decisions should derive from this contract. Does the change improve or preserve durable learning and evidence capture? |
| North-Star Mission | Coding Harness exists to let a solo developer with limited cognitive bandwidth orchestrate agentic software work to professional standards through compact orientation, executable guardrails, durable memory, and evidence-based handoff. Does the change improve or preserve durable learning and evidence capture? |
| North-Star Mnemonic | Thin surface. Strong guardrails. Durable memory. Professional output. Does the change improve or preserve durable learning and evidence capture? |
| PR Lead Time | The primary north-star metric: time from PR open to merge. |
| Review and Rework Loop | The primary bottleneck Coding Harness optimizes: finding issues, producing acceptable fixes, verifying them, and getting the PR ready to merge. |
| Manual Glue Work | Repeated human coordination between review, remediation, verification, and merge that should become automation, guardrails, templates, or explicit exceptions. |
| Safety Floor | The minimum trust constraints for autonomy: deterministic evidence, current-head SHA discipline, bounded remediation, rollback paths, and independent review. |
| Focused Config-Drift Lane | The `validate-codex-config`, hook validation, and symlink audit sequence used to verify Codex runtime integrity. |
| Codex-Subtree Workflow Lane | The preflight plus fast verify sequence used to validate operational readiness in the Codex workflow path. |
| Config Drift | Any mismatch between canonical config/policy expectations and the current runtime or repository state. |
| Review Swarm | A bounded multi-reviewer process with role-specific artifact outputs under `artifacts/reviews/`. |
| Artifact-First Review | A review rule requiring each reviewer to write a concrete report file with severity-ranked findings and exact `file:line` evidence. |
| Active Artifact Index | The route-selection file `.harness/active-artifacts.md`; it decides which `.harness` specs and plans may steer current work. |
| Route-Driving Artifact | A durable tracked artifact that can steer implementation, usually an active `.harness` spec, plan, or index entry. Ignored runtime output under `artifacts/**` is not route-driving input. |
| Artifact-Handling Routine | The read-only `harness artifact-routine` gate that checks route-driving artifacts for owner, freshness, reference integrity, runtime-output boundaries, and stale artifact classification before implementation. |
| Coordinator | The orchestrator role that waits for reviewers, verifies artifact completeness, retries missing outputs once, and documents coverage gaps. |
| Coverage Gap | A declared review blind spot created when an expected reviewer artifact is still missing after one retry. |
| Prompt Translation | A mapping from the user's plain wording to a precise, execution-ready instruction that preserves original intent. |
| Blocker | A concrete condition that prevents required execution and must be reported with exact command outcome and reason. |
| Compatibility Posture | The repository policy stance for how strictly implementation must align to canonical contracts and runtime expectations. |

## Aliases and Terms to Avoid
| Phrase | Use Instead | Why |
| --- | --- | --- |
| "Coding Harness" in external product copy | synAIpse | synAIpse is the product and brand name; coding-harness remains the repository/package identity until a formal rename migration exists. |
| "Lifecycle" by itself | Lifecycle Harness or issue-to-main lifecycle | Lifecycle is too broad to route safely without naming the operating model. |
| "Everything is green" | Truth Lane classification | Green local checks do not prove PR review, CI, tracker, merge readiness, or main-sync state. |
| "The artifact proves it" | Claim Authority for the named lane | Artifacts are supporting evidence unless a contract says which claim family they can support. |
| "Automation reminder" | Runbook-backed automation | Repeated automation behavior belongs in reviewed runbooks with cursors, stop conditions, and validation evidence. |
| "Just run whatever works" | `Wrapper command` + explicit command contract | Ad hoc execution creates drift and inconsistent evidence. |
| "Looks fine to me" | `Validation lane passed` with exact command outcomes | Subjective approval is not sufficient for governance. |
| "Config issue" | `Config drift` or `startup blocker` | Narrower terms improve routing and remediation speed. |
| "Do all the checks" | Name the exact lane (`focused config-drift` or `codex-subtree workflow`) | Lane naming reduces ambiguity and missed gates. |
| "Swarm done" | `Artifact-first review complete` | Completion requires files, not status text alone. |
| "Artifact routine" | `Artifact-Handling Routine` | Name the executable gate and avoid treating artifact hygiene as prose-only guidance. |
| "Use the plan" | `Route-Driving Artifact` verified by `Artifact-Handling Routine` | Active plans must pass owner, freshness, reference, and runtime-boundary checks before they steer implementation. |
| "The check is red" | `Validation Failure Classifier` result | Red status alone does not distinguish current-patch regressions from pre-existing drift, tooling failures, fixture output, or unrelated worktree dirt. |
| "API" for `HarnessDecision` output | `Decision Contract` | The decision output is a governed schema and operator contract, not just a callable programming API. |
| "Evidence blob" | `Decision Source` | Naming the source keeps input evidence separate from the decision that consumes it. |
| "Run this next" | `Recommended Command` | The command recommendation remains advisory until an operator or automation with authority executes it. |
| "CLI logic" | `Command Facade`, `Command Core`, or `Output Renderer` | Naming the layer avoids mixing parsing, behavior, and printing in one change. |
| "Generated doc" | `Projection Surface` or `Architecture Context Pack` | Generated surfaces should route agents to the canonical owner instead of inviting direct patching. |
| "Can I call this done?" | Outcome Closeout Schema | Completion claims must be constrained by source events, proof, blockers, handoffs, and claim boundaries. |
| "Is this aligned with the north star?" | `North-Star Contract` decision check | Answer against PR lead time, review/rework cost, manual glue reduction, agent reliability, and the safety floor; do not treat generic usefulness as enough. Does the change improve or preserve durable learning and evidence capture? |
| "Agents never forget" | Durable north-star guardrail | Convert repeated failures into guardrails, tests, prompts, policy checks, review-context facts, or explicit exceptions in Project Brain. |
| "Thin surface. Strong guardrails. Durable memory. Professional output." | `North-Star Mnemonic` | Use this as the compact orientation phrase for the project, not as a replacement for the PR lead-time metric. |

## Relationships and Lifecycle
1. User prompt enters with plain language.
2. Agent maps wording through `Prompt translations`.
3. Agent executes the correct `validation lane` with canonical wrappers.
4. If multi-review is needed, run `review swarm` with `artifact-first review` outputs.
5. Coordinator verifies all artifacts and reports any `coverage gap`.
6. Final closeout includes exact command outcomes and blocker classification.

## Prompt Translations
| User phrase | Canonical intent | Better Codex wording |
| --- | --- | --- |
| "this is our new name and logo" | Brand-language update without unsafe package rename | "Treat synAIpse as the product name and AI Delivery Harness as the descriptor; update glossary and docs language first, and keep package, CLI, and downstream template renames behind an explicit migration plan." |
| "where does the feedback loop fit?" | Lifecycle Harness learning loop | "Show feedback as the loop from review, CI, user steering, and post-merge evidence back into guardrails, runbooks, Project Brain, specs, and validation." |
| "enforce the truth lanes" | Claim authority governance | "Add or update guardrails, lifecycle metadata, and validation gates so each delivery claim names the lane and evidence that can prove it." |
| "Make sure it works" | Validate changed surface with evidence | "Run the narrowest required validation lane for this change and report exact `pass\|fail\|blocked` outcomes for each command." |
| "Fix drift" | Resolve canonical mismatch | "Identify config drift against canonical control-plane files, apply minimal fixes, and rerun the focused config-drift lane." |
| "Use a swarm" | Bounded multi-review with artifacts | "Run a bounded review swarm, require one artifact file per reviewer under `artifacts/reviews/`, and synthesize severity-ranked findings." |
| "Startup is broken" | MCP/runtime startup triage | "Run startup diagnostics, classify the blocker with `codex mcp list` evidence, and route through the MCP startup triage workflow." |
| "Do the preflight" | Execute bootstrap gate | "Run `bash scripts/codex-preflight.sh --stack auto --mode required` and report explicit pass/fail/blocker status." |
| "Why did validation fail?" | Classify command failure ownership | "Use the validation failure classifier on the exact command observation and report whether the failure is an introduced regression, pre-existing drift, environment/tooling failure, unrelated dirty worktree, missing credential, expected fixture stderr, or unknown failure." |
| "Close this out" | Build outcome closeout packet | "Emit an outcome closeout from structured PR readiness, artifact, and validation classifier events; include what changed, what proved it, what blocked, what was handed off, and what must not be claimed complete." |
| "use this .harness plan" | Verify route-driving artifacts first | "Run `harness artifact-routine --active-index .harness/active-artifacts.md --json`; if it fails, repair or classify the active artifact before using it as implementation input." |
| "Remove north-star ambiguity" | Align wording to canonical contract | "Update the README, glossary, and any touched governance docs so north-star language derives from `docs/roadmap/north-star.md` and `harness.contract.json` decision questions." |
| "what outcome am I expecting?" | Expected outcome contract | "Restate the portable agent operating system outcome, then verify the required repo surfaces encode it instead of treating the answer as chat-only." |
| "list broader arch ops" | Rank architecture opportunities by north-star leverage | "Rank architecture opportunities by review/rework-loop leverage, name the complexity symptom, and give the first reversible tracer-proof move." |
| "make agents never forget" | Promote repeated failures into durable guardrails | "Promote repeated review failures into durable guardrails, Project Brain learnings, validation checks, or glossary prompt translations." |
| "you are giving me the same feedback again" | Repeat-feedback admission | "Stop feature work, classify the repeated correction as an environment defect, update the narrowest durable repo surface or tracked exception, and run the guard that proves the admission did not stay in chat." |
| "you are not permitted to proceed" | Current-session steering admission record | "Stop feature work, create the admission record, update the guard or tracked durable surface, run the focused validation command, and only then resume the narrow next action." |
| "don't fight errors" | Repeated-error research pass | "When the same error happens twice, stop retrying locally, research web/upstream sources, list 3-5 possible fixes, choose the most efficient repo-fit fix, implement it, and record the research evidence." |
| "these are in github and in ~/.codex/.env" | Env-backed validation recovery | "Do not treat the lane as blocked until you have checked required variable names without printing values, loaded `~/.codex/.env`, and rerun the exact credentialed validation command." |
| "do not just fix that line" | Pattern scope inventory | "Infer the API/design principle, search sibling implementations and similar classes of misbehavior, update the shared pattern or all matching siblings, and record unchanged or deferred siblings with reasons." |
| "this was an example" | Principle signal | "Treat the concrete correction as evidence of a broader design model, then run the pattern-generalization pass before claiming the fix is done." |
| "make the skill reliable" | Workflow-skill eval loop | "Define the workflow skill win condition, run a capture-the-flag eval, capture self-reflection and trace evidence, then refine the skill or harness until the flag is captured reliably." |
| "this is confusing" | Resolve overloaded language | "Identify overloaded project terms, choose canonical wording, add aliases, and update the nearest instruction pointer." |
| "fix the architecture" | Improve one evidenced boundary | "Choose one boundary with live evidence, compare patch design versus interface design, implement the smallest reversible move, and validate the exact path." |
| "use deep modules and Effect" | Promote one tested Effect boundary | "Pick one high-pressure module, keep callers on a stable interface, add seam tests, and allow `effect` only inside the approved boundary." |
| "make the checks less messy" | Unify validation lane language | "Unify validation lane language and source-of-truth command contracts without weakening the safety floor." |
| "close the loop" | Prove the workflow outcome | "Run the workflow against an explicit win condition, retain trace/session evidence, reflect on failures, update the durable skill or harness surface, and rerun until the outcome is proven or the blocker is named." |

## Example Dialogue
Developer: "Can you make sure this change works?"
Domain Expert: "Translate that to: run the codex-subtree workflow lane and report each command outcome."
Developer: "Perfect, and if anything blocks, call out the blocker string exactly."

## Flagged Ambiguities
| Term | Ambiguity | Recommended Default |
| --- | --- | --- |
| "preflight" | Can mean optional lane or required bootstrap lane. | Treat plain "preflight" as the required bootstrap gate unless the user explicitly says optional mode. |
| "check" | Could mean one command or the aggregate `pnpm check` contract. | Ask or infer from changed surface, then name the exact command set in output. |
| "review done" | Could mean mailbox completion or artifact completion. | Consider review complete only when all expected artifact files exist and are non-empty. |
| "startup failure" | Could refer to config drift, MCP auth, runtime path, or shell drift. | Classify with observable command evidence before choosing remediation. |
| "red validation" | Could be a real regression, pre-existing drift, unrelated worktree dirt, missing credential, environment/tooling failure, or expected fixture stderr. | Use the validation failure classifier before assigning ownership or blocking the current patch. |
| "done" | Could mean implemented, validated, ready to merge, handed off, or advisory only. | Use the outcome closeout schema to separate outcome, proof, blockers, handoffs, and claim boundaries. |
| "north star" | Could mean mission, metric, roadmap theme, PR evidence rubric, or generic project purpose. | Treat it as the `North-Star Contract`: mission, primary metric, primary bottleneck, autonomy boundary, safety floor, and decision questions. |

## Decision Log
1. Glossary scope is repository-local to `/Users/jamiecraik/dev/coding-harness`.
2. A lightweight docs/CI guard is required to ensure `AGENTS.md` keeps a reference to this glossary.

## Source Notes
- User-provided Codex subtree guidance in this session (scope, review swarm contract, validation lane names, and canonical-only posture).
- `/Users/jamiecraik/dev/coding-harness/AGENTS.md` (repo workflow, validation contracts, and command evidence expectations).
