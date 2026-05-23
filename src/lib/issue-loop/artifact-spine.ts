/** Contract for tying issue-loop work to the artifact surfaces agents must inspect. */
export const ISSUE_LOOP_ARTIFACT_SPINE_SCHEMA_VERSION =
	"issue-loop-artifact-spine/v1" as const;

/** Semantic artifact classes required for an issue loop to be implementation-ready. */
export const ISSUE_LOOP_REQUIRED_ARTIFACTS = [
	"issue_loop",
	"product_driver",
	"bugfix_record",
	"visual_evidence",
	"review_disagreement",
	"merge_decision",
	"linear_tracker",
] as const;

/** Canonical semantic artifact class required by an issue-loop artifact spine. */
export type IssueLoopArtifactKind =
	(typeof ISSUE_LOOP_REQUIRED_ARTIFACTS)[number];

/** One artifact reference in an issue-loop artifact spine. */
export interface IssueLoopArtifactRef {
	kind: IssueLoopArtifactKind;
	path: string;
	status: "present" | "blocked" | "not_applicable";
	evidenceRefs: string[];
	reason?: string | null;
}

/** Full artifact spine for one issue-loop slice. */
export interface IssueLoopArtifactSpine {
	schemaVersion: typeof ISSUE_LOOP_ARTIFACT_SPINE_SCHEMA_VERSION;
	issue: string;
	artifacts: IssueLoopArtifactRef[];
}

/** Finding produced by issue-loop artifact spine validation. */
export interface IssueLoopArtifactSpineFinding {
	code: string;
	kind: IssueLoopArtifactKind;
	message: string;
	path?: string;
}

/** Validation report for an issue-loop artifact spine. */
export interface IssueLoopArtifactSpineValidationResult {
	valid: boolean;
	findings: IssueLoopArtifactSpineFinding[];
}

/** Normalize common evidence labels to the canonical issue-loop artifact kind. */
export function normalizeIssueLoopArtifactKind(
	value: string,
): IssueLoopArtifactKind | null {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
	switch (normalized) {
		case "issue_loop":
		case "loop":
			return "issue_loop";
		case "product_driver":
		case "product_spec":
		case "product":
			return "product_driver";
		case "bugfix_record":
		case "bug_record":
		case "fix_record":
			return "bugfix_record";
		case "visual_evidence":
		case "screenshot":
		case "screenshots":
			return "visual_evidence";
		case "review_disagreement":
		case "review_thread":
		case "review_dispute":
			return "review_disagreement";
		case "merge_decision":
		case "merge":
			return "merge_decision";
		case "linear_tracker":
		case "linear":
		case "tracker":
			return "linear_tracker";
		default:
			return null;
	}
}

/** Validate that every semantic issue-loop artifact is present or explicitly classified. */
export function validateIssueLoopArtifactSpine(
	spine: IssueLoopArtifactSpine,
): IssueLoopArtifactSpineValidationResult {
	const findings: IssueLoopArtifactSpineFinding[] = [];
	const seen = new Set<IssueLoopArtifactKind>();
	if (spine.schemaVersion !== ISSUE_LOOP_ARTIFACT_SPINE_SCHEMA_VERSION) {
		for (const kind of ISSUE_LOOP_REQUIRED_ARTIFACTS) {
			findings.push({
				code: "schema_version_invalid",
				kind,
				message: "schemaVersion must be issue-loop-artifact-spine/v1.",
			});
		}
		return { valid: false, findings };
	}
	for (const artifact of spine.artifacts) {
		if (seen.has(artifact.kind)) {
			findings.push({
				code: "duplicate_artifact_kind",
				kind: artifact.kind,
				message: `${artifact.kind} must appear at most once.`,
				path: artifact.path,
			});
		}
		seen.add(artifact.kind);
		if (artifact.status === "present" && artifact.evidenceRefs.length === 0) {
			findings.push({
				code: "evidence_refs_missing",
				kind: artifact.kind,
				message: `${artifact.kind} marked present must cite evidence.`,
				path: artifact.path,
			});
		}
		if (artifact.status !== "present" && isBlank(artifact.reason)) {
			findings.push({
				code: "classification_reason_missing",
				kind: artifact.kind,
				message: `${artifact.kind} marked ${artifact.status} must include a reason.`,
				path: artifact.path,
			});
		}
	}
	for (const kind of ISSUE_LOOP_REQUIRED_ARTIFACTS) {
		if (!seen.has(kind)) {
			findings.push({
				code: "required_artifact_missing",
				kind,
				message: `${kind} artifact must be present, blocked, or not_applicable.`,
			});
		}
	}
	return { valid: findings.length === 0, findings };
}

function isBlank(value: string | null | undefined): boolean {
	return value === null || value === undefined || value.trim().length === 0;
}
