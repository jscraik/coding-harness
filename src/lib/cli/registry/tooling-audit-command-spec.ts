import { runToolingAuditCLI } from "../../../commands/tooling-audit.js";
import type { CommandSpec } from "./types.js";

/** Build the tooling-audit registry seam. */
export function createToolingAuditCommandSpec(): CommandSpec {
	return {
		name: "tooling-audit",
		summary: "Audit installed tooling versions and configuration health",
		errorLabel: "Tooling Audit Error",
		execute: runToolingAuditCommand,
	};
}

async function runToolingAuditCommand(args: string[]): Promise<number> {
	const { exitCode } = await runToolingAuditCLI(args);
	return exitCode;
}
