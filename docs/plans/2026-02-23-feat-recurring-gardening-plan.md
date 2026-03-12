---
title: feat: Recurring Gardening Workflow
type: feat
status: completed
date: 2026-02-23
plan_id: feat-recurring-gardening
origin: docs/brainstorms/2026-02-23-phase-6-recurring-gardening-brainstorm.md
---

# feat: Recurring Gardening Workflow

## Overview

Implement a nightly automation workflow that maintains documentation quality by detecting stale docs, broken links, and updating quality scores. The gardener opens small maintenance PRs automatically.

## Problem Statement / Motivation

Without automated gardening:
- Documentation drifts from reality as code changes
- Broken links accumulate and hurt credibility
- Quality metrics become stale
- Manual maintenance is forgettable and low-priority

## Proposed Solution

A two-part system:
1. **CLI Command** (`harness gardener`) - Local tool for manual runs and CI integration
2. **GitHub Workflow** - Scheduled nightly automation with manual trigger option

(see brainstorm: docs/brainstorms/2026-02-23-phase-6-recurring-gardening-brainstorm.md)

## Technical Approach

### Architecture

```
src/
  commands/
    gardener.ts              # CLI command entry point
  lib/
    gardener/
      types.ts                # Gardener types and interfaces
      stale-detector.ts       # Check last_validated frontmatter
      link-checker.ts         # Integrate lychee for broken link detection
      quality-scorer.ts       # Update docs/QUALITY_SCORE.md
      pr-creator.ts           # Create maintenance PRs via GitHub API

.github/
  workflows/
    gardener.yml              # Nightly scheduled workflow
```

### Implementation Phases

#### Phase 1: Gardener Types and Interfaces

**Files to create:**
- `src/lib/gardener/types.ts` (new)

**Tasks:**
- [x] Add `GardenerOptions` interface (docs path, dry-run, json output)
- [x] Add `GardenerOutput` interface with stale docs, broken links, quality score
- [x] Add `StaleDoc`, `BrokenLink`, `QualityScore` types
- [x] Add `EXIT_CODES` constant (SUCCESS=0, ISSUES_FOUND=1, SYSTEM_ERROR=10)
- [x] Export discriminated union `GardenerResult`

**Key patterns:**
```typescript
// types.ts
export interface GardenerOptions {
  docsPath?: string;
  dryRun?: boolean;
  json?: boolean;
  staleDays?: number;  // Default 30
}

export interface StaleDoc {
  path: string;
  lastValidated: string | null;  // null = never validated
  daysSinceValidation: number;
}

export interface BrokenLink {
  file: string;
  link: string;
  statusCode: number | null;
  error?: string;
}

export interface GardenerOutput {
  staleDocs: StaleDoc[];
  brokenLinks: BrokenLink[];
  qualityScore: number | null;
  needsPR: boolean;
}

export type GardenerResult =
  | { ok: true; output: GardenerOutput }
  | { ok: false; error: { code: string; message: string } };
```

#### Phase 2: Stale Document Detector

**Files to create:**
- `src/lib/gardener/stale-detector.ts` (new)

**Tasks:**
- [x] Implement `detectStaleDocs(basePath, staleDays)` function
- [x] Parse YAML frontmatter from markdown files
- [x] Check `last_validated` field (null = never validated = stale immediately)
- [x] Calculate days since validation
- [x] Handle files without frontmatter gracefully

**Detection logic:**
```typescript
export function detectStaleDocs(
  basePath: string,
  staleDays: number = 30,
): StaleDoc[] {
  const docs = glob.sync("**/*.md", { cwd: basePath });
  const stale: StaleDoc[] = [];

  for (const doc of docs) {
    const content = readFileSync(join(basePath, doc), "utf-8");
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter?.last_validated) {
      // Never validated = immediately stale (bootstrap behavior)
      stale.push({
        path: doc,
        lastValidated: null,
        daysSinceValidation: Infinity,
      });
      continue;
    }

    const lastDate = new Date(frontmatter.last_validated);
    const daysSince = daysBetween(lastDate, new Date());

    if (daysSince > staleDays) {
      stale.push({
        path: doc,
        lastValidated: frontmatter.last_validated,
        daysSinceValidation: daysSince,
      });
    }
  }

  return stale;
}
```

#### Phase 3: Link Checker Integration

**Files to create:**
- `src/lib/gardener/link-checker.ts` (new)

**Tasks:**
- [x] Add lychee configuration file `.lychee.toml`
- [x] Implement `checkLinks(basePath)` function
- [x] Parse lychee JSON output
- [x] Return structured `BrokenLink[]` array
- [x] Handle internal vs external links separately

**Lychee configuration:**
```toml
# .lychee.toml
verbose = "info"
format = "json"
output = "lychee-report.json"
exclude = [
  "localhost",
  "127.0.0.1",
  "example.com",
]
max_retries = 2
timeout = 10
```

**Integration pattern:**
```typescript
export async function checkLinks(basePath: string): Promise<BrokenLink[]> {
  // Run lychee via child process
  const result = spawnSync("lychee", [
    "--format", "json",
    "--output", "lychee-report.json",
    basePath,
  ], { encoding: "utf-8" });

  // Parse JSON output
  const report = JSON.parse(readFileSync("lychee-report.json", "utf-8"));

  return report.fail_map
    ? Object.entries(report.fail_map).flatMap(([file, links]) =>
        links.map(link => ({
          file,
          link: link.url,
          statusCode: link.status_code,
          error: link.error,
        }))
      )
    : [];
}
```

#### Phase 4: Quality Score Calculator

**Files to create:**
- `src/lib/gardener/quality-scorer.ts` (new)
- `docs/QUALITY_SCORE.md` (new)

**Tasks:**
- [x] Create `docs/QUALITY_SCORE.md` template
- [x] Implement `calculateQualityScore(staleDocs, brokenLinks)` function
- [x] Score formula: 100 - (staleDocs * 5) - (brokenLinks * 10)
- [x] Update `docs/QUALITY_SCORE.md` with new score
- [x] Add timestamp to quality score file

**Quality score template:**
```markdown
---
last_updated: 2026-02-23
calculated_by: harness-gardener
---

# Documentation Quality Score

**Score:** 85/100

**Last Updated:** 2026-02-23

## Breakdown

| Category | Count | Deduction |
|----------|-------|-----------|
| Stale Docs | 3 | -15 |
| Broken Links | 0 | -0 |

## Stale Documents

1. `docs/setup.md` (45 days since validation)
2. `docs/api.md` (32 days since validation)
3. `docs/faq.md` (never validated)
```

#### Phase 5: PR Creator

**Files to create:**
- `src/lib/gardener/pr-creator.ts` (new)

**Tasks:**
- [x] Create maintenance PR when issues found
- [x] Use conventional commit format: `docs: gardening updates`
- [x] Include detailed PR body with findings
- [x] Use `GARDENER_TOKEN` secret for authentication
- [x] Skip PR creation in dry-run mode

**PR creation pattern:**
```typescript
export async function createMaintenancePR(
  output: GardenerOutput,
  dryRun: boolean,
): Promise<{ ok: true; prUrl?: string } | { ok: false; error: string }> {
  if (dryRun || !output.needsPR) {
    return { ok: true };
  }

  const octokit = new Octokit({ auth: process.env.GARDENER_TOKEN });

  // Create branch
  const branch = `gardener/${format(new Date(), "yyyy-MM-dd")}`;

  // Update quality score file
  // Create commit
  // Create PR

  const pr = await octokit.rest.pulls.create({
    owner, repo,
    title: `docs: gardening updates (${format(new Date(), "yyyy-MM-dd")})`,
    body: renderPRBody(output),
    head: branch,
    base: "main",
  });

  return { ok: true, prUrl: pr.data.html_url };
}
```

#### Phase 6: CLI Command

**Files to create/modify:**
- `src/commands/gardener.ts` (new)
- `src/cli.ts` (modify - add command)

**Tasks:**
- [x] Add `runGardener()` library function
- [x] Add `runGardenerCLI()` wrapper with console output
- [x] Add `--docs` flag for docs path
- [x] Add `--dry-run` flag for testing
- [x] Add `--json` flag for structured output (todos/002)
- [x] Add `--stale-days` flag for customization
- [x] Register command in cli.ts
- [x] Add to printUsage() help text

**CLI interface:**
```bash
harness gardener [--docs path] [--dry-run] [--json] [--stale-days 30]
```

#### Phase 7: GitHub Workflow

**Files to create:**
- `.github/workflows/gardener.yml` (new)

**Tasks:**
- [x] Create scheduled workflow (cron: "0 2 * * *")
- [x] Add workflow_dispatch for manual runs
- [x] Install lychee via cargo or download binary
- [x] Run `harness gardener --json`
- [x] Create PR if issues found
- [x] Use GARDENER_TOKEN secret

**Workflow template:**
```yaml
name: Gardener

on:
  schedule:
    - cron: "0 2 * * *"  # 2am UTC daily
  workflow_dispatch:

jobs:
  garden:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4  # v4.2.2
        with:
          token: ${{ secrets.GARDENER_TOKEN }}

      - uses: actions/setup-node@v4  # v4.4.0
        with:
          node-version: "20"

      - name: Install lychee
        uses: lycheeverse/lychee-action@v2  # v2.4.0

      - run: pnpm install
      - run: pnpm build

      - name: Run gardener
        run: node dist/cli.js gardener --json
        env:
          GARDENER_TOKEN: ${{ secrets.GARDENER_TOKEN }}
```

#### Phase 8: Tests

**Files to create:**
- `src/commands/gardener.test.ts` (new)
- `src/lib/gardener/stale-detector.test.ts` (new)
- `src/lib/gardener/quality-scorer.test.ts` (new)

**Tasks:**
- [x] Test stale doc detection with various frontmatter states
- [x] Test never-validated docs are marked stale immediately
- [x] Test quality score calculation
- [x] Test `--dry-run` mode (no PR created)
- [x] Test `--json` output format
- [x] Test CLI exit codes (todos/003)

## System-Wide Impact

### Interaction Graph

```
harness gardener
    ├── detectStaleDocs()
    │   ├── glob.sync("*.md")
    │   └── parseFrontmatter()
    ├── checkLinks()
    │   └── lychee CLI (external)
    ├── calculateQualityScore()
    │   └── writeFile(QUALITY_SCORE.md)
    └── createMaintenancePR() [if !dryRun]
        ├── Octokit.pulls.create()
        └── Uses GARDENER_TOKEN secret
```

### Error Propagation

| Error Code | Exit Code | Recovery |
|------------|-----------|----------|
| LYCHEE_NOT_FOUND | 10 | Install lychee |
| DOCS_PATH_NOT_FOUND | 1 | Verify docs/ directory exists |
| GARDENER_TOKEN_MISSING | 10 | Configure GitHub secret |
| PR_CREATION_FAILED | 10 | Check token permissions |

### State Lifecycle Risks

- Quality score file created if missing
- No partial writes - atomic file replacement
- PR branch name includes date for uniqueness
- Safe to re-run after any failure

## Acceptance Criteria

### Functional Requirements

- [x] `harness gardener --dry-run` detects stale docs and broken links
- [x] Never-validated docs are treated as stale immediately
- [x] `harness gardener --json` outputs structured JSON
- [x] Quality score file is created/updated
- [x] Nightly workflow runs at 2am UTC

### Non-Functional Requirements

- [x] Lychee link checking completes in <60s for typical docs
- [x] Exit codes follow semantic contract (todos/003)
- [x] JSON output is machine-readable for CI consumption (todos/002)

### Quality Gates

- [x] Unit tests for stale detection
- [x] Unit tests for quality score calculation
- [x] Integration tests for CLI command
- [x] All existing tests still pass (110+ tests)

## Success Metrics

1. Nightly workflow runs successfully without manual intervention
2. Broken links are detected and PRs opened within 24 hours
3. Quality score reflects actual documentation health

## Dependencies & Risks

### Dependencies

- lychee (Rust-based link checker) - via cargo or GitHub Action
- @octokit/rest - already available in project
- GARDENER_TOKEN secret - requires manual configuration

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| lychee rate limiting | MEDIUM | Configure appropriate retries and timeouts |
| PR spam (many small PRs) | LOW | Batch findings into single PR per run |
| Token permissions | MEDIUM | Document required token scopes |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-23-phase-6-recurring-gardening-brainstorm.md](../brainstorms/2026-02-23-phase-6-recurring-gardening-brainstorm.md)
- Key decisions carried forward:
  1. Scope: Docs only (MVP)
  2. Link checker: lychee (fast, GitHub Action)
  3. PR author: Personal token (GARDENER_TOKEN)

### Internal References

- Command pattern: `src/commands/evidence-verify.ts:1-180`
- Contract types: `src/lib/contract/types.ts:1-26`
- Exit codes: `src/commands/risk-tier.ts:7-13`
- JSON output flag: `src/commands/risk-tier.ts:86-99` (todos/002)

### Institutional Learnings

- **--json flag for CLI:** Always provide structured output for agents (todos/002)
- **Exit code contract:** Semantic codes (0=success, 1=validation, 2=not found, 3=permission, 10+=system) (todos/003)
- **GitHub API rate limits:** Use @octokit/plugin-throttling with retry limit of 3

### External References

- Lychee documentation: https://lychee.cli.rs/
- Lychee GitHub Action: https://github.com/lycheeverse/lychee-action
- GitHub Actions schedule: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule
