import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	GOAL_COMPLETION_BLOCKED_THRESHOLD,
	buildGoalCompletionAuditReceipt,
	canonicalizeGoalObjectiveText,
	hashGoalObjectiveText,
} from "./goal-completion-audit-receipt.js";
import { validateGoalCompletionAuditReceipt } from "./goal-completion-audit-receipt-validation.js";

const HEAD_SHA = "2aab21806a744a61075625fe7a4a9d1452a0c672";
const GENERATED_AT = "2026-05-28T00:50:00Z";
const OBJECTIVE_TEXT =
	"Implement the full Codex Runtime Evidence Verifier Cockpit lifecycle.\n";

function validInput(
	overrides: Partial<
		Parameters<typeof buildGoalCompletionAuditReceipt>[0]
	> = {},
): Parameters<typeof buildGoalCompletionAuditReceipt>[0] {
	return {
		generatedAt: GENERATED_AT,
		producer: "harness:goal-completion-audit-receipt",
		headSha: HEAD_SHA,
		objectiveRef:
			"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md#objective",
		objectiveSourcePath:
			"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
		objectivePointer: "#/objective",
		objectiveSourceHeadSha: HEAD_SHA,
		objectiveSourceText: OBJECTIVE_TEXT,
		requirements: [
			{
				id: "SPG-003",
				description: "GoalCompletionAuditReceipt exists before done claims.",
				required: true,
				status: "pass",
				freshness: "current",
				evidenceRefs: ["receipt:R102"],
				blockerRefs: [],
				verdictRef: "delivery-truth:goal-completion",
			},
		],
		blockers: [],
		blockerHistory: [],
		blockerHistoryAvailable: true,
		sourceRefs: [
			"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl#R102",
		],
		...overrides,
	};
}

describe("GoalCompletionAuditReceipt", () => {
	it("accepts the checked-in schema example", () => {
		const example = JSON.parse(
			readFileSync(
				"contracts/examples/goal-completion-audit-receipt.example.json",
				"utf8",
			),
		) as unknown;

		expect(validateGoalCompletionAuditReceipt(example)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("builds a pass verdict only when required requirements are current and no blockers remain", () => {
		const receipt = buildGoalCompletionAuditReceipt(validInput());

		expect(receipt.verdict).toMatchObject({
			status: "pass",
			freshness: "current",
			readyForDoneClaim: true,
			goalStatusRecommendation: "complete",
			blockerCode: null,
		});
		expect(validateGoalCompletionAuditReceipt(receipt)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("keeps CRLF and LF objective text on the same canonical hash", () => {
		expect(canonicalizeGoalObjectiveText("alpha\r\nbeta\rgamma\n")).toBe(
			"alpha\nbeta\ngamma\n",
		);
		expect(hashGoalObjectiveText("alpha\r\nbeta\n")).toBe(
			hashGoalObjectiveText("alpha\nbeta\n"),
		);
	});

	it("blocks when the objective source head drifts from the evaluated head", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				objectiveSourceHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			}),
		);

		expect(receipt.verdict).toMatchObject({
			status: "blocked",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "objective_source_head_mismatch",
		});
		expect(validateGoalCompletionAuditReceipt(receipt).valid).toBe(false);
	});

	it("rejects unsafe objective pointers before supporting a done claim", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				objectiveRef: "docs\\goals\\goal.md#objective",
			}),
		);

		expect(receipt.verdict).toMatchObject({
			status: "unknown",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "missing_objective_identity",
		});
		expect(validateGoalCompletionAuditReceipt(receipt).valid).toBe(false);
	});

	it("blocks stale or non-passing required requirements", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				requirements: [
					{
						id: "SPG-003",
						description: "Receipt implementation remains unproven.",
						required: true,
						status: "pass",
						freshness: "stale",
						evidenceRefs: ["receipt:R102"],
						blockerRefs: ["blocker:stale-validation"],
						verdictRef: null,
					},
				],
			}),
		);

		expect(receipt.verdict).toMatchObject({
			status: "blocked",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "requirement_evidence_not_current",
		});
	});

	it("derives two-turn blockers as continue, not blocked status mutation", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				blockers: [
					{
						id: "blocker:review-thread",
						stableKey: "review-thread:123",
						blockerClass: "needs_jamie_decision",
						owner: "operator",
						nextAction: "Resolve or classify the review thread.",
						evidenceRefs: ["review-state:123"],
						observedAt: GENERATED_AT,
					},
				],
				blockerHistory: [
					{
						stableKey: "review-thread:123",
						observedAt: "2026-05-28T00:40:00Z",
					},
				],
			}),
		);

		expect(receipt.blockers[0]?.consecutiveGoalTurns).toBe(
			GOAL_COMPLETION_BLOCKED_THRESHOLD - 1,
		);
		expect(receipt.verdict).toMatchObject({
			status: "blocked",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "unresolved_blocker",
		});
	});

	it("derives three-turn blockers as blocked recommendation without mutating goal state", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				blockers: [
					{
						id: "blocker:review-thread",
						stableKey: "review-thread:123",
						blockerClass: "needs_jamie_decision",
						owner: "operator",
						nextAction: "Resolve or classify the review thread.",
						evidenceRefs: ["review-state:123"],
						observedAt: GENERATED_AT,
					},
				],
				blockerHistory: [
					{
						stableKey: "review-thread:123",
						observedAt: "2026-05-28T00:30:00Z",
					},
					{
						stableKey: "review-thread:123",
						observedAt: "2026-05-28T00:40:00Z",
					},
				],
			}),
		);

		expect(receipt.blockers[0]?.consecutiveGoalTurns).toBe(
			GOAL_COMPLETION_BLOCKED_THRESHOLD,
		);
		expect(receipt.verdict).toMatchObject({
			status: "blocked",
			readyForDoneClaim: false,
			goalStatusRecommendation: "blocked",
			blockerCode: "repeated_blocker_threshold_met",
		});
	});

	it("fails closed when current blockers exist but blocker history is unavailable", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				blockerHistoryAvailable: false,
				blockers: [
					{
						id: "blocker:missing-history",
						stableKey: "external:linear-unavailable",
						blockerClass: "external_service",
						owner: "external",
						nextAction: "Refresh Linear state with credentialed access.",
						evidenceRefs: ["linear:unknown"],
						observedAt: GENERATED_AT,
					},
				],
			}),
		);

		expect(receipt.verdict).toMatchObject({
			status: "unknown",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "missing_blocker_history",
		});
	});

	it("fails closed when blocker history is unavailable even with no current blocker rows", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				blockerHistoryAvailable: false,
				blockers: [],
			}),
		);

		expect(receipt.verdict).toMatchObject({
			status: "unknown",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "missing_blocker_history",
		});
	});

	it("fails closed when blocker history ordering cannot support recurrence derivation", () => {
		const receipt = buildGoalCompletionAuditReceipt(
			validInput({
				blockers: [
					{
						id: "blocker:review-thread",
						stableKey: "review-thread:123",
						blockerClass: "needs_jamie_decision",
						owner: "operator",
						nextAction: "Resolve or classify the review thread.",
						evidenceRefs: ["review-state:123"],
						observedAt: GENERATED_AT,
					},
				],
				blockerHistory: [
					{
						stableKey: "review-thread:123",
						observedAt: "2026-05-28T00:40:00Z",
					},
					{
						stableKey: "review-thread:123",
						observedAt: "2026-05-28T00:30:00Z",
					},
				],
			}),
		);

		expect(receipt.verdict).toMatchObject({
			status: "unknown",
			readyForDoneClaim: false,
			goalStatusRecommendation: "continue",
			blockerCode: "missing_blocker_history",
		});
	});

	it("rejects receipts that try to support done claims with non-pass verdicts", () => {
		const receipt = buildGoalCompletionAuditReceipt(validInput());
		const result = validateGoalCompletionAuditReceipt({
			...receipt,
			verdict: {
				...receipt.verdict,
				status: "blocked",
				readyForDoneClaim: true,
			},
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "verdict.readyForDoneClaim" }),
		);
	});

	it("rejects unknown verdict blocker codes in both validators", () => {
		const receipt = buildGoalCompletionAuditReceipt(validInput());
		const mutatedReceipt = {
			...receipt,
			verdict: {
				...receipt.verdict,
				blockerCode: "surprise_blocker_code",
			},
		};
		const result = validateGoalCompletionAuditReceipt(mutatedReceipt);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "verdict.blockerCode" }),
		);
		expect(runScriptValidator(mutatedReceipt)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "verdict.blockerCode" }),
			]),
		});
	});

	it("rejects date-only timestamps in both validators", () => {
		const receipt = buildGoalCompletionAuditReceipt(validInput());
		const mutatedReceipt = {
			...receipt,
			generatedAt: "2026-05-28",
		};
		const result = validateGoalCompletionAuditReceipt(mutatedReceipt);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "generatedAt" }),
		);
		expect(runScriptValidator(mutatedReceipt)).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "generatedAt" }),
			]),
		});
	});
});

function runScriptValidator(receipt: unknown): {
	status: "pass" | "fail";
	errors: Array<{ path: string; message: string }>;
} {
	const directory = mkdtempSync(join(tmpdir(), "goal-completion-audit-"));
	const receiptPath = join(directory, "receipt.json");
	try {
		writeFileSync(receiptPath, JSON.stringify(receipt), "utf8");
		try {
			return JSON.parse(
				execFileSync(
					"node",
					["scripts/validate-goal-completion-audit-receipt.cjs", receiptPath],
					{ encoding: "utf8" },
				),
			) as {
				status: "pass" | "fail";
				errors: Array<{ path: string; message: string }>;
			};
		} catch (error) {
			const output =
				error &&
				typeof error === "object" &&
				"stdout" in error &&
				typeof error.stdout === "string"
					? error.stdout
					: "{}";
			return JSON.parse(output) as {
				status: "pass" | "fail";
				errors: Array<{ path: string; message: string }>;
			};
		}
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}
