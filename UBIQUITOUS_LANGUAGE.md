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
| Coding Harness | The TypeScript control-plane repository that governs agentic development, review workflows, and validation contracts. |
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
| Coordinator | The orchestrator role that waits for reviewers, verifies artifact completeness, retries missing outputs once, and documents coverage gaps. |
| Coverage Gap | A declared review blind spot created when an expected reviewer artifact is still missing after one retry. |
| Prompt Translation | A mapping from the user's plain wording to a precise, execution-ready instruction that preserves original intent. |
| Blocker | A concrete condition that prevents required execution and must be reported with exact command outcome and reason. |
| Compatibility Posture | The repository policy stance for how strictly implementation must align to canonical contracts and runtime expectations. |

## Aliases and Terms to Avoid
| Phrase | Use Instead | Why |
| --- | --- | --- |
| "Just run whatever works" | `Wrapper command` + explicit command contract | Ad hoc execution creates drift and inconsistent evidence. |
| "Looks fine to me" | `Validation lane passed` with exact command outcomes | Subjective approval is not sufficient for governance. |
| "Config issue" | `Config drift` or `startup blocker` | Narrower terms improve routing and remediation speed. |
| "Do all the checks" | Name the exact lane (`focused config-drift` or `codex-subtree workflow`) | Lane naming reduces ambiguity and missed gates. |
| "Swarm done" | `Artifact-first review complete` | Completion requires files, not status text alone. |
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
| "Make sure it works" | Validate changed surface with evidence | "Run the narrowest required validation lane for this change and report exact `pass\|fail\|blocked` outcomes for each command." |
| "Fix drift" | Resolve canonical mismatch | "Identify config drift against canonical control-plane files, apply minimal fixes, and rerun the focused config-drift lane." |
| "Use a swarm" | Bounded multi-review with artifacts | "Run a bounded review swarm, require one artifact file per reviewer under `artifacts/reviews/`, and synthesize severity-ranked findings." |
| "Startup is broken" | MCP/runtime startup triage | "Run startup diagnostics, classify the blocker with `codex mcp list` evidence, and route through the MCP startup triage workflow." |
| "Do the preflight" | Execute bootstrap gate | "Run `bash scripts/codex-preflight.sh --stack auto --mode required` and report explicit pass/fail/blocker status." |
| "Why did validation fail?" | Classify command failure ownership | "Use the validation failure classifier on the exact command observation and report whether the failure is an introduced regression, pre-existing drift, environment/tooling failure, unrelated dirty worktree, missing credential, expected fixture stderr, or unknown failure." |
| "Close this out" | Build outcome closeout packet | "Emit an outcome closeout from structured PR readiness, artifact, and validation classifier events; include what changed, what proved it, what blocked, what was handed off, and what must not be claimed complete." |
| "Remove north-star ambiguity" | Align wording to canonical contract | "Update the README, glossary, and any touched governance docs so north-star language derives from `docs/roadmap/north-star.md` and `harness.contract.json` decision questions." |
| "what outcome am I expecting?" | Expected outcome contract | "Restate the portable agent operating system outcome, then verify the required repo surfaces encode it instead of treating the answer as chat-only." |
| "list broader arch ops" | Rank architecture opportunities by north-star leverage | "Rank architecture opportunities by review/rework-loop leverage, name the complexity symptom, and give the first reversible tracer-proof move." |
| "make agents never forget" | Promote repeated failures into durable guardrails | "Promote repeated review failures into durable guardrails, Project Brain learnings, validation checks, or glossary prompt translations." |
| "you are giving me the same feedback again" | Repeat-feedback admission | "Stop feature work, classify the repeated correction as an environment defect, update the narrowest durable repo surface or tracked exception, and run the guard that proves the admission did not stay in chat." |
| "you are not permitted to proceed" | Current-session steering admission record | "Stop feature work, create the admission record, update the guard or tracked durable surface, run the focused validation command, and only then resume the narrow next action." |
| "don\u2019t fight errors" | Repeated-error research pass | "When the same error happens twice, stop retrying locally, research web/upstream sources, list 3-5 possible fixes, choose the most efficient repo-fit fix, implement it, and record the research evidence." |
| "do not just fix that line" | Pattern scope inventory | "Infer the API/design principle, search sibling implementations and similar classes of misbehavior, update the shared pattern or all matching siblings, and record unchanged or deferred siblings with reasons." |
| "this was an example" | Principle signal | "Treat the concrete correction as evidence of a broader design model, then run the pattern-generalization pass before claiming the fix is done." |
| "make the skill reliable" | Workflow-skill eval loop | "Define the workflow skill win condition, run a capture-the-flag eval, capture self-reflection and trace evidence, then refine the skill or harness until the flag is captured reliably." |
| "this is confusing" | Resolve overloaded language | "Identify overloaded project terms, choose canonical wording, add aliases, and update the nearest instruction pointer." |
| "fix the architecture" | Improve one evidenced boundary | "Choose one boundary with live evidence, compare patch design versus interface design, implement the smallest reversible move, and validate the exact path." |
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
