import { describe, expect, it } from "vitest";
import { validateLifecycleContractFreeze } from "./lifecycle-intent.js";
import { validContractBaseline } from "./lifecycle-intent-test-fixtures.js";

describe("validateLifecycleContractFreeze", () => {
	it("accepts an unchanged lifecycle contract projection", () => {
		const baseline = validContractBaseline();
		expect(
			validateLifecycleContractFreeze({
				baseline,
				current: structuredClone(baseline),
			}),
		).toEqual({ valid: true, errors: [] });
	});

	it("fails when acceptance IDs drift from the baseline", () => {
		const baseline = validContractBaseline();
		const current = structuredClone(baseline);
		current.acceptanceIds = ["SA-001"];

		const result = validateLifecycleContractFreeze({ baseline, current });

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "acceptanceIds must match baseline",
				path: "acceptanceIds",
			}),
		);
	});

	it("fails when current contract arrays are emptied", () => {
		const baseline = validContractBaseline();
		const current = structuredClone(baseline);
		current.acceptanceIds = [];

		const result = validateLifecycleContractFreeze({ baseline, current });

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "acceptanceIds must match baseline",
				path: "acceptanceIds",
			}),
		);
	});

	it("fails when guarded paths are weakened", () => {
		const baseline = validContractBaseline();
		const current = structuredClone(baseline);
		current.guardedPathGlobs = ["src/lib/runtime/**"];

		const result = validateLifecycleContractFreeze({ baseline, current });

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: "guardedPathGlobs must match baseline",
			}),
		);
	});
});
