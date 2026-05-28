#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const SCHEMA_VERSION = "decision-request/v1";
const BOUNDARY_TYPES = new Set([
	"destructive_action",
	"external_mutation",
	"credential_or_secret_access",
	"security_sensitive_action",
	"public_contract_change",
	"release_action",
	"permission_escalation",
	"stale_claim_support",
	"merge_readiness",
	"tracker_authority",
	"goal_completion",
]);
const CLAIM_SENSITIVE_BOUNDARIES = new Set([
	"stale_claim_support",
	"merge_readiness",
	"tracker_authority",
	"goal_completion",
]);
const NON_CURRENT_FRESHNESS = new Set(["stale", "missing", "unknown"]);

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(errors, path, message) {
	errors.push({ path, message });
}

function riskTierFor(boundaryType) {
	switch (boundaryType) {
		case "goal_completion":
		case "release_action":
		case "security_sensitive_action":
		case "credential_or_secret_access":
			return "critical";
		case "destructive_action":
		case "external_mutation":
		case "public_contract_change":
		case "permission_escalation":
		case "stale_claim_support":
		case "merge_readiness":
		case "tracker_authority":
			return "high";
		default:
			return null;
	}
}

function blockerClassFor(boundaryType) {
	switch (boundaryType) {
		case "stale_claim_support":
		case "merge_readiness":
			return "requires_external_state_refresh";
		case "tracker_authority":
			return "requires_tracker_authority";
		case "goal_completion":
			return "requires_goal_completion_audit";
		case "security_sensitive_action":
		case "credential_or_secret_access":
			return "requires_security_review";
		case "release_action":
			return "requires_release_authority";
		case "permission_escalation":
			return "requires_permission_escalation";
		case "public_contract_change":
			return "requires_contract_owner";
		default:
			return "requires_human_authority";
	}
}

function hasNonEmptyEvidenceRef(packet) {
	return (
		Array.isArray(packet.evidenceRefs) &&
		packet.evidenceRefs.some(
			(ref) => typeof ref === "string" && ref.trim().length > 0,
		)
	);
}

function hasNonCurrentStaleState(packet) {
	return (
		Array.isArray(packet.staleState) &&
		packet.staleState.some(
			(state) =>
				isObject(state) &&
				typeof state.freshness === "string" &&
				NON_CURRENT_FRESHNESS.has(state.freshness),
		)
	);
}

function validatePacket(packet) {
	const errors = [];
	if (!isObject(packet)) {
		add(errors, "packet", "must be an object");
		return errors;
	}
	if (packet.schemaVersion !== SCHEMA_VERSION) {
		add(errors, "schemaVersion", `must be ${SCHEMA_VERSION}`);
	}
	if (!isObject(packet.hiltBoundary)) {
		add(errors, "hiltBoundary", "must be an object");
		return errors;
	}
	const boundaryType = packet.hiltBoundary.boundaryType;
	if (typeof boundaryType !== "string" || !BOUNDARY_TYPES.has(boundaryType)) {
		add(errors, "hiltBoundary.boundaryType", "must be a real HILT boundary");
		return errors;
	}
	if (packet.hiltBoundary.riskTier !== riskTierFor(boundaryType)) {
		add(errors, "hiltBoundary.riskTier", "must match boundary type");
	}
	if (packet.hiltBoundary.blockerClass !== blockerClassFor(boundaryType)) {
		add(errors, "hiltBoundary.blockerClass", "must match boundary type");
	}
	if (
		typeof packet.intent === "string" &&
		packet.hiltBoundary.reason !== packet.intent
	) {
		add(errors, "hiltBoundary.reason", "must match packet intent");
	}
	if (!CLAIM_SENSITIVE_BOUNDARIES.has(boundaryType)) return errors;
	if (!hasNonEmptyEvidenceRef(packet) || !hasNonCurrentStaleState(packet)) {
		add(
			errors,
			"hiltBoundary.boundaryType",
			"claim-sensitive boundaries require evidence refs and non-current staleState",
		);
	}
	if (
		boundaryType === "stale_claim_support" &&
		packet.freshness === "current"
	) {
		add(
			errors,
			"freshness",
			"stale_claim_support cannot use freshness=current",
		);
	}
	return errors;
}

function main() {
	const packetPath = process.argv[2];
	if (!packetPath) {
		process.stderr.write(
			"usage: validate-decision-request.cjs <packet.json>\n",
		);
		process.exitCode = 2;
		return;
	}
	try {
		const packet = JSON.parse(readFileSync(packetPath, "utf8"));
		const errors = validatePacket(packet);
		const report = {
			schemaVersion: "decision-request-validation/v1",
			status: errors.length === 0 ? "pass" : "fail",
			packetPath,
			errors,
		};
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		process.exitCode = errors.length === 0 ? 0 : 1;
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 2;
	}
}

if (require.main === module) main();

module.exports = { validatePacket };
