---
title: Patch 2 - Interactive Mode for harness init
type: feat
status: completed
date: 2026-04-13
plan_id: feat-interactive-mode
origin: docs/brainstorms/2026-02-23-installability-patches-brainstorm.md
last_validated: 2026-04-18
---

# Patch 2 - Interactive Mode for harness init

## Overview

Implement interactive prompts for `harness init` that allow users to review and approve each file change before it's applied.

## Problem Statement / Motivation

Users are hesitant to run `harness init` blindly because:
- **No preview**: Can't see what will change before it happens
- **No control**: Must accept all changes or none
- **Anxiety**: Fear of breaking existing configurations

**From brainstorm:** Inquirer prompts with y/n/diff for each file change addresses this.

## Proposed Solution

```bash
# Interactive mode - prompts for each change
harness init --interactive

# Works with --update too
harness init --update --interactive
```

## Technical Approach

### Architecture

Add `@inquirer/prompts` dependency and implement interactive flow in runInitCLI.

### Interaction Flow

```
Installing harness (package manager: pnpm)

? harness.contract.json exists. Overwrite? (y/N/diff)
  > diff
--- current
+++ new
@@ -1,5 +1,5 @@
 {
   "version": "1.0",
-  "reviewPolicy": { "timeoutSeconds": 300 }
+  "reviewPolicy": { "timeoutSeconds": 600 }
 }

? Apply this change? (y/N)
  > y
  ✓ harness.contract.json updated

? .github/workflows/pr-pipeline.yml does not exist. Create? (Y/n)
  > Y
  ✓ .github/workflows/pr-pipeline.yml created

✓ Harness installed!
  Created: 1, Skipped: 1
```

### Dependencies

Add `@inquirer/prompts`:
- Lightweight (~50KB)
- Tree-shakeable
- Modern ESM support
- Good TypeScript support

### Implementation Steps

#### Phase 1: Add Dependency

```bash
pnpm add @inquirer/prompts
```

#### Phase 2: Implement Interactive Flow

1. Add `interactive?: boolean` to `InitOptions`
2. In `runInit()`, when `--interactive`:
   - Don't write files immediately
   - Collect proposed changes
   - Return special result with proposed changes
3. In `runInitCLI()`:
   - For each proposed change, prompt user
   - Show diff if requested
   - Apply approved changes only

#### Phase 3: Diff Display

Implement diff generation:
```typescript
import { diffLines } from "diff";

function generateDiff(oldContent: string, newContent: string): string {
  const changes = diffLines(oldContent, newContent);
  // Format as unified diff
}
```

Add `diff` package for generating diffs.

### Type Changes

```typescript
export interface ProposedChange {
  path: string;
  action: "create" | "modify" | "skip";
  currentContent: string | null;  // null for new files
  newContent: string;
}

export interface InitOutput {
  // ... existing fields
  proposedChanges?: ProposedChange[];  // Populated in interactive dry-run
}
```

### CLI Flow

```typescript
async function runInteractiveInit(targetDir: string, options: InitOptions): Promise<number> {
  // First, collect what would change
  const proposed = collectProposedChanges(targetDir, options);

  for (const change of proposed) {
    const answer = await inquirer.select({
      message: formatChangePrompt(change),
      choices: [
        { value: "yes", name: "Yes" },
        { value: "no", name: "No" },
        { value: "diff", name: "Show diff" },
      ],
    });

    if (answer === "diff") {
      console.log(formatDiff(change));
      const confirm = await inquirer.confirm({
        message: "Apply this change?",
        default: false,
      });
      if (confirm) applyChange(change);
    } else if (answer === "yes") {
      applyChange(change);
    }
  }
}
```

### Key Design Decisions

1. **Non-interactive default**: CI-friendly, no prompts unless `--interactive`
2. **Works with all modes**: Compatible with `--track`, `--update`, etc.
3. **Show diff option**: User can see exact changes before deciding
4. **Graceful degradation**: If not a TTY, fall back to non-interactive

## System-Wide Impact

### Interaction Graph

```
harness init --interactive
    ├── detectPackageManager()
    ├── for each template:
    │   ├── check if exists
    │   ├── render new content
    │   ├── prompt user (y/n/diff)
    │   ├── if diff: showDiff()
    │   └── if approved: atomicWrite()
    └── if --track: createManifest()
```

### Error Handling

- TTY check: If not interactive terminal, warn and proceed non-interactively
- Signal handling: Catch Ctrl+C gracefully, clean up partial changes
- Timeout: No timeout on prompts (user may need time to review)

## Acceptance Criteria

### Functional Requirements

- [x] `harness init --interactive` prompts for each file change
- [x] User can view diff before accepting change
- [x] User can skip individual files
- [ ] Works with `--update` flag (not implemented - interactive mode is for initial install only)
- [x] Falls back to non-interactive when not a TTY

### Non-Functional Requirements

- [x] Add `@inquirer/prompts` dependency
- [x] Add `diff` package for diff generation
- [x] Prompts are clear and actionable
- [x] No prompts in CI/non-TTY environments

### Documentation Requirements

- [x] Help text updated with `--interactive` flag

## Dependencies & Risks

### Dependencies

- `@inquirer/prompts` (~50KB)
- `diff` (~30KB)

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking CI | LOW | Non-interactive default, TTY check |
| Large diffs | LOW | Truncate/paginate if too long |
| User confusion | LOW | Clear prompts, default to "no" for destructive |

## Estimated Effort

| Component | LOC | Notes |
|-----------|-----|-------|
| Interactive flow | ~60 | Prompt handling |
| Diff generation | ~30 | Format and display |
| CLI integration | ~20 | Flag parsing |
| Tests | ~50 | Interactive test scenarios |
| **Total** | **~160** | |

## Sources & References

### Origin

- **Brainstorm:** [docs/brainstorms/2026-02-23-installability-patches-brainstorm.md](../brainstorms/2026-02-23-installability-patches-brainstorm.md)

### External References

- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js)
- [diff package](https://github.com/kpdecker/jsdiff)
