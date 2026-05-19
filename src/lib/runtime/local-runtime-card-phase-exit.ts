import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import {
	type HePhaseExit,
	validateHePhaseExit,
} from "../decision/he-phase-exit.js";
import { sanitizeError } from "../input/sanitize.js";
import type {
	RuntimeCardPhaseExitState,
	RuntimeCardSource,
} from "./runtime-card.js";

/** Collapsed phase-exit evidence for runtime-card generation. */
export interface RuntimeCardPhaseExitSnapshot {
	/** Runtime-card phase-exit state derived from supplied evidence. */
	phaseExit: RuntimeCardPhaseExitState;
	/** Source record for the phase-exit evidence, when evidence was supplied or required. */
	source?: RuntimeCardSource;
	/** Phase-exit blockers that should prevent continuation. */
	blockers: string[];
}

function resolveArtifactPath(repoRoot: string, artifactPath: string): string {
	return isAbsolute(artifactPath) ? artifactPath : join(repoRoot, artifactPath);
}

function invalidPhaseExitSnapshot(
	phaseExitPath: string,
	reason: string,
	blocker: string,
): RuntimeCardPhaseExitSnapshot {
	return {
		phaseExit: { status: "blocked", reason },
		source: {
			kind: "phase_exit",
			ref: `artifact:${phaseExitPath}`,
			freshness: "unknown",
			status: "invalid",
			failureClass: "phase_exit_artifact_invalid",
		},
		blockers: [blocker],
	};
}

/** Collapse a valid HePhaseExit/v1 artifact into runtime-card phase-exit state. */
export function collapsePhaseExit(
	result: HePhaseExit,
): RuntimeCardPhaseExitState {
	if (result.recommendation !== "continue") {
		return {
			status: result.blockers.length > 0 ? "blocked" : "fail",
			reason:
				result.blockers[0] ??
				"HE phase-exit recommendation blocks continuation.",
		};
	}
	if (!result.commitAllowed || !result.exitAllowed) {
		return {
			status: "blocked",
			reason: "HE phase-exit commit or exit readiness is false.",
		};
	}
	return {
		status: "pass",
		reason: result.warnings[0] ?? "Required phase-exit gates passed.",
	};
}

/** Inspect optional HePhaseExit/v1 evidence and collapse it for runtime-card generation. */
export function inspectRuntimeCardPhaseExit(
	repoRoot: string,
	phaseExitPath: string | undefined,
	requirePhaseExit = false,
): RuntimeCardPhaseExitSnapshot {
	if (!phaseExitPath) {
		const phaseExit: RuntimeCardPhaseExitState = {
			status: "not_run",
			reason: "No phase-exit artifact was supplied.",
		};
		if (requirePhaseExit) {
			return {
				phaseExit,
				source: {
					kind: "phase_exit",
					ref: "input:phase-exit",
					freshness: "missing",
					status: "empty",
					failureClass: "phase_exit_missing",
				},
				blockers: [
					"Phase-exit artifact is required for this runtime-card context.",
				],
			};
		}
		return {
			phaseExit,
			blockers: [],
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(
			readFileSync(resolveArtifactPath(repoRoot, phaseExitPath), "utf8"),
		);
	} catch (error) {
		return invalidPhaseExitSnapshot(
			phaseExitPath,
			"Phase-exit artifact could not be read or parsed: " +
				sanitizeError(error),
			"Phase-exit artifact could not be read or parsed.",
		);
	}

	const validation = validateHePhaseExit(parsed);
	if (!validation.valid) {
		return invalidPhaseExitSnapshot(
			phaseExitPath,
			"Phase-exit artifact is not valid HePhaseExit/v1.",
			"Phase-exit artifact is not valid HePhaseExit/v1.",
		);
	}

	const phaseExit = collapsePhaseExit(parsed as HePhaseExit);
	return {
		phaseExit,
		source: {
			kind: "phase_exit",
			ref: `artifact:${phaseExitPath}`,
			freshness: "current",
			status: phaseExit.status === "pass" ? "usable" : "blocked",
			failureClass: phaseExit.status === "pass" ? null : "phase_exit_blocks",
		},
		blockers:
			phaseExit.status === "pass"
				? []
				: [phaseExit.reason ?? "Phase-exit evidence blocks continuation."],
	};
}
