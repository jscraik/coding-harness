import { runEvidenceVerifyCLI } from "../../../commands/evidence-verify.js";
import { inspectFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the evidence-verify registry seam. */
export function createEvidenceVerifyCommandSpec(): CommandSpec {
	return {
		name: "evidence-verify",
		summary: "Verify evidence files (screenshots)",
		errorLabel: "Evidence Verify Error",
		execute: runEvidenceVerifyCommand,
	};
}

function runEvidenceVerifyCommand(args: string[]): number {
	const jsonFlag = args.includes("--json");
	const filesArg = readEvidenceVerifyScalar(args, "--files");
	const contractArg = readEvidenceVerifyScalar(args, "--contract");
	const changedArg = readEvidenceVerifyScalar(args, "--changed");
	if (filesArg === null || contractArg === null || changedArg === null)
		return 2;
	const files = parseCsvList(filesArg);
	const changedFiles = parseCsvList(changedArg);

	return runEvidenceVerifyCLI({
		files,
		contract: contractArg,
		json: jsonFlag,
		changed: changedFiles.length > 0 ? changedFiles : undefined,
	});
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
