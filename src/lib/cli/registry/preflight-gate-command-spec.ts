import { readFileSync } from "node:fs";
import { runPreflightGateCLI } from "../../../commands/preflight-gate.js";
import { inspectFlagValue, parseCsvList } from "../parse-utils.js";
import type { CommandSpec } from "./types.js";

type PreflightGateOptions = Parameters<typeof runPreflightGateCLI>[0];
type PreflightAdmission = NonNullable<PreflightGateOptions["admission"]>;

/** Build the preflight-gate registry seam. */
export function createPreflightGateCommandSpec(): CommandSpec {
	return {
		name: "preflight-gate",
		summary: "Fast policy checks before expensive operations",
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
	const scalarStatus = applyPreflightGateScalarOptions(options, args);
	if (scalarStatus !== undefined) return scalarStatus;
	if (admissionFileInspection.value === undefined)
		return runPreflightGateCLI(options);
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
): number | undefined {
	if (args.includes("--json")) options.json = true;
	if (args.includes("--strict")) options.strict = true;
	const contract = readPreflightScalar(args, "--contract");
	const files = readPreflightScalar(args, "--files");
	const maxTier = readPreflightScalar(args, "--max-tier");
	const skip = readPreflightScalar(args, "--skip");
	const headSha = readPreflightScalar(args, "--head-sha");
	if (contract === null || files === null || maxTier === null) return 2;
	if (skip === null || headSha === null) return 2;
	if (contract !== undefined) options.contractPath = contract;
	if (files !== undefined) options.files = parseCsvList(files);
	if (maxTier === "high" || maxTier === "medium" || maxTier === "low") {
		options.maxTier = maxTier;
	} else if (maxTier !== undefined) {
		console.error("Error: --max-tier must be one of high, medium, low");
		return 2;
	}
	if (skip !== undefined) options.skip = parseCsvList(skip);
	if (headSha) options.headSha = headSha;
	return undefined;
}

function readPreflightScalar(
	args: string[],
	flag: string,
): string | undefined | null {
	const inspection = inspectFlagValue(args, flag);
	if (!inspection.missingValue) return inspection.value;
	console.error(`Error: ${flag} requires a value`);
	return null;
}

function applyPreflightGateAdmission(
	options: PreflightGateOptions,
	admissionFileArg: string,
): number | undefined {
	try {
		const parsedAdmission = JSON.parse(
			readFileSync(admissionFileArg, "utf-8"),
		) as unknown;
		if (!isAdmissionObject(parsedAdmission)) {
			console.error("Error: --admission-file must contain a JSON object");
			return 2;
		}
		options.admission = parsedAdmission as PreflightAdmission;
		return undefined;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`Error: failed to parse --admission-file '${admissionFileArg}': ${message}`,
		);
		return 2;
	}
}

const isAdmissionObject = (value: unknown): value is PreflightAdmission =>
	value !== null && typeof value === "object" && !Array.isArray(value);
