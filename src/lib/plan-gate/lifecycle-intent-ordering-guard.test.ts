import { describe, expect, it } from "vitest";
import { validateLifecycleIntentOrdering } from "./lifecycle-intent.js";
import { validLifecycleIntent } from "./lifecycle-intent-test-fixtures.js";

describe("validateLifecycleIntentOrdering", () => {
	it("allows reviewed intent to unlock guarded implementation paths", () => {
		expect(
			validateLifecycleIntentOrdering({
				intent: validLifecycleIntent(),
				changedFiles: ["src/lib/runtime/codex-runtime-evidence.ts"],
			}),
		).toEqual({ valid: true, errors: [] });
	});

	it("blocks guarded runtime paths before intent review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		const result = validateLifecycleIntentOrdering({
			intent,
			changedFiles: ["src/lib/runtime/codex-runtime-evidence.ts"],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "changedFiles",
			}),
		);
	});

	it("blocks dot-prefixed guarded runtime paths before intent review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		const result = validateLifecycleIntentOrdering({
			intent,
			changedFiles: [
				"./src/lib/runtime/codex-runtime-evidence.ts",
				"././src/lib/runtime/codex-runtime-evidence-adapter.ts",
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "changedFiles",
			}),
		);
	});

	it("blocks parent-segment guarded runtime paths before intent review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		const result = validateLifecycleIntentOrdering({
			intent,
			changedFiles: ["tmp/../src/lib/runtime/codex-runtime-evidence.ts"],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "changedFiles",
			}),
		);
	});

	it("blocks mixed-separator guarded runtime paths before intent review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		const result = validateLifecycleIntentOrdering({
			intent,
			changedFiles: [".\\src\\lib\\runtime\\codex-runtime-evidence.ts"],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "changedFiles",
			}),
		);
	});

	it("blocks absolute guarded runtime paths before intent review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		const result = validateLifecycleIntentOrdering({
			intent,
			changedFiles: [
				"/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence.ts",
			],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				path: "changedFiles",
			}),
		);
	});

	it("fails closed for unknown implementation paths before intent review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		const result = validateLifecycleIntentOrdering({
			intent,
			changedFiles: ["src/lib/new-runtime-shape/adapter.ts"],
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({
				code: expect.stringContaining(
					"blocked until lifecycle intent is reviewed",
				),
			}),
		);
	});

	it("allows in-scope plan-gate lifecycle intent files before review", () => {
		const intent = validLifecycleIntent();
		intent.reviewStatus = "pending";

		expect(
			validateLifecycleIntentOrdering({
				intent,
				changedFiles: [
					"src/lib/plan-gate/lifecycle-intent.ts",
					"src/lib/plan-gate/lifecycle-intent-ordering-guard.test.ts",
				],
			}),
		).toEqual({ valid: true, errors: [] });
	});
});
