import { describe, expect, it } from "vitest";
import {
	buildVitestArgs,
	classifyE2EBlocker,
	classifySkipReasons,
	parseArgs,
	parseVitestOutput,
	patternNeedsCheckRunWrite,
} from "./run-e2e.js";

describe("E2E runner helpers", () => {
	it("parses runner options and preserves the target pattern", () => {
		const { options, pattern } = parseArgs([
			"--bail",
			"--parallel",
			"1",
			"--timeout",
			"120000",
			"--reporter",
			"json",
			"--no-checks-preflight",
			"--preflight-only",
			"github-integration",
		]);

		expect(pattern).toBe("github-integration");
		expect(options).toMatchObject({
			bail: true,
			parallel: 1,
			timeout: 120000,
			reporters: ["json"],
			checksPermissionPreflight: false,
			preflightOnly: true,
		});
	});

	it("requires Checks API write preflight only for GitHub check-run lanes", () => {
		expect(patternNeedsCheckRunWrite()).toBe(true);
		expect(patternNeedsCheckRunWrite("github-integration")).toBe(true);
		expect(patternNeedsCheckRunWrite("command-pipeline")).toBe(true);
		expect(patternNeedsCheckRunWrite("e2e/tests")).toBe(true);
		expect(patternNeedsCheckRunWrite("e2e/tests/*.e2e.test.ts")).toBe(true);
		expect(patternNeedsCheckRunWrite("linear-integration")).toBe(false);
		expect(
			patternNeedsCheckRunWrite("e2e/tests/linear-integration.e2e.test.ts"),
		).toBe(false);
	});

	it("builds the canonical Vitest invocation without rewriting full paths", () => {
		expect(
			buildVitestArgs(
				{
					bail: true,
					reporters: ["verbose"],
					timeout: 300000,
				},
				"github-integration",
			),
		).toEqual([
			"vitest",
			"run",
			"--config",
			"e2e/vitest.e2e.config.ts",
			"--bail",
			"--reporter",
			"verbose",
			"--test-timeout",
			"300000",
			"e2e/tests/github-integration",
		]);
	});

	it("extracts first failing scenario and assertion from verbose output", () => {
		const parsed = parseVitestOutput(`
 × e2e/tests/command-pipeline.e2e.test.ts > Command Pipeline E2E > Review Gate Pipeline > should pass review-gate 6664ms
   → Resource not accessible by personal access token

 Test Files 1 failed | 0 passed (3)
      Tests 4 failed | 6 passed | 7 skipped (18)
`);

		expect(parsed).toMatchObject({
			testsFailed: 4,
			testsPassed: 6,
			testsSkipped: 7,
			firstFailingScenario:
				"e2e/tests/command-pipeline.e2e.test.ts > Command Pipeline E2E > Review Gate Pipeline > should pass review-gate",
			firstFailingAssertion: "Resource not accessible by personal access token",
		});
	});

	it("classifies common E2E blockers for automation closeout", () => {
		expect(
			classifyE2EBlocker(
				1,
				"GitHub Checks API write preflight failed: Resource not accessible by personal access token",
			),
		).toBe("environment/tooling issue");
		expect(
			classifyE2EBlocker(1, "ContractLoadError: Path traversal detected"),
		).toBe("fixture/runtime failure");
		expect(classifyE2EBlocker(1, "artifacts/e2e/result.json missing")).toBe(
			"missing artifact",
		);
		expect(classifyE2EBlocker(1, "expected false to be true")).toBe(
			"scenario regression",
		);
	});

	it("turns Vitest skips into explicit Linear skip reasons", () => {
		expect(
			classifySkipReasons(7, "Tests 18 passed | 7 skipped", undefined),
		).toEqual([
			{
				reason: "skipped_due_to_missing_linear_team_state",
				count: 7,
				evidence:
					"Linear lifecycle tests are gated on resolving LINEAR_TEST_TEAM to a live team id before mutating issues.",
			},
		]);
		expect(
			classifySkipReasons(1, "Tests 1 skipped (1)", "github-integration")[0]
				?.reason,
		).toBe("skipped_due_to_unclassified_vitest_skip");
	});
});
