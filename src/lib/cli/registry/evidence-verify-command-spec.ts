import { runEvidenceVerifyCLI } from "../../../commands/evidence-verify.js";
import { getFlagValue, parseCsvList } from "../parse-utils.js";
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
	const filesIndex = args.indexOf("--files");
	const contractIndex = args.indexOf("--contract");
	const changedIndex = args.indexOf("--changed");

	const files: string[] = [];
	const filesArg = getFlagValue(args, filesIndex);
	files.push(...parseCsvList(filesArg));

	const contractArg = getFlagValue(args, contractIndex);

	const changedFiles: string[] = [];
	const changedArg = getFlagValue(args, changedIndex);
	changedFiles.push(...parseCsvList(changedArg));

	return runEvidenceVerifyCLI({
		files,
		contract: contractArg,
		json: jsonFlag,
		changed: changedFiles.length > 0 ? changedFiles : undefined,
	});
}
