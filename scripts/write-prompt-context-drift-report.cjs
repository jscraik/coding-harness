#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, mkdirSync, realpathSync } = require("node:fs");
const { pathToFileURL } = require("node:url");

const DEFAULT_OUTPUT_PATH =
	"artifacts/context-integrity/prompt-context-drift-report.json";

function parseArgs(argv) {
	const parsed = {
		errors: [],
		outputPath: DEFAULT_OUTPUT_PATH,
		repoRoot: process.cwd(),
	};
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
		if (arg === "--output") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				parsed.errors.push("--output: requires a value");
				continue;
			}
			parsed.outputPath = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			parsed.errors.push("unknown option");
			continue;
		}
		parsed.errors.push("unexpected positional argument");
	}
	return parsed;
}

function printResult(status, errors, outputPath, exitCode) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "prompt-context-drift-write/v1",
				status,
				outputPath,
				errors,
			},
			null,
		),
	);
	process.exit(exitCode);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.errors.length > 0) {
		printResult("fail", args.errors, args.outputPath, 2);
	}

	const repoRoot = path.resolve(args.repoRoot);
	const moduleRoot = path.resolve(__dirname, "..");
	const outputTarget = prepareOutputTarget(repoRoot, args.outputPath);
	if (!outputTarget.ok) {
		printResult("fail", [outputTarget.error], args.outputPath, 2);
	}
	const outputPath = outputTarget.path;
	const moduleUrl = pathToFileURL(
		path.join(moduleRoot, "src/lib/prompt-context-drift/index.ts"),
	).href;
	const runner = [
		"import { renameSync, rmSync, writeFileSync } from 'node:fs';",
		"const moduleUrl = process.env.PROMPT_CONTEXT_DRIFT_MODULE_URL;",
		"const outputPath = process.env.PROMPT_CONTEXT_DRIFT_OUTPUT_PATH;",
		"const tempOutputPath = process.env.PROMPT_CONTEXT_DRIFT_TEMP_OUTPUT_PATH;",
		"const repoRoot = process.env.PROMPT_CONTEXT_DRIFT_REPO_ROOT;",
		"const { buildPromptContextDriftReport, validatePromptContextDriftReport } = await import(moduleUrl);",
		"const report = buildPromptContextDriftReport({ repoRoot });",
		"const validation = validatePromptContextDriftReport(report, { repoRoot });",
		"try { rmSync(tempOutputPath, { force: true }); } catch {}",
		"writeFileSync(tempOutputPath, JSON.stringify(report, null, 2) + '\\n', { flag: 'wx' });",
		"renameSync(tempOutputPath, outputPath);",
		"console.log(JSON.stringify({ schemaVersion: 'prompt-context-drift-write/v1', status: validation.status, outputPath: process.env.PROMPT_CONTEXT_DRIFT_RELATIVE_OUTPUT_PATH, errors: validation.errors }, null, 2));",
		"process.exit(validation.status === 'pass' ? 0 : 1);",
	].join("\n");

	const child = spawnSync(
		process.execPath,
		["--import", "tsx", "--eval", runner],
		{
			cwd: moduleRoot,
			env: {
				...process.env,
				PROMPT_CONTEXT_DRIFT_MODULE_URL: moduleUrl,
				PROMPT_CONTEXT_DRIFT_OUTPUT_PATH: outputPath,
				PROMPT_CONTEXT_DRIFT_TEMP_OUTPUT_PATH: outputTarget.tempPath,
				PROMPT_CONTEXT_DRIFT_RELATIVE_OUTPUT_PATH: args.outputPath,
				PROMPT_CONTEXT_DRIFT_REPO_ROOT: repoRoot,
			},
			encoding: "utf8",
		},
	);
	if (child.error) {
		printResult("fail", ["child process failed"], args.outputPath, 1);
	}
	if (child.stdout) process.stdout.write(child.stdout);
	if (child.stderr) process.stderr.write(child.stderr);
	process.exit(child.status === null ? 1 : child.status);
}

function prepareOutputTarget(repoRoot, requestedPath) {
	const realRepoRoot = realpathSync(repoRoot);
	const absolute = path.resolve(repoRoot, requestedPath);
	const relativePath = path.relative(repoRoot, absolute);
	if (
		relativePath === ".." ||
		relativePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativePath)
	) {
		return { ok: false, error: "--output: must stay inside the repository" };
	}
	const parentResult = ensureSafeParentDirectory(realRepoRoot, relativePath);
	if (!parentResult.ok) return parentResult;
	if (existsSync(absolute)) {
		const stat = lstatSync(absolute);
		if (stat.isSymbolicLink()) {
			return { ok: false, error: "--output: must not be a symbolic link" };
		}
		if (!stat.isFile()) {
			return { ok: false, error: "--output: must be a file path" };
		}
	}
	const tempPath = path.join(
		realRepoRoot,
		path.dirname(relativePath),
		`.${path.basename(absolute)}.${process.pid}.tmp`,
	);
	return { ok: true, path: absolute, tempPath };
}

function ensureSafeParentDirectory(realRepoRoot, relativeOutputPath) {
	const parentRelative = path.dirname(relativeOutputPath);
	if (parentRelative === ".") {
		return { ok: true };
	}
	let current = realRepoRoot;
	for (const segment of parentRelative.split(/[\\/]+/)) {
		if (!segment || segment === ".") continue;
		if (segment === "..") {
			return { ok: false, error: "--output: must stay inside the repository" };
		}
		current = path.join(current, segment);
		if (existsSync(current)) {
			const stat = lstatSync(current);
			if (stat.isSymbolicLink()) {
				return {
					ok: false,
					error: "--output: parent directory must not be a symbolic link",
				};
			}
			if (!stat.isDirectory()) {
				return {
					ok: false,
					error: "--output: parent path must be a directory",
				};
			}
			continue;
		}
		mkdirSync(current);
	}
	const realParent = realpathSync(path.join(realRepoRoot, parentRelative));
	const relativeRealParent = path.relative(realRepoRoot, realParent);
	if (
		relativeRealParent === ".." ||
		relativeRealParent.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativeRealParent)
	) {
		return { ok: false, error: "--output: must stay inside the repository" };
	}
	return { ok: true };
}

main();
