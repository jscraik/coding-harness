# {{WORKFLOW_NAME}} Workflow

## Table of Contents
- [Metadata](#metadata)
- [Transition Table (Canonical)](#transition-table-canonical)
- [Error Handling](#error-handling)
- [Execution Modes](#execution-modes)
- [Dry-Run Simulation](#dry-run-simulation)
- [Observability Logs](#observability-logs)

## Metadata
| Field | Value |
| --- | --- |
| `owner` | {{OWNER}} |
| `max_duration` | {{MAX_DURATION}} |
| `escalation` | {{ESCALATION_PATH}} |
| `change_class` | validation-only |

## Transition Table (Canonical)
`S | E | G | A | N`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0` | `start` | input valid | run validation checks | `S1` |
| `S1` | `pass` | all checks pass | emit success report | `DONE` |
| `S1` | `fail` | check failure | emit failure report | `FAIL` |
| `S0` | `error` | system error | record failure artifact | `FAIL` |

## Error Handling
- `VALIDATION_ERROR`: invalid input or malformed data.
- `BLOCKED_DEPENDENCY`: external dependency unavailable.
- `POLICY_FAIL`: policy or gate check failure.
- `SYSTEM_ERROR`: runtime or network failure.

## Execution Modes
- `STRICT`: hard-fail on violations.
- `ADVISORY`: warn and continue.

## Dry-Run Simulation
- No side effects in dry-run mode.
- Deterministic transition trace output.

## Observability Logs
Required fields:
- `workflow_id`
- `transition_code`
- `from_state`
- `to_state`
- `correlation_id`
- `result`
