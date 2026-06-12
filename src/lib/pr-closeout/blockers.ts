import {
	HARNESS_CLOSEOUT_GATE_CONTRACTS,
	HARNESS_CLOSEOUT_GATE_IDS,
	type HePhaseExit,
} from "../decision/he-phase-exit.js";
import type {
	PrCloseoutBlocker,
	PrCloseoutCheckInput,
	PrCloseoutCiTelemetryInput,
	PrCloseoutDirtyPathInput,
	PrCloseoutHarnessGateEvidenceSource,
	PrCloseoutHarnessGateSummary,
	PrCloseoutInput,
	PrCloseoutPullRequestInput,
	PrCloseoutReviewArtifactInput,
	PrCloseoutReviewerArtifactProof,
	PrCloseoutReviewThreadsInput,
	PrCloseoutToolInput,
} from "./types.js";
import {
	hasLinearReference,
	isFailedCheck,
	isPendingCheck,
	isPassingCheck,
	normalizeStatus,
} from "./evidence.js";
import { validateEvidenceReceipt } from "../evidence/evidence-receipt.js";

function pushBlocker(
	blockers: PrCloseoutBlocker[],
	blocker: PrCloseoutBlocker,
): void {
	blockers.push(blocker);
}

/** Add blockers for local branch and dirty-worktree closeout evidence. */
export function collectWorktreeBlockers(
	input: PrCloseoutInput,
	dirtyPathsExcluded: readonly PrCloseoutDirtyPathInput[],
	blockers: PrCloseoutBlocker[],
): void {
	if (dirtyPathsExcluded.length > 0) {
		pushBlocker(blockers, {
			surface: "worktree",
			classification: "unrelated_dirty_worktree",
			kind: "state",
			reason:
				"Unrelated dirty worktree paths must be excluded before PR closeout.",
			fixableByCodex: false,
			ref: dirtyPathsExcluded.map((path) => path.path).join(","),
		});
	}
	if (input.branch?.clean === false) {
		pushBlocker(blockers, {
			surface: "worktree",
			classification: "unknown",
			kind: "state",
			reason: "Local worktree is dirty; classify paths before PR closeout.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.pushed === false) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			kind: "state",
			reason: "Branch has not been pushed to the remote PR head.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.hasConflicts === true) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			kind: "state",
			conflict: true,
			reason: "Branch has merge conflicts.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.behindBase === true) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			kind: "state",
			reason: "Branch is behind its base branch.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.matchesPullRequestHead === false) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			kind: "state",
			reason: "Local HEAD does not match the pull request head.",
			fixableByCodex: true,
		});
	}
	if (input.branch?.matchesPullRequestHead === null) {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "unknown",
			kind: "state",
			reason: "Unable to verify local HEAD against the pull request head.",
			fixableByCodex: true,
		});
	}
}

/** Add blockers for pull request state and metadata closeout evidence. */
export function collectPullRequestBlockers(
	pr: PrCloseoutPullRequestInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (
		normalizeStatus(pr.state) !== "" &&
		normalizeStatus(pr.state) !== "OPEN"
	) {
		pushBlocker(blockers, {
			surface: "pr",
			classification: "needs_jamie_decision",
			reason: `Pull request state is ${String(pr.state)}; closeout cannot proceed as an open PR.`,
			fixableByCodex: false,
		});
	}
	if (pr.isDraft === true) {
		pushBlocker(blockers, {
			surface: "pr",
			classification: "needs_jamie_decision",
			reason: "Pull request is still draft.",
			fixableByCodex: false,
		});
	}
	const mergeState = normalizeStatus(pr.mergeStateStatus);
	if (mergeState === "DIRTY") {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			kind: "state",
			conflict: true,
			reason: "Pull request merge state reports conflicts.",
			fixableByCodex: true,
		});
	}
	if (mergeState === "BEHIND") {
		pushBlocker(blockers, {
			surface: "branch",
			classification: "introduced",
			kind: "state",
			reason: "Pull request merge state reports branch is behind base.",
			fixableByCodex: true,
		});
	}
	if (!hasLinearReference(pr.body)) {
		pushBlocker(blockers, {
			surface: "linear",
			classification: "introduced",
			reason:
				"Pull request body is missing a Refs/Closes Linear issue reference.",
			fixableByCodex: true,
		});
	}
}

/** Add blockers for failed or pending check-run evidence. */
export function collectCheckBlockers(
	checks: readonly PrCloseoutCheckInput[],
	blockers: PrCloseoutBlocker[],
): void {
	for (const check of checks) {
		if (isFailedCheck(check)) {
			pushBlocker(blockers, {
				surface: "checks",
				classification: "introduced",
				reason: `Check failed: ${check.name}.`,
				fixableByCodex: true,
				ref: check.url ?? check.name,
			});
		} else if (isPendingCheck(check)) {
			pushBlocker(blockers, {
				surface: "checks",
				classification: "external_service",
				reason: `Check is still pending: ${check.name}.`,
				fixableByCodex: false,
				ref: check.url ?? check.name,
			});
		}
	}
}

function hasActionableCircleCiCheck(
	checks: readonly PrCloseoutCheckInput[],
): boolean {
	return checks.some((check) => {
		const isCircleCi =
			check.source === "circleci" ||
			/\b(?:circleci|pr-pipeline)\b/iu.test(check.name);
		return (
			isCircleCi &&
			(isPassingCheck(check) || isFailedCheck(check) || isPendingCheck(check))
		);
	});
}

function positiveStatusCountEntries(
	statusCounts: PrCloseoutCiTelemetryInput["statusCounts"],
): Array<[string, number]> {
	if (!statusCounts) return [];
	return Object.entries(statusCounts).filter(
		([, count]) =>
			typeof count === "number" && Number.isFinite(count) && count > 0,
	);
}

function onlyUnknownCircleCiStatuses(
	telemetry: PrCloseoutCiTelemetryInput,
): boolean {
	const entries = positiveStatusCountEntries(telemetry.statusCounts);
	return (
		entries.length > 0 && entries.every(([status]) => status === "unknown")
	);
}

function isUninterpretableCircleCiTelemetry(
	telemetry: PrCloseoutCiTelemetryInput,
): boolean {
	if (telemetry.provider !== "circleci") return false;
	if (telemetry.canIdentifyIssues === false) return true;
	if (onlyUnknownCircleCiStatuses(telemetry)) return true;
	return /status|failure|unknown/iu.test(telemetry.blockedReason ?? "");
}

/** Add blockers for CircleCI telemetry that is present but cannot prove CI state. */
export function collectCiTelemetryBlockers(
	input: PrCloseoutInput,
	checks: readonly PrCloseoutCheckInput[],
	blockers: PrCloseoutBlocker[],
): void {
	if (hasActionableCircleCiCheck(checks)) return;
	const uninterpretable = (input.ciTelemetry ?? []).find(
		isUninterpretableCircleCiTelemetry,
	);
	if (!uninterpretable) return;
	const reason =
		uninterpretable.blockedReason ??
		"CircleCI telemetry does not include actionable status or failure evidence";
	pushBlocker(blockers, {
		surface: "checks",
		classification: "external_service",
		kind: "state",
		reason:
			"CircleCI telemetry is present but cannot identify CI failures: " +
			reason +
			". Use current-head GitHub checks or CircleCI API status before closeout.",
		fixableByCodex: false,
		ref: uninterpretable.evidenceRef ?? "circleci:telemetry:uninterpretable",
	});
}

/** Add blockers for review-thread and review-decision evidence. */
export function collectReviewBlockers(
	pr: PrCloseoutPullRequestInput,
	reviewThreads: PrCloseoutReviewThreadsInput,
	blockers: PrCloseoutBlocker[],
): void {
	if (reviewThreads.unresolved === null) {
		pushBlocker(blockers, {
			surface: "review",
			classification: "unknown",
			reason:
				"Review thread state is unobserved; live GitHub reviewThreads evidence is required before PR closeout.",
			fixableByCodex: true,
			ref: "github:reviewThreads",
		});
	}
	if (reviewThreads.unresolved !== null && reviewThreads.unresolved > 0) {
		const needsHuman = (reviewThreads.needsHuman ?? 0) > 0;
		pushBlocker(blockers, {
			surface: "review",
			classification: needsHuman ? "needs_jamie_decision" : "introduced",
			reason: `${String(reviewThreads.unresolved)} review thread(s) are unresolved.`,
			fixableByCodex: !needsHuman,
		});
	}
	if (normalizeStatus(pr.reviewDecision) === "CHANGES_REQUESTED") {
		pushBlocker(blockers, {
			surface: "review",
			classification: "introduced",
			reason: "Pull request review decision is CHANGES_REQUESTED.",
			fixableByCodex: true,
		});
	}
}

/** Add blockers for expected independent-review artifacts that are unavailable. */
export function collectReviewArtifactBlockers(
	reviewArtifacts: readonly PrCloseoutReviewArtifactInput[],
	reviewerArtifactProofs: readonly PrCloseoutReviewerArtifactProof[],
	blockers: PrCloseoutBlocker[],
): void {
	for (const artifact of reviewArtifacts) {
		if (artifact.status === "present") {
			const proof = reviewerArtifactProofs.find(
				(candidate) =>
					candidate.path === artifact.path &&
					candidate.producer === artifact.producer,
			);
			if (proof && isUsableReviewerArtifactProof(proof, artifact)) continue;
			pushBlocker(blockers, {
				surface: "review_artifact",
				classification: "unknown",
				kind: "state",
				reason: proof
					? `Review artifact ${artifact.path} is present but its verifier proof is not backed by a current claim-support receipt.`
					: `Review artifact ${artifact.path} is present but lacks matching verifier proof.`,
				fixableByCodex: true,
				ref: proof?.receipt.ref ?? artifact.evidenceRef ?? artifact.path,
			});
			continue;
		}
		pushBlocker(blockers, {
			surface: "review_artifact",
			classification: "unknown",
			kind: "state",
			reason: `Review artifact ${artifact.path} is ${artifact.status}.`,
			fixableByCodex: artifact.status !== "ignored_runtime_path",
			ref: artifact.evidenceRef ?? artifact.path,
		});
	}
}

function isUsableReviewerArtifactProof(
	proof: PrCloseoutReviewerArtifactProof,
	artifact: PrCloseoutReviewArtifactInput,
): boolean {
	const validation = validateEvidenceReceipt(proof.receipt);
	return (
		proof.evidenceVerified === true &&
		validation.valid &&
		proof.receipt.kind === "review_artifact" &&
		proof.receipt.ref === `review-state:${artifact.path}` &&
		proof.receipt.producer === artifact.producer &&
		proof.receipt.status === "pass" &&
		proof.receipt.freshness === "current" &&
		proof.receipt.evidenceUse === "claim_support" &&
		proof.receipt.blockerClass === null &&
		typeof proof.receipt.sizeBytes === "number" &&
		proof.receipt.sizeBytes > 0
	);
}

/** Add a blocker when PR handoff lacks session or traceability evidence. */
export function collectTraceabilityBlocker(
	traceabilityComplete: boolean,
	blockers: PrCloseoutBlocker[],
): void {
	if (traceabilityComplete) return;
	pushBlocker(blockers, {
		surface: "traceability",
		classification: "introduced",
		reason:
			"PR evidence is missing complete AI session / traceability references.",
		fixableByCodex: true,
	});
}

/** Normalize closeout-gate evidence into the pr-closeout report shape. */
export function buildHarnessGateSummary(
	closeoutGates: HePhaseExit | undefined,
	evidenceSource: PrCloseoutHarnessGateEvidenceSource,
): PrCloseoutHarnessGateSummary {
	if (!closeoutGates) {
		return {
			evidenceSource: "missing",
			closeoutGatesPresent: false,
			phaseExitPresent: false,
			recommendation: "missing",
			commitAllowed: false,
			exitAllowed: false,
			gates: HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => ({
				gateId,
				required:
					HARNESS_CLOSEOUT_GATE_CONTRACTS[gateId].applicability === "default",
				status: "missing",
				evidenceRefs: [],
				requiresHuman: false,
				blocker: "Coding Harness closeout-gates evidence was not supplied.",
			})),
		};
	}
	const gatesById = new Map(
		closeoutGates.gates.map((gate) => [gate.gateId, gate]),
	);
	return {
		evidenceSource,
		closeoutGatesPresent: evidenceSource === "closeout_gates",
		phaseExitPresent: evidenceSource === "phase_exit",
		recommendation: closeoutGates.recommendation,
		commitAllowed: closeoutGates.commitAllowed,
		exitAllowed: closeoutGates.exitAllowed,
		gates: HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => {
			const gate = gatesById.get(gateId);
			const required =
				HARNESS_CLOSEOUT_GATE_CONTRACTS[gateId].applicability === "default" ||
				gate?.required === true;
			if (!gate) {
				return {
					gateId,
					required,
					status: "missing",
					evidenceRefs: [],
					requiresHuman: false,
					blocker: required
						? `${gateId} gate is missing from Coding Harness closeout-gates evidence.`
						: null,
				};
			}
			return {
				gateId: gate.gateId,
				required,
				status: gate.status,
				evidenceRefs: gate.evidenceRefs.map((ref) => ref.ref),
				requiresHuman: gate.requiresHuman,
				blocker: gate.blockedReason ?? gate.reason,
			};
		}),
	};
}

/** Add blockers for missing or non-passing Coding Harness closeout gates. */
export function collectHarnessGateBlockers(
	harnessGates: PrCloseoutHarnessGateSummary,
	blockers: PrCloseoutBlocker[],
): void {
	if (harnessGates.evidenceSource === "missing") {
		pushBlocker(blockers, {
			surface: "harness_gates",
			classification: "unknown",
			reason:
				"Coding Harness closeout gates are missing closeout-gates evidence.",
			fixableByCodex: true,
			ref: "schema:coding-harness-closeout-gates/v1",
		});
		return;
	}
	for (const gate of harnessGates.gates) {
		if (
			!gate.required ||
			gate.status === "pass" ||
			gate.status === "not_applicable"
		) {
			continue;
		}
		const requiresJamie =
			gate.requiresHuman ||
			harnessGates.recommendation === "human_review_required";
		pushBlocker(blockers, {
			surface: "harness_gates",
			classification: requiresJamie
				? "needs_jamie_decision"
				: gate.status === "blocked"
					? "unknown"
					: "introduced",
			reason: gate.blocker ?? `${gate.gateId} closeout gate is ${gate.status}.`,
			fixableByCodex: !requiresJamie && gate.status !== "blocked",
			ref: gate.evidenceRefs[0] ?? gate.gateId,
		});
	}
	if (!harnessGates.commitAllowed || !harnessGates.exitAllowed) {
		const requiresJamie =
			harnessGates.recommendation === "human_review_required";
		pushBlocker(blockers, {
			surface: "harness_gates",
			classification: requiresJamie ? "needs_jamie_decision" : "unknown",
			reason: `Coding Harness closeout gates deny closeout (recommendation=${harnessGates.recommendation}, commitAllowed=${String(harnessGates.commitAllowed)}, exitAllowed=${String(harnessGates.exitAllowed)}).`,
			fixableByCodex: false,
			ref: "schema:coding-harness-closeout-gates/v1",
		});
	}
}

/** Add blockers for release-readiness impacts that require proof before closeout. */
export function collectReleaseReadinessBlockers(
	input: PrCloseoutInput,
	blockers: PrCloseoutBlocker[],
): void {
	const impact = input.releaseReadinessImpact;
	if (impact === undefined || impact === "none") return;
	if (impact === "release_blocker") {
		pushBlocker(blockers, {
			surface: "release_readiness",
			classification: "needs_jamie_decision",
			kind: "state",
			reason: "Release-readiness impact is marked as a release blocker.",
			fixableByCodex: false,
			ref: "input:releaseReadinessImpact:release_blocker",
		});
		return;
	}
	if (impact === "governed_change") {
		pushBlocker(blockers, {
			surface: "release_readiness",
			classification: "unknown",
			kind: "state",
			reason:
				"Governed change requires release-readiness evidence before closeout.",
			fixableByCodex: true,
			ref: "input:releaseReadinessImpact:governed_change",
		});
		return;
	}
	pushBlocker(blockers, {
		surface: "release_readiness",
		classification: "unknown",
		kind: "state",
		reason: "Release-readiness impact must be classified before closeout.",
		fixableByCodex: false,
		ref: "input:releaseReadinessImpact:unknown",
	});
}

/** Add blockers for required closeout tools that are observed as blocked. */
export function collectToolBlockers(
	tools: readonly PrCloseoutToolInput[],
	blockers: PrCloseoutBlocker[],
): void {
	for (const tool of tools) {
		if (tool.status !== "blocked") continue;
		pushBlocker(blockers, {
			surface: "tool",
			classification: "external_service",
			reason: `${tool.name} is blocked: ${String(tool.failureClass ?? "unknown")}`,
			fixableByCodex: false,
			ref: tool.ref,
		});
	}
}
