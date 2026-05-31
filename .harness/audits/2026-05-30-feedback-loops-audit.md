# Feedback Loops Audit

Date: 2026-05-30
Scope: coding-harness repository feedback loops visible from repository contracts, docs, scripts, CI configuration, Project Brain surfaces, and current agent-facing workflow guidance.
Status: implemented

## Table of Contents
- [Closeout Status](#closeout-status)
- [Ranked Findings](#ranked-findings)
- [Cross-Loop Gaps](#cross-loop-gaps)
- [Recommended Next Steps](#recommended-next-steps)
- [Implementation Evidence](#implementation-evidence)

## Closeout Status

All findings from this audit are now represented in the tracked feedback-loop
index and validated by a read-only command:

- Index: \`.harness/feedback-loops/index.json\`
- Command: \`harness feedback-loop-audit --json\`
- Source implementation: \`src/lib/feedback-loop-audit.ts\`
- CLI implementation: \`src/commands/feedback-loop-audit.ts\`

The lifecycle convention for this audit is:

- \`accepted\`: finding is admitted but not yet implemented.
- \`implemented\`: finding has a durable repo surface and validation path.
- \`linked\`: finding is represented by another tracked issue, plan, or artifact.
- \`superseded\`: finding was replaced by a newer contract.
- \`rejected\`: finding was reviewed and intentionally not adopted.

This audit currently has zero open findings. The index records 19 ranked loops,
5 cross-loop gaps, and 7 recommended next steps, all with \`closureState:
implemented\`.

## Ranked Findings

| Rank | Feedback loop | Closure |
| --- | --- | --- |
| 1 | Operator steering to durable guardrail | implemented |
| 2 | Local validation and repo wrapper gates | implemented |
| 3 | CI and branch-protection checks | implemented |
| 4 | Code review, CodeRabbit, and review-gate | implemented |
| 5 | Runtime evidence, runtime-card, and pr-closeout | implemented |
| 6 | Linear and issue-tracking loop | implemented |
| 7 | Project Brain, local memory, and learnings | implemented |
| 8 | Docs, contract, and governance drift gates | implemented |
| 9 | Security, dependency, and secrets loops | implemented |
| 10 | Artifact and evidence provenance loops | implemented |
| 11 | Related tests and behavior-test quality loops | implemented |
| 12 | Preflight, policy, risk, and blast-radius loops | implemented |
| 13 | Git hooks and worktree-safety loops | implemented |
| 14 | Agent readiness, session context, and next-command loops | implemented |
| 15 | Telemetry, observability, and session traces | implemented |
| 16 | Packaged skill, downstream install, and upgrade loops | implemented |
| 17 | Release, provenance, and rollback loops | implemented |
| 18 | Audit, research, and refactor report loops | implemented |
| 19 | User reports and external issue intake | implemented |

## Cross-Loop Gaps

| Gap | Closure | Durable surface |
| --- | --- | --- |
| Unified feedback-loop ledger missing | implemented | \`.harness/feedback-loops/index.json\` |
| Delay mostly implicit | implemented | \`loops[].expectedDelay\` |
| Closure state uneven | implemented | \`closureState\` lifecycle convention |
| Feedback promotion manual | implemented | \`loops[].action\` and learning-loop evidence refs |
| External truth lanes easy to conflate | implemented | lane-specific loop entries and PR closeout refs |

## Recommended Next Steps

| Recommendation | Closure | Durable surface |
| --- | --- | --- |
| Build \`.harness/feedback-loops/index.json\` | implemented | \`.harness/feedback-loops/index.json\` |
| Add \`harness feedback-loop-audit --json\` | implemented | \`src/commands/feedback-loop-audit.ts\` |
| Extend closeout with lane-separated feedback summary | implemented | feedback-loop index plus \`pr-closeout\` evidence refs |
| Add latency collection | implemented | local \`expectedDelay\` fields; provider collection remains future extension |
| Create audit-finding lifecycle convention | implemented | this file plus index closure states |
| Add escaped-loop classification | implemented | \`loops[].failureClass\` |
| Keep first implementation local-first | implemented | index reads tracked local surfaces only |

## Implementation Evidence

The implementation is intentionally local-first and read-only. It does not
observe live CI, GitHub, Linear, or provider state; those lanes remain separate
truth surfaces. The command validates that:

- the feedback-loop index exists;
- all 19 ranked loops are present;
- every loop has owner, source, recipient, delay, failure class, action, and evidence refs;
- all 5 cross-loop gaps are implemented;
- all 7 recommended next steps are implemented;
- the audit lifecycle has zero open findings.

Run:

\`\`\`bash
node --import tsx src/cli.ts feedback-loop-audit --json
\`\`\`

Expected result: exit code 0 with \`status: "pass"\` after the feedback-loop
index exists, matches \`feedback-loop-index/v1\`, and all loop, gap, and
recommendation closure checks pass. Treat a non-zero exit or \`status: "fail"\`
as a lifecycle blocker; fix the reported finding code before using the audit as
closeout evidence.
