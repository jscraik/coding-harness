#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, mkdirSync, realpathSync } = require("node:fs");

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

function safeDisplayPath(value) {
	const normalized =
		normalizeRepoRelativePath(value || DEFAULT_OUTPUT_PATH) ??
		DEFAULT_OUTPUT_PATH;
	return normalized;
}

function normalizeRepoRelativePath(value) {
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}
	const normalized = path
		.normalize(value)
		.replace(/\\/g, "/")
		.replace(/^\.\//, "");
	if (
		normalized.length === 0 ||
		normalized === "." ||
		normalized.includes("/../") ||
		normalized.startsWith("..") ||
		normalized.startsWith("../") ||
		normalized.startsWith("/") ||
		/[\r\n\0]/.test(normalized)
	) {
		return null;
	}
	return normalized;
}

function repoAbsolutePath(realRepoRoot, repoRelativePath) {
	return [realRepoRoot, ...repoRelativePath.split("/")].join(path.sep);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.errors.length > 0) {
		printResult("fail", args.errors, safeDisplayPath(args.outputPath), 2);
	}

	const repoRoot = path.resolve(args.repoRoot);
	const moduleRoot = path.resolve(__dirname, "..");
	const outputTarget = prepareOutputTarget(repoRoot, args.outputPath);
	if (!outputTarget.ok) {
		printResult("fail", [outputTarget.error], DEFAULT_OUTPUT_PATH, 2);
	}
	const outputPath = outputTarget.path;
	const runnerPath = path.join(
		moduleRoot,
		"scripts/lib/prompt-context-drift-write-runner.mjs",
	);
	const tsxLoader = require.resolve("tsx", { paths: [moduleRoot] });

	const child = spawnSync(
		process.execPath,
		["--import", tsxLoader, runnerPath],
		{
			cwd: repoRoot,
			env: {
				...process.env,
				PROMPT_CONTEXT_DRIFT_OUTPUT_PATH: outputPath,
				PROMPT_CONTEXT_DRIFT_TEMP_OUTPUT_PATH: outputTarget.tempPath,
				PROMPT_CONTEXT_DRIFT_RELATIVE_OUTPUT_PATH: outputTarget.displayPath,
				PROMPT_CONTEXT_DRIFT_REPO_ROOT: repoRoot,
			},
			encoding: "utf8",
		},
	);
	if (child.error) {
		printResult("fail", ["child process failed"], outputTarget.displayPath, 1);
	}
	if (child.stdout) process.stdout.write(child.stdout);
	if (child.stderr) process.stderr.write(child.stderr);
	process.exit(child.status === null ? 1 : child.status);
}

function prepareOutputTarget(repoRoot, requestedPath) {
	const realRepoRoot = realpathSync(repoRoot);
	const relativePath = normalizeRepoRelativePath(requestedPath);
	if (relativePath === null) {
		return { ok: false, error: "--output: must stay inside the repository" };
	}
	const absolute = repoAbsolutePath(realRepoRoot, relativePath);
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
	const parentRelative = path.dirname(relativePath).replace(/\\/g, "/");
	const tempPath = repoAbsolutePath(
		realRepoRoot,
		[
			parentRelative === "." ? "" : parentRelative,
			`.${path.basename(absolute)}.${process.pid}.tmp`,
		]
			.filter(Boolean)
			.join("/"),
	);
	return {
		ok: true,
		path: absolute,
		tempPath,
		displayPath: safeDisplayPath(relativePath),
	};
}

function ensureSafeParentDirectory(realRepoRoot, relativeOutputPath) {
	const parentRelative = path.dirname(relativeOutputPath);
	if (parentRelative === ".") {
		return { ok: true };
	}
	let current = realRepoRoot;
	for (const segment of parentRelative.split(/[\\/]+/)) {
		if (!segment || segment === ".") continue;
		if (segment === ".." || /[\r\n\0]/.test(segment)) {
			return { ok: false, error: "--output: must stay inside the repository" };
		}
		const candidatePath = [current, segment].join(path.sep);
		const relativeCandidate = path.relative(realRepoRoot, candidatePath);
		if (
			relativeCandidate === ".." ||
			relativeCandidate.startsWith(`..${path.sep}`) ||
			path.isAbsolute(relativeCandidate)
		) {
			return { ok: false, error: "--output: must stay inside the repository" };
		}
		current = candidatePath;
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
	const realParent = realpathSync(
		repoAbsolutePath(realRepoRoot, parentRelative),
	);
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
