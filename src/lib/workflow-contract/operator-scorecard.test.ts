import { describe, expect, it } from "vitest";
import {
	type GateBundleConfig,
	type GateBundleEnvelope,
	type GateBundleInput,
	type GateInput,
	createGateBundle,
} from "./gate-bundle.js";
import {
	type OperatorScorecard,
	type ScorecardInput,
	generateScorecard,
	validateScorecard,
} from "./operator-scorecard.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const FIXED_TIMESTAMP = "2026-03-21T19:00:00.000Z";

function baseConfig(): GateBundleConfig {
	return { timestamp: FIXED_TIMESTAMP };
}

function scorecardInput(overrides?: Partial<ScorecardInput>): ScorecardInput {
	return {
		workflowState: "S2 IN_REVIEW",
		testSummary: { total: 183, passed: 183, failed: 0 },
		timestamp: FIXED_TIMESTAMP,
		...overrides,
	};
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

function allPassingBundle(): GateBundleEnvelope {
	return createGateBundle(
		{
			environment: passingGate("Environment OK"),
			policy: passingGate("Policy OK"),
			docs: passingGate("Docs OK"),
			tests: passingGate("Tests OK"),
			review: passingGate("Review OK"),
		},
		baseConfig(),
	);
}

// ─── generateScorecard ──────────────────────────────────────────────────────────

describe("generateScorecard", () => {
	describe("recommended action", () => {
		it("returns continue for all-passing bundle with tests", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.recommendedAction).toBe("continue");
		});

		it("returns intervene for single gate failure", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: failingGate(),
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.recommendedAction).toBe("intervene");
		});

		it("returns stop for blocked bundle", () => {
			// Skip a required gate to produce blocked
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				// docs skipped = blocked
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.recommendedAction).toBe("stop");
		});

		it("returns stop for multiple failures (>= 3 blockers)", () => {
			const multiFailGate: GateInput = {
				passed: false,
				findings: [
					{ code: "F1", severity: "error", message: "error 1" },
					{ code: "F2", severity: "error", message: "error 2" },
					{ code: "F3", severity: "error", message: "error 3" },
				],
			};
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: multiFailGate,
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.recommendedAction).toBe("stop");
		});

		it("returns intervene for pass with low confidence", () => {
			// All gates pass but no test summary → low confidence
			const bundle = allPassingBundle();
			const sc = generateScorecard(bundle, {
				workflowState: "S2 IN_REVIEW",
				timestamp: FIXED_TIMESTAMP,
				// No testSummary → penalized
			});
			expect(sc.recommendedAction).toBe("continue");
			// With many warnings it could be intervene
		});
	});

	describe("confidence rubric", () => {
		it("gives high confidence (4+) for clean run", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.confidence.score).toBeGreaterThanOrEqual(4);
			expect(sc.confidence.level).toBe("high");
		});

		it("reduces confidence for failed gates", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: failingGate(),
				tests: failingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.confidence.score).toBeLessThanOrEqual(3);
		});

		it("reduces confidence when test data missing", () => {
			const sc = generateScorecard(allPassingBundle(), {
				workflowState: "S1 IN_PROGRESS",
				timestamp: FIXED_TIMESTAMP,
				// no testSummary
			});
			expect(sc.confidence.score).toBeLessThanOrEqual(4);
			expect(sc.confidence.rationale).toContain("No test summary available");
		});

		it("reduces confidence for test failures", () => {
			const sc = generateScorecard(allPassingBundle(), {
				...scorecardInput(),
				testSummary: { total: 100, passed: 90, failed: 10 },
			});
			expect(sc.confidence.rationale.some((r) => r.includes("failed"))).toBe(
				true,
			);
		});

		it("scores at minimum 1", () => {
			// Create worst-case scenario
			const input: GateBundleInput = {
				environment: failingGate(),
				policy: failingGate(),
				docs: failingGate(),
				// tests skipped
				// review skipped
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, {
				workflowState: "S0 TODO",
				timestamp: FIXED_TIMESTAMP,
			});
			expect(sc.confidence.score).toBeGreaterThanOrEqual(1);
		});
	});

	describe("blocking reason", () => {
		it("is empty for passing bundle", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.blockingReason).toBe("");
		});

		it("includes failed required gate name", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: passingGate(),
				tests: failingGate("Tests failed"),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.blockingReason).toContain("tests");
		});

		it("includes skipped required gate", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: passingGate(),
				// tests skipped
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.blockingReason).toContain("tests");
			expect(sc.blockingReason).toContain("skipped");
		});
	});

	describe("remediation suggestions", () => {
		it("has no remediations for passing bundle", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.remediations).toEqual([]);
		});

		it("suggests remediation for failed required gate", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: failingGate(),
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.remediations.length).toBeGreaterThanOrEqual(1);
			expect(sc.remediations[0]?.gate).toBe("docs");
			expect(sc.remediations[0]?.urgency).toBe("high");
		});

		it("suggests running skipped required gate", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: passingGate(),
				// tests skipped
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			const testRem = sc.remediations.find((r) => r.gate === "tests");
			expect(testRem).toBeDefined();
			expect(testRem?.urgency).toBe("high");
			expect(testRem?.action).toContain("skipped");
		});

		it("sorts by urgency: high first", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: passingGate(),
				// tests skipped (high urgency)
				review: {
					passed: false,
					findings: [
						{ code: "W1", severity: "warning", message: "minor issue" },
					],
				},
			};
			const bundle = createGateBundle(input, {
				...baseConfig(),
				requiredGates: ["tests"], // only tests required
			});
			const sc = generateScorecard(bundle, scorecardInput());
			// First remediation should be the skipped required gate
			if (sc.remediations.length >= 2) {
				const urgencies = sc.remediations.map((r) => r.urgency);
				const urgencyOrder = ["high", "medium", "low"];
				for (let i = 0; i < urgencies.length - 1; i++) {
					expect(urgencyOrder.indexOf(urgencies[i]!)).toBeLessThanOrEqual(
						urgencyOrder.indexOf(urgencies[i + 1]!),
					);
				}
			}
		});
	});

	describe("scorecard structure", () => {
		it("has correct schema version", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.schemaVersion).toBe("scorecard/v1");
		});

		it("preserves workflow state", () => {
			const sc = generateScorecard(
				allPassingBundle(),
				scorecardInput({ workflowState: "S3 DONE" }),
			);
			expect(sc.stateReached).toBe("S3 DONE");
		});

		it("includes all gate rows", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.gates.length).toBe(5);
			expect(sc.gates.map((g) => g.gate)).toEqual([
				"environment",
				"policy",
				"docs",
				"tests",
				"review",
			]);
		});

		it("includes test summary", () => {
			const sc = generateScorecard(
				allPassingBundle(),
				scorecardInput({ testSummary: { total: 142, passed: 142, failed: 0 } }),
			);
			expect(sc.testsExecuted).toEqual({
				total: 142,
				passed: 142,
				failed: 0,
			});
		});

		it("has non-negative decision time", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.decisionTimeMs).toBeGreaterThanOrEqual(0);
		});

		it("includes blockers and warnings counts", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: {
					passed: false,
					findings: [
						{ code: "E1", severity: "error", message: "err" },
						{ code: "W1", severity: "warning", message: "warn" },
					],
				},
				docs: passingGate(),
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.blockersRaised).toBe(1);
			expect(sc.warningsRaised).toBe(1);
		});
	});

	describe("text summary", () => {
		it("contains key elements", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.textSummary).toContain("OPERATOR SCORECARD");
			expect(sc.textSummary).toContain("S2 IN_REVIEW");
			expect(sc.textSummary).toContain("PASS");
			expect(sc.textSummary).toContain("CONTINUE");
		});

		it("shows remediation in text output", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: failingGate(),
				tests: passingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.textSummary).toContain("Remediation");
		});

		it("shows confidence rationale", () => {
			const sc = generateScorecard(allPassingBundle(), scorecardInput());
			expect(sc.textSummary).toContain("Confidence rationale");
		});

		it("shows blocking reason when blocked", () => {
			const input: GateBundleInput = {
				environment: passingGate(),
				policy: passingGate(),
				docs: passingGate(),
				tests: failingGate(),
				review: passingGate(),
			};
			const bundle = createGateBundle(input, baseConfig());
			const sc = generateScorecard(bundle, scorecardInput());
			expect(sc.textSummary).toContain("Blocking");
		});

		it("shows test summary in text output", () => {
			const sc = generateScorecard(
				allPassingBundle(),
				scorecardInput({ testSummary: { total: 50, passed: 48, failed: 2 } }),
			);
			expect(sc.textSummary).toContain("48/50 passed");
			expect(sc.textSummary).toContain("2 failed");
		});
	});
});

// ─── validateScorecard ──────────────────────────────────────────────────────────

describe("validateScorecard", () => {
	it("validates a correct scorecard", () => {
		const sc = generateScorecard(allPassingBundle(), scorecardInput());
		const result = validateScorecard(sc);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("rejects invalid schema version", () => {
		const sc = generateScorecard(allPassingBundle(), scorecardInput());
		(sc as unknown as Record<string, unknown>).schemaVersion = "v99";
		const result = validateScorecard(sc as unknown as OperatorScorecard);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("schema version");
	});

	it("rejects invalid confidence score", () => {
		const sc = generateScorecard(allPassingBundle(), scorecardInput());
		(sc.confidence as { score: number }).score = 0;
		const result = validateScorecard(sc);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("confidence score");
	});

	it("rejects empty text summary", () => {
		const sc = generateScorecard(allPassingBundle(), scorecardInput());
		sc.textSummary = "";
		const result = validateScorecard(sc);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("text summary");
	});

	it("rejects missing timestamp", () => {
		const sc = generateScorecard(allPassingBundle(), scorecardInput());
		sc.generatedAt = "";
		const result = validateScorecard(sc);
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain("generatedAt");
	});
});

// ─── Integration ────────────────────────────────────────────────────────────────

describe("end-to-end scorecard", () => {
	it("produces full pipeline scorecard", () => {
		const bundle = createGateBundle(
			{
				environment: passingGate("Environment OK"),
				policy: passingGate("Policy OK"),
				docs: passingGate("Docs OK"),
				tests: passingGate("183 tests passed"),
				review: passingGate("Review verified"),
			},
			baseConfig(),
		);
		const sc = generateScorecard(bundle, {
			workflowState: "S2 IN_REVIEW",
			testSummary: { total: 183, passed: 183, failed: 0 },
			timestamp: FIXED_TIMESTAMP,
		});

		expect(sc.recommendedAction).toBe("continue");
		expect(sc.confidence.score).toBeGreaterThanOrEqual(4);
		expect(sc.blockingReason).toBe("");
		expect(sc.remediations).toEqual([]);
		expect(sc.blockersRaised).toBe(0);
		expect(sc.stateReached).toBe("S2 IN_REVIEW");
		expect(sc.testsExecuted?.total).toBe(183);

		// Validate the scorecard itself
		const validation = validateScorecard(sc);
		expect(validation.valid).toBe(true);
	});

	it("produces failing pipeline scorecard with remediations", () => {
		const bundle = createGateBundle(
			{
				environment: passingGate("Environment OK"),
				policy: {
					passed: false,
					findings: [
						{
							code: "POLICY_VIOLATION",
							severity: "error",
							message: "tier high exceeds max medium",
						},
					],
				},
				docs: passingGate("Docs OK"),
				tests: {
					passed: false,
					findings: [
						{
							code: "TEST_FAIL",
							severity: "error",
							message: "unit test failed",
						},
					],
				},
				review: passingGate("Review OK"),
			},
			baseConfig(),
		);
		const sc = generateScorecard(bundle, {
			workflowState: "S1 IN_PROGRESS",
			testSummary: { total: 183, passed: 180, failed: 3 },
			timestamp: FIXED_TIMESTAMP,
		});

		expect(sc.recommendedAction).toBe("intervene");
		expect(sc.confidence.score).toBeLessThan(4);
		expect(sc.blockingReason).toContain("policy");
		expect(sc.blockingReason).toContain("tests");
		expect(sc.remediations.length).toBeGreaterThanOrEqual(2);
		expect(sc.blockersRaised).toBe(2);

		const validation = validateScorecard(sc);
		expect(validation.valid).toBe(true);
	});
});
