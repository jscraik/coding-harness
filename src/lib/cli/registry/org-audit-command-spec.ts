import { runOrgAuditCLI } from "../../../commands/org-audit.js";
import type { CommandSpec } from "./types.js";

/** Build the org-audit registry seam. */
export function createOrgAuditCommandSpec(): CommandSpec {
	return {
		name: "org-audit",
		summary: "Audit GitHub org settings and member permissions",
		errorLabel: "Org Audit Error",
		execute: runOrgAuditCommand,
	};
}

async function runOrgAuditCommand(args: string[]): Promise<number> {
	const { exitCode } = await runOrgAuditCLI(args);
	return exitCode;
}
