# Adversarial Review — PU-013 Implementation

## Scope Reviewed
- src/lib/runtime/repo-runtime-artifact.ts
- src/commands/runtime-card.ts
- src/commands/next-runtime-card.ts
- src/commands/next-phase-exit.ts
- src/commands/runtime-card.test.ts
- src/commands/next.test.ts
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-013-intent.json

## Findings

### 1) Medium — TOCTOU escape window between repo-boundary validation and file read
- Evidence:
  - [src/lib/runtime/repo-runtime-artifact.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/repo-runtime-artifact.ts:31) computes canonical repo.
  - [src/lib/runtime/repo-runtime-artifact.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/repo-runtime-artifact.ts:36) resolves canonical artifact via \`realpathSync\`.
  - [src/lib/runtime/repo-runtime-artifact.ts](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/repo-runtime-artifact.ts:40) performs a separate \`readFileSync\` call after checks.
- Constructed failure scenario:
  1. Operator runs \`harness next --runtime-card runtime-card.json\` or \`harness runtime-card --evidence ...\`.
  2. \`readRepoRuntimeArtifactText\` validates that \`runtime-card.json\` currently resolves inside \`--repo\`.
  3. Between validation and \`readFileSync\`, another local process swaps that path to a symlink (or replaces inode) targeting an out-of-repo file.
  4. \`readFileSync\` follows the new link/target, ingesting out-of-bound content even though boundary checks previously passed.
  5. Downstream parsers accept attacker-controlled/stale external artifact content, producing incorrect blocked/pass advisory outcomes.
- Why this is a composition failure:
  - Boundary enforcement and content read are implemented as two separate filesystem operations; each is valid alone, but the sequence is raceable under concurrent mutation.
- Remediation:
  - Open file descriptor first with no-follow semantics where available (\`O_NOFOLLOW\`) and validate the opened handle via \`fstat\` + repo containment before reading.
  - Alternatively perform an immediate post-open \`realpath\`/inode consistency check and fail if path target changed between checks.
  - Add a regression test that simulates path swap during read (or a deterministic harness-level test around descriptor-based reads).

## Validation ownership classification
- No new validation failures were observed from the provided command outcomes.
- Ownership classification for this finding: introduced-by-current-patch risk surface (new shared helper now gates both \`--runtime-card\` and \`--phase-exit\` reads).

## Residual risks
- Absolute-path hard rejection for \`--runtime-card\` and \`--phase-exit\` is intentionally strict and consistent with \`--evidence\`, but may block existing automations that pass absolute in-repo artifact paths.
- Runtime-card metadata remains advisory in this slice; separate guardrails are still required to prevent operators from treating advisory metadata as merge-readiness authority.

WROTE: artifacts/reviews/codex-runtime-evidence-pu-013-implementation-adversarial.md
