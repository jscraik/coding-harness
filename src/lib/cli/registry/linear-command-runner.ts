import { runLinearPrepareCLI } from "../../../commands/linear-prepare.js";
import { runLinearSyncCLI } from "../../../commands/linear-sync.js";
import { runLinearTriageCLI } from "../../../commands/linear-triage.js";
import { runLinearWorkflowCLI } from "../../../commands/linear-workflow.js";
import { getFlagValue, parseCsvList, parseIntegerArg } from "../parse-utils.js";

type LinearAction =
	| "claim"
	| "handoff"
	| "close"
	| "prepare"
	| "sync"
	| "triage";

interface LinearCommandFlags {
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

function parseLinearAction(args: string[]): LinearAction | undefined {
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

function collectLinearCommandFlags(args: string[]): LinearCommandFlags {
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

function runLinearSync(args: string[], flags: LinearCommandFlags) {
	const options: Parameters<typeof runLinearSyncCLI>[0] = {};
	if (flags.json) options.json = true;
	if (flags.dryRun) options.dryRun = true;
	const tokenArg = getFlagValue(args, flags.token);
	if (tokenArg) options.token = tokenArg;
	const teamArg = getFlagValue(args, flags.team);
	if (teamArg) options.team = teamArg;
	const findingsArg = getFlagValue(args, flags.findings);
	if (findingsArg) options.findings = findingsArg;
	return runLinearSyncCLI(options);
}

function runLinearPrepare(args: string[], flags: LinearCommandFlags) {
	const options: Parameters<typeof runLinearPrepareCLI>[0] = {};
	if (flags.json) options.json = true;
	const issueArg = getFlagValue(args, flags.issue);
	if (issueArg) options.issue = issueArg;
	const tokenArg = getFlagValue(args, flags.token);
	if (tokenArg) options.token = tokenArg;
	const teamArg = getFlagValue(args, flags.team);
	if (teamArg) options.team = teamArg;
	const branchPrefixArg = getFlagValue(args, flags.branchPrefix);
	if (branchPrefixArg) options.branchPrefix = branchPrefixArg;
	const fieldArg = getFlagValue(args, flags.field);
	if (
		fieldArg === "branch" ||
		fieldArg === "pr-title" ||
		fieldArg === "pr-body" ||
		fieldArg === "link-line" ||
		fieldArg === "closing-line" ||
		fieldArg === "issue-url"
	) {
		options.field = fieldArg;
	}
	return runLinearPrepareCLI(options);
}

function runLinearTriage(args: string[], flags: LinearCommandFlags) {
	const options: Parameters<typeof runLinearTriageCLI>[0] = {};
	if (flags.json) options.json = true;
	if (flags.dryRun) options.dryRun = true;
	if (args.includes("--apply")) options.apply = true;
	if (flags.confirm) options.confirm = true;
	if (!flags.syncTypeLabels) options.syncTypeLabels = false;

	const tokenArg = getFlagValue(args, flags.token);
	if (tokenArg) options.token = tokenArg;
	const teamArg = getFlagValue(args, flags.team);
	if (teamArg) options.team = teamArg;
	const projectArg = getFlagValue(args, flags.project);
	if (projectArg) options.project = projectArg;
	const issueArg = getFlagValue(args, flags.issue);
	if (issueArg) options.issue = issueArg;

	const limitArg = parseIntegerArg(getFlagValue(args, flags.limit), 1);
	if (limitArg !== undefined) options.limit = limitArg;
	const inProgressCapArg = parseIntegerArg(
		getFlagValue(args, flags.inProgressCap),
		1,
	);
	if (inProgressCapArg !== undefined) options.inProgressCap = inProgressCapArg;
	const maxPromoteArg = parseIntegerArg(
		getFlagValue(args, flags.maxPromote),
		0,
	);
	if (maxPromoteArg !== undefined) options.maxPromote = maxPromoteArg;

	const metadataThresholdArg = getFlagValue(args, flags.metadataThreshold);
	if (metadataThresholdArg !== undefined) {
		const parsed = Number.parseFloat(metadataThresholdArg);
		if (Number.isFinite(parsed)) options.metadataThreshold = parsed;
	}

	return runLinearTriageCLI(options);
}

function runLinearWorkflow(
	action: Exclude<LinearAction, "prepare" | "sync" | "triage">,
	args: string[],
	flags: LinearCommandFlags,
) {
	const options: Parameters<typeof runLinearWorkflowCLI>[0] = { action };

	if (flags.json) options.json = true;
	if (flags.noAssign) options.noAssign = true;
	const issueArg = getFlagValue(args, flags.issue);
	if (issueArg) options.issue = issueArg;
	const tokenArg = getFlagValue(args, flags.token);
	if (tokenArg) options.token = tokenArg;
	const teamArg = getFlagValue(args, flags.team);
	if (teamArg) options.team = teamArg;
	const stateArg = getFlagValue(args, flags.state);
	if (stateArg) options.state = stateArg;
	const assigneeArg = getFlagValue(args, flags.assignee);
	if (assigneeArg) options.assignee = assigneeArg;
	const commentArg = getFlagValue(args, flags.comment);
	if (commentArg) options.comment = commentArg;
	const branchArg = getFlagValue(args, flags.branch);
	if (branchArg !== undefined) options.branch = branchArg;
	const workspaceArg = getFlagValue(args, flags.workspace);
	if (workspaceArg) options.workspace = workspaceArg;
	const prUrlArg = getFlagValue(args, flags.prUrl);
	if (prUrlArg) options.prUrl = prUrlArg;
	const evidenceUrlArg = getFlagValue(args, flags.evidenceUrl);
	if (evidenceUrlArg !== undefined) {
		options.evidenceUrls = parseCsvList(evidenceUrlArg);
	}
	const linksArg = getFlagValue(args, flags.links);
	if (linksArg !== undefined) options.links = parseCsvList(linksArg);

	return runLinearWorkflowCLI(options);
}

/** Run the Linear workflow command from parsed registry arguments. */
export function runLinearCommand(args: string[]) {
	const action = parseLinearAction(args);
	if (action === undefined) return 2;
	const flags = collectLinearCommandFlags(args);

	if (action === "sync") return runLinearSync(args, flags);
	if (action === "prepare") return runLinearPrepare(args, flags);
	if (action === "triage") return runLinearTriage(args, flags);
	return runLinearWorkflow(action, args, flags);
}
