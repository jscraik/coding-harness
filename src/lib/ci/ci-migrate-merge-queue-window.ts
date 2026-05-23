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

/**
 * Determines whether a string is a lowercase SHA-256 hex digest (64 hexadecimal characters).
 *
 * @returns `true` if `value` consists of exactly 64 lowercase hexadecimal characters, `false` otherwise.
 */
function isHexDigest(value: string): boolean {
	return SHA256_HEX_PATTERN.test(value);
}

/**
 * Checks whether a string is a 40-character lowercase hex commit SHA.
 *
 * @param value - Candidate commit SHA to validate
 * @returns `true` if `value` matches 40 lowercase hexadecimal characters, `false` otherwise.
 */
function isCommitSha(value: string): boolean {
	return COMMIT_SHA_PATTERN.test(value);
}

/**
 * Validates that a value conforms to the BranchProtectionSatisfiabilityReport shape.
 *
 * Ensures `status` is exactly `"satisfied"` or `"unsatisfied"`, `scannedOpenPrs` is an integer greater than or equal to zero, and `failingPrs` is an array whose elements are objects containing an integer `number` and a `missingChecks` array of strings.
 *
 * @param value - Candidate value to validate
 * @returns `true` if `value` matches the BranchProtectionSatisfiabilityReport structure, `false` otherwise.
 */
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
 * Checks whether a value conforms to the MergeQueueEvidenceBinding shape.
 *
 * @param value - Candidate parsed JSON value to validate
 * @returns `true` if `value` has the required repository, commit, policy, and SHA-256 digest fields; `false` otherwise.
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

	const stageSpecificInvariantsValid = (): boolean => {
		if (parsed.stage === "paused") {
			return Number.isFinite(pausedAtMs);
		}
		if (parsed.stage === "drained") {
			return Number.isFinite(pausedAtMs) && Number.isFinite(drainedAtMs);
		}
		if (parsed.stage === "revalidated") {
			return (
				Number.isFinite(pausedAtMs) &&
				Number.isFinite(drainedAtMs) &&
				Number.isFinite(revalidatedAtMs) &&
				parsed.postCutover !== undefined &&
				isValidBranchProtectionSatisfiabilityReport(parsed.postCutover)
			);
		}
		if (parsed.stage === "aborted") {
			return Number.isFinite(pausedAtMs) && Number.isFinite(abortedAtMs);
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

/**
 * Resolve the filesystem path to the merge-queue cutover window JSON within a target directory.
 *
 * @param targetDir - Base directory that contains the harness control-plane (the directory to resolve from)
 * @returns The resolved file path to the merge-queue window JSON document
 */
function getMergeQueueWindowPath(targetDir: string): string {
	return resolve(targetDir, MERGE_QUEUE_WINDOW_PATH);
}

/**
 * Get the filesystem path to the merge-queue window signature file inside a target directory.
 *
 * @param targetDir - Directory that contains the harness control-plane files
 * @returns The resolved path to the `.sig` file paired with the merge-queue window JSON
 */
function getMergeQueueWindowSignaturePath(targetDir: string): string {
	return `${getMergeQueueWindowPath(targetDir)}.sig`;
}

/**
 * Writes a signed merge-queue cutover window for a snapshot lifecycle stage.
 *
 * @param targetDir - Path to the repository root containing the harness control-plane directory.
 * @param window - Cutover window state to serialize and sign.
 * @returns `{ ok: true }` on success, or `{ ok: false; error: string }` with a sanitized error message on failure.
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
 * Read and verify the signed merge-queue cutover window file if present.
 *
 * @param targetDir - Repository root containing the harness control-plane directory.
 * @returns An object with `ok: true` and `value` set to the verified `MergeQueueCutoverWindow` or `null` when no window file exists; or `ok: false` and `error` with a diagnostic message when verification or reading fails.
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
 * Prevents starting a new snapshot apply when an active non-terminal merge-queue cutover window
 * belonging to a different snapshot exists.
 *
 * @param targetDir - Repository root containing the harness control-plane directory.
 * @param snapshotId - Snapshot id requested by the current migration operation.
 * @returns `{ ok: true }` when no blocking window exists; `{ ok: false, error }` when a blocking
 * window is present or reading/verifying the existing window fails.
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
