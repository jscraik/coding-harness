import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import { validateHePhaseExit } from "../lib/decision/he-phase-exit.js";
import { blockedDecision, type HarnessNextMode } from "./next-decisions.js";
import { humanRequiredDecisionMeta } from "./next-support.js";

/** Load and validate a HePhaseExit artifact for the harness next CLI. */
export function loadPhaseExitArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
): { phaseExit: HePhaseExit } | { decision: HarnessDecision } {
	const resolvedPath = isAbsolute(artifactPath)
		? artifactPath
		: join(repoRoot, artifactPath);
	let rawArtifact: string;
	let parsed: unknown;
	try {
		rawArtifact = readFileSync(resolvedPath, "utf8");
	} catch (error) {
		return {
			decision: blockedDecision({
				summary: `HE phase-exit artifact could not be read: ${artifactPath}.`,
				nextAction:
					"Provide a readable HePhaseExit/v1 JSON artifact or omit --phase-exit.",
				failureClass: "he_phase_exit_artifact_unreadable",
				evidenceRef: [`artifact:${artifactPath}`],
				meta: humanRequiredDecisionMeta({
					mode,
					frictionClass: "repo_state",
					extra: {
						artifactPath,
						error:
							error instanceof Error ? error.message : "unknown read error",
					},
				}),
			}),
		};
	}

	try {
		parsed = JSON.parse(rawArtifact);
	} catch (error) {
		return {
			decision: blockedDecision({
				summary: `HE phase-exit artifact is not valid JSON: ${artifactPath}.`,
				nextAction:
					"Provide a parseable HePhaseExit/v1 JSON artifact or omit --phase-exit.",
				failureClass: "he_phase_exit_artifact_invalid",
				evidenceRef: [`artifact:${artifactPath}`],
				meta: humanRequiredDecisionMeta({
					mode,
					frictionClass: "validation_failure",
					extra: {
						artifactPath,
						error:
							error instanceof Error ? error.message : "unknown parse error",
					},
				}),
			}),
		};
	}

	const validation = validateHePhaseExit(parsed);
	if (!validation.valid) {
		return {
			decision: blockedDecision({
				summary: `HE phase-exit artifact is not valid HePhaseExit/v1: ${artifactPath}.`,
				nextAction:
					"Regenerate the HE phase-exit artifact with valid gate evidence, then rerun harness next --json.",
				failureClass: "he_phase_exit_artifact_invalid",
				evidenceRef: [`artifact:${artifactPath}`],
				meta: humanRequiredDecisionMeta({
					mode,
					frictionClass: "validation_failure",
					extra: {
						artifactPath,
						errors: validation.errors,
					},
				}),
			}),
		};
	}

	return { phaseExit: parsed as HePhaseExit };
}
