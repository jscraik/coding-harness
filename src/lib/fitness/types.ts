/** Public API export. */
export type FitnessStatus = "pass" | "warn" | "fail" | "needs_evidence";

/** Public API export. */
export type FitnessLaneStatus = "pass" | "warn" | "fail" | "not_run";

/** Public API export. */
export type FitnessSeverity = "critical" | "error" | "warning" | "info";

/** Public API export. */
export type FitnessEnforcement =
	| "hard_blocker"
	| "architecture_fitness"
	| "quality_budget"
	| "advisory";

/** Public API export. */
export type FitnessPrinciple =
	| "protect_deep_module_boundaries"
	| "reduce_cognitive_load"
	| "prove_behavior_outcomes"
	| "compound_feedback_to_harness";

/** Public API export. */
export interface FitnessEvidence {
	file?: string;
	line?: number;
	message: string;
}

/** Public API export. */
export interface FitnessFinding {
	id: string;
	title: string;
	severity: FitnessSeverity;
	lane: string;
	principle: FitnessPrinciple;
	enforcement: FitnessEnforcement;
	evidence: FitnessEvidence;
	risk: string;
	recommendedCommand: string;
	claimBoundary: string;
}

/** Public API export. */
export interface FitnessLane {
	id: string;
	label: string;
	command: string;
	principle: FitnessPrinciple;
	enforcement: FitnessEnforcement;
	status: FitnessLaneStatus;
	evidenceSource: string;
	findings: FitnessFinding[];
}

/** Public API export. */
export interface FitnessReport {
	schemaVersion: "harness-fitness/v1";
	status: FitnessStatus;
	generatedAt: string;
	summary: {
		lanes: number;
		findings: number;
		failures: number;
		warnings: number;
		lanesNeedingEvidence: number;
	};
	lanes: FitnessLane[];
	topDeterministicFinding: FitnessFinding | null;
	claimBoundaries: string[];
}
