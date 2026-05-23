import { runPlanGateCLI } from "../../../commands/plan-gate.js";
import { getFlagValue, parseCsvList, parseIntegerArg } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the plan-gate registry seam so command parsing stays outside the core registry. */
export function createPlanGateCommandSpec(): CommandSpec {
	return {
		name: "plan-gate",
		summary: "Validate plan artifacts",
		errorLabel: "Plan Gate Error",
		execute: (args) => {
			const options: {
				plansPath?: string;
				type?: string;
				maxAge?: number;
				requireOrigin?: boolean;
				requirePlanId?: boolean;
				requireAcceptanceEvidence?: boolean;
				requireTraceability?: boolean;
				planIds?: string[];
				prTitle?: string;
				prBody?: string;
				changedFiles?: string[];
				strict?: boolean;
				json?: boolean;
			} = {};

			if (args.includes("--json")) options.json = true;
			if (args.includes("--strict")) options.strict = true;
			if (args.includes("--require-origin")) options.requireOrigin = true;
			if (args.includes("--require-plan-id")) options.requirePlanId = true;
			if (args.includes("--require-acceptance-evidence"))
				options.requireAcceptanceEvidence = true;
			if (args.includes("--require-traceability"))
				options.requireTraceability = true;
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
			const changedFilesArg = getFlagValue(
				args,
				args.indexOf("--changed-files"),
			);
			if (changedFilesArg) options.changedFiles = parseCsvList(changedFilesArg);

			return runPlanGateCLI(options);
		},
	};
}
