import { getFlagValue, parseIntegerArg } from "../cli/parse-utils.js";

/** Typed gap-case CLI options after raw argument projection. */
export interface GapCaseCliOptions {
	action: "open" | "resolve";
	json?: boolean;
	contractPath?: string;
	storePath?: string;
	incidentId?: string;
	summary?: string;
	severity?: string;
	owner?: string;
	provider?: string;
	findingId?: string;
	prNumber?: number;
	headSha?: string;
	slaHours?: number;
	caseId?: string;
	evidenceUrl?: string;
	fixPr?: number;
	note?: string;
	resolvedBy?: string;
}

/** Parsed gap-case CLI arguments or a usage error message. */
export type ParsedGapCaseCliArgs =
	| { ok: true; options: GapCaseCliOptions }
	| { ok: false; message: string };

/** Build gap-case options from raw command-line arguments. */
export function buildGapCaseOptionsFromCliArgs(
	args: string[],
): ParsedGapCaseCliArgs {
	const action = args[0] as "open" | "resolve" | undefined;
	if (action !== "open" && action !== "resolve") {
		return { ok: false, message: "Error: action must be 'open' or 'resolve'" };
	}

	const options: GapCaseCliOptions = { action };

	if (args.includes("--json")) options.json = true;
	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	if (contractArg) options.contractPath = contractArg;
	const storeArg = getFlagValue(args, args.indexOf("--store"));
	if (storeArg) options.storePath = storeArg;
	const incidentIdArg = getFlagValue(args, args.indexOf("--incident-id"));
	if (incidentIdArg) options.incidentId = incidentIdArg;
	const summaryArg = getFlagValue(args, args.indexOf("--summary"));
	if (summaryArg) options.summary = summaryArg;
	const severityArg = getFlagValue(args, args.indexOf("--severity"));
	if (severityArg) options.severity = severityArg;
	const ownerArg = getFlagValue(args, args.indexOf("--owner"));
	if (ownerArg) options.owner = ownerArg;
	const providerArg = getFlagValue(args, args.indexOf("--provider"));
	if (providerArg) options.provider = providerArg;
	const findingIdArg = getFlagValue(args, args.indexOf("--finding-id"));
	if (findingIdArg) options.findingId = findingIdArg;
	const prNumberArg = getFlagValue(args, args.indexOf("--pr-number"));
	if (prNumberArg) {
		const parsed = parseIntegerArg(prNumberArg, 1);
		if (parsed !== undefined) options.prNumber = parsed;
	}
	const headShaArg = getFlagValue(args, args.indexOf("--head-sha"));
	if (headShaArg) options.headSha = headShaArg;
	const slaHoursArg = getFlagValue(args, args.indexOf("--sla-hours"));
	if (slaHoursArg) {
		const parsed = parseIntegerArg(slaHoursArg, 1);
		if (parsed !== undefined) options.slaHours = parsed;
	}
	const caseIdArg = getFlagValue(args, args.indexOf("--case-id"));
	if (caseIdArg) options.caseId = caseIdArg;
	const evidenceUrlArg = getFlagValue(args, args.indexOf("--evidence-url"));
	if (evidenceUrlArg) options.evidenceUrl = evidenceUrlArg;
	const fixPrArg = getFlagValue(args, args.indexOf("--fix-pr"));
	if (fixPrArg) {
		const parsed = parseIntegerArg(fixPrArg, 1);
		if (parsed !== undefined) options.fixPr = parsed;
	}
	const noteArg = getFlagValue(args, args.indexOf("--note"));
	if (noteArg) options.note = noteArg;
	const resolvedByArg = getFlagValue(args, args.indexOf("--resolved-by"));
	if (resolvedByArg) options.resolvedBy = resolvedByArg;

	return { ok: true, options };
}
