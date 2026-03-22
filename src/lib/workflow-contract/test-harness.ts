/**
 * Agent-Native Test Harness Utilities (Slice 5)
 *
 * Provides reusable test infrastructure for workflow and CLI verification:
 * - Local git-fixture utilities (createGitFixture, commitFiles)
 * - Compact validation wrappers (assertGatePasses, assertGateFails)
 * - Module test manifest types and validation
 * - RED/GREEN evidence format helpers
 *
 * Usage:
 *   import { createGitFixture, assertGatePasses, validateModuleTestManifest }
 *     from "./test-harness.js";
 *
 *   const fixture = createGitFixture({ files: { "README.md": "# Hello" } });
 *   // ... run tests against fixture.dir ...
 *   fixture.cleanup();
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

// ─── Types ──────────────────────────────────────────────────────────────────────

/**
 * A local git fixture with a temporary directory and cleanup function.
 */
export interface GitFixture {
	/** Absolute path to the fixture directory. */
	dir: string;
	/** Cleanup function to remove the fixture. */
	cleanup: () => void;
	/** Initial commit SHA. */
	initialSha: string;
	/** Commit files and return the new SHA. */
	commitFiles: (
		files: Record<string, string>,
		message?: string,
	) => string;
	/** Run a git command in the fixture directory. */
	git: (args: string[]) => { stdout: string; stderr: string; exitCode: number };
}

/**
 * Options for creating a git fixture.
 */
export interface GitFixtureOptions {
	/** Initial files to create (path → content). */
	files?: Record<string, string>;
	/** Custom commit message for the initial commit. */
	message?: string;
	/** Prefix for the temp directory name. */
	prefix?: string;
	/** Git user name. */
	userName?: string;
	/** Git user email. */
	userEmail?: string;
}

/**
 * Module test manifest — declares the test surface for a workflow module.
 *
 * Each workflow module publishes one of these to specify its test commands,
 * expected artifact outputs, and evidence format.
 */
export interface ModuleTestManifest {
	/** Module name (e.g. "workflow-contract", "ci-adapter"). */
	moduleName: string;
	/** Module path relative to repo root. */
	modulePath: string;
	/** Boundary test command. */
	boundaryTestCommand: string;
	/** Smoke test command. */
	smokeTestCommand: string;
	/** Expected artifact outputs (relative paths). */
	expectedArtifacts: string[];
	/** Whether TDD RED/GREEN evidence is required. */
	tddRequired: boolean;
	/** Evidence format for TDD-required paths. */
	evidenceFormat?: EvidenceFormat | undefined;
}

/** Evidence format for RED/GREEN TDD evidence. */
export type EvidenceFormat = "vitest-json" | "tap" | "junit-xml" | "custom";

/**
 * RED/GREEN evidence record for TDD-required paths.
 */
export interface TDDEvidence {
	/** Module name. */
	moduleName: string;
	/** Evidence phase: RED (test fails first) or GREEN (test passes after fix). */
	phase: "RED" | "GREEN";
	/** Test command that was run. */
	command: string;
	/** Whether the test passed (GREEN) or failed (RED). */
	passed: boolean;
	/** Number of tests run. */
	testCount: number;
	/** Number of tests that failed. */
	failedCount: number;
	/** Timestamp of evidence capture. */
	capturedAt: string;
	/** Optional test output excerpt. */
	excerpt?: string | undefined;
}

/**
 * Compact gate assertion result.
 */
export interface GateAssertionResult {
	/** Whether the assertion passed. */
	ok: boolean;
	/** Gate name. */
	gate: string;
	/** Expected outcome. */
	expected: "pass" | "fail";
	/** Actual outcome. */
	actual: "pass" | "fail";
	/** Failure message (empty if ok). */
	message: string;
	/** Duration in milliseconds. */
	durationMs: number;
}

/** Manifest validation finding. */
export interface ManifestFinding {
	/** Finding code. */
	code: string;
	/** Severity. */
	severity: "error" | "warning";
	/** Message. */
	message: string;
}

// ─── Git Fixture Utilities ──────────────────────────────────────────────────────

/**
 * Create a local git fixture with an initial commit.
 *
 * Returns a fixture object with:
 * - `dir`: absolute path to the temporary repo
 * - `cleanup()`: removes the temp directory
 * - `initialSha`: SHA of the initial commit
 * - `commitFiles()`: add files and commit, returns new SHA
 * - `git()`: run git commands
 */
export function createGitFixture(options?: GitFixtureOptions): GitFixture {
	const prefix = options?.prefix ?? "harness-test-fixture-";
	const dir = mkdtempSync(join(tmpdir(), prefix));

	const userName = options?.userName ?? "Test Runner";
	const userEmail = options?.userEmail ?? "test@harness.local";

	const gitCmd = (args: string[]) => {
		const result = spawnSync("git", args, {
			cwd: dir,
			encoding: "utf-8",
			env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
		});
		return {
			stdout: result.stdout?.trim() ?? "",
			stderr: result.stderr?.trim() ?? "",
			exitCode: result.status ?? 1,
		};
	};

	// Initialize repo
	gitCmd(["init", "-q"]);
	gitCmd(["config", "user.name", userName]);
	gitCmd(["config", "user.email", userEmail]);

	// Write initial files
	const initialFiles = options?.files ?? { ".gitkeep": "" };
	for (const [filePath, content] of Object.entries(initialFiles)) {
		const fullPath = join(dir, filePath);
		mkdirSync(dirname(fullPath), { recursive: true });
		writeFileSync(fullPath, content, "utf-8");
	}

	// Initial commit
	gitCmd(["add", "-A"]);
	gitCmd(["commit", "-q", "-m", options?.message ?? "initial commit"]);

	// Get initial SHA
	const shaResult = gitCmd(["rev-parse", "HEAD"]);
	const initialSha = shaResult.stdout;

	const commitFiles = (
		files: Record<string, string>,
		message?: string,
	): string => {
		for (const [filePath, content] of Object.entries(files)) {
			const fullPath = join(dir, filePath);
			mkdirSync(dirname(fullPath), { recursive: true });
			writeFileSync(fullPath, content, "utf-8");
		}
		gitCmd(["add", "-A"]);
		gitCmd(["commit", "-q", "-m", message ?? "test commit"]);
		return gitCmd(["rev-parse", "HEAD"]).stdout;
	};

	const cleanup = () => {
		rmSync(dir, { recursive: true, force: true });
	};

	return {
		dir,
		cleanup,
		initialSha,
		commitFiles,
		git: gitCmd,
	};
}

// ─── Compact Validation Wrappers ────────────────────────────────────────────────

/**
 * Assert that a gate check passes.
 *
 * Compact wrapper that runs a gate function and asserts it passes,
 * preserving exact failure output on assertion failure.
 */
export function assertGatePasses(
	gateName: string,
	gateFn: () => { passed: boolean; message?: string },
): GateAssertionResult {
	const start = Date.now();
	const result = gateFn();
	const durationMs = Date.now() - start;

	return {
		ok: result.passed,
		gate: gateName,
		expected: "pass",
		actual: result.passed ? "pass" : "fail",
		message: result.passed
			? ""
			: `Expected ${gateName} to pass, but it failed: ${result.message ?? "no details"}`,
		durationMs,
	};
}

/**
 * Assert that a gate check fails.
 *
 * Compact wrapper that runs a gate function and asserts it fails,
 * preserving exact assertion-bearing output.
 */
export function assertGateFails(
	gateName: string,
	gateFn: () => { passed: boolean; message?: string },
): GateAssertionResult {
	const start = Date.now();
	const result = gateFn();
	const durationMs = Date.now() - start;

	return {
		ok: !result.passed,
		gate: gateName,
		expected: "fail",
		actual: result.passed ? "pass" : "fail",
		message: !result.passed
			? ""
			: `Expected ${gateName} to fail, but it passed`,
		durationMs,
	};
}

/**
 * Run a batch of gate assertions and return a compact summary.
 *
 * Keeps passing runs short while preserving exact assertion detail
 * for failures.
 */
export function runGateAssertions(
	assertions: GateAssertionResult[],
): {
	allPassed: boolean;
	total: number;
	passed: number;
	failed: number;
	failures: GateAssertionResult[];
	totalDurationMs: number;
	summary: string;
} {
	const passed = assertions.filter((a) => a.ok).length;
	const failed = assertions.length - passed;
	const failures = assertions.filter((a) => !a.ok);
	const totalDurationMs = assertions.reduce(
		(sum, a) => sum + a.durationMs,
		0,
	);

	const summaryLines: string[] = [];
	if (failed === 0) {
		summaryLines.push(`✓ All ${passed} gate assertions passed (${totalDurationMs}ms)`);
	} else {
		summaryLines.push(
			`✗ ${failed} of ${assertions.length} gate assertions failed (${totalDurationMs}ms)`,
		);
		for (const f of failures) {
			summaryLines.push(`  ✗ ${f.gate}: ${f.message}`);
		}
	}

	return {
		allPassed: failed === 0,
		total: assertions.length,
		passed,
		failed,
		failures,
		totalDurationMs,
		summary: summaryLines.join("\n"),
	};
}

// ─── Module Test Manifest ───────────────────────────────────────────────────────

/**
 * Validate a module test manifest.
 */
export function validateModuleTestManifest(
	manifest: ModuleTestManifest,
): { valid: boolean; findings: ManifestFinding[] } {
	const findings: ManifestFinding[] = [];

	if (!manifest.moduleName || manifest.moduleName.trim().length === 0) {
		findings.push({
			code: "MISSING_MODULE_NAME",
			severity: "error",
			message: "Module name is required",
		});
	}

	if (!manifest.modulePath || manifest.modulePath.trim().length === 0) {
		findings.push({
			code: "MISSING_MODULE_PATH",
			severity: "error",
			message: "Module path is required",
		});
	}

	if (
		!manifest.boundaryTestCommand ||
		manifest.boundaryTestCommand.trim().length === 0
	) {
		findings.push({
			code: "MISSING_BOUNDARY_TEST",
			severity: "error",
			message: "Boundary test command is required",
		});
	}

	if (
		!manifest.smokeTestCommand ||
		manifest.smokeTestCommand.trim().length === 0
	) {
		findings.push({
			code: "MISSING_SMOKE_TEST",
			severity: "error",
			message: "Smoke test command is required",
		});
	}

	if (manifest.tddRequired && !manifest.evidenceFormat) {
		findings.push({
			code: "MISSING_EVIDENCE_FORMAT",
			severity: "error",
			message:
				"Evidence format is required when tddRequired is true",
		});
	}

	if (manifest.expectedArtifacts.length === 0) {
		findings.push({
			code: "NO_EXPECTED_ARTIFACTS",
			severity: "warning",
			message: "No expected artifacts declared",
		});
	}

	// Check for path traversal in expected artifacts
	for (const artifact of manifest.expectedArtifacts) {
		if (artifact.includes("..") || artifact.startsWith("/")) {
			findings.push({
				code: "UNSAFE_ARTIFACT_PATH",
				severity: "error",
				message: `Artifact path '${artifact}' looks unsafe (path traversal or absolute)`,
			});
		}
	}

	return {
		valid: findings.filter((f) => f.severity === "error").length === 0,
		findings,
	};
}

// ─── TDD Evidence Helpers ───────────────────────────────────────────────────────

/**
 * Create a RED evidence record (test fails before implementation).
 */
export function createRedEvidence(
	moduleName: string,
	command: string,
	failedCount: number,
	testCount: number,
	excerpt?: string,
): TDDEvidence {
	const evidence: TDDEvidence = {
		moduleName,
		phase: "RED",
		command,
		passed: false,
		testCount,
		failedCount,
		capturedAt: new Date().toISOString(),
	};
	if (excerpt !== undefined) {
		evidence.excerpt = excerpt;
	}
	return evidence;
}

/**
 * Create a GREEN evidence record (test passes after implementation).
 */
export function createGreenEvidence(
	moduleName: string,
	command: string,
	testCount: number,
	excerpt?: string,
): TDDEvidence {
	const evidence: TDDEvidence = {
		moduleName,
		phase: "GREEN",
		command,
		passed: true,
		testCount,
		failedCount: 0,
		capturedAt: new Date().toISOString(),
	};
	if (excerpt !== undefined) {
		evidence.excerpt = excerpt;
	}
	return evidence;
}

/**
 * Validate a TDD evidence pair (RED + GREEN).
 *
 * Rules:
 * - RED evidence must have passed=false and failedCount > 0
 * - GREEN evidence must have passed=true and failedCount === 0
 * - Both must have the same moduleName
 * - GREEN must be captured after RED
 */
export function validateTDDEvidencePair(
	red: TDDEvidence,
	green: TDDEvidence,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (red.phase !== "RED") {
		errors.push(`First evidence must be RED, got ${red.phase}`);
	}
	if (green.phase !== "GREEN") {
		errors.push(`Second evidence must be GREEN, got ${green.phase}`);
	}

	if (red.moduleName !== green.moduleName) {
		errors.push(
			`Module name mismatch: RED='${red.moduleName}', GREEN='${green.moduleName}'`,
		);
	}

	if (red.passed) {
		errors.push("RED evidence must have passed=false (test should fail before fix)");
	}
	if (red.failedCount === 0) {
		errors.push("RED evidence must have failedCount > 0");
	}

	if (!green.passed) {
		errors.push(
			"GREEN evidence must have passed=true (test should pass after fix)",
		);
	}
	if (green.failedCount !== 0) {
		errors.push("GREEN evidence must have failedCount === 0");
	}

	// Temporal ordering
	if (red.capturedAt && green.capturedAt) {
		const redTime = new Date(red.capturedAt).getTime();
		const greenTime = new Date(green.capturedAt).getTime();
		if (!Number.isNaN(redTime) && !Number.isNaN(greenTime) && greenTime < redTime) {
			errors.push(
				"GREEN evidence must be captured after RED evidence",
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

// ─── Default Module Test Manifests ──────────────────────────────────────────────

/**
 * Default test manifests for the workflow-contract modules.
 */
export const WORKFLOW_CONTRACT_MANIFESTS: readonly ModuleTestManifest[] = [
	{
		moduleName: "workflow-contract-checker",
		modulePath: "src/lib/workflow-contract/checker.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/checker.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/checker.test.ts -t 'validates'",
		expectedArtifacts: [],
		tddRequired: false,
	},
	{
		moduleName: "workflow-contract-parser",
		modulePath: "src/lib/workflow-contract/parser.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/parser.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/parser.test.ts -t 'parseFrontmatter'",
		expectedArtifacts: [],
		tddRequired: false,
	},
	{
		moduleName: "workflow-contract-registry",
		modulePath: "src/lib/workflow-contract/registry.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/registry.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/registry.test.ts -t 'loadRegistry'",
		expectedArtifacts: [
			"docs/workflow-artifact-registry.json",
		],
		tddRequired: false,
	},
	{
		moduleName: "ci-adapter",
		modulePath: "src/lib/workflow-contract/ci-adapter.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/ci-adapter.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/ci-adapter.test.ts -t 'checkCICompatibility'",
		expectedArtifacts: [],
		tddRequired: false,
	},
	{
		moduleName: "state-normalizer",
		modulePath: "src/lib/workflow-contract/state-normalizer.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/state-normalizer.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/state-normalizer.test.ts -t 'createStateNormalizer'",
		expectedArtifacts: [],
		tddRequired: false,
	},
	{
		moduleName: "gate-bundle",
		modulePath: "src/lib/workflow-contract/gate-bundle.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/gate-bundle.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/gate-bundle.test.ts -t 'decision logic'",
		expectedArtifacts: [],
		tddRequired: false,
	},
	{
		moduleName: "operator-scorecard",
		modulePath: "src/lib/workflow-contract/operator-scorecard.ts",
		boundaryTestCommand:
			"npx vitest run src/lib/workflow-contract/operator-scorecard.test.ts",
		smokeTestCommand:
			"npx vitest run src/lib/workflow-contract/operator-scorecard.test.ts -t 'recommended action'",
		expectedArtifacts: [],
		tddRequired: false,
	},
];
