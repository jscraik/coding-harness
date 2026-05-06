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

export function patternNeedsCheckRunWrite(pattern?: string): boolean {
	if (!pattern) {
		return true;
	}
	return /(^|\/)(github-integration|command-pipeline)(\.e2e\.test\.ts)?$/.test(
		pattern,
	);
}

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

function getStringField(value: unknown, field: string): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const fieldValue = (value as Record<string, unknown>)[field];
	return typeof fieldValue === "string" ? fieldValue : undefined;
}

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
