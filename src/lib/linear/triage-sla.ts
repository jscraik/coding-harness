/**
 * Triage Inbox SLA and deterministic routing policy (JSC-191).
 *
 * Provides:
 * - SLA thresholds for triage inbox decisions
 * - Required-field validation for exiting Triage
 * - Routing decision tree: Triage → Backlog | Todo | In Progress | Canceled | Duplicate
 * - SLA breach detection for stale triage items
 */

// ---------------------------------------------------------------------------
// SLA configuration
// ---------------------------------------------------------------------------

export interface TriageSlaConfig {
	/** Maximum business hours before a triage decision must be made. */
	decisionWindowHours: number;
	/** Warning threshold (hours) before breach triggers a soft alert. */
	warningWindowHours: number;
}

export const DEFAULT_TRIAGE_SLA: TriageSlaConfig = {
	decisionWindowHours: 48,
	warningWindowHours: 36,
};

// ---------------------------------------------------------------------------
// Required fields for exiting Triage
// ---------------------------------------------------------------------------

export const REQUIRED_TRIAGE_EXIT_FIELDS = [
	"priority",
	"roadmapLabel",
	"assignee",
	"projectLink",
] as const;

export type RequiredTriageExitField =
	(typeof REQUIRED_TRIAGE_EXIT_FIELDS)[number];

export interface TriageExitMetadata {
	priority: number | null;
	roadmapLabel: string | null;
	assignee: string | null;
	projectLink: string | null;
	title: string;
	description: string | null;
	labels: string[];
}

export interface TriageExitValidationResult {
	valid: boolean;
	missingFields: RequiredTriageExitField[];
	/** Human-readable reasons for each missing field. */
	reasons: Array<{ field: RequiredTriageExitField; message: string }>;
	/** Metadata completeness ratio 0-1 for all required fields. */
	completeness: number;
}

/**
 * Validate that an issue has all required metadata before it can exit Triage.
 */
export function validateTriageExitMetadata(
	metadata: TriageExitMetadata,
): TriageExitValidationResult {
	const missing: RequiredTriageExitField[] = [];
	const reasons: Array<{ field: RequiredTriageExitField; message: string }> = [];

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

	const totalFields = REQUIRED_TRIAGE_EXIT_FIELDS.length;
	const presentFields = totalFields - missing.length;

	return {
		valid: missing.length === 0,
		missingFields: missing,
		reasons,
		completeness: presentFields / totalFields,
	};
}

// ---------------------------------------------------------------------------
// Routing decision tree
// ---------------------------------------------------------------------------

export type TriageRouteTarget =
	| "backlog"
	| "todo"
	| "in_progress"
	| "canceled"
	| "duplicate";

export interface TriageRoutingInput {
	metadata: TriageExitMetadata;
	scoreBand: "pull_now" | "next_pull" | "triage_hold" | "backlog_or_rescope";
	hasUnresolvedDependencies: boolean;
	inProgressCapReached: boolean;
	isDuplicate: boolean;
	isOutOfScope: boolean;
}

export interface TriageRoutingResult {
	target: TriageRouteTarget;
	reason: string;
	/** Whether the routing decision is blocked by incomplete metadata. */
	blocked: boolean;
	/** If blocked, which fields need to be resolved. */
	blockedBy: RequiredTriageExitField[];
}

/**
 * Deterministic routing decision tree for issues in Triage.
 *
 * Priority order:
 * 1. If marked as duplicate → Canceled (duplicate)
 * 2. If out of scope → Canceled
 * 3. If metadata incomplete → bounce back to Triage with required fields
 * 4. If score band is `pull_now` and no blockers → In Progress
 * 5. If score band is `next_pull` → Todo (ready queue)
 * 6. If score band is `triage_hold` → Backlog
 * 7. If score band is `backlog_or_rescope` → Backlog with rescope recommendation
 */
export function routeTriageIssue(
	input: TriageRoutingInput,
): TriageRoutingResult {
	// Step 1: Duplicate detection
	if (input.isDuplicate) {
		return {
			target: "duplicate",
			reason: "Issue is a duplicate; route to Canceled with duplicate reference.",
			blocked: false,
			blockedBy: [],
		};
	}

	// Step 2: Out-of-scope
	if (input.isOutOfScope) {
		return {
			target: "canceled",
			reason:
				"Issue is out of scope; route to Canceled with scope rationale.",
			blocked: false,
			blockedBy: [],
		};
	}

	// Step 3: Metadata gate — all required fields must be present
	const validation = validateTriageExitMetadata(input.metadata);
	if (!validation.valid) {
		return {
			target: "backlog",
			reason: `Cannot exit Triage: missing ${validation.missingFields.join(", ")}. Issue bounces back to Triage.`,
			blocked: true,
			blockedBy: validation.missingFields,
		};
	}

	// Step 4: Pull Now → In Progress (if capacity allows)
	if (input.scoreBand === "pull_now") {
		if (input.inProgressCapReached) {
			return {
				target: "todo",
				reason:
					"Score is pull_now but In Progress cap reached. Route to Todo (ready queue).",
				blocked: false,
				blockedBy: [],
			};
		}
		if (input.hasUnresolvedDependencies) {
			return {
				target: "todo",
				reason:
					"Score is pull_now but has unresolved dependencies. Route to Todo (ready queue) until dependencies clear.",
				blocked: false,
				blockedBy: [],
			};
		}
		return {
			target: "in_progress",
			reason:
				"Score is pull_now with no blockers and capacity available. Route to In Progress.",
			blocked: false,
			blockedBy: [],
		};
	}

	// Step 5: Next Pull → Todo
	if (input.scoreBand === "next_pull") {
		return {
			target: "todo",
			reason:
				"Score is next_pull. Route to Todo (ready queue) for next promotion cycle.",
			blocked: false,
			blockedBy: [],
		};
	}

	// Step 6 & 7: Triage Hold or Backlog/Rescope → Backlog
	return {
		target: "backlog",
		reason:
			input.scoreBand === "triage_hold"
				? "Score is triage_hold. Route to Backlog for future reconsideration."
				: "Score is backlog_or_rescope. Route to Backlog; consider rescoping or closing.",
		blocked: false,
		blockedBy: [],
	};
}

// ---------------------------------------------------------------------------
// SLA breach detection
// ---------------------------------------------------------------------------

export interface TriageSlaStatus {
	/** Whether the issue is within the SLA window. */
	withinSla: boolean;
	/** Whether the issue is approaching the SLA deadline (in warning zone). */
	approaching: boolean;
	/** Whether the SLA has been breached. */
	breached: boolean;
	/** Hours since the issue entered Triage. */
	hoursInTriage: number;
	/** Hours remaining before SLA breach (negative if already breached). */
	hoursRemaining: number;
}

const MS_PER_HOUR = 3_600_000;

/**
 * Check SLA status for a triage item based on its creation time.
 */
export function checkTriageSla(options: {
	createdAt: string;
	now?: Date;
	config?: TriageSlaConfig;
}): TriageSlaStatus {
	const config = options.config ?? DEFAULT_TRIAGE_SLA;
	const now = options.now ?? new Date();
	const created = new Date(options.createdAt);

	const elapsedMs = now.getTime() - created.getTime();
	const hoursInTriage = elapsedMs / MS_PER_HOUR;
	const hoursRemaining = config.decisionWindowHours - hoursInTriage;

	const breached = hoursInTriage > config.decisionWindowHours;
	const approaching =
		!breached && hoursInTriage > config.warningWindowHours;

	return {
		withinSla: !breached,
		approaching,
		breached,
		hoursInTriage: Math.round(hoursInTriage * 100) / 100,
		hoursRemaining: Math.round(hoursRemaining * 100) / 100,
	};
}

// ---------------------------------------------------------------------------
// Agent-safe fallback behavior
// ---------------------------------------------------------------------------

/**
 * Build a fallback comment body for issues that cannot exit Triage
 * due to incomplete metadata.
 */
export function buildTriageBounceComment(
	validation: TriageExitValidationResult,
): string {
	const lines = [
		"⚠️ **Triage metadata gate: this issue cannot exit Triage.**",
		"",
		"The following required fields are missing:",
	];

	for (const reason of validation.reasons) {
		lines.push(`- **${reason.field}**: ${reason.message}`);
	}

	lines.push("");
	lines.push(
		"Please resolve the missing fields so this issue can be routed to the correct lane.",
	);
	lines.push(
		`Metadata completeness: ${(validation.completeness * 100).toFixed(0)}%`,
	);

	return lines.join("\n");
}
