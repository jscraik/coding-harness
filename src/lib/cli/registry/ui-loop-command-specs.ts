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
type ParsedUIOptions<T> =
	| { ok: true; options: T }
	| { ok: false; error: string };

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
		execute: (args) => {
			const parsed = parseUIVerifyOptions(args);
			if (!parsed.ok) return usageError(parsed.error);
			return runUIVerifyCLI(parsed.options);
		},
	};
}

function usageError(message: string): number {
	console.error(`Error: ${message}`);
	return 2;
}

function parseUIVerifyOptions(
	args: string[],
): ParsedUIOptions<UIVerifyOptions> {
	const parsedBase = parseBaseUIOptions(args);
	if (!parsedBase.ok) return parsedBase;
	const options: UIVerifyOptions = parsedBase.options;
	const timeoutArg = getFlagValue(args, args.indexOf("--timeout"));
	const parsedTimeout = timeoutArg ? parseIntegerArg(timeoutArg, 1) : undefined;
	if (timeoutArg !== undefined && parsedTimeout === undefined) {
		return {
			ok: false,
			error: "Invalid --timeout value. Expected integer >= 1.",
		};
	}
	if (parsedTimeout !== undefined) options.timeout = parsedTimeout;
	const shardArg = getFlagValue(args, args.indexOf("--shard"));
	if (shardArg) options.shard = shardArg;
	return { ok: true, options };
}

function createUIExploreCommandSpec({
	runUIExploreCLI,
}: UILoopRunners): CommandSpec {
	return {
		name: "ui:explore",
		aliases: ["ui-explore"],
		summary: "Agent browser exploratory testing",
		errorLabel: "UI Explore Error",
		execute: (args) => {
			const parsed = parseUIExploreOptions(args);
			if (!parsed.ok) return usageError(parsed.error);
			return runUIExploreCLI(parsed.options);
		},
	};
}

function parseUIExploreOptions(
	args: string[],
): ParsedUIOptions<UIExploreOptions> {
	const parsedBase = parseBaseUIOptions(args);
	if (!parsedBase.ok) return parsedBase;
	const options: UIExploreOptions = parsedBase.options;
	if (args.includes("--interactions")) options.interactions = true;
	const urlArg = getFlagValue(args, args.indexOf("--url"));
	if (urlArg) options.url = urlArg;
	return { ok: true, options };
}

function parseUIModeOption(
	args: string[],
	currentMode: UICommandMode | undefined,
): ParsedUIOptions<{ mode?: UICommandMode }> {
	const modeArg = getFlagValue(args, args.indexOf("--mode"));
	if (currentMode || modeArg === undefined) return { ok: true, options: {} };
	if (modeArg !== "execute" && modeArg !== "prepare") {
		return {
			ok: false,
			error: 'Invalid --mode value. Expected "execute" or "prepare".',
		};
	}
	return { ok: true, options: { mode: modeArg } };
}

function parseBaseUIOptions(args: string[]): ParsedUIOptions<BaseUIOptions> {
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
	const mode = parseUIModeOption(args, options.mode);
	if (!mode.ok) return mode;
	if (mode.options.mode) options.mode = mode.options.mode;
	return { ok: true, options };
}
