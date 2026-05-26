import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { readRepoRuntimeArtifactText } from "../lib/runtime/repo-runtime-artifact.js";
import {
	type RuntimeCard,
	validateRuntimeCard,
} from "../lib/runtime/runtime-card.js";
import { blockedDecision, type HarnessNextMode } from "./next-decisions.js";
import { humanRequiredDecisionMeta } from "./next-support.js";

/** Load and validate a runtime-card/v1 artifact for the harness next CLI. */
export function loadRuntimeCardArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
): { runtimeCard: RuntimeCard } | { decision: HarnessDecision } {
	let rawArtifact: string;
	let parsed: unknown;
	try {
		rawArtifact = readRepoRuntimeArtifactText(
			repoRoot,
			artifactPath,
			"--runtime-card",
		);
	} catch (error) {
		return {
			decision: blockedDecision({
				summary: `Runtime card artifact could not be read: ${artifactPath}.`,
				nextAction:
					"Provide a readable runtime-card/v1 JSON artifact or omit --runtime-card.",
				failureClass: "runtime_card_artifact_unreadable",
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
				summary: `Runtime card artifact is not valid JSON: ${artifactPath}.`,
				nextAction:
					"Provide a parseable runtime-card/v1 JSON artifact or omit --runtime-card.",
				failureClass: "runtime_card_artifact_invalid",
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

	const validation = validateRuntimeCard(parsed);
	if (!validation.valid) {
		return {
			decision: blockedDecision({
				summary:
					"Runtime card artifact is not valid runtime-card/v1: " +
					artifactPath +
					".",
				nextAction:
					"Regenerate the runtime card with valid current-state evidence, then rerun harness next --json.",
				failureClass: "runtime_card_artifact_invalid",
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

	return { runtimeCard: parsed as RuntimeCard };
}
