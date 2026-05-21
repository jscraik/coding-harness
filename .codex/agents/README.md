# Coding Harness Agent Roles

## Table of Contents
- [Scope](#scope)
- [Harness Roles First](#harness-roles-first)
- [Harness Toolsmith](#harness-toolsmith)
- [Runtime Discovery](#runtime-discovery)
- [Runtime Freshness](#runtime-freshness)
- [Role Inventory](#role-inventory)
- [Validation](#validation)
- [Non-Runtime Surfaces](#non-runtime-surfaces)

## Scope
These Codex subagent roles are owned by the coding-harness repository. They are
not global user roles and should not be registered from `~/dev/configs/codex`
unless an explicit cross-project promotion decision is made.

## Harness Roles First
For coding-harness review work, use these project-local harness roles before
generic or global reviewers. They encode this repository's review categories,
skill routes, and read-only posture, so they are the first-choice subagents for
repo-local review coverage.

Invoke them with `spawn_agent(agent_type="<role>")` from a thread rooted in
this checkout, for example:

```text
spawn_agent(agent_type="harness-product-code-reviewer")
```

## Harness Toolsmith
Use `harness-toolsmith` when a recurring agent struggle, reviewer finding, or
validation gap should become a Codex-usable harness primitive rather than more
prose. Toolsmith is the capability-building role: it may make scoped
workspace-write changes to add or improve CLI commands, validators, guard
scripts, generated environment actions, eval fixtures, and agent-facing
workflow tools.

Invoke it from this checkout with:

```text
spawn_agent(agent_type="harness-toolsmith")
```

Keep the handoff specific: name the friction or missing invariant, the likely
tool surface, and the validation command that should prove the improvement.

## Runtime Discovery
Codex discovers trusted project-local role files from this directory:

```text
.codex/agents/<role>/<role>.toml
```

When this repository is trusted in the active Codex config, a fresh thread started in
this checkout after these files exist can use these roles through
`spawn_agent(agent_type=...)`. Other projects should not see these roles unless
they carry their own project-local copies or a deliberate global registration.

A local `.codex/config.toml` is not required for this role inventory. Use one
only when this repository needs explicit per-role config entries that cannot be
represented by the discovered TOML files.

## Runtime Freshness
Project-local role discovery is runtime state, not proof that an already-open
Codex thread has hot-loaded newly added roles. If `spawn_agent` returns
`unknown agent_type`, treat that as a runtime-freshness blocker: start a fresh
thread rooted in this checkout before relying on the role boundary. Do not
simulate a project-local role with a generic/default agent when the boundary
itself is the thing being enforced.

## Role Inventory
Capability builder:

- `harness-toolsmith`: Codex-usable harness tools, validators, CLI surfaces,
  eval fixtures, and workflow primitives.

Reviewers:

- `harness-product-code-reviewer`: product code and tests.
- `harness-ci-release-reviewer`: CI configuration and release tooling.
- `harness-dev-tools-reviewer`: internal developer tools.
- `harness-doc-history-reviewer`: documentation and design history.
- `harness-evaluation-reviewer`: evaluation harnesses.
- `harness-review-response-auditor`: review comments and responses.
- `harness-repository-automation-reviewer`: repository-management scripts.
- `harness-dashboard-definition-reviewer`: production dashboard definitions.

## Validation

`pnpm codex:agents:guard` validates this inventory and is part of `pnpm lint`,
so `bash scripts/validate-codestyle.sh --fast` also proves the role files are
present, project-local, and on the expected `gpt-5.4-mini` posture. Reviewer
roles stay read-only; `harness-toolsmith` is the only workspace-write
capability-building role in this inventory. The guard also enforces trimmed,
unique, ASCII-only harness-themed `nickname_candidates` for every role. The
guard proves repo inventory and documentation consistency; it does not prove the active session runtime registry.

## Non-Runtime Surfaces
`.agents/skills/**/agents/openai.yaml` files describe skill or plugin
interfaces. They do not register Codex `spawn_agent` roles.

`.agents/roles` is not a validated Codex runtime discovery surface in the
current checked source. Do not depend on it for these reviewers until Codex
source and runtime tests explicitly support it.
