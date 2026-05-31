## Agent-Native Architecture Review

### Summary
Reviewed the scoped changes in `src/commands/pr-closeout/git-branch.ts` and `src/commands/pr-closeout.test.ts` for the remote-base fallback collision issue. The new fallback logic now matches remote refs by exact branch name segment (after the remote prefix) rather than suffix, which prevents false implementation-safe classification from unrelated refs like `refs/remotes/upstream/release/main` when PR `baseRefName` is `main`.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Evaluate live branch drift against PR base | src/commands/pr-closeout/git-branch.ts:74 | `inspectGitBranch` | n/a (internal command path) | Must have | Covered |
| Fallback to alternative remote base when origin base ref missing | src/commands/pr-closeout/git-branch.ts:22 | `remoteBaseRefs` + `inspectGitBranch` | n/a | Must have | Covered |
| Reject suffix-only remote refs (collision guard) | src/commands/pr-closeout.test.ts:1592 | Regression test in closeout CLI suite | n/a | Must have | Covered |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Regression scope is appropriate and not overfit** -- `src/commands/pr-closeout.test.ts:1592` -- The test injects a realistic conflicting ref (`refs/remotes/upstream/release/main`), asserts the command still probes `origin/main`, and asserts it does not probe the conflicting ref. This is the minimal behavioral assertion for the bug class and avoids coupling to implementation internals beyond the externally observable git calls.

### What's Working Well
- The fallback selector now derives `branchName` by stripping only the first remote segment and requiring exact equality with `baseRefName`, which directly addresses suffix collision risk (`src/commands/pr-closeout/git-branch.ts:41-46`).
- The test suite includes both positive fallback behavior (`upstream/main` accepted) and negative collision behavior (`upstream/release/main` rejected), giving good guard coverage against regressions (`src/commands/pr-closeout.test.ts:1500`, `src/commands/pr-closeout.test.ts:1592`).

### Score
- **3/3 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

WROTE: artifacts/reviews/pr-322-base-drift-collision-recheck-agent-native.md
