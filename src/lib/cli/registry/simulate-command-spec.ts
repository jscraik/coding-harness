import { runSimulateFromCliArgs } from "../../simulate/cli.js";
import type { CommandSpec } from "./types.js";

/** Build the simulate command adapter. */
export function createSimulateCommandSpec(): CommandSpec {
	return {
		name: "simulate",
		summary: "Simulate contract transitions between versions",
		errorLabel: "Simulate Error",
		execute: (args) => runSimulateFromCliArgs(args),
	};
}
