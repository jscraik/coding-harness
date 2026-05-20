import { runGardenerCLI } from "../../../commands/gardener.js";
import { getFlagValue, parseIntegerArg } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical gardener command adapter. */
export function createGardenerCommandSpec(): CommandSpec {
	return {
		name: "gardener",
		summary: "Detect stale docs and broken links",
		errorLabel: "Gardener Error",
		execute: (args) => {
			const options: Parameters<typeof runGardenerCLI>[0] = {};

			if (args.includes("--dry-run")) options.dryRun = true;
			if (args.includes("--json")) options.json = true;

			const docsArg = getFlagValue(args, args.indexOf("--docs"));
			if (docsArg) options.docsPath = docsArg;

			const staleDaysArg = getFlagValue(args, args.indexOf("--stale-days"));
			if (staleDaysArg) {
				const staleDays = parseIntegerArg(staleDaysArg, 0);
				if (staleDays !== undefined) options.staleDays = staleDays;
			}

			return runGardenerCLI(options);
		},
	};
}
