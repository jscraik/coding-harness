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

function failurePath(index) {
	return `meta.synaipseContextFailures.failures[${index}]`;
}

function validateFailureShape(failure, path) {
	const errors = [];
	if (!Object.hasOwn(failure, "contextId"))
		errors.push(`${path}.contextId must be explicitly present`);
	const recovery = RECOVERIES[failure.code];
	if (recovery !== undefined && failure.recovery !== recovery)
		errors.push(`${path}.recovery must equal ${recovery} for ${failure.code}`);
	if (failure.owner !== "synaipse-context-plane")
		errors.push(`${path}.owner must equal synaipse-context-plane`);
	return errors;
}

function isNonBlockingOptional(failure) {
	if (
		failure == null ||
		typeof failure !== "object" ||
		Array.isArray(failure)
	) {
		return false;
	}
	return (
		failure.requirement === "optional" &&
		new Set([
			"missing_optional_context",
			"provider_unavailable",
			"unresolved_host_path",
		]).has(failure.code)
	);
}

function validateFailureSemantics(failure, path) {
	const errors = validateFailureShape(failure, path);
	const stopPrefix = isNonBlockingOptional(failure)
		? "Continue with explicit context unknown"
		: "Stop";
	const stopCondition = `${stopPrefix} until ${failure.code} is resolved.`;
	if (failure.stopCondition !== stopCondition)
		errors.push(`${path}.stopCondition must equal ${stopCondition}`);
	const freshness = expectedFreshness(failure.code);
	if (failure.freshness?.status !== freshness)
		errors.push(
			`${path}.freshness.status must equal ${freshness} for ${failure.code}`,
		);
	return errors;
}

function recordFailureIdentity(seen, failure, index) {
	const identity =
		typeof failure.contextId === "string"
			? `contextId:${failure.contextId}`
			: `catalogCode:${failure.code}`;
	const firstIndex = seen.get(identity);
	if (firstIndex !== undefined)
		return `meta.synaipseContextFailures.failures[${index}] duplicates logical failure identity from failures[${firstIndex}]: ${identity}`;
	seen.set(identity, index);
	return null;
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
		const path = failurePath(index);
		errors.push(...validateFailureSemantics(failure, path));
		const identityError = recordFailureIdentity(seen, failure, index);
		if (identityError) errors.push(identityError);
	}
	return errors;
}

function validateContextFailureDecisionCoupling(candidate) {
	const failures = candidate?.meta?.synaipseContextFailures?.failures;
	if (!Array.isArray(failures)) return [];
	const hasBlockingFailure = failures.some(
		(failure) => !isNonBlockingOptional(failure),
	);
	const hasRunnableNextCommand =
		typeof candidate?.nextCommand === "string" &&
		candidate.nextCommand.trim().length > 0;
	if (hasBlockingFailure && hasRunnableNextCommand) {
		return [
			"meta.synaipseContextFailures blocking failures require no runnable next command",
		];
	}
	return [];
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
	const errors = [
		...validateContextFailureIdentities(candidate),
		...validateContextFailureDecisionCoupling(candidate),
	];
	process.stdout.write(
		`${JSON.stringify({ schemaVersion: "harness-decision-semantic-validation/v1", status: errors.length === 0 ? "pass" : "fail", errors }, null, 2)}\n`,
	);
	process.exitCode = errors.length === 0 ? 0 : 1;
}

if (require.main === module) main();

module.exports = {
	validateContextFailureDecisionCoupling,
	validateContextFailureIdentities,
};
