# Interface Design

Use this only after the user chooses a deepening candidate.

## Process

1. Frame the problem space for the user:
   - current callers
   - required invariants
   - error modes
   - dependency category from `deepening.md`
   - rollback constraints
   - smallest illustrative code sketch

2. Generate at least three different interface shapes:
   - **Minimal**: one to three entry points, maximum leverage.
   - **Flexible**: broader extension points, explicit variation.
   - **Default-path**: optimize for the most common caller.
   - **Ports-and-adapters**: use only when a remote-owned or external
     dependency makes the seam real.

3. Compare the designs by:
   - depth at the interface
   - locality of future change
   - test surface quality
   - migration and rollback cost
   - risk of adding policy surface without removing manual glue

4. Recommend one design or a focused hybrid. Be opinionated.

## Output Shape

For each design, include:

- Interface sketch with invariants and error modes.
- Example caller usage.
- What the implementation hides behind the seam.
- Dependency and adapter strategy.
- Trade-offs in leverage, locality, testability, and rollback.
