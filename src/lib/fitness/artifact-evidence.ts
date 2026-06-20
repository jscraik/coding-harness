import type {
	FitnessEnforcement,
	FitnessFinding,
	FitnessPrinciple,
	FitnessSeverity,
} from "./types.js";

/** Runtime shape guard for JSON object evidence. */
export function isArtifactRecord(
	value: unknown,
): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Return the normalized pass/warn/fail status from gate artifact JSON. */
export function artifactStatus(
	value: unknown,
): "pass" | "warn" | "fail" | undefined {
	if (!isArtifactRecord(value)) return undefined;
	if (
		value.status === "pass" ||
		value.status === "warn" ||
		value.status === "fail"
	) {
		return value.status;
	}
	return undefined;
}

/** Build a deterministic fitness finding for malformed artifact evidence. */
export function malformedArtifactFinding(args: {
	path: string;
	lane: string;
	command: string;
	principle: FitnessPrinciple;
	enforcement: FitnessEnforcement;
	message: string;
	severity?: FitnessSeverity;
}): FitnessFinding {
	return {
		id: `${args.lane}:artifact:malformed`,
		title: "Fitness artifact is malformed",
		severity: args.severity ?? "error",
		lane: args.lane,
		principle: args.principle,
		enforcement: args.enforcement,
		evidence: {
			file: args.path,
			message: args.message,
		},
		risk: "Malformed gate evidence can hide real blockers and produce false-ready fitness reports.",
		recommendedCommand: args.command,
		claimBoundary:
			"Malformed artifact evidence only; regenerate the source gate before using this lane as proof.",
	};
}

/** Build a fitness finding for artifacts whose failing status lacks details. */
export function emptyDetailsFinding(args: {
	path: string;
	lane: string;
	command: string;
	principle: FitnessPrinciple;
	enforcement: FitnessEnforcement;
	status: "warn" | "fail";
}): FitnessFinding {
	return malformedArtifactFinding({
		...args,
		severity: args.status === "warn" ? "warning" : "error",
		message: `Artifact status is ${args.status} but the required details array is empty.`,
	});
}

/** Extract a required object array from a deterministic gate artifact. */
export function requiredRecordArray(
	report: unknown,
	field: string,
	path: string,
	lane: string,
	command: string,
	principle: FitnessPrinciple,
	enforcement: FitnessEnforcement,
): { records: Record<string, unknown>[] } | { malformed: FitnessFinding[] } {
	if (!isArtifactRecord(report)) {
		return {
			malformed: [
				malformedArtifactFinding({
					path,
					lane,
					command,
					principle,
					enforcement,
					message: "Expected artifact JSON to be an object.",
				}),
			],
		};
	}
	const value = report[field];
	if (!Array.isArray(value)) {
		return {
			malformed: [
				malformedArtifactFinding({
					path,
					lane,
					command,
					principle,
					enforcement,
					message: `Expected ${field}[] in artifact JSON.`,
				}),
			],
		};
	}
	if (!value.every(isArtifactRecord)) {
		return {
			malformed: [
				malformedArtifactFinding({
					path,
					lane,
					command,
					principle,
					enforcement,
					message: `Expected every ${field}[] entry to be an object.`,
				}),
			],
		};
	}
	return { records: value };
}
