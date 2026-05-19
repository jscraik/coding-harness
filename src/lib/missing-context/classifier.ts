import { Effect } from "effect";

/** Stable system-gap classes for evidence that cannot prove a closeout claim. */
export type MissingContextClass =
	| "missing_repo_instruction"
	| "stale_docs_or_command_reference"
	| "missing_verifier"
	| "missing_recovery_handler"
	| "missing_fixture"
	| "missing_permission_or_auth_explanation"
	| "hidden_provider_behavior"
	| "unmodeled_current_state_dependency"
	| "ambiguous_ownership_boundary";

/** Durable destination that should receive the classified system gap. */
export type MissingContextDestination =
	| "validator"
	| "fixture_eval"
	| "project_brain_learning"
	| "roadmap_exception"
	| "cold_research_reference";

/** Evidence problem observed while trying to prove a required claim. */
export type MissingContextEvidenceProblem =
	| "missing"
	| "stale"
	| "unknown"
	| "blocked";

/** Typed missing-context result attached to unproven closeout evidence. */
export interface MissingContextClassification {
	class: MissingContextClass;
	destination: MissingContextDestination;
	reason: string;
}

/** Input used to classify one missing, stale, unknown, or blocked evidence gap. */
export interface MissingContextInput {
	surface:
		| "pr"
		| "branch"
		| "checks"
		| "review"
		| "linear"
		| "harness_gates"
		| "tool"
		| "fixture"
		| "permission";
	problem: MissingContextEvidenceProblem;
	claim?: string | null;
}

const CLASS_DESTINATIONS: Record<
	MissingContextClass,
	MissingContextDestination
> = {
	missing_repo_instruction: "project_brain_learning",
	stale_docs_or_command_reference: "cold_research_reference",
	missing_verifier: "validator",
	missing_recovery_handler: "roadmap_exception",
	missing_fixture: "fixture_eval",
	missing_permission_or_auth_explanation: "project_brain_learning",
	hidden_provider_behavior: "cold_research_reference",
	unmodeled_current_state_dependency: "validator",
	ambiguous_ownership_boundary: "project_brain_learning",
};

function classification(
	className: MissingContextClass,
	reason: string,
): MissingContextClassification {
	return {
		class: className,
		destination: CLASS_DESTINATIONS[className],
		reason,
	};
}

function classifyMissingContextValue(
	input: MissingContextInput,
): MissingContextClassification {
	if (input.problem === "stale") {
		return classification(
			input.surface === "checks"
				? "unmodeled_current_state_dependency"
				: "stale_docs_or_command_reference",
			`${input.surface} evidence is stale for ${input.claim ?? "the current verifier"}.`,
		);
	}
	if (input.surface === "fixture") {
		return classification(
			"missing_fixture",
			`No fixture proves ${input.claim ?? "this missing evidence path"}.`,
		);
	}
	if (input.surface === "permission" || input.surface === "tool") {
		return classification(
			"missing_permission_or_auth_explanation",
			`${input.surface} evidence lacks an actionable permission or auth explanation.`,
		);
	}
	if (input.surface === "linear") {
		return classification(
			"ambiguous_ownership_boundary",
			"Tracker alignment is unproven because the owning system boundary is not evidenced.",
		);
	}
	if (input.surface === "harness_gates") {
		return classification(
			"missing_recovery_handler",
			"Harness closeout evidence is missing a recovery or explicit not-applicable path.",
		);
	}
	if (input.surface === "pr" || input.surface === "review") {
		return classification(
			"hidden_provider_behavior",
			`${input.surface} provider state was not observed through current verifier evidence.`,
		);
	}
	if (input.surface === "branch") {
		return classification(
			"unmodeled_current_state_dependency",
			"Branch currency depends on current state that was not modeled by verifier evidence.",
		);
	}
	if (input.problem === "blocked") {
		return classification(
			"missing_repo_instruction",
			`Repo instructions do not explain how to unblock ${input.claim ?? input.surface}.`,
		);
	}
	return classification(
		"missing_verifier",
		`${input.surface} evidence is absent or unknown for ${input.claim ?? "closeout"}.`,
	);
}

/** Route one unproven evidence gap to a durable missing-context destination as an Effect boundary. */
export function classifyMissingContextEffect(
	input: MissingContextInput,
): Effect.Effect<MissingContextClassification> {
	return Effect.succeed(classifyMissingContextValue(input));
}

/** Route one unproven evidence gap to a durable missing-context destination. */
export function classifyMissingContext(
	input: MissingContextInput,
): MissingContextClassification {
	return Effect.runSync(classifyMissingContextEffect(input));
}
