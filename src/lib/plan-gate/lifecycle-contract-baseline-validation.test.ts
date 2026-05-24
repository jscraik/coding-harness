import { describe, expect, it } from "vitest";
import { validateLifecycleContractBaseline } from "./lifecycle-intent.js";
import { validContractBaseline } from "./lifecycle-intent-test-fixtures.js";

describe("validateLifecycleContractBaseline", () => {
	it("accepts a complete PU-000 contract baseline", () => {
		expect(validateLifecycleContractBaseline(validContractBaseline())).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("fails when baseline source artifacts are missing", () => {
		const baseline = validContractBaseline();
		delete baseline.sourceArtifacts;

		const result = validateLifecycleContractBaseline(baseline);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "sourceArtifacts",
			}),
		);
	});

	it("fails when the unknown runtime path policy is absent", () => {
		const baseline = validContractBaseline();
		delete baseline.unknownRuntimePathPolicy;

		const result = validateLifecycleContractBaseline(baseline);

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "unknownRuntimePathPolicy",
			}),
		);
	});
});
