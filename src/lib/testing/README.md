# Testing Helpers

## Table of Contents

- [Behavior Assertions](#behavior-assertions)
- [Behavior-Test Manifest](#behavior-test-manifest)
- [Validation](#validation)

## Behavior Assertions

Use `expectBehavior({ given, should, actual, expected })` in high-trust
evidence-bearing tests where failure output must explain the reproduction
context and expected behavior, not only the mismatched value.

## Behavior-Test Manifest

`behavior-test-suites.json` is the visibility map for suites that must keep
at least one behavior assertion. Add new trust-boundary evidence suites to
the manifest when their failures affect closeout, delivery-truth, external
state, runtime-card, Local Memory, browser evidence, or policy-gate decisions.
SynAIpse context selection belongs in this manifest because privacy, authority,
freshness, and required-context failures can block an admitted task. Assign an
explicit suite owner and proving command to every context-plane entry.
SynAIpse packet consolidation also belongs here because stale caller,
retirement, canary, rollback, or independent-review evidence must block legacy
deletion with an assertion-shaped reason. The required command is
`pnpm run quality:behavior-tests`, which must exit successfully. A failure
blocks closeout until it is repaired and rerun.

Each manifest entry includes:

- `path`: repo-relative test file path checked by the guard.
- `owner`: human-readable owner area for diagnostics.
- `rationale`: why this suite needs behavior-shaped failure context.
- `provingCommand`: focused command that proves the registered suite.

## Validation

Run `pnpm run quality:behavior-tests` after changing the helper, manifest, or
registered high-trust test suites.
