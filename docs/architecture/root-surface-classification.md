---
last_validated: 2026-05-24
---

# Root Surface Classification

This document classifies the tracked repository root so future cleanup starts
from an explicit contract instead of ad hoc memory.

## Table of Contents

- [Classification Contract](#classification-contract)
- [Resolved in This Slice](#resolved-in-this-slice)
- [Current Root Files](#current-root-files)
- [Current Root Directories](#current-root-directories)
- [Deferred Cleanup](#deferred-cleanup)
- [Validation Contract](#validation-contract)

## Classification Contract

Each tracked top-level root entry belongs to exactly one classification:

- `canonical root`: belongs at repository root because standard tooling,
  operator discovery, package managers, or project identity expect it there.
- `should move`: valid tracked content whose current root location is not the
  right long-term owner.
- `generated but tracked intentionally`: generated or evidence-like content
  kept under version control because gates, docs, or release workflows consume
  it.
- `legacy/drift`: historical, obsolete, or scratch-shaped content that should
  not stay at root.

This cleanup slice started non-destructively by moving low-risk legacy/drift
entries with direct archive or security destinations. The later `.claude/`
removal is an explicit destructive cleanup decision for a tracked legacy agent
memory file after Codex became the repository's active agent system.

## Resolved in This Slice

| Previous root entry | Classification | New location | Reason |
| --- | --- | --- | --- |
| `tmp/` | legacy/drift | `docs/archive/root-cleanup/strategy-evidence/` | Historical strategy evidence was tracked intentionally, but `tmp/` reads as local scratch and had already caused hook/formatting ambiguity. |
| `todos/` | legacy/drift | `docs/archive/root-cleanup/completed-issue-backlog/` | The entries are completed historical issue evidence, not an active root backlog. |
| `security_best_practices_report.md` | legacy/drift | `docs/security/security-best-practices-report.md` | Security analysis belongs under the security docs surface rather than as an unindexed root report. |
| `.claude/` | should move | removed from tracked root | The only tracked entry was obsolete Claude feedback memory. Removal was explicitly authorized as a destructive root cleanup follow-up after the repository standardized on Codex-facing governance. |

## Current Root Files

| Classification | Entries |
| --- | --- |
| canonical root | `.architecture.yml`, `.coderabbit.yaml`, `.diagramrc`, `.editorconfig`, `.gitattributes`, `.gitignore`, `.gitleaks.toml`, `.lychee.toml`, `.markdownlint-cli2.yaml`, `.mise.toml`, `.npmrc`, `.nvmrc`, `.trufflehog-exclude.txt`, `.vale.ini`, `.versionrc`, `AGENTS.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CITATION.cff`, `CODESTYLE.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `CONTRIBUTORS.md`, `LICENSE`, `Makefile`, `README.md`, `SECURITY.md`, `SUPPORT.md`, `UBIQUITOUS_LANGUAGE.md`, `WORKFLOW.md`, `biome.json`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `prek.toml`, `renovate.json`, `tsconfig.json`, `vitest.config.ts`. |
| generated but tracked intentionally | `.architecture-baseline.txt`, `.memory-metrics.json`, `harness.contract.json`, `memory.json`. |
| should move | `FORJAMIE.md`. |
| legacy/drift | none remaining at root after this slice. |

## Current Root Directories

| Classification | Entries |
| --- | --- |
| canonical root | `.agents/`, `.circleci/`, `.codex/`, `.github/`, `.harness/`, `.vale/`, `codestyle/`, `contracts/`, `docs/`, `e2e/`, `evals/`, `ops/`, `rules/`, `scripts/`, `security/`, `src/`, `templates/`, `test-fixtures/`, `tests/`. |
| generated but tracked intentionally | `.diagram/`, `AI/`, `artifacts/`. |
| should move | `instructions/`. |
| legacy/drift | none remaining at root after this slice. |

## Deferred Cleanup

The following entries are deliberately classified but not moved in this slice:

- `FORJAMIE.md`: should move, but current Codex-subtree instructions treat
  `codex/FORJAMIE.md` as the live handoff surface. Moving or deleting the root
  file needs an explicit handoff-surface decision.
- `instructions/`: should move or consolidate, but it may still be part of
  older generated or downstream instruction routing. Moving it requires a
  dedicated instruction-routing contract.
- `artifacts/`, `.diagram/`, and `AI/`: generated but tracked
  intentionally. They need artifact/template gates before any relocation.

## Validation Contract

Root-surface cleanup PRs must run:

- `pnpm run docs:ubiquitous:guard`
- `pnpm run docs:root-archive:links`
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
- `bash scripts/validate-codestyle.sh`

When source, artifact templates, generated diagrams, or downstream templates
change, run the narrower affected tests first and then the matching artifact or
template gate before the broader validation.
