import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { cwd, env } from "node:process";
import {
	type RequiredCheckIdentity,
	createCIProviderAdapter,
} from "../lib/ci/provider-adapter.js";
import {
	type BranchProtectionSatisfiabilityReport,
	scanOpenPullRequestSatisfiability,
} from "../lib/ci/satisfiability.js";
import {
	type CIProvider,
	EXIT_CODES,
	HARNESS_DIR,
	type InitOptions,
	MANIFEST_FILE,
} from "../lib/init/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { runInitCLI } from "./init.js";

const DEFAULT_PROVIDER = "circleci";
const SNAPSHOT_DIR = "ci-migrate-snapshots";
const REPORT_SUFFIX = ".report.json";
const MAX_SNAPSHOT_AGE_DAYS = 30;
const SNAPSHOT_SIGNATURE_ALGORITHM = "hmac-sha256";
const SNAPSHOT_SIGNING_KEY_ENV = "HARNESS_CI_MIGRATE_SIGNING_KEY";
const MIN_SNAPSHOT_SIGNING_KEY_BYTES = 16;
const STATE_SIGNATURE_ALGORITHM = SNAPSHOT_SIGNATURE_ALGORITHM;
const PARITY_PROOF_PACK_PATH = ".harness/ci-parity-proof-pack.json";
const PARITY_PROOF_PACK_SIGNATURE_PATH = ".harness/ci-parity-proof-pack.sig";
const PARITY_PROOF_PACK_SIGNATURE_ALGORITHM = "hmac-sha256";
const PARITY_PROOF_PACK_MAX_AGE_DAYS = 30;
const PARITY_PROOF_PACK_MAX_FUTURE_SKEW_MINUTES = 5;
const REQUIRED_PARITY_SCENARIOS = [
	"pull_request",
	"main",
	"merge_queue",
	"fork_pr",
	"docs_only_pr",
	"canceled_run",
	"flaky_retry",
	"release_candidate_tag",
] as const;
const MIN_PARITY_DOWNSTREAM_REPOS = 3;
const MIN_PARITY_ECOSYSTEM_PROFILES = 2;
const EXTERNAL_CONTROL_PLANE_PATHS = [
	".harness/control-plane/github-rulesets.json",
	".harness/control-plane/circleci-project-settings.json",
	".harness/control-plane/circleci-context-bindings.json",
	".harness/control-plane/github-app-installation.json",
] as const;
const EXTERNAL_CONTROL_PLANE_PATH_SET = new Set<string>(
	EXTERNAL_CONTROL_PLANE_PATHS,
);
const MAX_SNAPSHOT_ID_LENGTH = 64;
const SNAPSHOT_ID_PATTERN =
	/^[A-Za-z0-9][A-Za-z0-9._-]*[A-Za-z0-9]$|^[A-Za-z0-9]$/;
const PREPARED_STATE_MAX_AGE_HOURS = 24;
const VALID_PROVIDERS: CIProvider[] = ["github-actions", "circleci"];
const VALID_ACTIONS = ["prepare", "commit", "abort"] as const;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const HEX_TOKEN_PATTERN = /^[a-f0-9]+$/;

type CIMigrateAction = (typeof VALID_ACTIONS)[number];

type MigrationClassification =
	| "translatable"
	| "manual-mapping-required"
	| "unsupported-blocking";
type CIProviderMode = "shadow" | "required";
type RequiredParityScenario = (typeof REQUIRED_PARITY_SCENARIOS)[number];

export interface CIMigrateOptions {
	provider?: string | undefined;
	dryRun?: boolean | undefined;
	apply?: boolean | undefined;
	rollback?: boolean | undefined;
	snapshot?: string | undefined;
	action?: string | undefined;
	breakGlassApprovalPath?: string | undefined;
}

interface MigrationCheckClassification {
	displayName: string;
	classification: MigrationClassification;
	reason: string;
}

interface MigrationParityReport {
	status: "parity" | "drift";
	unexpectedDiffs: string[];
}

interface PromotionEvidenceReport {
	required: boolean;
	status: "verified" | "missing" | "insufficient" | "not-required";
	proofPackPath: string;
	proofPackPayloadSha256?: string | undefined;
	proofPackSignature?: string | undefined;
	violations: string[];
}

interface CIParityProofPack {
	schemaVersion: "ci-parity-proof-pack/v2";
	generatedAt: string;
	sourceProvider: "github-actions";
	targetProvider: "circleci";
	repo: CIParityProofPackRepoBinding;
	policyDigests: CIParityProofPackPolicyDigests;
	artifacts: CIParityProofPackArtifact[];
	integrity: CIParityProofPackIntegrity;
	behavioralParity: {
		scenarios: CIParityScenarioEvidence[];
	};
	promotionGate: {
		zeroUnexpectedDiffs: boolean;
		outcomeParity: boolean;
		skippedSemanticsParity: boolean;
		artifactParity: boolean;
		greptileParity: boolean;
		releaseParity: boolean;
	};
	downstream: {
		repositories: CIParityDownstreamRepositoryEvidence[];
	};
}

interface CIParityProofPackRepoBinding {
	fullName: string;
	originUrl: string;
	trustedPolicyRef: string;
	requiredCheckManifestPath: string;
	baseSha: string;
	headSha: string;
}

interface CIParityProofPackPolicyDigests {
	authorityConfigSha256: string;
	requiredCheckManifestSha256: string;
}

interface CIParityProofPackArtifact {
	artifactId: string;
	path: string;
	sha256: string;
	signature: string;
}

interface CIParityProofPackIntegrity {
	signatureAlgorithm: typeof PARITY_PROOF_PACK_SIGNATURE_ALGORITHM;
	signingKeyId: string;
	payloadSha256: string;
}

interface CIParityScenarioEvidence {
	scenario: RequiredParityScenario;
	providersCompared: CIProvider[];
	commitCount: number;
	unexpectedDiffs: string[];
}

interface CIParityDownstreamRepositoryEvidence {
	repo: string;
	ecosystemProfile: string;
	mergeQueue: boolean;
	parityMatrixVerified: boolean;
	rollbackRehearsed: boolean;
}

interface CIProviderPolicyConfig {
	mode: CIProviderMode;
	trustedPolicyRef: string;
	requiredCheckManifestPath: string;
	authorityConfigPath: string;
}

type CheckOwner = CIProvider | "both" | "neither";

interface RequiredCheckOwnership {
	displayName: string;
	preCutoverOwner: CheckOwner;
	postCutoverOwner: CIProvider;
	violation?: string | undefined;
}

interface RequiredCheckOwnershipReport {
	entries: RequiredCheckOwnership[];
	violations: string[];
}

interface MigrationReport {
	schemaVersion: "ci-migrate-report/v1";
	createdAt: string;
	sourceProvider: CIProvider;
	targetProvider: CIProvider;
	sourceConfigPaths: string[];
	targetConfigPaths: string[];
	requiredChecks: MigrationCheckClassification[];
	requiredCheckNames: string[];
	ownership: RequiredCheckOwnershipReport;
	parity: MigrationParityReport;
	promotionEvidence: PromotionEvidenceReport;
	satisfiability: {
		preCutover: BranchProtectionSatisfiabilityReport;
		postCutover?: BranchProtectionSatisfiabilityReport | undefined;
	};
	summary: {
		translatable: number;
		manualMappingRequired: number;
		unsupportedBlocking: number;
	};
}

type MigrationStateStage =
	| "prepared"
	| "committed"
	| "aborted"
	| "rollback-failed";

interface MigrationPhaseState {
	schemaVersion: "ci-migrate-state/v1";
	snapshotId: string;
	stage: MigrationStateStage;
	sourceProvider: CIProvider;
	targetProvider: CIProvider;
	reportDigest: string;
	requiredChecksDigest: string;
	preCutoverStatus: BranchProtectionSatisfiabilityReport["status"];
	proofPackPayloadSha256?: string | undefined;
	proofPackSignature?: string | undefined;
	createdAt: string;
	updatedAt: string;
}

interface SnapshotAttestation {
	schemaVersion: "ci-migrate-snapshot-attestation/v1";
	snapshotId: string;
	createdAt: string;
	expiresAt: string;
	payloadPath: string;
	payloadDigest: string;
	externalControlPlaneStatePath: string;
	externalControlPlaneStateDigest: string;
	signatureAlgorithm: typeof SNAPSHOT_SIGNATURE_ALGORITHM;
	signingKeyId: string;
}

interface MigrationStateAttestation {
	schemaVersion: "ci-migrate-state-attestation/v1";
	snapshotId: string;
	stage: MigrationStateStage;
	createdAt: string;
	expiresAt: string;
	payloadPath: string;
	payloadDigest: string;
	reportDigest: string;
	requiredChecksDigest: string;
	proofPackPayloadSha256?: string | undefined;
	signatureAlgorithm: typeof STATE_SIGNATURE_ALGORITHM;
	signingKeyId: string;
}

interface BreakGlassApproval {
	schemaVersion: "ci-migrate-break-glass-approval/v1";
	snapshotId: string;
	approvedBy: string;
	reason: string;
	approvedAt: string;
	expiresAt: string;
	allowExpiredSnapshotRestore: boolean;
	allowRollbackWeakening: boolean;
	signatureAlgorithm: typeof SNAPSHOT_SIGNATURE_ALGORITHM;
	signingKeyId: string;
}

interface ExternalControlPlaneStateSnapshot {
	schemaVersion: "ci-migrate-external-control-plane-state/v1";
	snapshotId: string;
	capturedAt: string;
	artifacts: ExternalControlPlaneStateArtifact[];
}

interface ExternalControlPlaneStateArtifact {
	relativePath: string;
	existed: boolean;
	content?: string | undefined;
	contentDigest?: string | undefined;
}

function getSnapshotPath(targetDir: string, snapshotId: string): string {
	return resolve(targetDir, HARNESS_DIR, SNAPSHOT_DIR, `${snapshotId}.json`);
}

function getSnapshotDigestPath(targetDir: string, snapshotId: string): string {
	return resolve(targetDir, HARNESS_DIR, SNAPSHOT_DIR, `${snapshotId}.sha256`);
}

function getSnapshotAttestationPath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.attestation.json`,
	);
}

function getSnapshotSignaturePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.attestation.sig`,
	);
}

function getExternalControlPlaneStatePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.external-control-plane.json`,
	);
}

function getStatePath(targetDir: string, snapshotId: string): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.state.json`,
	);
}

function getStateDigestPath(targetDir: string, snapshotId: string): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.state.sha256`,
	);
}

function getStateSignaturePath(targetDir: string, snapshotId: string): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.state.sig`,
	);
}

function getStateAttestationPath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.state.attestation.json`,
	);
}

function getStateAttestationSignaturePath(
	targetDir: string,
	snapshotId: string,
): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}.state.attestation.sig`,
	);
}

function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

function signContent(content: string, signingKey: string): string {
	return createHmac("sha256", signingKey)
		.update(content, "utf-8")
		.digest("hex");
}

function resolveSnapshotSigningKey():
	| { ok: true; key: string; keyId: string }
	| { ok: false; error: string } {
	const rawKey = env[SNAPSHOT_SIGNING_KEY_ENV];
	if (!rawKey || rawKey.trim().length === 0) {
		return {
			ok: false,
			error: `${SNAPSHOT_SIGNING_KEY_ENV} is required for signed ci-migrate snapshots.`,
		};
	}
	const key = rawKey.trim();
	if (Buffer.byteLength(key, "utf-8") < MIN_SNAPSHOT_SIGNING_KEY_BYTES) {
		return {
			ok: false,
			error: `${SNAPSHOT_SIGNING_KEY_ENV} must be at least ${MIN_SNAPSHOT_SIGNING_KEY_BYTES} bytes.`,
		};
	}
	return { ok: true, key, keyId: hashContent(key).slice(0, 16) };
}

function isValidSnapshotAttestation(
	value: unknown,
	snapshotId: string,
): value is SnapshotAttestation {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<SnapshotAttestation>;
	return (
		parsed.schemaVersion === "ci-migrate-snapshot-attestation/v1" &&
		parsed.snapshotId === snapshotId &&
		typeof parsed.createdAt === "string" &&
		typeof parsed.expiresAt === "string" &&
		typeof parsed.payloadPath === "string" &&
		typeof parsed.payloadDigest === "string" &&
		typeof parsed.externalControlPlaneStatePath === "string" &&
		typeof parsed.externalControlPlaneStateDigest === "string" &&
		parsed.signatureAlgorithm === SNAPSHOT_SIGNATURE_ALGORITHM &&
		typeof parsed.signingKeyId === "string"
	);
}

function isValidExternalControlPlaneStateSnapshot(
	value: unknown,
	snapshotId: string,
): value is ExternalControlPlaneStateSnapshot {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<ExternalControlPlaneStateSnapshot>;
	if (
		parsed.schemaVersion !== "ci-migrate-external-control-plane-state/v1" ||
		parsed.snapshotId !== snapshotId ||
		typeof parsed.capturedAt !== "string" ||
		!Array.isArray(parsed.artifacts)
	) {
		return false;
	}
	return parsed.artifacts.every((artifact) => {
		if (!artifact || typeof artifact !== "object") {
			return false;
		}
		const parsedArtifact =
			artifact as Partial<ExternalControlPlaneStateArtifact>;
		if (
			typeof parsedArtifact.relativePath !== "string" ||
			typeof parsedArtifact.existed !== "boolean" ||
			!EXTERNAL_CONTROL_PLANE_PATH_SET.has(parsedArtifact.relativePath)
		) {
			return false;
		}
		if (parsedArtifact.existed) {
			return (
				typeof parsedArtifact.content === "string" &&
				typeof parsedArtifact.contentDigest === "string"
			);
		}
		return true;
	});
}

function isValidMigrationStateAttestation(
	value: unknown,
	snapshotId: string,
): value is MigrationStateAttestation {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<MigrationStateAttestation>;
	return (
		parsed.schemaVersion === "ci-migrate-state-attestation/v1" &&
		parsed.snapshotId === snapshotId &&
		(parsed.stage === "prepared" ||
			parsed.stage === "committed" ||
			parsed.stage === "aborted" ||
			parsed.stage === "rollback-failed") &&
		typeof parsed.createdAt === "string" &&
		typeof parsed.expiresAt === "string" &&
		typeof parsed.payloadPath === "string" &&
		typeof parsed.payloadDigest === "string" &&
		typeof parsed.reportDigest === "string" &&
		typeof parsed.requiredChecksDigest === "string" &&
		(parsed.proofPackPayloadSha256 === undefined ||
			typeof parsed.proofPackPayloadSha256 === "string") &&
		parsed.signatureAlgorithm === STATE_SIGNATURE_ALGORITHM &&
		typeof parsed.signingKeyId === "string"
	);
}

function isValidBreakGlassApproval(
	value: unknown,
	snapshotId: string,
): value is BreakGlassApproval {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<BreakGlassApproval>;
	return (
		parsed.schemaVersion === "ci-migrate-break-glass-approval/v1" &&
		parsed.snapshotId === snapshotId &&
		typeof parsed.approvedBy === "string" &&
		parsed.approvedBy.trim().length > 0 &&
		typeof parsed.reason === "string" &&
		parsed.reason.trim().length > 0 &&
		typeof parsed.approvedAt === "string" &&
		typeof parsed.expiresAt === "string" &&
		typeof parsed.allowExpiredSnapshotRestore === "boolean" &&
		typeof parsed.allowRollbackWeakening === "boolean" &&
		(parsed.allowExpiredSnapshotRestore || parsed.allowRollbackWeakening) &&
		parsed.signatureAlgorithm === SNAPSHOT_SIGNATURE_ALGORITHM &&
		typeof parsed.signingKeyId === "string"
	);
}

function readBreakGlassApproval(
	targetDir: string,
	approvalPath: string,
	snapshotId: string,
): { ok: true; value: BreakGlassApproval } | { ok: false; error: string } {
	const resolvedPath = resolve(targetDir, approvalPath);
	const signaturePath = `${resolvedPath}.sig`;
	if (!existsSync(resolvedPath)) {
		return {
			ok: false,
			error: `Break-glass approval file not found: ${resolvedPath}`,
		};
	}
	if (!existsSync(signaturePath)) {
		return {
			ok: false,
			error: `Break-glass approval signature is missing: ${signaturePath}`,
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
		const approvalContent = readFileSync(resolvedPath, "utf-8");
		const expectedSignature = readFileSync(signaturePath, "utf-8").trim();
		const actualSignature = signContent(approvalContent, signingKeyResult.key);
		if (
			expectedSignature.length === 0 ||
			expectedSignature !== actualSignature
		) {
			return {
				ok: false,
				error:
					"Break-glass approval signature check failed. Refusing unsigned override.",
			};
		}
		const parsedApproval = JSON.parse(approvalContent) as unknown;
		if (!isValidBreakGlassApproval(parsedApproval, snapshotId)) {
			return {
				ok: false,
				error:
					"Break-glass approval schema is invalid for requested snapshot id.",
			};
		}
		if (parsedApproval.signingKeyId !== signingKeyResult.keyId) {
			return {
				ok: false,
				error:
					"Break-glass approval signing key id does not match active signing key.",
			};
		}
		const approvedAtMs = Date.parse(parsedApproval.approvedAt);
		const expiresAtMs = Date.parse(parsedApproval.expiresAt);
		if (!Number.isFinite(approvedAtMs) || !Number.isFinite(expiresAtMs)) {
			return {
				ok: false,
				error: "Break-glass approval timestamps are invalid.",
			};
		}
		if (expiresAtMs < approvedAtMs) {
			return {
				ok: false,
				error:
					"Break-glass approval expiry is earlier than approval timestamp.",
			};
		}
		if (Date.now() > expiresAtMs) {
			return {
				ok: false,
				error:
					"Break-glass approval is expired. Provide a currently valid approval.",
			};
		}
		return { ok: true, value: parsedApproval };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse break-glass approval: ${sanitizeError(error)}`,
		};
	}
}

function isSafeRestorePath(targetDir: string, relativePath: string): boolean {
	if (!EXTERNAL_CONTROL_PLANE_PATH_SET.has(relativePath)) {
		return false;
	}
	const rootPath = resolve(targetDir);
	const absolutePath = resolve(targetDir, relativePath);
	return (
		absolutePath === rootPath || absolutePath.startsWith(`${rootPath}${sep}`)
	);
}

function captureExternalControlPlaneState(
	targetDir: string,
	snapshotId: string,
): { ok: true; digest: string } | { ok: false; error: string } {
	try {
		const snapshotPath = getExternalControlPlaneStatePath(
			targetDir,
			snapshotId,
		);
		const artifacts: ExternalControlPlaneStateArtifact[] =
			EXTERNAL_CONTROL_PLANE_PATHS.map((relativePath) => {
				const absolutePath = resolve(targetDir, relativePath);
				if (!existsSync(absolutePath)) {
					return {
						relativePath,
						existed: false,
					};
				}
				const content = readFileSync(absolutePath, "utf-8");
				return {
					relativePath,
					existed: true,
					content,
					contentDigest: hashContent(content),
				};
			});
		const snapshot: ExternalControlPlaneStateSnapshot = {
			schemaVersion: "ci-migrate-external-control-plane-state/v1",
			snapshotId,
			capturedAt: new Date().toISOString(),
			artifacts,
		};
		const snapshotContent = JSON.stringify(snapshot, null, 2);
		mkdirSync(dirname(snapshotPath), { recursive: true });
		writeFileSync(snapshotPath, snapshotContent);
		return {
			ok: true,
			digest: hashContent(snapshotContent),
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to capture external control-plane state: ${sanitizeError(error)}`,
		};
	}
}

function restoreExternalControlPlaneState(
	targetDir: string,
	snapshot: ExternalControlPlaneStateSnapshot,
): { ok: true } | { ok: false; error: string } {
	try {
		for (const artifact of snapshot.artifacts) {
			if (!isSafeRestorePath(targetDir, artifact.relativePath)) {
				return {
					ok: false,
					error: `External control-plane artifact path is not allowed: ${artifact.relativePath}`,
				};
			}
			const absolutePath = resolve(targetDir, artifact.relativePath);
			if (!artifact.existed) {
				rmSync(absolutePath, { force: true });
				continue;
			}
			if (
				typeof artifact.content !== "string" ||
				typeof artifact.contentDigest !== "string"
			) {
				return {
					ok: false,
					error: `External control-plane artifact ${artifact.relativePath} is missing required content metadata.`,
				};
			}
			if (hashContent(artifact.content) !== artifact.contentDigest) {
				return {
					ok: false,
					error: `External control-plane artifact ${artifact.relativePath} failed digest validation.`,
				};
			}
			mkdirSync(dirname(absolutePath), { recursive: true });
			writeFileSync(absolutePath, artifact.content);
		}
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to restore external control-plane state: ${sanitizeError(error)}`,
		};
	}
}

function getReportPath(targetDir: string, snapshotId: string): string {
	return resolve(
		targetDir,
		HARNESS_DIR,
		SNAPSHOT_DIR,
		`${snapshotId}${REPORT_SUFFIX}`,
	);
}

function defaultSnapshotId(): string {
	return `snapshot-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function validateSnapshotId(
	value: string,
): { ok: true; value: string } | { ok: false; error: string } {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return {
			ok: false,
			error: "Snapshot id cannot be empty.",
		};
	}
	if (!SNAPSHOT_ID_PATTERN.test(trimmed)) {
		return {
			ok: false,
			error:
				"Snapshot id must start and end with a letter or number and may only include '.', '_' or '-' in the middle.",
		};
	}
	if (trimmed.length > MAX_SNAPSHOT_ID_LENGTH) {
		return {
			ok: false,
			error: `Snapshot id is too long. Maximum length is ${MAX_SNAPSHOT_ID_LENGTH} characters.`,
		};
	}
	if (trimmed.includes("..")) {
		return {
			ok: false,
			error: "Snapshot id cannot contain consecutive dots ('..').",
		};
	}
	return { ok: true, value: trimmed };
}

function isPreparedStateExpired(
	state: MigrationPhaseState,
): { ok: true } | { ok: false; error: string } {
	const updatedAtMs = Date.parse(state.updatedAt);
	if (!Number.isFinite(updatedAtMs)) {
		return {
			ok: false,
			error:
				"Prepared migration state timestamp is invalid. Rerun prepare to re-establish trusted evidence.",
		};
	}
	const maxAgeMs = PREPARED_STATE_MAX_AGE_HOURS * 60 * 60 * 1000;
	const ageMs = Date.now() - updatedAtMs;
	if (ageMs > maxAgeMs) {
		return {
			ok: false,
			error: `Prepared migration state is older than ${PREPARED_STATE_MAX_AGE_HOURS} hours. Rerun prepare before commit.`,
		};
	}
	return { ok: true };
}

function normalizeAction(value: string | undefined):
	| {
			ok: true;
			value: CIMigrateAction | null;
	  }
	| {
			ok: false;
			error: string;
	  } {
	if (!value || value.trim().length === 0) {
		return { ok: true, value: null };
	}
	if (VALID_ACTIONS.includes(value as CIMigrateAction)) {
		return { ok: true, value: value as CIMigrateAction };
	}
	return {
		ok: false,
		error: `Unsupported ci-migrate action: ${value}. Expected prepare, commit, or abort.`,
	};
}

function deriveModeFromAction(
	action: CIMigrateAction | null,
	options: Pick<CIMigrateOptions, "apply" | "rollback" | "dryRun">,
):
	| {
			ok: true;
			value: {
				apply: boolean;
				rollback: boolean;
				dryRun: boolean;
				isExplicitAction: boolean;
			};
	  }
	| {
			ok: false;
			error: string;
	  } {
	if (!action) {
		const apply = options.apply === true;
		const rollback = options.rollback === true;
		const dryRun = options.dryRun === true || (!apply && !rollback);
		return {
			ok: true,
			value: { apply, rollback, dryRun, isExplicitAction: false },
		};
	}

	if (action === "prepare") {
		if (options.apply === true || options.rollback === true) {
			return {
				ok: false,
				error:
					"Action 'prepare' conflicts with --apply/--rollback. Use action alone or --dry-run.",
			};
		}
		return {
			ok: true,
			value: {
				apply: false,
				rollback: false,
				dryRun: true,
				isExplicitAction: true,
			},
		};
	}
	if (action === "commit") {
		if (options.rollback === true || options.dryRun === true) {
			return {
				ok: false,
				error:
					"Action 'commit' conflicts with --rollback/--dry-run. Use action alone or --apply.",
			};
		}
		return {
			ok: true,
			value: {
				apply: true,
				rollback: false,
				dryRun: false,
				isExplicitAction: true,
			},
		};
	}

	if (options.apply === true || options.dryRun === true) {
		return {
			ok: false,
			error:
				"Action 'abort' conflicts with --apply/--dry-run. Use action alone or --rollback.",
		};
	}
	return {
		ok: true,
		value: {
			apply: false,
			rollback: true,
			dryRun: false,
			isExplicitAction: true,
		},
	};
}

function normalizeProvider(value: string | undefined):
	| {
			ok: true;
			value: CIProvider;
	  }
	| {
			ok: false;
			error: string;
	  } {
	if (!value || value.trim().length === 0) {
		return { ok: true, value: DEFAULT_PROVIDER };
	}
	if (VALID_PROVIDERS.includes(value as CIProvider)) {
		return { ok: true, value: value as CIProvider };
	}
	return {
		ok: false,
		error: `Unsupported provider: ${value}. Expected github-actions or circleci.`,
	};
}

function readManifestProvider(targetDir: string): CIProvider | null {
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
	if (!existsSync(manifestPath)) {
		return null;
	}
	try {
		const parsed = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
			ciProvider?: string | undefined;
		};
		if (
			parsed.ciProvider &&
			VALID_PROVIDERS.includes(parsed.ciProvider as CIProvider)
		) {
			return parsed.ciProvider as CIProvider;
		}
	} catch {
		// Best-effort provider detection.
	}
	return null;
}

function readContractProvider(targetDir: string): CIProvider | null {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return null;
	}
	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?: { activeProvider?: string | undefined } | undefined;
		};
		const activeProvider = parsed.ciProviderPolicy?.activeProvider;
		if (
			activeProvider &&
			VALID_PROVIDERS.includes(activeProvider as CIProvider)
		) {
			return activeProvider as CIProvider;
		}
	} catch {
		// Best-effort provider detection.
	}
	return null;
}

function readContractProviderMode(targetDir: string): CIProviderMode | null {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return null;
	}
	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?: { mode?: string | undefined } | undefined;
		};
		const mode = parsed.ciProviderPolicy?.mode;
		if (mode === "shadow" || mode === "required") {
			return mode;
		}
	} catch {
		// Best-effort mode detection.
	}
	return null;
}

function readContractProviderPolicy(
	targetDir: string,
): { ok: true; value: CIProviderPolicyConfig } | { ok: false; error: string } {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return {
			ok: false,
			error:
				"harness.contract.json is required when ciProviderPolicy.mode is required.",
		};
	}
	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			ciProviderPolicy?:
				| {
						mode?: string | undefined;
						trustedPolicyRef?: string | undefined;
						requiredCheckManifestPath?: string | undefined;
						authorityConfigPath?: string | undefined;
				  }
				| undefined;
		};
		const policy = parsed.ciProviderPolicy;
		if (!policy) {
			return {
				ok: false,
				error: "harness.contract.json is missing ciProviderPolicy.",
			};
		}
		if (policy.mode !== "shadow" && policy.mode !== "required") {
			return {
				ok: false,
				error: "ciProviderPolicy.mode must be either shadow or required.",
			};
		}
		if (
			typeof policy.trustedPolicyRef !== "string" ||
			policy.trustedPolicyRef.trim().length === 0
		) {
			return {
				ok: false,
				error:
					"ciProviderPolicy.trustedPolicyRef is required and cannot be empty.",
			};
		}
		if (
			typeof policy.requiredCheckManifestPath !== "string" ||
			policy.requiredCheckManifestPath.trim().length === 0
		) {
			return {
				ok: false,
				error:
					"ciProviderPolicy.requiredCheckManifestPath is required and cannot be empty.",
			};
		}
		if (
			typeof policy.authorityConfigPath !== "string" ||
			policy.authorityConfigPath.trim().length === 0
		) {
			return {
				ok: false,
				error:
					"ciProviderPolicy.authorityConfigPath is required and cannot be empty.",
			};
		}

		return {
			ok: true,
			value: {
				mode: policy.mode,
				trustedPolicyRef: policy.trustedPolicyRef.trim(),
				requiredCheckManifestPath: policy.requiredCheckManifestPath.trim(),
				authorityConfigPath: policy.authorityConfigPath.trim(),
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse harness.contract.json policy metadata: ${sanitizeError(error)}`,
		};
	}
}

function shouldRequirePromotionEvidence(
	targetDir: string,
	targetProvider: CIProvider,
): boolean {
	if (targetProvider !== "circleci") {
		return false;
	}
	return readContractProviderMode(targetDir) === "required";
}

function isCIProviderArray(value: unknown): value is CIProvider[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((entry) => VALID_PROVIDERS.includes(entry as CIProvider))
	);
}

function isRequiredParityScenario(
	value: string,
): value is RequiredParityScenario {
	return REQUIRED_PARITY_SCENARIOS.includes(value as RequiredParityScenario);
}

function isHexDigest(value: string): boolean {
	return SHA256_HEX_PATTERN.test(value);
}

function isCommitSha(value: string): boolean {
	return COMMIT_SHA_PATTERN.test(value);
}

function isHexToken(value: string, minLength = 1): boolean {
	return value.length >= minLength && HEX_TOKEN_PATTERN.test(value);
}

function resolveGitConfigPath(targetDir: string): string | null {
	const gitPath = resolve(targetDir, ".git");
	if (!existsSync(gitPath)) {
		return null;
	}
	try {
		const stat = readFileSync(gitPath, "utf-8");
		const firstLine = stat.split("\n")[0]?.trim() ?? "";
		if (firstLine.startsWith("gitdir:")) {
			const gitDirValue = firstLine.slice("gitdir:".length).trim();
			if (gitDirValue.length === 0) {
				return null;
			}
			const gitDirPath = resolve(targetDir, gitDirValue);
			const configPath = resolve(gitDirPath, "config");
			return existsSync(configPath) ? configPath : null;
		}
		return null;
	} catch {
		const configPath = resolve(gitPath, "config");
		return existsSync(configPath) ? configPath : null;
	}
}

function runGitCommand(
	targetDir: string,
	args: readonly string[],
): { ok: true; stdout: string } | { ok: false; error: string } {
	const result = spawnSync("git", ["-C", targetDir, ...args], {
		encoding: "utf-8",
	});
	if (result.error) {
		return {
			ok: false,
			error: sanitizeError(result.error),
		};
	}
	if (result.status !== 0) {
		const stderr = result.stderr?.toString().trim();
		const output =
			stderr.length > 0 ? stderr : result.stdout?.toString().trim();
		return {
			ok: false,
			error: output.length > 0 ? output : "Git command failed.",
		};
	}
	return {
		ok: true,
		stdout: result.stdout?.toString().trim() ?? "",
	};
}

function resolveGitRefToCommit(
	targetDir: string,
	ref: string,
): { ok: true; commitSha: string } | { ok: false; error: string } {
	if (typeof ref !== "string" || ref.trim().length === 0) {
		return {
			ok: false,
			error: "Git reference cannot be empty.",
		};
	}
	const result = runGitCommand(targetDir, [
		"rev-parse",
		"--verify",
		`${ref.trim()}^{commit}`,
	]);
	if (!result.ok) {
		return {
			ok: false,
			error: `Unable to resolve trusted policy ref ${ref}: ${result.error}`,
		};
	}
	const commitSha = result.stdout.trim();
	if (!isCommitSha(commitSha)) {
		return {
			ok: false,
			error: `Trusted policy ref ${ref} did not resolve to a 40-character commit SHA.`,
		};
	}
	return { ok: true, commitSha };
}

function readFileFromGitCommit(
	targetDir: string,
	commit: string,
	relativePath: string,
): { ok: true; content: string } | { ok: false; error: string } {
	if (!isCommitSha(commit)) {
		return {
			ok: false,
			error: `Invalid commit SHA for git object read: ${commit}`,
		};
	}
	if (relativePath.length === 0) {
		return {
			ok: false,
			error: "Policy file path cannot be empty.",
		};
	}
	const result = runGitCommand(targetDir, [
		"show",
		`${commit}:${relativePath}`,
	]);
	if (!result.ok) {
		return {
			ok: false,
			error: `Failed to read ${relativePath} from commit ${commit}: ${result.error}`,
		};
	}
	return {
		ok: true,
		content: result.stdout,
	};
}

function readHashedPolicyFileFromCommit(
	targetDir: string,
	commit: string,
	relativePath: string,
): { ok: true; digest: string; path: string } | { ok: false; error: string } {
	const contentResult = readFileFromGitCommit(targetDir, commit, relativePath);
	if (!contentResult.ok) {
		return { ok: false, error: contentResult.error };
	}
	const rootPath = resolve(targetDir);
	const absolutePath = resolve(targetDir, relativePath);
	if (
		absolutePath !== rootPath &&
		!absolutePath.startsWith(`${rootPath}${sep}`)
	) {
		return {
			ok: false,
			error: `Policy path escapes repository root: ${relativePath}`,
		};
	}
	return {
		ok: true,
		path: absolutePath,
		digest: hashContent(contentResult.content),
	};
}

function isAncestorCommit(
	targetDir: string,
	ancestor: string,
	descendant: string,
): { ok: true; isAncestor: boolean } | { ok: false; error: string } {
	if (!isCommitSha(ancestor) || !isCommitSha(descendant)) {
		return {
			ok: false,
			error: "isAncestorCommit requires valid commit SHAs.",
		};
	}
	const result = runGitCommand(targetDir, [
		"merge-base",
		"--is-ancestor",
		ancestor,
		descendant,
	]);
	if (result.ok) {
		return { ok: true, isAncestor: true };
	}
	if (result.error === "") {
		return {
			ok: false,
			error: "Unable to verify commit ancestry.",
		};
	}
	if (/exit code 1/i.test(result.error)) {
		return { ok: true, isAncestor: false };
	}
	return {
		ok: false,
		error: `Unable to verify commit ancestry: ${result.error}`,
	};
}

function readGitOriginUrl(targetDir: string): string | null {
	const configPath = resolveGitConfigPath(targetDir);
	if (!configPath) {
		return null;
	}
	const content = readFileSync(configPath, "utf-8");
	const remoteBlockMatch = content.match(
		/\[remote "origin"\]([\s\S]*?)(?:\n\[|$)/,
	);
	if (!remoteBlockMatch) {
		return null;
	}
	const remoteBlock = remoteBlockMatch[1] ?? "";
	const urlMatch = remoteBlock.match(/^\s*url\s*=\s*(.+)\s*$/m);
	if (!urlMatch) {
		return null;
	}
	return urlMatch[1]?.trim() ?? null;
}

function normalizeRepoFullName(originUrl: string): string | null {
	const sshMatch = originUrl.match(
		/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
	);
	if (sshMatch) {
		return `${sshMatch[1]}/${sshMatch[2]}`;
	}
	const httpsMatch = originUrl.match(
		/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/,
	);
	if (httpsMatch) {
		return `${httpsMatch[1]}/${httpsMatch[2]}`;
	}
	return null;
}

function readHashedPolicyFile(
	targetDir: string,
	relativePath: string,
): { ok: true; path: string; digest: string } | { ok: false; error: string } {
	if (relativePath.length === 0) {
		return { ok: false, error: "Policy path cannot be empty." };
	}
	const rootPath = resolve(targetDir);
	const absolutePath = resolve(targetDir, relativePath);
	if (
		absolutePath !== rootPath &&
		!absolutePath.startsWith(`${rootPath}${sep}`)
	) {
		return {
			ok: false,
			error: `Policy path escapes repository root: ${relativePath}`,
		};
	}
	if (!existsSync(absolutePath)) {
		return {
			ok: false,
			error: `Policy file missing for digest binding: ${relativePath}`,
		};
	}
	const content = readFileSync(absolutePath, "utf-8");
	return {
		ok: true,
		path: absolutePath,
		digest: hashContent(content),
	};
}

function isSafeProofArtifactPath(
	targetDir: string,
	relativePath: string,
): boolean {
	const rootPath = resolve(targetDir);
	const absolutePath = resolve(targetDir, relativePath);
	return (
		absolutePath === rootPath || absolutePath.startsWith(`${rootPath}${sep}`)
	);
}

function validateProofPackFreshness(
	generatedAt: string,
): { ok: true } | { ok: false; error: string } {
	const generatedAtMs = Date.parse(generatedAt);
	if (!Number.isFinite(generatedAtMs)) {
		return {
			ok: false,
			error: "Parity proof pack generatedAt must be a valid ISO timestamp.",
		};
	}
	const nowMs = Date.now();
	const maxFutureSkewMs = PARITY_PROOF_PACK_MAX_FUTURE_SKEW_MINUTES * 60 * 1000;
	if (generatedAtMs - nowMs > maxFutureSkewMs) {
		return {
			ok: false,
			error: `Parity proof pack generatedAt is too far in the future (>${PARITY_PROOF_PACK_MAX_FUTURE_SKEW_MINUTES} minutes).`,
		};
	}
	const maxAgeMs = PARITY_PROOF_PACK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
	if (nowMs - generatedAtMs > maxAgeMs) {
		return {
			ok: false,
			error: `Parity proof pack is older than ${PARITY_PROOF_PACK_MAX_AGE_DAYS} days.`,
		};
	}
	return { ok: true };
}

function parseParityProofPack(
	content: string,
): { ok: true; value: CIParityProofPack } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return {
				ok: false,
				error: "Parity proof pack must be a JSON object.",
			};
		}
		const record = parsed as Record<string, unknown>;
		if (record.schemaVersion !== "ci-parity-proof-pack/v2") {
			return {
				ok: false,
				error:
					"Parity proof pack schemaVersion must be ci-parity-proof-pack/v2.",
			};
		}
		if (
			typeof record.generatedAt !== "string" ||
			!Number.isFinite(Date.parse(record.generatedAt))
		) {
			return {
				ok: false,
				error: "Parity proof pack generatedAt must be a valid ISO timestamp.",
			};
		}
		if (record.sourceProvider !== "github-actions") {
			return {
				ok: false,
				error: "Parity proof pack sourceProvider must be github-actions.",
			};
		}
		if (record.targetProvider !== "circleci") {
			return {
				ok: false,
				error: "Parity proof pack targetProvider must be circleci.",
			};
		}
		const repo = record.repo;
		if (!repo || typeof repo !== "object") {
			return {
				ok: false,
				error: "Parity proof pack repo section is required.",
			};
		}
		const repoRecord = repo as Record<string, unknown>;
		if (
			typeof repoRecord.fullName !== "string" ||
			!repoRecord.fullName.includes("/")
		) {
			return {
				ok: false,
				error:
					"Parity proof pack repo.fullName must be a non-empty owner/repo identifier.",
			};
		}
		if (
			typeof repoRecord.originUrl !== "string" ||
			repoRecord.originUrl.trim().length === 0
		) {
			return {
				ok: false,
				error: "Parity proof pack repo.originUrl must be a non-empty string.",
			};
		}
		if (
			typeof repoRecord.trustedPolicyRef !== "string" ||
			repoRecord.trustedPolicyRef.trim().length === 0
		) {
			return {
				ok: false,
				error:
					"Parity proof pack repo.trustedPolicyRef must be a non-empty string.",
			};
		}
		if (
			typeof repoRecord.requiredCheckManifestPath !== "string" ||
			repoRecord.requiredCheckManifestPath.trim().length === 0
		) {
			return {
				ok: false,
				error:
					"Parity proof pack repo.requiredCheckManifestPath must be a non-empty string.",
			};
		}
		if (
			typeof repoRecord.baseSha !== "string" ||
			!isCommitSha(repoRecord.baseSha)
		) {
			return {
				ok: false,
				error:
					"Parity proof pack repo.baseSha must be a 40-character lowercase commit SHA.",
			};
		}
		if (
			typeof repoRecord.headSha !== "string" ||
			!isCommitSha(repoRecord.headSha)
		) {
			return {
				ok: false,
				error:
					"Parity proof pack repo.headSha must be a 40-character lowercase commit SHA.",
			};
		}

		const policyDigests = record.policyDigests;
		if (!policyDigests || typeof policyDigests !== "object") {
			return {
				ok: false,
				error: "Parity proof pack policyDigests section is required.",
			};
		}
		const policyDigestRecord = policyDigests as Record<string, unknown>;
		if (
			typeof policyDigestRecord.authorityConfigSha256 !== "string" ||
			!isHexDigest(policyDigestRecord.authorityConfigSha256)
		) {
			return {
				ok: false,
				error:
					"Parity proof pack policyDigests.authorityConfigSha256 must be a sha256 hex digest.",
			};
		}
		if (
			typeof policyDigestRecord.requiredCheckManifestSha256 !== "string" ||
			!isHexDigest(policyDigestRecord.requiredCheckManifestSha256)
		) {
			return {
				ok: false,
				error:
					"Parity proof pack policyDigests.requiredCheckManifestSha256 must be a sha256 hex digest.",
			};
		}

		const artifacts = record.artifacts;
		if (!Array.isArray(artifacts) || artifacts.length === 0) {
			return {
				ok: false,
				error:
					"Parity proof pack artifacts must be a non-empty array with hash/signature metadata.",
			};
		}
		const parsedArtifacts: CIParityProofPackArtifact[] = [];
		for (const artifact of artifacts) {
			if (!artifact || typeof artifact !== "object") {
				return {
					ok: false,
					error: "Parity proof pack artifact entries must be objects.",
				};
			}
			const artifactRecord = artifact as Record<string, unknown>;
			if (
				typeof artifactRecord.artifactId !== "string" ||
				artifactRecord.artifactId.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity proof pack artifact entries require a non-empty artifactId.",
				};
			}
			if (
				typeof artifactRecord.path !== "string" ||
				artifactRecord.path.trim().length === 0
			) {
				return {
					ok: false,
					error: "Parity proof pack artifact entries require a non-empty path.",
				};
			}
			if (
				typeof artifactRecord.sha256 !== "string" ||
				!isHexDigest(artifactRecord.sha256)
			) {
				return {
					ok: false,
					error:
						"Parity proof pack artifact sha256 values must be sha256 hex digests.",
				};
			}
			if (
				typeof artifactRecord.signature !== "string" ||
				!isHexDigest(artifactRecord.signature)
			) {
				return {
					ok: false,
					error:
						"Parity proof pack artifact signatures must be sha256 hex digests.",
				};
			}
			parsedArtifacts.push({
				artifactId: artifactRecord.artifactId,
				path: artifactRecord.path,
				sha256: artifactRecord.sha256,
				signature: artifactRecord.signature,
			});
		}

		const integrity = record.integrity;
		if (!integrity || typeof integrity !== "object") {
			return {
				ok: false,
				error: "Parity proof pack integrity section is required.",
			};
		}
		const integrityRecord = integrity as Record<string, unknown>;
		if (
			integrityRecord.signatureAlgorithm !==
			PARITY_PROOF_PACK_SIGNATURE_ALGORITHM
		) {
			return {
				ok: false,
				error: `Parity proof pack integrity.signatureAlgorithm must be ${PARITY_PROOF_PACK_SIGNATURE_ALGORITHM}.`,
			};
		}
		if (
			typeof integrityRecord.signingKeyId !== "string" ||
			!isHexToken(integrityRecord.signingKeyId, 8)
		) {
			return {
				ok: false,
				error:
					"Parity proof pack integrity.signingKeyId must be a non-empty hex identifier.",
			};
		}
		if (
			typeof integrityRecord.payloadSha256 !== "string" ||
			!isHexDigest(integrityRecord.payloadSha256)
		) {
			return {
				ok: false,
				error:
					"Parity proof pack integrity.payloadSha256 must be a sha256 hex digest.",
			};
		}

		const behavioralParity = record.behavioralParity;
		if (!behavioralParity || typeof behavioralParity !== "object") {
			return {
				ok: false,
				error: "Parity proof pack behavioralParity section is required.",
			};
		}
		const scenarios = (behavioralParity as Record<string, unknown>).scenarios;
		if (!Array.isArray(scenarios)) {
			return {
				ok: false,
				error: "Parity proof pack behavioralParity.scenarios must be an array.",
			};
		}
		const parsedScenarios: CIParityScenarioEvidence[] = [];
		for (const scenario of scenarios) {
			if (!scenario || typeof scenario !== "object") {
				return {
					ok: false,
					error:
						"Parity proof pack scenario entries must be objects with required fields.",
				};
			}
			const scenarioRecord = scenario as Record<string, unknown>;
			if (
				typeof scenarioRecord.scenario !== "string" ||
				!isRequiredParityScenario(scenarioRecord.scenario)
			) {
				return {
					ok: false,
					error: "Parity proof pack scenarios must use supported scenario ids.",
				};
			}
			if (!isCIProviderArray(scenarioRecord.providersCompared)) {
				return {
					ok: false,
					error:
						"Parity proof pack scenario providersCompared must be a non-empty CI provider array.",
				};
			}
			if (
				typeof scenarioRecord.commitCount !== "number" ||
				!Number.isInteger(scenarioRecord.commitCount) ||
				scenarioRecord.commitCount < 1
			) {
				return {
					ok: false,
					error:
						"Parity proof pack scenario commitCount must be a positive integer.",
				};
			}
			if (
				!Array.isArray(scenarioRecord.unexpectedDiffs) ||
				!scenarioRecord.unexpectedDiffs.every(
					(entry) => typeof entry === "string",
				)
			) {
				return {
					ok: false,
					error:
						"Parity proof pack scenario unexpectedDiffs must be an array of strings.",
				};
			}
			parsedScenarios.push({
				scenario: scenarioRecord.scenario,
				providersCompared: scenarioRecord.providersCompared,
				commitCount: scenarioRecord.commitCount,
				unexpectedDiffs: scenarioRecord.unexpectedDiffs,
			});
		}

		const promotionGate = record.promotionGate;
		if (!promotionGate || typeof promotionGate !== "object") {
			return {
				ok: false,
				error: "Parity proof pack promotionGate section is required.",
			};
		}
		const gateRecord = promotionGate as Record<string, unknown>;
		const requiredGateFields = [
			"zeroUnexpectedDiffs",
			"outcomeParity",
			"skippedSemanticsParity",
			"artifactParity",
			"greptileParity",
			"releaseParity",
		] as const;
		for (const field of requiredGateFields) {
			if (typeof gateRecord[field] !== "boolean") {
				return {
					ok: false,
					error: `Parity proof pack promotionGate.${field} must be a boolean.`,
				};
			}
		}

		const downstream = record.downstream;
		if (!downstream || typeof downstream !== "object") {
			return {
				ok: false,
				error: "Parity proof pack downstream section is required.",
			};
		}
		const repositories = (downstream as Record<string, unknown>).repositories;
		if (!Array.isArray(repositories)) {
			return {
				ok: false,
				error: "Parity proof pack downstream.repositories must be an array.",
			};
		}
		const parsedRepositories: CIParityDownstreamRepositoryEvidence[] = [];
		for (const repository of repositories) {
			if (!repository || typeof repository !== "object") {
				return {
					ok: false,
					error:
						"Parity proof pack downstream repository entries must be objects.",
				};
			}
			const repositoryRecord = repository as Record<string, unknown>;
			if (
				typeof repositoryRecord.repo !== "string" ||
				repositoryRecord.repo.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity proof pack downstream repositories require a non-empty repo field.",
				};
			}
			if (
				typeof repositoryRecord.ecosystemProfile !== "string" ||
				repositoryRecord.ecosystemProfile.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity proof pack downstream repositories require a non-empty ecosystemProfile field.",
				};
			}
			if (
				typeof repositoryRecord.mergeQueue !== "boolean" ||
				typeof repositoryRecord.parityMatrixVerified !== "boolean" ||
				typeof repositoryRecord.rollbackRehearsed !== "boolean"
			) {
				return {
					ok: false,
					error:
						"Parity proof pack downstream repository booleans (mergeQueue, parityMatrixVerified, rollbackRehearsed) are required.",
				};
			}
			parsedRepositories.push({
				repo: repositoryRecord.repo,
				ecosystemProfile: repositoryRecord.ecosystemProfile,
				mergeQueue: repositoryRecord.mergeQueue,
				parityMatrixVerified: repositoryRecord.parityMatrixVerified,
				rollbackRehearsed: repositoryRecord.rollbackRehearsed,
			});
		}

		return {
			ok: true,
			value: {
				schemaVersion: "ci-parity-proof-pack/v2",
				generatedAt: record.generatedAt,
				sourceProvider: "github-actions",
				targetProvider: "circleci",
				repo: {
					fullName: repoRecord.fullName,
					originUrl: repoRecord.originUrl,
					trustedPolicyRef: repoRecord.trustedPolicyRef,
					requiredCheckManifestPath: repoRecord.requiredCheckManifestPath,
					baseSha: repoRecord.baseSha,
					headSha: repoRecord.headSha,
				},
				policyDigests: {
					authorityConfigSha256: policyDigestRecord.authorityConfigSha256,
					requiredCheckManifestSha256:
						policyDigestRecord.requiredCheckManifestSha256,
				},
				artifacts: parsedArtifacts,
				integrity: {
					signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
					signingKeyId: integrityRecord.signingKeyId,
					payloadSha256: integrityRecord.payloadSha256,
				},
				behavioralParity: { scenarios: parsedScenarios },
				promotionGate: {
					zeroUnexpectedDiffs: gateRecord.zeroUnexpectedDiffs as boolean,
					outcomeParity: gateRecord.outcomeParity as boolean,
					skippedSemanticsParity: gateRecord.skippedSemanticsParity as boolean,
					artifactParity: gateRecord.artifactParity as boolean,
					greptileParity: gateRecord.greptileParity as boolean,
					releaseParity: gateRecord.releaseParity as boolean,
				},
				downstream: { repositories: parsedRepositories },
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse parity proof pack JSON: ${sanitizeError(error)}`,
		};
	}
}

function canonicalizeParityProofPackForDigest(
	proofPack: CIParityProofPack,
): string {
	return JSON.stringify({
		schemaVersion: proofPack.schemaVersion,
		generatedAt: proofPack.generatedAt,
		sourceProvider: proofPack.sourceProvider,
		targetProvider: proofPack.targetProvider,
		repo: {
			fullName: proofPack.repo.fullName,
			originUrl: proofPack.repo.originUrl,
			trustedPolicyRef: proofPack.repo.trustedPolicyRef,
			requiredCheckManifestPath: proofPack.repo.requiredCheckManifestPath,
			baseSha: proofPack.repo.baseSha,
			headSha: proofPack.repo.headSha,
		},
		policyDigests: {
			authorityConfigSha256: proofPack.policyDigests.authorityConfigSha256,
			requiredCheckManifestSha256:
				proofPack.policyDigests.requiredCheckManifestSha256,
		},
		artifacts: proofPack.artifacts.map((artifact) => ({
			artifactId: artifact.artifactId,
			path: artifact.path,
			sha256: artifact.sha256,
			signature: artifact.signature,
		})),
		behavioralParity: {
			scenarios: proofPack.behavioralParity.scenarios.map((scenario) => ({
				scenario: scenario.scenario,
				providersCompared: [...scenario.providersCompared],
				commitCount: scenario.commitCount,
				unexpectedDiffs: [...scenario.unexpectedDiffs],
			})),
		},
		promotionGate: {
			zeroUnexpectedDiffs: proofPack.promotionGate.zeroUnexpectedDiffs,
			outcomeParity: proofPack.promotionGate.outcomeParity,
			skippedSemanticsParity: proofPack.promotionGate.skippedSemanticsParity,
			artifactParity: proofPack.promotionGate.artifactParity,
			greptileParity: proofPack.promotionGate.greptileParity,
			releaseParity: proofPack.promotionGate.releaseParity,
		},
		downstream: {
			repositories: proofPack.downstream.repositories.map((repository) => ({
				repo: repository.repo,
				ecosystemProfile: repository.ecosystemProfile,
				mergeQueue: repository.mergeQueue,
				parityMatrixVerified: repository.parityMatrixVerified,
				rollbackRehearsed: repository.rollbackRehearsed,
			})),
		},
		integrity: {
			signatureAlgorithm: proofPack.integrity.signatureAlgorithm,
			signingKeyId: proofPack.integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function evaluatePromotionEvidence(
	targetDir: string,
	targetProvider: CIProvider,
): PromotionEvidenceReport {
	const proofPackPath = resolve(targetDir, PARITY_PROOF_PACK_PATH);
	const signaturePath = resolve(targetDir, PARITY_PROOF_PACK_SIGNATURE_PATH);
	let proofPackPayloadSha256: string | undefined;
	let proofPackSignature: string | undefined;
	const required = shouldRequirePromotionEvidence(targetDir, targetProvider);
	if (!required) {
		return {
			required,
			status: "not-required",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [],
		};
	}
	if (!existsSync(proofPackPath)) {
		return {
			required,
			status: "missing",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [
				`Missing required parity proof pack: ${PARITY_PROOF_PACK_PATH}`,
			],
		};
	}
	if (!existsSync(signaturePath)) {
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [
				`Missing required parity proof pack signature: ${PARITY_PROOF_PACK_SIGNATURE_PATH}`,
			],
		};
	}
	const policyResult = readContractProviderPolicy(targetDir);
	if (!policyResult.ok) {
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [policyResult.error],
		};
	}
	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [signingKeyResult.error],
		};
	}

	let proofPackContent = "";
	let sidecarSignature = "";
	try {
		proofPackContent = readFileSync(proofPackPath, "utf-8");
		sidecarSignature = readFileSync(signaturePath, "utf-8").trim();
	} catch (error) {
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [
				`Failed to read parity proof pack trust artifacts: ${sanitizeError(error)}`,
			],
		};
	}
	if (!isHexDigest(sidecarSignature)) {
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [
				`Parity proof pack signature must be a sha256 hex digest: ${PARITY_PROOF_PACK_SIGNATURE_PATH}`,
			],
		};
	}
	const expectedSidecarSignature = signContent(
		proofPackContent,
		signingKeyResult.key,
	);
	if (expectedSidecarSignature !== sidecarSignature) {
		proofPackSignature = sidecarSignature;
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [
				"Parity proof pack signature mismatch. Refusing unsigned or tampered promotion evidence.",
			],
		};
	}
	proofPackSignature = sidecarSignature;

	const parsedResult = parseParityProofPack(proofPackContent);
	if (!parsedResult.ok) {
		return {
			required,
			status: "insufficient",
			proofPackPath,
			proofPackPayloadSha256,
			proofPackSignature,
			violations: [parsedResult.error],
		};
	}

	const proofPack = parsedResult.value;
	const violations: string[] = [];
	proofPackPayloadSha256 = proofPack.integrity.payloadSha256;
	const trustedPolicyRefResult = resolveGitRefToCommit(
		targetDir,
		policyResult.value.trustedPolicyRef,
	);
	const trustedPolicyRefCommit = trustedPolicyRefResult.ok
		? trustedPolicyRefResult.commitSha
		: null;
	const freshnessResult = validateProofPackFreshness(proofPack.generatedAt);
	if (!freshnessResult.ok) {
		violations.push(freshnessResult.error);
	}
	if (
		proofPack.integrity.signatureAlgorithm !==
		PARITY_PROOF_PACK_SIGNATURE_ALGORITHM
	) {
		violations.push(
			`Parity proof pack integrity signature algorithm must be ${PARITY_PROOF_PACK_SIGNATURE_ALGORITHM}.`,
		);
	}
	const payloadSha256 = hashContent(
		canonicalizeParityProofPackForDigest(proofPack),
	);
	if (proofPack.integrity.payloadSha256 !== payloadSha256) {
		violations.push(
			"Parity proof pack integrity payloadSha256 does not match signed payload.",
		);
	}
	if (proofPack.integrity.signingKeyId !== signingKeyResult.keyId) {
		violations.push(
			"Parity proof pack integrity signingKeyId does not match active signing key.",
		);
	}
	if (!trustedPolicyRefResult.ok) {
		violations.push(trustedPolicyRefResult.error);
	}
	if (proofPack.repo.trustedPolicyRef !== policyResult.value.trustedPolicyRef) {
		violations.push(
			`Parity proof pack trustedPolicyRef (${proofPack.repo.trustedPolicyRef}) does not match ciProviderPolicy.trustedPolicyRef (${policyResult.value.trustedPolicyRef}).`,
		);
	}
	if (
		proofPack.repo.requiredCheckManifestPath !==
		policyResult.value.requiredCheckManifestPath
	) {
		violations.push(
			`Parity proof pack requiredCheckManifestPath (${proofPack.repo.requiredCheckManifestPath}) does not match ciProviderPolicy.requiredCheckManifestPath (${policyResult.value.requiredCheckManifestPath}).`,
		);
	}
	if (
		!isCommitSha(proofPack.repo.baseSha) ||
		!isCommitSha(proofPack.repo.headSha)
	) {
		violations.push(
			"Parity proof pack repo base/head SHAs must be 40-character lowercase commit SHAs.",
		);
	}
	if (proofPack.repo.baseSha === proofPack.repo.headSha) {
		violations.push(
			"Parity proof pack repo baseSha and headSha must differ to prove cross-commit comparison.",
		);
	}
	if (trustedPolicyRefCommit) {
		const trustedRefToHeadResult = isAncestorCommit(
			targetDir,
			trustedPolicyRefCommit,
			proofPack.repo.headSha,
		);
		if (!trustedRefToHeadResult.ok) {
			violations.push(
				`Unable to verify trustedPolicyRef ancestry against proof-pack headSha: ${trustedRefToHeadResult.error}`,
			);
		} else if (!trustedRefToHeadResult.isAncestor) {
			violations.push(
				"trustedPolicyRef in ciProviderPolicy must be an ancestor of proof-pack headSha.",
			);
		}
	}
	const baseToHeadResult = isAncestorCommit(
		targetDir,
		proofPack.repo.baseSha,
		proofPack.repo.headSha,
	);
	if (!baseToHeadResult.ok) {
		violations.push(
			`Unable to verify parity proof pack base/head ancestry: ${baseToHeadResult.error}`,
		);
	} else if (!baseToHeadResult.isAncestor) {
		violations.push(
			"Parity proof pack baseSha must be an ancestor of headSha.",
		);
	}

	const authorityDigestResult = readHashedPolicyFile(
		targetDir,
		policyResult.value.authorityConfigPath,
	);
	const authorityHeadDigestResult = readHashedPolicyFileFromCommit(
		targetDir,
		proofPack.repo.headSha,
		policyResult.value.authorityConfigPath,
	);
	if (!authorityDigestResult.ok) {
		violations.push(authorityDigestResult.error);
	} else if (
		proofPack.policyDigests.authorityConfigSha256 !==
		(authorityHeadDigestResult.ok ? authorityHeadDigestResult.digest : "")
	) {
		violations.push(
			"Parity proof pack authorityConfigSha256 does not match repository policy at proof-pack head commit.",
		);
	}
	const requiredManifestDigestResult = readHashedPolicyFile(
		targetDir,
		policyResult.value.requiredCheckManifestPath,
	);
	const requiredManifestHeadDigestResult = readHashedPolicyFileFromCommit(
		targetDir,
		proofPack.repo.headSha,
		policyResult.value.requiredCheckManifestPath,
	);
	if (!requiredManifestDigestResult.ok) {
		violations.push(requiredManifestDigestResult.error);
	} else if (
		proofPack.policyDigests.requiredCheckManifestSha256 !==
		(requiredManifestHeadDigestResult.ok
			? requiredManifestHeadDigestResult.digest
			: "")
	) {
		violations.push(
			"Parity proof pack requiredCheckManifestSha256 does not match repository policy at proof-pack head commit.",
		);
	}

	const originUrl = readGitOriginUrl(targetDir);
	if (!originUrl) {
		violations.push(
			"Git origin URL is not available; cannot verify parity proof pack repository binding.",
		);
	} else {
		if (originUrl !== proofPack.repo.originUrl) {
			violations.push(
				`Parity proof pack originUrl (${proofPack.repo.originUrl}) does not match repository origin (${originUrl}).`,
			);
		}
		const normalizedOriginRepo = normalizeRepoFullName(originUrl);
		if (!normalizedOriginRepo) {
			violations.push(
				`Repository origin URL is unsupported for repo binding verification: ${originUrl}`,
			);
		} else if (normalizedOriginRepo !== proofPack.repo.fullName) {
			violations.push(
				`Parity proof pack repo.fullName (${proofPack.repo.fullName}) does not match repository origin identity (${normalizedOriginRepo}).`,
			);
		}
	}

	const artifactIds = new Set<string>();
	const artifactPaths = new Set<string>();
	for (const artifact of proofPack.artifacts) {
		if (artifactIds.has(artifact.artifactId)) {
			violations.push(
				`Parity proof pack artifactId must be unique. Duplicate: ${artifact.artifactId}.`,
			);
		}
		artifactIds.add(artifact.artifactId);
		if (artifactPaths.has(artifact.path)) {
			violations.push(
				`Parity proof pack artifact paths must be unique. Duplicate: ${artifact.path}.`,
			);
		}
		artifactPaths.add(artifact.path);
		if (!isSafeProofArtifactPath(targetDir, artifact.path)) {
			violations.push(
				`Parity proof pack artifact path escapes repository root: ${artifact.path}.`,
			);
			continue;
		}
		const artifactAbsolutePath = resolve(targetDir, artifact.path);
		if (!existsSync(artifactAbsolutePath)) {
			violations.push(
				`Parity proof artifact missing from repository: ${artifact.path}.`,
			);
			continue;
		}
		const artifactContent = readFileSync(artifactAbsolutePath, "utf-8");
		const actualArtifactDigest = hashContent(artifactContent);
		if (actualArtifactDigest !== artifact.sha256) {
			violations.push(
				`Parity proof artifact digest mismatch for ${artifact.path}.`,
			);
		}
		const expectedArtifactSignature = signContent(
			`${artifact.path}:${artifact.sha256}`,
			signingKeyResult.key,
		);
		if (expectedArtifactSignature !== artifact.signature) {
			violations.push(
				`Parity proof artifact signature mismatch for ${artifact.path}.`,
			);
		}
	}

	const scenariosById = new Map(
		proofPack.behavioralParity.scenarios.map((scenario) => [
			scenario.scenario,
			scenario,
		]),
	);
	if (scenariosById.size !== proofPack.behavioralParity.scenarios.length) {
		violations.push(
			"Parity proof pack behavioralParity.scenarios contains duplicate scenario entries.",
		);
	}
	for (const requiredScenario of REQUIRED_PARITY_SCENARIOS) {
		const scenario = scenariosById.get(requiredScenario);
		if (!scenario) {
			violations.push(`Missing parity scenario evidence: ${requiredScenario}.`);
			continue;
		}
		if (
			!scenario.providersCompared.includes("github-actions") ||
			!scenario.providersCompared.includes("circleci")
		) {
			violations.push(
				`Parity scenario ${requiredScenario} must compare github-actions and circleci results.`,
			);
		}
		if (scenario.unexpectedDiffs.length > 0) {
			violations.push(
				`Parity scenario ${requiredScenario} has unexpected diffs: ${scenario.unexpectedDiffs.join(", ")}.`,
			);
		}
	}

	if (
		proofPack.promotionGate.zeroUnexpectedDiffs !== true ||
		proofPack.promotionGate.outcomeParity !== true ||
		proofPack.promotionGate.skippedSemanticsParity !== true ||
		proofPack.promotionGate.artifactParity !== true ||
		proofPack.promotionGate.greptileParity !== true ||
		proofPack.promotionGate.releaseParity !== true
	) {
		violations.push(
			"Promotion gate booleans must all be true (zeroUnexpectedDiffs, outcomeParity, skippedSemanticsParity, artifactParity, greptileParity, releaseParity).",
		);
	}

	const uniqueRepos = new Set(
		proofPack.downstream.repositories.map((repository) => repository.repo),
	);
	if (uniqueRepos.size < MIN_PARITY_DOWNSTREAM_REPOS) {
		violations.push(
			`Downstream proof requires at least ${MIN_PARITY_DOWNSTREAM_REPOS} repositories.`,
		);
	}
	const uniqueProfiles = new Set(
		proofPack.downstream.repositories.map(
			(repository) => repository.ecosystemProfile,
		),
	);
	if (uniqueProfiles.size < MIN_PARITY_ECOSYSTEM_PROFILES) {
		violations.push(
			`Downstream proof requires at least ${MIN_PARITY_ECOSYSTEM_PROFILES} ecosystem profiles.`,
		);
	}
	if (
		!proofPack.downstream.repositories.some(
			(repository) => repository.mergeQueue,
		)
	) {
		violations.push(
			"Downstream proof requires at least one merge-queue-enabled repository.",
		);
	}
	for (const repository of proofPack.downstream.repositories) {
		if (!repository.parityMatrixVerified) {
			violations.push(
				`Downstream repository ${repository.repo} is missing parity matrix verification evidence.`,
			);
		}
		if (!repository.rollbackRehearsed) {
			violations.push(
				`Downstream repository ${repository.repo} is missing rollback rehearsal evidence.`,
			);
		}
	}

	return {
		required,
		status: violations.length > 0 ? "insufficient" : "verified",
		proofPackPath,
		proofPackPayloadSha256,
		proofPackSignature,
		violations,
	};
}

function detectSourceProvider(targetDir: string): CIProvider {
	const manifestProvider = readManifestProvider(targetDir);
	if (manifestProvider) {
		return manifestProvider;
	}
	const contractProvider = readContractProvider(targetDir);
	if (contractProvider) {
		return contractProvider;
	}
	if (existsSync(resolve(targetDir, ".circleci/config.yml"))) {
		return "circleci";
	}
	return "github-actions";
}

function classifyChecks(
	requiredChecks: RequiredCheckIdentity[],
	sourceConfigPaths: string[],
): MigrationCheckClassification[] {
	if (requiredChecks.length === 0) {
		return [
			{
				displayName: "all-required-checks",
				classification: "unsupported-blocking",
				reason:
					"No required checks discovered. Import into .harness/ci-required-checks.json before apply.",
			},
		];
	}

	if (sourceConfigPaths.length === 0) {
		return requiredChecks.map((check) => ({
			displayName: check.displayName,
			classification: "manual-mapping-required",
			reason:
				"Source provider config not found in repo. Manual mapping evidence is required before apply.",
		}));
	}

	return requiredChecks.map((check) => {
		if (check.displayName.startsWith("shadow/")) {
			return {
				displayName: check.displayName,
				classification: "unsupported-blocking" as const,
				reason:
					"Required checks may not use the shadow/* namespace. Reclassify this check before apply.",
			};
		}
		return {
			displayName: check.displayName,
			classification: "translatable" as const,
			reason: "Check identity can be migrated without renaming displayName.",
		};
	});
}

function readAllRequiredChecks(targetDir: string):
	| {
			ok: true;
			value: RequiredCheckIdentity[];
	  }
	| {
			ok: false;
			error: string;
	  } {
	const requiredChecksPath = resolve(
		targetDir,
		HARNESS_DIR,
		"ci-required-checks.json",
	);
	if (!existsSync(requiredChecksPath)) {
		return {
			ok: false,
			error:
				"Required checks manifest missing: .harness/ci-required-checks.json",
		};
	}
	try {
		const parsed = JSON.parse(readFileSync(requiredChecksPath, "utf-8")) as {
			requiredChecks?: unknown;
		};
		if (!Array.isArray(parsed.requiredChecks)) {
			return {
				ok: false,
				error:
					"Required checks manifest must define requiredChecks as an array.",
			};
		}
		const checks = parsed.requiredChecks;
		const validChecks = checks.filter(
			(check): check is RequiredCheckIdentity => {
				if (!check || typeof check !== "object") {
					return false;
				}
				const record = check as Record<string, unknown>;
				return (
					typeof record.policyId === "string" &&
					typeof record.displayName === "string" &&
					typeof record.sourceAppSlug === "string" &&
					typeof record.sourceAppId === "string" &&
					typeof record.externalIdPattern === "string" &&
					(record.class === "required" ||
						record.class === "informational" ||
						record.class === "shadow")
				);
			},
		);
		if (validChecks.length !== checks.length) {
			return {
				ok: false,
				error:
					"Required checks manifest contains invalid check entries. Refusing to ignore malformed migration evidence.",
			};
		}
		return {
			ok: true,
			value: validChecks.filter((check) => check.class === "required"),
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse required checks manifest: ${sanitizeError(error)}`,
		};
	}
}

function normalizeCheckProviders(check: RequiredCheckIdentity): CIProvider[] {
	const providers = new Set<CIProvider>();
	if (
		check.sourceAppSlug === "github-actions" ||
		check.sourceAppId === "github-actions"
	) {
		providers.add("github-actions");
	}
	if (check.sourceAppSlug === "circleci" || check.sourceAppId === "circleci") {
		providers.add("circleci");
	}
	return [...providers];
}

function buildOwnershipReport(
	requiredChecks: RequiredCheckIdentity[],
	targetProvider: CIProvider,
): RequiredCheckOwnershipReport {
	const checksByDisplayName = new Map<
		string,
		{ providers: Set<CIProvider>; hasUnknownProviderMetadata: boolean }
	>();

	for (const check of requiredChecks) {
		const existing = checksByDisplayName.get(check.displayName) ?? {
			providers: new Set<CIProvider>(),
			hasUnknownProviderMetadata: false,
		};
		const providers = normalizeCheckProviders(check);
		if (providers.length === 0) {
			existing.hasUnknownProviderMetadata = true;
		}
		for (const provider of providers) {
			existing.providers.add(provider);
		}
		checksByDisplayName.set(check.displayName, existing);
	}

	const entries: RequiredCheckOwnership[] = [...checksByDisplayName.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([displayName, state]) => {
			let preCutoverOwner: CheckOwner = "neither";
			if (state.providers.size > 1) {
				preCutoverOwner = "both";
			} else if (state.providers.size === 1) {
				preCutoverOwner = [...state.providers][0] as CIProvider;
			}

			let violation: string | undefined;
			if (preCutoverOwner === "both") {
				violation =
					"Required check is emitted by both providers; migration ownership is ambiguous.";
			} else if (preCutoverOwner === "neither") {
				violation =
					"Required check has no recognized provider owner; migration would leave required checks unsatisfied.";
			} else if (state.hasUnknownProviderMetadata) {
				violation =
					"Required check has mixed/unknown provider metadata; ownership map is not trustworthy.";
			}

			return {
				displayName,
				preCutoverOwner,
				postCutoverOwner: targetProvider,
				violation,
			};
		});

	return {
		entries,
		violations: entries
			.filter((entry) => entry.violation)
			.map((entry) => `${entry.displayName}: ${entry.violation}`),
	};
}

function toRequiredCheckNames(
	requiredChecks: RequiredCheckIdentity[],
): string[] {
	return [...new Set(requiredChecks.map((check) => check.displayName))].sort();
}

function buildMigrationReport(
	targetDir: string,
	sourceProvider: CIProvider,
	targetProvider: CIProvider,
):
	| {
			ok: true;
			value: MigrationReport;
	  }
	| {
			ok: false;
			error: string;
	  } {
	const sourceAdapter = createCIProviderAdapter(sourceProvider);
	const targetAdapter = createCIProviderAdapter(targetProvider);
	const sourceConfigPaths = sourceAdapter.discoverConfigPaths(targetDir);
	const targetConfigPaths = targetAdapter.discoverConfigPaths(targetDir);
	const checksResult = sourceAdapter.readRequiredChecks(targetDir);
	if (!checksResult.ok) {
		return { ok: false, error: checksResult.error };
	}
	const targetChecksResult = targetAdapter.readRequiredChecks(targetDir);
	if (!targetChecksResult.ok) {
		return { ok: false, error: targetChecksResult.error };
	}
	const allRequiredChecksResult = readAllRequiredChecks(targetDir);
	if (!allRequiredChecksResult.ok) {
		return { ok: false, error: allRequiredChecksResult.error };
	}

	const requiredChecks = classifyChecks(checksResult.value, sourceConfigPaths);
	const requiredCheckNames = toRequiredCheckNames(
		allRequiredChecksResult.value,
	);
	const ownership = buildOwnershipReport(
		allRequiredChecksResult.value,
		targetProvider,
	);
	const promotionEvidence = evaluatePromotionEvidence(
		targetDir,
		targetProvider,
	);
	const summary = {
		translatable: requiredChecks.filter(
			(check) => check.classification === "translatable",
		).length,
		manualMappingRequired: requiredChecks.filter(
			(check) => check.classification === "manual-mapping-required",
		).length,
		unsupportedBlocking: requiredChecks.filter(
			(check) => check.classification === "unsupported-blocking",
		).length,
	};

	// Current implementation uses displayName invariance as the parity baseline.
	const sourceDisplayNames = new Set(
		checksResult.value.map((check) => check.displayName),
	);
	const targetDisplayNames = new Set(
		targetChecksResult.value.map((check) => check.displayName),
	);
	const unexpectedDiffs = [...sourceDisplayNames].filter(
		(name) => !targetDisplayNames.has(name),
	);
	const preCutoverSatisfiability = scanOpenPullRequestSatisfiability(
		targetDir,
		allRequiredChecksResult.value,
	);

	return {
		ok: true,
		value: {
			schemaVersion: "ci-migrate-report/v1",
			createdAt: new Date().toISOString(),
			sourceProvider,
			targetProvider,
			sourceConfigPaths,
			targetConfigPaths,
			requiredChecks,
			requiredCheckNames,
			ownership,
			parity: {
				status: unexpectedDiffs.length > 0 ? "drift" : "parity",
				unexpectedDiffs,
			},
			promotionEvidence,
			satisfiability: {
				preCutover: preCutoverSatisfiability,
			},
			summary,
		},
	};
}

function writeSnapshot(targetDir: string, snapshotId: string): number {
	const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
	if (!existsSync(manifestPath)) {
		console.error(
			"Error: restore manifest missing before apply; cannot snapshot.",
		);
		return EXIT_CODES.WRITE_ERROR;
	}

	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		console.error(`Error: ${signingKeyResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}

	try {
		const snapshotPath = getSnapshotPath(targetDir, snapshotId);
		const digestPath = getSnapshotDigestPath(targetDir, snapshotId);
		const attestationPath = getSnapshotAttestationPath(targetDir, snapshotId);
		const signaturePath = getSnapshotSignaturePath(targetDir, snapshotId);
		const externalStateCaptureResult = captureExternalControlPlaneState(
			targetDir,
			snapshotId,
		);
		if (!externalStateCaptureResult.ok) {
			console.error(`Error: ${externalStateCaptureResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		mkdirSync(join(targetDir, HARNESS_DIR, SNAPSHOT_DIR), {
			recursive: true,
		});
		copyFileSync(manifestPath, snapshotPath);
		const content = readFileSync(snapshotPath, "utf-8");
		const payloadDigest = hashContent(content);
		const now = Date.now();
		const expiresAt = new Date(
			now + MAX_SNAPSHOT_AGE_DAYS * 24 * 60 * 60 * 1000,
		).toISOString();
		const attestation: SnapshotAttestation = {
			schemaVersion: "ci-migrate-snapshot-attestation/v1",
			snapshotId,
			createdAt: new Date(now).toISOString(),
			expiresAt,
			payloadPath: `${snapshotId}.json`,
			payloadDigest,
			externalControlPlaneStatePath: `${snapshotId}.external-control-plane.json`,
			externalControlPlaneStateDigest: externalStateCaptureResult.digest,
			signatureAlgorithm: SNAPSHOT_SIGNATURE_ALGORITHM,
			signingKeyId: signingKeyResult.keyId,
		};
		const attestationContent = JSON.stringify(attestation, null, 2);
		const signature = signContent(attestationContent, signingKeyResult.key);
		writeFileSync(digestPath, `${payloadDigest}\n`);
		writeFileSync(attestationPath, attestationContent);
		writeFileSync(signaturePath, `${signature}\n`);
		console.info(`Snapshot saved: ${snapshotPath}`);
		return EXIT_CODES.SUCCESS;
	} catch (error) {
		console.error(`Error: failed to write snapshot: ${sanitizeError(error)}`);
		return EXIT_CODES.WRITE_ERROR;
	}
}

function restoreSnapshot(
	targetDir: string,
	snapshotId: string,
	breakGlassApproval?: BreakGlassApproval,
): number {
	const snapshotPath = getSnapshotPath(targetDir, snapshotId);
	const digestPath = getSnapshotDigestPath(targetDir, snapshotId);
	const attestationPath = getSnapshotAttestationPath(targetDir, snapshotId);
	const signaturePath = getSnapshotSignaturePath(targetDir, snapshotId);
	const externalStatePath = getExternalControlPlaneStatePath(
		targetDir,
		snapshotId,
	);
	if (!existsSync(snapshotPath)) {
		console.error(`Error: snapshot not found: ${snapshotPath}`);
		return EXIT_CODES.INVALID_PATH;
	}
	if (!existsSync(digestPath)) {
		console.error(
			`Error: snapshot digest missing: ${digestPath}. Refusing restore without integrity metadata.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}
	if (!existsSync(attestationPath)) {
		console.error(
			`Error: snapshot attestation missing: ${attestationPath}. Refusing restore without signed trust metadata.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}
	if (!existsSync(signaturePath)) {
		console.error(
			`Error: snapshot attestation signature missing: ${signaturePath}. Refusing restore without signed trust metadata.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}
	if (!existsSync(externalStatePath)) {
		console.error(
			`Error: external control-plane snapshot missing: ${externalStatePath}. Refusing restore without rollback metadata.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}

	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		console.error(`Error: ${signingKeyResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}

	try {
		const attestationContent = readFileSync(attestationPath, "utf-8");
		const expectedSignature = readFileSync(signaturePath, "utf-8").trim();
		const actualSignature = signContent(
			attestationContent,
			signingKeyResult.key,
		);
		if (
			expectedSignature.length === 0 ||
			expectedSignature !== actualSignature
		) {
			console.error(
				"Error: snapshot attestation signature check failed. Refusing restore from tampered trust metadata.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		const parsedAttestation = JSON.parse(attestationContent) as unknown;
		if (!isValidSnapshotAttestation(parsedAttestation, snapshotId)) {
			console.error(
				"Error: snapshot attestation schema is invalid for requested snapshot id.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		if (parsedAttestation.signingKeyId !== signingKeyResult.keyId) {
			console.error(
				"Error: snapshot attestation signing key id does not match active signing key.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		const createdAtMs = Date.parse(parsedAttestation.createdAt);
		const expiresAtMs = Date.parse(parsedAttestation.expiresAt);
		if (!Number.isFinite(createdAtMs) || !Number.isFinite(expiresAtMs)) {
			console.error(
				"Error: snapshot attestation timestamps are invalid. Refusing restore.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		if (expiresAtMs < createdAtMs) {
			console.error(
				"Error: snapshot attestation expiry is earlier than creation time. Refusing restore.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		if (Date.now() > expiresAtMs) {
			if (!breakGlassApproval?.allowExpiredSnapshotRestore) {
				console.error(
					`Error: snapshot attestation expired. Refusing rollback older than ${MAX_SNAPSHOT_AGE_DAYS} days without break-glass override.`,
				);
				return EXIT_CODES.INVALID_PATH;
			}
			console.warn(
				`Warning: snapshot attestation is expired; proceeding under break-glass approval by ${breakGlassApproval.approvedBy}.`,
			);
		}
		const content = readFileSync(snapshotPath, "utf-8");
		const expectedDigest = readFileSync(digestPath, "utf-8").trim();
		const actualDigest = hashContent(content);
		if (expectedDigest.length === 0 || expectedDigest !== actualDigest) {
			console.error(
				"Error: snapshot integrity check failed. Refusing restore from tampered snapshot.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		if (parsedAttestation.payloadDigest !== actualDigest) {
			console.error(
				"Error: snapshot payload digest does not match signed attestation metadata.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		if (parsedAttestation.payloadPath !== `${snapshotId}.json`) {
			console.error(
				"Error: snapshot attestation payload path does not match expected snapshot artifact.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		if (
			parsedAttestation.externalControlPlaneStatePath !==
			`${snapshotId}.external-control-plane.json`
		) {
			console.error(
				"Error: snapshot attestation external state path does not match expected artifact.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		const externalStateContent = readFileSync(externalStatePath, "utf-8");
		if (
			hashContent(externalStateContent) !==
			parsedAttestation.externalControlPlaneStateDigest
		) {
			console.error(
				"Error: external control-plane snapshot digest does not match signed attestation metadata.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		const parsedExternalState = JSON.parse(externalStateContent) as unknown;
		if (
			!isValidExternalControlPlaneStateSnapshot(parsedExternalState, snapshotId)
		) {
			console.error(
				"Error: external control-plane snapshot schema is invalid for requested snapshot id.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		const manifestPath = resolve(targetDir, HARNESS_DIR, MANIFEST_FILE);
		mkdirSync(resolve(targetDir, HARNESS_DIR), { recursive: true });
		writeFileSync(manifestPath, content);
		const externalRestoreResult = restoreExternalControlPlaneState(
			targetDir,
			parsedExternalState,
		);
		if (!externalRestoreResult.ok) {
			console.error(`Error: ${externalRestoreResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		return EXIT_CODES.SUCCESS;
	} catch (error) {
		console.error(`Error: failed to restore snapshot: ${sanitizeError(error)}`);
		return EXIT_CODES.WRITE_ERROR;
	}
}

function writeMigrationReport(
	targetDir: string,
	snapshotId: string,
	report: MigrationReport,
): number {
	try {
		const reportPath = getReportPath(targetDir, snapshotId);
		mkdirSync(join(targetDir, HARNESS_DIR, SNAPSHOT_DIR), {
			recursive: true,
		});
		writeFileSync(reportPath, JSON.stringify(report, null, 2));
		console.info(`Migration report saved: ${reportPath}`);
		return EXIT_CODES.SUCCESS;
	} catch (error) {
		console.error(
			`Error: failed to write migration report: ${sanitizeError(error)}`,
		);
		return EXIT_CODES.WRITE_ERROR;
	}
}

function writeMigrationState(
	targetDir: string,
	state: MigrationPhaseState,
): number {
	try {
		const statePath = getStatePath(targetDir, state.snapshotId);
		const stateDigestPath = getStateDigestPath(targetDir, state.snapshotId);
		const stateSignaturePath = getStateSignaturePath(
			targetDir,
			state.snapshotId,
		);
		const stateAttestationPath = getStateAttestationPath(
			targetDir,
			state.snapshotId,
		);
		const stateAttestationSignaturePath = getStateAttestationSignaturePath(
			targetDir,
			state.snapshotId,
		);
		const signingKeyResult = resolveSnapshotSigningKey();
		if (!signingKeyResult.ok) {
			console.error(`Error: ${signingKeyResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
		const content = JSON.stringify(state, null, 2);
		const payloadDigest = hashContent(content);
		const now = new Date();
		const attestation: MigrationStateAttestation = {
			schemaVersion: "ci-migrate-state-attestation/v1",
			snapshotId: state.snapshotId,
			stage: state.stage,
			createdAt: now.toISOString(),
			expiresAt: new Date(
				now.getTime() + MAX_SNAPSHOT_AGE_DAYS * 24 * 60 * 60 * 1000,
			).toISOString(),
			payloadPath: `${state.snapshotId}.state.json`,
			payloadDigest,
			reportDigest: state.reportDigest,
			requiredChecksDigest: state.requiredChecksDigest,
			proofPackPayloadSha256: state.proofPackPayloadSha256,
			signatureAlgorithm: STATE_SIGNATURE_ALGORITHM,
			signingKeyId: signingKeyResult.keyId,
		};
		const attestationContent = JSON.stringify(attestation, null, 2);
		const attestationSignature = signContent(
			attestationContent,
			signingKeyResult.key,
		);
		mkdirSync(join(targetDir, HARNESS_DIR, SNAPSHOT_DIR), {
			recursive: true,
		});
		writeFileSync(statePath, content);
		writeFileSync(stateDigestPath, `${payloadDigest}\n`);
		writeFileSync(stateAttestationPath, attestationContent);
		writeFileSync(stateAttestationSignaturePath, `${attestationSignature}\n`);
		// Keep legacy sidecar for compatibility with older tooling while attestation is authoritative.
		const signature = signContent(content, signingKeyResult.key);
		writeFileSync(stateSignaturePath, `${signature}\n`);
		return EXIT_CODES.SUCCESS;
	} catch (error) {
		console.error(
			`Error: failed to write migration state: ${sanitizeError(error)}`,
		);
		return EXIT_CODES.WRITE_ERROR;
	}
}

function ensurePrepareSnapshotIdAvailable(
	targetDir: string,
	snapshotId: string,
): { ok: true } | { ok: false; error: string } {
	const existingArtifacts = [
		getSnapshotPath(targetDir, snapshotId),
		getSnapshotDigestPath(targetDir, snapshotId),
		getSnapshotAttestationPath(targetDir, snapshotId),
		getSnapshotSignaturePath(targetDir, snapshotId),
		getExternalControlPlaneStatePath(targetDir, snapshotId),
		getStatePath(targetDir, snapshotId),
		getStateDigestPath(targetDir, snapshotId),
		getStateSignaturePath(targetDir, snapshotId),
		getStateAttestationPath(targetDir, snapshotId),
		getStateAttestationSignaturePath(targetDir, snapshotId),
		getReportPath(targetDir, snapshotId),
	].filter((path) => existsSync(path));

	if (existingArtifacts.length > 0) {
		return {
			ok: false,
			error: `Snapshot id ${snapshotId} already has migration artifacts. Choose a new --snapshot id instead of reusing phased state.`,
		};
	}

	return { ok: true };
}

function readMigrationState(
	targetDir: string,
	snapshotId: string,
): { ok: true; value: MigrationPhaseState } | { ok: false; error: string } {
	const statePath = getStatePath(targetDir, snapshotId);
	const stateDigestPath = getStateDigestPath(targetDir, snapshotId);
	const stateAttestationPath = getStateAttestationPath(targetDir, snapshotId);
	const stateAttestationSignaturePath = getStateAttestationSignaturePath(
		targetDir,
		snapshotId,
	);
	if (!existsSync(statePath)) {
		return { ok: false, error: `Migration state not found: ${statePath}` };
	}
	if (!existsSync(stateDigestPath)) {
		return {
			ok: false,
			error: `Migration state digest missing: ${stateDigestPath}`,
		};
	}
	if (!existsSync(stateAttestationPath)) {
		return {
			ok: false,
			error: `Migration state attestation missing: ${stateAttestationPath}. Refusing stateful operation without signed trust metadata.`,
		};
	}
	if (!existsSync(stateAttestationSignaturePath)) {
		return {
			ok: false,
			error: `Migration state attestation signature missing: ${stateAttestationSignaturePath}. Refusing stateful operation without signed trust metadata.`,
		};
	}

	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return {
			ok: false,
			error: `Migration state integrity check failed: ${signingKeyResult.error}`,
		};
	}

	try {
		const attestationContent = readFileSync(stateAttestationPath, "utf-8");
		const expectedAttestationSignature = readFileSync(
			stateAttestationSignaturePath,
			"utf-8",
		).trim();
		const actualAttestationSignature = signContent(
			attestationContent,
			signingKeyResult.key,
		);
		if (
			expectedAttestationSignature.length === 0 ||
			expectedAttestationSignature !== actualAttestationSignature
		) {
			return {
				ok: false,
				error:
					"Migration state attestation signature check failed. Refusing stateful operation from untrusted metadata.",
			};
		}
		const parsedAttestation = JSON.parse(attestationContent) as unknown;
		if (!isValidMigrationStateAttestation(parsedAttestation, snapshotId)) {
			return {
				ok: false,
				error: "Invalid migration state attestation schema or snapshot id.",
			};
		}
		if (parsedAttestation.signingKeyId !== signingKeyResult.keyId) {
			return {
				ok: false,
				error:
					"Migration state attestation signing key id does not match active signing key.",
			};
		}
		const attestationCreatedAtMs = Date.parse(parsedAttestation.createdAt);
		const attestationExpiresAtMs = Date.parse(parsedAttestation.expiresAt);
		if (
			!Number.isFinite(attestationCreatedAtMs) ||
			!Number.isFinite(attestationExpiresAtMs)
		) {
			return {
				ok: false,
				error: "Migration state attestation timestamps are invalid.",
			};
		}
		if (attestationExpiresAtMs < attestationCreatedAtMs) {
			return {
				ok: false,
				error:
					"Migration state attestation expiry is earlier than creation time.",
			};
		}
		if (Date.now() > attestationExpiresAtMs) {
			return {
				ok: false,
				error: "Migration state attestation expired.",
			};
		}
		const content = readFileSync(statePath, "utf-8");
		const expectedDigest = readFileSync(stateDigestPath, "utf-8").trim();
		const actualDigest = hashContent(content);
		if (expectedDigest.length === 0 || expectedDigest !== actualDigest) {
			return { ok: false, error: "Migration state integrity check failed." };
		}
		if (parsedAttestation.payloadPath !== `${snapshotId}.state.json`) {
			return {
				ok: false,
				error:
					"Migration state attestation payload path does not match expected state artifact.",
			};
		}
		const parsed = JSON.parse(content) as MigrationPhaseState;
		if (
			parsed.schemaVersion !== "ci-migrate-state/v1" ||
			parsed.snapshotId !== snapshotId
		) {
			return {
				ok: false,
				error: "Invalid migration state schema or snapshot id.",
			};
		}
		if (parsedAttestation.payloadDigest !== actualDigest) {
			return {
				ok: false,
				error:
					"Migration state payload digest does not match signed attestation metadata.",
			};
		}
		if (parsedAttestation.stage !== parsed.stage) {
			return {
				ok: false,
				error:
					"Migration state stage does not match signed attestation metadata.",
			};
		}
		if (
			parsedAttestation.reportDigest !== parsed.reportDigest ||
			parsedAttestation.requiredChecksDigest !== parsed.requiredChecksDigest
		) {
			return {
				ok: false,
				error:
					"Migration state policy digests do not match signed attestation metadata.",
			};
		}
		if (
			(parsedAttestation.proofPackPayloadSha256 ?? "") !==
			(parsed.proofPackPayloadSha256 ?? "")
		) {
			return {
				ok: false,
				error:
					"Migration state proof-pack digest does not match signed attestation metadata.",
			};
		}
		return { ok: true, value: parsed };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse migration state: ${sanitizeError(error)}`,
		};
	}
}

function readPreparedMigrationReport(
	targetDir: string,
	snapshotId: string,
): { ok: true; value: MigrationReport } | { ok: false; error: string } {
	const reportPath = getReportPath(targetDir, snapshotId);
	if (!existsSync(reportPath)) {
		return {
			ok: false,
			error: `Prepared migration report not found: ${reportPath}`,
		};
	}

	try {
		const parsed = JSON.parse(
			readFileSync(reportPath, "utf-8"),
		) as MigrationReport;
		if (parsed.schemaVersion !== "ci-migrate-report/v1") {
			return {
				ok: false,
				error: "Prepared migration report schema is invalid.",
			};
		}
		return { ok: true, value: parsed };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse prepared migration report: ${sanitizeError(error)}`,
		};
	}
}

function hashMigrationReport(report: MigrationReport): string {
	const canonicalReport = {
		schemaVersion: report.schemaVersion,
		sourceProvider: report.sourceProvider,
		targetProvider: report.targetProvider,
		sourceConfigPaths: report.sourceConfigPaths,
		targetConfigPaths: report.targetConfigPaths,
		requiredChecks: report.requiredChecks,
		requiredCheckNames: report.requiredCheckNames,
		ownership: report.ownership,
		parity: report.parity,
		promotionEvidence: report.promotionEvidence,
		satisfiability: {
			preCutover: report.satisfiability.preCutover,
		},
		summary: report.summary,
	};
	return hashContent(JSON.stringify(canonicalReport));
}

function hashRequiredCheckNames(requiredCheckNames: string[]): string {
	return hashContent(JSON.stringify([...requiredCheckNames].sort()));
}

export function runCIMigrateCLI(
	targetDir: string | undefined,
	options: CIMigrateOptions,
): number {
	const actionResult = normalizeAction(options.action);
	if (!actionResult.ok) {
		console.error(`Error: ${actionResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}
	const action = actionResult.value;
	const modeResult = deriveModeFromAction(action, options);
	if (!modeResult.ok) {
		console.error(`Error: ${modeResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}

	const { apply, rollback, dryRun } = modeResult.value;
	const dir = targetDir ?? cwd();
	const providerResult = normalizeProvider(options.provider);
	if (!providerResult.ok) {
		console.error(`Error: ${providerResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}
	const requestedProvider = providerResult.value;
	let provider = requestedProvider;
	const snapshotIdResult = validateSnapshotId(
		options.snapshot ?? defaultSnapshotId(),
	);
	if (!snapshotIdResult.ok) {
		console.error(`Error: ${snapshotIdResult.error}`);
		return EXIT_CODES.INVALID_PATH;
	}
	const snapshotId = snapshotIdResult.value;
	let migrationReport: MigrationReport | null = null;
	let sourceProviderForRollback: CIProvider = "github-actions";
	let preparedState: MigrationPhaseState | null = null;
	let breakGlassApproval: BreakGlassApproval | null = null;

	if (apply && rollback) {
		console.error("Error: --apply and --rollback are mutually exclusive.");
		return EXIT_CODES.INVALID_PATH;
	}

	if (apply && options.dryRun === true) {
		console.error("Error: --apply cannot be combined with --dry-run.");
		return EXIT_CODES.INVALID_PATH;
	}

	if (dryRun && rollback) {
		console.error("Error: --dry-run cannot be used with --rollback.");
		return EXIT_CODES.INVALID_PATH;
	}

	if (action === "abort" && !options.snapshot) {
		console.error("Error: action 'abort' requires --snapshot <id>.");
		return EXIT_CODES.INVALID_PATH;
	}

	if (action === "commit" && !options.snapshot) {
		console.error("Error: action 'commit' requires --snapshot <id>.");
		return EXIT_CODES.INVALID_PATH;
	}

	if (rollback && !options.snapshot) {
		console.error("Error: --rollback requires --snapshot <id>.");
		return EXIT_CODES.INVALID_PATH;
	}
	if (options.breakGlassApprovalPath !== undefined) {
		const parsedBreakGlassResult = readBreakGlassApproval(
			dir,
			options.breakGlassApprovalPath,
			snapshotId,
		);
		if (!parsedBreakGlassResult.ok) {
			console.error(`Error: ${parsedBreakGlassResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
		breakGlassApproval = parsedBreakGlassResult.value;
	}

	if (action === "commit" || action === "abort" || (rollback && !action)) {
		const stateResult = readMigrationState(dir, snapshotId);
		if (!stateResult.ok) {
			const recoveryHint =
				action === "commit" || action === "abort"
					? `Run 'harness ci-migrate prepare --snapshot ${snapshotId}' first.`
					: `Run 'harness ci-migrate prepare --snapshot ${snapshotId}' and 'harness ci-migrate commit --snapshot ${snapshotId}' before rollback.`;
			console.error(`Error: ${stateResult.error} ${recoveryHint}`);
			return EXIT_CODES.INVALID_PATH;
		}
		preparedState = stateResult.value;

		if (
			action === "commit" &&
			preparedState.targetProvider !== requestedProvider
		) {
			console.error(
				`Error: migration state target provider (${preparedState.targetProvider}) does not match requested provider (${requestedProvider}).`,
			);
			return EXIT_CODES.INVALID_PATH;
		}
		provider = preparedState.targetProvider;
		sourceProviderForRollback = preparedState.sourceProvider;
	}

	if (action === "prepare") {
		const prepareIdResult = ensurePrepareSnapshotIdAvailable(dir, snapshotId);
		if (!prepareIdResult.ok) {
			console.error(`Error: ${prepareIdResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
	}

	if (!action && apply && !dryRun) {
		const prepareIdResult = ensurePrepareSnapshotIdAvailable(dir, snapshotId);
		if (!prepareIdResult.ok) {
			console.error(`Error: ${prepareIdResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
	}

	if (action === "commit" && preparedState?.stage !== "prepared") {
		console.error(
			`Error: action 'commit' requires snapshot ${snapshotId} in prepared stage.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}

	if (action === "commit" && preparedState) {
		const preparedStateAgeResult = isPreparedStateExpired(preparedState);
		if (!preparedStateAgeResult.ok) {
			console.error(`Error: ${preparedStateAgeResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
	}

	if (action === "commit" && preparedState) {
		const preparedReportResult = readPreparedMigrationReport(dir, snapshotId);
		if (!preparedReportResult.ok) {
			console.error(`Error: ${preparedReportResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
		const preparedReportDigest = hashMigrationReport(
			preparedReportResult.value,
		);
		const preparedRequiredChecksDigest = hashRequiredCheckNames(
			preparedReportResult.value.requiredCheckNames,
		);
		const preparedProofPackPayloadSha256 =
			preparedReportResult.value.promotionEvidence.proofPackPayloadSha256;
		const preparedProofPackSignature =
			preparedReportResult.value.promotionEvidence.proofPackSignature;
		if (
			preparedState.reportDigest !== preparedReportDigest ||
			preparedState.requiredChecksDigest !== preparedRequiredChecksDigest ||
			preparedState.proofPackPayloadSha256 !== preparedProofPackPayloadSha256 ||
			preparedState.proofPackSignature !== preparedProofPackSignature ||
			preparedState.preCutoverStatus !==
				preparedReportResult.value.satisfiability.preCutover.status
		) {
			console.error(
				"Error: prepared migration evidence no longer matches recorded state; rerun prepare before commit.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
	}

	if (action === "abort" && preparedState?.stage === "aborted") {
		console.error(`Error: snapshot ${snapshotId} is already in aborted stage.`);
		return EXIT_CODES.INVALID_PATH;
	}

	if (action === "abort" && preparedState?.stage === "rollback-failed") {
		console.error(
			`Error: snapshot ${snapshotId} is in rollback-failed stage. Rerun prepare before retrying rollback.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}

	if (action === "abort" && preparedState?.stage !== "committed") {
		console.error(
			`Error: action 'abort' requires snapshot ${snapshotId} in committed stage.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}

	if (!action && rollback && preparedState?.stage !== "committed") {
		console.error(
			`Error: --rollback requires snapshot ${snapshotId} in committed stage.`,
		);
		return EXIT_CODES.INVALID_PATH;
	}
	if (rollback) {
		const mode = readContractProviderMode(dir);
		const rollbackMayWeakenChecksOrRulesets =
			mode === "required" &&
			preparedState?.targetProvider === "circleci" &&
			preparedState.sourceProvider === "github-actions";
		if (
			rollbackMayWeakenChecksOrRulesets &&
			!breakGlassApproval?.allowRollbackWeakening
		) {
			console.error(
				"Error: rollback from required CircleCI mode may weaken required checks/rulesets. Provide --break-glass-approval with allowRollbackWeakening=true.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
	}

	if (rollback && options.snapshot) {
		const snapshotExitCode = restoreSnapshot(
			dir,
			snapshotId,
			breakGlassApproval ?? undefined,
		);
		if (snapshotExitCode !== EXIT_CODES.SUCCESS) {
			return snapshotExitCode;
		}
		provider = preparedState?.sourceProvider ?? provider;
		sourceProviderForRollback =
			preparedState?.sourceProvider ?? sourceProviderForRollback;
	}

	if (!rollback) {
		const sourceProvider = detectSourceProvider(dir);
		sourceProviderForRollback = sourceProvider;
		const reportResult = buildMigrationReport(dir, sourceProvider, provider);
		if (!reportResult.ok) {
			console.error(`Error: ${reportResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		migrationReport = reportResult.value;
		const migrationReportDigest = hashMigrationReport(migrationReport);
		const requiredChecksDigest = hashRequiredCheckNames(
			migrationReport.requiredCheckNames,
		);

		if (
			action === "commit" &&
			preparedState &&
			(preparedState.reportDigest !== migrationReportDigest ||
				preparedState.requiredChecksDigest !== requiredChecksDigest ||
				preparedState.preCutoverStatus !==
					migrationReport.satisfiability.preCutover.status)
		) {
			console.error(
				"Error: prepared state no longer matches current migration report; rerun prepare before commit.",
			);
			return EXIT_CODES.INVALID_PATH;
		}

		const reportExitCode = writeMigrationReport(
			dir,
			snapshotId,
			migrationReport,
		);
		if (reportExitCode !== EXIT_CODES.SUCCESS) {
			return reportExitCode;
		}

		const blockingCount =
			migrationReport.summary.manualMappingRequired +
			migrationReport.summary.unsupportedBlocking;
		if (apply && blockingCount > 0) {
			console.error(
				"Error: migration report contains blocking classifications (manual-mapping-required/unsupported-blocking). Resolve them before --apply.",
			);
			return EXIT_CODES.INVALID_PATH;
		}

		if (apply && migrationReport.ownership.violations.length > 0) {
			console.error(
				"Error: migration report contains required-check ownership violations (both/neither publisher). Resolve ownership mapping before --apply.",
			);
			return EXIT_CODES.INVALID_PATH;
		}

		if (
			apply &&
			migrationReport.satisfiability.preCutover.status !== "satisfied"
		) {
			console.error(
				"Error: pre-cutover satisfiability scan did not prove open PRs can satisfy required checks. Resolve status before --apply.",
			);
			return EXIT_CODES.INVALID_PATH;
		}

		if (
			apply &&
			migrationReport.promotionEvidence.required &&
			migrationReport.promotionEvidence.status !== "verified"
		) {
			console.error(
				`Error: required CircleCI promotion evidence is insufficient. ${migrationReport.promotionEvidence.violations.join(" ")}`,
			);
			return EXIT_CODES.INVALID_PATH;
		}

		if (
			apply &&
			migrationReport.promotionEvidence.required &&
			migrationReport.parity.status !== "parity"
		) {
			console.error(
				`Error: parity drift blocks required CircleCI promotion. Unexpected diffs: ${migrationReport.parity.unexpectedDiffs.join(", ")}`,
			);
			return EXIT_CODES.INVALID_PATH;
		}

		if (
			apply &&
			migrationReport.promotionEvidence.required &&
			migrationReport.satisfiability.preCutover.scannedOpenPrs < 1
		) {
			console.error(
				"Error: pre-cutover satisfiability scanned 0 open PRs. Refusing required CircleCI promotion without live parity evidence.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
	}

	if (apply && !dryRun) {
		const snapshotExitCode = writeSnapshot(dir, snapshotId);
		if (snapshotExitCode !== EXIT_CODES.SUCCESS) {
			return snapshotExitCode;
		}
	}

	const initOptions: InitOptions = {
		dryRun,
		force: apply,
		track: apply,
		rollback,
		checkUpdates: false,
		update: false,
		interactive: false,
		migrate: false,
		ciProvider: provider,
	};

	const exitCode = runInitCLI(dir, initOptions);
	if (exitCode !== EXIT_CODES.SUCCESS) {
		return exitCode;
	}

	if (action === "prepare" && migrationReport) {
		const now = new Date().toISOString();
		const preparedStateWriteExitCode = writeMigrationState(dir, {
			schemaVersion: "ci-migrate-state/v1",
			snapshotId,
			stage: "prepared",
			sourceProvider: migrationReport.sourceProvider,
			targetProvider: migrationReport.targetProvider,
			reportDigest: hashMigrationReport(migrationReport),
			requiredChecksDigest: hashRequiredCheckNames(
				migrationReport.requiredCheckNames,
			),
			proofPackPayloadSha256:
				migrationReport.promotionEvidence.proofPackPayloadSha256,
			proofPackSignature: migrationReport.promotionEvidence.proofPackSignature,
			preCutoverStatus: migrationReport.satisfiability.preCutover.status,
			createdAt: now,
			updatedAt: now,
		});
		if (preparedStateWriteExitCode !== EXIT_CODES.SUCCESS) {
			return preparedStateWriteExitCode;
		}
	}

	if (!dryRun && apply && migrationReport) {
		const postCutoverRequiredChecksResult = readAllRequiredChecks(dir);
		if (!postCutoverRequiredChecksResult.ok) {
			console.error(`Error: ${postCutoverRequiredChecksResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		const postCutoverSatisfiability = scanOpenPullRequestSatisfiability(
			dir,
			postCutoverRequiredChecksResult.value,
		);
		const postReport: MigrationReport = {
			...migrationReport,
			satisfiability: {
				...migrationReport.satisfiability,
				postCutover: postCutoverSatisfiability,
			},
		};
		const reportExitCode = writeMigrationReport(dir, snapshotId, postReport);
		if (reportExitCode !== EXIT_CODES.SUCCESS) {
			return reportExitCode;
		}
		const postCutoverMissingLiveEvidence =
			migrationReport.promotionEvidence.required &&
			postCutoverSatisfiability.scannedOpenPrs < 1;
		if (
			postCutoverSatisfiability.status !== "satisfied" ||
			postCutoverMissingLiveEvidence
		) {
			const rollbackReason =
				postCutoverSatisfiability.status !== "satisfied"
					? "post-cutover satisfiability checks failed"
					: "post-cutover satisfiability scanned 0 open PRs";
			console.error(
				`Error: ${rollbackReason}. Attempting automatic rollback using snapshot.`,
			);
			const snapshotRestoreExitCode = restoreSnapshot(dir, snapshotId);
			if (snapshotRestoreExitCode !== EXIT_CODES.SUCCESS) {
				if (action === "commit" && preparedState) {
					const rollbackFailedStateExitCode = writeMigrationState(dir, {
						...preparedState,
						stage: "rollback-failed",
						updatedAt: new Date().toISOString(),
					});
					if (rollbackFailedStateExitCode !== EXIT_CODES.SUCCESS) {
						return rollbackFailedStateExitCode;
					}
				}
				return snapshotRestoreExitCode;
			}

			const rollbackExitCode = runInitCLI(dir, {
				dryRun: false,
				force: false,
				track: false,
				rollback: true,
				checkUpdates: false,
				update: false,
				interactive: false,
				migrate: false,
				ciProvider: sourceProviderForRollback,
			});
			if (rollbackExitCode !== EXIT_CODES.SUCCESS) {
				if (action === "commit" && preparedState) {
					const rollbackFailedStateExitCode = writeMigrationState(dir, {
						...preparedState,
						stage: "rollback-failed",
						updatedAt: new Date().toISOString(),
					});
					if (rollbackFailedStateExitCode !== EXIT_CODES.SUCCESS) {
						return rollbackFailedStateExitCode;
					}
				}
				return rollbackExitCode;
			}

			if (action === "commit" && preparedState) {
				const abortStateWriteExitCode = writeMigrationState(dir, {
					...preparedState,
					stage: "aborted",
					updatedAt: new Date().toISOString(),
				});
				if (abortStateWriteExitCode !== EXIT_CODES.SUCCESS) {
					return abortStateWriteExitCode;
				}
			}
			return EXIT_CODES.INVALID_PATH;
		}

		if (action === "commit" && preparedState) {
			const committedStateWriteExitCode = writeMigrationState(dir, {
				...preparedState,
				stage: "committed",
				reportDigest: hashMigrationReport(postReport),
				requiredChecksDigest: hashRequiredCheckNames(
					postReport.requiredCheckNames,
				),
				proofPackPayloadSha256:
					postReport.promotionEvidence.proofPackPayloadSha256,
				proofPackSignature: postReport.promotionEvidence.proofPackSignature,
				preCutoverStatus: postReport.satisfiability.preCutover.status,
				updatedAt: new Date().toISOString(),
			});
			if (committedStateWriteExitCode !== EXIT_CODES.SUCCESS) {
				return committedStateWriteExitCode;
			}
		}
	}

	if (action === "abort" && preparedState) {
		const abortedStateWriteExitCode = writeMigrationState(dir, {
			...preparedState,
			stage: "aborted",
			updatedAt: new Date().toISOString(),
		});
		if (abortedStateWriteExitCode !== EXIT_CODES.SUCCESS) {
			return abortedStateWriteExitCode;
		}
	}

	return EXIT_CODES.SUCCESS;
}
