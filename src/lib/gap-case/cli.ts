import type { RiskTier } from "../contract/types.js";
import {
	buildGapCaseOptionsFromCliArgs,
	type GapCaseCliOptions,
} from "./cli-args.js";
import { openGapCase, resolveGapCase } from "./operations.js";
import {
	GAP_CASE_EXIT_CODES,
	type GapCaseOpenOptions,
	type GapCaseResult,
} from "./types.js";

/** Run gap-case from raw command-line arguments. */
export function runGapCaseFromCliArgs(args: string[]): number {
	const parsed = buildGapCaseOptionsFromCliArgs(args);
	if (!parsed.ok) {
		console.error(parsed.message);
		return 2;
	}

	return runGapCaseCLI(parsed.options);
}

/** Execute a gap-case action with typed options and formatted output. */
export function runGapCaseCLI(args: GapCaseCliOptions): number {
	let result: GapCaseResult;

	if (args.action === "open") {
		result = openGapCase({
			incidentId: args.incidentId ?? "",
			summary: args.summary ?? "",
			severity: args.severity as RiskTier | undefined,
			owner: args.owner ?? "",
			provider: args.provider as GapCaseOpenOptions["provider"],
			findingId: args.findingId,
			prNumber: args.prNumber,
			headSha: args.headSha,
			slaHours: args.slaHours,
			contractPath: args.contractPath,
			storePath: args.storePath,
			json: args.json,
		});
	} else {
		result = resolveGapCase({
			caseId: args.caseId ?? "",
			evidenceUrl: args.evidenceUrl ?? "",
			fixPr: args.fixPr,
			note: args.note,
			resolvedBy: args.resolvedBy,
			contractPath: args.contractPath,
			storePath: args.storePath,
			json: args.json,
		});
	}

	if (result.ok) {
		printGapCaseSuccess(result, Boolean(args.json));
		return GAP_CASE_EXIT_CODES.SUCCESS;
	}

	printGapCaseError(result, Boolean(args.json));
	return getGapCaseExitCode(result.error.code);
}

function printGapCaseSuccess(
	result: Extract<GapCaseResult, { ok: true }>,
	json: boolean,
): void {
	if (json) {
		console.info(JSON.stringify(result.output, null, 2));
		return;
	}

	console.info(`✓ Gap-case ${result.output.status}: ${result.output.id}`);
	console.info(`  Incident: ${result.output.incidentId}`);
	console.info(`  Severity: ${result.output.severity}`);
	console.info(`  Owner: ${result.output.owner}`);
	console.info(`  Status: ${result.output.status}`);
	if (result.output.status === "open") {
		console.info(`  SLA due: ${result.output.slaDueAt}`);
	} else if (result.output.resolution) {
		console.info(`  Evidence: ${result.output.resolution.evidenceUrl}`);
	}
}

function printGapCaseError(
	result: Extract<GapCaseResult, { ok: false }>,
	json: boolean,
): void {
	if (json) {
		console.error(JSON.stringify({ error: result.error }, null, 2));
		return;
	}

	console.error(`✗ ${result.error.message}`);
}

function getGapCaseExitCode(errorCode: string): number {
	switch (errorCode) {
		case "E_VALIDATION":
			return GAP_CASE_EXIT_CODES.VALIDATION_ERROR;
		case "E_NOT_FOUND":
		case "E_ALREADY_RESOLVED":
			return GAP_CASE_EXIT_CODES.NOT_FOUND;
		case "E_STORE_CORRUPT":
		case "E_STORE_WRITE":
			return GAP_CASE_EXIT_CODES.STORE_ERROR;
		default:
			return GAP_CASE_EXIT_CODES.SYSTEM_ERROR;
	}
}
