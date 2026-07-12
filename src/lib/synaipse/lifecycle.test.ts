import { describe, expect, it } from "vitest";
import {
	isSynaipseVitalDecision,
	validateSynaipseImprovementCase,
	validateSynaipseTransition,
} from "./lifecycle.js";

const validTransition = {
	schemaVersion: "synaipse-transition/v1",
	runtimeStatus: "not_yet_emitted",
	fromStage: "shape",
	toStage: "admit",
	repository: { name: "jscraik/coding-harness", sha: "a".repeat(40) },
	evidence: { admitted: ["plan:synaipse-v1"], rejected: [] },
	policy: "standing_authority",
	authority: { owner: "codex", standing: true },
	blockers: [],
	waivers: [],
	decidedAt: "2026-07-12T15:00:00Z",
	recovery: null,
} as const;

const validImprovementCase = {
	schemaVersion: "synaipse-improvement-case/v1",
	runtimeStatus: "not_yet_emitted",
	repository: { name: "jscraik/coding-harness", sha: "a".repeat(40) },
	observedAt: "2026-07-12T15:00:00Z",
	observation: "The transition route required a durable current-SHA guard.",
	classification: "systemic",
	siblingInventory: {
		searched: ["src/lib/synaipse"],
		changed: ["src/lib/synaipse/lifecycle.ts"],
		left: ["src/lib/synaipse/state.ts"],
		deferred: ["downstream adoption canary"],
	},
	candidates: [
		{
			disposition: "change",
			rationale: "Add a typed transition validator.",
			rollback: "Revert the additive lifecycle contract.",
		},
		{
			disposition: "delete",
			rationale: "Delete only after a replacement canary proves parity.",
			rollback: "Restore the retained compatibility surface.",
		},
	],
	selectedMechanism: {
		disposition: "change",
		rationale: "It is the smallest guardrail.",
	},
	canary: {
		command: "pnpm vitest run src/lib/synaipse/lifecycle.test.ts",
		expected: "valid and stale-SHA cases are deterministic",
	},
	measurement: { metric: "stale transition rejection", target: "100%" },
	disposition: "change",
	owner: "coding-harness-maintainers",
	retirementCondition:
		"Retire when the lifecycle contract is replaced by a canonical adapter.",
} as const;
const currentSha = validTransition.repository.sha;

describe("validateSynaipseTransition", () => {
	it("accepts a current-SHA standing-authority transition", () => {
		expect(
			validateSynaipseTransition(
				validTransition,
				validTransition.repository.sha,
			),
		).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects a stale current-SHA binding", () => {
		const result = validateSynaipseTransition(validTransition, "b".repeat(40));

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "repository.sha",
			message: "must match the current repository SHA",
		});
	});

	it("enforces the not-yet-emitted runtime status", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				runtimeStatus: "emitted",
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "runtimeStatus",
			message: "must be not_yet_emitted",
		});
	});

	it("allows only the canonical forward stage transition", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				fromStage: "shape",
				toStage: "review",
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors.some((error) => error.path === "toStage")).toBe(true);
	});

	it("closes the lifecycle loop from Improve back to Shape", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				fromStage: "improve",
				toStage: "shape",
			},
			currentSha,
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("requires the Vital Decision Gate for operator-owned transitions", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				policy: "vital_decision_gate",
				authority: { owner: "operator", standing: false },
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors.some((error) => error.path === "blockers")).toBe(true);
	});

	it("rejects an expired waiver", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				waivers: [{ id: "waiver-1", expiresAt: "2026-07-11T15:00:00Z" }],
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(
			result.errors.some((error) => error.path === "waivers[0].expiresAt"),
		).toBe(true);
	});

	it("requires a recovery route when a transition is blocked", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				fromStage: "review",
				toStage: "build",
				blockers: ["independent_qa_rejected"],
				recovery: {
					stage: "build",
					action: "Return to Build and repair the finding.",
				},
			},
			currentSha,
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("requires admitted review evidence before integration", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				fromStage: "review",
				toStage: "integrate",
				evidence: { admitted: [], rejected: [] },
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "evidence.admitted",
			message: "review -> integrate requires admitted review evidence",
		});
	});

	it("requires structured current-SHA integration evidence", () => {
		const result = validateSynaipseTransition(
			{
				...validTransition,
				fromStage: "review",
				toStage: "integrate",
				evidence: {
					admitted: ["coderabbit:current-sha", "qa:independent"],
					rejected: [],
				},
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "evidence.integration",
			message:
				"review -> integrate requires structured PR, checks, signoff, merge, and main-sync evidence",
		});

		const complete = validateSynaipseTransition(
			{
				...validTransition,
				fromStage: "review",
				toStage: "integrate",
				evidence: {
					admitted: ["coderabbit:current-sha", "qa:independent"],
					rejected: [],
					integration: {
						prSha: currentSha,
						checksSha: currentSha,
						signoff: "standing-authority:codex",
						observedMerge: true,
						mainSyncSha: "b".repeat(40),
						mainSyncRef: "origin/main",
						mainSyncSource: "hosted-main-sync",
					},
				},
			},
			currentSha,
		);
		expect(complete).toEqual({ valid: true, errors: [] });
	});

	it("interrupts only at the Vital Decision Gate", () => {
		expect(isSynaipseVitalDecision(validTransition, currentSha)).toBe(false);
		expect(
			isSynaipseVitalDecision(
				{
					...validTransition,
					policy: "vital_decision_gate",
					authority: { owner: "operator", standing: false },
					blockers: ["public_compatibility_change"],
					recovery: { stage: "admit", action: "Wait for operator decision." },
				},
				currentSha,
			),
		).toBe(true);
		expect(
			isSynaipseVitalDecision(
				{
					policy: "vital_decision_gate",
					authority: { owner: "operator", standing: false },
					blockers: ["malformed"],
				},
				currentSha,
			),
		).toBe(false);
	});
});

describe("validateSynaipseImprovementCase", () => {
	it("accepts a classified improvement case with deletion as a candidate", () => {
		expect(
			validateSynaipseImprovementCase(validImprovementCase, currentSha),
		).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("rejects a stale improvement-case SHA", () => {
		const result = validateSynaipseImprovementCase(
			validImprovementCase,
			"b".repeat(40),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "repository.sha",
			message: "must match the current repository SHA",
		});
	});

	it("rejects a selected mechanism that is absent from the candidate inventory", () => {
		const result = validateSynaipseImprovementCase(
			{
				...validImprovementCase,
				selectedMechanism: { disposition: "retain", rationale: "No change." },
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "selectedMechanism.disposition",
			message: "must be represented in candidates",
		});
	});

	it("enforces the not-yet-emitted runtime status", () => {
		const result = validateSynaipseImprovementCase(
			{
				...validImprovementCase,
				runtimeStatus: "emitted",
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({
			path: "runtimeStatus",
			message: "must be not_yet_emitted",
		});
	});

	it("rejects a malformed sibling inventory", () => {
		const result = validateSynaipseImprovementCase(
			{
				...validImprovementCase,
				siblingInventory: {
					...validImprovementCase.siblingInventory,
					searched: [],
				},
			},
			currentSha,
		);

		expect(result.valid).toBe(false);
		expect(
			result.errors.some((error) => error.path === "siblingInventory.searched"),
		).toBe(true);
	});
});
