# Context Integrity Control Plane — Agent-Optimized Contract

> **Purpose:** Token-efficient, operationally unambiguous workflow for agent execution.
> **Source:** [2026-03-11-feat-context-integrity-control-plane-spec.md](../specs/2026-03-11-feat-context-integrity-control-plane-spec.md)

## Table of Contents

- [Abbreviations](#abbreviations)
- [Metadata](#metadata)
- [Invariants](#invariants)
- [States](#states)
- [Transition Table (Canonical)](#transition-table-canonical)
- [Error Handling](#error-handling)
- [Idempotency](#idempotency)
- [Execution Modes](#execution-modes)
- [Dry-Run Simulation](#dry-run-simulation)
- [Observability Logs](#observability-logs)
- [Validation Checklist](#validation-checklist)
- [Domain Model (Compact)](#domain-model-compact)
- [Checkpoint State Machine](#checkpoint-state-machine)
- [Phase Execution Map](#phase-execution-map)
- [Lifecycles](#lifecycles)
- [Contradiction Category → Outcome Map](#contradiction-category--outcome-map)
- [Artifact Reference Map](#artifact-reference-map)
- [Rollout Posture Machine](#rollout-posture-machine)
- [Metric → Input Binding](#metric--input-binding)
- [Quick Reference: Tie-Break Order](#quick-reference-tie-break-order-retrieval)
- [Validation Closure Checklist](#validation-closure-checklist)

---

## Abbreviations

| Abbr | Full |
|------|------|
| CIP | `contextIntegrityPolicy` |
| CS | `ContextSource` |
| AD | `AuthorityDescriptor` |
| CF | `ContradictionFinding` |
| CHR | `ContextHealthReport` |
| CHE | `ContextHealthEvaluation` |
| RO | `RetrievalOutcome` |
| DGP | `docsGatePolicy` |
| CP*n* | Checkpoint *n* (hard-stop gate) |
| AUTH | authority level |
| ST | staleness state |

## Metadata
| Field | Value |
| --- | --- |
| `owner` | `context-integrity-maintainers` |
| `max_duration` | `CP0->CP7 rollout window` |
| `escalation` | `hard-stop at first failed checkpoint and rerun from first failure` |

## Invariants
- Checkpoints execute in order with no skip-ahead.
- Any checkpoint failure routes to `FAIL`.
- Recovery always starts from first failed checkpoint.
- Artifact references must resolve or fail closed.

## States
```txt
CP0..CP7 (non-terminal except completion at CP7)
FAIL (terminal)
```

## Transition Table (Canonical)
`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `CP0` | `contract_loaded` | `CIP` validates and artifacts typed | scaffold defaults + freeze vocab | `CP1` |
| `CP1` | `inventory_complete` | authoritative corpus indexed | persist inventory artifact | `CP2` |
| `CP2` | `retrieval_verified` | AUTH/ST ranking tests pass | persist retrieval reports | `CP3` |
| `CP3` | `ledger_verified` | stable `finding_id` + non-placeholder findings | append contradiction history | `CP4a` |
| `CP4a` | `checkout_health_scored` | persisted snapshots only, denominator guards proven | emit current-checkout health reports | `CP4b` |
| `CP4b` | `window_health_scored` | 30 eval or 7-day window + dedupe passes | emit windowed health reports | `CP5` |
| `CP5` | `join_integrity_verified` | stale/missing refs fail explicitly | enforce load-or-fail join policy | `CP6` |
| `CP6` | `docs_rollout_aligned` | docs + rollout wiring + downgrade lane verified | update operator docs and workflow-owned references | `CP7` |
| `CP*` | `gate_failed` | any checkpoint pass condition fails | emit explicit fail artifact + stop promotion | `FAIL` |

## Error Handling
- `VALIDATION_ERROR`: invalid contract/schema/artifact payload.
- `BLOCKED_DEPENDENCY`: required source/artifact missing.
- `POLICY_FAIL`: governance/docs-gate/posture policy conflict.
- `SYSTEM_ERROR`: runtime/indexing/IO failures.

## Idempotency
- Key: `<checkpoint>|<contract_hash>|<artifact_set_hash>`.
- Replays of completed checkpoints must not duplicate contradiction or rollout entries.
- Deduplication relies on checkpoint-scoped dedupe keys.

## Execution Modes
- `STRICT`: fail closed on any missing or inconsistent evidence.
- `ADVISORY`: emit warnings while preserving explicit non-promotion outcomes.

## Dry-Run Simulation
- Evaluate checkpoint guards and transitions only with no side effects.
- Produce deterministic transition trace output for checkpoints.
- No artifact mutation side effects.

## Observability Logs
`workflow_id, transition_code, from_state, to_state, correlation_id, result`

## Validation Checklist
- non-terminal checkpoints have outbound transitions
- deterministic `(S,E)` checkpoint routing
- failures route to `FAIL`/`BLOCKED`
- terminal `FAIL` has no outbound transitions
- rerun starts at first failed checkpoint

---

## Domain Model (Compact)

```
CS  ::= { source_id, path, kind, AUTH, ST, topic, date, indexed_at, content_hash }
AD  ::= { AUTH, auth_rank, source_reason, governed_by, ST }
CF  ::= { finding_id, category, severity, source_paths[], source_of_truth, message, status }
CIP ::= { enabled, mode, ruleCatalog[], truthSources[], healthSampling }
CHR ::= { schemaVersion, status, outcome, mode, window, inputs, scorecard, artifactRefs[] }
CHE ::= { evaluation_id, type, scope_key, dedupe_key, trigger, eligible }
RO  ::= { query, mode, count, results[{ path, score, AUTH, ST }], warnings[] }
```

**AUTH ranking:** `canonical(1) > governed(2) > supporting(3)`

**ST values:** `fresh | stale | unknown`

**CIP.mode ordering:** `shadow < advisory < required`

---

## Checkpoint State Machine

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  CP0 ──► CP1 ──► CP2 ──► CP3 ──► CP4a ──► CP4b ──► CP5 ──► CP6 ──► CP7  │
│   │       │       │       │        │        │       │       │       │   │
│   ▼       ▼       ▼       ▼        ▼        ▼       ▼       ▼       ▼   │
│  FAIL   FAIL    FAIL    FAIL     FAIL     FAIL    FAIL    FAIL    FAIL   │
│   │       │       │       │        │        │       │       │       │   │
│   └───────┴───────┴───────┴────────┴────────┴───────┴───────┴───────┘   │
│                           ▲                                              │
│                           │                                              │
│                    FIX & RERUN FROM FIRST FAILED                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

| CP | Gate | Pass Condition |
|----|------|----------------|
| **CP0** | Bootstrap + Contract | `CIP` typed/validated; `init --update` scaffolds; artifact vocab frozen |
| **CP1** | Source Inventory | `index-context` discovers authoritative corpus; inventory artifact persisted |
| **CP2** | Authority Retrieval | `context`/`search` expose AUTH+ST; ranking honors tie-break order |
| **CP3** | Contradiction Ledger | `docs-gate` emits non-placeholder CFs; history ledger persists with stable `finding_id` |
| **CP4a** | Current-Checkout | `context-health` scores from persisted snapshots only; null≠zero behavior proven |
| **CP4b** | Recent-Artifacts | Window bounded (30 evals OR 7 days); dedupe keys collapse reruns; ad-hoc excluded |
| **CP5** | Join Integrity | Stale/missing/out-of-window refs fail explicitly; no silent degradation |
| **CP6** | Docs + Rollout | Operator docs match shipped behavior; downgrade path verified |
| **CP7** | Full Validation | `pnpm check` passes; rollout evidence packaged; promotion-ready signal distinct |

Executor invariant:
- rerun starts from first failed checkpoint; skip-ahead is not allowed.

---

## Phase Execution Map

| Phase | Goal | Primary Outputs | Blocking Deps |
|-------|------|-----------------|---------------|
| **P0** | Contract + vocab | `CIP` types, artifact-ref helpers, `init --update` migration | — |
| **P1** | Corpus expansion | `index-source-inventory.json` | P0 |
| **P2** | Retrieval metadata | `retrieval-evals/context-*.json`, `search-*.json` | P1 |
| **P3** | Contradiction engine | `contradiction-history.jsonl`, CF counts | P0 |
| **P4a** | Current-checkout scoring | `stale-doc-report.json`, `memory-metrics-snapshot.json` | P1–P3 |
| **P4b** | Windowed scoring | Eligible CHE records, deduped aggregates | P4a |
| **P5** | Join safety | Load-or-degrade/block rules verified | P3, P4 |
| **P6** | Documentation | Updated SOPs, rollout wiring | P0–P5 |
| **P7** | Closure | Full validation bundle, evidence package | P0–P6 |

---

## Lifecycles

### 1. Indexing

```
index-context → discover sources → normalize CS+AD →
  if semantic OK: store semantic
  else if CP4b-gate ON: write degraded lexical
  else: FAIL EXPLICIT → emit inventory artifact
```

### 2. Retrieval

```
context|search → query → rank(similarity > AUTH > ST > family > path) →
  emit RO with AUTH+ST+warnings →
  if governed: persist to retrieval-evals/
```

### 3. Contradiction

```
docs-gate → load truth sources → evaluate categories →
  normalize CF → map outcome(drift|trust_mismatch|policy_error) →
  append to contradiction-history.jsonl
```

### 4. Context-Health

```
context-health → resolve window(current_checkout|recent_artifacts) →
  load persisted artifacts via artifactRefs →
  apply denominator guards → dedupe by dedupe_key →
  emit CHR → advisory only (no merge-blocking)
```

## Executor pseudocode

```txt
start at CP0
for each checkpoint transition row:
  if guard fails: emit fail artifact and stop
  run action and advance to next checkpoint
```

---

## Contradiction Category → Outcome Map

| Category | Condition | Outcome |
|----------|-----------|---------|
| `command_contract_conflict` | contributor docs ≠ script/CLI truth | `drift_detected` |
| `required_check_conflict` | check guidance ≠ workflow truth | `drift_detected` / `trust_mismatch` |
| `instruction_precedence_conflict` | AGENTS≠CLAUDE same scope | `drift_detected` |
| `workflow_policy_conflict` | governance prose ≠ workflow truth | `drift_detected` / `trust_mismatch` |
| `source_truth_missing` | rule defined but no truth source | `policy_error` |
| `unknown_governance_change` | no comparator exists | `drift_detected` (not contradiction) |

---

## Artifact Reference Map

| Type | Path | Producer |
|------|------|----------|
| `context_index_inventory` | `artifacts/context-integrity/index-source-inventory.json` | `index-context` |
| `context_retrieval_report` | `artifacts/context-integrity/retrieval-evals/context-<runId>.json` | `context` |
| `search_retrieval_report` | `artifacts/context-integrity/retrieval-evals/search-<runId>.json` | `search` |
| `context_integrity_contradiction_history` | `artifacts/context-integrity/contradiction-history.jsonl` | `docs-gate` |
| `docs_gate_report` | `artifacts/consistency-gate/docs-gate-report.json` | `docs-gate` |
| `stale_doc_report` | `artifacts/context-integrity/stale-doc-report.json` | `context-health` |
| `memory_metrics_snapshot` | `artifacts/context-integrity/memory-metrics-snapshot.json` | `context-health` |
| `context_health_report` | `artifacts/context-integrity/context-health-report.json` | `context-health` |

---

## Rollout Posture Machine

```
         ┌─────────────────────────────────────────────┐
         │                                             │
         ▼                                             │
      shadow ──(30 PRs, 7d, FP<5%, signoff)──► advisory│
         ▲                                             │
         │                                             ▼
         │◄────(2+ FP blocks / join fail / churn)─────required
         │                                             │
         └─────────────── maintainer edit ─────────────┘
```

**Key rules:**

- `CIP.mode` capped by `DGP.mode` (stricter wins for merge behavior)
- `context-health` **never** auto-mutates `CIP.mode`
- Only `init --update` or manual contract edit changes posture

### Posture Definitions

| Mode | Behavior |
|------|----------|
| `shadow` | Artifact generation allowed; collection for tuning; no new merge-blocking |
| `advisory` | Findings visible and tracked; enforcement limited to existing `docs-gate` behavior |
| `required` | Contradiction categories may contribute to merge-authoritative outcomes; `context-health` still advisory |

### Promotion Criteria

- ≥30 evaluated harness PRs across 7 consecutive days
- False-positive rate <5% for promoted categories
- No unresolved truth-loading or join-integrity regression
- Verified downgrade path back to `advisory`
- Recorded maintainer sign-off

### Demotion Triggers

- ≥2 verified false-positive blocking events in 24h
- Unresolved protected-truth loading regression
- Repeated artifact join-integrity failure
- Contradiction category churn making decision-consistency untrustworthy

---

## Metric → Input Binding

| Metric | Input Artifact | Min Denom | Insufficient → |
|--------|----------------|-----------|----------------|
| `authoritative_coverage_rate` | `indexArtifacts[]` | 1 | `null` + `insufficient_evidence=true` |
| `contradiction_open_count` | `contradictionHistoryArtifacts[]` | — | `0` |
| `degraded_retrieval_rate` | `retrievalArtifacts[]` | 10 | `null` + `insufficient_evidence=true` |
| `memory_unresolved_question_count` | `memoryMetricSnapshots[]` | — | `0` |
| `decision_consistency_proxy` | `contradictionHistoryArtifacts[]` + `docsGateArtifacts[]` | 10 | `null` + `insufficient_evidence=true` |

---

## Quick Reference: Tie-Break Order (Retrieval)

```
1. similarity score (desc)
2. AUTH (canonical > governed > supporting)
3. ST (fresh > unknown > stale)
4. Family priority:
   README > AGENTS > CONTRIBUTING > CLAUDE > diagram-context >
   docs/agents > docs/adr > docs/specs >
   docs/brainstorms > docs/plans > docs/solutions
5. Path (stable sort)
```

---

## Validation Closure Checklist

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm audit && pnpm check
npm test && npm run test:deep
```

---

## Cross-References

- Full spec: [2026-03-11-feat-context-integrity-control-plane-spec.md](../specs/2026-03-11-feat-context-integrity-control-plane-spec.md)
- Implementation plan: [2026-03-11-feat-context-integrity-control-plane-plan.md](../plans/2026-03-11-feat-context-integrity-control-plane-plan.md)
- Rollout guidance: [14-docs-gate-rollout.md](./14-docs-gate-rollout.md)
