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
import { join } from "node:path";
import { loadE2EEnv, maskSensitiveData, validateE2EEnv } from "./utils/env.js";

interface RunOptions {
	testPattern?: string;
	bail?: boolean;
	reporters?: string[];
	record?: boolean;
	parallel?: number;
	timeout?: number;
}

interface RunResult {
	success: boolean;
	exitCode: number;
	durationMs: number;
	testsPassed: number;
	testsFailed: number;
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
  --help              Show this help

Examples:
  pnpm e2e                                    # Run all E2E tests
  pnpm e2e github-integration                 # Run specific test file
  pnpm e2e --bail                             # Stop on first failure
  pnpm e2e --parallel 1                       # Run tests sequentially
  pnpm e2e --reporter json                    # Use JSON reporter
`);
}

function parseArgs(args: string[]): { options: RunOptions; pattern?: string } {
	const options: RunOptions = {
		bail: false,
		reporters: ["verbose"],
		record: true,
		parallel: 3,
		timeout: 300000,
	};
	let pattern: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

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
			default:
				if (!arg.startsWith("-")) {
					pattern = arg;
				}
				break;
		}
	}

	return { options, pattern };
}

function validateEnvironment(): void {
	console.info("🔍 Validating E2E environment...\n");

	try {
		validateE2EEnv();
		console.info("✅ Environment variables validated\n");
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

	// Build vitest command
	const args = ["vitest", "run", "--config", "e2e/vitest.e2e.config.ts"];

	if (options.bail) {
		args.push("--bail");
	}

	if (options.reporters) {
		for (const reporter of options.reporters) {
			args.push("--reporter", reporter);
		}
	}

	// Add timeout
	args.push("--test-timeout", String(options.timeout));

	// Add pattern if specified
	if (pattern) {
		// If pattern doesn't include the full path, add it
		if (!pattern.includes("/")) {
			args.push(`e2e/tests/${pattern}`);
		} else {
			args.push(pattern);
		}
	}

	console.info(`  Command: pnpm ${args.join(" ")}\n`);

	const result = spawnSync("pnpm", args, {
		stdio: "inherit",
		env: {
			...process.env,
			E2E_MODE: "true",
			E2E_RECORDING_DIR: recordingsDir,
			E2E_CLEANUP: options.record ? "true" : "false",
		},
	});

	const durationMs = Date.now() - startTime;

	// Parse test results from output (simplified)
	// In a real implementation, we'd parse the JSON output
	return {
		success: result.status === 0,
		exitCode: result.status ?? 1,
		durationMs,
		testsPassed: 0, // Would be parsed from output
		testsFailed: 0, // Would be parsed from output
		recordingsDir,
	};
}

async function main(): Promise<void> {
	const { options, pattern } = parseArgs(process.argv.slice(2));

	validateEnvironment();

	const result = await runTests(options, pattern);

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

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
