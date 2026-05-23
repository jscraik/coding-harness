import { runInitCLI, runInteractiveInitCLI } from "../../../commands/init.js";
import { buildInitOptionsFromCliArgs } from "../../init/cli-args.js";
import type { CommandSpec } from "./types.js";

/** Build the init command adapter. */
export function createInitCommandSpec(): CommandSpec {
	return {
		name: "init",
		summary: "Install harness in current directory",
		example: "init [target-dir] [--dry-run] [--json]",
		errorLabel: "Init Error",
		execute: (args) => {
			const parsed = buildInitOptionsFromCliArgs(args);
			if (!parsed.ok) {
				console.error(parsed.message);
				return 2;
			}
			if (parsed.interactive) {
				return runInteractiveInitCLI(parsed.targetDir, parsed.options);
			}
			return runInitCLI(parsed.targetDir, parsed.options);
		},
	};
}
