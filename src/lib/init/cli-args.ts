import type { ProjectType } from "../project-type/types.js";
import type { InitOptions, IssueTracker } from "./types.js";

const INIT_VALUE_FLAGS = new Set(["--project-type", "--issue-tracker"]);
const ISSUE_TRACKERS = new Set(["linear", "github", "none"]);

/** Result of mapping raw init CLI arguments into typed options. */
export type InitCliArgsResult =
	| {
			ok: true;
			targetDir: string | undefined;
			options: InitOptions;
			interactive: boolean;
	  }
	| { ok: false; message: string };

/** Build init options from raw CLI arguments. */
export function buildInitOptionsFromCliArgs(args: string[]): InitCliArgsResult {
	const minimalFlag = args.includes("--minimal");
	const projectTypeArg = getRawFlagValue(args, "--project-type");
	const issueTrackerArg = getRawFlagValue(args, "--issue-tracker");

	if (minimalFlag && issueTrackerArg !== undefined) {
		return {
			ok: false,
			message:
				"Error: --issue-tracker cannot be used with --minimal. Granular options conflict with minimal mode.",
		};
	}
	if (issueTrackerArg !== undefined && !ISSUE_TRACKERS.has(issueTrackerArg)) {
		return {
			ok: false,
			message: `Error: Invalid --issue-tracker value: "${issueTrackerArg}". Valid values: linear | github | none.`,
		};
	}

	const issueTracker = issueTrackerArg as IssueTracker | undefined;
	const interactive = args.includes("--interactive");
	const options: InitOptions = {
		dryRun: args.includes("--dry-run"),
		force: args.includes("--force"),
		track: args.includes("--track"),
		rollback: args.includes("--rollback"),
		checkUpdates: args.includes("--check-updates"),
		update: args.includes("--update"),
		explainOwnership: args.includes("--explain-ownership"),
		interactive,
		migrate: args.includes("--migrate"),
		json: args.includes("--json"),
		...(minimalFlag ? { minimal: true } : {}),
		...(issueTracker ? { issueTracker } : {}),
		...(projectTypeArg ? { projectType: projectTypeArg as ProjectType } : {}),
	};

	return { ok: true, targetDir: findInitTargetDir(args), options, interactive };
}

function getRawFlagValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index === -1 ? undefined : args[index + 1];
}

function findInitTargetDir(args: string[]): string | undefined {
	return args.find((arg, index) => {
		if (arg.startsWith("-")) return false;
		const previous = args[index - 1];
		return !INIT_VALUE_FLAGS.has(previous ?? "");
	});
}
