import { describe, expect, it } from "vitest";
import {
	HARNESS_DECISION_SCHEMA_VERSION,
	buildHarnessDecision,
	type HarnessDecision,
	isHarnessDecision,
	validateHarnessDecision,
	validateHarnessDecisionOperationalMeta,
} from "./harness-decision.js";
import type { SynaipseContextFailureEnvelope } from "../synaipse/context-failures.js";

function errorCodes(result: { errors: { code: string }[] }): string[] {
	return result.errors.map((error) => error.code);
}

function validDecision(
	overrides: Partial<HarnessDecision> = {},
): HarnessDecision {
	return {
		schemaVersion: HARNESS_DECISION_SCHEMA_VERSION,
		producer: "next",
		status: "action_required",
		summary: "Review-gate behavior changed and needs focused tests.",
		nextAction: "Run the focused review-gate tests before broader validation.",
		nextCommand: "pnpm vitest run src/commands/review-gate.test.ts",
		phase: "review",
		cockpitLane: "review",
		objective: "Run focused review-gate tests before broader validation.",
		requiredEvidence: ["git:changed-files", "harness.contract.json"],
		stopConditions: [],
		humanEscalation: null,
		followUpCommands: ["bash scripts/validate-codestyle.sh --fast"],
		hiddenPlumbing: [],
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		evidenceRef: ["git:changed-files", "harness.contract.json"],
		failureClass: null,
		retry: "safe",
		riskTier: "medium",
		meta: {
			changedFiles: ["src/commands/review-gate.ts"],
			alternatives: ["bash scripts/validate-codestyle.sh --fast"],
		},
		...overrides,
	};
}

describe("validateHarnessDecision", () => {
	it("rejects non-object candidates", () => {
		const nullResult = validateHarnessDecision(null);
		const arrayResult = validateHarnessDecision(["not", "a", "decision"]);

		expect(nullResult.valid).toBe(false);
		expect(errorCodes(nullResult)).toEqual(["decision must be an object"]);
		expect(arrayResult.valid).toBe(false);
		expect(errorCodes(arrayResult)).toEqual(["decision must be an object"]);
	});

	it("accepts a complete harness-decision/v1 fixture", () => {
		const result = validateHarnessDecision(validDecision());

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("accepts legacy harness-decision/v1 packets without cockpitLane", () => {
		const { cockpitLane: _cockpitLane, ...legacyDecision } = validDecision();

		const result = validateHarnessDecision(legacyDecision);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("keeps context failure diagnostics additive across producer and reader versions", () => {
		const legacyProducer = validDecision();
		expect(validateHarnessDecision(legacyProducer)).toEqual({
			valid: true,
			errors: [],
		});

		const envelope: SynaipseContextFailureEnvelope = {
			schemaVersion: "synaipse-context-failure-envelope/v1",
			failures: [
				{
					code: "provider_unavailable",
					requirement: "optional",
					contextId: "ch_context_7K4M2P9QX3DR",
					recovery: "restore_context_provider",
					owner: "synaipse-context-plane",
					stopCondition: "Stop until provider_unavailable is resolved.",
					evidenceRefs: ["context:ch_context_7K4M2P9QX3DR"],
					freshness: {
						status: "current",
						observedAt: "2026-07-20T00:00:00Z",
					},
				},
			],
		};
		const newProducer = validDecision({
			meta: { ...legacyProducer.meta, synaipseContextFailures: envelope },
		});
		expect(validateHarnessDecision(newProducer)).toEqual({
			valid: true,
			errors: [],
		});

		const oldReaderView = {
			...newProducer,
			meta: { changedFiles: ["src/commands/review-gate.ts"] },
		};
		expect(validateHarnessDecision(oldReaderView)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("narrows valid decisions with the type guard", () => {
		const candidate: unknown = validDecision({ status: "pass" });

		expect(isHarnessDecision(candidate)).toBe(true);
		if (isHarnessDecision(candidate)) {
			expect(candidate.schemaVersion).toBe(HARNESS_DECISION_SCHEMA_VERSION);
			expect(candidate.status).toBe("pass");
		}
	});

	it("rejects unsupported schema versions and statuses", () => {
		const candidate = {
			...validDecision(),
			schemaVersion: "harness-decision/v2",
			status: "warn",
		};

		const result = validateHarnessDecision(candidate);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"schemaVersion must be harness-decision/v1",
		);
		expect(errorCodes(result)).toContain(
			"status must be pass, fail, blocked, or action_required",
		);
	});

	it("rejects unsupported retry, risk tier, and metadata values", () => {
		const candidate = {
			...validDecision(),
			retry: "later",
			riskTier: "severe",
			meta: [],
		};

		const result = validateHarnessDecision(candidate);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"retry must be safe, conditional, or manual",
				"riskTier must be low, medium, high, critical, or unknown",
				"meta must be an object when present",
			]),
		);
	});

	it("requires evidence and safety booleans for agent routing", () => {
		const candidate = {
			...validDecision(),
			evidenceRef: [" "],
			requiredEvidence: [" "],
			followUpCommands: [" "],
			safeToRun: "yes",
			requiresHuman: "no",
		};

		const result = validateHarnessDecision(candidate);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"evidenceRef must be a non-empty string array",
				"requiredEvidence entries must be non-empty strings",
				"followUpCommands entries must be non-empty strings",
				"safeToRun must be a boolean",
				"requiresHuman must be a boolean",
			]),
		);
	});

	it("requires a valid work packet shape", () => {
		const result = validateHarnessDecision({
			...validDecision(),
			phase: "wander",
			cockpitLane: "meander",
			objective: "",
			stopConditions: "none",
			humanEscalation: "",
			hiddenPlumbing: [""],
		});

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"phase must be one of orient, verify, review, repair, handoff",
				"cockpitLane must be one of orient, prove, repair, review, handoff",
				"objective must be a non-empty string",
				"stopConditions must be a string array",
				"humanEscalation must be a non-empty string or null",
				"hiddenPlumbing entries must be non-empty strings",
			]),
		);
	});

	it("accepts blocked decisions without a next command", () => {
		const result = validateHarnessDecision(
			validDecision({
				status: "blocked",
				summary: "Git state could not be inspected.",
				nextAction: "Run harness doctor and retry harness next.",
				nextCommand: null,
				safeToRun: false,
				failureClass: "git_state_unavailable",
				stopConditions: ["Stop until git_state_unavailable is resolved."],
				retry: "manual",
				riskTier: "unknown",
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects blocked decisions without a failure class", () => {
		const result = validateHarnessDecision(
			validDecision({
				status: "blocked",
				nextCommand: null,
				safeToRun: false,
				failureClass: null,
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"failureClass must be set when status is blocked or fail",
		);
	});

	it("rejects contradictory command and safety routing", () => {
		const missingCommand = validateHarnessDecision(
			validDecision({
				nextCommand: null,
				safeToRun: true,
			}),
		);
		const unsafeCommand = validateHarnessDecision(
			validDecision({
				nextCommand: "harness check --json",
				safeToRun: false,
			}),
		);

		expect(errorCodes(missingCommand)).toContain(
			"safeToRun must be false when nextCommand is null",
		);
		expect(errorCodes(unsafeCommand)).toContain(
			"safeToRun must be true when nextCommand is set",
		);
	});

	it("requires stop guidance when no safe next command exists", () => {
		const result = validateHarnessDecision(
			validDecision({
				nextCommand: null,
				safeToRun: false,
				stopConditions: [],
				humanEscalation: null,
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"stopConditions or humanEscalation must explain decisions without nextCommand",
		);
	});

	it("rejects blank optional routing strings", () => {
		const result = validateHarnessDecision(
			validDecision({
				nextCommand: " ",
				failureClass: "",
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"nextCommand must be a non-empty string or null",
				"failureClass must be a non-empty string or null",
			]),
		);
	});

	it("rejects invalid operational metadata on the decision envelope", () => {
		const result = validateHarnessDecision(
			validDecision({
				meta: {
					frictionClass: "mystery",
					delayClass: "normal",
					execution: {
						profile: "read_only",
						startupCost: "low",
						permissionPlan: {
							requiresHuman: false,
							requiresNetwork: false,
							writesFiles: false,
							requiresGitWrite: false,
							filesystemWrite: [],
							commands: ["harness next --json"],
							secrets: [],
						},
					},
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"meta.frictionClass must be one of none, tool_friction, permission_sandbox, repo_state, unclear_instruction, validation_failure, implementation_complexity, external_service",
		);
	});

	it("rejects operational metadata that disagrees with envelope flags", () => {
		const result = validateHarnessDecision(
			validDecision({
				requiresNetwork: true,
				meta: {
					frictionClass: "none",
					delayClass: "normal",
					execution: {
						profile: "read_only",
						startupCost: "low",
						permissionPlan: {
							requiresHuman: false,
							requiresNetwork: false,
							writesFiles: false,
							requiresGitWrite: false,
							filesystemWrite: [],
							commands: ["harness next --json"],
							secrets: [],
						},
					},
				},
			}),
		);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toContain(
			"requiresNetwork must match meta.execution.permissionPlan.requiresNetwork",
		);
	});

	it("rejects malformed recommendation-effects metadata", () => {
		const candidate = {
			...validDecision(),
			meta: {
				frictionClass: "none",
				delayClass: "normal",
				execution: {
					profile: "read_only",
					startupCost: "low",
					permissionPlan: {
						requiresHuman: false,
						requiresNetwork: false,
						writesFiles: false,
						requiresGitWrite: false,
						filesystemWrite: [],
						commands: ["harness next --json"],
						secrets: [],
					},
				},
				recommendationEffects: {
					schemaVersion: "harness-recommendation-effects/v0",
					authority: {
						safeToRun: false,
						requiresHuman: false,
						requiresNetwork: false,
						requiresGitWrite: "no",
					},
					rollbackPosture: "started",
					requiredEvidence: ["other:evidence"],
					retry: "later",
					permissionPlan: {},
				},
			},
		};
		const result = validateHarnessDecision(candidate);

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"meta.recommendationEffects.schemaVersion must be harness-recommendation-effects/v1",
				"safeToRun must match meta.recommendationEffects.authority.safeToRun",
				"meta.recommendationEffects.authority.requiresGitWrite must be a boolean",
				"meta.recommendationEffects.rollbackPosture must be not_started",
				"meta.recommendationEffects.requiredEvidence must match requiredEvidence",
				"meta.recommendationEffects.retry must be safe, conditional, or manual",
				"meta.recommendationEffects.retry must match retry",
				"meta.recommendationEffects.permissionPlan.requiresHuman must be a boolean",
			]),
		);
	});
});

describe("buildHarnessDecision", () => {
	it("fills shared agent context from producer intent", () => {
		const decision = buildHarnessDecision("next", {
			status: "action_required",
			summary: "Review-gate behavior changed and needs focused tests.",
			nextAction: "Run focused validation.",
			nextCommand: "harness validation-plan --files src/index.ts --json",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["input:files"],
			failureClass: null,
			retry: "safe",
			riskTier: "medium",
		});

		expect(decision).toMatchObject({
			schemaVersion: HARNESS_DECISION_SCHEMA_VERSION,
			producer: "next",
			phase: "review",
			cockpitLane: "review",
			objective: "Run focused validation.",
			requiredEvidence: ["input:files"],
			stopConditions: [],
			humanEscalation: null,
			followUpCommands: [],
			hiddenPlumbing: [],
		});
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("infers handoff for passing decisions without an explicit phase", () => {
		const decision = buildHarnessDecision("next", {
			status: "pass",
			summary: "No changed files were detected.",
			nextAction: "Run harness check --json to confirm repo readiness.",
			nextCommand: "harness check --json",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["git:status"],
			failureClass: null,
			retry: "safe",
			riskTier: "low",
		});

		expect(decision.phase).toBe("handoff");
		expect(decision.cockpitLane).toBe("handoff");
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("infers orient for discovery commands without an explicit phase", () => {
		const decision = buildHarnessDecision("next", {
			status: "action_required",
			summary: "Catalog the available harness commands.",
			nextAction: "Inspect command availability.",
			nextCommand: "harness doctor --json",
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["command-catalog"],
			failureClass: null,
			retry: "safe",
			riskTier: "low",
		});

		expect(decision.phase).toBe("orient");
		expect(decision.cockpitLane).toBe("orient");
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("explains blocked decisions without a next command", () => {
		const decision = buildHarnessDecision("next", {
			status: "blocked",
			summary: "Git state could not be inspected.",
			nextAction: "Run harness doctor and retry harness next.",
			nextCommand: null,
			safeToRun: false,
			requiresHuman: true,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["git:status"],
			failureClass: "git_state_unavailable",
			retry: "manual",
			riskTier: "unknown",
		});

		expect(decision.phase).toBe("repair");
		expect(decision.cockpitLane).toBe("repair");
		expect(decision.humanEscalation).toBe(
			"Run harness doctor and retry harness next.",
		);
		expect(decision.stopConditions).toEqual([
			"Stop until git_state_unavailable is resolved.",
		]);
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("treats blocked decisions as repair even when command text names another phase", () => {
		const decision = buildHarnessDecision("next", {
			status: "blocked",
			summary: "Review context is unavailable.",
			nextAction: "Restore review context inputs.",
			nextCommand: "harness review-context --files src/index.ts --json",
			safeToRun: true,
			requiresHuman: true,
			requiresNetwork: false,
			writesFiles: false,
			evidenceRef: ["input:files"],
			failureClass: "review_context_unavailable",
			retry: "manual",
			riskTier: "unknown",
		});

		expect(decision.phase).toBe("repair");
		expect(decision.cockpitLane).toBe("repair");
		expect(decision.humanEscalation).toBe("Restore review context inputs.");
		expect(validateHarnessDecision(decision)).toEqual({
			valid: true,
			errors: [],
		});
	});
});

describe("validateHarnessDecisionOperationalMeta", () => {
	it("accepts friction, delay, execution, and permission metadata", () => {
		const result = validateHarnessDecisionOperationalMeta({
			frictionClass: "repo_state",
			delayClass: "human_needed",
			execution: {
				profile: "read_only",
				startupCost: "low",
				permissionPlan: {
					requiresHuman: true,
					requiresNetwork: false,
					writesFiles: false,
					requiresGitWrite: false,
					filesystemWrite: [],
					commands: ["harness doctor --json"],
					secrets: [],
				},
			},
		});

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects unsupported operational metadata values", () => {
		const result = validateHarnessDecisionOperationalMeta({
			frictionClass: "mystery",
			delayClass: "later",
			execution: {
				profile: "mainframe",
				startupCost: "glacial",
				permissionPlan: {
					requiresHuman: "yes",
					requiresNetwork: false,
					writesFiles: false,
					requiresGitWrite: false,
					filesystemWrite: [""],
					commands: ["harness next --json"],
					secrets: [],
				},
			},
		});

		expect(result.valid).toBe(false);
		expect(errorCodes(result)).toEqual(
			expect.arrayContaining([
				"frictionClass must be one of none, tool_friction, permission_sandbox, repo_state, unclear_instruction, validation_failure, implementation_complexity, external_service",
				"delayClass must be one of normal, waiting_on_command, waiting_on_agent, repeated_failure, human_needed",
				"execution.profile must be one of read_only, local, virtual, container, remote",
				"execution.startupCost must be one of none, low, medium, high",
				"execution.permissionPlan.requiresHuman must be a boolean",
				"execution.permissionPlan.filesystemWrite entries must be non-empty strings",
			]),
		);
	});
});
