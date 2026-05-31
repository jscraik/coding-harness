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

type FlagParseResult = "handled" | "unknown" | { exitCode: number };

function applyStringFlag(
	args: readonly string[],
	index: number,
	assign: (value: string) => void,
	errorMessage: string,
): FlagParseResult {
	const value = requireFlagValue(args, index, errorMessage);
	if (!value) return { exitCode: 2 };
	assign(value);
	return "handled";
}

function applyPrCloseoutFlag(
	options: PrCloseoutCLIOptions,
	args: readonly string[],
	index: number,
): FlagParseResult {
	const arg = args[index];
	if (arg === "--repo") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.repoRoot = resolve(value);
			},
			"pr-closeout: --repo requires a path",
		);
	}
	if (arg === "--input") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.inputPath = value;
			},
			"pr-closeout: --input requires a path",
		);
	}
	if (arg === "--pr") {
		const value = parsePositiveInteger(readFlagValue(args, index));
		if (!value) {
			console.error("pr-closeout: --pr requires a positive integer");
			return { exitCode: 2 };
		}
		options.prNumber = value;
		return "handled";
	}
	if (arg === "--snapshot") {
		options.snapshot = true;
		return "handledWithoutArg";
	}
	if (arg === "--env-file") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.envFilePath = resolve(value);
			},
			"pr-closeout: --env-file requires a path",
		);
	}
	if (arg === "--phase-exit") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.phaseExitPath = value;
			},
			"pr-closeout: --phase-exit requires a path",
		);
	}
	if (arg === "--gates") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.closeoutGatesPath = value;
			},
			"pr-closeout: --gates requires a path",
		);
	}
	if (arg === "--assurance") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.assurancePath = value;
			},
			"pr-closeout: --assurance requires a path",
		);
	}
	if (arg === "--runtime-evidence") {
		return applyStringFlag(
			args,
			index,
			(value) => {
				options.runtimeEvidencePath = value;
			},
			"pr-closeout: --runtime-evidence requires a path",
		);
	}
	if (arg === "--release-readiness-impact") {
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
	return "unknown";
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
