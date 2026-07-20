#!/usr/bin/env node
const { readFileSync } = require("node:fs");

const RECOVERIES = {
	missing_project_identity: "establish_project_identity",
	missing_context_catalog: "admit_context_catalog",
	missing_required_context: "supply_required_context",
	missing_optional_context: "supply_optional_context",
	context_access_denied: "request_authorized_projection",
	stale_context_digest: "refresh_context_digest",
	superseded_context: "select_current_context",
	malformed_context_catalog: "repair_context_catalog",
	provider_unavailable: "restore_context_provider",
	unresolved_host_path: "resolve_context_host_path",
};

const CATALOG_FAILURES = new Set([
	"missing_project_identity",
	"missing_context_catalog",
	"malformed_context_catalog",
]);

function expectedFreshness(code) {
	if (CATALOG_FAILURES.has(code)) return "unknown";
	return code === "stale_context_digest" ? "stale" : "current";
}

function validateContextFailureIdentities(candidate) {
	const failures = candidate?.meta?.synaipseContextFailures?.failures;
	if (!Array.isArray(failures)) return [];
	const seen = new Map();
	const errors = [];
	for (const [index, failure] of failures.entries()) {
		if (
			typeof failure !== "object" ||
			failure === null ||
			Array.isArray(failure) ||
			typeof failure.code !== "string"
		)
			continue;
		const path = `meta.synaipseContextFailures.failures[${index}]`;
		if (!Object.hasOwn(failure, "contextId"))
			errors.push(`${path}.contextId must be explicitly present`);
		const recovery = RECOVERIES[failure.code];
		if (recovery !== undefined && failure.recovery !== recovery)
			errors.push(
				`${path}.recovery must equal ${recovery} for ${failure.code}`,
			);
		if (failure.owner !== "synaipse-context-plane")
			errors.push(`${path}.owner must equal synaipse-context-plane`);
		const isNonBlockingOptional =
			failure.requirement === "optional" &&
			[
				"missing_optional_context",
				"provider_unavailable",
				"unresolved_host_path",
			].includes(failure.code);
		const stopCondition =
			isNonBlockingOptional
				? `Continue with explicit context unknown until ${failure.code} is resolved.`
				: `Stop until ${failure.code} is resolved.`;
		if (failure.stopCondition !== stopCondition)
			errors.push(`${path}.stopCondition must equal ${stopCondition}`);
		const freshness = expectedFreshness(failure.code);
		if (failure.freshness?.status !== freshness)
			errors.push(
				`${path}.freshness.status must equal ${freshness} for ${failure.code}`,
			);
		const identity =
			typeof failure.contextId === "string"
				? `contextId:${failure.contextId}`
				: `catalogCode:${failure.code}`;
		const firstIndex = seen.get(identity);
		if (firstIndex !== undefined) {
			errors.push(
				`meta.synaipseContextFailures.failures[${index}] duplicates logical failure identity from failures[${firstIndex}]: ${identity}`,
			);
		} else {
			seen.set(identity, index);
		}
	}
	return errors;
}

function main() {
	const inputPath = process.argv[2];
	if (!inputPath) {
		process.stderr.write(
			"usage: validate-harness-decision-semantics.cjs <decision-json>\n",
		);
		process.exitCode = 2;
		return;
	}
	let candidate;
	try {
		candidate = JSON.parse(readFileSync(inputPath, "utf8"));
	} catch (error) {
		process.stderr.write(
			`unable to read harness decision JSON: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 2;
		return;
	}
	const errors = validateContextFailureIdentities(candidate);
	process.stdout.write(
		`${JSON.stringify({ schemaVersion: "harness-decision-semantic-validation/v1", status: errors.length === 0 ? "pass" : "fail", errors }, null, 2)}\n`,
	);
	process.exitCode = errors.length === 0 ? 0 : 1;
}

if (require.main === module) main();

module.exports = { validateContextFailureIdentities };
