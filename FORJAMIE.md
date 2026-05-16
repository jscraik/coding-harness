# Closeout Notes

## Table of Contents
- [Closeout Notes](#closeout-notes)
- [Current focus](#current-focus)

This repository enforces `FORJAMIE.md` on `codex/*` branches through the
memory gate. This file exists so branch-level closeout validation has a durable
repo-local target during active Codex work, including CI reruns on feature
branches and branch-scoped release or governance changes.

## Current Focus

- CircleCI and review-driven fixes should keep generated scaffold output,
  repo-local runtime scripts, and validation contracts in sync.
- Closeout evidence belongs in exact command outcomes, not generic summaries.

## Recent Changes

- 2026-05-16: refreshed branch closeout evidence for PR #250 CircleCI recovery.
  - PR #250 is now carrying the JSC-311 runtime-card/phase-exit continuation
    slice, with CI triage focused on the live PR body contract and branch memory
    freshness rather than production TypeScript regressions.
  - Local reproduction showed docs-gate, pnpm lint, pnpm typecheck,
    pnpm test:ci, pnpm check, drift-gate, and environment checks passing;
    the blocking CI items were the missing PR Work performed section and this
    stale closeout file.
  - Next closeout should keep Linear, PR body evidence, and .harness routing
    notes synchronized before treating JSC-311 as complete.
- 2026-04-29: tightened PR governance gate behavior to resolve active review findings.
  - `linear-gate` now exits with the standard 0/1/2 envelope and only enforces
    `pr-reference-mode` when PR issue-key enforcement is enabled; issue-template
    Linear URL checks now prefer `issueTrackingPolicy.projectUrl` over package fallback.
  - `branch-protect` now treats required checks as policy-authoritative
    replacement (no sticky legacy contexts), keeps public code scanning enabled
    when visibility is unknown, and surfaces merge-settings update failures
    instead of swallowing `TypeError`.
  - north-star override validation is now fail-closed for invalid JSON/schema,
    validates `linkedFindingIds` structure strictly, and requires actor/signature
    identity consistency (`actor` must match the reviewer tied to `signatureRef`).
- 2026-04-29: completed follow-up thread fixes for guardrail integrity, command policy, and CLI hardening.
  - `scripts/run-harness-gate.sh` now uses shell-native EPERM/IPC detection (no `grep`) and preserves fallback behavior to `dist/cli.js`.
  - `drift-gate` now records structured I/O findings if durable guardrail emission fails and guardrails are emitted only for blocking findings while preserving all triggering finding IDs.
  - `north-star-artifact-io` now fails closed when durable guardrail JSON is unreadable during recurrence resolution.
  - `brain-core` now validates `--domain` segments for rule/hypothesis writes, always creates the real target parent directory, escapes regex headers, and lists all supported subcommands in unknown-command help.
  - `health-core` fix execution now respects quoted arguments by running fix commands via `sh -c`.
  - `validate-branch-protection-alignment` now ignores disabled/shadow/informational checks while still enforcing active-provider and independent required checks (including external apps like CodeRabbit/Semgrep).
