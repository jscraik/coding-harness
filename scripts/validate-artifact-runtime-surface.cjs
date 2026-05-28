#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = "artifact-runtime-surface/v1";
const HEAD_SHA = /^[0-9a-f]{40}$/u;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const RFC3339 =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SAFE_PATH = /^(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+$/u;
const CLAIM_REF =
	/^claim:(?:delivery-truth|review-state|runtime-card|root-hygiene|external-state|judge-pm)\/[A-Za-z0-9._:@#?=&+,-]{2,200}$/u;
const PREVIEW_REF =
	/^preview:(?:browser\/[A-Za-z0-9._:@#?=&+,-]{2,200}|artifact\/[A-Za-z0-9._:@#?=&+,-]{2,200}|file\/(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+|not-applicable)$/u;
const RAW_KEY =
	/(?:^|_)(?:raw|prompt|transcript|secret|token|password|credential|commandOutput|reviewBody|screenshotPixels|contents?)(?:$|_)/iu;
const SECRET_VALUE =
	/(?:sk-[A-Za-z0-9_-]{20,}|gh[opsru]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/-]{20,}=*|BEGIN PRIVATE KEY|(?:token|secret|password|credential)=)/iu;
const PACKET_KEYS = new Set([
	"schemaVersion",
	"surfaceId",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"surfaceKind",
	"headSha",
	"currentHeadSha",
	"artifact",
	"lineage",
	"preview",
	"claimSupport",
	"freshness",
	"blockers",
	"nextAction",
]);
const ARTIFACT_KEYS = new Set([
	"path",
	"exists",
	"sizeBytes",
	"sha256",
	"mediaType",
	"frontMatterStatus",
	"producedAt",
]);
const LINEAGE_KEYS = new Set([
	"producer",
	"sourceRefs",
	"runtimeIdentityRefs",
	"verifierRefs",
	"headSha",
]);
const VERIFIER_REF_KEYS = new Set(["ref", "verifiedAt"]);
const PREVIEW_KEYS = new Set(["status", "ref", "checkedAt"]);
const CLAIM_SUPPORT_KEYS = new Set(["status", "supportedClaimRefs", "reason"]);
const BLOCKER_KEYS = new Set(["class", "reason", "nextAction"]);
const PREVIEW_REQUIRED = new Set([
	"implementation_notes",
	"review_artifact",
	"screenshot",
	"csv",
	"pdf",
	"document",
	"report",
	"lifecycle_artifact",
]);

function parseArgs(argv) {
	const result = { packetPath: null, repoRoot: process.cwd(), errors: [] };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--repo-root") {
			if (index + 1 >= argv.length) {
				result.errors.push("--repo-root requires a value");
			} else {
				result.repoRoot = argv[index + 1];
			}
			index += 1;
			continue;
		}
		if (!result.packetPath) result.packetPath = arg;
	}
	return result;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const errors = args.errors || [];
	if (!args.packetPath) {
		errors.push("missing packet path");
	}
	if (errors.length > 0) {
		console.log(
			JSON.stringify({
				schemaVersion: "artifact-runtime-surface-validation/v1",
				status: "fail",
				errors,
			}),
		);
		process.exit(2);
	}
	let packet;
	const repoRoot = path.resolve(args.repoRoot);
	const liveHeadSha = readGitHead(repoRoot);
	try {
		packet = JSON.parse(fs.readFileSync(args.packetPath, "utf8"));
	} catch (error) {
		errors.push(`packet: cannot read JSON: ${error.message}`);
	}
	if (packet) {
		validatePacket(packet, errors, liveHeadSha);
		validateFilesystem(packet, repoRoot, errors);
	}
	const status = errors.length === 0 ? "pass" : "fail";
	console.log(
		JSON.stringify(
			{
				schemaVersion: "artifact-runtime-surface-validation/v1",
				status,
				errors,
			},
			null,
			2,
		),
	);
	process.exit(status === "pass" ? 0 : 1);
}

function validatePacket(packet, errors, liveHeadSha) {
	if (!isRecord(packet)) {
		errors.push("packet: must be an object");
		return;
	}
	scanRawKeys(packet, "packet", errors);
	scanValues(packet, "packet", errors);
	validateKnownKeys(packet, PACKET_KEYS, "packet", errors);
	validateKnownKeys(packet.artifact, ARTIFACT_KEYS, "artifact", errors);
	validateKnownKeys(packet.lineage, LINEAGE_KEYS, "lineage", errors);
	validateKnownKeys(packet.preview, PREVIEW_KEYS, "preview", errors);
	validateKnownKeys(
		packet.claimSupport,
		CLAIM_SUPPORT_KEYS,
		"claimSupport",
		errors,
	);
	if (Array.isArray(packet.lineage?.verifierRefs)) {
		packet.lineage.verifierRefs.forEach((entry, index) => {
			validateKnownKeys(
				entry,
				VERIFIER_REF_KEYS,
				`lineage.verifierRefs[${index}]`,
				errors,
			);
		});
	}
	if (Array.isArray(packet.blockers)) {
		packet.blockers.forEach((entry, index) => {
			validateKnownKeys(entry, BLOCKER_KEYS, `blockers[${index}]`, errors);
		});
	}
	if (packet.schemaVersion !== SCHEMA_VERSION) {
		errors.push(`schemaVersion: must be ${SCHEMA_VERSION}`);
	}
	for (const field of [
		"surfaceId",
		"generatedAt",
		"producer",
		"runtimeStatus",
		"evidenceUse",
		"surfaceKind",
		"headSha",
		"currentHeadSha",
		"artifact",
		"lineage",
		"preview",
		"claimSupport",
		"freshness",
		"blockers",
		"nextAction",
	]) {
		if (!(field in packet)) errors.push(`${field}: is required`);
	}
	if (packet.runtimeStatus !== "not_yet_emitted") {
		errors.push("runtimeStatus: must be not_yet_emitted");
	}
	if (
		!["orientation", "audit_trail", "claim_support"].includes(
			packet.evidenceUse,
		)
	) {
		errors.push("evidenceUse: invalid");
	}
	if (!RFC3339.test(String(packet.generatedAt))) {
		errors.push("generatedAt: must be RFC3339 date-time");
	}
	validateRepoPath(packet.artifact?.path, "artifact.path", errors);
	validatePreviewRef(packet.preview?.ref, "preview.ref", errors);
	validateClaimRefs(packet.claimSupport?.supportedClaimRefs, errors);
	validateClaimSupportSemantics(packet, errors, liveHeadSha);
	validateTimestampOrdering(packet, errors);
}

function validateClaimSupportSemantics(packet, errors, liveHeadSha) {
	if (packet.evidenceUse !== "claim_support") return;
	const artifact = isRecord(packet.artifact) ? packet.artifact : {};
	const lineage = isRecord(packet.lineage) ? packet.lineage : {};
	const preview = isRecord(packet.preview) ? packet.preview : {};
	const claimSupport = isRecord(packet.claimSupport) ? packet.claimSupport : {};
	if (packet.freshness !== "current")
		errors.push("freshness: claim support requires current");
	if (!HEAD_SHA.test(String(packet.headSha)))
		errors.push("headSha: claim support requires head SHA");
	if (packet.currentHeadSha !== packet.headSha) {
		errors.push("currentHeadSha: must match headSha for claim support");
	}
	if (!liveHeadSha) {
		errors.push("currentHeadSha: cannot verify live repository HEAD");
	} else if (packet.currentHeadSha !== liveHeadSha) {
		errors.push("currentHeadSha: must match live repository HEAD");
	}
	if (lineage.headSha !== packet.headSha) {
		errors.push("lineage.headSha: must match packet headSha for claim support");
	}
	if (artifact.exists !== true)
		errors.push("artifact.exists: claim support requires existing artifact");
	if (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0) {
		errors.push(
			"artifact.sizeBytes: claim support requires non-empty artifact",
		);
	}
	if (!SHA256.test(String(artifact.sha256))) {
		errors.push("artifact.sha256: claim support requires sha256 checksum");
	}
	if (
		!["current", "not_applicable"].includes(String(artifact.frontMatterStatus))
	) {
		errors.push(
			"artifact.frontMatterStatus: claim support requires current or not_applicable",
		);
	}
	if (!["current", "not_applicable"].includes(String(preview.status))) {
		errors.push(
			"preview.status: claim support requires current or not_applicable",
		);
	}
	if (
		PREVIEW_REQUIRED.has(packet.surfaceKind) &&
		preview.status === "not_applicable"
	) {
		errors.push(
			"preview.status: surfaceKind requires current preview for claim support",
		);
	}
	if (claimSupport.status !== "supported") {
		errors.push("claimSupport.status: claim support requires supported status");
	}
	if (
		!Array.isArray(claimSupport.supportedClaimRefs) ||
		claimSupport.supportedClaimRefs.length === 0
	) {
		errors.push(
			"claimSupport.supportedClaimRefs: claim support requires at least one claim ref",
		);
	}
	if (Array.isArray(packet.blockers) && packet.blockers.length > 0) {
		errors.push("blockers: claim support cannot have blockers");
	}
}

function validateTimestampOrdering(packet, errors) {
	const producedAt = parseTime(packet.artifact?.producedAt);
	const checkedAt = parseTime(packet.preview?.checkedAt);
	const generatedAt = parseTime(packet.generatedAt);
	if (producedAt && checkedAt && producedAt > checkedAt) {
		errors.push("preview.checkedAt: cannot predate artifact.producedAt");
	}
	if (checkedAt && generatedAt && checkedAt > generatedAt) {
		errors.push("preview.checkedAt: cannot be after generatedAt");
	}
	const verifierRefs = packet.lineage?.verifierRefs;
	if (Array.isArray(verifierRefs)) {
		verifierRefs.forEach((entry, index) => {
			const verifiedAt = parseTime(entry?.verifiedAt);
			if (producedAt && verifiedAt && verifiedAt < producedAt) {
				errors.push(
					`lineage.verifierRefs[${index}].verifiedAt: cannot predate artifact.producedAt`,
				);
			}
			if (generatedAt && verifiedAt && verifiedAt > generatedAt) {
				errors.push(
					`lineage.verifierRefs[${index}].verifiedAt: cannot be after generatedAt`,
				);
			}
		});
	}
}

function validateFilesystem(packet, repoRoot, errors) {
	if (!isRecord(packet) || packet.evidenceUse !== "claim_support") return;
	const artifact = isRecord(packet.artifact) ? packet.artifact : {};
	if (typeof artifact.path !== "string" || !isSafeRepoPath(artifact.path))
		return;
	let rootReal;
	try {
		rootReal = fs.realpathSync(repoRoot);
	} catch (error) {
		errors.push(`artifact.path: filesystem error resolving repo root: ${error.message}`);
		return;
	}
	const artifactPath = path.resolve(repoRoot, artifact.path);
	if (!isUnderRoot(artifactPath, rootReal)) {
		errors.push("artifact.path: resolved path escapes repo root");
		return;
	}
	if (!fs.existsSync(artifactPath)) {
		errors.push("artifact.path: file is missing on disk");
		return;
	}
	let artifactReal;
	try {
		artifactReal = fs.realpathSync(artifactPath);
	} catch (error) {
		errors.push(`artifact.path: filesystem error resolving artifact path: ${error.message}`);
		return;
	}
	if (!isUnderRoot(artifactReal, rootReal)) {
		errors.push("artifact.path: realpath or symlink target escapes repo root");
		return;
	}
	let stat;
	try {
		stat = fs.statSync(artifactReal);
	} catch (error) {
		errors.push(`artifact.path: filesystem error reading file stats: ${error.message}`);
		return;
	}
	if (!stat.isFile()) errors.push("artifact.path: must resolve to a file");
	if (stat.size <= 0) errors.push("artifact.path: file is zero bytes");
	if (
		Number.isInteger(artifact.sizeBytes) &&
		artifact.sizeBytes !== stat.size
	) {
		errors.push("artifact.sizeBytes: does not match file size on disk");
	}
	if (typeof artifact.sha256 === "string" && SHA256.test(artifact.sha256)) {
		let fileContents;
		try {
			fileContents = fs.readFileSync(artifactReal);
		} catch (error) {
			errors.push(`artifact.path: filesystem error reading file contents: ${error.message}`);
			return;
		}
		const digest = crypto
			.createHash("sha256")
			.update(fileContents)
			.digest("hex");
		if (artifact.sha256 !== `sha256:${digest}`) {
			errors.push("artifact.sha256: does not match file contents");
		}
	}
}

function validateRepoPath(value, label, errors) {
	if (!isSafeRepoPath(value)) {
		errors.push(`${label}: must be a safe repo-relative path`);
	}
}

function validateKnownKeys(value, allowedKeys, label, errors) {
	if (!isRecord(value)) return;
	for (const key of Object.keys(value)) {
		if (!allowedKeys.has(key)) errors.push(`${label}.${key}: is not allowed`);
	}
}

function isSafeRepoPath(value) {
	return (
		typeof value === "string" &&
		SAFE_PATH.test(value) &&
		!value.startsWith("/") &&
		!value.startsWith("~") &&
		!value.includes("..") &&
		!value.includes("\\") &&
		!/^[a-z][a-z0-9+.-]*:/iu.test(value)
	);
}

function validatePreviewRef(value, label, errors) {
	if (value === null) return;
	if (typeof value !== "string" || !PREVIEW_REF.test(value)) {
		errors.push(
			`${label}: must use preview:browser, preview:file, preview:artifact, or preview:not-applicable`,
		);
		return;
	}
	if (
		value.startsWith("preview:file/") &&
		!isSafeRepoPath(value.slice("preview:file/".length))
	) {
		errors.push(
			`${label}: preview:file must be repo-relative and traversal-free`,
		);
	}
}

function validateClaimRefs(value, errors) {
	if (!Array.isArray(value)) {
		errors.push("claimSupport.supportedClaimRefs: must be an array");
		return;
	}
	for (const [index, ref] of value.entries()) {
		if (typeof ref !== "string" || !CLAIM_REF.test(ref)) {
			errors.push(
				`claimSupport.supportedClaimRefs[${index}]: must use typed claim taxonomy`,
			);
			continue;
		}
		if (
			ref.includes("artifact-runtime-surface") ||
			ref.includes("artifact-exists")
		) {
			errors.push(
				`claimSupport.supportedClaimRefs[${index}]: cannot be self-referential or generic artifact existence`,
			);
		}
	}
}

function scanRawKeys(value, label, errors) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			scanRawKeys(entry, `${label}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_KEY.test(key)) {
			errors.push(
				`${label}.${key}: raw content, prompts, transcripts, tokens, secrets, and bodies are forbidden`,
			);
		}
		scanRawKeys(nested, `${label}.${key}`, errors);
	}
}

function scanValues(value, label, errors) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			scanValues(entry, `${label}[${index}]`, errors);
		});
		return;
	}
	if (isRecord(value)) {
		for (const [key, nested] of Object.entries(value))
			scanValues(nested, `${label}.${key}`, errors);
		return;
	}
	if (typeof value !== "string") return;
	if (value.length > 512)
		errors.push(`${label}: text values must be <= 512 characters`);
	if (SECRET_VALUE.test(value))
		errors.push(`${label}: secret-like values are forbidden`);
}

function parseTime(value) {
	if (typeof value !== "string" || !RFC3339.test(value)) return null;
	const time = Date.parse(value);
	return Number.isNaN(time) ? null : time;
}

function isUnderRoot(candidate, root) {
	const relative = path.relative(root, candidate);
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readGitHead(repoRoot) {
	const result = spawnSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], {
		encoding: "utf8",
	});
	if (result.status !== 0) return null;
	const head = result.stdout.trim();
	return HEAD_SHA.test(head) ? head : null;
}

main();
