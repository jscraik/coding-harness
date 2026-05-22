import { getFlagValue, parseIntegerArg } from "../cli/parse-utils.js";
import type { RemediateOptions } from "./types.js";

/** Parsed remediate CLI argument result or a usage-error exit code. */
export type RemediateCliArgsResult =
	| { ok: true; options: RemediateOptions }
	| { ok: false; exitCode: 2 };

/**
 * Project raw `remediate` CLI arguments into typed command options.
 *
 * @param args - Argument vector with the command name already stripped.
 * @returns Typed remediate options, or a usage-error result for an invalid subcommand.
 */
export function buildRemediateOptionsFromCliArgs(
	args: string[],
): RemediateCliArgsResult {
	const subcommand = args[0];
	if (subcommand !== "run" && subcommand !== "apply") {
		console.error(
			"Error: remediate command requires subcommand `run` or `apply`",
		);
		return { ok: false, exitCode: 2 };
	}

	const prValue = getFlagValue(args, args.indexOf("--pr"));
	const maxAutoTierValue = getFlagValue(args, args.indexOf("--max-auto-tier"));
	const options: RemediateOptions = {
		subcommand,
		owner: getFlagValue(args, args.indexOf("--owner")) ?? "",
		repo: getFlagValue(args, args.indexOf("--repo")) ?? "",
		prNumber: parseIntegerArg(prValue, 1) ?? 0,
		headSha: getFlagValue(args, args.indexOf("--sha")) ?? "",
		provider:
			(getFlagValue(args, args.indexOf("--provider")) as
				| "codeql"
				| "codex"
				| undefined) ?? "codeql",
		dryRun: args.includes("--dry-run"),
		noInput: args.includes("--no-input"),
		force: args.includes("--force"),
		json: args.includes("--json"),
	};

	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	if (contractArg) options.contractPath = contractArg;
	const findingsArg = getFlagValue(args, args.indexOf("--findings"));
	if (findingsArg) options.findings = findingsArg;
	const headShaArg = getFlagValue(args, args.indexOf("--head-sha"));
	if (headShaArg) options.headSha = headShaArg;
	const modeValue = getFlagValue(args, args.indexOf("--mode"));
	if (modeValue === "manual" || modeValue === "autonomous") {
		options.mode = modeValue;
	}
	const markerArg = getFlagValue(args, args.indexOf("--completion-marker"));
	if (markerArg) options.completionMarkerPath = markerArg;
	if (
		maxAutoTierValue === "low" ||
		maxAutoTierValue === "medium" ||
		maxAutoTierValue === "high"
	) {
		options.maxAutoTier = maxAutoTierValue;
	}

	return { ok: true, options };
}
