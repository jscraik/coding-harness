import { getFlagValue } from "../cli/parse-utils.js";
import type { SimulateOptions } from "./types.js";

/** Parsed simulate CLI arguments or a usage error message. */
export type ParsedSimulateCliArgs =
	| { ok: true; options: SimulateOptions }
	| { ok: false; message: string };

/** Build typed simulate options from raw command-line arguments. */
export function buildSimulateOptionsFromCliArgs(
	args: string[],
): ParsedSimulateCliArgs {
	const contractA = getFlagValue(args, args.indexOf("--contract-a"));
	const contractB = getFlagValue(args, args.indexOf("--contract-b"));

	if (!contractA) {
		return { ok: false, message: "Error: --contract-a is required" };
	}
	if (!contractB) {
		return { ok: false, message: "Error: --contract-b is required" };
	}

	const options: SimulateOptions = { contractA, contractB };

	if (args.includes("--json")) options.json = true;
	if (args.includes("--ci-soft")) options.ciSoft = true;
	if (args.includes("--verbose")) options.verbose = true;

	const artifactsArg = getFlagValue(args, args.indexOf("--artifacts"));
	if (artifactsArg) options.artifactsDir = artifactsArg;
	const tracesArg = getFlagValue(args, args.indexOf("--traces"));
	if (tracesArg) options.tracesDir = tracesArg;
	const outputArg = getFlagValue(args, args.indexOf("--output"));
	if (outputArg) options.outputPath = outputArg;

	return { ok: true, options };
}
