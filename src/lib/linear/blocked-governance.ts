/**
 * Blocked governance model and escalation SLA (JSC-196).
 *
 * Provides:
 * - Decision record: Blocked as label overlay (not first-class status)
 * - Escalation SLA for blocked duration and dependency owner response
 * - Required blocker metadata (dependency, owner, unblock condition, target date)
 * - Query/report for active blocked work and aging
 */

// ---------------------------------------------------------------------------
// Decision record
// ---------------------------------------------------------------------------

/**
 * Blocked is modeled as a LABEL overlay on active workflow states
 * (Ready, In Progress, In Review), NOT as a first-class status.
 *
 * Rationale:
 * - Preserves the canonical workflow state machine (S0–S5)
 * - Allows blocked issues to remain in their execution lane for continuity
 * - Enables label-based querying without disrupting state-based reporting
 * - Consistent with the existing transition table in docs/agents/13-linear-production-workflow.md
 */
export const BLOCKED_GOVERNANCE_DECISION =
	"Blocked is a label overlay, not a first-class status." as const;

// ---------------------------------------------------------------------------
// Escalation SLA
// ---------------------------------------------------------------------------

export interface BlockedEscalationSla {
	/** Hours before a blocked issue triggers a warning nudge. */
	warningHours: number;
	/** Hours before a blocked issue triggers critical escalation. */
	criticalHours: number;
	/** Hours before a blocked issue is auto-flagged for leadership review. */
	leadershipReviewHours: number;
}

export const DEFAULT_BLOCKED_ESCALATION_SLA: BlockedEscalationSla = {
	warningHours: 48,
	criticalHours: 96,
	leadershipReviewHours: 168, // 7 days
};

// ---------------------------------------------------------------------------
// Required blocker metadata
// ---------------------------------------------------------------------------

export const REQUIRED_BLOCKER_FIELDS = [
	"dependency",
	"owner",
	"unblockCondition",
	"targetDate",
] as const;

export type RequiredBlockerField = (typeof REQUIRED_BLOCKER_FIELDS)[number];

export interface BlockerMetadata {
	/** What is the dependency blocking this issue? */
	dependency: string | null;
	/** Who owns the dependency? */
	owner: string | null;
	/** What condition must be met to unblock? */
	unblockCondition: string | null;
	/** Target date for unblock. */
	targetDate: string | null;
}

export interface BlockerValidationResult {
	valid: boolean;
	missingFields: RequiredBlockerField[];
	reasons: Array<{ field: RequiredBlockerField; message: string }>;
	completeness: number;
}

// ---------------------------------------------------------------------------
// Metadata validation
// ---------------------------------------------------------------------------

const BLOCKER_FIELD_PATTERNS: Record<RequiredBlockerField, RegExp[]> = {
	dependency: [
		/\b(?:blocked\s+by|dependency|depends?\s+on)\s*[:=]\s*.+/i,
		/\b[A-Z][A-Z0-9]+-\d+\b/,
	],
	owner: [/\b(?:blocker?\s+owner|dependency\s+owner|owner)\s*[:=]\s*.+/i],
	unblockCondition: [
		/\b(?:unblock(?:\s+condition)?|resolution\s+criteria)\s*[:=]\s*.+/i,
	],
	targetDate: [
		/\b(?:target\s+date|unblock\s+date|expected\s+resolution)\s*[:=]\s*.+/i,
		/\b\d{4}-\d{2}-\d{2}\b/,
	],
};

/**
 * Validate that an issue with the Blocked label has complete blocker metadata.
 *
 * Checks both explicit fields and description patterns.
 */
export function validateBlockerMetadata(options: {
	metadata: BlockerMetadata;
	description?: string | null;
}): BlockerValidationResult {
	const missing: RequiredBlockerField[] = [];
	const reasons: Array<{ field: RequiredBlockerField; message: string }> = [];
	const description = options.metadata.dependency ?? options.description ?? "";

	for (const field of REQUIRED_BLOCKER_FIELDS) {
		const hasExplicitField =
			options.metadata[field] !== null &&
			options.metadata[field] !== undefined &&
			String(options.metadata[field]).trim().length > 0;

		const hasDescriptionPattern =
			description &&
			BLOCKER_FIELD_PATTERNS[field].some((p) => p.test(description));

		if (!hasExplicitField && !hasDescriptionPattern) {
			missing.push(field);
			const fieldDescriptions: Record<RequiredBlockerField, string> = {
				dependency:
					"Must specify what dependency is blocking this issue (e.g. 'Blocked by: JSC-123').",
				owner: "Must specify who owns the blocking dependency.",
				unblockCondition:
					"Must specify the condition for unblocking (e.g. 'Unblock condition: JSC-123 merged').",
				targetDate:
					"Must specify a target date for unblocking (e.g. 'Target date: 2026-04-20').",
			};
			reasons.push({
				field,
				message: fieldDescriptions[field],
			});
		}
	}

	const presentFields = REQUIRED_BLOCKER_FIELDS.length - missing.length;

	return {
		valid: missing.length === 0,
		missingFields: missing,
		reasons,
		completeness: presentFields / REQUIRED_BLOCKER_FIELDS.length,
	};
}

// ---------------------------------------------------------------------------
// Escalation classification
// ---------------------------------------------------------------------------

export type BlockedSeverity = "recent" | "warning" | "critical" | "leadership";

const MS_PER_HOUR = 3_600_000;

/**
 * Classify the severity of a blocked issue based on time blocked.
 */
export function classifyBlockedSeverity(options: {
	blockedAt: string;
	now?: Date;
	sla?: BlockedEscalationSla;
}): BlockedSeverity {
	const sla = options.sla ?? DEFAULT_BLOCKED_ESCALATION_SLA;
	const now = options.now ?? new Date();
	const blocked = new Date(options.blockedAt);
	const hoursBlocked = (now.getTime() - blocked.getTime()) / MS_PER_HOUR;

	if (hoursBlocked >= sla.leadershipReviewHours) return "leadership";
	if (hoursBlocked >= sla.criticalHours) return "critical";
	if (hoursBlocked >= sla.warningHours) return "warning";
	return "recent";
}

// ---------------------------------------------------------------------------
// Blocked issue report
// ---------------------------------------------------------------------------

export interface BlockedIssueView {
	identifier: string;
	title: string;
	url: string;
	stateName: string;
	blockedAt: string;
	metadata: BlockerMetadata;
	description?: string | null;
}

export interface BlockedIssueReport {
	generatedAt: string;
	summary: {
		totalBlocked: number;
		recentCount: number;
		warningCount: number;
		criticalCount: number;
		leadershipCount: number;
		incompleteMetadata: number;
	};
	issues: Array<{
		identifier: string;
		title: string;
		url: string;
		stateName: string;
		severity: BlockedSeverity;
		hoursBlocked: number;
		metadataValid: boolean;
		missingFields: RequiredBlockerField[];
		recommendedAction: string;
	}>;
}

/**
 * Generate a report of all blocked issues with severity and metadata checks.
 */
export function generateBlockedReport(options: {
	issues: BlockedIssueView[];
	now?: Date;
	sla?: BlockedEscalationSla;
}): BlockedIssueReport {
	const now = options.now ?? new Date();
	const sla = options.sla ?? DEFAULT_BLOCKED_ESCALATION_SLA;
	const issues: BlockedIssueReport["issues"] = [];
	let recentCount = 0;
	let warningCount = 0;
	let criticalCount = 0;
	let leadershipCount = 0;
	let incompleteMetadata = 0;

	for (const issue of options.issues) {
		const severity = classifyBlockedSeverity({
			blockedAt: issue.blockedAt,
			now,
			sla,
		});

		const metadataValidation = validateBlockerMetadata({
			metadata: issue.metadata,
			description: issue.description ?? null,
		});

		if (!metadataValidation.valid) incompleteMetadata++;

		const hoursBlocked =
			(now.getTime() - new Date(issue.blockedAt).getTime()) / MS_PER_HOUR;

		switch (severity) {
			case "recent":
				recentCount++;
				break;
			case "warning":
				warningCount++;
				break;
			case "critical":
				criticalCount++;
				break;
			case "leadership":
				leadershipCount++;
				break;
		}

		let recommendedAction: string;
		if (!metadataValidation.valid) {
			recommendedAction = `Complete blocker metadata: ${metadataValidation.missingFields.join(", ")}`;
		} else if (severity === "leadership") {
			recommendedAction = "Escalate to leadership for review and intervention.";
		} else if (severity === "critical") {
			recommendedAction =
				"Nudge dependency owner; consider parallel workaround.";
		} else if (severity === "warning") {
			recommendedAction =
				"Monitor; reach out to dependency owner if no update.";
		} else {
			recommendedAction = "No action needed; recently blocked.";
		}

		issues.push({
			identifier: issue.identifier,
			title: issue.title,
			url: issue.url,
			stateName: issue.stateName,
			severity,
			hoursBlocked: Math.round(hoursBlocked * 10) / 10,
			metadataValid: metadataValidation.valid,
			missingFields: metadataValidation.missingFields,
			recommendedAction,
		});
	}

	// Sort: leadership > critical > warning > recent
	const severityOrder: Record<BlockedSeverity, number> = {
		leadership: 0,
		critical: 1,
		warning: 2,
		recent: 3,
	};
	issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

	return {
		generatedAt: now.toISOString(),
		summary: {
			totalBlocked: options.issues.length,
			recentCount,
			warningCount,
			criticalCount,
			leadershipCount,
			incompleteMetadata,
		},
		issues,
	};
}

// ---------------------------------------------------------------------------
// Escalation comment template
// ---------------------------------------------------------------------------

/**
 * Generate an escalation comment for a blocked issue.
 */
export function buildBlockedEscalationComment(options: {
	identifier: string;
	severity: BlockedSeverity;
	hoursBlocked: number;
	missingFields: RequiredBlockerField[];
}): string {
	const emoji: Record<BlockedSeverity, string> = {
		recent: "🟢",
		warning: "🟡",
		critical: "🟠",
		leadership: "🔴",
	};

	const lines = [
		`${emoji[options.severity]} **Blocked escalation: ${options.severity} (${Math.round(options.hoursBlocked)}h blocked)**`,
		"",
		`Issue ${options.identifier} has been blocked for **${Math.round(options.hoursBlocked)} hours**.`,
	];

	if (options.missingFields.length > 0) {
		lines.push("");
		lines.push("⚠️ **Incomplete blocker metadata:**");
		for (const field of options.missingFields) {
			lines.push(`- ${field}`);
		}
		lines.push("");
		lines.push("Please update the issue description with the missing fields.");
	}

	if (options.severity === "critical" || options.severity === "leadership") {
		lines.push("");
		lines.push("**Recommended actions:**");
		lines.push("- Contact the dependency owner for a status update");
		lines.push("- Evaluate if a workaround or parallel path is feasible");
		if (options.severity === "leadership") {
			lines.push("- Escalate to leadership for intervention");
		}
	}

	lines.push("");
	lines.push(
		"_This alert was generated by the blocked governance model (JSC-196)._",
	);

	return lines.join("\n");
}
