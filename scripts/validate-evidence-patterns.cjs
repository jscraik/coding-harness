#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
let ROOT = DEFAULT_ROOT;
let MANIFEST_PATH = path.join(
	ROOT,
	".harness",
	"research",
	"evidence-patterns.json",
);
let DEEP_DIR = path.join(ROOT, ".harness", "research", "deep");
const ADOPTED_STATUSES = new Set([
	"enforcement_backed",
	"implementation_backed",
]);
const VALID_STATUSES = new Set([
	"documented_only",
	"planning_only",
	"enforcement_backed",
	"implementation_backed",
	"deferred",
	"adopted",
	"rejected",
]);
const VALID_OWNERS = new Set(["codex", "jamie"]);

function relative(filePath) {
	return toPosixPath(path.relative(ROOT, filePath));
}

function parseArgs(argv) {
	const options = {
		commandTimeoutMs: 180_000,
		deepDir: null,
		json: false,
		manifestPath: null,
		root: DEFAULT_ROOT,
		runValidationCommands: false,
		strictAdopted: false,
		usageErrors: [],
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") {
			options.json = true;
		} else if (arg === "--run-validation-commands") {
			options.runValidationCommands = true;
		} else if (arg === "--strict-adopted") {
			options.strictAdopted = true;
			options.runValidationCommands = true;
		} else if (arg === "--command-timeout-ms") {
			index += 1;
			const timeoutMs = Number(argv[index]);
			if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
				options.usageErrors.push({
					code: "usage_invalid_value",
					message: "--command-timeout-ms requires a positive integer",
				});
			} else {
				options.commandTimeoutMs = timeoutMs;
			}
		} else if (arg === "--root") {
			index += 1;
			if (!hasText(argv[index]) || isFlag(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--root requires a path value",
				});
			} else {
				options.root = path.resolve(argv[index]);
			}
		} else if (arg === "--manifest") {
			index += 1;
			if (!hasText(argv[index]) || isFlag(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--manifest requires a path value",
				});
			} else {
				options.manifestPath = argv[index];
			}
		} else if (arg === "--deep-dir") {
			index += 1;
			if (!hasText(argv[index]) || isFlag(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--deep-dir requires a path value",
				});
			} else {
				options.deepDir = argv[index];
			}
		} else {
			options.usageErrors.push({
				code: "usage_unknown_option",
				message: `unknown option: ${arg}`,
			});
		}
	}
	return options;
}

function readJson(filePath, errors) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		errors.push({
			code: "invalid_json",
			path: relative(filePath),
			message: String(error),
		});
		return null;
	}
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function isFlag(value) {
	return typeof value === "string" && value.startsWith("-");
}

function toPosixPath(value) {
	return String(value || "").replaceAll("\\", "/");
}

function resolveFromRoot(root, value) {
	return path.isAbsolute(value)
		? path.resolve(value)
		: path.resolve(root, value);
}

function isInsideRoot(root, absolutePath) {
	const relativePath = path.relative(root, absolutePath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
	);
}

function isAdoptedPattern(pattern) {
	return ADOPTED_STATUSES.has(pattern.status) || pattern.status === "adopted";
}

function normalizePatternStatus(status) {
	if (status === "adopted") return "implementation_backed";
	if (status === "rejected") return "deferred";
	return status;
}

function deepEvidenceFiles(deepDir) {
	if (!isInsideRoot(ROOT, deepDir)) return [];
	if (!fs.existsSync(deepDir)) return [];
	const relativeDeepDir = relative(deepDir);
	return fs
		.readdirSync(deepDir)
		.filter((name) => name.endsWith(".md"))
		.map((name) => path.posix.join(relativeDeepDir, name))
		.sort();
}

function pathExists(repoRelativePath) {
	const resolved = path.resolve(ROOT, repoRelativePath);
	const relative = path.relative(ROOT, resolved);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		return false;
	}
	return fs.existsSync(resolved);
}

function validateTargetSurface(pattern, target, errors) {
	if (!hasText(target)) {
		errors.push({
			code: "target_surface_empty",
			patternId: pattern.id,
			message: "targetSurfaces entries must be non-empty strings",
		});
		return;
	}
	if (
		target.startsWith("http://") ||
		target.startsWith("https://") ||
		target.startsWith("linear:") ||
		target.startsWith("issue:")
	) {
		return;
	}
	if (!pathExists(target)) {
		errors.push({
			code: "target_surface_missing",
			patternId: pattern.id,
			path: target,
			message: "target surface does not exist",
		});
	}
}

function validatePattern(
	pattern,
	index,
	seenSources,
	seenIds,
	errors,
	deepDir,
	strictAdopted,
) {
	if (!isRecord(pattern)) {
		errors.push({
			code: "pattern_not_object",
			index,
			message: "pattern entry must be an object",
		});
		return;
	}

	if (!hasText(pattern.id)) {
		errors.push({
			code: "pattern_id_missing",
			index,
			message: "pattern.id must be a non-empty string",
		});
	} else if (seenIds.has(pattern.id)) {
		errors.push({
			code: "pattern_id_duplicate",
			patternId: pattern.id,
			message: "pattern.id must be unique",
		});
	} else {
		seenIds.add(pattern.id);
	}

	if (!hasText(pattern.source)) {
		errors.push({
			code: "source_missing",
			patternId: pattern.id,
			message: "pattern.source must be a non-empty string",
		});
	} else {
		const sourcePath = toPosixPath(pattern.source);
		seenSources.add(sourcePath);
		const relativeDeepDir = relative(deepDir);
		const expectedPrefix = relativeDeepDir === "." ? "" : `${relativeDeepDir}/`;
		if (expectedPrefix && !sourcePath.startsWith(expectedPrefix)) {
			errors.push({
				code: "source_not_deep_evidence",
				patternId: pattern.id,
				path: sourcePath,
				message: `pattern.source must point under ${relativeDeepDir}`,
			});
		}
		if (!pathExists(sourcePath)) {
			errors.push({
				code: "source_missing_file",
				patternId: pattern.id,
				path: sourcePath,
				message: "pattern.source does not exist",
			});
		}
	}

	if (!VALID_STATUSES.has(pattern.status)) {
		errors.push({
			code: "status_invalid",
			patternId: pattern.id,
			message:
				"pattern.status must be documented_only, planning_only, enforcement_backed, implementation_backed, deferred, adopted, or rejected",
		});
	}
	if (!VALID_OWNERS.has(pattern.owner)) {
		errors.push({
			code: "owner_invalid",
			patternId: pattern.id,
			message: "pattern.owner must be codex or jamie",
		});
	}
	if (
		strictAdopted &&
		isAdoptedPattern(pattern) &&
		!hasText(pattern.validationCommand)
	) {
		errors.push({
			code: "adopted_validation_command_missing",
			patternId: pattern.id,
			message: "adopted evidence patterns must declare a validationCommand",
		});
	}
	if (!hasText(pattern.dispositionReason)) {
		errors.push({
			code: "disposition_reason_missing",
			patternId: pattern.id,
			message:
				"pattern.dispositionReason must explain adoption, deferral, or rejection",
		});
	}
	if (!Array.isArray(pattern.targetSurfaces)) {
		errors.push({
			code: "target_surfaces_invalid",
			patternId: pattern.id,
			message: "pattern.targetSurfaces must be an array",
		});
		return;
	}
	if (
		strictAdopted &&
		isAdoptedPattern(pattern) &&
		pattern.targetSurfaces.length === 0
	) {
		errors.push({
			code: "adopted_target_surface_missing",
			patternId: pattern.id,
			message: "adopted patterns must name at least one target surface",
		});
	}
	for (const target of pattern.targetSurfaces) {
		validateTargetSurface(pattern, target, errors);
	}
}

function validateManifest(manifest, deepDir, strictAdopted) {
	const errors = [];
	if (!isRecord(manifest)) {
		return [
			{
				code: "manifest_not_object",
				message: "evidence patterns manifest must be an object",
			},
		];
	}
	if (manifest.schemaVersion !== "evidence-patterns/v1") {
		errors.push({
			code: "schema_version_invalid",
			message: "schemaVersion must be evidence-patterns/v1",
		});
	}
	if (!hasText(manifest.lastReviewedAt)) {
		errors.push({
			code: "last_reviewed_at_missing",
			message: "lastReviewedAt must be a non-empty string",
		});
	}
	if (!Array.isArray(manifest.patterns)) {
		errors.push({
			code: "patterns_invalid",
			message: "patterns must be an array",
		});
		return errors;
	}

	const seenSources = new Set();
	const seenIds = new Set();
	for (const [index, pattern] of manifest.patterns.entries()) {
		validatePattern(
			pattern,
			index,
			seenSources,
			seenIds,
			errors,
			deepDir,
			strictAdopted,
		);
	}
	for (const source of deepEvidenceFiles(deepDir)) {
		if (!seenSources.has(source)) {
			errors.push({
				code: "deep_evidence_untracked",
				path: source,
				message: "deep evidence file is missing from evidence-patterns.json",
			});
		}
	}
	return errors;
}

function runValidationCommands(manifest, timeoutMs) {
	const results = [];
	const commands = [
		...new Set(
			manifest.patterns
				.filter(isAdoptedPattern)
				.map((pattern) => pattern.validationCommand)
				.filter(hasText),
		),
	];
	for (const command of commands) {
		const startedAt = new Date().toISOString();
		const result = spawnSync(command, {
			cwd: ROOT,
			shell: process.env.SHELL || "zsh",
			encoding: "utf8",
			timeout: timeoutMs,
		});
		const spawnError =
			result.error instanceof Error ? result.error.message : null;
		const timedOut =
			result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
		results.push({
			command,
			declaredValidationCommand: command,
			executedCommand: command,
			status: result.status === 0 && spawnError === null ? "pass" : "fail",
			exitCode: result.status,
			error: spawnError,
			signal: result.signal ?? null,
			startedAt,
			finishedAt: new Date().toISOString(),
			stderr: result.stderr?.slice(0, 4000) ?? "",
			timedOut,
		});
	}
	return results;
}

function patternStatusSummary(manifest) {
	if (!manifest || !Array.isArray(manifest.patterns)) {
		return {
			counts: {},
			patterns: [],
		};
	}
	const counts = {};
	const patterns = manifest.patterns.filter(isRecord).map((pattern) => {
		const status = normalizePatternStatus(pattern.status);
		counts[status] = (counts[status] ?? 0) + 1;
		return {
			id: pattern.id,
			status,
			sourceStatus: pattern.status,
		};
	});
	return {
		counts,
		patterns,
	};
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	ROOT = path.resolve(options.root);
	MANIFEST_PATH = options.manifestPath
		? resolveFromRoot(ROOT, options.manifestPath)
		: path.join(ROOT, ".harness", "research", "evidence-patterns.json");
	DEEP_DIR = options.deepDir
		? resolveFromRoot(ROOT, options.deepDir)
		: path.join(ROOT, ".harness", "research", "deep");
	if (!isInsideRoot(ROOT, MANIFEST_PATH)) {
		options.usageErrors.push({
			code: "usage_path_outside_root",
			message: "--manifest must resolve inside --root",
			path: relative(MANIFEST_PATH),
		});
	}
	if (!isInsideRoot(ROOT, DEEP_DIR)) {
		options.usageErrors.push({
			code: "usage_path_outside_root",
			message: "--deep-dir must resolve inside --root",
			path: relative(DEEP_DIR),
		});
	}
	const errors = [...options.usageErrors];
	let manifest = null;
	if (errors.length === 0 && !fs.existsSync(MANIFEST_PATH)) {
		errors.push({
			code: "manifest_missing",
			path: relative(MANIFEST_PATH),
			message: "evidence-patterns.json does not exist",
		});
	} else if (errors.length === 0) {
		manifest = readJson(MANIFEST_PATH, errors);
		if (manifest)
			errors.push(
				...validateManifest(manifest, DEEP_DIR, options.strictAdopted),
			);
	}
	const validationCommands =
		options.runValidationCommands && manifest && errors.length === 0
			? runValidationCommands(manifest, options.commandTimeoutMs)
			: [];
	for (const commandResult of validationCommands) {
		if (commandResult.status !== "pass") {
			errors.push({
				code: "validation_command_failed",
				command: commandResult.command,
				error: commandResult.error,
				exitCode: commandResult.exitCode,
				message: "adopted pattern validation command failed",
				signal: commandResult.signal,
				stderr: commandResult.stderr,
				timedOut: commandResult.timedOut,
			});
		}
	}

	const report = {
		schemaVersion: "evidence-patterns-validation/v1",
		status:
			options.usageErrors.length > 0
				? "usage"
				: errors.length === 0
					? "pass"
					: "fail",
		manifest: relative(MANIFEST_PATH),
		deepEvidenceCount: deepEvidenceFiles(DEEP_DIR).length,
		strictAdopted: options.strictAdopted,
		statusSummary: patternStatusSummary(manifest),
		validationCommands,
		errors,
	};

	if (options.json) {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} else if (errors.length === 0) {
		process.stderr.write("[evidence-patterns] pass\n");
	} else {
		for (const error of errors) {
			process.stderr.write(
				`[evidence-patterns] ${error.code}: ${error.message}\n`,
			);
		}
	}
	process.exit(
		errors.length === 0 ? 0 : options.usageErrors.length > 0 ? 2 : 1,
	);
}

main();
