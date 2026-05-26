import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import { validateHePhaseExit } from "../lib/decision/he-phase-exit.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { readRepoRuntimeArtifactText } from "../lib/runtime/repo-runtime-artifact.js";
import { blockedDecision, type HarnessNextMode } from "./next-decisions.js";
import { humanRequiredDecisionMeta } from "./next-support.js";

/**
 * Load and validate a phase-exit artifact and produce either the parsed artifact or a blocking Harness decision.
 *
 * @param repoRoot - Repository root used to resolve `artifactPath` when `artifactPath` is not absolute
 * @param artifactPath - Path to the phase-exit JSON artifact (may be absolute or relative to `repoRoot`)
 * @param mode - CLI mode to include in human-facing decision metadata
 * @returns `{ phaseExit: HePhaseExit }` when the artifact was read, parsed as JSON, and validated as HePhaseExit/v1; otherwise `{ decision: HarnessDecision }` describing the blocking error
 */
export function loadPhaseExitArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
): { phaseExit: HePhaseExit } | { decision: HarnessDecision } {
	let rawArtifact: string;
	let parsed: unknown;
	try {
		rawArtifact = readRepoRuntimeArtifactText(
			repoRoot,
			artifactPath,
			"--phase-exit",
		);
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
						error: sanitizeError(error),
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
						error: sanitizeError(error),
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
