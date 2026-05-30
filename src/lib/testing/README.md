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
state, runtime-card, Local Memory, or policy-gate decisions.

Each manifest entry includes:

- `area`: human-readable owner area for diagnostics.
- `path`: repo-relative test file path checked by the guard.
- `rationale`: why this suite needs behavior-shaped failure context.

## Validation

Run `pnpm run quality:behavior-tests` after changing the helper, manifest, or
registered high-trust test suites.
