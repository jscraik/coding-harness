import { runAuditCLI } from "../../../commands/audit.js";
import type { getVersion } from "../../version.js";
import type { CommandSpec } from "./types.js";

/** Build the audit registry seam. */
export function createAuditCommandSpec(
	versionProvider: typeof getVersion,
): CommandSpec {
	return {
		name: "audit",
		summary:
			"Comprehensive governance state check with actionable recommendations",
		example: "audit [--dir <path>] [--json]",
		errorLabel: "Audit Error",
		execute: (args) => runAuditCLI(args, versionProvider),
	};
}
