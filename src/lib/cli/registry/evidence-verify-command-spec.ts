import { runEvidenceVerifyCLI } from "../../../commands/evidence-verify.js";
import { buildEvidenceVerifyOptions } from "./evidence-verify-options.js";
import type { CommandSpec } from "./types.js";

/** Build the evidence-verify registry seam. */
export function createEvidenceVerifyCommandSpec(): CommandSpec {
	return {
		name: "evidence-verify",
		summary: "Verify evidence files and browser evidence manifests",
		errorLabel: "Evidence Verify Error",
		execute: runEvidenceVerifyCommand,
	};
}

function runEvidenceVerifyCommand(args: string[]): number {
	const options = buildEvidenceVerifyOptions(args);
	return options ? runEvidenceVerifyCLI(options) : 2;
}
