import { describe, expect, it } from "vitest";
import { validateLifecycleAcceptanceCoverage } from "./lifecycle-intent.js";
import { CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS } from "./lifecycle-intent-types.js";
import { completeAcceptanceCoverage } from "./lifecycle-intent-test-fixtures.js";

describe("validateLifecycleAcceptanceCoverage", () => {
	it("accepts coverage for every mechanically checkable acceptance ID", () => {
		expect(
			validateLifecycleAcceptanceCoverage({
				mechanicalAcceptanceIds: [...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS],
				baselineMechanicalAcceptanceIds: [
					...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS,
				],
				coverage: completeAcceptanceCoverage(),
			}),
		).toEqual({ valid: true, errors: [] });
	});

	it("fails when a mechanically checkable acceptance ID is uncovered", () => {
		const result = validateLifecycleAcceptanceCoverage({
			mechanicalAcceptanceIds: [...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS],
			coverage: completeAcceptanceCoverage().filter(
				({ acceptanceId }) => acceptanceId !== "SA-018",
			),
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "acceptance coverage missing SA-018",
				path: "coverage",
			}),
		);
	});

	it("fails denominator drift against the frozen baseline", () => {
		const result = validateLifecycleAcceptanceCoverage({
			mechanicalAcceptanceIds: [
				...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS,
				"SA-999",
			],
			baselineMechanicalAcceptanceIds: [
				...CODEX_RUNTIME_EVIDENCE_ACCEPTANCE_IDS,
			],
			coverage: [
				...completeAcceptanceCoverage(),
				{
					acceptanceId: "SA-999",
					proofKind: "test",
					ref: "src/lib/plan-gate/lifecycle-intent-extra.test.ts",
				},
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "mechanicalAcceptanceIds",
			}),
		);
	});
});
