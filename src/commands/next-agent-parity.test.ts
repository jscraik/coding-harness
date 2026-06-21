import { describe, expect, it } from "vitest";
import type { AgentReadinessContextHealth } from "../lib/agent-readiness/types.js";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import { runHarnessNext } from "./next.js";

const PROMPT_CONTEXT_DRIFT_COMMAND = "harness prompt-context-drift:write";
const ALTERNATE_PROMPT_CONTEXT_DRIFT_COMMAND =
	"harness prompt-context-drift:write --output .harness/runtime/prompt-context-drift-report.json";
const DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND =
	"rm artifacts/prompt-context-drift-report.json";

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

function promptContextDriftMissingContext(): AgentReadinessContextHealth {
	return {
		...promptContextDriftWarnContext(),
		surfaces: [
			{
				id: "prompt_context_drift",
				status: "warn",
				evidenceUse: "orientation",
				evidence: [
					"missing:artifacts/context-integrity/prompt-context-drift-report.json",
				],
				staleReasons: [
					"No prompt-context-drift report was provided for agent-readable orientation.",
				],
				suggestedRefreshCommands: [PROMPT_CONTEXT_DRIFT_COMMAND],
			},
		],
	};
}

function promptContextDriftAlternateContext(): AgentReadinessContextHealth {
	return {
		...promptContextDriftWarnContext(),
		surfaces: [
			{
				id: "prompt_context_drift",
				status: "warn",
				evidenceUse: "orientation",
				evidence: [".harness/runtime/prompt-context-drift-report.json"],
				staleReasons: [
					"Prompt-context-drift report failed validation: digest mismatch.",
				],
				suggestedRefreshCommands: [ALTERNATE_PROMPT_CONTEXT_DRIFT_COMMAND],
			},
		],
		suggestedRefreshCommands: [ALTERNATE_PROMPT_CONTEXT_DRIFT_COMMAND],
	};
}

function promptContextDriftDuplicateContext(): AgentReadinessContextHealth {
	return {
		...promptContextDriftWarnContext(),
		surfaces: [
			{
				id: "prompt_context_drift",
				status: "warn",
				evidenceUse: "orientation",
				evidence: [
					"artifacts/context-integrity/prompt-context-drift-report.json",
					"artifacts/prompt-context-drift-report.json",
				],
				staleReasons: [
					"Multiple prompt-context-drift reports were discovered.",
				],
				suggestedRefreshCommands: [
					DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND,
				],
			},
		],
		suggestedRefreshCommands: [DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND],
	};
}

function promptContextDriftDuplicateWithoutCanonicalContext(): AgentReadinessContextHealth {
	return {
		...promptContextDriftWarnContext(),
		surfaces: [
			{
				id: "prompt_context_drift",
				status: "warn",
				evidenceUse: "orientation",
				evidence: [
					"artifacts/prompt-context-drift-report.json",
					".harness/runtime/prompt-context-drift-report.json",
				],
				staleReasons: [
					"Multiple prompt-context-drift reports were discovered.",
				],
				suggestedRefreshCommands: [
					DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND,
				],
			},
		],
		suggestedRefreshCommands: [DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND],
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
			"harness prompt-context-drift:validate artifacts/context-integrity/prompt-context-drift-report.json",
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

	it("promotes missing prompt-context drift to the writer command", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			agentReadinessContext: promptContextDriftMissingContext(),
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextCommand).toBe(PROMPT_CONTEXT_DRIFT_COMMAND);
		expect(decision.phase).toBe("orient");
		expect(decision.followUpCommands).toEqual([
			"harness prompt-context-drift:validate artifacts/context-integrity/prompt-context-drift-report.json",
			"harness check --json",
		]);
		expect(decision.requiredEvidence).toEqual([
			"git:status",
			"missing:artifacts/context-integrity/prompt-context-drift-report.json",
		]);
		expect(decision.writesFiles).toBe(true);
	});

	it("keeps alternate prompt-context drift refresh decisions trusted", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			agentReadinessContext: promptContextDriftAlternateContext(),
		});

		expect(decision.status).toBe("action_required");
		expect(decision.nextCommand).toBe(ALTERNATE_PROMPT_CONTEXT_DRIFT_COMMAND);
		expect(decision.safeToRun).toBe(true);
		expect(decision.requiresHuman).toBe(false);
		expect(decision.followUpCommands).toEqual([
			"harness prompt-context-drift:validate .harness/runtime/prompt-context-drift-report.json",
			"harness check --json",
		]);
		expect(decision.meta).toMatchObject({
			execution: {
				permissionPlan: { commands: [ALTERNATE_PROMPT_CONTEXT_DRIFT_COMMAND] },
			},
		});
	});

	it("keeps duplicate prompt-context drift cleanup decisions valid", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			agentReadinessContext: promptContextDriftDuplicateContext(),
		});

		expect(decision.status).toBe("action_required");
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
		expect(decision.nextCommand).toBe(
			DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND,
		);
		expect(decision.safeToRun).toBe(true);
		expect(decision.requiresHuman).toBe(false);
		expect(decision.writesFiles).toBe(true);
		expect(decision.meta).toMatchObject({
			execution: {
				permissionPlan: {
					commands: [DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND],
					writesFiles: true,
				},
			},
		});
	});

	it("validates the surviving prompt-context drift report after cleanup", () => {
		const decision = runHarnessNext({
			inspectChangedFiles: () => [],
			repoRoot: "/tmp/repo",
			agentReadinessContext:
				promptContextDriftDuplicateWithoutCanonicalContext(),
		});

		expect(decision.nextCommand).toBe(
			DUPLICATE_PROMPT_CONTEXT_DRIFT_CLEANUP_COMMAND,
		);
		expect(decision.followUpCommands).toEqual([
			"harness prompt-context-drift:validate .harness/runtime/prompt-context-drift-report.json",
			"harness check --json",
		]);
	});
});
