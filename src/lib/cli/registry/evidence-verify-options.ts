import { inspectFlagValue, parseCsvList } from "../parse-utils.js";

/**
 * Parsed evidence-verify options understood by the command adapter.
 */
export interface EvidenceVerifyCommandOptions {
	/** Evidence file paths to validate. */
	files: string[];
	/** Whether command output should be emitted as JSON. */
	json: boolean;
	/** Optional harness contract path for evidence policy checks. */
	contract?: string;
	/** Optional changed-file paths for evidence policy checks. */
	changed?: string[];
	/** Optional browser evidence manifest path. */
	browserEvidence?: string;
	/** Optional viewport IDs required by the browser evidence routine. */
	browserRequiredViewports?: string[];
}

/**
 * Project evidence-verify CLI args into typed command options.
 *
 * @param args - Raw command argument vector.
 * @returns Evidence verification options, or null when a scalar flag is missing a value.
 */
export function buildEvidenceVerifyOptions(
	args: string[],
): EvidenceVerifyCommandOptions | null {
	const filesArg = readEvidenceVerifyScalar(args, "--files");
	const contractArg = readEvidenceVerifyScalar(args, "--contract");
	const changedArg = readEvidenceVerifyScalar(args, "--changed");
	const browserEvidenceArg = readEvidenceVerifyScalar(
		args,
		"--browser-evidence",
	);
	const browserRequiredViewportsArg = readEvidenceVerifyScalar(
		args,
		"--browser-required-viewports",
	);
	if (
		filesArg === null ||
		contractArg === null ||
		changedArg === null ||
		browserEvidenceArg === null ||
		browserRequiredViewportsArg === null
	) {
		return null;
	}

	const changedFiles = parseCsvList(changedArg);
	const browserRequiredViewports = parseCsvList(browserRequiredViewportsArg);
	if (browserRequiredViewports.length > 0 && !browserEvidenceArg) {
		console.error(
			"Error: --browser-required-viewports requires --browser-evidence",
		);
		return null;
	}
	return {
		files: parseCsvList(filesArg),
		json: args.includes("--json"),
		...(contractArg ? { contract: contractArg } : {}),
		...(changedFiles.length > 0 ? { changed: changedFiles } : {}),
		...(browserEvidenceArg ? { browserEvidence: browserEvidenceArg } : {}),
		...(browserRequiredViewports.length > 0
			? { browserRequiredViewports }
			: {}),
	};
}

function readEvidenceVerifyScalar(
	args: string[],
	flag: string,
): string | undefined | null {
	const inspection = inspectFlagValue(args, flag);
	if (!inspection.missingValue) return inspection.value;
	console.error(`Error: ${flag} requires a value`);
	return null;
}
