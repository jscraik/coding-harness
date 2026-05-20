import { runDocsGateCLI } from "../../../commands/docs-gate.js";
import { getFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

/** Build the docs-gate registry seam. */
export function createDocsGateCommandSpec(): CommandSpec {
	return {
		name: "docs-gate",
		summary: "Enforce documentation parity for governance changes",
		errorLabel: "Docs Gate Error",
		execute: runDocsGateCommand,
	};
}

function runDocsGateCommand(args: string[]): number {
	const options: Parameters<typeof runDocsGateCLI>[0] = {};

	if (args.includes("--json")) options.json = true;
	const modeArg = getFlagValue(args, args.indexOf("--mode"));
	if (modeArg === "advisory" || modeArg === "required") {
		options.mode = modeArg;
	}
	const triggerArg = getFlagValue(args, args.indexOf("--trigger"));
	if (
		triggerArg === "local" ||
		triggerArg === "pull_request" ||
		triggerArg === "merge_group" ||
		triggerArg === "manual_ci"
	) {
		options.trigger = triggerArg;
	}
	const outArg = getFlagValue(args, args.indexOf("--out"));
	if (outArg !== undefined) options.outPath = outArg;
	const filesArg = getFlagValue(args, args.indexOf("--files"));
	if (filesArg !== undefined) {
		options.changedFiles = parseCsvList(filesArg);
	}
	const repoRootArg = getFlagValue(args, args.indexOf("--repo-root"));
	if (repoRootArg) options.repoRoot = repoRootArg;
	const trustedBaseRefArg = getFlagValue(
		args,
		args.indexOf("--trusted-base-ref"),
	);
	if (trustedBaseRefArg !== undefined) {
		options.trustedBaseRef = trustedBaseRefArg;
	}
	const trustedContractShaArg = getFlagValue(
		args,
		args.indexOf("--trusted-contract-sha"),
	);
	if (trustedContractShaArg !== undefined) {
		options.trustedContractSha = trustedContractShaArg;
	}
	const trustedWorkflowShaArg = getFlagValue(
		args,
		args.indexOf("--trusted-workflow-sha"),
	);
	if (trustedWorkflowShaArg !== undefined) {
		options.trustedWorkflowSha = trustedWorkflowShaArg;
	}
	const mergeQueueTargetRefArg = getFlagValue(
		args,
		args.indexOf("--merge-queue-target-ref"),
	);
	if (mergeQueueTargetRefArg !== undefined) {
		options.mergeQueueTargetRef = mergeQueueTargetRefArg;
	}
	const mergeQueueBaseShaArg = getFlagValue(
		args,
		args.indexOf("--merge-queue-base-sha"),
	);
	if (mergeQueueBaseShaArg !== undefined) {
		options.mergeQueueBaseSha = mergeQueueBaseShaArg;
	}

	return runDocsGateCLI(options);
}
