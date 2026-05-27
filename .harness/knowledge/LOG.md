---
type: project-brain-mutation-log
status: active
sources: [.harness/research/audits/2026-05-26-project-brain-llm-wiki-gap-audit.md, src/lib/project-brain/lint-cli.ts]
aliases: [project-brain-log, knowledge-log]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Project Brain Knowledge Log

## 2026-05-26

- Added [[cli/rules]] Project Brain trust rule requiring read-only lint evidence before metadata migrations rely on local knowledge.
- Added metadata frontmatter and source-backed claims across Project Brain domain pages so Codex can distinguish current, cited knowledge from loose notes.
- Added project-brain-lint/v1 command behavior in src/lib/project-brain/lint-cli.ts; no bulk renames.
