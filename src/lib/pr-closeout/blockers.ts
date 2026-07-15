import {
	HARNESS_CLOSEOUT_GATE_CONTRACTS,
	HARNESS_CLOSEOUT_GATE_IDS,
	type HePhaseExit,
} from "../decision/he-phase-exit.js";
import { isSafeEvidenceReceiptPointer } from "../evidence/evidence-receipt.js";
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
	PrCloseoutStackState,
	PrCloseoutToolInput,
} from "./types.js";
import {
	hasLinearReference,
	isFailedCheck,
	isPendingCheck,
	isPassingCheck,
	normalizeStatus,
} from "./evidence.js";

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

/** Keep stack evidence identifiable without double-prefixing canonical stack refs. */
function stackBlockerRef(refs: string | undefined): string {
	if (!refs) return "stack:state";
	return refs.startsWith("stack:") ? refs : `stack:${refs}`;
}

/** Add blockers when supplied parent/base stack evidence is unstable or unknown. */
export function collectStackBlockers(
	stack: PrCloseoutStackState | undefined,
	blockers: PrCloseoutBlocker[],
): void {
	if (!stack) return;
	if (stack.status === "stable" || stack.status === "not_applicable") return;
	if (stack.required === false && stack.status === "unknown") return;
	const unstable = stack.status === "unstable";
	const refs = [
		...(stack.blockerRefs ?? []),
		...(stack.evidenceRefs ?? []),
	].join(",");
	blockers.push({
		surface: "branch",
		classification: unstable ? "introduced" : "unknown",
		kind: "state",
		reason:
			stack.reason ??
			(unstable
				? "Stack state is unstable; reconcile lower-layer, parent, and base PR evidence before closeout."
				: "Stack state is unknown; provide current parent/lower-layer and base evidence before closeout."),
		fixableByCodex: false,
		ref: stackBlockerRef(refs),
	});
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
	prHeadSha: string | null | undefined,
	blockers: PrCloseoutBlocker[],
): void {
	for (const artifact of reviewArtifacts) {
		if (artifact.status === "present") {
			const matchingProofs = reviewerArtifactProofs.filter(
				(candidate) =>
					candidate.path === artifact.path &&
					candidate.producer === artifact.producer,
			);
			if (
				matchingProofs.some((proof) =>
					isUsableReviewerArtifactProof(proof, artifact, prHeadSha),
				)
			) {
				continue;
			}
			const proof = matchingProofs[0];
			pushBlocker(blockers, {
				surface: "review_artifact",
				classification: "unknown",
				kind: "state",
				reason: proof
					? `Review artifact ${artifact.path} is present but its verifier proof is not backed by a current claim-support receipt.`
					: `Review artifact ${artifact.path} is present but lacks matching verifier proof.`,
				fixableByCodex: true,
				ref:
					receiptRef(proof?.receipt) ?? artifact.evidenceRef ?? artifact.path,
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
	prHeadSha: string | null | undefined,
): boolean {
	if (!isReviewArtifactReceipt(proof.receipt)) {
		return false;
	}
	const receipt = proof.receipt;
	const sizeBytes = receipt.sizeBytes;
	return (
		proof.evidenceVerified === true &&
		receipt.kind === "review_artifact" &&
		receipt.ref === `review-state:${artifact.path}` &&
		receipt.producer === artifact.producer &&
		receipt.status === "pass" &&
		receipt.freshness === "current" &&
		receipt.evidenceUse === "claim_support" &&
		receipt.blockerClass === null &&
		hasValidReceiptTimestamp(receipt) &&
		matchesPrHeadSha(receipt.headSha, prHeadSha) &&
		typeof sizeBytes === "number" &&
		Number.isInteger(sizeBytes) &&
		sizeBytes > 0
	);
}

function hasValidReceiptTimestamp(
	receipt: PrCloseoutReviewerArtifactProof["receipt"],
): boolean {
	const producedAt =
		typeof receipt.producedAt === "string" ? receipt.producedAt : null;
	const verifiedAt =
		typeof receipt.verifiedAt === "string" ? receipt.verifiedAt : null;
	if (!producedAt && !verifiedAt) return false;
	if (producedAt && !isStrictIsoTimestamp(producedAt)) return false;
	if (verifiedAt && !isStrictIsoTimestamp(verifiedAt)) return false;
	if (producedAt && verifiedAt) {
		return Date.parse(verifiedAt) >= Date.parse(producedAt);
	}
	return true;
}

function matchesPrHeadSha(
	receiptHeadSha: string | null | undefined,
	prHeadSha: string | null | undefined,
): boolean {
	if (typeof prHeadSha !== "string" || prHeadSha.length === 0) return false;
	return receiptHeadSha === prHeadSha;
}

function isStrictIsoTimestamp(value: string): boolean {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(
			value,
		);
	if (!match) return false;

	const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
		match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const utcDate = new Date(
		Date.UTC(year, month - 1, day, hour, minute, second),
	);

	return (
		utcDate.getUTCFullYear() === year &&
		utcDate.getUTCMonth() === month - 1 &&
		utcDate.getUTCDate() === day &&
		utcDate.getUTCHours() === hour &&
		utcDate.getUTCMinutes() === minute &&
		utcDate.getUTCSeconds() === second &&
		!Number.isNaN(Date.parse(value))
	);
}

function receiptRef(receipt: unknown): string | null {
	return isRecord(receipt) &&
		typeof receipt.ref === "string" &&
		isSafeEvidenceReceiptPointer(receipt.ref)
		? receipt.ref
		: null;
}

function isReviewArtifactReceipt(receipt: unknown): boolean {
	return (
		isRecord(receipt) &&
		receipt.schemaVersion === "evidence-receipt/v1" &&
		typeof receipt.ref === "string" &&
		receipt.ref.length > 0 &&
		isSafeEvidenceReceiptPointer(receipt.ref) &&
		typeof receipt.producer === "string" &&
		receipt.producer.length > 0 &&
		isSafeEvidenceReceiptPointer(receipt.producer) &&
		(receipt.producedAt === undefined ||
			typeof receipt.producedAt === "string") &&
		(receipt.verifiedAt === undefined || typeof receipt.verifiedAt === "string")
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
