#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(
	ROOT,
	".harness",
	"research",
	"evidence-patterns.json",
);
const DEEP_DIR = path.join(ROOT, ".harness", "research", "deep");
const VALID_STATUSES = new Set(["adopted", "deferred", "rejected"]);
const VALID_OWNERS = new Set(["codex", "jamie"]);

function relative(filePath) {
	return path.relative(ROOT, filePath);
}

function parseArgs(argv) {
	return { json: argv.includes("--json") };
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

function deepEvidenceFiles() {
	if (!fs.existsSync(DEEP_DIR)) return [];
	return fs
		.readdirSync(DEEP_DIR)
		.filter((name) => name.endsWith(".md"))
		.map((name) => path.join(".harness", "research", "deep", name))
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

function validatePattern(pattern, index, seenSources, seenIds, errors) {
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
		seenSources.add(pattern.source);
		if (!pattern.source.startsWith(".harness/research/deep/")) {
			errors.push({
				code: "source_not_deep_evidence",
				patternId: pattern.id,
				path: pattern.source,
				message: "pattern.source must point under .harness/research/deep",
			});
		}
		if (!pathExists(pattern.source)) {
			errors.push({
				code: "source_missing_file",
				patternId: pattern.id,
				path: pattern.source,
				message: "pattern.source does not exist",
			});
		}
	}

	if (!VALID_STATUSES.has(pattern.status)) {
		errors.push({
			code: "status_invalid",
			patternId: pattern.id,
			message: "pattern.status must be adopted, deferred, or rejected",
		});
	}
	if (!VALID_OWNERS.has(pattern.owner)) {
		errors.push({
			code: "owner_invalid",
			patternId: pattern.id,
			message: "pattern.owner must be codex or jamie",
		});
	}
	if (!hasText(pattern.validationCommand)) {
		errors.push({
			code: "validation_command_missing",
			patternId: pattern.id,
			message: "pattern.validationCommand must be a non-empty string",
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
	if (pattern.status === "adopted" && pattern.targetSurfaces.length === 0) {
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

function validateManifest(manifest) {
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
		validatePattern(pattern, index, seenSources, seenIds, errors);
	}
	for (const source of deepEvidenceFiles()) {
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

function main() {
	const options = parseArgs(process.argv.slice(2));
	const errors = [];
	if (!fs.existsSync(MANIFEST_PATH)) {
		errors.push({
			code: "manifest_missing",
			path: relative(MANIFEST_PATH),
			message: "evidence-patterns.json does not exist",
		});
	} else {
		const manifest = readJson(MANIFEST_PATH, errors);
		if (manifest) errors.push(...validateManifest(manifest));
	}

	const report = {
		schemaVersion: "evidence-patterns-validation/v1",
		status: errors.length === 0 ? "pass" : "fail",
		manifest: relative(MANIFEST_PATH),
		deepEvidenceCount: deepEvidenceFiles().length,
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
	process.exit(errors.length === 0 ? 0 : 1);
}

main();
