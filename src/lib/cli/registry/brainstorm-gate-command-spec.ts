import { runBrainstormGateCLI } from "../../../commands/brainstorm-gate.js";
import { getFlagValue, parseIntegerArg } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical brainstorm-gate command adapter. */
export function createBrainstormGateCommandSpec(): CommandSpec {
	return {
		name: "brainstorm-gate",
		summary: "Validate brainstorm artifacts",
		errorLabel: "Brainstorm Gate Error",
		execute: (args) => {
			const options: Parameters<typeof runBrainstormGateCLI>[0] = {};

			if (args.includes("--json")) options.json = true;
			if (args.includes("--strict")) options.strict = true;
			const brainstormsArg = getFlagValue(args, args.indexOf("--brainstorms"));
			if (brainstormsArg) options.brainstormsPath = brainstormsArg;
			const topicArg = getFlagValue(args, args.indexOf("--topic"));
			if (topicArg) options.topic = topicArg;
			const maxAgeArg = getFlagValue(args, args.indexOf("--max-age"));
			if (maxAgeArg) {
				const parsed = parseIntegerArg(maxAgeArg, 0);
				if (parsed !== undefined) options.maxAgeDays = parsed;
			}

			return runBrainstormGateCLI(options);
		},
	};
}
