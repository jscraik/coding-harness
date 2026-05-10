/** Deterministic JSC-198 closure evidence classifications. */
export type ClosureEvidenceClassification =
	| "complete_ready_for_human_acceptance"
	| "complete_linear_stale"
	| "blocked_missing_eval"
	| "blocked_failing_check"
	| "blocked_review_gate"
	| "not_started"
	| "needs_human_triage"
	| "out_of_scope";

/** Minimal Linear state needed for closure classification. */
export interface ClosureLinearEvidence {
	/** Linear issue key, such as JSC-198. */
	issueKey: string;
	/** Whether current Linear metadata was retrieved for this record. */
	available: boolean;
	/** Coarse lifecycle state from Linear. */
	status: "todo" | "in_progress" | "done";
}

/** Minimal pull request state needed for closure classification. */
export interface ClosurePullRequestEvidence {
	/** Pull request number. */
	number: number;
	/** Pull request lifecycle state. */
	state: "open" | "closed" | "merged";
	/** Whether the pull request is still draft. */
	isDraft: boolean;
	/** Current pull request head commit SHA. */
	headSha: string;
	/** Merge commit SHA when the pull request is merged. */
	mergeSha?: string;
}

/** Required check evidence tied to the evaluated pull request commit. */
export interface ClosureRequiredCheckEvidence {
	/** Required check name. */
	name: string;
	/** Check provider, such as circleci or github-actions. */
	provider: string;
	/** Check run lifecycle status. */
	status: "completed" | "in_progress" | "queued" | "pending" | "not_found";
	/** Check conclusion when completed. */
	conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
	/** Commit SHA reported by the check provider. */
	checkedSha?: string;
}

/** Eval artifact evidence used to prevent prose-only closure. */
export interface ClosureEvalEvidence {
	/** Expected eval artifact path. */
	path: string;
	/** Whether the eval artifact exists in the current checkout. */
	present: boolean;
	/** Whether the eval artifact passed the relevant lint or validation gate. */
	valid: boolean;
}

/** Human or independent review evidence for closure-sensitive slices. */
export interface ClosureReviewEvidence {
	/** Whether human acceptance is required before closure. */
	humanAcceptanceRequired: boolean;
	/** Whether human acceptance has been recorded. */
	humanAccepted: boolean;
	/** Whether an independent review gate has a blocking finding. */
	blockingReviewFinding: boolean;
}

/** JSON-compatible closure evidence record for fixture and live classification. */
export interface ClosureEvidenceRecord {
	/** Record identifier for reports and fixtures. */
	id: string;
	/** Whether this record belongs to the selected JSC-198 closure slice. */
	scope: "selected" | "related" | "umbrella" | "external";
	/** Linear evidence for the candidate. */
	linear: ClosureLinearEvidence;
	/** Pull request evidence when implementation work exists. */
	pullRequest?: ClosurePullRequestEvidence;
	/** Required checks for the pull request. */
	requiredChecks: readonly ClosureRequiredCheckEvidence[];
	/** Eval artifact evidence when the slice defines an eval. */
	evalArtifact?: ClosureEvalEvidence;
	/** Review and acceptance evidence. */
	review: ClosureReviewEvidence;
}

/** Result returned by {@link classifyClosureEvidence}. */
export interface ClosureEvidenceClassificationResult {
	/** Deterministic classification from the JSC-198 spec vocabulary. */
	classification: ClosureEvidenceClassification;
	/** Bounded next action; never an external mutation. */
	nextAction: string;
	/** Evidence fields that drove the classification. */
	reasons: string[];
}

const passingConclusions = new Set(["success"]);

/**
 * Determine whether a Linear issue is considered active.
 *
 * @param linear - Linear metadata whose `status` is evaluated
 * @returns `true` if `linear.status` is `"todo"` or `"in_progress"`, `false` otherwise
 */
function isLinearActive(linear: ClosureLinearEvidence): boolean {
	return linear.status === "todo" || linear.status === "in_progress";
}

/**
 * Determines whether the record contains implementation evidence.
 *
 * @returns `true` if the record includes a pull request or a present eval artifact, `false` otherwise.
 */
function hasImplementationEvidence(record: ClosureEvidenceRecord): boolean {
	return (
		record.pullRequest !== undefined || record.evalArtifact?.present === true
	);
}

/**
 * Builds a set of expected commit SHAs for required checks from a pull request.
 *
 * @param pullRequest - Pull request metadata containing `headSha` and optional `mergeSha`
 * @returns A Set of lowercased SHA strings derived from `headSha` and `mergeSha`; missing values are omitted
 */
function expectedCheckShas(
	pullRequest: ClosurePullRequestEvidence,
): Set<string> {
	return new Set(
		[pullRequest.headSha, pullRequest.mergeSha]
			.filter((sha): sha is string => typeof sha === "string")
			.map((sha) => sha.toLowerCase()),
	);
}

/**
 * Determines whether any required check was recorded against a commit SHA that does not match the pull request's expected SHAs.
 *
 * @param record - The closure evidence record containing `pullRequest` and `requiredChecks`
 * @returns `true` if at least one completed required check lacks a checked SHA or has a `checkedSha` that (case-insensitively) is not among the pull request's expected SHAs; `false` otherwise. Returns `false` when there is no pull request or no expected SHAs.
 */
function hasWrongShaCheck(record: ClosureEvidenceRecord): boolean {
	if (!record.pullRequest) {
		return false;
	}
	const expectedShas = expectedCheckShas(record.pullRequest);
	if (expectedShas.size === 0) {
		return false;
	}
	return record.requiredChecks.some(
		(check) =>
			check.status === "completed" &&
			(typeof check.checkedSha !== "string" ||
				check.checkedSha.trim() === "" ||
				!expectedShas.has(check.checkedSha.toLowerCase())),
	);
}

/**
 * Determines whether any required check in the provided evidence record is incomplete or has a non-passing conclusion.
 *
 * @param record - The closure evidence record whose required checks are evaluated
 * @returns `true` if at least one required check is not `"completed"` or is completed with a conclusion other than `"success"`, `false` otherwise.
 */
function hasFailingRequiredCheck(record: ClosureEvidenceRecord): boolean {
	return record.requiredChecks.some((check) => {
		if (check.status !== "completed") {
			return true;
		}
		return !passingConclusions.has(check.conclusion ?? "");
	});
}

/**
 * Determines whether the required check evidence is absent.
 *
 * @param record - The closure evidence record whose required checks are inspected
 * @returns `true` when no required checks were recorded, `false` otherwise.
 */
function hasMissingRequiredChecks(record: ClosureEvidenceRecord): boolean {
	return record.requiredChecks.length === 0;
}

/**
 * Determine whether the record's required checks exist and all have completed with passing conclusions.
 *
 * @param record - The closure evidence record whose `requiredChecks` will be evaluated
 * @returns `true` if there is at least one required check and every required check has `status` === "completed" and a conclusion of `success`, `false` otherwise.
 */
function allRequiredChecksPassed(record: ClosureEvidenceRecord): boolean {
	return (
		record.requiredChecks.length > 0 &&
		record.requiredChecks.every(
			(check) =>
				check.status === "completed" &&
				passingConclusions.has(check.conclusion ?? ""),
		)
	);
}

/**
 * Determines whether the record contains a present and valid evaluation artifact.
 *
 * @param record - The closure evidence record to inspect
 * @returns `true` if an eval artifact is present and its `valid` flag is `true`, `false` otherwise
 */
function hasValidEval(record: ClosureEvidenceRecord): boolean {
	return record.evalArtifact?.present === true && record.evalArtifact.valid;
}

/**
 * Determine the closure classification for a given closure evidence record.
 *
 * @param record - The evidence record used to determine closure state.
 * @returns The classification result containing the chosen classification, a bounded `nextAction` recommendation, and the array of `reasons` that justified the decision.
 */
export function classifyClosureEvidence(
	record: ClosureEvidenceRecord,
): ClosureEvidenceClassificationResult {
	if (record.scope !== "selected" && record.scope !== "related") {
		return {
			classification: "out_of_scope",
			nextAction: "Leave this candidate out of the JSC-198 closure queue.",
			reasons: [`scope:${record.scope}`],
		};
	}

	if (!record.linear.available) {
		return {
			classification: "needs_human_triage",
			nextAction: "Refresh Linear evidence before classifying closure state.",
			reasons: ["linear:unavailable"],
		};
	}

	if (!hasImplementationEvidence(record) && record.linear.status === "todo") {
		return {
			classification: "not_started",
			nextAction: "Keep the issue in the intake queue.",
			reasons: ["linear:todo", "implementation:none"],
		};
	}

	if (record.review.blockingReviewFinding) {
		return {
			classification: "blocked_review_gate",
			nextAction: "Resolve the blocking review finding before closure.",
			reasons: ["review:blocking"],
		};
	}

	if (hasImplementationEvidence(record) && !hasValidEval(record)) {
		return {
			classification: "blocked_missing_eval",
			nextAction: "Add or repair the eval artifact before closure.",
			reasons: [`eval:${record.evalArtifact?.path ?? "missing"}`],
		};
	}

	if (record.pullRequest) {
		if (hasMissingRequiredChecks(record)) {
			return {
				classification: "blocked_failing_check",
				nextAction:
					"Clear failing, missing, or incomplete required checks before closure.",
				reasons: ["checks:missing"],
			};
		}

		if (hasWrongShaCheck(record)) {
			return {
				classification: "needs_human_triage",
				nextAction: "Refresh check evidence tied to the evaluated PR SHA.",
				reasons: ["checks:wrong-sha"],
			};
		}

		if (hasFailingRequiredCheck(record)) {
			return {
				classification: "blocked_failing_check",
				nextAction:
					"Clear failing, missing, or incomplete required checks before closure.",
				reasons: ["checks:failing"],
			};
		}
	}

	if (record.review.humanAcceptanceRequired && !record.review.humanAccepted) {
		return {
			classification: "needs_human_triage",
			nextAction: "Record human acceptance before closure.",
			reasons: ["human-acceptance:missing"],
		};
	}

	if (
		record.pullRequest?.state === "merged" &&
		allRequiredChecksPassed(record) &&
		hasValidEval(record)
	) {
		if (isLinearActive(record.linear)) {
			return {
				classification: "complete_linear_stale",
				nextAction:
					"Recommend Linear closure after confirming human acceptance scope.",
				reasons: ["pr:merged", "checks:passed", "eval:valid", "linear:active"],
			};
		}

		return {
			classification: "complete_ready_for_human_acceptance",
			nextAction: "Record or confirm human acceptance for final closure.",
			reasons: ["pr:merged", "checks:passed", "eval:valid", "linear:done"],
		};
	}

	return {
		classification: "needs_human_triage",
		nextAction: "Collect missing closure evidence before taking action.",
		reasons: ["classification:ambiguous"],
	};
}
