import { runSilentErrorDetectorCLI } from "../../../commands/silent-error.js";
import { getFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the canonical silent-error command adapter. */
export function createSilentErrorCommandSpec(): CommandSpec {
	return {
		name: "silent-error",
		summary: "Detect silent error handling anti-patterns",
		errorLabel: "Silent Error Detector Error",
		execute: (args) => {
			const options: Parameters<typeof runSilentErrorDetectorCLI>[0] = {};

			if (args.includes("--json")) options.json = true;
			if (args.includes("--strict")) options.strict = true;
			if (args.includes("--suggestions")) options.suggestions = true;
			const filesArg = getFlagValue(args, args.indexOf("--files"));
			if (filesArg !== undefined) options.files = parseCsvList(filesArg);
			const dirsArg = getFlagValue(args, args.indexOf("--dirs"));
			if (dirsArg !== undefined) options.dirs = parseCsvList(dirsArg);

			return runSilentErrorDetectorCLI(options);
		},
	};
}
