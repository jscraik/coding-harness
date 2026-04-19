/**
 * Required metadata gate for issue execution starts (JSC-193).
 *
 * Prevents execution-start drift by enforcing minimum metadata quality
 * when an issue moves into `Todo` or `In Progress`.
 *
 * Provides:
 * - Base field validation (priority, roadmap label, assignee, project link)
 * - Problem statement validation
 * - Acceptance criteria validation
 * - Transition-state-specific validation (Todo vs In Progress)
 * - Agent-safe fallback behavior (comment + bounce to Triage)
 */

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

export const BASE_REQUIRED_FIELDS = [
	"priority",
	"roadmapLabel",
	"assignee",
	"projectLink",
] as const;

export type BaseRequiredField = (typeof BASE_REQUIRED_FIELDS)[number];

export const EXECUTION_GATE_FIELDS = [
	"priority",
	"roadmapLabel",
	"assignee",
	"projectLink",
	"problemStatement",
	"acceptanceCriteria",
] as const;

export type ExecutionGateField = (typeof EXECUTION_GATE_FIELDS)[number];

export interface ExecutionGateMetadata {
	priority: number | null;
	roadmapLabel: string | null;
	assignee: string | null;
	projectLink: string | null;
	title: string;
	description: string | null;
	labels: string[];
}

export interface ExecutionGateResult {
	/** Whether the issue can proceed to the target state. */
	pass: boolean;
	/** Target state that was validated. */
	targetState: "todo" | "in_progress";
	/** Fields that passed validation. */
	passedFields: ExecutionGateField[];
	/** Fields that failed validation. */
	failedFields: Array<{ field: ExecutionGateField; message: string }>;
	/** Overall completeness 0-1. */
	completeness: number;
	/** Recommended action when gate fails. */
	fallback: ExecutionGateFallback;
}

export interface ExecutionGateFallback {
	action: "block" | "warn" | "allow";
	reason: string;
	/** Target state to bounce to if blocked. */
	bounceTarget: "triage" | "todo";
	/** Comment body for agent-safe fallback. */
	commentBody: string;
}

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

const PROBLEM_STATEMENT_PATTERNS = [
	/\b(?:problem|goal|objective|purpose|scope)\b.*:/i,
	/##\s*(?:problem|goal|objective|purpose|scope)/i,
	/\b(?:why|context|background)\b.*:/i,
];

const ACCEPTANCE_CRITERIA_PATTERNS = [
	/\bacceptance\s*(?:criteria|standard)\b/i,
	/##\s*(?:acceptance|criteria|success)/i,
	/\b(?:done|complete|finished)\s+(?:when|if)\b/i,
	/\b(?:must|should|shall)\s+(?:pass|succeed|complete)\b/i,
];

function hasPatternMatch(
	text: string | null | undefined,
	patterns: RegExp[],
): boolean {
	if (!text) return false;
	return patterns.some((pattern) => pattern.test(text));
}

// ---------------------------------------------------------------------------
// Base field validation
// ---------------------------------------------------------------------------

export interface BaseValidationResult {
	valid: boolean;
	missingFields: BaseRequiredField[];
	reasons: Array<{ field: BaseRequiredField; message: string }>;
}

/**
 * Validate the four base required fields for any state transition.
 */
export function validateBaseFields(
	metadata: ExecutionGateMetadata,
): BaseValidationResult {
	const missing: BaseRequiredField[] = [];
	const reasons: Array<{ field: BaseRequiredField; message: string }> = [];

	if (metadata.priority === null || metadata.priority === undefined) {
		missing.push("priority");
		reasons.push({
			field: "priority",
			message: "Issue must have an assigned priority.",
		});
	}

	const hasRoadmapLabel = metadata.labels.some(
		(label) =>
			/roadmap/i.test(label) ||
			/lane[_\s]?(?:a|b|c|d|e|f)/i.test(label) ||
			/active[_\s]?stabilization/i.test(label) ||
			/adoption[_\s]?path/i.test(label) ||
			/architecture/i.test(label) ||
			/security/i.test(label) ||
			/docs/i.test(label),
	);
	if (!metadata.roadmapLabel && !hasRoadmapLabel) {
		missing.push("roadmapLabel");
		reasons.push({
			field: "roadmapLabel",
			message:
				"Issue must have a roadmap lane label (e.g. 'Roadmap: Now', 'Roadmap: Next', or a lane label).",
		});
	}

	if (!metadata.assignee) {
		missing.push("assignee");
		reasons.push({
			field: "assignee",
			message: "Issue must have an assignee or delegate.",
		});
	}

	if (!metadata.projectLink) {
		missing.push("projectLink");
		reasons.push({
			field: "projectLink",
			message: "Issue must be linked to a project.",
		});
	}

	return { valid: missing.length === 0, missingFields: missing, reasons };
}

// ---------------------------------------------------------------------------
// Execution gate validation
// ---------------------------------------------------------------------------

/**
 * Validate metadata completeness for entering an execution state.
 *
 * For `Todo`: requires the 4 base fields + problem statement.
 * For `In Progress`: requires all 6 fields (base + problem statement + acceptance criteria).
 */
export function validateExecutionGate(options: {
	metadata: ExecutionGateMetadata;
	targetState: "todo" | "in_progress";
}): ExecutionGateResult {
	const { metadata, targetState } = options;

	const failedFields: Array<{ field: ExecutionGateField; message: string }> =
		[];
	const passedFields: ExecutionGateField[] = [];

	// Step 1: Validate base fields
	const baseValidation = validateBaseFields(metadata);

	for (const field of baseValidation.missingFields) {
		const reason = baseValidation.reasons.find((r) => r.field === field);
		failedFields.push({
			field: field as ExecutionGateField,
			message: reason?.message ?? `Missing required field: ${field}`,
		});
	}

	// Base fields that passed
	for (const field of BASE_REQUIRED_FIELDS) {
		if (!baseValidation.missingFields.includes(field)) {
			passedFields.push(field);
		}
	}

	// Step 2: Validate problem statement (required for both Todo and In Progress)
	if (!hasPatternMatch(metadata.description, PROBLEM_STATEMENT_PATTERNS)) {
		failedFields.push({
			field: "problemStatement",
			message:
				"Issue description must include a problem statement, goal, or scope section.",
		});
	} else {
		passedFields.push("problemStatement");
	}

	// Step 3: Validate acceptance criteria (required for In Progress only)
	if (targetState === "in_progress") {
		if (!hasPatternMatch(metadata.description, ACCEPTANCE_CRITERIA_PATTERNS)) {
			failedFields.push({
				field: "acceptanceCriteria",
				message:
					"Issue description must include acceptance criteria before entering In Progress.",
			});
		} else {
			passedFields.push("acceptanceCriteria");
		}
	} else {
		// Acceptance criteria is optional for Todo
		passedFields.push("acceptanceCriteria");
	}

	const totalRequired = targetState === "in_progress" ? 6 : 5;
	const completeness = passedFields.length / totalRequired;
	const pass = failedFields.length === 0;

	let fallback: ExecutionGateFallback;
	if (pass) {
		fallback = {
			action: "allow",
			reason: "All required metadata is present.",
			bounceTarget: "triage",
			commentBody: "",
		};
	} else if (baseValidation.missingFields.length > 0) {
		// Base fields missing → bounce to Triage
		fallback = {
			action: "block",
			reason: `Missing core metadata fields: ${baseValidation.missingFields.join(", ")}. Bouncing to Triage.`,
			bounceTarget: "triage",
			commentBody: buildGateFailComment(targetState, failedFields, "triage"),
		};
	} else if (targetState === "in_progress") {
		// Only execution-specific fields missing → bounce to Todo
		fallback = {
			action: "block",
			reason:
				"Missing acceptance criteria. Issue can stay in Todo but cannot enter In Progress.",
			bounceTarget: "todo",
			commentBody: buildGateFailComment(targetState, failedFields, "todo"),
		};
	} else {
		// Todo target with only problem statement missing → warn
		fallback = {
			action: "warn",
			reason: `Missing fields: ${failedFields.map((f) => f.field).join(", ")}. Proceeding with warning.`,
			bounceTarget: "triage",
			commentBody: buildGateFailComment(targetState, failedFields, "triage"),
		};
	}

	return {
		pass,
		targetState,
		passedFields,
		failedFields,
		completeness,
		fallback,
	};
}

// ---------------------------------------------------------------------------
// Comment generation
// ---------------------------------------------------------------------------

function buildGateFailComment(
	targetState: "todo" | "in_progress",
	failedFields: Array<{ field: ExecutionGateField; message: string }>,
	bounceTarget: "triage" | "todo",
): string {
	const lines = [
		`🚫 **Metadata gate: cannot enter ${targetState === "in_progress" ? "In Progress" : "Todo"}.**`,
		"",
		"The following required fields are missing or incomplete:",
	];

	for (const field of failedFields) {
		lines.push(`- **${field.field}**: ${field.message}`);
	}

	lines.push("");
	if (bounceTarget === "triage") {
		lines.push(
			"This issue is being bounced back to **Triage** until the missing fields are resolved.",
		);
	} else {
		lines.push(
			"This issue can remain in **Todo** but cannot enter **In Progress** until acceptance criteria are added.",
		);
	}
	lines.push("");
	lines.push(
		"_This comment was generated by the metadata gate enforcement (JSC-193)._",
	);

	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

export interface BatchGateResult {
	total: number;
	passed: number;
	blocked: number;
	warned: number;
	details: Array<{
		identifier: string;
		title: string;
		pass: boolean;
		action: "allow" | "block" | "warn";
		missingFields: ExecutionGateField[];
	}>;
}

/**
 * Validate a batch of issues for execution gate compliance.
 */
export function validateBatchExecutionGate(options: {
	issues: Array<{
		identifier: string;
		title: string;
		metadata: ExecutionGateMetadata;
	}>;
	targetState: "todo" | "in_progress";
}): BatchGateResult {
	let passed = 0;
	let blocked = 0;
	let warned = 0;
	const details: BatchGateResult["details"] = [];

	for (const issue of options.issues) {
		const result = validateExecutionGate({
			metadata: issue.metadata,
			targetState: options.targetState,
		});

		if (result.pass) {
			passed++;
		} else if (result.fallback.action === "warn") {
			warned++;
		} else {
			blocked++;
		}

		details.push({
			identifier: issue.identifier,
			title: issue.title,
			pass: result.pass,
			action: result.fallback.action,
			missingFields: result.failedFields.map((f) => f.field),
		});
	}

	return {
		total: options.issues.length,
		passed,
		blocked,
		warned,
		details,
	};
}
