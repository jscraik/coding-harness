import { describe, expect, it } from "vitest";
import {
	type GateBundleConfig,
	type GateBundleInput,
	type GateInput,
	createGateBundle,
	createGateBundleFromResults,
	isBundleReplaySafe,
	validateGateBundle,
} from "./gate-bundle.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const FIXED_TIMESTAMP = "2026-03-21T19:00:00.000Z";

function baseConfig(): GateBundleConfig {
	return { timestamp: FIXED_TIMESTAMP };
}

function passingGate(summary?: string): GateInput {
	return {
		passed: true,
		summary: summary ?? "Gate passed",
		durationMs: 100,
		findings: [],
	};
}

function failingGate(summary?: string): GateInput {
	return {
		passed: false,
		summary: summary ?? "Gate failed",
		durationMs: 50,
		findings: [
			{
				code: "CHECK_FAIL",
				severity: "error",
				message: "A check failed",
			},
		],
	};
}

function allPassingInput(): GateBundleInput {
	return {
		environment: passingGate("Environment OK"),
		policy: passingGate("Policy OK"),
		docs: passingGate("Docs OK"),
		tests: passingGate("Tests OK"),
		review: passingGate("Review OK"),
	};
}

// ─── createGateBundle ───────────────────────────────────────────────────────────

describe("createGateBundle", () => {
	describe("decision logic", () => {
		it("returns pass when all gates pass", () => {
			const bundle = createGateBundle(allPassingInput(), baseConfig());
			expect(bundle.decision).toBe("pass");
			expect(bundle.summary.passed).toBe(5);
			expect(bundle.summary.failed).toBe(0);
		});

		it("returns fail when a required gate fails", () => {
			const input = allPassingInput();
			input.tests = failingGate("Tests failed");
			const bundle = createGateBundle(input, baseConfig());
			expect(bundle.decision).toBe("fail");
			expect(bundle.summary.failed).toBe(1);
		});

		it("returns pass when a non-required gate fails", () => {
			const input = allPassingInput();
			input.docs = failingGate("Docs failed");
			const bundle = createGateBundle(input, {
				...baseConfig(),
				requiredGates: ["environment", "policy", "tests", "review"],
			});
			expect(bundle.decision).toBe("pass");
		});

		it("returns blocked when a required gate is skipped", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				// docs is undefined = skipped
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			expect(bundle.decision).toBe("blocked");
		});

		it("returns pass when a non-required gate is skipped", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				// docs is skipped but not required
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, {
				...baseConfig(),
				requiredGates: ["environment", "policy", "tests", "review"],
			});
			expect(bundle.decision).toBe("pass");
		});

		it("returns fail with multiple required failures", () => {
			const input = allPassingInput();
			input.tests = failingGate();
			input.review = failingGate();
			const bundle = createGateBundle(input, baseConfig());
			expect(bundle.decision).toBe("fail");
			expect(bundle.summary.failed).toBe(2);
		});
	});

	describe("envelope structure", () => {
		it("has correct schema version", () => {
			const bundle = createGateBundle(allPassingInput(), baseConfig());
			expect(bundle.schemaVersion).toBe("gate-bundle/v1");
		});

		it("preserves timestamp", () => {
			const bundle = createGateBundle(allPassingInput(), baseConfig());
			expect(bundle.createdAt).toBe(FIXED_TIMESTAMP);
		});

		it("generates idempotency key", () => {
			const bundle = createGateBundle(allPassingInput(), baseConfig());
			expect(bundle.idempotencyKey).toBeTruthy();
			expect(bundle.idempotencyKey.startsWith("gbk-")).toBe(true);
		});

		it("includes all 5 gates in evaluation order", () => {
			const bundle = createGateBundle(allPassingInput(), baseConfig());
			expect(bundle.gates.length).toBe(5);
			expect(bundle.gates.map((g) => g.category)).toEqual([
				"environment",
				"policy",
				"docs",
				"tests",
				"review",
			]);
		});

		it("marks required gates correctly", () => {
			const config: GateBundleConfig = {
				...baseConfig(),
				requiredGates: ["tests", "review"],
			};
			const bundle = createGateBundle(allPassingInput(), config);
			expect(bundle.gates.find((g) => g.category === "tests")?.required).toBe(
				true,
			);
			expect(bundle.gates.find((g) => g.category === "review")?.required).toBe(
				true,
			);
			expect(bundle.gates.find((g) => g.category === "docs")?.required).toBe(
				false,
			);
		});
	});

	describe("summary statistics", () => {
		it("counts findings correctly", () => {
			const input = allPassingInput();
			input.tests = {
				passed: false,
				findings: [
					{ code: "F1", severity: "error", message: "fail 1" },
					{ code: "F2", severity: "warning", message: "warning 1" },
					{ code: "F3", severity: "info", message: "info 1" },
				],
			};
			const bundle = createGateBundle(input, baseConfig());
			expect(bundle.summary.findingCount).toBe(3);
			expect(bundle.summary.errorCount).toBe(1);
			expect(bundle.summary.warningCount).toBe(1);
		});

		it("sums duration correctly", () => {
			const input: GateBundleInput = {
				environment: { passed: true, durationMs: 100 },
				policy: { passed: true, durationMs: 200 },
				docs: { passed: true, durationMs: 150 },
				tests: { passed: true, durationMs: 300 },
				review: { passed: true, durationMs: 50 },
			};
			const bundle = createGateBundle(input, baseConfig());
			expect(bundle.summary.totalDurationMs).toBe(800);
		});

		it("handles missing durations (-1)", () => {
			const input: GateBundleInput = {
				environment: { passed: true },
				policy: { passed: true, durationMs: 100 },
			};
			const bundle = createGateBundle(input, {
				...baseConfig(),
				requiredGates: ["policy"],
			});
			const envGate = bundle.gates.find((g) => g.category === "environment");
			expect(envGate?.durationMs).toBe(-1);
			// Only policy duration should be counted
			expect(bundle.summary.totalDurationMs).toBe(100);
		});

		it("counts skipped gates", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				// policy, docs, tests, review all skipped
			};
			const bundle = createGateBundle(input, {
				...baseConfig(),
				requiredGates: ["environment"],
			});
			expect(bundle.summary.skipped).toBe(4);
			expect(bundle.summary.passed).toBe(1);
		});
	});

	describe("idempotency", () => {
		it("same inputs produce same idempotency key", () => {
			const input = allPassingInput();
			const a = createGateBundle(input, baseConfig());
			const b = createGateBundle(input, baseConfig());
			expect(a.idempotencyKey).toBe(b.idempotencyKey);
		});

		it("different inputs produce different idempotency keys", () => {
			const a = createGateBundle(allPassingInput(), baseConfig());
			const inputB = allPassingInput();
			inputB.tests = failingGate();
			const b = createGateBundle(inputB, baseConfig());
			expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
		});

		it("different timestamps produce different idempotency keys", () => {
			const input = allPassingInput();
			const a = createGateBundle(input, {
				timestamp: "2026-01-01T00:00:00.000Z",
			});
			const b = createGateBundle(input, {
				timestamp: "2026-01-02T00:00:00.000Z",
			});
			expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
		});

		it("isBundleReplaySafe returns true for identical bundles", () => {
			const input = allPassingInput();
			const a = createGateBundle(input, baseConfig());
			const b = createGateBundle(input, baseConfig());
			expect(isBundleReplaySafe(a, b)).toBe(true);
		});

		it("isBundleReplaySafe returns false for different bundles", () => {
			const a = createGateBundle(allPassingInput(), baseConfig());
			const inputB = allPassingInput();
			inputB.review = failingGate();
			const b = createGateBundle(inputB, baseConfig());
			expect(isBundleReplaySafe(a, b)).toBe(false);
		});
	});

	describe("skipped gates", () => {
		it("undefined gates are treated as skip", () => {
			const bundle = createGateBundle({}, baseConfig());
			expect(bundle.gates.every((g) => g.status === "skip")).toBe(true);
			expect(bundle.summary.skipped).toBe(5);
		});

		it("skipped gates have descriptive summary", () => {
			const bundle = createGateBundle({}, baseConfig());
			const envGate = bundle.gates.find((g) => g.category === "environment");
			expect(envGate?.summary).toContain("not evaluated");
		});
	});
});

// ─── createGateBundleFromResults ────────────────────────────────────────────────

describe("createGateBundleFromResults", () => {
	it("adapts passing preflight result", () => {
		const bundle = createGateBundleFromResults(
			{
				environment: {
					passed: true,
					checks: [
						{ id: "node", passed: true, durationMs: 10 },
						{ id: "pnpm", passed: true, durationMs: 5 },
					],
				},
			},
			{ ...baseConfig(), requiredGates: ["environment"] },
		);
		const envGate = bundle.gates.find((g) => g.category === "environment");
		expect(envGate?.status).toBe("pass");
		expect(envGate?.durationMs).toBe(15);
		expect(envGate?.findings.length).toBe(0);
	});

	it("adapts failing preflight result with findings", () => {
		const bundle = createGateBundleFromResults(
			{
				environment: {
					passed: false,
					checks: [
						{
							id: "node",
							passed: false,
							message: "Node version too old",
							durationMs: 10,
						},
					],
				},
			},
			{ ...baseConfig(), requiredGates: ["environment"] },
		);
		const envGate = bundle.gates.find((g) => g.category === "environment");
		expect(envGate?.status).toBe("fail");
		expect(envGate?.findings.length).toBe(1);
		expect(envGate?.findings[0]?.code).toBe("node");
	});

	it("adapts passing policy gate result", () => {
		const bundle = createGateBundleFromResults(
			{
				policy: {
					ok: true,
					output: { passed: true, tier: "low", violatingFiles: [] },
				},
			},
			{ ...baseConfig(), requiredGates: ["policy"] },
		);
		const policyGate = bundle.gates.find((g) => g.category === "policy");
		expect(policyGate?.status).toBe("pass");
	});

	it("adapts failing policy gate result", () => {
		const bundle = createGateBundleFromResults(
			{
				policy: {
					ok: false,
					error: { code: "VALIDATION_ERROR", message: "Bad contract" },
				},
			},
			{ ...baseConfig(), requiredGates: ["policy"] },
		);
		const policyGate = bundle.gates.find((g) => g.category === "policy");
		expect(policyGate?.status).toBe("fail");
		expect(policyGate?.findings[0]?.code).toBe("VALIDATION_ERROR");
	});

	it("adapts passing docs gate result", () => {
		const bundle = createGateBundleFromResults(
			{
				docs: { exitCode: 0 },
			},
			{ ...baseConfig(), requiredGates: ["docs"] },
		);
		const docsGate = bundle.gates.find((g) => g.category === "docs");
		expect(docsGate?.status).toBe("pass");
	});

	it("adapts failing test result", () => {
		const bundle = createGateBundleFromResults(
			{
				tests: {
					passed: false,
					total: 50,
					failed: 3,
					errors: ["test A failed", "test B failed", "test C failed"],
				},
			},
			{ ...baseConfig(), requiredGates: ["tests"] },
		);
		const testsGate = bundle.gates.find((g) => g.category === "tests");
		expect(testsGate?.status).toBe("fail");
		expect(testsGate?.findings.length).toBe(3);
	});

	it("adapts passing review gate result", () => {
		const bundle = createGateBundleFromResults(
			{
				review: {
					ok: true,
					output: { verified: true, blockers: [] },
				},
			},
			{ ...baseConfig(), requiredGates: ["review"] },
		);
		const reviewGate = bundle.gates.find((g) => g.category === "review");
		expect(reviewGate?.status).toBe("pass");
	});

	it("adapts review gate with blockers", () => {
		const bundle = createGateBundleFromResults(
			{
				review: {
					ok: true,
					output: {
						verified: false,
						blockers: ["Missing approval", "Unresolved thread"],
					},
				},
			},
			{ ...baseConfig(), requiredGates: ["review"] },
		);
		const reviewGate = bundle.gates.find((g) => g.category === "review");
		expect(reviewGate?.status).toBe("fail");
		expect(reviewGate?.findings.length).toBe(2);
		expect(reviewGate?.findings[0]?.code).toBe("REVIEW_BLOCKER");
	});

	it("full passing pipeline produces pass decision", () => {
		const bundle = createGateBundleFromResults(
			{
				environment: { passed: true, checks: [] },
				policy: {
					ok: true,
					output: { passed: true, tier: "low", violatingFiles: [] },
				},
				docs: { exitCode: 0 },
				tests: { passed: true, total: 142, failed: 0 },
				review: { ok: true, output: { verified: true, blockers: [] } },
			},
			baseConfig(),
		);
		expect(bundle.decision).toBe("pass");
		expect(bundle.summary.passed).toBe(5);
	});
});

// ─── validateGateBundle ─────────────────────────────────────────────────────────

describe("validateGateBundle", () => {
	it("validates a correct bundle", () => {
		const bundle = createGateBundle(allPassingInput(), baseConfig());
		const result = validateGateBundle(bundle);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("rejects invalid schema version", () => {
		const bundle = createGateBundle(allPassingInput(), baseConfig());
		(bundle as unknown as Record<string, unknown>).schemaVersion = "v2";
		const result = validateGateBundle(bundle);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("schema version");
	});

	it("rejects missing timestamp", () => {
		const bundle = createGateBundle(allPassingInput(), baseConfig());
		bundle.createdAt = "";
		const result = validateGateBundle(bundle);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("createdAt");
	});

	it("rejects missing idempotency key", () => {
		const bundle = createGateBundle(allPassingInput(), baseConfig());
		bundle.idempotencyKey = "";
		const result = validateGateBundle(bundle);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("idempotency");
	});

	it("detects summary total mismatch", () => {
		const bundle = createGateBundle(allPassingInput(), baseConfig());
		bundle.summary.total = 99;
		const result = validateGateBundle(bundle);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("total"))).toBe(true);
	});

	it("detects duplicate gate categories", () => {
		const bundle = createGateBundle(allPassingInput(), baseConfig());
		// Manually inject a duplicate
		bundle.gates.push({
			category: "environment",
			status: "pass",
			required: false,
			summary: "duplicate",
			durationMs: 0,
			findings: [],
		});
		const result = validateGateBundle(bundle);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("Duplicate"))).toBe(true);
	});
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
	it("empty input with no required gates passes", () => {
		const bundle = createGateBundle(
			{},
			{
				...baseConfig(),
				requiredGates: [],
			},
		);
		expect(bundle.decision).toBe("pass");
		expect(bundle.summary.skipped).toBe(5);
	});

	it("gate with empty findings array passes", () => {
		const bundle = createGateBundle(
			{
				tests: { passed: true, findings: [] },
			},
			{ ...baseConfig(), requiredGates: ["tests"] },
		);
		const testsGate = bundle.gates.find((g) => g.category === "tests");
		expect(testsGate?.status).toBe("pass");
		expect(testsGate?.findings).toEqual([]);
	});

	it("custom required gates subset works correctly", () => {
		const input: GateBundleInput = {
			tests: passingGate(),
			// environment, policy, docs, review all skipped
		};
		const bundle = createGateBundle(input, {
			...baseConfig(),
			requiredGates: ["tests"],
		});
		expect(bundle.decision).toBe("pass");
	});

	it("categories in findings match their parent gate", () => {
		const input = allPassingInput();
		input.tests = failingGate();
		const bundle = createGateBundle(input, baseConfig());
		const testsGate = bundle.gates.find((g) => g.category === "tests");
		for (const finding of testsGate?.findings ?? []) {
			expect(finding.gate).toBe("tests");
		}
	});
});
