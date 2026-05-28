## Agent-Native Architecture Review

### Summary
PU-019 is now materially tighter and aligns with agent-native boundaries by explicitly positioning `agent-readiness` as a lightweight projection and the existing `context-health` command as the deeper context-integrity artifact lane. The intent is implementable within the declared file scope and avoids expanding into `harness next` or external fetch orchestration. One remaining should-fix gap is that validation does not yet prove the projection's suggested command path is executable and correctly wired end-to-end.

### Capability Map

| UI/Operator Action | Location | Agent Tool/Command | In Prompt/Intent? | Priority | Status |
|---|---|---|---|---|---|
| Run fast orientation check | .harness/intent/...json:49-54 | `harness agent-readiness --json` | Yes | Must-have | Covered |
| Run deep context-integrity artifact | src/commands/context-health.ts:83-90,246-255 | `harness context-health` | Yes (`acceptanceCriteria` + `scope`) | Must-have | Covered |
| Classify stale/missing route/memory context before action | intent:50,72-75 | agent-readiness context-health projection | Yes | Must-have | Covered |
| Route to non-mutating refresh guidance | intent:51-53,71 | suggested commands in projection | Yes | Should-have | Partial (validation gap below) |

### Findings

#### Warnings (Should Fix)
1. **Suggested-command parity is specified but not validated as executable behavior** — `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json:71,79-83`
Impacted behavior: The intent requires context-health suggestion routing, but gates only prove `agent-readiness` shape/CLI output and do not assert the suggested `context-health` command linkage is present and runnable. This can regress into prose-only advice without a hard failure.
Remediation: Add one focused assertion in `src/commands/agent-readiness.test.ts` that verifies suggested refresh commands include `context-health` and a lightweight execution smoke check (or deterministic stub) for command availability contract.
Confidence: 84
Validation ownership: introduced by current patch (intent update that added context-health projection language).

#### Observations
1. **Duplication risk is now intentionally controlled** — intent lines `24,52,64,69-71` explicitly preserve `context-health` as canonical deep engine and keep PU-019 additive in `agent-readiness`. This is the right boundary for primitives over duplicate workflows.

### What's Working Well
- Clear additive contract: projection in `agent-readiness` without moving authority to `next` or runtime producers.
- Strong out-of-scope constraints prevent accidental expansion into external-state fetches.
- Context classification surfaces are explicitly enumerated and machine-oriented.

### Score
- **3/4 high-priority capabilities are fully agent-accessible and proven-by-intent/gates; 1/4 is partial due to missing executable suggestion-link validation**
- **Verdict:** NEEDS WORK (small, focused validation hardening)

### Accountability Receipt
- status: completed_with_findings
- manifest_path: artifacts/agent-runs/agent-native-reviewer-20260527-pu019-gap008-intent-review/manifest.json
- artifact_paths: artifacts/reviews/pu-019-gap-008-context-health-intent-agent-native.md
- findings:
  - should_fix: suggested-command parity lacks executable validation coverage.
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu-019-gap-008-agent-native-review" --json` failed with `open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`.
  - blocked_local_memory_cli: `local-memory search "PU-019 GAP-008 context health intent agent-native" --session_filter_mode all --json` failed with same PID-file permission error.
- improvement_opportunities:
  - Add one contract test for suggested refresh command execution/discoverability.
- strengths:
  - Intent now avoids context-health engine duplication and keeps agent-readiness as a lightweight projection seam.
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-019-gap-008-context-health-intent.json`
  - `nl -ba docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`
  - `nl -ba .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
  - `nl -ba src/lib/agent-readiness/checker.ts`
  - `nl -ba src/lib/agent-readiness/types.ts`
  - `nl -ba src/commands/context-health.ts`
- next_action:
  - tighten PU-019 validation gates to prove suggested-command routing is mechanically executable, then proceed to implementation.
- useful_findings: 1
- avoided_false_positive: Did not flag prior duplication issue after intent was updated to preserve canonical `context-health` lane.
- evidence_quality: high (line-cited source + command-level checks)
- followed_scope: yes (read-only intent review, no source mutation)
- reusable_learning: Validate command-suggestion parity as executable contract, not prose.
- coordinator_score: 0.86

WROTE: artifacts/reviews/pu-019-gap-008-context-health-intent-agent-native.md
