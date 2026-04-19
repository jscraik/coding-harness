---
last_validated: 2026-04-18
---

# Workflow Contract v1

## Abbreviations
| Abbr | Meaning |
| --- | --- |
| `S` | state |
| `E` | event |
| `G` | guard |
| `A` | action |
| `N` | next state |

## Metadata
| Field | Requirement |
| --- | --- |
| `owner` | accountable maintainer/team |
| `max_duration` | max execution window |
| `escalation` | explicit escalation path |
| `change_class` | one of `behavior`, `validation-only`, `docs-only` |

## Validation Contract
| Field | Requirement |
| --- | --- |
| `test_mode` | one of `tdd-required`, `validation-required`, `n/a` |
| `test_tier` | one of `unit`, `integration`, `e2e`, `mixed`, `n/a` |
| `tracer_bullet_first` | `yes` or `no` |
| `red_evidence_required` | `yes` or `no` |
| `exemption_reason` | required when `change_class = behavior` and `test_mode != tdd-required` |
| `reviewed_by` | required when `exemption_reason` is set |

## Invariants
- Every non-terminal state has at least one outbound transition.
- Event resolution is deterministic per `(S,E)` pair (no overlapping guards).
- Failure paths route to `FAIL` or `BLOCKED`.
- Terminal states have no outbound transitions.
- Transition table is canonical source of truth.
- `change_class = behavior` must declare a non-`n/a` validation contract.
- `test_mode = tdd-required` implies `red_evidence_required = yes`.
- `change_class = behavior` and `test_mode != tdd-required` requires explicit exemption metadata.
- `tracer_bullet_first = yes` means the first promoted slice must prove one end-to-end path before parity expansion.
- Behavior-changing evidence should exercise public interfaces rather than implementation-detail probes.
- `validation-only` and `docs-only` workflows must still declare deterministic validation strategy.

## States
```txt
NON_TERMINAL: execute until guarded transition resolves
TERMINAL: DONE | FAIL | BLOCKED
```

## Transition Table (Canonical)
`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0` | `start` | preflight passes | initialize workflow context | `S1` |
| `S1` | `advance` | policy and validation pass | execute deterministic action | `S2` |
| `S1` | `blocked` | dependency unavailable | emit unblock payload | `BLOCKED` |
| `S*` | `error` | unrecoverable runtime/policy issue | record failure artifact | `FAIL` |

## Error Handling
Use exactly this taxonomy:
- `VALIDATION_ERROR`
- `BLOCKED_DEPENDENCY`
- `POLICY_FAIL`
- `SYSTEM_ERROR`

## Idempotency
- Idempotency key format: `<workflow_id>|<event>|<from_state>|<correlation_id>`.
- Replayed events with same key must no-op or perform upsert behavior only.
- Side effects must be guarded to prevent duplicate writes.

## Execution Modes
- `STRICT`: hard-fail on validation/policy violations.
- `ADVISORY`: emit warnings and continue when safe.

## Dry-Run Simulation
- Dry-run has no side effects.
- Dry-run emits deterministic transition trace output.
- Output includes selected transition row and guard evaluation.

## Observability Logs
Required schema fields:
- `workflow_id`
- `transition_code`
- `from_state`
- `to_state`
- `correlation_id`
- `result`

## Validation Checklist
- canonical `S | E | G | A | N` table exists
- 5 non-empty cells in each transition row
- all required error codes are present
- `STRICT` and `ADVISORY` modes are declared
- dry-run semantics include no side effects and deterministic trace output
- required observability log fields are present
- `change_class` metadata is declared
- validation contract fields are declared
- behavior-changing workflows include TDD or reviewed exemption metadata
- `tdd-required` workflows require RED evidence
