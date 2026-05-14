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
| Codex Subtree | The `codex/` configuration surface that owns runtime config, agents, hooks, automations, and related verification scripts. |
| Control Plane | The canonical set of config files, scripts, and policies that decides how agents execute and validate work. |
| Canonical-only | The policy that requires using the documented, source-of-truth path instead of ad hoc or duplicate alternatives. |
| Wrapper Command | A repository-defined script entrypoint (for example in `scripts/` or `pnpm` scripts) that should be preferred over equivalent one-off commands. |
| Validation Lane | A scoped set of required checks used to prove a specific change surface is correct and compliant. |
| Validation Failure Classifier | A read-only classifier that turns one validation command observation into an actionable failure bucket such as introduced regression, pre-existing drift, environment/tooling failure, unrelated dirty worktree, missing credential, expected fixture stderr, or unknown failure. |
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
