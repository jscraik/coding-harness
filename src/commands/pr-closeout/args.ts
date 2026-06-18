import { resolve } from "node:path";
import { cwd } from "node:process";
import type { PrCloseoutInput } from "../../lib/pr-closeout.js";

type PrCloseoutReleaseReadinessImpact = NonNullable<
	PrCloseoutInput["releaseReadinessImpact"]
>;

const RELEASE_READINESS_IMPACTS: ReadonlySet<PrCloseoutReleaseReadinessImpact> =
	new Set(["none", "governed_change", "release_blocker", "unknown"]);

/** Parsed CLI options accepted by the PR closeout command facade. */
export interface PrCloseoutCLIOptions {
	json: boolean;
	snapshot?: boolean;
	repoRoot: string;
	inputPath?: string;
	prNumber?: number;
	envFilePath?: string;
	closeoutGatesPath?: string;
	phaseExitPath?: string;
	assurancePath?: string;
	runtimeEvidencePath?: string;
	releaseReadinessImpact?: PrCloseoutReleaseReadinessImpact;
}

/** Result of parsing PR closeout CLI arguments, including early exits. */
export type PrCloseoutParseResult =
	| { options: PrCloseoutCLIOptions }
	| { exitCode: number };

function printUsage(): void {
	console.info(
		"Usage: harness pr-closeout [--json] [--repo <path>] [--input <path> | --pr <number>] [--gates <path>] [--phase-exit <path>] [--assurance <path>] [--runtime-evidence <path>] [--release-readiness-impact <none|governed_change|release_blocker|unknown>] [--env-file <path>]",
	);
	console.info("");
	console.info(
		"Build a read-only pr-closeout/v1 report from normalized evidence or live GitHub CLI state, including Coding Harness closeout gates and seven-layer assurance.",
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

function requireFlagValue(
	args: readonly string[],
	index: number,
	errorMessage: string,
): string | undefined {
	const value = readFlagValue(args, index);
	if (!value) console.error(errorMessage);
	return value;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
	if (!value) return undefined;
	if (!/^\d+$/u.test(value)) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parseReleaseReadinessImpact(
	value: string | undefined,
): PrCloseoutReleaseReadinessImpact | undefined {
	if (!value) return undefined;
	if (
		RELEASE_READINESS_IMPACTS.has(value as PrCloseoutReleaseReadinessImpact)
	) {
		return value as PrCloseoutReleaseReadinessImpact;
	}
	return undefined;
}

type FlagParseResult =
	| "handled"
	| "handledWithoutArg"
	| "unknown"
	| { exitCode: number };

type StringFlagConfig = {
	errorMessage: string;
	assign: (options: PrCloseoutCLIOptions, value: string) => void;
};

const STRING_FLAGS: Readonly<Record<string, StringFlagConfig>> = {
	"--repo": {
		errorMessage: "pr-closeout: --repo requires a path",
		assign: (options, value) => {
			options.repoRoot = resolve(value);
		},
	},
	"--input": {
		errorMessage: "pr-closeout: --input requires a path",
		assign: (options, value) => {
			options.inputPath = value;
		},
	},
	"--env-file": {
		errorMessage: "pr-closeout: --env-file requires a path",
		assign: (options, value) => {
			options.envFilePath = resolve(value);
		},
	},
	"--phase-exit": {
		errorMessage: "pr-closeout: --phase-exit requires a path",
		assign: (options, value) => {
			options.phaseExitPath = value;
		},
	},
	"--gates": {
		errorMessage: "pr-closeout: --gates requires a path",
		assign: (options, value) => {
			options.closeoutGatesPath = value;
		},
	},
	"--assurance": {
		errorMessage: "pr-closeout: --assurance requires a path",
		assign: (options, value) => {
			options.assurancePath = value;
		},
	},
	"--runtime-evidence": {
		errorMessage: "pr-closeout: --runtime-evidence requires a path",
		assign: (options, value) => {
			options.runtimeEvidencePath = value;
		},
	},
};

function applyStringFlag(
	options: PrCloseoutCLIOptions,
	args: readonly string[],
	index: number,
	config: StringFlagConfig,
): FlagParseResult {
	const value = requireFlagValue(args, index, config.errorMessage);
	if (!value) return { exitCode: 2 };
	config.assign(options, value);
	return "handled";
}

function applyPrNumberFlag(
	options: PrCloseoutCLIOptions,
	args: readonly string[],
	index: number,
): FlagParseResult {
	const value = parsePositiveInteger(readFlagValue(args, index));
	if (!value) {
		console.error("pr-closeout: --pr requires a positive integer");
		return { exitCode: 2 };
	}
	options.prNumber = value;
	return "handled";
}

function applyReleaseReadinessImpactFlag(
	options: PrCloseoutCLIOptions,
	args: readonly string[],
	index: number,
): FlagParseResult {
	const value = parseReleaseReadinessImpact(readFlagValue(args, index));
	if (!value) {
		console.error(
			"pr-closeout: --release-readiness-impact requires one of none, governed_change, release_blocker, unknown",
		);
		return { exitCode: 2 };
	}
	options.releaseReadinessImpact = value;
	return "handled";
}

function applyPrCloseoutFlag(
	options: PrCloseoutCLIOptions,
	args: readonly string[],
	index: number,
): FlagParseResult {
	const arg = args[index];
	if (arg === "--pr") {
		return applyPrNumberFlag(options, args, index);
	}
	if (arg === "--snapshot") {
		options.snapshot = true;
		return "handledWithoutArg";
	}
	if (arg === "--release-readiness-impact") {
		return applyReleaseReadinessImpactFlag(options, args, index);
	}
	const config = typeof arg === "string" ? STRING_FLAGS[arg] : undefined;
	return config ? applyStringFlag(options, args, index, config) : "unknown";
}

function validatePrCloseoutOptions(
	options: PrCloseoutCLIOptions,
): PrCloseoutParseResult {
	if (options.closeoutGatesPath && options.phaseExitPath) {
		console.error("pr-closeout: use either --gates or --phase-exit, not both");
		return { exitCode: 2 };
	}
	if (options.inputPath && options.prNumber !== undefined) {
		console.error("pr-closeout: use either --input or --pr, not both");
		return { exitCode: 2 };
	}
	if (!options.inputPath && options.prNumber === undefined) {
		console.error("pr-closeout: either --input or --pr is required");
		return { exitCode: 2 };
	}
	return { options };
}

/** Parses argv tokens into validated PR closeout command options. */
export function parsePrCloseoutArgs(
	args: readonly string[],
): PrCloseoutParseResult {
	if (args.includes("--help") || args.includes("-h")) {
		printUsage();
		return { exitCode: 0 };
	}
	const options: PrCloseoutCLIOptions = {
		json: args.includes("--json"),
		repoRoot: cwd(),
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json") continue;
		const result = applyPrCloseoutFlag(options, args, index);
		if (result === "handled") {
			index += 1;
			continue;
		}
		if (result === "handledWithoutArg") {
			continue;
		}
		if (result !== "unknown") return result;
		console.error(`pr-closeout: unknown argument ${String(arg)}`);
		return { exitCode: 2 };
	}
	return validatePrCloseoutOptions(options);
}
