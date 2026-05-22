import { getFlagValue } from "../cli/parse-utils.js";
import { VALID_CI_MIGRATE_ACTIONS } from "../ci/ci-migrate-command-contract.js";

/** Actions delegated to legacy ci-migrate helper command surfaces. */
export type CIMigrateDelegatedAction =
	| "sync-branch-protection"
	| "promote-mode";

/** Registry-facing ci-migrate option projection. */
export interface CIMigrateCliOptions {
	provider?: string | undefined;
	dryRun?: boolean | undefined;
	json?: boolean | undefined;
	apply?: boolean | undefined;
	rollback?: boolean | undefined;
	snapshot?: string | undefined;
	action?: string | undefined;
	breakGlassApprovalPath?: string | undefined;
	mergeQueueEvidencePath?: string | undefined;
	mergeQueueOrchestratorPath?: string | undefined;
	autoGenerateProofPack?: boolean | undefined;
	commitMode?: "solo" | "enterprise" | undefined;
	force?: boolean | undefined;
}

/** Parsed ci-migrate CLI arguments or a usage error. */
export type ParsedCIMigrateCliArgs =
	| {
			ok: true;
			targetDir: string | undefined;
			options: CIMigrateCliOptions;
			delegate?: undefined;
			delegatedArgs?: undefined;
	  }
	| {
			ok: true;
			targetDir: string | undefined;
			delegate: CIMigrateDelegatedAction;
			delegatedArgs: string[];
	  }
	| { ok: false; message: string };

const VALUE_FLAGS = new Set([
	"--provider",
	"--snapshot",
	"--action",
	"--break-glass-approval",
	"--merge-queue-evidence",
	"--merge-queue-orchestrator",
	"--commit-mode",
]);

const VALID_REGISTRY_ACTIONS = new Set<string>([
	...VALID_CI_MIGRATE_ACTIONS,
	"sync-branch-protection",
	"promote-mode",
]);

/** Build ci-migrate execution inputs from raw command-line arguments. */
export function buildCIMigrateOptionsFromCliArgs(
	args: string[],
): ParsedCIMigrateCliArgs {
	const positionalArgs = collectPositionalArgs(args);
	const actionIndex = args.indexOf("--action");
	const actionArg = getFlagValue(args, actionIndex);
	let parsedAction = actionArg;

	if (
		!parsedAction &&
		positionalArgs[0] &&
		VALID_REGISTRY_ACTIONS.has(positionalArgs[0])
	) {
		parsedAction = positionalArgs.shift();
	}

	if (positionalArgs.length > 1) {
		return {
			ok: false,
			message:
				"Error: ci-migrate accepts at most one target directory positional argument.",
		};
	}

	const targetDir = positionalArgs[0];
	const delegatedArgs = buildDelegatedArgs(args, actionArg, actionIndex);

	if (parsedAction === "sync-branch-protection") {
		return { ok: true, targetDir, delegate: parsedAction, delegatedArgs };
	}
	if (parsedAction === "promote-mode") {
		return { ok: true, targetDir, delegate: parsedAction, delegatedArgs };
	}

	return {
		ok: true,
		targetDir,
		options: {
			provider: getFlagValue(args, args.indexOf("--provider")),
			dryRun: args.includes("--dry-run"),
			...(args.includes("--json") ? { json: true } : {}),
			apply: args.includes("--apply"),
			rollback: args.includes("--rollback"),
			snapshot: getFlagValue(args, args.indexOf("--snapshot")),
			action: parsedAction,
			breakGlassApprovalPath: getFlagValue(
				args,
				args.indexOf("--break-glass-approval"),
			),
			mergeQueueEvidencePath: getFlagValue(
				args,
				args.indexOf("--merge-queue-evidence"),
			),
			mergeQueueOrchestratorPath: getFlagValue(
				args,
				args.indexOf("--merge-queue-orchestrator"),
			),
			autoGenerateProofPack: args.includes("--auto-generate-proof-pack"),
			commitMode: parseCommitMode(
				getFlagValue(args, args.indexOf("--commit-mode")),
			),
			force: args.includes("--force"),
		},
	};
}

function collectPositionalArgs(args: string[]): string[] {
	const positionalArgs: string[] = [];
	for (let index = 0; index < args.length; index++) {
		const token = args[index];
		if (!token) continue;
		if (token.startsWith("--")) {
			if (VALUE_FLAGS.has(token)) {
				const nextToken = args[index + 1];
				if (nextToken && !nextToken.startsWith("-")) index += 1;
			}
			continue;
		}
		if (token.startsWith("-")) continue;
		positionalArgs.push(token);
	}
	return positionalArgs;
}

function buildDelegatedArgs(
	args: string[],
	actionArg: string | undefined,
	actionIndex: number,
): string[] {
	if (actionArg && actionIndex >= 0) {
		const filtered = [...args];
		filtered.splice(actionIndex, 2);
		return filtered;
	}
	return args.slice(1);
}

function parseCommitMode(
	commitModeRaw: string | undefined,
): "solo" | "enterprise" | undefined {
	return commitModeRaw === "solo" || commitModeRaw === "enterprise"
		? commitModeRaw
		: undefined;
}
