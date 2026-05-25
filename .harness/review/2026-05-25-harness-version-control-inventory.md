# Harness Version-Control Inventory

## Purpose

This inventory records the current `.harness` tracking correction from
2026-05-25. It exists because `.harness` is a control plane, not a single
scratch directory, and a blanket ignore rule hides implementation authority,
review evidence, and governance inputs that need to move with the repository.

## Classification Rule

Track stable repository truth. Keep local runtime state local. Promote generated
artifacts only when a spec, plan, PR, validator, or decision names them as
acceptance evidence and the artifact has been checked for secrets, local-only
paths, bulky telemetry, and stale state.

## Track By Default

| Surface | Reason |
| --- | --- |
| `.harness/README.md` | Canonical `.harness` tracking and authority map. |
| `.harness/active-artifacts.md` | Execution-input index for current work. |
| `.harness/core/**/*.md` | Durable operating policy. |
| `.harness/decisions/**/*.md` | Accepted tradeoffs and architectural decisions. |
| `.harness/linear/**/*.md` | Admitted tracker-backed execution input. |
| `.harness/refactors/**/*.md` | Admitted refactor execution input. |
| `.harness/specs/**/*.md` | Accepted Harness Engineering specifications. |
| `.harness/plan/**/*.md` | Accepted Harness Engineering implementation plans. |
| `.harness/intent/**/*.md` and `.harness/intent/**/*.json` | First-class intent, baseline, and review-receipt packets tied to accepted plans or goals. |
| `.harness/memory/LEARNINGS.md` | Durable repo-local learned-fixes surface. |
| `.harness/learnings/*.example.json` | Reusable learning-loop example contracts. |
| `.harness/learnings/enforcement-status.json` | Repo enforcement posture when it is maintained as policy. |
| `.harness/research/README.md` | Research intake and promotion rules. |
| `.harness/research/evidence-patterns.json` | Adopted evidence-pattern registry. |
| `.harness/research/audits/**/*.md` | Curated audit evidence when referenced by plans, specs, or adopted patterns. |
| `.harness/research/deep/**/*.md` | Deep research evidence when adopted or referenced by the pattern registry. |
| `.harness/media/**/*.md` and `.harness/media/**/*.json` | Sidecars, prompts, and metadata for promoted review media. |
| `.harness/*-manifest.json` | Validator-consumed manifests when reviewed as policy. |

## Local By Default

| Surface | Reason |
| --- | --- |
| `.harness/backups/**` | Recovery output, not repo truth. |
| `.harness/*.db` | Mutable local database state. |
| `.harness/ci-migrate-snapshots/**` | Bulk generated snapshots unless promoted as fixtures. |
| `.harness/runs/**` | Local run state and command output. |
| `.harness/evidence/**` | Raw command/session evidence can contain local paths and bulky telemetry. |
| `.harness/guardrails/**` | Generated guardrail snapshots unless a validator consumes the exact file. |
| `.harness/metrics/**` | Local metrics snapshots. |
| `.harness/implementation-notes/**/*.html` | Live browser view; final Markdown notes are preferred for durable review. |
| `.harness/learnings/*.local.json` | Local imports such as CodeRabbit or session feeds. |
| `.harness/learnings/session-*.json` | Time-windowed session inputs. |
| `.harness/media/**/*.{png,jpg,jpeg,webp}` | Generated binary media unless explicitly required as a promoted review/spec artifact. |
| `.harness/memory/codex-learned/**` | Local learned runtime cache. |
| `.harness/memory/codex-preflight-overrides.env` | Local environment overrides. |
| `.harness/rollback-marker.json` | Mutable runtime marker; durable rollback belongs in a plan or decision. |

## Current Newly Visible Candidates

These files became visible after replacing brittle ignore rules with category
rules. This correction promotes only the small stable intent, learning, and
research-map contracts listed below; larger audits, media sidecars, and future
control-plane candidates still require explicit path-by-path staging.

| Candidate | Recommended disposition |
| --- | --- |
| `.harness/intent/codex-runtime-evidence-verifier-cockpit-contract-baseline.json` | Promote in this change as the accepted baseline for the current runtime-evidence goal. |
| `.harness/intent/codex-runtime-evidence-verifier-cockpit-implementation-intent.json` | Promote in this change as the reviewed implementation intent for the active goal. |
| `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-000-review-receipt.json` | Promote in this change as the canonical PU-000 review receipt. |
| `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-003-intent.json` | Promote in this change as preserved PU-003 intent evidence for the goal ledger. |
| `.harness/learnings/enforcement-status.example.json` | Promote in this change as an example contract. |
| `.harness/learnings/enforcement-status.json` | Promote in this change as the current repo enforcement-state contract. |
| `.harness/learnings/overrides.example.json` | Promote in this change as an example contract. |
| `.harness/research/README.md` | Promote in this change as the research promotion map. |
| `.harness/research/deep/2026-05-24-codex-ecosystem-native-alignment.md` | Promote in this change because `.harness/research/evidence-patterns.json` already admits it as deferred research. |
| `.harness/research/deep/2026-05-24-jamie-craik-operational-telemetry-evidence.md` | Promote in this change as planning evidence for the runtime-evidence cockpit spec, plan, and goal. |
| `.harness/research/audits/2026-05-18-architecture-alignment-audit.md` | Track if still cited by current architecture work; otherwise archive or leave untracked until adopted. |
| `.harness/research/audits/2026-05-19-architecture-alignment-audit.md` | Track if still cited by current architecture work; otherwise archive or leave untracked until adopted. |
| `.harness/research/audits/2026-05-24-evidence-led-codebase-gap-audit.md` | Track because the current runtime-evidence plan and discussion cite it. |
| `.harness/media/*.md` and `.harness/media/*-prompt.md` | Track when they are sidecars for required spec/plan review media artifacts. |

## Validation Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Ignore behavior for local runtime surfaces | pass | `git check-ignore -v` reports ignore rules for live HTML notes, raw evidence, guardrail snapshots, local learning imports, session learning feeds, image binaries, runs, and rollback marker. |
| Visibility for control-plane candidates | pass | `git check-ignore -v` reports unignore rules for intent JSON, learning examples/status, research README, recent audits, and media sidecar metadata. |
| Formatting for promoted JSON contracts | pass | `pnpm exec biome check --write` on the four promoted intent JSON files and three promoted learning JSON files fixed them before staging. |
| Markdown lint for `.harness/README.md` | pass | `pnpm exec markdownlint-cli2 .harness/README.md` completed with `0 error(s)`. |
| Whitespace check | pass | `git diff --check` produced no findings. |

## Follow-Up Rule

Do not use `git add .harness` after this correction. Stage only reviewed
control-plane files by path. Local runtime artifacts that become visible because
of a category rule still require an explicit promotion decision.
