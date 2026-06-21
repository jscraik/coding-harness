#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function parseArgs(argv) {
	const parsed = { errors: [], reportPath: null, repoRoot: process.cwd() };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--repo-root") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				parsed.errors.push("--repo-root: requires a value");
				continue;
			}
			parsed.repoRoot = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			parsed.errors.push(`${arg}: unknown option`);
			continue;
		}
		if (!parsed.reportPath) {
			parsed.reportPath = arg;
			continue;
		}
		parsed.errors.push(`${arg}: unexpected positional argument`);
	}
	return parsed;
}

function printResult(status, errors, exitCode) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-validation/v1",
				status,
				errors,
			},
			null,
			2,
		),
	);
	process.exit(exitCode);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.errors.length > 0) {
		printResult("fail", args.errors, 2);
	}
	if (!args.reportPath) {
		printResult("fail", ["reportPath: is required"], 2);
	}

	const repoRoot = path.resolve(args.repoRoot);
	const moduleRoot = path.resolve(__dirname, "..");
	const reportPath = path.resolve(repoRoot, args.reportPath);
	const moduleUrl = pathToFileURL(
		path.join(moduleRoot, "src/lib/prompt-context-drift/index.ts"),
	).href;
	const runner = [
		"import { readFileSync } from 'node:fs';",
		"const moduleUrl = process.env.PROMPT_CONTEXT_DRIFT_MODULE_URL;",
		"const reportPath = process.env.PROMPT_CONTEXT_DRIFT_REPORT_PATH;",
		"const repoRoot = process.env.PROMPT_CONTEXT_DRIFT_REPO_ROOT;",
		"const { validatePromptContextDriftReport } = await import(moduleUrl);",
		"let report;",
		"try {",
		"  report = JSON.parse(readFileSync(reportPath, 'utf8'));",
		"} catch (error) {",
		"  console.log(JSON.stringify({ schemaVersion: 'prompt-context-drift-validation/v1', status: 'fail', errors: ['report: cannot read JSON: ' + error.message] }, null, 2));",
		"  process.exit(1);",
		"}",
		"const result = validatePromptContextDriftReport(report, { repoRoot });",
		"console.log(JSON.stringify({ schemaVersion: 'prompt-context-drift-validation/v1', ...result }, null, 2));",
		"process.exit(result.status === 'pass' ? 0 : 1);",
	].join("\n");

	if (!fs.existsSync(reportPath)) {
		printResult("fail", ["reportPath: file does not exist"], 1);
	}

	const child = spawnSync(
		process.execPath,
		["--import", "tsx", "--eval", runner],
		{
			cwd: moduleRoot,
			env: {
				...process.env,
				PROMPT_CONTEXT_DRIFT_MODULE_URL: moduleUrl,
				PROMPT_CONTEXT_DRIFT_REPORT_PATH: reportPath,
				PROMPT_CONTEXT_DRIFT_REPO_ROOT: repoRoot,
			},
			encoding: "utf8",
		},
	);
	if (child.error) {
		printResult("fail", [`child process failed: ${child.error.message}`], 1);
	}
	if (child.stdout) process.stdout.write(child.stdout);
	if (child.stderr) process.stderr.write(child.stderr);
	process.exit(child.status === null ? 1 : child.status);
}

main();
