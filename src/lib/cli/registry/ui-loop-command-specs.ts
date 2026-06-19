import { getFlagValue, parseIntegerArg } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type UICommandMode = "execute" | "prepare";
type BaseUIOptions = {
	outputDir?: string;
	json?: boolean;
	contractPath?: string;
	dryRun?: boolean;
	mode?: UICommandMode;
};
type UIVerifyOptions = BaseUIOptions & {
	timeout?: number;
	shard?: string;
};
type UIExploreOptions = BaseUIOptions & {
	url?: string;
	interactions?: boolean;
};
type UIVerifyRunner = (options: UIVerifyOptions) => number;
type UIExploreRunner = (options: UIExploreOptions) => number;
type UILoopRunners = {
	runUIVerifyCLI: UIVerifyRunner;
	runUIExploreCLI: UIExploreRunner;
};

/** Build UI loop command adapters that require option parsing. */
export function createUILoopCommandSpecs(
	runners: UILoopRunners,
): CommandSpec[] {
	return [
		createUIVerifyCommandSpec(runners),
		createUIExploreCommandSpec(runners),
	];
}

function createUIVerifyCommandSpec({
	runUIVerifyCLI,
}: UILoopRunners): CommandSpec {
	return {
		name: "ui:verify",
		aliases: ["ui-verify"],
		summary: "Playwright smoke suite with evidence",
		errorLabel: "UI Verify Error",
		execute: (args) => runUIVerifyCLI(parseUIVerifyOptions(args)),
	};
}

function parseUIVerifyOptions(args: string[]): UIVerifyOptions {
	const options: UIVerifyOptions = parseBaseUIOptions(args);
	const timeoutArg = getFlagValue(args, args.indexOf("--timeout"));
	const parsedTimeout = timeoutArg ? parseIntegerArg(timeoutArg, 1) : undefined;
	if (parsedTimeout !== undefined) options.timeout = parsedTimeout;
	const shardArg = getFlagValue(args, args.indexOf("--shard"));
	if (shardArg) options.shard = shardArg;
	return options;
}

function createUIExploreCommandSpec({
	runUIExploreCLI,
}: UILoopRunners): CommandSpec {
	return {
		name: "ui:explore",
		aliases: ["ui-explore"],
		summary: "Agent browser exploratory testing",
		errorLabel: "UI Explore Error",
		execute: (args) => runUIExploreCLI(parseUIExploreOptions(args)),
	};
}

function parseUIExploreOptions(args: string[]): UIExploreOptions {
	const options: UIExploreOptions = parseBaseUIOptions(args);
	if (args.includes("--interactions")) options.interactions = true;
	const urlArg = getFlagValue(args, args.indexOf("--url"));
	if (urlArg) options.url = urlArg;
	return options;
}

function parseBaseUIOptions(args: string[]): BaseUIOptions {
	const options: BaseUIOptions = {};
	if (args.includes("--json")) options.json = true;
	if (args.includes("--dry-run")) {
		options.dryRun = true;
		options.mode = "prepare";
	}
	const outputArg = getFlagValue(args, args.indexOf("--output"));
	if (outputArg) options.outputDir = outputArg;
	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	if (contractArg) options.contractPath = contractArg;
	const modeArg = getFlagValue(args, args.indexOf("--mode"));
	if (!options.mode && (modeArg === "execute" || modeArg === "prepare")) {
		options.mode = modeArg;
	}
	return options;
}
