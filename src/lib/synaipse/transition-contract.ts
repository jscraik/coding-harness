/** Versioned lifecycle transition schema identifier. */
export const SYNAIPSE_TRANSITION_SCHEMA_VERSION =
	"synaipse-transition/v1" as const;

/** Lifecycle stages accepted by the transition contract. */
export const STAGES = [
	"shape",
	"admit",
	"build",
	"prove",
	"review",
	"integrate",
	"improve",
] as const;

/** Lifecycle stage type derived from the contract vocabulary. */
export type Stage = (typeof STAGES)[number];

/** Blockers that can be carried by a recovery receipt. */
export const BLOCKERS = [
	"invalid_transition_contract",
	"stale_sha",
	"stage_transition_not_allowed",
	"vital_decision_required",
	"standing_authority_required",
	"waiver_expired",
	"invalid_transition_options",
	"authority_capability_missing",
	"recovery_reference_invalid",
	"waiver_scope_or_authority_invalid",
] as const;

/** Recovery blocker type derived from the contract vocabulary. */
export type Blocker = (typeof BLOCKERS)[number];

/** Input contract for one lifecycle transition decision. */
export interface SynaipseTransitionInput {
	schemaVersion: typeof SYNAIPSE_TRANSITION_SCHEMA_VERSION;
	transitionId: string;
	fromStage: Stage;
	toStage: Stage;
	repositorySha: string;
	evidence: {
		currentSha: string;
		refs: string[];
		observedAt: string;
		hostedMain: {
			remote: "https://github.com/jscraik/coding-harness.git";
			ref: "refs/heads/main";
			sha: string;
			observedAt: string;
		};
	};
	authority: {
		owner: "codex" | "operator";
		standing: boolean;
		capabilities: string[];
	};
	vitalDecision: { required: boolean; question: string | null };
	waiver: {
		id: string;
		issuer: "codex" | "operator";
		scope: string;
		reason: string;
		compensation: string;
		expiresAt: string;
		retirementCondition: string;
	} | null;
	recovery: {
		fromBlocker: Blocker;
		refreshedSha: string;
		evidenceRefs: string[];
	} | null;
	decidedAt: string;
}

/** Structured validation result for `synaipse-transition/v1`. */
export interface SynaipseTransitionValidationResult {
	valid: boolean;
	errors: Array<{ path: string; message: string }>;
}
