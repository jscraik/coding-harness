import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { readRepoRuntimeArtifactText } from "../lib/runtime/repo-runtime-artifact.js";
import {
	type RuntimeCard,
	validateRuntimeCard,
} from "../lib/runtime/runtime-card.js";
import { blockedDecision, type HarnessNextMode } from "./next-decisions.js";
import { humanRequiredDecisionMeta } from "./next-support.js";

function runtimeCardDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	summary: string;
	nextAction: string;
	failureClass: string;
	frictionClass: "repo_state" | "validation_failure";
	extra: Record<string, unknown>;
}): HarnessDecision {
	return blockedDecision({
		summary: args.summary,
		nextAction: args.nextAction,
		failureClass: args.failureClass,
		evidenceRef: [`artifact:${args.artifactPath}`],
		meta: humanRequiredDecisionMeta({
			mode: args.mode,
			frictionClass: args.frictionClass,
			extra: {
				artifactPath: args.artifactPath,
				...args.extra,
			},
		}),
	});
}

function parseRuntimeCardArtifact(rawArtifact: string): unknown {
	return JSON.parse(rawArtifact);
}

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
			decision: runtimeCardDecision({
				artifactPath,
				mode,
				summary: `Runtime card artifact could not be read: ${artifactPath}.`,
				nextAction:
					"Provide a readable runtime-card/v1 JSON artifact or omit --runtime-card.",
				failureClass: "runtime_card_artifact_unreadable",
				frictionClass: "repo_state",
				extra: { error: sanitizeError(error) },
			}),
		};
	}

	try {
		parsed = parseRuntimeCardArtifact(rawArtifact);
	} catch (error) {
		return {
			decision: runtimeCardDecision({
				artifactPath,
				mode,
				summary: `Runtime card artifact is not valid JSON: ${artifactPath}.`,
				nextAction:
					"Provide a parseable runtime-card/v1 JSON artifact or omit --runtime-card.",
				failureClass: "runtime_card_artifact_invalid",
				frictionClass: "validation_failure",
				extra: { error: sanitizeError(error) },
			}),
		};
	}

	const validation = validateRuntimeCard(parsed);
	if (!validation.valid) {
		return {
			decision: runtimeCardDecision({
				artifactPath,
				mode,
				summary:
					"Runtime card artifact is not valid runtime-card/v1: " +
					artifactPath +
					".",
				nextAction:
					"Regenerate the runtime card with valid current-state evidence, then rerun harness next --json.",
				failureClass: "runtime_card_artifact_invalid",
				frictionClass: "validation_failure",
				extra: { errors: validation.errors },
			}),
		};
	}

	return { runtimeCard: parsed as RuntimeCard };
}
