# Internal Agent Runtime Freshness

## Feedback Signal
Jamie clarified that the dirty `.codex/agents/**` work is intentional internal-agent infrastructure for Codex, not cleanup noise.

## Operational Failure
The repository guard validated the role files, but the active Codex runtime still rejected `spawn_agent(agent_type="harness-toolsmith")` with `unknown agent_type`. The previous docs implied that file presence and `pnpm codex:agents:guard` were enough to prove runtime usability.

## Failure Category
- Runtime ambiguity
- Weak validation wording
- Stale state
- Missing guardrail distinction between repo inventory and active runtime registry

## Durable Change
The internal-agent docs and guard now distinguish:

- `pnpm codex:agents:guard` proves repo inventory, docs, model posture, sandbox posture, and role naming.
- It does not prove the active session runtime registry.
- `unknown agent_type` is a runtime-freshness blocker.
- Agents must start a fresh thread rooted in this checkout before relying on the project-local role boundary.
- A generic/default agent with copied instructions is not an enforced project-local role boundary.

## Validation
- Command: `pnpm codex:agents:guard` -> pass
- Command: `pnpm lint` -> pass

## Next Use
On a fresh Codex session after these files are present, probe `spawn_agent(agent_type="harness-toolsmith")` before assigning capability-builder work. If the probe still returns `unknown agent_type`, treat project-local role discovery as a runtime integration blocker rather than proceeding with simulated role instructions.
