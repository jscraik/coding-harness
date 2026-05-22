import { describe, expect, it } from "vitest";
import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	type HeEvidenceRef,
	type HeGateExecutionMode,
	type HeGateResult,
	type HeGateStatus,
	type HeValidationError,
} from "./he-phase-exit.js";
import { validateHeGateTrustPolicy } from "./he-gate-trust-policy.js";

const gateLocalEvidence: HeEvidenceRef[] = [
	{
		id: "review",
		kind: "review",
		ref: "artifacts/reviews/he-code-review.md",
		gateLocal: true,
	},
];

function gate(overrides: Partial<HeGateResult> = {}): HeGateResult {
	return {
		schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
		gateId: "he_code_review",
		required: true,
		executionMode: "manual_review",
		status: "pass",
		payload: {
			scopeEvidence: ["git diff"],
			findingsFirst: true,
			traceabilityReviewed: true,
			blockerClassification: true,
			safeToContinueReviewed: true,
		},
		evidenceRefs: gateLocalEvidence,
		findings: [],
		actions: [],
		validation: [],
		requiresHuman: false,
		safeToContinue: true,
		reason: null,
		blockedReason: null,
		...overrides,
	};
}

function errorsFor(
	result: HeGateResult,
	evidenceRefs = result.evidenceRefs,
): HeValidationError[] {
	const errors: HeValidationError[] = [];
	validateHeGateTrustPolicy(result, evidenceRefs, errors);
	return errors;
}

function errorCodes(errors: readonly HeValidationError[]): string[] {
	return errors.map((error) => error.code);
}

describe("validateHeGateTrustPolicy", () => {
	it("accepts executed skill-gate evidence with gate-local proof", () => {
		expect(errorsFor(gate())).toEqual([]);
	});

	it("rejects summary-only evidence for executed and not-applicable gates", () => {
		const summaryOnlyEvidence: HeEvidenceRef[] = [
			{
				id: "route-summary",
				kind: "route-decision",
				ref: "route-decision/v1:summary",
				gateLocal: false,
			},
		];

		expect(errorCodes(errorsFor(gate(), summaryOnlyEvidence))).toContain(
			"pass, fail, and blocked gates require at least one gate-local evidence ref",
		);
		expect(
			errorCodes(
				errorsFor(
					gate({
						executionMode: "not_applicable",
						status: "not_applicable",
						reason: "no failing evidence",
					}),
					summaryOnlyEvidence,
				),
			),
		).toContain(
			"not_applicable gates require at least one gate-local evidence ref",
		);
	});

	it("rejects validation-only and skipped execution modes for executed statuses", () => {
		const invalidModes: HeGateExecutionMode[] = [
			"validation_only",
			"not_applicable",
			"not_run",
		];

		const errors = invalidModes.flatMap((executionMode) =>
			errorCodes(errorsFor(gate({ executionMode }))),
		);

		expect(errors).toContain(
			"validation_only gates cannot satisfy pass, fail, or blocked skill-gate evidence",
		);
		expect(errors).toContain(
			"pass, fail, and blocked gates cannot have not_applicable or not_run executionMode",
		);
	});

	it("requires open findings and blocker reasons for fail and blocked statuses", () => {
		const statuses: HeGateStatus[] = ["fail", "blocked"];
		const errors = statuses.flatMap((status) =>
			errorCodes(errorsFor(gate({ status, safeToContinue: false }))),
		);

		expect(errors).toContain("failed or blocked gates require an open finding");
		expect(errors).toContain("blocked gates require blockedReason");
	});

	it("requires skipped statuses to use matching modes and reasons", () => {
		const errors = errorCodes(
			errorsFor(gate({ status: "not_applicable", reason: null })),
		);

		expect(errors).toContain(
			"not_applicable gates require not_applicable executionMode",
		);
		expect(errors).toContain("not_applicable gates require reason");
		expect(
			errorCodes(errorsFor(gate({ status: "not_run", reason: null }))),
		).toContain("not_run gates require not_run executionMode");
		expect(
			errorCodes(errorsFor(gate({ status: "not_run", reason: null }))),
		).toContain("not_run gates require reason");
	});

	it("rejects findings that reference unknown evidence ids", () => {
		const errors = errorsFor(
			gate({
				findings: [
					{
						id: "finding-1",
						severity: "high",
						status: "open",
						summary: "Missing proof",
						evidenceRef: "missing",
					},
				],
			}),
		);

		expect(errorCodes(errors)).toContain("unknown evidenceRefs.id: missing");
	});
});
