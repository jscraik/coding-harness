import { describe, expect, it } from "vitest";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import { runHarnessNext } from "./next.js";

const PROMPT_CONTEXT_DRIFT_COMMAND =
	"node scripts/write-prompt-context-drift-report.cjs --repo-root .";

function promptContextDriftWarnContext(): AgentReadinessContextHealth {
	return {
		schemaVersion: "agent-readiness-context-health/v1",
		status: "warn",
		evidenceUse: "orientation",
		canonicalReport: {
			schemaVersion: "context-health-report/v1",
			command: "node --import tsx src/cli.ts context-health --json",
			available: true,
			prerequisiteStatus: "pass",
			prerequisiteEvidence: ["harness.contract.json"],
		},
		surfaces: [
			{
				id: "prompt_context_drift",
				status: "warn",
				evidenceUse: "orientation",
				evidence: [
					"artifacts/context-integrity/prompt-context-drift-report.json",
				],
				staleReasons: [
					"Prompt-context-drift report failed validation: digest mismatch.",
				],
				suggestedRefreshCommands: [PROMPT_CONTEXT_DRIFT_COMMAND],
			},
		],
		suggestedRefreshCommands: [PROMPT_CONTEXT_DRIFT_COMMAND],
	};
}

describe("harness next agent-facing parity", () => {
	it("promotes stale prompt-context drift before clean-worktree handoff", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			agentReadinessContext: promptContextDriftWarnContext(),
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextCommand).toBe(PROMPT_CONTEXT_DRIFT_COMMAND);
		expect(decision.phase).toBe("orient");
		expect(decision.followUpCommands).toEqual([
			"node scripts/validate-prompt-context-drift.cjs artifacts/context-integrity/prompt-context-drift-report.json --repo-root .",
			"harness check --json",
		]);
		expect(decision.writesFiles).toBe(true);
		expect(decision.requiredEvidence).toEqual([
			"git:status",
			"artifacts/context-integrity/prompt-context-drift-report.json",
		]);
		expect(decision.meta).toMatchObject({
			frictionClass: "repo_state",
			execution: {
				permissionPlan: { commands: [PROMPT_CONTEXT_DRIFT_COMMAND] },
			},
			agentReadinessContext: {
				status: "warn",
				degradedSurfaceCount: 1,
			},
		});
	});
});
