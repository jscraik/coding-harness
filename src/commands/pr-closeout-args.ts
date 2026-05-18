import { resolve } from "node:path";
import { cwd } from "node:process";

/** Parsed options for the read-only PR closeout command facade. */
export interface PrCloseoutCLIOptions {
	json: boolean;
	repoRoot: string;
	inputPath?: string;
	prNumber?: number;
	envFilePath?: string;
	closeoutGatesPath?: string;
	phaseExitPath?: string;
}

type PrCloseoutParseResult =
	| { options: PrCloseoutCLIOptions }
	| { exitCode: number };

function printUsage(): void {
	console.info(
		"Usage: harness pr-closeout [--json] [--repo <path>] [--input <path> | --pr <number>] [--gates <path>] [--phase-exit <path>] [--env-file <path>]",
	);
	console.info("");
	console.info(
		"Build a read-only pr-closeout/v1 report from normalized evidence or live GitHub CLI state, including Coding Harness closeout gates.",
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

function parsePositiveInteger(value: string | undefined): number | undefined {
	if (!value) return undefined;
	if (!/^\d+$/u.test(value)) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
	return parsed;
}

/** Parse command-line arguments for the PR closeout evidence command. */
export function parseArgs(args: readonly string[]): PrCloseoutParseResult {
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
		if (arg === "--repo") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --repo requires a path");
				return { exitCode: 2 };
			}
			options.repoRoot = resolve(value);
			index += 1;
			continue;
		}
		if (arg === "--input") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --input requires a path");
				return { exitCode: 2 };
			}
			options.inputPath = value;
			index += 1;
			continue;
		}
		if (arg === "--pr") {
			const value = parsePositiveInteger(readFlagValue(args, index));
			if (!value) {
				console.error("pr-closeout: --pr requires a positive integer");
				return { exitCode: 2 };
			}
			options.prNumber = value;
			index += 1;
			continue;
		}
		if (arg === "--env-file") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --env-file requires a path");
				return { exitCode: 2 };
			}
			options.envFilePath = resolve(value);
			index += 1;
			continue;
		}
		if (arg === "--phase-exit") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --phase-exit requires a path");
				return { exitCode: 2 };
			}
			options.phaseExitPath = value;
			index += 1;
			continue;
		}
		if (arg === "--gates") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("pr-closeout: --gates requires a path");
				return { exitCode: 2 };
			}
			options.closeoutGatesPath = value;
			index += 1;
			continue;
		}
		console.error(`pr-closeout: unknown argument ${String(arg)}`);
		return { exitCode: 2 };
	}
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
