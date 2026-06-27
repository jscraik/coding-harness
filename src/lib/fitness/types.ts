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
	| "quality_structure"
	| "type_safety"
	| "static_analysis"
	| "advisory";

/** Public API export. */
export type FitnessPrinciple =
	| "protect_deep_module_boundaries"
	| "reduce_cognitive_load"
	| "prove_type_safety"
	| "preserve_static_contracts"
	| "prove_behavior_outcomes"
	| "compound_feedback_to_harness";

/** Public API export. */
export type FitnessTrendDirection =
	| "improved"
	| "regressed"
	| "unchanged"
	| "baseline_unavailable";

/** Public API export. */
export type FitnessTrendBaselineStatus = "loaded" | "unavailable";

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
	metrics?: Record<string, number>;
	risk: string;
	requiredFix?: {
		objective: string;
		constraints: string[];
	};
	acceptanceCriteria?: string[];
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
export interface FitnessCoverage {
	category: string;
	concern: string;
	laneIds: string[];
	commands: string[];
	coverage: string;
	claimBoundary: string;
}

/** Public API export. */
export interface FitnessTrendPoint {
	status: FitnessStatus;
	findings: number;
	failures: number;
	warnings: number;
	lanesNeedingEvidence: number;
	deterministicFindings: number;
	advisoryFindings: number;
}

/** Public API export. */
export interface FitnessTrendDelta {
	findings: number;
	failures: number;
	warnings: number;
	lanesNeedingEvidence: number;
	deterministicFindings: number;
	advisoryFindings: number;
}

/** Public API export. */
export interface FitnessTrendSnapshot {
	schemaVersion: "harness-fitness-trend-snapshot/v1";
	baselineRef: string | null;
	baselineStatus: FitnessTrendBaselineStatus;
	current: FitnessTrendPoint;
	previous: FitnessTrendPoint | null;
	delta: FitnessTrendDelta | null;
	direction: FitnessTrendDirection;
	claimBoundary: string;
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
	coverage?: FitnessCoverage[];
	topDeterministicFinding: FitnessFinding | null;
	trendSnapshot?: FitnessTrendSnapshot;
	claimBoundaries: string[];
}
