import { describe, expect, it } from "vitest";
import {
	HARNESS_DECISION_SCHEMA_VERSION,
	type HarnessDecision,
	isHarnessDecision,
	validateHarnessDecision,
} from "./harness-decision.js";

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
		expect(validateHarnessDecision(null)).toEqual({
			valid: false,
			errors: ["decision must be an object"],
		});
		expect(validateHarnessDecision(["not", "a", "decision"])).toEqual({
			valid: false,
			errors: ["decision must be an object"],
		});
	});

	it("accepts a complete harness-decision/v1 fixture", () => {
		const result = validateHarnessDecision(validDecision());

		expect(result).toEqual({ valid: true, errors: [] });
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
		expect(result.errors).toContain(
			"schemaVersion must be harness-decision/v1",
		);
		expect(result.errors).toContain(
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
		expect(result.errors).toEqual(
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
			safeToRun: "yes",
			requiresHuman: "no",
		};

		const result = validateHarnessDecision(candidate);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"evidenceRef must be a non-empty string array",
				"safeToRun must be a boolean",
				"requiresHuman must be a boolean",
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
				retry: "manual",
				riskTier: "unknown",
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects blank optional routing strings", () => {
		const result = validateHarnessDecision(
			validDecision({
				nextCommand: " ",
				failureClass: "",
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				"nextCommand must be a non-empty string or null",
				"failureClass must be a non-empty string or null",
			]),
		);
	});
});
