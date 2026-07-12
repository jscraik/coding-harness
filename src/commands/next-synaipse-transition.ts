import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { readRepoRuntimeJsonArtifact } from "../lib/runtime/repo-runtime-artifact.js";
import type { HarnessNextMode } from "./next-decisions.js";
import { synaipseTransitionBlockedDecision } from "./next-decisions.js";

function transitionArtifactDecision(args: {
	artifactPath: string;
	mode: HarnessNextMode;
	message: string;
	error?: unknown;
}): HarnessDecision {
	const suffix =
		args.error === undefined ? "" : ` ${sanitizeError(args.error)}`;
	return synaipseTransitionBlockedDecision({
		mode: args.mode,
		vitalDecision: false,
		validationErrors: [
			{
				path: "artifact",
				message: `${args.message} ${args.artifactPath}.${suffix}`.trim(),
			},
		],
	});
}

/** Load a repository-contained SynAIpse transition packet for `harness next`. */
export function loadSynaipseTransitionArtifact(
	repoRoot: string,
	artifactPath: string,
	mode: HarnessNextMode,
): { synaipseTransition: unknown } | { decision: HarnessDecision } {
	try {
		return {
			synaipseTransition: readRepoRuntimeJsonArtifact(
				repoRoot,
				artifactPath,
				"--synaipse-transition",
			),
		};
	} catch (error) {
		return {
			decision: transitionArtifactDecision({
				artifactPath,
				mode,
				message: "SynAIpse transition artifact could not be read or parsed:",
				error,
			}),
		};
	}
}
