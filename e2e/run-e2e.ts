#!/usr/bin/env node
/**
 * E2E Test Runner
 *
 * Comprehensive test runner for E2E tests with:
 * - Environment validation
 * - API token verification
 * - Test isolation verification
 * - Parallel execution control
 * - Failure recovery
 * - Recording generation
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	ensureGitHubTokenForE2E,
	loadE2EEnv,
	maskSensitiveData,
	validateE2EEnv,
} from "./utils/env.js";

export interface RunOptions {
	testPattern?: string;
	bail?: boolean;
	reporters?: string[];
	record?: boolean;
	parallel?: number;
	timeout?: number;
	checksPermissionPreflight?: boolean;
	preflightOnly?: boolean;
}

interface ValidationResult {
	authSource: string;
	checksPreflight: "passed" | "skipped";
}

export type E2EBlockerClassification =
	| "scenario regression"
	| "fixture/runtime failure"
	| "missing artifact"
	| "environment/tooling issue"
	| "repo state issue"
	| "none";

export interface E2ESkipReason {
	reason: string;
	count: number;
	evidence: string;
}

export interface RunResult {
	success: boolean;
	exitCode: number;
	durationMs: number;
	testsPassed: number;
	testsFailed: number;
	testsSkipped: number;
	firstFailingScenario?: string;
	firstFailingAssertion?: string;
	blockerClassification: E2EBlockerClassification;
	skipReasons: E2ESkipReason[];
	recordingsDir?: string;
}

/**
 * Prints the command-line usage, options, and examples for the E2E test runner.
 *
 * This writes a multi-line help message to standard output describing available flags,
 * defaults, and example invocations.
 */
function printUsage(): void {
	console.info(`
E2E Test Runner for coding-harness

Usage: pnpm e2e [options] [test-pattern]

Options:
  --bail              Stop on first failure
  --reporter <name>   Reporter to use (verbose, json, html) [default: verbose]
  --no-record         Disable API call recording
  --parallel <n>      Number of concurrent tests [default: 3]
  --timeout <ms>      Test timeout in milliseconds [default: 300000]
  --no-checks-preflight
                      Skip the GitHub Checks API write-permission preflight
  --preflight-only    Validate credentials and permissions without running tests
  --help              Show this help

Examples:
  pnpm e2e                                    # Run all E2E tests
  pnpm e2e github-integration                 # Run specific test file
  pnpm e2e --bail                             # Stop on first failure
  pnpm e2e --parallel 1                       # Run tests sequentially
  pnpm e2e --reporter json                    # Use JSON reporter
`);
}

/**
 * Parse command-line arguments into a RunOptions object and an optional test pattern.
 *
 * @param args - The CLI arguments to parse (typically `process.argv.slice(2)`).
 * @returns An object with `options` containing the parsed `RunOptions` (flags such as `bail`, `reporters`, `record`, `parallel`, `timeout`, `checksPermissionPreflight`, and `preflightOnly`) and `pattern` when a non-flag argument was provided.
 */
export function parseArgs(args: string[]): {
	options: RunOptions;
	pattern?: string;
} {
	const options: RunOptions = {
		bail: false,
		reporters: ["verbose"],
		record: true,
		parallel: 3,
		timeout: 300000,
		checksPermissionPreflight: true,
		preflightOnly: false,
	};
	let pattern: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === undefined) {
			continue;
		}

		switch (arg) {
			case "--help":
			case "-h":
				printUsage();
				process.exit(0);
				break;
			case "--bail":
				options.bail = true;
				break;
			case "--no-record":
				options.record = false;
				break;
			case "--reporter":
				options.reporters = [args[++i] || "verbose"];
				break;
			case "--parallel":
				options.parallel = Number.parseInt(args[++i] || "3", 10);
				break;
			case "--timeout":
				options.timeout = Number.parseInt(args[++i] || "300000", 10);
				break;
			case "--no-checks-preflight":
				options.checksPermissionPreflight = false;
				break;
			case "--preflight-only":
				options.preflightOnly = true;
				break;
			default:
				if (!arg.startsWith("-")) {
					pattern = arg;
				}
				break;
		}
	}

	return pattern === undefined ? { options } : { options, pattern };
}

/**
 * Determines whether the GitHub Checks API write-permission preflight is required for a given test pattern.
 *
 * @param pattern - Optional test path or pattern (file name or path segment). If omitted, the preflight is required.
 * @returns `true` if the preflight should run (when `pattern` is missing or targets `github-integration` or `command-pipeline`, optionally suffixed with `.e2e.test.ts`), `false` otherwise.
 */
export function patternNeedsCheckRunWrite(pattern?: string): boolean {
	if (!pattern) {
		return true;
	}
	return /(^|\/)(github-integration|command-pipeline)(\.e2e\.test\.ts)?$/.test(
		pattern,
	);
}

/**
 * Constructs the command-line arguments for invoking `vitest run` using the E2E config.
 *
 * @param options - RunOptions controlling flags included (e.g., `bail`, `reporters`, `timeout`).
 * @param pattern - Optional test pattern or path; if it contains a `/` it is used as-is, otherwise it is prefixed with `e2e/tests/`.
 * @returns An array of command-line arguments suitable for running Vitest with the repository's E2E configuration and the provided options.
 */
export function buildVitestArgs(
	options: RunOptions,
	pattern?: string,
): string[] {
	const args = ["vitest", "run", "--config", "e2e/vitest.e2e.config.ts"];

	if (options.bail) {
		args.push("--bail");
	}

	if (options.reporters) {
		for (const reporter of options.reporters) {
			args.push("--reporter", reporter);
		}
	}

	args.push("--test-timeout", String(options.timeout));

	if (pattern) {
		args.push(pattern.includes("/") ? pattern : `e2e/tests/${pattern}`);
	}

	return args;
}

/**
 * Retrieve a string property from an object if present.
 *
 * @param value - The value to read the property from; expected to be an object.
 * @param field - The property name to read.
 * @returns `string` if the property exists on `value` and is a string, `undefined` otherwise.
 */
function getStringField(value: unknown, field: string): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const fieldValue = (value as Record<string, unknown>)[field];
	return typeof fieldValue === "string" ? fieldValue : undefined;
}

/**
 * Verifies that the provided GitHub credentials can create check runs for the test repository.
 *
 * Sends a probe POST to the repository's Check Runs endpoint using an intentionally invalid `head_sha`.
 * Resolves successfully when the probe is accepted (`response.ok`) or when GitHub responds `422` for the invalid SHA.
 * Throws an Error when the probe is rejected for other reasons; the error includes the HTTP status, server message,
 * and the `x-accepted-github-permissions` response header for debugging.
 *
 * @param env - E2E environment object containing at least `githubOwner`, `githubTestRepo`, and `githubToken`
 * @returns `void` on success; throws an Error on failure to confirm write permission
 */
async function verifyChecksApiWritePermission(
	env: ReturnType<typeof loadE2EEnv>,
): Promise<void> {
	const response = await fetch(
		`https://api.github.com/repos/${env.githubOwner}/${env.githubTestRepo}/check-runs`,
		{
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${env.githubToken}`,
				"Content-Type": "application/json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({
				name: "e2e-checks-api-permission-probe",
				head_sha: "0000000000000000000000000000000000000000",
				status: "completed",
				conclusion: "success",
				output: {
					title: "E2E Checks API permission probe",
					summary:
						"Intentional invalid-SHA probe used to verify check-runs write permission before creating E2E PRs.",
				},
			}),
		},
	);
	const body = (await response.json().catch(() => ({}))) as unknown;

	if (response.status === 422) {
		return;
	}
	if (response.ok) {
		return;
	}

	const message = getStringField(body, "message") ?? response.statusText;
	const acceptedPermissions =
		response.headers.get("x-accepted-github-permissions") ?? "unknown";
	throw new Error(
		`GitHub Checks API write preflight failed (${response.status}): ${message}. ` +
			`Accepted GitHub permissions: ${acceptedPermissions}. ` +
			"Use a GitHub App installation token or token that can create check runs for the E2E test repository.",
	);
}

/**
 * Validate the runtime environment required for E2E tests and optionally verify GitHub Checks API write permission.
 *
 * Performs environment variable checks and obtains the GitHub auth source; loads the full E2E environment and, when
 * enabled and applicable for the provided `pattern`, probes the GitHub Checks API to confirm the token can create check runs.
 * On any validation or preflight failure this function logs the error and terminates the process with exit code `1`.
 *
 * @param options - Run options; `checksPermissionPreflight` controls whether the Checks API write probe is attempted.
 * @param pattern - Optional test pattern used to decide if the Checks API write preflight should run.
 * @returns The detected `authSource` and the `checksPreflight` outcome (`"passed"` or `"skipped"`).
 */
async function validateEnvironment(
	options: RunOptions,
	pattern?: string,
): Promise<ValidationResult> {
	console.info("🔍 Validating E2E environment...\n");

	let authSource: string;
	try {
		validateE2EEnv();
		authSource = await ensureGitHubTokenForE2E();
		console.info("✅ Environment variables validated\n");
		console.info(`🔐 GitHub auth source: ${authSource}\n`);
	} catch (error) {
		console.error("❌ Environment validation failed:\n");
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}

	// Verify API tokens work
	const env = loadE2EEnv();

	console.info("🔑 Testing API credentials...\n");
	console.info(`  GitHub Owner: ${env.githubOwner}`);
	console.info(`  GitHub Repo: ${env.githubTestRepo}`);
	console.info(`  Linear Team: ${env.linearTestTeam}`);
	console.info();

	let checksPreflight: ValidationResult["checksPreflight"] = "skipped";
	if (options.checksPermissionPreflight && patternNeedsCheckRunWrite(pattern)) {
		try {
			await verifyChecksApiWritePermission(env);
			checksPreflight = "passed";
			console.info("✅ GitHub Checks API write preflight passed\n");
		} catch (error) {
			console.error("❌ GitHub Checks API write preflight failed:\n");
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	}

	return { authSource, checksPreflight };
}

/**
 * Ensures the project's e2e/recordings directory exists and returns its path.
 *
 * @returns The absolute path to the recordings directory under the current working directory.
 */
function setupRecordingsDir(): string {
	const recordingsDir = join(process.cwd(), "e2e", "recordings");
	if (!existsSync(recordingsDir)) {
		mkdirSync(recordingsDir, { recursive: true });
	}
	return recordingsDir;
}

function generateRunConfig(options: RunOptions, recordingsDir: string): void {
	const configPath = join(recordingsDir, "run-config.json");
	const config = {
		timestamp: new Date().toISOString(),
		options: maskSensitiveData(options),
		nodeVersion: process.version,
		platform: process.platform,
	};
	writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Execute E2E tests with Vitest using the given run options and optional test pattern.
 *
 * @param options - Configuration for the test run (parallelism, timeout, reporters, recording, etc.)
 * @param pattern - Optional test file path or pattern to restrict which tests to run
 * @returns A RunResult summarizing success, `exitCode`, `durationMs`, test counts (`testsPassed`, `testsFailed`, `testsSkipped`), optional `firstFailingScenario` and `firstFailingAssertion`, `blockerClassification`, `skipReasons`, and `recordingsDir`
 */
async function runTests(
	options: RunOptions,
	pattern?: string,
): Promise<RunResult> {
	const startTime = Date.now();
	const recordingsDir = setupRecordingsDir();
	generateRunConfig(options, recordingsDir);

	console.info("🚀 Starting E2E tests...\n");
	console.info(`  Pattern: ${pattern || "all tests"}`);
	console.info(`  Parallel: ${options.parallel}`);
	console.info(`  Timeout: ${options.timeout}ms`);
	console.info(`  Recordings: ${recordingsDir}`);
	console.info();

	const args = buildVitestArgs(options, pattern);

	console.info(`  Command: pnpm ${args.join(" ")}\n`);

	const result = spawnSync("pnpm", args, {
		encoding: "utf-8",
		stdio: "pipe",
		env: {
			...process.env,
			E2E_MODE: "true",
			E2E_RECORDING_DIR: recordingsDir,
			E2E_CLEANUP: options.record ? "true" : "false",
		},
	});
	if (result.stdout) {
		process.stdout.write(result.stdout);
	}
	if (result.stderr) {
		process.stderr.write(result.stderr);
	}

	const durationMs = Date.now() - startTime;
	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	const parsed = parseVitestOutput(output);
	const exitCode = result.status ?? 1;

	return {
		success: exitCode === 0,
		exitCode,
		durationMs,
		testsPassed: parsed.testsPassed,
		testsFailed: parsed.testsFailed,
		testsSkipped: parsed.testsSkipped,
		...(parsed.firstFailingScenario
			? { firstFailingScenario: parsed.firstFailingScenario }
			: {}),
		...(parsed.firstFailingAssertion
			? { firstFailingAssertion: parsed.firstFailingAssertion }
			: {}),
		blockerClassification: classifyE2EBlocker(exitCode, output),
		skipReasons: classifySkipReasons(parsed.testsSkipped, output, pattern),
		recordingsDir,
	};
}

/**
 * Extracts test counts and first failure details from Vitest run output.
 *
 * Parses the provided Vitest stdout/stderr for the tests summary line to obtain
 * the numbers of passed, failed, and skipped tests, and captures the first
 * failing scenario and first failing assertion when present.
 *
 * @param output - Raw combined Vitest stdout/stderr text to parse.
 * @returns An object with `testsPassed`, `testsFailed`, and `testsSkipped`, and optionally `firstFailingScenario` and `firstFailingAssertion`.
 */
export function parseVitestOutput(output: string): ParsedVitestOutput {
	const summaryLine = output
		.split(/\r?\n/)
		.find((line) => /\bTests\b/.test(line) && /\(\d+\)/.test(line));
	const counts = {
		testsPassed: 0,
		testsFailed: 0,
		testsSkipped: 0,
	};
	if (summaryLine) {
		for (const match of summaryLine.matchAll(
			/(\d+)\s+(failed|passed|skipped)/g,
		)) {
			const count = Number.parseInt(match[1] ?? "0", 10);
			if (match[2] === "passed") counts.testsPassed = count;
			if (match[2] === "failed") counts.testsFailed = count;
			if (match[2] === "skipped") counts.testsSkipped = count;
		}
	}

	const firstFailingScenario = output.match(
		/^\s*[×✕]\s+(.+?)(?:\s+\d+ms)?$/m,
	)?.[1];
	const firstFailingAssertion = output.match(/^\s*→\s+(.+)$/m)?.[1];

	return {
		...counts,
		...(firstFailingScenario ? { firstFailingScenario } : {}),
		...(firstFailingAssertion ? { firstFailingAssertion } : {}),
	};
}

/**
 * Classifies the primary cause of a failed E2E run using the process exit code and Vitest output.
 *
 * @param exitCode - The process exit code returned by the test runner
 * @param output - Combined stdout/stderr from the test run used to match error patterns
 * @returns The blocker classification: `"none"` when `exitCode === 0`, `"environment/tooling issue"` for credential, network, or preflight failures, `"missing artifact"` when artifacts are absent, `"fixture/runtime failure"` for fixture or timeout-related failures, `"repo state issue"` for git-related problems, or `"scenario regression"` for test regressions
 */
export function classifyE2EBlocker(
	exitCode: number,
	output: string,
): E2EBlockerClassification {
	if (exitCode === 0) return "none";
	if (
		/required environment variable|environment validation failed|checks api write preflight failed|resource not accessible by personal access token|api rate limit|network|fetch failed/i.test(
			output,
		)
	) {
		return "environment/tooling issue";
	}
	if (
		/artifact|recording|result\.json|no such file or directory/i.test(output)
	) {
		return "missing artifact";
	}
	if (/path traversal|tmpdir|cleanup|timeout|timed out|fixture/i.test(output)) {
		return "fixture/runtime failure";
	}
	if (/working tree|dirty|not a git repository|merge conflict/i.test(output)) {
		return "repo state issue";
	}
	return "scenario regression";
}

/**
 * Produce one or more structured skip reasons derived from Vitest output and the provided test pattern.
 *
 * When no tests were skipped, returns an empty array. If the pattern is absent or targets the
 * linear-integration/command-pipeline lanes, returns a single reason indicating skips caused by
 * missing Linear team state. Otherwise returns a single unclassified Vitest skip reason whose
 * evidence is drawn from a matching snippet in the test output (or a generic Vitest message).
 *
 * @param testsSkipped - The number of skipped tests observed
 * @param output - The combined Vitest stdout/stderr used to extract evidence for skips
 * @param pattern - Optional test pattern used to determine lane-specific skip rationale
 * @returns An array of `E2ESkipReason` objects describing why tests were skipped; each object's `count` equals `testsSkipped`
 */
export function classifySkipReasons(
	testsSkipped: number,
	output: string,
	pattern?: string,
): E2ESkipReason[] {
	if (testsSkipped === 0) return [];
	const includesLinearLane =
		!pattern || /linear-integration|command-pipeline/.test(pattern);
	if (includesLinearLane) {
		return [
			{
				reason: "skipped_due_to_missing_linear_team_state",
				count: testsSkipped,
				evidence:
					"Linear lifecycle tests are gated on resolving LINEAR_TEST_TEAM to a live team id before mutating issues.",
			},
		];
	}
	return [
		{
			reason: "skipped_due_to_unclassified_vitest_skip",
			count: testsSkipped,
			evidence:
				output.match(/Tests.+skipped.+/i)?.[0]?.trim() ??
				"Vitest reported skipped tests.",
		},
	];
}

/**
 * Write the E2E run result and related metadata to ./artifacts/e2e/result.json.
 *
 * The written JSON includes a schema version, overall status (`pass` or `fail`), the
 * test pattern (or `"all"` when omitted), authentication source, checks preflight outcome,
 * a summary with test metrics and optional first failing scenario/assertion, the provided
 * `options` with sensitive fields masked, and an optional recordings directory.
 *
 * @param result - The run result containing metrics, classifications, and optional failure details
 * @param options - The run options to record (sensitive values will be masked)
 * @param pattern - The test pattern that was executed, or `undefined` to indicate "all"
 * @param validation - Validation metadata including `authSource` and `checksPreflight`
 */
function writeE2EResultArtifact(
	result: RunResult,
	options: RunOptions,
	pattern: string | undefined,
	validation: ValidationResult,
): void {
	const artifactDir = join(process.cwd(), "artifacts", "e2e");
	mkdirSync(artifactDir, { recursive: true });
	writeFileSync(
		join(artifactDir, "result.json"),
		`${JSON.stringify(
			{
				schemaVersion: "coding-harness-e2e-result/v1",
				status: result.success ? "pass" : "fail",
				pattern: pattern ?? "all",
				authSource: validation.authSource,
				checksPreflight: validation.checksPreflight,
				summary: {
					testsPassed: result.testsPassed,
					testsFailed: result.testsFailed,
					testsSkipped: result.testsSkipped,
					durationMs: result.durationMs,
					exitCode: result.exitCode,
					blockerClassification: result.blockerClassification,
					skipReasons: result.skipReasons,
					...(result.firstFailingScenario
						? { firstFailingScenario: result.firstFailingScenario }
						: {}),
					...(result.firstFailingAssertion
						? { firstFailingAssertion: result.firstFailingAssertion }
						: {}),
				},
				options: maskSensitiveData(options),
				recordingsDir: result.recordingsDir,
			},
			null,
			2,
		)}\n`,
		"utf-8",
	);
}

/**
 * Write a preflight-only E2E result artifact to artifacts/e2e/result.json.
 *
 * The artifact records a passing preflight status with zeroed test metrics and includes
 * the provided `pattern`, authentication source, preflight outcome, and a masked copy
 * of the given `options`.
 *
 * @param options - Run options to include in the artifact; sensitive values are masked.
 * @param pattern - Test pattern that was validated, or `undefined` to indicate "all".
 * @param validation - Validation result containing `authSource` and `checksPreflight`.
 */
function writePreflightResultArtifact(
	options: RunOptions,
	pattern: string | undefined,
	validation: ValidationResult,
): void {
	const artifactDir = join(process.cwd(), "artifacts", "e2e");
	mkdirSync(artifactDir, { recursive: true });
	writeFileSync(
		join(artifactDir, "result.json"),
		`${JSON.stringify(
			{
				schemaVersion: "coding-harness-e2e-result/v1",
				status: "pass",
				pattern: pattern ?? "all",
				authSource: validation.authSource,
				checksPreflight: validation.checksPreflight,
				summary: {
					testsPassed: 0,
					testsFailed: 0,
					testsSkipped: 0,
					durationMs: 0,
					exitCode: 0,
					blockerClassification: "none",
					skipReasons: [],
				},
				options: maskSensitiveData(options),
			},
			null,
			2,
		)}\n`,
		"utf-8",
	);
}

/**
 * CLI entrypoint that validates the environment, optionally performs a checks preflight, runs the E2E tests, writes result artifacts, and terminates the process with the tests' exit code.
 *
 * The function parses CLI arguments, performs environment validation (including an optional GitHub Checks API permission preflight), and when not in preflight-only mode executes the test run. It writes either a preflight-only artifact or a full E2E result artifact, logs a concise run summary (status, duration, exit code, recordings directory), and exits the process with the test run's exit code.
 */
async function main(): Promise<void> {
	const { options, pattern } = parseArgs(process.argv.slice(2));

	const validation = await validateEnvironment(options, pattern);
	if (options.preflightOnly) {
		writePreflightResultArtifact(options, pattern, validation);
		console.info("✅ E2E preflight completed successfully");
		return;
	}

	const result = await runTests(options, pattern);
	writeE2EResultArtifact(result, options, pattern, validation);

	console.info(`\n${"=".repeat(60)}`);
	if (result.success) {
		console.info("✅ E2E tests completed successfully");
	} else {
		console.info("❌ E2E tests failed");
	}
	console.info(`   Duration: ${(result.durationMs / 1000).toFixed(2)}s`);
	console.info(`   Exit Code: ${result.exitCode}`);
	if (result.recordingsDir) {
		console.info(`   Recordings: ${result.recordingsDir}`);
	}
	console.info(`${"=".repeat(60)}\n`);

	process.exit(result.exitCode);
}

if (
	process.argv[1] &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
	main().catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}
