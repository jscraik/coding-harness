# Coding Harness Agent Roles

## Table of Contents
- [Scope](#scope)
- [Runtime Discovery](#runtime-discovery)
- [Role Inventory](#role-inventory)
- [Non-Runtime Surfaces](#non-runtime-surfaces)

## Scope
These Codex subagent roles are owned by the coding-harness repository. They are
not global user roles and should not be registered from `~/dev/configs/codex`
unless an explicit cross-project promotion decision is made.

## Runtime Discovery
Codex discovers trusted project-local role files from this directory:

```text
.codex/agents/<role>/<role>.toml
```

The repository is trusted in Jamie's Codex config, so a thread started in this
checkout can use these roles through `spawn_agent(agent_type=...)`. Other
projects should not see these roles unless they carry their own project-local
copies or a deliberate global registration.

## Role Inventory
- `harness-product-code-reviewer`: product code and tests.
- `harness-ci-release-reviewer`: CI configuration and release tooling.
- `harness-dev-tools-reviewer`: internal developer tools.
- `harness-doc-history-reviewer`: documentation and design history.
- `harness-evaluation-reviewer`: evaluation harnesses.
- `harness-review-response-auditor`: review comments and responses.
- `harness-repository-automation-reviewer`: repository-management scripts.
- `harness-dashboard-definition-reviewer`: production dashboard definitions.

## Non-Runtime Surfaces
`.agents/skills/**/agents/openai.yaml` files describe skill or plugin
interfaces. They do not register Codex `spawn_agent` roles.

`.agents/roles` is not a validated Codex runtime discovery surface in the
current checked source. Do not depend on it for these reviewers until Codex
source and runtime tests explicitly support it.
