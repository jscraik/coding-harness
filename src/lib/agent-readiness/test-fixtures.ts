import type { AgentReadinessContextHealth } from "./types.js";

/** Build a passing agent-readiness context for harness next tests. */
export function passingAgentReadinessContext(): AgentReadinessContextHealth {
	return {
		schemaVersion: "agent-readiness-context-health/v1",
		status: "pass",
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
				status: "pass",
				evidenceUse: "orientation",
				evidence: [
					"artifacts/context-integrity/prompt-context-drift-report.json",
				],
				staleReasons: [],
				suggestedRefreshCommands: [],
			},
		],
		suggestedRefreshCommands: [],
	};
}
