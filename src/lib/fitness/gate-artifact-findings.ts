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
	malformedArtifactFinding,
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
	decorateFinding?: (
		finding: FitnessFinding,
		record: Record<string, unknown>,
	) => FitnessFinding;
}

function readJsonFile(path: string): unknown {
	try {
		const content = readFileSync(path, "utf8");
		return JSON.parse(content);
	} catch (error) {
		return {
			malformed: true,
			error: error instanceof Error ? error.message : String(error),
		};
	}
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
		if (
			typeof candidate === "number" &&
			Number.isInteger(candidate) &&
			candidate > 0
		) {
			return candidate;
		}
	}
	return undefined;
}

/** Normalize a structured local gate artifact into fitness findings. */
export function gateArtifactFindings(
	options: GateArtifactFindingOptions,
): FitnessFinding[] {
	let report: unknown;
	try {
		report = readJsonFile(options.path);
	} catch (error) {
		return [
			malformedArtifactFinding({
				path: options.path,
				lane: options.lane,
				command: options.command,
				principle: options.principle,
				enforcement: options.enforcement,
				message:
					error instanceof Error
						? `Failed to read or parse JSON artifact: ${error.message}`
						: "Failed to read or parse JSON artifact.",
			}),
		];
	}
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
	if (status === undefined) {
		return [
			malformedArtifactFinding({
				path: options.path,
				lane: options.lane,
				command: options.command,
				principle: options.principle,
				enforcement: options.enforcement,
				message: "Expected artifact status to be pass, warn, or fail.",
			}),
		];
	}
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
	return records.map((record, index) =>
		normalizeGateRecord(options, record, index),
	);
}

function normalizeGateRecord(
	options: GateArtifactFindingOptions,
	record: Record<string, unknown>,
	index: number,
): FitnessFinding {
	const file = firstString(record, options.fileFields ?? []);
	const line = firstNumber(record, options.lineFields ?? []);
	const finding: FitnessFinding = {
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
	return options.decorateFinding?.(finding, record) ?? finding;
}
