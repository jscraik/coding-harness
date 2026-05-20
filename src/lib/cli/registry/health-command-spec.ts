import { runHealthCLI } from "../../../commands/health.js";
import type { getVersion } from "../../version.js";
import type { CommandSpec } from "./types.js";

/** Build the health registry seam. */
export function createHealthCommandSpec(
	versionProvider: typeof getVersion,
): CommandSpec {
	return {
		name: "health",
		summary: "Quick health check for harness services and configuration",
		example: "health --json",
		errorLabel: "Health Error",
		execute: (args) => runHealthCLI(args, versionProvider),
	};
}
