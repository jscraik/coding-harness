#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const SCHEMA_VERSION = "review-lifecycle/v1";
const HEAD_SHA_PATTERN = /^[a-f0-9]{40}$/u;
const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const RAW_OR_SECRET_KEY_PATTERN =
	/(raw|body|prompt|transcript|secret|token|credential|password|apiKey|api_key)/iu;
const TOP_LEVEL_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"sourceReviewStateRef",
	"sourceReviewState",
	"target",
	"mode",
	"reviewer",
	"toolExposure",
	"artifactLineage",
	"findings",
	"selectableComments",
	"unresolvedThreads",
	"coverage",
	"verdict",
]);
const EVIDENCE_USES = new Set(["orientation", "audit_trail"]);
const MODE_KINDS = new Set([
	"author_review",
	"code_review",
	"pr_review",
	"judge_review",
	"pm_review",
]);
const MODE_STATUSES = new Set(["current", "stale", "missing", "unknown"]);
const VERDICTS = new Set(["pass", "blocked", "fail", "unknown"]);
const TOOL_CLASSES = new Set([
	"shell",
	"filesystem",
	"network",
	"mcp",
	"browser",
	"agent",
	"plugin",
	"app",
	"github",
	"linear",
	"review",
	"unknown",
]);
const IMPLEMENTATION_PRODUCER_PATTERN =
	/^(harness|coding-harness|implementation|coordinator|review-lifecycle)(:|$)/iu;
const SOURCE_REVIEW_STATE_KEYS = [
	"schemaVersion",
	"ref",
	"generatedAt",
	"headSha",
	"fetchReceiptRef",
	"reviewerArtifactRefs",
	"unresolvedThreadTotal",
];
const TARGET_KEYS = [
	"repository",
	"prNumber",
	"url",
	"baseRef",
	"headRef",
	"headSha",
	"reviewStateHeadSha",
];
const MODE_KEYS = ["kind", "status", "startedAt", "completedAt"];
const REVIEWER_KEYS = ["role", "producer", "runManifestRef"];
const TOOL_EXPOSURE_KEYS = ["sourceRef", "classes"];
const TOOL_EXPOSURE_CLASS_KEYS = ["className", "statusCounts", "failureClass"];
const TOOL_EXPOSURE_COUNT_KEYS = [
	"visible",
	"deferred",
	"hidden",
	"unavailable",
	"policyBlocked",
];
const ARTIFACT_LINEAGE_KEYS = [
	"role",
	"path",
	"producer",
	"runManifestRef",
	"receipt",
];
const EVIDENCE_RECEIPT_KEYS = [
	"schemaVersion",
	"kind",
	"ref",
	"producer",
	"status",
	"freshness",
	"evidenceUse",
	"blockerClass",
	"producedAt",
	"verifiedAt",
	"headSha",
	"sizeBytes",
	"checksum",
];
const FINDING_COUNT_KEYS = ["total", "blocking", "advisory", "resolved"];
const SELECTABLE_COMMENT_COUNT_KEYS = ["total", "selected", "unselected"];
const UNRESOLVED_THREAD_COUNT_KEYS = ["total", "needsHuman", "autofixable"];
const COVERAGE_KEYS = ["requiredRoles", "coveredRoles", "missingRoles"];
const VERDICT_KEYS = [
	"status",
	"blockerClass",
	"reason",
	"readyForReviewClaim",
];

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(errors, path, message) {
	errors.push({ path, message });
}

function requireOnlyKeys(value, allowedKeys, path, errors) {
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			add(errors, `${path}.${key}`, "field is not allowed");
		}
	}
}

function requireSafeText(value, path, errors) {
	if (
		typeof value !== "string" ||
		value.trim() === "" ||
		/[\r\n]/u.test(value) ||
		value.length > 512
	) {
		add(errors, path, "must be bounded single-line text");
	}
}

function requireNullableSafeText(value, path, errors) {
	if (value !== null) requireSafeText(value, path, errors);
}

function requireIso(value, path, errors) {
	if (
		typeof value !== "string" ||
		!ISO_TIMESTAMP_PATTERN.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		add(errors, path, "must be an ISO UTC timestamp");
	}
}

function requireSha(value, path, errors) {
	if (typeof value !== "string" || !HEAD_SHA_PATTERN.test(value)) {
		add(errors, path, "must be a 40-character git head SHA");
	}
}

function requireNonNegativeInteger(value, path, errors) {
	if (!Number.isInteger(value) || value < 0) {
		add(errors, path, "must be a non-negative integer");
	}
}

function isNonNegativeInteger(value) {
	return Number.isInteger(value) && value >= 0;
}

function rejectRawKeys(value, path, errors) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			rejectRawKeys(entry, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isObject(value)) return;
	for (const [key, entry] of Object.entries(value)) {
		if (RAW_OR_SECRET_KEY_PATTERN.test(key)) {
			add(errors, `${path}.${key}`, "raw or sensitive fields are not allowed");
		}
		rejectRawKeys(entry, `${path}.${key}`, errors);
	}
}

function validateCountSet(value, path, keys, errors) {
	if (!isObject(value)) {
		add(errors, path, "must be an object");
		return;
	}
	requireOnlyKeys(value, keys, path, errors);
	for (const key of keys)
		requireNonNegativeInteger(value[key], `${path}.${key}`, errors);
}

function validateUnresolvedThreadCounts(value, errors) {
	if (!isObject(value)) return;
	const { total, needsHuman, autofixable } = value;
	if (
		!isNonNegativeInteger(total) ||
		!isNonNegativeInteger(needsHuman) ||
		!isNonNegativeInteger(autofixable)
	) {
		return;
	}
	if (needsHuman + autofixable !== total) {
		add(
			errors,
			"unresolvedThreads.total",
			"unresolved thread buckets must add up to total",
		);
	}
}

function validateStringArray(value, path, errors) {
	if (!Array.isArray(value)) {
		add(errors, path, "must be an array");
		return;
	}
	value.forEach((entry, index) => {
		requireSafeText(entry, `${path}[${index}]`, errors);
	});
}

function validateSourceReviewState(packet, errors) {
	const source = packet.sourceReviewState;
	if (!isObject(source)) {
		add(errors, "sourceReviewState", "must be an object");
		return;
	}
	requireOnlyKeys(
		source,
		SOURCE_REVIEW_STATE_KEYS,
		"sourceReviewState",
		errors,
	);
	if (source.schemaVersion !== "review-state/v1") {
		add(errors, "sourceReviewState.schemaVersion", "must be review-state/v1");
	}
	requireSafeText(source.ref, "sourceReviewState.ref", errors);
	requireIso(source.generatedAt, "sourceReviewState.generatedAt", errors);
	requireSha(source.headSha, "sourceReviewState.headSha", errors);
	requireSafeText(
		source.fetchReceiptRef,
		"sourceReviewState.fetchReceiptRef",
		errors,
	);
	validateStringArray(
		source.reviewerArtifactRefs,
		"sourceReviewState.reviewerArtifactRefs",
		errors,
	);
	requireNonNegativeInteger(
		source.unresolvedThreadTotal,
		"sourceReviewState.unresolvedThreadTotal",
		errors,
	);
	if (packet.sourceReviewStateRef !== source.ref) {
		add(errors, "sourceReviewStateRef", "must match sourceReviewState.ref");
	}
}

function validateTarget(packet, errors) {
	const target = packet.target;
	const source = packet.sourceReviewState;
	if (!isObject(target)) {
		add(errors, "target", "must be an object");
		return;
	}
	requireOnlyKeys(target, TARGET_KEYS, "target", errors);
	requireSafeText(target.repository, "target.repository", errors);
	if (!Number.isInteger(target.prNumber) || target.prNumber < 1) {
		add(errors, "target.prNumber", "must be a positive integer");
	}
	for (const key of ["url", "baseRef", "headRef"]) {
		requireSafeText(target[key], `target.${key}`, errors);
	}
	requireSha(target.headSha, "target.headSha", errors);
	requireSha(target.reviewStateHeadSha, "target.reviewStateHeadSha", errors);
	if (target.headSha !== target.reviewStateHeadSha) {
		add(errors, "target.reviewStateHeadSha", "must match target.headSha");
	}
	if (isObject(source) && source.headSha !== target.headSha) {
		add(errors, "sourceReviewState.headSha", "must match target.headSha");
	}
}

function validateToolExposure(packet, errors) {
	const exposure = packet.toolExposure;
	if (!isObject(exposure)) {
		add(errors, "toolExposure", "must be an object");
		return;
	}
	requireOnlyKeys(exposure, TOOL_EXPOSURE_KEYS, "toolExposure", errors);
	requireNullableSafeText(exposure.sourceRef, "toolExposure.sourceRef", errors);
	if (!Array.isArray(exposure.classes) || exposure.classes.length === 0) {
		add(errors, "toolExposure.classes", "must be a non-empty array");
		return;
	}
	exposure.classes.forEach((entry, index) => {
		const path = `toolExposure.classes[${index}]`;
		if (!isObject(entry)) {
			add(errors, path, "must be an object");
			return;
		}
		requireOnlyKeys(entry, TOOL_EXPOSURE_CLASS_KEYS, path, errors);
		if (!TOOL_CLASSES.has(entry.className)) {
			add(errors, `${path}.className`, "has an unrecognized value");
		}
		validateCountSet(
			entry.statusCounts,
			`${path}.statusCounts`,
			TOOL_EXPOSURE_COUNT_KEYS,
			errors,
		);
		requireNullableSafeText(entry.failureClass, `${path}.failureClass`, errors);
	});
}

function validateReviewer(packet, errors) {
	const reviewer = packet.reviewer;
	if (!isObject(reviewer)) {
		add(errors, "reviewer", "must be an object");
		return;
	}
	requireOnlyKeys(reviewer, REVIEWER_KEYS, "reviewer", errors);
	requireSafeText(reviewer.role, "reviewer.role", errors);
	requireSafeText(reviewer.producer, "reviewer.producer", errors);
	requireNullableSafeText(
		reviewer.runManifestRef,
		"reviewer.runManifestRef",
		errors,
	);
	validateIndependentProducer(
		reviewer.producer,
		packet.producer,
		"reviewer.producer",
		errors,
	);
}

function validateIndependentProducer(producer, packetProducer, path, errors) {
	if (typeof producer !== "string") return;
	if (typeof packetProducer === "string" && producer === packetProducer) {
		add(errors, path, "must be independent from packet producer");
	}
	if (IMPLEMENTATION_PRODUCER_PATTERN.test(producer)) {
		add(errors, path, "must be a reviewer role");
	}
}

function validateArtifactLineage(packet, errors) {
	if (
		!Array.isArray(packet.artifactLineage) ||
		packet.artifactLineage.length === 0
	) {
		add(errors, "artifactLineage", "must contain at least one item");
		return;
	}
	const targetHead = isObject(packet.target)
		? packet.target.headSha
		: undefined;
	packet.artifactLineage.forEach((entry, index) => {
		const path = `artifactLineage[${index}]`;
		if (!isObject(entry)) {
			add(errors, path, "must be an object");
			return;
		}
		requireOnlyKeys(entry, ARTIFACT_LINEAGE_KEYS, path, errors);
		for (const key of ["role", "path", "producer", "runManifestRef"]) {
			requireSafeText(entry[key], `${path}.${key}`, errors);
		}
		validateIndependentProducer(
			entry.producer,
			packet.producer,
			`${path}.producer`,
			errors,
		);
		if (entry.role !== entry.producer) {
			add(errors, `${path}.producer`, "must match independent reviewer role");
		}
		const receipt = entry.receipt;
		if (!isObject(receipt)) {
			add(errors, `${path}.receipt`, "must be an object");
			return;
		}
		requireOnlyKeys(receipt, EVIDENCE_RECEIPT_KEYS, `${path}.receipt`, errors);
		if (receipt.schemaVersion !== "evidence-receipt/v1") {
			add(
				errors,
				`${path}.receipt.schemaVersion`,
				"must be evidence-receipt/v1",
			);
		}
		if (receipt.kind !== "review_artifact") {
			add(errors, `${path}.receipt.kind`, "must be review_artifact");
		}
		if (receipt.ref !== `review-lifecycle:${entry.path}`) {
			add(errors, `${path}.receipt.ref`, "must point at lineage path");
		}
		if (receipt.producer !== entry.producer) {
			add(errors, `${path}.receipt.producer`, "must match lineage producer");
		}
		if (receipt.status !== "pass")
			add(errors, `${path}.receipt.status`, "must pass");
		if (receipt.freshness !== "current") {
			add(errors, `${path}.receipt.freshness`, "must be current");
		}
		if (receipt.evidenceUse !== "claim_support") {
			add(errors, `${path}.receipt.evidenceUse`, "must be claim_support");
		}
		if (receipt.headSha !== targetHead) {
			add(errors, `${path}.receipt.headSha`, "must match target head SHA");
		}
		if (!Number.isInteger(receipt.sizeBytes) || receipt.sizeBytes <= 0) {
			add(errors, `${path}.receipt.sizeBytes`, "must be greater than zero");
		}
	});
}

function validateCoverage(packet, errors) {
	const coverage = packet.coverage;
	if (!isObject(coverage)) {
		add(errors, "coverage", "must be an object");
		return;
	}
	requireOnlyKeys(coverage, COVERAGE_KEYS, "coverage", errors);
	validateStringArray(coverage.requiredRoles, "coverage.requiredRoles", errors);
	validateStringArray(coverage.coveredRoles, "coverage.coveredRoles", errors);
	validateStringArray(coverage.missingRoles, "coverage.missingRoles", errors);
	if (
		Array.isArray(coverage.requiredRoles) &&
		Array.isArray(coverage.coveredRoles)
	) {
		coverage.requiredRoles.forEach((role) => {
			if (!coverage.coveredRoles.includes(role)) {
				add(
					errors,
					"coverage.coveredRoles",
					"must include every required role",
				);
			}
		});
	}
	if (
		Array.isArray(coverage.coveredRoles) &&
		Array.isArray(packet.artifactLineage)
	) {
		const lineageRoles = new Set(
			packet.artifactLineage
				.filter(isObject)
				.map((entry) => entry.role)
				.filter((role) => typeof role === "string"),
		);
		coverage.coveredRoles.forEach((role) => {
			if (typeof role === "string" && !lineageRoles.has(role)) {
				add(
					errors,
					"coverage.coveredRoles",
					"covered role must have artifact lineage",
				);
			}
		});
	}
	if (isObject(packet.reviewer) && typeof packet.reviewer.role === "string") {
		const reviewerRole = packet.reviewer.role;
		if (
			Array.isArray(coverage.coveredRoles) &&
			!coverage.coveredRoles.includes(reviewerRole)
		) {
			add(
				errors,
				"coverage.coveredRoles",
				"reviewer role must be covered by review lifecycle coverage",
			);
		}
		if (Array.isArray(packet.artifactLineage)) {
			const hasReviewerLineage = packet.artifactLineage
				.filter(isObject)
				.some((entry) => entry.role === reviewerRole);
			if (!hasReviewerLineage) {
				add(
					errors,
					"artifactLineage",
					"reviewer role must have artifact lineage",
				);
			}
		}
	}
}

function validateVerdict(packet, errors) {
	const verdict = packet.verdict;
	if (!isObject(verdict)) {
		add(errors, "verdict", "must be an object");
		return;
	}
	requireOnlyKeys(verdict, VERDICT_KEYS, "verdict", errors);
	if (!VERDICTS.has(verdict.status))
		add(errors, "verdict.status", "has an unrecognized value");
	requireNullableSafeText(verdict.blockerClass, "verdict.blockerClass", errors);
	requireSafeText(verdict.reason, "verdict.reason", errors);
	if (typeof verdict.readyForReviewClaim !== "boolean") {
		add(errors, "verdict.readyForReviewClaim", "must be boolean");
	}
	if (verdict.status !== "pass") return;
	if (!isObject(packet.mode) || packet.mode.status !== "current") {
		add(errors, "mode.status", "pass verdict requires current mode");
	}
	if (
		!isObject(packet.unresolvedThreads) ||
		packet.unresolvedThreads.total !== 0 ||
		packet.unresolvedThreads.needsHuman !== 0 ||
		packet.unresolvedThreads.autofixable !== 0
	) {
		add(
			errors,
			"unresolvedThreads.total",
			"pass verdict requires no unresolved active threads",
		);
	}
	if (
		!isObject(packet.coverage) ||
		!Array.isArray(packet.coverage.missingRoles)
	) {
		add(errors, "coverage", "pass verdict requires coverage");
	} else if (packet.coverage.missingRoles.length > 0) {
		add(
			errors,
			"coverage.missingRoles",
			"pass verdict requires no missing roles",
		);
	}
	if (verdict.readyForReviewClaim !== true) {
		add(errors, "verdict.readyForReviewClaim", "pass verdict requires true");
	}
}

function validate(packet) {
	const errors = [];
	if (!isObject(packet)) {
		add(errors, "packet", "must be an object");
		return errors;
	}
	for (const key of Object.keys(packet)) {
		if (!TOP_LEVEL_KEYS.has(key)) {
			add(errors, key, "top-level field is not allowed");
		}
	}
	rejectRawKeys(packet, "packet", errors);
	if (packet.schemaVersion !== SCHEMA_VERSION)
		add(errors, "schemaVersion", "must be review-lifecycle/v1");
	requireIso(packet.generatedAt, "generatedAt", errors);
	requireSafeText(packet.producer, "producer", errors);
	if (packet.runtimeStatus !== "not_yet_emitted") {
		add(errors, "runtimeStatus", "must be not_yet_emitted");
	}
	if (!EVIDENCE_USES.has(packet.evidenceUse)) {
		add(errors, "evidenceUse", "must be orientation or audit_trail");
	}
	requireSafeText(packet.sourceReviewStateRef, "sourceReviewStateRef", errors);
	validateSourceReviewState(packet, errors);
	validateTarget(packet, errors);
	if (!isObject(packet.mode)) {
		add(errors, "mode", "must be an object");
	} else {
		requireOnlyKeys(packet.mode, MODE_KEYS, "mode", errors);
		if (!MODE_KINDS.has(packet.mode.kind)) {
			add(errors, "mode.kind", "has an unrecognized value");
		}
		if (!MODE_STATUSES.has(packet.mode.status)) {
			add(errors, "mode.status", "has an unrecognized value");
		}
		requireNullableSafeText(packet.mode.startedAt, "mode.startedAt", errors);
		if (packet.mode.startedAt !== null)
			requireIso(packet.mode.startedAt, "mode.startedAt", errors);
		requireNullableSafeText(
			packet.mode.completedAt,
			"mode.completedAt",
			errors,
		);
		if (packet.mode.completedAt !== null)
			requireIso(packet.mode.completedAt, "mode.completedAt", errors);
	}
	validateReviewer(packet, errors);
	validateToolExposure(packet, errors);
	validateArtifactLineage(packet, errors);
	validateCountSet(packet.findings, "findings", FINDING_COUNT_KEYS, errors);
	validateCountSet(
		packet.selectableComments,
		"selectableComments",
		SELECTABLE_COMMENT_COUNT_KEYS,
		errors,
	);
	validateCountSet(
		packet.unresolvedThreads,
		"unresolvedThreads",
		UNRESOLVED_THREAD_COUNT_KEYS,
		errors,
	);
	validateUnresolvedThreadCounts(packet.unresolvedThreads, errors);
	validateCoverage(packet, errors);
	validateVerdict(packet, errors);
	return errors;
}

function main() {
	const target = process.argv[2];
	if (!target) {
		console.error("usage: validate-review-lifecycle.cjs <packet.json>");
		process.exit(2);
	}
	const packet = JSON.parse(readFileSync(target, "utf8"));
	const errors = validate(packet);
	const report = {
		schemaVersion: "review-lifecycle-validation/v1",
		status: errors.length === 0 ? "pass" : "fail",
		errors,
	};
	console.log(JSON.stringify(report, null, 2));
	process.exit(errors.length === 0 ? 0 : 1);
}

main();
