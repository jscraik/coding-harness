import { resolve } from "node:path";
import type { VerifyWorkCliOptions } from "./types.js";

/**
 * Create the argument list for the verify-work wrapper according to the
 * provided options.
 *
 * This helper only maps option values to wrapper flags. Mutual-exclusion
 * validation for all and changed-only is enforced by the runner before this
 * helper is used.
 */
export function buildVerifyWorkArgs(options: VerifyWorkCliOptions): string[] {
	const args: string[] = [];
	if (options.all) {
		args.push("--all");
	} else if (options.changedOnly) {
		args.push("--changed-only");
	}
	if (options.strict) {
		args.push("--strict");
	}
	if (options.fast) {
		args.push("--fast");
	}
	if (options.projectGovernance) {
		args.push("--project-governance");
	} else if (options.workspaceGovernance) {
		args.push("--workspace-governance");
	}
	if (options.resumeFrom) {
		args.push("--resume-from", options.resumeFrom);
	}
	if (options.json) {
		args.push("--json");
	}
	if (options.repoRoot) {
		args.push("--repo-root", resolve(options.repoRoot));
	}
	return args;
}
