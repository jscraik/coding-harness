#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const SCHEMA_VERSION = "reviewer-coverage-receipt/v1";
const BLOCKED_STATUS_PATTERN =
	/^STATUS:\s+(blocked_runtime|blocked_missing_artifact|blocked_validation)\b/mu;
const WROTE_PATTERN = /^WROTE:\s+\S+/mu;

function hasText(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function normalizeDisplayPath(value) {
	return String(value || "").replaceAll("\\", "/");
}

function parseArgs(argv) {
	const options = {
		manifest: null,
		reviewsDir: "artifacts/reviews",
		root: DEFAULT_ROOT,
		usageErrors: [],
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") continue;
		if (arg === "--manifest") {
			index += 1;
			if (!hasText(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--manifest requires a path value",
				});
			} else {
				options.manifest = argv[index];
			}
		} else if (arg === "--reviews-dir") {
			index += 1;
			if (!hasText(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--reviews-dir requires a path value",
				});
			} else {
				options.reviewsDir = argv[index];
			}
		} else if (arg === "--root") {
			index += 1;
			if (!hasText(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--root requires a path value",
				});
			} else {
				options.root = path.resolve(argv[index]);
			}
		} else if (arg.startsWith("--")) {
			options.usageErrors.push({
				code: "usage_unknown_option",
				message: `unknown option: ${arg}`,
			});
		} else {
			options.usageErrors.push({
				code: "usage_extra_argument",
				message: `unexpected positional argument: ${arg}`,
			});
		}
	}

	if (!hasText(options.manifest)) {
		options.usageErrors.push({
			code: "usage_missing_manifest",
			message: "--manifest is required",
		});
	}

	return options;
}

function resolveFromRoot(root, value) {
	return path.isAbsolute(value)
		? path.resolve(value)
		: path.resolve(root, value);
}

function toRepoRelative(root, absolutePath) {
	const relative = path.relative(root, absolutePath).replaceAll("\\", "/");
	if (relative === "") return ".";
	if (relative.startsWith("../") || path.isAbsolute(relative)) {
		return normalizeDisplayPath(absolutePath);
	}
	return relative;
}

function isInsideRoot(root, absolutePath) {
	const relative = path.relative(root, absolutePath);
	return (
		relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
	);
}

function baseReport(options) {
	const root = path.resolve(options.root);
	return {
		schemaVersion: SCHEMA_VERSION,
		status: "blocked",
		checkedAt: new Date().toISOString(),
		manifest: hasText(options.manifest)
			? toRepoRelative(root, resolveFromRoot(root, options.manifest))
			: "",
		reviewsDir: toRepoRelative(root, resolveFromRoot(root, options.reviewsDir)),
		requestedRoles: [],
		completedRoles: [],
		completedArtifacts: [],
		blockedRoles: [],
		missingArtifacts: [],
		retryCount: 0,
		synthesisStatus: "unknown",
		evidenceRefs: [],
		blockerClass: "not_checked",
		reason: "reviewer coverage was not checked",
	};
}

function writeReport(report, exitCode) {
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	process.exit(exitCode);
}

function readJsonFile(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function manifestEntries(manifest) {
	const entries =
		manifest.requiredReviewers ||
		manifest.reviewers ||
		manifest.requiredRoles ||
		[];
	if (!Array.isArray(entries)) {
		throw new Error("reviewer manifest must contain an array of reviewers");
	}
	return entries.map((entry, index) => normalizeManifestEntry(entry, index));
}

function normalizeManifestEntry(entry, index) {
	if (typeof entry === "string") {
		return {
			artifact: null,
			mailboxOnly: true,
			role: entry,
		};
	}
	if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
		throw new Error(`reviewer entry ${index + 1} must be an object or string`);
	}
	const role = entry.role || entry.name || entry.reviewer;
	if (!hasText(role)) {
		throw new Error(`reviewer entry ${index + 1} is missing role`);
	}
	return {
		artifact: entry.artifact || entry.path || entry.report || null,
		mailboxOnly: entry.mailboxOnly === true || entry.proof === "mailbox",
		role: String(role),
	};
}

function resolveArtifactPath(root, reviewsDir, artifact) {
	if (!hasText(artifact)) return null;
	const rawArtifact = String(artifact);
	if (path.isAbsolute(rawArtifact)) {
		return path.resolve(rawArtifact);
	}
	if (
		rawArtifact.startsWith("./") ||
		rawArtifact.startsWith("../") ||
		rawArtifact.includes("/")
	) {
		return path.resolve(root, rawArtifact);
	}
	return path.resolve(reviewsDir, rawArtifact);
}

function statusLine(pattern, content) {
	const match = content.match(pattern);
	return match ? match[0] : null;
}

function classifyEntry(root, reviewsDir, entry) {
	const artifactPath = resolveArtifactPath(root, reviewsDir, entry.artifact);
	const artifact = artifactPath ? toRepoRelative(root, artifactPath) : "";
	const requested = {
		artifact,
		role: entry.role,
	};

	if (entry.mailboxOnly) {
		return {
			kind: "missing",
			requested,
			result: {
				artifact,
				reason: "mailbox_only_non_proof",
				role: entry.role,
			},
		};
	}
	if (!artifactPath) {
		return {
			kind: "missing",
			requested,
			result: {
				artifact,
				reason: "missing_artifact_path",
				role: entry.role,
			},
		};
	}
	if (!isInsideRoot(root, artifactPath)) {
		return {
			kind: "missing",
			requested,
			result: {
				artifact,
				reason: "artifact_outside_repo",
				role: entry.role,
			},
		};
	}
	if (!fs.existsSync(artifactPath)) {
		return {
			kind: "missing",
			requested,
			result: {
				artifact,
				reason: "artifact_not_found",
				role: entry.role,
			},
		};
	}

	const content = fs.readFileSync(artifactPath, "utf8");
	if (!hasText(content)) {
		return {
			kind: "missing",
			requested,
			result: {
				artifact,
				reason: "artifact_empty",
				role: entry.role,
			},
		};
	}

	const blockedLine = statusLine(BLOCKED_STATUS_PATTERN, content);
	if (blockedLine) {
		return {
			kind: "blocked",
			requested,
			result: {
				artifact,
				role: entry.role,
				statusLine: blockedLine,
			},
		};
	}

	const wroteLine = statusLine(WROTE_PATTERN, content);
	if (wroteLine) {
		return {
			kind: "completed",
			requested,
			result: {
				artifact,
				role: entry.role,
				statusLine: wroteLine,
			},
		};
	}

	return {
		kind: "missing",
		requested,
		result: {
			artifact,
			reason: "artifact_missing_completion_or_blocker_status",
			role: entry.role,
		},
	};
}

function normalizeSynthesisStatus(value) {
	return hasText(value) ? String(value).trim() : "unknown";
}

function blockerClass(report) {
	if (
		report.missingArtifacts.some(
			(item) => item.reason === "mailbox_only_non_proof",
		)
	) {
		return "mailbox_only";
	}
	if (report.blockedRoles.length > 0) return "blocked_reviewers";
	if (report.missingArtifacts.length > 0) return "missing_artifacts";
	if (report.synthesisStatus !== "complete") return "synthesis_incomplete";
	return null;
}

function finalStatus(report) {
	if (report.blockerClass === null) return "pass";
	if (
		report.completedRoles.length > 0 &&
		(report.missingArtifacts.length > 0 ||
			report.blockedRoles.length > 0 ||
			report.synthesisStatus !== "complete")
	) {
		return "partial";
	}
	return "blocked";
}

function reasonFor(report) {
	if (report.status === "pass")
		return "all required reviewer artifacts are complete";
	if (report.blockerClass === "mailbox_only") {
		return "mailbox-only reviewer text is not artifact proof";
	}
	if (report.blockerClass === "blocked_reviewers") {
		return "one or more reviewer artifacts reported a blocker status";
	}
	if (report.blockerClass === "missing_artifacts") {
		return "one or more required reviewer artifacts are missing or lack proof status";
	}
	if (report.blockerClass === "synthesis_incomplete") {
		return "reviewer coverage synthesis is not marked complete";
	}
	return "reviewer coverage did not satisfy the manifest";
}

function run(options) {
	const report = baseReport(options);
	const root = path.resolve(options.root);
	const reviewsDir = resolveFromRoot(root, options.reviewsDir);

	if (options.usageErrors.length > 0) {
		report.blockerClass = "usage";
		report.reason = options.usageErrors
			.map((error) => error.message)
			.join("; ");
		report.usageErrors = options.usageErrors;
		writeReport(report, 2);
	}

	const manifestPath = resolveFromRoot(root, options.manifest);
	report.evidenceRefs.push(toRepoRelative(root, manifestPath));
	if (!fs.existsSync(manifestPath)) {
		report.blockerClass = "missing_manifest";
		report.reason = "reviewer coverage manifest does not exist";
		writeReport(report, 1);
	}

	let manifest;
	try {
		manifest = readJsonFile(manifestPath);
	} catch (error) {
		report.blockerClass = "invalid_manifest";
		report.reason = `reviewer coverage manifest could not be parsed: ${error.message}`;
		writeReport(report, 1);
	}

	let entries;
	try {
		entries = manifestEntries(manifest);
	} catch (error) {
		report.blockerClass = "invalid_manifest";
		report.reason = error.message;
		writeReport(report, 1);
	}
	report.retryCount = Number.isFinite(Number(manifest.retryCount))
		? Number(manifest.retryCount)
		: 0;
	report.synthesisStatus = normalizeSynthesisStatus(manifest.synthesisStatus);

	for (const entry of entries) {
		const classified = classifyEntry(root, reviewsDir, entry);
		report.requestedRoles.push(classified.requested);
		if (classified.result.artifact) {
			report.evidenceRefs.push(classified.result.artifact);
		}
		if (classified.kind === "completed") {
			report.completedRoles.push(classified.result.role);
			report.completedArtifacts.push(classified.result);
		} else if (classified.kind === "blocked") {
			report.blockedRoles.push(classified.result);
		} else {
			report.missingArtifacts.push(classified.result);
		}
	}
	report.evidenceRefs = [...new Set(report.evidenceRefs)].sort();

	if (report.requestedRoles.length === 0) {
		report.blockerClass = "empty_manifest";
		report.reason = "reviewer coverage manifest contains no required reviewers";
		writeReport(report, 1);
	}

	report.blockerClass = blockerClass(report);
	report.status = finalStatus(report);
	report.reason = reasonFor(report);
	writeReport(report, report.status === "pass" ? 0 : 1);
}

run(parseArgs(process.argv.slice(2)));
