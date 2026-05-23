import {
	getFlagValue,
	parseCsvList,
	parseIntegerArg,
} from "../cli/parse-utils.js";
import type { PlanGateOptions } from "./types.js";

/**
 * Successful projection of raw plan-gate command-line arguments into typed
 * plan-gate options.
 */
export interface ParsedPlanGateCliArgs {
	ok: true;
	options: PlanGateOptions;
}

/** Build plan-gate options from raw command-line arguments. */
export function buildPlanGateOptionsFromCliArgs(
	args: string[],
): ParsedPlanGateCliArgs {
	const options: PlanGateOptions = {};

	if (args.includes("--json")) options.json = true;
	if (args.includes("--strict")) options.strict = true;
	if (args.includes("--require-origin")) options.requireOrigin = true;
	if (args.includes("--require-plan-id")) options.requirePlanId = true;
	if (args.includes("--require-acceptance-evidence")) {
		options.requireAcceptanceEvidence = true;
	}
	if (args.includes("--require-traceability")) {
		options.requireTraceability = true;
	}

	const plansArg = getFlagValue(args, args.indexOf("--plans"));
	if (plansArg) options.plansPath = plansArg;

	const typeArg = getFlagValue(args, args.indexOf("--type"));
	if (typeArg) options.type = typeArg;

	const maxAgeArg = getFlagValue(args, args.indexOf("--max-age"));
	if (maxAgeArg) {
		const parsed = parseIntegerArg(maxAgeArg, 0);
		if (parsed !== undefined) options.maxAge = parsed;
	}

	const planIdsArg = getFlagValue(args, args.indexOf("--plan-ids"));
	if (planIdsArg) options.planIds = parseCsvList(planIdsArg);

	const prTitleArg = getFlagValue(args, args.indexOf("--pr-title"));
	if (prTitleArg) options.prTitle = prTitleArg;

	const prBodyArg = getFlagValue(args, args.indexOf("--pr-body"));
	if (prBodyArg) options.prBody = prBodyArg;

	const changedFilesArg = getFlagValue(args, args.indexOf("--changed-files"));
	if (changedFilesArg) options.changedFiles = parseCsvList(changedFilesArg);

	return { ok: true, options };
}
