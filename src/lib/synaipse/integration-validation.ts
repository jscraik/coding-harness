import { isRecord } from "../decision/validators.js";
import type { SynaipseValidationError } from "./lifecycle.js";
import {
	add,
	isSha,
	requireString,
	rejectUnknownProperties,
} from "./validation-helpers.js";

type ErrorList = SynaipseValidationError[];

function validateCurrentSha(
	integration: Record<string, unknown>,
	field: "prSha" | "checksSha",
	currentSha: string,
	errors: ErrorList,
): void {
	const path = `evidence.integration.${field}`;
	if (!isSha(integration[field]))
		add(errors, path, "must be a 40-character SHA");
	else if (integration[field] !== currentSha)
		add(errors, path, "must match the current repository SHA");
}

function validateIntegrationShape(
	integration: Record<string, unknown>,
	errors: ErrorList,
): void {
	rejectUnknownProperties(
		integration,
		[
			"prSha",
			"checksSha",
			"signoff",
			"observedMerge",
			"mainSyncSha",
			"mainSyncRef",
			"mainSyncSource",
		],
		"evidence.integration",
		errors,
	);
}

function validateIntegrationMetadata(
	integration: Record<string, unknown>,
	errors: ErrorList,
): void {
	if (!isSha(integration.mainSyncSha))
		add(
			errors,
			"evidence.integration.mainSyncSha",
			"must be a 40-character SHA",
		);
	requireString(
		integration.mainSyncRef,
		"evidence.integration.mainSyncRef",
		errors,
	);
	requireString(
		integration.mainSyncSource,
		"evidence.integration.mainSyncSource",
		errors,
	);
	requireString(integration.signoff, "evidence.integration.signoff", errors);
	if (integration.observedMerge !== true)
		add(errors, "evidence.integration.observedMerge", "must be true");
}

/** Validate the PR, check, signoff, merge, and main-sync evidence for integration. */
export function validateIntegrationEvidence(
	value: Record<string, unknown>,
	currentSha: string,
	errors: ErrorList,
): void {
	if (value.fromStage !== "review" || value.toStage !== "integrate") return;
	const evidence = isRecord(value.evidence) ? value.evidence : undefined;
	const admitted = evidence?.admitted;
	if (!Array.isArray(admitted) || admitted.length === 0)
		add(
			errors,
			"evidence.admitted",
			"review -> integrate requires admitted review evidence",
		);
	const integration = evidence?.integration;
	if (!isRecord(integration)) {
		add(
			errors,
			"evidence.integration",
			"review -> integrate requires structured PR, checks, signoff, merge, and main-sync evidence",
		);
		return;
	}
	validateIntegrationShape(integration, errors);
	validateCurrentSha(integration, "prSha", currentSha, errors);
	validateCurrentSha(integration, "checksSha", currentSha, errors);
	validateIntegrationMetadata(integration, errors);
	if (value.policy !== "standing_authority")
		add(errors, "policy", "review -> integrate requires standing authority");
}
