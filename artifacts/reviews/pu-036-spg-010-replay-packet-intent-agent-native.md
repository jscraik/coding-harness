## Agent-Native Architecture Review

### Summary
This intent defines an additive, contract-only `ReplayPacket/v1` surface for replay seed and hook provenance with explicit orientation/audit-only boundaries. The slice shows strong anti-leak and non-authority constraints, but it does not yet require a concrete agent-facing discovery/entrypoint path (command/help/runtime-card projection) that lets an agent find and use this packet contract without manual file hunting.

### Capability Map

| UI/Workflow Action | Location | Agent Tool/Surface | In Prompt/Intent | Priority | Status |
|---|---|---|---|---|---|
| Define replay packet schema contract | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:12,50 | `contracts/replay-packet.schema.json` + validator script | Yes | Must-have | Covered |
| Validate replay packet semantics | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:15,67 | `scripts/validate-replay-packet.cjs` | Yes | Must-have | Covered |
| Discover packet through runtime packet registry | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:14,46,60 | runtime manifest entry | Yes | Should-have | Partially covered |
| Discover and invoke packet flow from agent-operable command/help surface | .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:64-76 | explicit CLI/runtime-card integration requirement | No | Must-have | Gap |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Missing explicit agent discovery and invocation contract for ReplayPacket flow** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:50,64-76` -- The intent requires schema/validator correctness, but does not require that an agent can discover and run the replay-packet path through an existing command/help/runtime-card surface (for example, a command family, docs-gate visible contract, or runtime recommendation path). Impacted behavior: replay contract may exist but remain effectively hidden, forcing manual human navigation of repo files rather than agent-operable workflow execution. Remediation: add one acceptance criterion and one validation command proving an agent-discoverable entrypoint (for example, `harness ... --json` or `node --import tsx src/cli.ts ... --json`) that references replay packet generation/validation and emits machine-readable guidance. Confidence: 0.76. Validation ownership: introduced by current patch (intent-level omission).

#### Observations
1. **Strong orientation-only boundary and anti-secrets posture are already encoded** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:38,42,52-54,99,125-127`. This reduces risk of accidental claim-support drift or sensitive data leakage and aligns with agent-safe operational evidence.
2. **Manifest inclusion requirement is a good discoverability baseline** -- `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:46,60`. This is useful, but should be paired with command-surface discoverability to reach full agent-operable parity.

### What's Working Well
- The intent keeps packet authority bounded and explicitly non-executable/non-claim-support.
- Validation criteria include strong negative tests for secret-like fields and unsafe path forms.
- Time-ordering and ref taxonomy constraints are specified clearly enough for deterministic semantic validation.

### Score
- **3/4 high-priority capabilities are agent-accessible from declared intent surfaces**
- **Verdict:** NEEDS WORK

### Accountability Receipt
- status: completed
- artifact_paths: artifacts/reviews/pu-036-spg-010-replay-packet-intent-agent-native.md
- manifest_path: artifacts/agent-runs/agent-native-reviewer-019e6ef1-59e7-7393-a9a0-f0bb10de1786/manifest.json
- findings:
  - warning: missing explicit agent-discoverable command/help/runtime entrypoint for replay packet workflow
- failures_or_blockers:
  - blocked_local_memory_cli: `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu-036-agent-native-intent-review" --json` failed with `open /Users/jamiecraik/.local-memory/local-memory.pid: operation not permitted`
  - blocked_local_memory_cli: `local-memory search "replay packet" --session_filter_mode all --json` failed with `dial tcp [::1]:3002: connect: operation not permitted`
- improvement_opportunities:
  - add an explicit CLI/runtime-card discoverability acceptance criterion plus machine-readable validation command
- strengths:
  - strong non-secret and non-claim-support boundaries
  - additive contract posture and manifest-based registration intent
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json | sed -n '1,260p'`
  - `local-memory bootstrap --mode minimal --include_questions --session_id "repo:coding-harness/task:pu-036-agent-native-intent-review" --json` (failed, captured)
  - `local-memory search "replay packet" --session_filter_mode all --json` (failed, captured)
- next_action:
  - coordinator should require one acceptance/validation addition proving agent-discoverable invocation path before implementation closeout

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-intent-agent-native.md
