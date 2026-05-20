import { runCheckCLI } from "../../../commands/check.js";
import type { CommandSpec } from "./types.js";

/** Build the check registry seam. */
export function createCheckCommandSpec(): CommandSpec {
	return {
		name: "check",
		summary: "Zero-config repo health snapshot — works before full setup",
		example: "check [path] [--json]",
		errorLabel: "Check Error",
		execute: runCheckCommand,
	};
}

function runCheckCommand(args: string[]): number {
	const jsonFlag = args.includes("--json");
	const targetDir = args.find((arg) => !arg.startsWith("-"));
	return runCheckCLI(targetDir, { json: jsonFlag });
}
