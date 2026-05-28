#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const SCHEMA_VERSION = "goal-completion-audit-receipt/v1";
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const HEAD_SHA_PATTERN = /^[a-f0-9]{7,64}$/u;
const SAFE_POINTER_PATTERN = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/u;
const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const STATUSES = new Set([
	"pass",
	"fail",
	"blocked",
	"unknown",
	"not_applicable",
]);
const FRESHNESS = new Set([
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
]);
const RECOMMENDATIONS = new Set(["complete", "continue", "blocked"]);
const BLOCKER_CLASSES = new Set([
	"introduced",
	"pre_existing",
	"unrelated_dirty_worktree",
	"external_service",
	"needs_jamie_decision",
	"unknown",
]);
const BLOCKER_CODES = new Set([
	"missing_objective_identity",
	"objective_source_head_mismatch",
	"objective_source_hash_mismatch",
	"missing_required_requirement",
	"requirement_not_passed",
	"requirement_evidence_not_current",
	"unresolved_blocker",
	"repeated_blocker_threshold_met",
	"missing_blocker_history",
	"invalid_receipt",
]);

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safePointer(value) {
	return typeof value === "string" && SAFE_POINTER_PATTERN.test(value);
}

function add(errors, path, message) {
	errors.push({ path, message });
}

function requireSafePointer(value, path, errors) {
	if (!safePointer(value))
		add(errors, path, "must be a safe non-empty pointer");
}

function requireIso(value, path, errors) {
	if (
		typeof value !== "string" ||
		!ISO_TIMESTAMP_PATTERN.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		add(errors, path, "must be an ISO timestamp");
	}
}

function requireSafeArray(value, path, errors) {
	if (!Array.isArray(value)) {
		add(errors, path, "must be an array");
		return;
	}
	const seen = new Set();
	value.forEach((entry, index) => {
		requireSafePointer(entry, `${path}[${index}]`, errors);
		if (typeof entry !== "string") return;
		if (seen.has(entry)) {
			add(errors, `${path}[${index}]`, "entries must be unique");
		}
		seen.add(entry);
	});
}

function requireBoundedText(value, path, errors) {
	if (
		typeof value !== "string" ||
		value.trim() === "" ||
		/[\r\n]/u.test(value) ||
		value.length > 512
	) {
		add(errors, path, "must be a bounded single-line string");
	}
}

function validateObjectiveIdentity(receipt, errors) {
	const identity = receipt.objectiveIdentity;
	if (!isObject(identity)) {
		add(errors, "objectiveIdentity", "must be an object");
		return;
	}
	for (const key of [
		"objectiveRef",
		"objectiveSourcePath",
		"objectivePointer",
	]) {
		requireSafePointer(identity[key], `objectiveIdentity.${key}`, errors);
	}
	if (
		typeof identity.objectiveSourceHeadSha !== "string" ||
		!HEAD_SHA_PATTERN.test(identity.objectiveSourceHeadSha)
	) {
		add(
			errors,
			"objectiveIdentity.objectiveSourceHeadSha",
			"must be a git head SHA",
		);
	}
	if (identity.objectiveSourceHeadSha !== receipt.headSha) {
		add(
			errors,
			"objectiveIdentity.objectiveSourceHeadSha",
			"must match receipt headSha",
		);
	}
	for (const key of ["objectiveSourceSha256", "objectiveHash"]) {
		if (
			typeof identity[key] !== "string" ||
			!SHA256_PATTERN.test(identity[key])
		) {
			add(errors, `objectiveIdentity.${key}`, "must be sha256:<hex>");
		}
	}
	if (identity.objectiveSourceSha256 !== identity.objectiveHash) {
		add(
			errors,
			"objectiveIdentity.objectiveHash",
			"must match objectiveSourceSha256",
		);
	}
	if (identity.hashAlgorithm !== "sha256") {
		add(errors, "objectiveIdentity.hashAlgorithm", "must be sha256");
	}
	if (identity.canonicalizationVersion !== "goal-objective-text-lf/v1") {
		add(
			errors,
			"objectiveIdentity.canonicalizationVersion",
			"must be goal-objective-text-lf/v1",
		);
	}
}

function validateRequirements(receipt, errors) {
	if (
		!Array.isArray(receipt.requirements) ||
		receipt.requirements.length === 0
	) {
		add(errors, "requirements", "must be a non-empty array");
		return;
	}
	let hasRequired = false;
	const ids = new Set();
	receipt.requirements.forEach((requirement, index) => {
		const path = `requirements[${index}]`;
		if (!isObject(requirement)) {
			add(errors, path, "must be an object");
			return;
		}
		requireSafePointer(requirement.id, `${path}.id`, errors);
		if (ids.has(requirement.id)) add(errors, `${path}.id`, "must be unique");
		ids.add(requirement.id);
		if (
			typeof requirement.description !== "string" ||
			requirement.description.trim() === ""
		) {
			add(errors, `${path}.description`, "must be non-empty");
		}
		if (typeof requirement.required !== "boolean") {
			add(errors, `${path}.required`, "must be boolean");
		}
		hasRequired ||= requirement.required === true;
		if (!STATUSES.has(requirement.status))
			add(errors, `${path}.status`, "must be a valid status");
		if (!FRESHNESS.has(requirement.freshness))
			add(errors, `${path}.freshness`, "must be a valid freshness");
		requireSafeArray(requirement.evidenceRefs, `${path}.evidenceRefs`, errors);
		requireSafeArray(requirement.blockerRefs, `${path}.blockerRefs`, errors);
		if (requirement.verdictRef !== null) {
			requireSafePointer(requirement.verdictRef, `${path}.verdictRef`, errors);
		}
	});
	if (!hasRequired)
		add(errors, "requirements", "must contain at least one required row");
}

function validateBlockers(receipt, errors) {
	if (!Array.isArray(receipt.blockers)) {
		add(errors, "blockers", "must be an array");
		return;
	}
	receipt.blockers.forEach((blocker, index) => {
		const path = `blockers[${index}]`;
		if (!isObject(blocker)) {
			add(errors, path, "must be an object");
			return;
		}
		for (const key of ["id", "stableKey", "owner"]) {
			requireSafePointer(blocker[key], `${path}.${key}`, errors);
		}
		if (!BLOCKER_CLASSES.has(blocker.blockerClass)) {
			add(errors, `${path}.blockerClass`, "must be a valid blocker class");
		}
		requireBoundedText(blocker.nextAction, `${path}.nextAction`, errors);
		requireSafeArray(blocker.evidenceRefs, `${path}.evidenceRefs`, errors);
		if (
			!Number.isInteger(blocker.consecutiveGoalTurns) ||
			blocker.consecutiveGoalTurns < 1
		) {
			add(errors, `${path}.consecutiveGoalTurns`, "must be a positive integer");
		}
		requireIso(blocker.firstObservedAt, `${path}.firstObservedAt`, errors);
		requireIso(blocker.latestObservedAt, `${path}.latestObservedAt`, errors);
	});
}

function validateVerdict(receipt, errors) {
	const verdict = receipt.verdict;
	if (!isObject(verdict)) {
		add(errors, "verdict", "must be an object");
		return;
	}
	if (!STATUSES.has(verdict.status))
		add(errors, "verdict.status", "must be a valid status");
	if (!FRESHNESS.has(verdict.freshness))
		add(errors, "verdict.freshness", "must be a valid freshness");
	if (typeof verdict.readyForDoneClaim !== "boolean")
		add(errors, "verdict.readyForDoneClaim", "must be boolean");
	if (!RECOMMENDATIONS.has(verdict.goalStatusRecommendation)) {
		add(
			errors,
			"verdict.goalStatusRecommendation",
			"must be complete, continue, or blocked",
		);
	}
	if (verdict.blockerCode !== null && !BLOCKER_CODES.has(verdict.blockerCode)) {
		add(errors, "verdict.blockerCode", "must be a valid blocker code or null");
	}
	if (
		verdict.blockerClass !== null &&
		!BLOCKER_CLASSES.has(verdict.blockerClass)
	) {
		add(
			errors,
			"verdict.blockerClass",
			"must be a valid blocker class or null",
		);
	}
	if (verdict.readyForDoneClaim && verdict.status !== "pass") {
		add(errors, "verdict.readyForDoneClaim", "requires pass status");
	}
	if (
		verdict.readyForDoneClaim &&
		verdict.goalStatusRecommendation !== "complete"
	) {
		add(
			errors,
			"verdict.goalStatusRecommendation",
			"must be complete when ready",
		);
	}
	requireSafeArray(verdict.blockerRefs, "verdict.blockerRefs", errors);
	requireSafeArray(verdict.evidenceRefs, "verdict.evidenceRefs", errors);
	requireIso(verdict.verifiedAt, "verdict.verifiedAt", errors);
}

function validate(receipt) {
	const errors = [];
	if (!isObject(receipt)) {
		add(errors, "receipt", "must be an object");
		return errors;
	}
	if (receipt.schemaVersion !== SCHEMA_VERSION)
		add(errors, "schemaVersion", `must be ${SCHEMA_VERSION}`);
	requireIso(receipt.generatedAt, "generatedAt", errors);
	requireSafePointer(receipt.producer, "producer", errors);
	if (receipt.runtimeStatus !== "not_yet_emitted")
		add(errors, "runtimeStatus", "must be not_yet_emitted");
	if (receipt.evidenceUse !== "audit_trail")
		add(errors, "evidenceUse", "must be audit_trail");
	if (
		typeof receipt.headSha !== "string" ||
		!HEAD_SHA_PATTERN.test(receipt.headSha)
	) {
		add(errors, "headSha", "must be a git head SHA");
	}
	validateObjectiveIdentity(receipt, errors);
	validateRequirements(receipt, errors);
	validateBlockers(receipt, errors);
	validateVerdict(receipt, errors);
	requireSafeArray(receipt.sourceRefs, "sourceRefs", errors);
	if (
		typeof receipt.blockedBy !== "string" ||
		receipt.blockedBy.trim() === ""
	) {
		add(errors, "blockedBy", "must be non-empty");
	}
	return errors;
}

function main() {
	const receiptPath = process.argv[2];
	if (!receiptPath) {
		process.stderr.write(
			"Usage: validate-goal-completion-audit-receipt.cjs <receipt.json>\n",
		);
		process.exitCode = 2;
		return;
	}
	try {
		const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
		const errors = validate(receipt);
		const result = {
			schemaVersion: "goal-completion-audit-receipt-validation/v1",
			status: errors.length === 0 ? "pass" : "fail",
			receiptPath,
			errors,
		};
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		process.exitCode = errors.length === 0 ? 0 : 1;
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 2;
	}
}

if (require.main === module) main();

module.exports = { validate };
