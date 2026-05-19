import { readFileSync } from "node:fs";
import { runPreflightGateCLI } from "../../../commands/preflight-gate.js";
import {
	getFlagValue,
	inspectFlagValue,
	parseCsvList,
} from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type PreflightGateOptions = Parameters<typeof runPreflightGateCLI>[0];

/** Build the preflight-gate registry seam. */
export function createPreflightGateCommandSpec(): CommandSpec {
	return {
		name: "preflight-gate",
		summary: "Fast policy checks before expensive operations",
		example: "preflight-gate --files src/auth.ts --json",
		errorLabel: "Preflight Gate Error",
		execute: runPreflightGateCommand,
	};
}

function runPreflightGateCommand(args: string[]): number | Promise<number> {
	const admissionFileInspection = inspectFlagValue(args, "--admission-file");
	if (admissionFileInspection.present && admissionFileInspection.missingValue) {
		console.error("Error: --admission-file requires a value");
		return 2;
	}

	const options: PreflightGateOptions = {};
	applyPreflightGateScalarOptions(options, args);
	const admissionStatus = applyPreflightGateAdmission(
		options,
		admissionFileInspection.value,
	);
	if (admissionStatus !== undefined) return admissionStatus;
	return runPreflightGateCLI(options);
}

function applyPreflightGateScalarOptions(
	options: PreflightGateOptions,
	args: string[],
): void {
	if (args.includes("--json")) options.json = true;
	if (args.includes("--strict")) options.strict = true;

	const contractArg = getFlagValue(args, args.indexOf("--contract"));
	if (contractArg !== undefined) options.contractPath = contractArg;
	const filesArg = getFlagValue(args, args.indexOf("--files"));
	if (filesArg !== undefined) options.files = parseCsvList(filesArg);
	const maxTierArg = getFlagValue(args, args.indexOf("--max-tier"));
	if (
		maxTierArg === "high" ||
		maxTierArg === "medium" ||
		maxTierArg === "low"
	) {
		options.maxTier = maxTierArg;
	}
	const skipArg = getFlagValue(args, args.indexOf("--skip"));
	if (skipArg !== undefined) options.skip = parseCsvList(skipArg);
	const headShaArg = getFlagValue(args, args.indexOf("--head-sha"));
	if (headShaArg) options.headSha = headShaArg;
}

function applyPreflightGateAdmission(
	options: PreflightGateOptions,
	admissionFileArg: string | undefined,
): number | undefined {
	if (admissionFileArg === undefined) return undefined;
	try {
		const parsedAdmission = JSON.parse(
			readFileSync(admissionFileArg, "utf-8"),
		) as unknown;
		if (
			parsedAdmission === null ||
			typeof parsedAdmission !== "object" ||
			Array.isArray(parsedAdmission)
		) {
			console.error("Error: --admission-file must contain a JSON object");
			return 2;
		}
		options.admission = parsedAdmission as NonNullable<
			PreflightGateOptions["admission"]
		>;
		return undefined;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`Error: failed to parse --admission-file '${admissionFileArg}': ${message}`,
		);
		return 2;
	}
}
