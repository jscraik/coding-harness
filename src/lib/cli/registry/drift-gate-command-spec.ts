import { runDriftGateFromCliArgs } from "../../drift-gate/cli-args.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical drift-gate command adapter. */
export function createDriftGateCommandSpec(): CommandSpec {
	return {
		name: "drift-gate",
		summary: "Evaluate consistency drift across governance surfaces",
		example: "drift-gate --mode advisory --json",
		errorLabel: "Drift Gate Error",
		execute: runDriftGateCommand,
	};
}

function runDriftGateCommand(args: string[]): number {
	return runDriftGateFromCliArgs(args);
}
