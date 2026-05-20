import { runDriftGateCLI } from "../../drift-gate.js";
import { inspectFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type DriftGateOptions = Parameters<typeof runDriftGateCLI>[0];

/** Build the canonical drift-gate command adapter. */
export function createDriftGateCommandSpec(): CommandSpec {
	return {
		name: "drift-gate",
		summary: "Evaluate consistency drift across governance surfaces",
		example: "drift-gate --mode advisory --json",
		errorLabel: "Drift Gate Error",
		execute: runDriftGateCommand,
	};
}

function runDriftGateCommand(args: string[]): number {
	const jsonFlag = args.includes("--json");
	const seedBaselineFlag = args.includes("--seed-baseline");
	const noSeedFlag = args.includes("--no-seed");
	const modeFlag = inspectFlagValue(args, "--mode");
	const outFlag = inspectFlagValue(args, "--out");
	const baselineFlag = inspectFlagValue(args, "--baseline");
	const suppressFlag = inspectFlagValue(args, "--suppress");
	const repoRootFlag = inspectFlagValue(args, "--repo-root");

	if (seedBaselineFlag && noSeedFlag) {
		console.error("Error: --seed-baseline conflicts with --no-seed");
		return 2;
	}

	const validationStatus = validateDriftGateFlags({
		modeFlag,
		outFlag,
		baselineFlag,
		suppressFlag,
		repoRootFlag,
	});
	if (validationStatus !== undefined) return validationStatus;

	const options: DriftGateOptions = {};
	if (jsonFlag) options.json = true;
	if (seedBaselineFlag) options.seedBaseline = true;
	if (noSeedFlag) options.seedBaseline = false;
	if (isDriftGateMode(modeFlag.value)) options.mode = modeFlag.value;
	if (outFlag.value) options.outPath = outFlag.value;
	if (baselineFlag.value) options.baselinePath = baselineFlag.value;
	if (suppressFlag.value)
		options.suppressions = parseCsvList(suppressFlag.value);
	if (repoRootFlag.value) options.repoRoot = repoRootFlag.value;

	return runDriftGateCLI(options);
}

function isDriftGateMode(
	value: string | undefined,
): value is "advisory" | "health" {
	return value === "advisory" || value === "health";
}

function validateDriftGateFlags(flags: {
	modeFlag: ReturnType<typeof inspectFlagValue>;
	outFlag: ReturnType<typeof inspectFlagValue>;
	baselineFlag: ReturnType<typeof inspectFlagValue>;
	suppressFlag: ReturnType<typeof inspectFlagValue>;
	repoRootFlag: ReturnType<typeof inspectFlagValue>;
}): number | undefined {
	if (flags.modeFlag.missingValue) {
		console.error("Error: --mode requires advisory or health");
		return 2;
	}
	if (flags.outFlag.missingValue) {
		console.error("Error: --out requires a file path");
		return 2;
	}
	if (flags.baselineFlag.missingValue) {
		console.error("Error: --baseline requires a file path");
		return 2;
	}
	if (flags.suppressFlag.missingValue) {
		console.error("Error: --suppress requires a comma-separated list");
		return 2;
	}
	if (flags.repoRootFlag.missingValue) {
		console.error("Error: --repo-root requires a path");
		return 2;
	}
	if (
		flags.modeFlag.value &&
		flags.modeFlag.value !== "advisory" &&
		flags.modeFlag.value !== "health"
	) {
		console.error("Error: --mode must be advisory or health");
		return 2;
	}
	return undefined;
}
