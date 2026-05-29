# Adversarial Intent Review — PU-036 SPG-010 ReplayPacket

status: completed
scope: pre-implementation intent review only
intent_path: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json

## Findings (severity-ranked)

### 1) HIGH — Path-stable replay refs can be silently retargeted after packet generation
- severity: high
- evidence:
  - Trigger: Replay packet records `sourceRefs` and replay seed refs as path references without a hard requirement that each referenced artifact is content-bound via immutable hash. Evidence: intent requires “source artifact refs without embedding raw source bodies” and only requires hash constraints explicitly for replay seeds, not all refs ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:39](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:39), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:55](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:55)).
  - Execution path: Packet validates because refs are repo-relative and taxonomy-compliant while file contents can change between generation and replay validation ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:43](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:43), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:59](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:59)).
  - Failure outcome: A later consumer can reconstruct from mutated artifacts and treat the packet as faithful historical evidence, creating false orientation/audit conclusions.
- impacted_behavior: Replay reconstruction integrity is not content-stable; “what evidence was available” can drift after generation.
- remediation: Require per-ref immutable digest fields (algorithm + hash) for every replay-critical sourceRef/hook ref/artifact ref and require semantic validator to verify digest match when file existence is required.
- confidence: 75
- validation_ownership: introduced-by-current-intent

### 2) MEDIUM — Hook provenance can be syntactically valid but operationally spoofed
- severity: medium
- evidence:
  - Trigger: Hook provenance requires identity, trigger kind, inputRef/outputRef, status, blocker class, produced artifacts, but does not require executable identity/version hash or producer attestation binding ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:40](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:40), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:57](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:57)).
  - Execution path: A producer can emit plausible hook provenance entries that satisfy required fields and ordering checks while not proving that the referenced hook implementation actually ran ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:58](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:58)).
  - Failure outcome: Replay investigators may trust fabricated provenance when triaging incident causes.
- impacted_behavior: Provenance authenticity is weaker than provenance structure.
- remediation: Add required hookExecutionIdentity fields (hook file digest, resolved command digest, and optional run-id correlation) with validator checks for presence and format.
- confidence: 75
- validation_ownership: introduced-by-current-intent

### 3) MEDIUM — Staleness model does not force anti-replay freshness gate for audit consumers
- severity: medium
- evidence:
  - Trigger: Intent requires `freshness/staleState/blockers/nextAction` metadata and forbids delivery-truth claims, but does not require a strict freshness policy check (TTL/head-sha equivalence against current repo head) for audit consumption ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:44](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:44), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:99](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:99)).
  - Execution path: Old packets remain schema-valid and may be used in later orientation contexts without deterministic “expired” classification.
  - Failure outcome: Time-shifted packets can be over-trusted during incident triage, especially when branch names are reused or force-updated.
- impacted_behavior: Audit trail consumers can misread stale packet data as current-enough replay context.
- remediation: Add mandatory freshness policy fields (`observedHeadSha`, `currentHeadShaCheck`, `ttlSeconds`, `freshnessVerdict`) and semantic validation rule that marks packets as blocked for replay orientation when stale checks fail.
- confidence: 50
- validation_ownership: introduced-by-current-intent

## Residual Risks
- Orientation-only boundaries are well-stated, but consumers outside this slice can still over-interpret replay packets unless consumption-side gates enforce freshness and authenticity.
- Ref taxonomy safety is strong for path traversal, but authenticity/integrity controls are still optional in this intent.

## Testing Gaps
- No explicit negative criterion for “content changed but path unchanged” replay ref tampering.
- No explicit negative criterion for “hook provenance claims execution of wrong hook binary/version”.
- No explicit criterion requiring deterministic stale classification against current head/TTL.

## Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6ef1-8c9c-7bc2-a0ce-748907c92345/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-036-spg-010-replay-packet-intent-adversarial.md
- findings:
  - useful_findings: 3
  - avoided_false_positive: kept focus on cross-component/replay-integrity failure chains; excluded pure style/perf/security-pattern checks
- failures_or_blockers:
  - Missing template/runtime contract files referenced by role policy in this checkout: `agents/contracts.json`, `agents/templates/review-artifact.md`; proceeded with required artifact schema manually.
- improvement_opportunities:
  - Add per-ref digest invariants and freshness policy assertions into acceptance criteria before implementation starts.
- strengths:
  - Intent already enforces orientation-only evidence use and explicit raw-content redaction boundaries.
- validation_evidence:
  - `nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json | sed -n "1,260p"`
  - `rg --files | rg "agents/contracts.json|templates/review-artifact.md|templates/blocker-artifact.md|contracts.json$"`
- next_action:
  - Amend intent acceptance criteria to include authenticity/freshness anti-replay checks, then re-run pre-implementation adversarial review.

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-intent-adversarial.md
