import { runReplayCLI } from "../../../commands/replay.js";
import { getFlagValue } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical replay command adapter. */
export function createReplayCommandSpec(): CommandSpec {
	return {
		name: "replay",
		summary: "Replay or list captured agent automation traces",
		errorLabel: "Replay Error",
		execute: (args) => {
			const options: Parameters<typeof runReplayCLI>[0] = {
				json: args.includes("--json"),
				dryRun: args.includes("--dry-run"),
				list: args.includes("--list"),
			};

			const traceIdValue = getFlagValue(args, args.indexOf("--trace-id"));
			if (traceIdValue) options.traceId = traceIdValue;

			const traceDirValue = getFlagValue(args, args.indexOf("--trace-dir"));
			if (traceDirValue) options.traceDir = traceDirValue;

			if (!options.traceId && args[0] && !args[0].startsWith("-")) {
				options.traceId = args[0];
			}

			return runReplayCLI(options);
		},
	};
}
