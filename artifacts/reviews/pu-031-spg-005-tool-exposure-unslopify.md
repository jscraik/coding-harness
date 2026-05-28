# PU-031 SPG-005 Unslopify Lens

Status: pass

## Findings

No slop blockers.

## Tightened Claims

- Tool exposure is orientation/audit-trail only.
- Blocked permission attempts use closed enums for permission kind and reason.
- The packet forbids raw command arguments, raw tool payloads, stdout/stderr/stdin, transcripts, and writable root lists.
- The projection stores `writableRootCount`, not path lists.
- Key tool names are capped at 12.

## Validation Evidence

- Negative fixtures cover claim-support promotion, raw payloads, command fragments, path-list attempts, missing failure class, open blocked-reason prose, and cardinality overflow.

WROTE: artifacts/reviews/pu-031-spg-005-tool-exposure-unslopify.md

