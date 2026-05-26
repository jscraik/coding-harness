import { describe, expect, it } from "vitest";
import { validateLifecycleImplementationIntent } from "./lifecycle-intent.js";
import {
	validLifecycleIntent,
	validReviewReceipt,
} from "./lifecycle-intent-test-fixtures.js";

describe("validateLifecycleImplementationIntent", () => {
	it("accepts a reviewed intent bound to a passing review receipt", () => {
		expect(
			validateLifecycleImplementationIntent(validLifecycleIntent(), {
				requireReviewed: true,
				reviewReceipt: validReviewReceipt(),
			}),
		).toEqual({ valid: true, errors: [] });
	});

	it("fails missing required lifecycle fields", () => {
		const intent = validLifecycleIntent();
		delete intent.objective;
		delete intent.ownedAcceptanceIds;
		delete intent.deepModuleBoundary;
		delete intent.automationPlan;
		delete intent.reviewReceiptRef;
		delete intent.baselineRef;
		delete intent.linearIssue;
		delete intent.reviewedAt;

		const result = validateLifecycleImplementationIntent(intent, {
			requireReviewed: true,
		});

		expect(result.valid).toBe(false);
		expect(result.errors.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				"objective",
				"ownedAcceptanceIds",
				"deepModuleBoundary",
				"automationPlan",
				"reviewReceiptRef",
				"baselineRef",
				"linearIssue",
				"reviewedAt",
			]),
		);
	});

	it("fails a receipt reused from a different reviewed intent digest", () => {
		const receipt = validReviewReceipt();
		receipt.intentSha256 = "d".repeat(64);

		const result = validateLifecycleImplementationIntent(
			validLifecycleIntent(),
			{
				requireReviewed: true,
				reviewReceipt: receipt,
			},
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "reviewReceipt.intentSha256",
			}),
		);
	});

	it("fails when required reviewer artifacts are absent from the receipt", () => {
		const receipt = validReviewReceipt();
		receipt.reviewerArtifacts = [
			{
				role: "adversarial-reviewer",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-adversarial.md",
				status: "pass",
			},
		];

		const result = validateLifecycleImplementationIntent(
			validLifecycleIntent(),
			{
				requireReviewed: true,
				reviewReceipt: receipt,
			},
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: expect.stringContaining("agent-native-reviewer"),
			}),
		);
	});

	it("fails when required reviewer roles and refs are only satisfied separately", () => {
		const receipt = validReviewReceipt();
		receipt.reviewerArtifacts = [
			{
				role: "adversarial-reviewer",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-agent-native.md",
				status: "pass",
			},
			{
				role: "agent-native-reviewer",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-adversarial.md",
				status: "pass",
			},
			{
				role: "best-practices-researcher",
				ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-best-practices.md",
				status: "pass",
			},
		];

		const result = validateLifecycleImplementationIntent(
			validLifecycleIntent(),
			{
				requireReviewed: true,
				reviewReceipt: receipt,
			},
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: expect.stringContaining(
					"exactly one passing artifact for adversarial-reviewer",
				),
			}),
		);
	});

	it("fails when duplicate reviewer artifact rows create ambiguous evidence", () => {
		const receipt = validReviewReceipt();
		if (Array.isArray(receipt.reviewerArtifacts)) {
			receipt.reviewerArtifacts = [
				...receipt.reviewerArtifacts,
				{
					role: "adversarial-reviewer",
					ref: "artifacts/reviews/codex-runtime-evidence-pu-000-plan-gate-adversarial.md",
					status: "fail",
				},
			];
		}

		const result = validateLifecycleImplementationIntent(
			validLifecycleIntent(),
			{
				requireReviewed: true,
				reviewReceipt: receipt,
			},
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: expect.stringContaining(
					"exactly one passing artifact for adversarial-reviewer",
				),
			}),
		);
	});

	it("fails when receipt evidence use is not admitted by the intent", () => {
		const intent = validLifecycleIntent();
		if (
			typeof intent.reviewReceiptRequirements === "object" &&
			intent.reviewReceiptRequirements !== null
		) {
			intent.reviewReceiptRequirements = {
				...intent.reviewReceiptRequirements,
				allowedEvidenceUse: ["claim_support"],
			};
		}
		const receipt = validReviewReceipt();
		receipt.evidenceUse = "audit_trail";

		const result = validateLifecycleImplementationIntent(intent, {
			requireReviewed: true,
			reviewReceipt: receipt,
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "reviewReceipt.evidenceUse",
			}),
		);
	});
});
