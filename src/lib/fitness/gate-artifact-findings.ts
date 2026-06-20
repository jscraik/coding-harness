import { readFileSync } from "node:fs";
import type {
	FitnessEnforcement,
	FitnessFinding,
	FitnessPrinciple,
	FitnessSeverity,
} from "./types.js";
import {
	artifactStatus,
	emptyDetailsFinding,
	requiredRecordArray,
} from "./artifact-evidence.js";

interface GateArtifactFindingOptions {
	path: string;
	detailsField: string;
	lane: string;
	command: string;
	principle: FitnessPrinciple;
	enforcement: FitnessEnforcement;
	idPrefix: string;
	title: string;
	severity: FitnessSeverity;
	risk: string;
	claimBoundary: string;
	messageFields: readonly string[];
	fileFields?: readonly string[];
	lineFields?: readonly string[];
}

function readJsonFile(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8"));
}

/** Return the first non-empty string field from an artifact object. */
export function firstString(
	value: Record<string, unknown>,
	fields: readonly string[],
): string | undefined {
	for (const field of fields) {
		const candidate = value[field];
		if (typeof candidate === "string" && candidate.trim().length > 0) {
			return candidate;
		}
	}
	return undefined;
}

function firstNumber(
	value: Record<string, unknown>,
	fields: readonly string[],
): number | undefined {
	for (const field of fields) {
		const candidate = value[field];
		if (typeof candidate === "number" && Number.isFinite(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

/** Normalize a structured local gate artifact into fitness findings. */
export function gateArtifactFindings(
	options: GateArtifactFindingOptions,
): FitnessFinding[] {
	const report = readJsonFile(options.path);
	const result = requiredRecordArray(
		report,
		options.detailsField,
		options.path,
		options.lane,
		options.command,
		options.principle,
		options.enforcement,
	);
	if ("malformed" in result) return result.malformed;
	const records = result.records;
	const status = artifactStatus(report);
	if ((status === "fail" || status === "warn") && records.length === 0) {
		return [
			emptyDetailsFinding({
				path: options.path,
				lane: options.lane,
				command: options.command,
				principle: options.principle,
				enforcement: options.enforcement,
				status,
			}),
		];
	}
	return records.map((record, index) => {
		const file = firstString(record, options.fileFields ?? []);
		const line = firstNumber(record, options.lineFields ?? []);
		return {
			id: `${options.idPrefix}:${file ?? firstString(record, ["name", "test"]) ?? index}`,
			title: options.title,
			severity: options.severity,
			lane: options.lane,
			principle: options.principle,
			enforcement: options.enforcement,
			evidence: {
				...(file ? { file } : {}),
				...(line !== undefined ? { line } : {}),
				message:
					firstString(record, options.messageFields) ??
					"Gate artifact reported a finding.",
			},
			risk: options.risk,
			recommendedCommand: options.command,
			claimBoundary: options.claimBoundary,
		};
	});
}
