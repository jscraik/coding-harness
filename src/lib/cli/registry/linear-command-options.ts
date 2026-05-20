import { inspectFlagValue, parseIntegerArg } from "../parse-utils.js";

/** Supported Linear workflow subcommands accepted by the registry runner. */
export type LinearAction =
	| "claim"
	| "handoff"
	| "close"
	| "prepare"
	| "sync"
	| "triage";

/** Parsed flag indexes and booleans for Linear workflow command dispatch. */
export interface LinearCommandFlags {
	json: boolean;
	noAssign: boolean;
	dryRun: boolean;
	confirm: boolean;
	syncTypeLabels: boolean;
	issue: number;
	project: number;
	token: number;
	team: number;
	findings: number;
	state: number;
	assignee: number;
	comment: number;
	branch: number;
	workspace: number;
	prUrl: number;
	evidenceUrl: number;
	links: number;
	branchPrefix: number;
	field: number;
	limit: number;
	metadataThreshold: number;
	inProgressCap: number;
	maxPromote: number;
}

const LINEAR_VALUE_FLAGS = [
	"--issue",
	"--project",
	"--token",
	"--team",
	"--findings",
	"--state",
	"--assignee",
	"--comment",
	"--branch",
	"--workspace",
	"--pr-url",
	"--evidence-url",
	"--links",
	"--branch-prefix",
	"--field",
	"--limit",
	"--metadata-threshold",
	"--in-progress-cap",
	"--max-promote",
] as const;

const LINEAR_INTEGER_FLAGS = new Map([
	["--limit", 1],
	["--in-progress-cap", 1],
	["--max-promote", 0],
]);

/** Validate Linear value-bearing flags before command execution. */
export function validateLinearValueFlags(args: string[]): number | undefined {
	for (const flag of LINEAR_VALUE_FLAGS) {
		const inspected = inspectFlagValue(args, flag);
		if (inspected.missingValue) {
			console.error(`linear ${flag} requires a value.`);
			return 2;
		}
		const minimum = LINEAR_INTEGER_FLAGS.get(flag);
		if (minimum !== undefined && inspected.value !== undefined) {
			if (parseIntegerArg(inspected.value, minimum) === undefined) {
				console.error(`linear ${flag} must be an integer >= ${minimum}.`);
				return 2;
			}
		}
	}
	const metadataThreshold = inspectFlagValue(args, "--metadata-threshold");
	if (metadataThreshold.value !== undefined) {
		const parsed = Number(metadataThreshold.value);
		if (!Number.isFinite(parsed)) {
			console.error("linear --metadata-threshold must be a finite number.");
			return 2;
		}
	}
	return undefined;
}

/** Parse the Linear workflow action token from registry arguments. */
export function parseLinearAction(args: string[]): LinearAction | undefined {
	const action = args[0];
	if (
		action === "claim" ||
		action === "handoff" ||
		action === "close" ||
		action === "prepare" ||
		action === "sync" ||
		action === "triage"
	) {
		return action;
	}
	console.error(
		"linear expects an action of claim, handoff, close, prepare, sync, or triage.",
	);
	return undefined;
}

/** Collect Linear workflow flag positions and boolean switches. */
export function collectLinearCommandFlags(args: string[]): LinearCommandFlags {
	return {
		json: args.includes("--json"),
		noAssign: args.includes("--no-assign"),
		dryRun: args.includes("--dry-run"),
		confirm: args.includes("--confirm"),
		syncTypeLabels: !args.includes("--no-type-label-sync"),
		issue: args.indexOf("--issue"),
		project: args.indexOf("--project"),
		token: args.indexOf("--token"),
		team: args.indexOf("--team"),
		findings: args.indexOf("--findings"),
		state: args.indexOf("--state"),
		assignee: args.indexOf("--assignee"),
		comment: args.indexOf("--comment"),
		branch: args.indexOf("--branch"),
		workspace: args.indexOf("--workspace"),
		prUrl: args.indexOf("--pr-url"),
		evidenceUrl: args.indexOf("--evidence-url"),
		links: args.indexOf("--links"),
		branchPrefix: args.indexOf("--branch-prefix"),
		field: args.indexOf("--field"),
		limit: args.indexOf("--limit"),
		metadataThreshold: args.indexOf("--metadata-threshold"),
		inProgressCap: args.indexOf("--in-progress-cap"),
		maxPromote: args.indexOf("--max-promote"),
	};
}
