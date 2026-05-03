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

## Decision Log
1. Glossary scope is repository-local to `/Users/jamiecraik/dev/coding-harness`.
2. A lightweight docs/CI guard is required to ensure `AGENTS.md` keeps a reference to this glossary.

## Source Notes
- User-provided Codex subtree guidance in this session (scope, review swarm contract, validation lane names, and canonical-only posture).
- `/Users/jamiecraik/dev/coding-harness/AGENTS.md` (repo workflow, validation contracts, and command evidence expectations).
