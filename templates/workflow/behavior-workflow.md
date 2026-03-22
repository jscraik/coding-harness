---
# Symphony Workflow Configuration
# Remove or customize the frontmatter block below for your tracker integration.
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "<your-project-slug>"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
agent:
  max_concurrent_agents: 3
  max_turns: 12
---

# {{WORKFLOW_NAME}} Workflow

## Table of Contents
- [Abbreviations](#abbreviations)
- [Metadata](#metadata)
- [Validation Contract](#validation-contract)
- [States](#states)
- [Transition Table (Canonical)](#transition-table-canonical)
- [Error Handling](#error-handling)
- [Idempotency](#idempotency)
- [Execution Modes](#execution-modes)
- [Dry-Run Simulation](#dry-run-simulation)
- [Observability Logs](#observability-logs)
- [Validation Checklist](#validation-checklist)

## Abbreviations
| Abbr | Meaning |
| --- | --- |
| `S` | state |
| `E` | event |
| `G` | guard |
| `A` | action |
| `N` | next state |

## Metadata
| Field | Value |
| --- | --- |
| `owner` | {{OWNER}} |
| `max_duration` | {{MAX_DURATION}} |
| `escalation` | {{ESCALATION_PATH}} |
| `change_class` | behavior |

## Validation Contract
| Field | Value |
| --- | --- |
| `test_mode` | tdd-required |
| `test_tier` | integration |
| `tracer_bullet_first` | yes |
| `red_evidence_required` | yes |

## States
```txt
S0 INIT (non-terminal)
S1 WORKING (non-terminal)
S2 REVIEW (non-terminal)
S3 DONE (terminal)
S4 BLOCKED (non-terminal)
S5 FAIL (terminal)
```

## Transition Table (Canonical)
`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0 INIT` | `start` | preflight passes | initialize workflow context | `S1 WORKING` |
| `S1 WORKING` | `advance` | policy and validation pass | execute primary action | `S2 REVIEW` |
| `S1 WORKING` | `blocked` | dependency unavailable | emit unblock payload | `S4 BLOCKED` |
| `S1 WORKING` | `error` | unrecoverable runtime/policy issue | record failure artifact | `S5 FAIL` |
| `S2 REVIEW` | `approved` | required checks pass | finalize output | `S3 DONE` |
| `S2 REVIEW` | `rejected` | review gate fails | route back to working | `S1 WORKING` |
| `S4 BLOCKED` | `unblocked` | dependency restored | resume execution | `S1 WORKING` |

## Error Handling
- `VALIDATION_ERROR`: invalid input, malformed data, or missing required fields.
- `BLOCKED_DEPENDENCY`: missing auth/secret/permission; route to BLOCKED.
- `POLICY_FAIL`: required checks, policy, or gate failures.
- `SYSTEM_ERROR`: CLI/runtime/network failure; emit failed command.

## Idempotency
- Idempotency key: `{{workflow_id}}|{{event}}|{{from_state}}|{{correlation_id}}`.
- Replayed events with same key must no-op or upsert only.
- Side effects must be guarded against duplication.

## Execution Modes
- `STRICT`: hard-fail on validation/policy violations.
- `ADVISORY`: emit warnings and continue for non-safety violations.

## Dry-Run Simulation
- Dry-run has no side effects.
- Dry-run emits deterministic transition trace output.
- Output includes selected transition row and guard evaluation.

## Observability Logs
```json
{
  "workflow_id": "{{WORKFLOW_ID}}",
  "transition_code": "S0:start",
  "from_state": "S0 INIT",
  "to_state": "S1 WORKING",
  "correlation_id": "{{CORRELATION_FORMAT}}",
  "result": "success|blocked|failed"
}
```

## Validation Checklist
- [ ] canonical `S | E | G | A | N` table exists
- [ ] 5 non-empty cells in each transition row
- [ ] all required error codes are present
- [ ] `STRICT` and `ADVISORY` modes are declared
- [ ] dry-run semantics include no side effects and deterministic trace output
- [ ] required observability log fields are present
- [ ] `change_class` metadata is declared
- [ ] validation contract fields are declared
- [ ] behavior-changing workflows include TDD or reviewed exemption metadata
