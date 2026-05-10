import { describe, expect, it } from "vitest";
import {
	classifyClosureEvidence,
	type ClosureEvidenceRecord,
} from "./closure-evidence.js";

const HEAD_SHA = "e18ba04d4aeea854d0d14c3b46f724f8a770a6fb";
const MERGE_SHA = "a681d04f2fe0b1c29164b99fa7d6d8ed025a2a49";

function acceptedMergedRecord(
	overrides: Partial<ClosureEvidenceRecord> = {},
): ClosureEvidenceRecord {
	return {
		id: "jsc-290-merged-linear-stale",
		scope: "selected",
		linear: {
			issueKey: "JSC-290",
			available: true,
			status: "in_progress",
		},
		pullRequest: {
			number: 232,
			state: "merged",
			isDraft: false,
			headSha: HEAD_SHA,
			mergeSha: MERGE_SHA,
		},
		requiredChecks: [
			{
				name: "pr-pipeline",
				provider: "circleci",
				status: "completed",
				conclusion: "success",
				checkedSha: MERGE_SHA,
			},
			{
				name: "security-scan",
				provider: "circleci",
				status: "completed",
				conclusion: "success",
				checkedSha: MERGE_SHA,
			},
		],
		evalArtifact: {
			path: ".harness/evals/coding-harness-validation-typed-gate-specs-eval.md",
			present: true,
			valid: true,
		},
		review: {
			humanAcceptanceRequired: false,
			humanAccepted: true,
			blockingReviewFinding: false,
		},
		...overrides,
	};
}

describe("classifyClosureEvidence", () => {
	it("classifies merged green work with valid eval and active Linear as stale Linear", () => {
		const result = classifyClosureEvidence(acceptedMergedRecord());

		expect(result.classification).toBe("complete_linear_stale");
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				"pr:merged",
				"checks:passed",
				"eval:valid",
				"linear:active",
			]),
		);
	});

	it("accepts checks tied to either PR head SHA or merge SHA", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "success",
						checkedSha: HEAD_SHA,
					},
				],
			}),
		);

		expect(result.classification).toBe("complete_linear_stale");
	});

	it("classifies open or draft follow-up work with failing required checks as blocked", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				id: "jsc-178-follow-up-failing-check",
				linear: {
					issueKey: "JSC-178",
					available: true,
					status: "in_progress",
				},
				pullRequest: {
					number: 234,
					state: "open",
					isDraft: true,
					headSha: HEAD_SHA,
				},
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "failure",
						checkedSha: HEAD_SHA,
					},
				],
				evalArtifact: {
					path: ".harness/evals/coding-harness-contract-validation-eval.md",
					present: true,
					valid: true,
				},
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
		expect(result.nextAction).toContain("failing, missing, or incomplete");
	});

	it("classifies implementation evidence without a valid eval as blocked", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				evalArtifact: {
					path: ".harness/evals/missing-eval.md",
					present: false,
					valid: false,
				},
			}),
		);

		expect(result.classification).toBe("blocked_missing_eval");
		expect(result.reasons).toEqual(["eval:.harness/evals/missing-eval.md"]);
	});

	it("classifies implementation evidence without an eval record as blocked", () => {
		const { evalArtifact: _evalArtifact, ...record } = acceptedMergedRecord();
		const result = classifyClosureEvidence(record);

		expect(result.classification).toBe("blocked_missing_eval");
		expect(result.reasons).toEqual(["eval:missing"]);
	});

	it("classifies eval-optional merged green work without an eval as stale Linear", () => {
		const { evalArtifact: _evalArtifact, ...record } = acceptedMergedRecord({
			evalRequired: false,
		});
		const result = classifyClosureEvidence(record);

		expect(result.classification).toBe("complete_linear_stale");
		expect(result.reasons).toEqual(
			expect.arrayContaining(["pr:merged", "checks:passed", "linear:active"]),
		);
	});

	it("fails closed when live Linear evidence is unavailable", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				linear: {
					issueKey: "JSC-198",
					available: false,
					status: "todo",
				},
			}),
		);

		expect(result.classification).toBe("needs_human_triage");
		expect(result.reasons).toEqual(["linear:unavailable"]);
	});

	it("fails closed when required check SHA does not match evaluated PR SHA", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "success",
						checkedSha: "ffffffffffffffffffffffffffffffffffffffff",
					},
				],
			}),
		);

		expect(result.classification).toBe("needs_human_triage");
		expect(result.reasons).toEqual(["checks:wrong-sha"]);
	});

	it("uses PR head SHA for check matching when merge SHA is absent", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				pullRequest: {
					number: 233,
					state: "merged",
					isDraft: false,
					headSha: HEAD_SHA,
				},
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "success",
						checkedSha: HEAD_SHA,
					},
				],
			}),
		);

		expect(result.classification).toBe("complete_linear_stale");
	});

	it("classifies incomplete required checks as blocked", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "in_progress",
						conclusion: null,
						checkedSha: MERGE_SHA,
					},
				],
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
		expect(result.nextAction).toContain("incomplete required checks");
	});

	it("classifies skipped required checks as blocked", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "skipped",
						checkedSha: MERGE_SHA,
					},
				],
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
		expect(result.reasons).toEqual(["checks:failing"]);
	});

	it("classifies missing required checks as blocked", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "not_found",
						conclusion: null,
						checkedSha: MERGE_SHA,
					},
				],
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
	});

	it("requires human acceptance when the record says closure is human gated", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				review: {
					humanAcceptanceRequired: true,
					humanAccepted: false,
					blockingReviewFinding: false,
				},
			}),
		);

		expect(result.classification).toBe("needs_human_triage");
		expect(result.reasons).toEqual(["human-acceptance:missing"]);
	});

	it("classifies related umbrella work outside the selected slice as out of scope", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				id: "portfolio-umbrella",
				scope: "umbrella",
			}),
		);

		expect(result.classification).toBe("out_of_scope");
		expect(result.nextAction).toContain("out of the JSC-198 closure queue");
	});

	it("classifies untouched selected intake work as not started", () => {
		const result = classifyClosureEvidence({
			id: "jsc-200-not-started",
			scope: "selected",
			linear: {
				issueKey: "JSC-200",
				available: true,
				status: "todo",
			},
			requiredChecks: [],
			review: {
				humanAcceptanceRequired: false,
				humanAccepted: false,
				blockingReviewFinding: false,
			},
		});

		expect(result.classification).toBe("not_started");
		expect(result.reasons).toEqual(["linear:todo", "implementation:none"]);
	});

	it("keeps todo work with only an absent eval placeholder in not started", () => {
		const result = classifyClosureEvidence({
			id: "jsc-200-not-started-with-eval-placeholder",
			scope: "selected",
			linear: {
				issueKey: "JSC-200",
				available: true,
				status: "todo",
			},
			requiredChecks: [],
			evalArtifact: {
				path: ".harness/evals/coding-harness-jsc-200-eval.md",
				present: false,
				valid: false,
			},
			review: {
				humanAcceptanceRequired: false,
				humanAccepted: false,
				blockingReviewFinding: false,
			},
		});

		expect(result.classification).toBe("not_started");
		expect(result.reasons).toEqual(["linear:todo", "implementation:none"]);
	});

	it("classifies merged checked work on done Linear as acceptance-ready", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				linear: {
					issueKey: "JSC-290",
					available: true,
					status: "done",
				},
			}),
		);

		expect(result.classification).toBe("complete_ready_for_human_acceptance");
	});

	it("classifies blocking independent review evidence before eval or check closure", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				review: {
					humanAcceptanceRequired: false,
					humanAccepted: false,
					blockingReviewFinding: true,
				},
			}),
		);

		expect(result.classification).toBe("blocked_review_gate");
		expect(result.reasons).toEqual(["review:blocking"]);
	});

	it("classifies missing required checks as blocked", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [],
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
		expect(result.reasons).toEqual(["checks:missing"]);
	});

	it("fails closed when a completed required check has no checked SHA", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "success",
					},
				],
			}),
		);

		expect(result.classification).toBe("needs_human_triage");
		expect(result.reasons).toEqual(["checks:wrong-sha"]);
	});

	it("classifies incomplete required checks as failing before SHA triage", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "in_progress",
						conclusion: null,
					},
				],
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
		expect(result.reasons).toEqual(["checks:failing"]);
	});

	it("classifies failed required checks as failing before SHA triage", () => {
		const result = classifyClosureEvidence(
			acceptedMergedRecord({
				requiredChecks: [
					{
						name: "pr-pipeline",
						provider: "circleci",
						status: "completed",
						conclusion: "failure",
						checkedSha: "ffffffffffffffffffffffffffffffffffffffff",
					},
				],
			}),
		);

		expect(result.classification).toBe("blocked_failing_check");
		expect(result.reasons).toEqual(["checks:failing"]);
	});
});
