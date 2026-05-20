import { resolve } from "node:path";
import { cwd } from "node:process";

/** Runtime context used when building runtime-card evidence. */
export type RuntimeCardContext = "local" | "pr" | "ci" | "closeout";

/** Parsed CLI options for `harness runtime-card`. */
export interface RuntimeCardCLIOptions {
	/** Whether to print JSON output. */
	json: boolean;
	/** Repository root used for git and artifact resolution. */
	repoRoot: string;
	/** Runtime context being summarized. */
	context: RuntimeCardContext;
	/** Optional tracker issue key. */
	issueKey?: string;
	/** Optional phase-exit artifact path. */
	phaseExitPath?: string;
	/** Optional runtime evidence bundle path. */
	evidencePath?: string;
	/** Optional runtime-card output path. */
	outPath?: string;
	/** Optional runtime evidence bundle output path. */
	evidenceOutPath?: string;
	/** Whether live provider state should be collected. */
	live: boolean;
}

/** Result of parsing runtime-card CLI arguments. */
export type RuntimeCardParseResult =
	| { options: RuntimeCardCLIOptions }
	| { exitCode: number };

const VALID_RUNTIME_CARD_CONTEXTS: readonly RuntimeCardContext[] = [
	"local",
	"pr",
	"ci",
	"closeout",
];

function isRuntimeCardContext(value: string): value is RuntimeCardContext {
	return VALID_RUNTIME_CARD_CONTEXTS.includes(value as RuntimeCardContext);
}

/** Print usage syntax for the `harness runtime-card` command. */
export function printRuntimeCardUsage(): void {
	console.info(
		"Usage: harness runtime-card [--json] [--live] [--repo <path>] [--context local|pr|ci|closeout] [--issue <key>] [--phase-exit <path>] [--evidence <path>] [--out <path>] [--evidence-out <path>]",
	);
	console.info("");
	console.info(
		"Build a runtime-card/v1 artifact from git, .harness evidence, normalized evidence bundles, and optional live provider state.",
	);
}

function readFlagValue(
	args: readonly string[],
	index: number,
): string | undefined {
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) return undefined;
	return value;
}

function setPathOption(
	options: RuntimeCardCLIOptions,
	args: readonly string[],
	index: number,
	flag: "--phase-exit" | "--evidence" | "--out" | "--evidence-out",
): RuntimeCardParseResult | null {
	const value = readFlagValue(args, index);
	if (!value) {
		const valueName =
			flag === "--phase-exit" || flag === "--evidence"
				? "an artifact path"
				: "a file path";
		console.error(`runtime-card: ${flag} requires ${valueName}`);
		return { exitCode: 2 };
	}
	if (flag === "--phase-exit") options.phaseExitPath = value;
	if (flag === "--evidence") options.evidencePath = value;
	if (flag === "--out") options.outPath = value;
	if (flag === "--evidence-out") options.evidenceOutPath = value;
	return null;
}

/** Parse CLI arguments for the `harness runtime-card` command. */
export function parseRuntimeCardArgs(
	args: readonly string[],
): RuntimeCardParseResult {
	if (args.includes("--help") || args.includes("-h")) {
		printRuntimeCardUsage();
		return { exitCode: 0 };
	}
	const options: RuntimeCardCLIOptions = {
		json: args.includes("--json"),
		repoRoot: cwd(),
		context: "local",
		live: args.includes("--live"),
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json" || arg === "--live") continue;
		if (arg === "--repo") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --repo requires a path");
				return { exitCode: 2 };
			}
			options.repoRoot = resolve(value);
			index += 1;
			continue;
		}
		if (arg === "--context") {
			const value = readFlagValue(args, index);
			if (!value || !isRuntimeCardContext(value)) {
				const suffix = value
					? `invalid context ${value}`
					: "--context requires local, pr, ci, or closeout";
				console.error(`runtime-card: ${suffix}`);
				return { exitCode: 2 };
			}
			options.context = value;
			index += 1;
			continue;
		}
		if (arg === "--issue") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --issue requires a tracker key");
				return { exitCode: 2 };
			}
			options.issueKey = value;
			index += 1;
			continue;
		}
		if (
			["--phase-exit", "--evidence", "--out", "--evidence-out"].includes(
				arg ?? "",
			)
		) {
			const parseResult = setPathOption(
				options,
				args,
				index,
				arg as "--phase-exit" | "--evidence" | "--out" | "--evidence-out",
			);
			if (parseResult) return parseResult;
			index += 1;
			continue;
		}
		console.error(`runtime-card: unknown argument ${String(arg)}`);
		return { exitCode: 2 };
	}
	return { options };
}
