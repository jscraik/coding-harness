import { existsSync } from "node:fs";
import { parseIntegerArg } from "../cli/parse-utils.js";
import { scanBrainMetadata } from "./metadata-scanner.js";
import {
	EXIT_CODES,
	type BrainCliResult,
	type BrainStaleResult,
} from "./cli-types.js";
import {
	getBrainFlagValue,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";
import { renderBrainStaleHuman } from "./stale-presenter.js";

/** Public API export. */
export function runBrainStale(
	harnessDir: string,
	options?: { thresholdDays?: number; now?: Date },
): BrainStaleResult {
	const scanOptions: { thresholdDays?: number; now?: Date } = {};
	if (options?.thresholdDays !== undefined)
		scanOptions.thresholdDays = options.thresholdDays;
	if (options?.now !== undefined) scanOptions.now = options.now;
	const report = scanBrainMetadata(harnessDir, scanOptions);
	return { report };
}

/** Run the Project Brain stale subcommand and render CLI output. */
export function cliBrainStale(args: string[]): BrainCliResult {
	const harnessDir = resolveBrainHarnessDir(
		getBrainFlagValue(args, args.indexOf("--dir")),
	);
	const thresholdVal = getBrainFlagValue(
		args,
		args.indexOf("--threshold-days"),
	);
	const thresholdDays =
		thresholdVal === undefined ? undefined : parseIntegerArg(thresholdVal, 0);
	if (thresholdVal !== undefined && thresholdDays === undefined) {
		process.stderr.write(
			"Error: --threshold-days must be a non-negative integer\n",
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const staleOptions: { thresholdDays?: number } = {};
	if (thresholdDays !== undefined) staleOptions.thresholdDays = thresholdDays;
	const result = runBrainStale(harnessDir, staleOptions);
	const json = shouldRenderBrainJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainStaleHuman(result));
	}

	if (result.report.staleFiles.length > 0)
		return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}
