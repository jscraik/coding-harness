#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

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
			parsed.errors.push("unknown option");
			continue;
		}
		if (!parsed.reportPath) {
			parsed.reportPath = arg;
			continue;
		}
		parsed.errors.push("unexpected positional argument");
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
	const baseUrl = pathToFileURL(
		realRepoRoot.endsWith(path.sep)
			? realRepoRoot
			: `${realRepoRoot}${path.sep}`,
	);
	const encodedPath = repoRelativePath
		.split("/")
		.map(encodeURIComponent)
		.join("/");
	const absolute = fileURLToPath(new URL(encodedPath, baseUrl));
	const relativePath = path.relative(realRepoRoot, absolute);
	if (
		relativePath === ".." ||
		relativePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativePath)
	) {
		throw new Error("repo path escaped repository root");
	}
	return absolute;
}

function resolveRepoRoot(requestedRoot) {
	const base = fs.realpathSync(process.cwd());
	const rootRequest = requestedRoot || ".";
	let targetCandidate;
	if (rootRequest === ".") {
		targetCandidate = base;
	} else if (path.isAbsolute(rootRequest)) {
		targetCandidate = rootRequest;
	} else {
		const relativeRoot = normalizeRepoRelativePath(rootRequest);
		if (relativeRoot === null) {
			return {
				ok: false,
				error: "repoRoot: must stay inside the current working directory",
			};
		}
		targetCandidate = repoAbsolutePath(base, relativeRoot);
	}
	let target;
	try {
		target = fs.realpathSync(targetCandidate);
	} catch {
		return { ok: false, error: "repoRoot: path does not exist" };
	}
	const relativeTarget = path.relative(base, target);
	if (
		relativeTarget === ".." ||
		relativeTarget.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativeTarget)
	) {
		return {
			ok: false,
			error: "repoRoot: must stay inside the current working directory",
		};
	}
	return { ok: true, path: target };
}

function prepareReportPath(repoRoot, requestedPath) {
	const realRepoRoot = fs.realpathSync(repoRoot);
	if (
		typeof requestedPath !== "string" ||
		requestedPath.trim().length === 0 ||
		/[\r\n\0]/.test(requestedPath)
	) {
		return { ok: false, error: "reportPath: must stay inside the repository" };
	}
	let absolute;
	if (path.isAbsolute(requestedPath)) {
		absolute = requestedPath;
	} else {
		const relativePath = normalizeRepoRelativePath(requestedPath);
		if (relativePath === null) {
			return {
				ok: false,
				error: "reportPath: must stay inside the repository",
			};
		}
		absolute = repoAbsolutePath(realRepoRoot, relativePath);
	}
	const relativeAbsolutePath = path.relative(realRepoRoot, absolute);
	if (
		relativeAbsolutePath === ".." ||
		relativeAbsolutePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativeAbsolutePath)
	) {
		return { ok: false, error: "reportPath: must stay inside the repository" };
	}
	if (!fs.existsSync(absolute)) {
		return { ok: false, error: "reportPath: file does not exist" };
	}
	const stat = fs.lstatSync(absolute);
	if (stat.isSymbolicLink()) {
		return { ok: false, error: "reportPath: must not be a symbolic link" };
	}
	if (!stat.isFile()) {
		return { ok: false, error: "reportPath: must be a file path" };
	}
	const realReportPath = fs.realpathSync(absolute);
	const relativeRealPath = path.relative(realRepoRoot, realReportPath);
	if (
		relativeRealPath === ".." ||
		relativeRealPath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativeRealPath)
	) {
		return { ok: false, error: "reportPath: must stay inside the repository" };
	}
	return { ok: true, path: realReportPath };
}

function shouldBindLiveHead(moduleRoot, reportPath) {
	const examplesRoot = repoAbsolutePath(moduleRoot, "contracts/examples");
	const relativeExamplePath = path.relative(examplesRoot, reportPath);
	return (
		relativeExamplePath === ".." ||
		relativeExamplePath.startsWith(`..${path.sep}`) ||
		path.isAbsolute(relativeExamplePath)
	);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.errors.length > 0) {
		printResult("fail", args.errors, 2);
	}
	if (!args.reportPath) {
		printResult("fail", ["reportPath: is required"], 2);
	}

	const repoRootTarget = resolveRepoRoot(args.repoRoot);
	if (!repoRootTarget.ok) {
		printResult("fail", [repoRootTarget.error], 2);
	}
	const repoRoot = repoRootTarget.path;
	const moduleRoot = path.resolve(__dirname, "..");
	const reportTarget = prepareReportPath(repoRoot, args.reportPath);
	const runnerPath = path.join(
		moduleRoot,
		"scripts/lib/prompt-context-drift-validate-runner.mjs",
	);
	const tsxLoader = require.resolve("tsx", { paths: [moduleRoot] });

	if (!reportTarget.ok) {
		printResult("fail", [reportTarget.error], 1);
	}
	let reportContent;
	try {
		reportContent = fs.readFileSync(reportTarget.path, "utf8");
	} catch {
		printResult("fail", ["reportPath: file cannot be read"], 1);
	}

	const child = spawnSync(
		process.execPath,
		["--import", tsxLoader, runnerPath],
		{
			cwd: repoRoot,
			env: {
				...process.env,
				PROMPT_CONTEXT_DRIFT_BIND_LIVE_HEAD: shouldBindLiveHead(
					moduleRoot,
					reportTarget.path,
				)
					? "true"
					: "false",
				PROMPT_CONTEXT_DRIFT_REPO_ROOT: repoRoot,
			},
			encoding: "utf8",
			input: reportContent,
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
