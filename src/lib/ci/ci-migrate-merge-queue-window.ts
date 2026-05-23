import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { BranchProtectionSatisfiabilityReport } from "./satisfiability.js";
import { sanitizeError } from "../input/sanitize.js";
import {
	resolveSnapshotSigningKey,
	signContent,
} from "./ci-migrate-signing.js";

const MERGE_QUEUE_WINDOW_PATH =
	".harness/control-plane/merge-queue-cutover-window.json";
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;

/**
 * Repository and policy identity that signed merge-queue evidence must match.
 */
export interface MergeQueueEvidenceBinding {
	repoFullName: string;
	headSha: string;
	trustedPolicyRef: string;
	authorityConfigSha256: string;
	requiredCheckManifestSha256: string;
}

/**
 * Signed merge-queue cutover lifecycle state for a CI migration snapshot.
 */
export interface MergeQueueCutoverWindow {
	schemaVersion: "ci-migrate-merge-queue-window/v1";
	snapshotId: string;
	stage: "paused" | "drained" | "revalidated" | "aborted";
	pausedAt: string;
	drainedAt?: string | undefined;
	revalidatedAt?: string | undefined;
	abortedAt?: string | undefined;
	preCutover: BranchProtectionSatisfiabilityReport;
	postCutover?: BranchProtectionSatisfiabilityReport | undefined;
	evidence?:
		| {
				sourcePath: string;
				contentSha256: string;
				binding?: MergeQueueEvidenceBinding | undefined;
				pausedAt: string;
				drainedAt?: string | undefined;
				revalidatedAt?: string | undefined;
				pausedQueueDepth?: number | undefined;
				drainedCandidateCount?: number | undefined;
				revalidatedCandidateCount?: number | undefined;
		  }
		| undefined;
}

function isHexDigest(value: string): boolean {
	return SHA256_HEX_PATTERN.test(value);
}

function isCommitSha(value: string): boolean {
	return COMMIT_SHA_PATTERN.test(value);
}

function isValidBranchProtectionSatisfiabilityReport(
	value: unknown,
): value is BranchProtectionSatisfiabilityReport {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<BranchProtectionSatisfiabilityReport>;
	if (
		(parsed.status !== "satisfied" && parsed.status !== "unsatisfied") ||
		typeof parsed.scannedOpenPrs !== "number" ||
		!Number.isInteger(parsed.scannedOpenPrs) ||
		parsed.scannedOpenPrs < 0 ||
		!Array.isArray(parsed.failingPrs)
	) {
		return false;
	}
	return parsed.failingPrs.every((failingPr) => {
		if (!failingPr || typeof failingPr !== "object") {
			return false;
		}
		const parsedFailingPr = failingPr as {
			number?: unknown;
			missingChecks?: unknown;
		};
		return (
			typeof parsedFailingPr.number === "number" &&
			Number.isInteger(parsedFailingPr.number) &&
			Array.isArray(parsedFailingPr.missingChecks) &&
			parsedFailingPr.missingChecks.every((check) => typeof check === "string")
		);
	});
}

/**
 * Validates the replay-binding shape embedded in merge-queue evidence artifacts.
 *
 * @param value - Candidate parsed JSON value.
 * @returns True when the value carries the required repository and policy digests.
 */
export function isValidMergeQueueEvidenceBinding(
	value: unknown,
): value is MergeQueueEvidenceBinding {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<MergeQueueEvidenceBinding>;
	return (
		typeof parsed.repoFullName === "string" &&
		parsed.repoFullName.trim().length > 0 &&
		typeof parsed.headSha === "string" &&
		isCommitSha(parsed.headSha) &&
		typeof parsed.trustedPolicyRef === "string" &&
		isCommitSha(parsed.trustedPolicyRef) &&
		typeof parsed.authorityConfigSha256 === "string" &&
		isHexDigest(parsed.authorityConfigSha256) &&
		typeof parsed.requiredCheckManifestSha256 === "string" &&
		isHexDigest(parsed.requiredCheckManifestSha256)
	);
}

/**
 * Validates the signed merge-queue cutover window document.
 *
 * @param value - Candidate parsed JSON value.
 * @returns True when the value matches the merge-queue cutover window contract.
 */
export function isValidMergeQueueCutoverWindow(
	value: unknown,
): value is MergeQueueCutoverWindow {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<MergeQueueCutoverWindow>;
	const pausedAtMs =
		typeof parsed.pausedAt === "string"
			? Date.parse(parsed.pausedAt)
			: Number.NaN;
	const drainedAtMs =
		typeof parsed.drainedAt === "string"
			? Date.parse(parsed.drainedAt)
			: Number.NaN;
	const revalidatedAtMs =
		typeof parsed.revalidatedAt === "string"
			? Date.parse(parsed.revalidatedAt)
			: Number.NaN;
	const abortedAtMs =
		typeof parsed.abortedAt === "string"
			? Date.parse(parsed.abortedAt)
			: Number.NaN;
	const evidence = parsed.evidence;
	const evidenceRecord =
		evidence && typeof evidence === "object"
			? (evidence as Partial<MergeQueueCutoverWindow["evidence"]>)
			: undefined;
	const evidencePausedAtMs =
		evidenceRecord && typeof evidenceRecord.pausedAt === "string"
			? Date.parse(evidenceRecord.pausedAt)
			: Number.NaN;
	const evidenceDrainedAtMs =
		evidenceRecord && typeof evidenceRecord.drainedAt === "string"
			? Date.parse(evidenceRecord.drainedAt)
			: Number.NaN;
	const evidenceRevalidatedAtMs =
		evidenceRecord && typeof evidenceRecord.revalidatedAt === "string"
			? Date.parse(evidenceRecord.revalidatedAt)
			: Number.NaN;
	const evidenceQueueCountValid = (count: unknown): boolean =>
		count === undefined ||
		(typeof count === "number" &&
			Number.isInteger(count) &&
			Number.isFinite(count) &&
			count >= 0);
	const inOrder = (earlier: number, later: number): boolean =>
		Number.isFinite(earlier) && Number.isFinite(later) && later >= earlier;

	const stageSpecificInvariantsValid = (): boolean => {
		if (parsed.stage === "paused") {
			return Number.isFinite(pausedAtMs);
		}
		if (parsed.stage === "drained") {
			return inOrder(pausedAtMs, drainedAtMs);
		}
		if (parsed.stage === "revalidated") {
			return (
				inOrder(pausedAtMs, drainedAtMs) &&
				inOrder(drainedAtMs, revalidatedAtMs) &&
				parsed.postCutover !== undefined &&
				isValidBranchProtectionSatisfiabilityReport(parsed.postCutover)
			);
		}
		if (parsed.stage === "aborted") {
			return inOrder(pausedAtMs, abortedAtMs);
		}
		return false;
	};

	return (
		parsed.schemaVersion === "ci-migrate-merge-queue-window/v1" &&
		typeof parsed.snapshotId === "string" &&
		parsed.snapshotId.trim().length > 0 &&
		(parsed.stage === "paused" ||
			parsed.stage === "drained" ||
			parsed.stage === "revalidated" ||
			parsed.stage === "aborted") &&
		stageSpecificInvariantsValid() &&
		isValidBranchProtectionSatisfiabilityReport(parsed.preCutover) &&
		(evidenceRecord === undefined ||
			(typeof evidenceRecord.sourcePath === "string" &&
				evidenceRecord.sourcePath.trim().length > 0 &&
				typeof evidenceRecord.contentSha256 === "string" &&
				isHexDigest(evidenceRecord.contentSha256) &&
				(evidenceRecord.binding === undefined ||
					isValidMergeQueueEvidenceBinding(evidenceRecord.binding)) &&
				Number.isFinite(evidencePausedAtMs) &&
				(evidenceRecord.drainedAt === undefined ||
					Number.isFinite(evidenceDrainedAtMs)) &&
				(evidenceRecord.revalidatedAt === undefined ||
					Number.isFinite(evidenceRevalidatedAtMs)) &&
				evidenceQueueCountValid(evidenceRecord.pausedQueueDepth) &&
				evidenceQueueCountValid(evidenceRecord.drainedCandidateCount) &&
				evidenceQueueCountValid(evidenceRecord.revalidatedCandidateCount)))
	);
}

function getMergeQueueWindowPath(targetDir: string): string {
	return resolve(targetDir, MERGE_QUEUE_WINDOW_PATH);
}

function getMergeQueueWindowSignaturePath(targetDir: string): string {
	return `${getMergeQueueWindowPath(targetDir)}.sig`;
}

/**
 * Writes a signed merge-queue cutover window for a snapshot lifecycle stage.
 *
 * @param targetDir - Repository root containing the harness control-plane directory.
 * @param window - Cutover window state to serialize and sign.
 * @returns Success or a sanitized error describing the write failure.
 */
export function writeMergeQueueWindow(
	targetDir: string,
	window: MergeQueueCutoverWindow,
): { ok: true } | { ok: false; error: string } {
	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return {
			ok: false,
			error: signingKeyResult.error,
		};
	}
	try {
		const windowPath = getMergeQueueWindowPath(targetDir);
		const signaturePath = getMergeQueueWindowSignaturePath(targetDir);
		const windowContent = JSON.stringify(window, null, 2);
		const signature = signContent(windowContent, signingKeyResult.key);
		mkdirSync(dirname(windowPath), { recursive: true });
		writeFileSync(windowPath, windowContent);
		writeFileSync(signaturePath, `${signature}\n`);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to write merge-queue cutover window state: ${sanitizeError(error)}`,
		};
	}
}

/**
 * Reads and verifies the signed merge-queue cutover window when it exists.
 *
 * @param targetDir - Repository root containing the harness control-plane directory.
 * @returns Null when no window exists, or the verified window document.
 */
export function readMergeQueueWindowIfPresent(
	targetDir: string,
):
	| { ok: true; value: MergeQueueCutoverWindow | null }
	| { ok: false; error: string } {
	const windowPath = getMergeQueueWindowPath(targetDir);
	const signaturePath = getMergeQueueWindowSignaturePath(targetDir);
	if (!existsSync(windowPath)) {
		return { ok: true, value: null };
	}
	if (!existsSync(signaturePath)) {
		return {
			ok: false,
			error: `Merge-queue cutover window signature is missing: ${signaturePath}`,
		};
	}
	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return {
			ok: false,
			error: signingKeyResult.error,
		};
	}
	try {
		const windowContent = readFileSync(windowPath, "utf-8");
		const signature = readFileSync(signaturePath, "utf-8").trim();
		if (!isHexDigest(signature)) {
			return {
				ok: false,
				error:
					"Merge-queue cutover window signature must be a sha256 hex digest: " +
					signaturePath,
			};
		}
		const expectedSignature = signContent(windowContent, signingKeyResult.key);
		if (signature !== expectedSignature) {
			return {
				ok: false,
				error:
					"Merge-queue cutover window signature mismatch. Refusing untrusted state.",
			};
		}
		const parsed = JSON.parse(windowContent) as unknown;
		if (!isValidMergeQueueCutoverWindow(parsed)) {
			return {
				ok: false,
				error: `Merge-queue cutover window schema is invalid: ${windowPath}`,
			};
		}
		return { ok: true, value: parsed };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to read merge-queue cutover window: ${sanitizeError(error)}`,
		};
	}
}

/**
 * Fails a new apply when another snapshot still owns a non-terminal window.
 *
 * @param targetDir - Repository root containing the harness control-plane directory.
 * @param snapshotId - Snapshot id requested by the current migration operation.
 * @returns Success when no blocking window exists.
 */
export function assertNoBlockingMergeQueueCutoverWindow(
	targetDir: string,
	snapshotId: string,
): { ok: true } | { ok: false; error: string } {
	const windowResult = readMergeQueueWindowIfPresent(targetDir);
	if (!windowResult.ok) {
		return windowResult;
	}
	const window = windowResult.value;
	if (!window) {
		return { ok: true };
	}
	if (
		(window.stage === "paused" || window.stage === "drained") &&
		window.snapshotId !== snapshotId
	) {
		return {
			ok: false,
			error:
				"Active merge-queue cutover window blocks new apply: snapshot " +
				window.snapshotId +
				" is " +
				window.stage +
				". Complete or abort the active window before starting snapshot " +
				snapshotId +
				".",
		};
	}
	return { ok: true };
}
