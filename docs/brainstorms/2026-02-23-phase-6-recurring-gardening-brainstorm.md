---
title: Phase 6 - Recurring Gardening
type: feat
date: 2026-02-23
status: active
origin: docs/HARNESS_IMPLEMENTATION_PLAN.md Phase 6
---

# Phase 6 - Recurring Gardening

## What We're Building

A nightly automation workflow that maintains documentation quality by:
1. Detecting stale docs and broken links
2. Updating quality scores
3. Opening small maintenance PRs automatically

## Why This Matters

Without automated gardening:
- Documentation drifts from reality as code changes
- Broken links accumulate and hurt credibility
- Quality metrics become stale
- Manual maintenance is forgettable and low-priority

## Key Decisions

### 1. Scope: Docs Only (MVP)

Focus on markdown documentation:
- Stale content detection via `last_validated` frontmatter (missing = stale)
- Broken link detection (internal and external)
- Quality score updates in `docs/QUALITY_SCORE.md`

Defer code analysis (unused exports, dependency updates) until proven need.

**Bootstrapping:** Docs without `last_validated` are treated as stale immediately, creating a self-bootstrapping system. No manual frontmatter addition required.

### 2. Link Checker: lychee

Use lychee (Rust-based):
- Fast execution (parallel checking)
- Official GitHub Action available
- Supports markdown, HTML, and plain text
- Configurable retry and timeout

Defer markdown-link-check (slower) and custom scripts (more maintenance).

### 3. PR Triggers: Critical + Quality

Create PRs for:
- Broken links (critical)
- Stale docs missing `last_validated` > 30 days
- Quality score updates

Defer minor style/grammar suggestions.

### 4. Schedule: Nightly

Run at 2am UTC daily via cron schedule:
```yaml
on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:
```

### 5. PR Author: Personal Token

Use a personal access token (GARDENER_TOKEN secret):
- PRs appear as authored by a real user
- Can trigger downstream workflows
- Requires secret configuration

Defer GitHub App integration (more setup, token is simpler).

## CLI Interface

```bash
# Manual gardener run (for testing)
harness gardener --dry-run

# Check specific docs
harness gardener --docs docs/*.md --dry-run

# Output as JSON for CI
harness gardener --json
```

## Success Criteria

1. Nightly workflow runs automatically at 2am UTC
2. Broken links are detected and PRs opened
3. Stale docs (>30 days) are flagged
4. Quality score is updated weekly
5. PRs use conventional commit format

## Out of Scope

- Code freshness analysis
- Dependency updates
- Unused export detection
- Style/grammar suggestions

## Open Questions

None - all decisions resolved through user input.
