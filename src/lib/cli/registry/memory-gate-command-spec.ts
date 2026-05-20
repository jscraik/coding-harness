import { runMemoryGateCLI } from "../../../commands/memory-gate.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical memory-gate command adapter. */
export function createMemoryGateCommandSpec(): CommandSpec {
	return {
		name: "memory-gate",
		summary: "Validate local-memory workflow compliance",
		errorLabel: "Memory Gate Error",
		execute: (args) => {
			const options: Parameters<typeof runMemoryGateCLI>[0] = {};

			if (args.includes("--json")) options.json = true;
			const memoryArg = getFlagValue(args, args.indexOf("--memory"));
			if (memoryArg) options.memoryPath = memoryArg;
			const forjamieArg = getFlagValue(args, args.indexOf("--forjamie"));
			if (forjamieArg) options.forjamiePath = forjamieArg;
			const metricsArg = getFlagValue(args, args.indexOf("--metrics"));
			if (metricsArg) options.metricsPath = metricsArg;

			return runMemoryGateCLI(options);
		},
	};
}
