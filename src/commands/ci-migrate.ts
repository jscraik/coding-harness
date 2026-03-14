import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
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
const PARITY_PROOF_PACK_INPUT_PATH = ".harness/ci-parity-proof-pack.input.json";
const PARITY_PROOF_PACK_ARTIFACTS_DIR =
	".harness/ci-parity-proof-pack-artifacts";
const PARITY_PROVENANCE_INPUT_PATH =
	".harness/ci-parity-proof-provenance.input.json";
const PARITY_PROVENANCE_BUNDLE_PATH =
	".harness/ci-parity-proof-provenance.bundle.json";
const PARITY_PROVENANCE_MANIFEST_PATH =
	".harness/ci-parity-proof-provenance.manifest.json";
const PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH =
	".harness/ci-parity-proof-provenance.manifest.sig";
const PARITY_PROVENANCE_ARTIFACT_INDEX_PATH =
	".harness/ci-parity-proof-artifact-index.json";
const PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH =
	".harness/ci-parity-proof-artifact-index.sig";
const PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION =
	"ci-parity-proof-provenance-bundle/v1";
const PARITY_PROVENANCE_INPUT_SCHEMA_VERSION =
	"ci-parity-proof-provenance-input/v1";
const PARITY_PROVENANCE_MANIFEST_SCHEMA_VERSION =
	"ci-parity-proof-provenance-manifest/v1";
const PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION =
	"ci-parity-proof-artifact-index/v2";
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
const MERGE_QUEUE_WINDOW_PATH =
	".harness/control-plane/merge-queue-cutover-window.json";
const DEFAULT_MERGE_QUEUE_EVIDENCE_PATH =
	".harness/control-plane/merge-queue-cutover-evidence.json";
const DEFAULT_MERGE_QUEUE_ORCHESTRATOR_PATH =
	".harness/control-plane/merge-queue-cutover-orchestrator";
const BREAK_GLASS_POLICY_PATH =
	".harness/control-plane/ci-migrate-break-glass-policy.json";
const DEFAULT_TRANSITION_STATUS_ARTIFACT_PATH =
	".harness/ci-provider-transition-status.json";
const VALID_PROVIDERS: CIProvider[] = ["github-actions", "circleci"];
const VALID_ACTIONS = ["prepare", "commit", "abort", "verify"] as const;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const HEX_TOKEN_PATTERN = /^[a-f0-9]+$/;

type CIMigrateAction = (typeof VALID_ACTIONS)[number];

type MigrationClassification =
	| "translatable"
	| "manual-mapping-required"
	| "unsupported-blocking";
type CIProviderMode = "shadow" | "required";
type CIProviderMigrationStage =
	| "dual-provider"
	| "circleci-primary"
	| "circleci-only";
type RequiredParityScenario = (typeof REQUIRED_PARITY_SCENARIOS)[number];

export interface CIMigrateOptions {
	provider?: string | undefined;
	dryRun?: boolean | undefined;
	apply?: boolean | undefined;
	rollback?: boolean | undefined;
	snapshot?: string | undefined;
	action?: string | undefined;
	breakGlassApprovalPath?: string | undefined;
	mergeQueueEvidencePath?: string | undefined;
	mergeQueueOrchestratorPath?: string | undefined;
	autoGenerateProofPack?: boolean | undefined;
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

interface CIParityProofPackInput {
	schemaVersion: "ci-parity-proof-input/v1";
	generatedAt?: string | undefined;
	repo?: {
		baseSha?: string | undefined;
		headSha?: string | undefined;
		fullName?: string | undefined;
		originUrl?: string | undefined;
	} | null;
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

interface CIParityProvenanceInputArtifact {
	artifactId: string;
	path: string;
	sourceProvider: CIProvider;
	sourceRunId: string;
	sourceWorkflowRef: string;
	sourceCommitSha?: string | undefined;
	capturedAt?: string | undefined;
	scenario?: RequiredParityScenario | undefined;
}

interface CIParityProvenanceInput {
	schemaVersion: typeof PARITY_PROVENANCE_INPUT_SCHEMA_VERSION;
	generatedAt?: string | undefined;
	repo?: CIParityProofPackInput["repo"] | undefined;
	behavioralParity: CIParityProofPackInput["behavioralParity"];
	promotionGate: CIParityProofPackInput["promotionGate"];
	downstream: CIParityProofPackInput["downstream"];
	artifacts: CIParityProvenanceInputArtifact[];
}

interface CIParityProvenanceArtifactIndex {
	schemaVersion: typeof PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION;
	generatedAt: string;
	repo?: CIParityProofPackInput["repo"] | undefined;
	behavioralParity: CIParityProofPackInput["behavioralParity"];
	promotionGate: CIParityProofPackInput["promotionGate"];
	downstream: CIParityProofPackInput["downstream"];
	artifacts: CIParityProvenanceArtifactRecord[];
	integrity: {
		signatureAlgorithm: typeof PARITY_PROOF_PACK_SIGNATURE_ALGORITHM;
		signingKeyId: string;
		payloadSha256: string;
	};
}

interface CIParityProvenanceArtifactRecord {
	artifactId: string;
	path: string;
	sha256: string;
	signature: string;
	sourceProvider: CIProvider;
	sourceRunId: string;
	sourceWorkflowRef: string;
	sourceCommitSha: string;
	capturedAt: string;
	scenario?: RequiredParityScenario | undefined;
}

interface CIParityProvenanceBundle {
	schemaVersion: typeof PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION;
	generatedAt: string;
	repo?: CIParityProofPackInput["repo"] | undefined;
	behavioralParity: CIParityProofPackInput["behavioralParity"];
	promotionGate: CIParityProofPackInput["promotionGate"];
	downstream: CIParityProofPackInput["downstream"];
	artifacts: CIParityProvenanceArtifactRecord[];
}

interface CIParityProvenanceManifest {
	schemaVersion: typeof PARITY_PROVENANCE_MANIFEST_SCHEMA_VERSION;
	generatedAt: string;
	sourceBundlePath: string;
	sourceBundleSha256: string;
	artifacts: CIParityProvenanceArtifactRecord[];
	integrity: {
		signatureAlgorithm: typeof PARITY_PROOF_PACK_SIGNATURE_ALGORITHM;
		signingKeyId: string;
		payloadSha256: string;
	};
}

interface CIProviderPolicyConfig {
	mode: CIProviderMode;
	migrationStage: CIProviderMigrationStage;
	transitionStatusArtifactPath: string;
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
	approvers?: string[] | undefined;
	reason: string;
	approvedAt: string;
	expiresAt: string;
	allowExpiredSnapshotRestore: boolean;
	allowRollbackWeakening: boolean;
	signatureAlgorithm: typeof SNAPSHOT_SIGNATURE_ALGORITHM;
	signingKeyId: string;
}

interface BreakGlassGovernancePolicy {
	schemaVersion: "ci-migrate-break-glass-policy/v1";
	approverAllowlist: string[];
	maxApprovalTtlHours: number;
	requireDualApprovalForRollbackWeakening: boolean;
	integrity: {
		signatureAlgorithm: typeof SNAPSHOT_SIGNATURE_ALGORITHM;
		signingKeyId: string;
		payloadSha256: string;
	};
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

interface MergeQueueCutoverWindow {
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

interface MergeQueueEvidenceBinding {
	repoFullName: string;
	headSha: string;
	trustedPolicyRef: string;
	authorityConfigSha256: string;
	requiredCheckManifestSha256: string;
}

interface MergeQueueCutoverEvidence {
	schemaVersion: "ci-migrate-merge-queue-evidence/v2";
	snapshotId: string;
	generatedAt: string;
	binding: MergeQueueEvidenceBinding;
	pausedAt: string;
	drainedAt?: string | undefined;
	revalidatedAt?: string | undefined;
	pausedQueueDepth?: number | undefined;
	drainedCandidateCount?: number | undefined;
	revalidatedCandidateCount?: number | undefined;
	integrity: {
		signatureAlgorithm: typeof SNAPSHOT_SIGNATURE_ALGORITHM;
		signingKeyId: string;
		payloadSha256: string;
	};
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

function isValidMergeQueueEvidenceBinding(
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

function isValidMergeQueueCutoverWindow(
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
	const evidenceQueueCountValid = (value: unknown): boolean =>
		value === undefined ||
		(typeof value === "number" &&
			Number.isInteger(value) &&
			Number.isFinite(value) &&
			value >= 0);
	return (
		parsed.schemaVersion === "ci-migrate-merge-queue-window/v1" &&
		typeof parsed.snapshotId === "string" &&
		parsed.snapshotId.trim().length > 0 &&
		(parsed.stage === "paused" ||
			parsed.stage === "drained" ||
			parsed.stage === "revalidated" ||
			parsed.stage === "aborted") &&
		Number.isFinite(pausedAtMs) &&
		(parsed.drainedAt === undefined || Number.isFinite(drainedAtMs)) &&
		(parsed.revalidatedAt === undefined || Number.isFinite(revalidatedAtMs)) &&
		(parsed.abortedAt === undefined || Number.isFinite(abortedAtMs)) &&
		isValidBranchProtectionSatisfiabilityReport(parsed.preCutover) &&
		(parsed.postCutover === undefined ||
			isValidBranchProtectionSatisfiabilityReport(parsed.postCutover)) &&
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

function getMergeQueueWindowPath(targetDir: string): string {
	return resolve(targetDir, MERGE_QUEUE_WINDOW_PATH);
}

function getMergeQueueWindowSignaturePath(targetDir: string): string {
	return `${getMergeQueueWindowPath(targetDir)}.sig`;
}

function writeMergeQueueWindow(
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

function readMergeQueueWindowIfPresent(
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
				error: `Merge-queue cutover window signature must be a sha256 hex digest: ${signaturePath}`,
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

function assertNoBlockingMergeQueueCutoverWindow(
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
			error: `Active merge-queue cutover window blocks new apply: snapshot ${window.snapshotId} is ${window.stage}. Complete or abort the active window before starting snapshot ${snapshotId}.`,
		};
	}
	return { ok: true };
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
	const approvers =
		Array.isArray(parsed.approvers) &&
		parsed.approvers.every(
			(approver) => typeof approver === "string" && approver.trim().length > 0,
		)
			? parsed.approvers.map((approver) => approver.trim())
			: undefined;
	const uniqueApprovers =
		approvers === undefined
			? undefined
			: new Set(approvers.map((approver) => approver.toLowerCase()));
	return (
		parsed.schemaVersion === "ci-migrate-break-glass-approval/v1" &&
		parsed.snapshotId === snapshotId &&
		typeof parsed.approvedBy === "string" &&
		parsed.approvedBy.trim().length > 0 &&
		(approvers === undefined ||
			(approvers.length > 0 &&
				uniqueApprovers !== undefined &&
				uniqueApprovers.size === approvers.length &&
				approvers.some(
					(approver) =>
						approver.toLowerCase() ===
						(parsed.approvedBy ?? "").trim().toLowerCase(),
				))) &&
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

function normalizeBreakGlassApprovers(approval: BreakGlassApproval): string[] {
	if (Array.isArray(approval.approvers) && approval.approvers.length > 0) {
		return approval.approvers.map((approver) => approver.trim());
	}
	return [approval.approvedBy.trim()];
}

function canonicalizeBreakGlassGovernancePolicyForDigest(
	policy: BreakGlassGovernancePolicy,
): string {
	return JSON.stringify({
		schemaVersion: policy.schemaVersion,
		approverAllowlist: policy.approverAllowlist,
		maxApprovalTtlHours: policy.maxApprovalTtlHours,
		requireDualApprovalForRollbackWeakening:
			policy.requireDualApprovalForRollbackWeakening,
		integrity: {
			signatureAlgorithm: policy.integrity.signatureAlgorithm,
			signingKeyId: policy.integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function isValidBreakGlassGovernancePolicy(
	value: unknown,
): value is BreakGlassGovernancePolicy {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<BreakGlassGovernancePolicy>;
	if (
		parsed.schemaVersion !== "ci-migrate-break-glass-policy/v1" ||
		!Array.isArray(parsed.approverAllowlist) ||
		parsed.approverAllowlist.length < 1 ||
		typeof parsed.maxApprovalTtlHours !== "number" ||
		!Number.isInteger(parsed.maxApprovalTtlHours) ||
		parsed.maxApprovalTtlHours < 1 ||
		parsed.maxApprovalTtlHours > 168 ||
		typeof parsed.requireDualApprovalForRollbackWeakening !== "boolean" ||
		parsed.integrity?.signatureAlgorithm !== SNAPSHOT_SIGNATURE_ALGORITHM ||
		typeof parsed.integrity?.signingKeyId !== "string" ||
		!HEX_TOKEN_PATTERN.test(parsed.integrity.signingKeyId) ||
		typeof parsed.integrity?.payloadSha256 !== "string" ||
		!isHexDigest(parsed.integrity.payloadSha256)
	) {
		return false;
	}
	const normalizedAllowlist = parsed.approverAllowlist.map((approver) =>
		typeof approver === "string" ? approver.trim() : "",
	);
	if (normalizedAllowlist.some((approver) => approver.length === 0)) {
		return false;
	}
	return (
		new Set(normalizedAllowlist.map((approver) => approver.toLowerCase()))
			.size === normalizedAllowlist.length
	);
}

function readBreakGlassGovernancePolicy(
	targetDir: string,
):
	| { ok: true; value: BreakGlassGovernancePolicy }
	| { ok: false; error: string } {
	const resolvedPath = resolve(targetDir, BREAK_GLASS_POLICY_PATH);
	const signaturePath = `${resolvedPath}.sig`;
	if (!existsSync(resolvedPath)) {
		return {
			ok: false,
			error: `Break-glass governance policy file not found: ${BREAK_GLASS_POLICY_PATH}`,
		};
	}
	if (!existsSync(signaturePath)) {
		return {
			ok: false,
			error: `Break-glass governance policy signature is missing: ${BREAK_GLASS_POLICY_PATH}.sig`,
		};
	}
	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return { ok: false, error: signingKeyResult.error };
	}
	try {
		const content = readFileSync(resolvedPath, "utf-8");
		const signature = readFileSync(signaturePath, "utf-8").trim();
		if (!isHexDigest(signature)) {
			return {
				ok: false,
				error: `Break-glass governance policy signature must be a sha256 hex digest: ${BREAK_GLASS_POLICY_PATH}.sig`,
			};
		}
		const expectedSignature = signContent(content, signingKeyResult.key);
		if (signature !== expectedSignature) {
			return {
				ok: false,
				error:
					"Break-glass governance policy signature check failed. Refusing unsigned governance policy.",
			};
		}
		const parsed = JSON.parse(content) as unknown;
		if (!isValidBreakGlassGovernancePolicy(parsed)) {
			return {
				ok: false,
				error:
					"Break-glass governance policy schema is invalid. Expected ci-migrate-break-glass-policy/v1.",
			};
		}
		if (parsed.integrity.signingKeyId !== signingKeyResult.keyId) {
			return {
				ok: false,
				error:
					"Break-glass governance policy signing key id does not match active signing key.",
			};
		}
		const expectedPayloadSha256 = hashContent(
			canonicalizeBreakGlassGovernancePolicyForDigest(parsed),
		);
		if (parsed.integrity.payloadSha256 !== expectedPayloadSha256) {
			return {
				ok: false,
				error:
					"Break-glass governance policy integrity payloadSha256 does not match signed payload.",
			};
		}
		return { ok: true, value: parsed };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse break-glass governance policy: ${sanitizeError(error)}`,
		};
	}
}

function validateBreakGlassApprovalAgainstPolicy(
	approval: BreakGlassApproval,
	policy: BreakGlassGovernancePolicy,
	options?: { requireDualForRollbackWeakening?: boolean | undefined },
): string[] {
	const violations: string[] = [];
	const normalizedAllowlist = new Set(
		policy.approverAllowlist.map((approver) => approver.trim().toLowerCase()),
	);
	const approvers = normalizeBreakGlassApprovers(approval);
	for (const approver of approvers) {
		if (!normalizedAllowlist.has(approver.toLowerCase())) {
			violations.push(
				`Break-glass approver '${approver}' is not allowlisted by governance policy.`,
			);
		}
	}
	const approvedAtMs = Date.parse(approval.approvedAt);
	const expiresAtMs = Date.parse(approval.expiresAt);
	if (Number.isFinite(approvedAtMs) && Number.isFinite(expiresAtMs)) {
		const ttlHours = (expiresAtMs - approvedAtMs) / (60 * 60 * 1000);
		if (ttlHours > policy.maxApprovalTtlHours) {
			violations.push(
				`Break-glass approval TTL (${ttlHours.toFixed(2)}h) exceeds governance policy maxApprovalTtlHours (${policy.maxApprovalTtlHours}h).`,
			);
		}
	}
	const requireDual =
		options?.requireDualForRollbackWeakening === true &&
		policy.requireDualApprovalForRollbackWeakening;
	if (requireDual && approvers.length < 2) {
		violations.push(
			"Break-glass governance policy requires dual approval for rollback weakening.",
		);
	}
	return violations;
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

function canonicalizeMergeQueueEvidenceForDigest(
	evidence: MergeQueueCutoverEvidence,
): string {
	return JSON.stringify({
		schemaVersion: evidence.schemaVersion,
		snapshotId: evidence.snapshotId,
		generatedAt: evidence.generatedAt,
		binding: evidence.binding,
		pausedAt: evidence.pausedAt,
		drainedAt: evidence.drainedAt,
		revalidatedAt: evidence.revalidatedAt,
		pausedQueueDepth: evidence.pausedQueueDepth,
		drainedCandidateCount: evidence.drainedCandidateCount,
		revalidatedCandidateCount: evidence.revalidatedCandidateCount,
		integrity: {
			signatureAlgorithm: evidence.integrity.signatureAlgorithm,
			signingKeyId: evidence.integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function isValidMergeQueueCutoverEvidence(
	value: unknown,
	snapshotId: string,
): value is MergeQueueCutoverEvidence {
	if (!value || typeof value !== "object") {
		return false;
	}
	const parsed = value as Partial<MergeQueueCutoverEvidence>;
	const queueCountValid = (count: unknown): boolean =>
		count === undefined ||
		(typeof count === "number" &&
			Number.isInteger(count) &&
			Number.isFinite(count) &&
			count >= 0);
	return (
		parsed.schemaVersion === "ci-migrate-merge-queue-evidence/v2" &&
		parsed.snapshotId === snapshotId &&
		typeof parsed.generatedAt === "string" &&
		Number.isFinite(Date.parse(parsed.generatedAt)) &&
		isValidMergeQueueEvidenceBinding(parsed.binding) &&
		typeof parsed.pausedAt === "string" &&
		Number.isFinite(Date.parse(parsed.pausedAt)) &&
		(parsed.drainedAt === undefined ||
			(typeof parsed.drainedAt === "string" &&
				Number.isFinite(Date.parse(parsed.drainedAt)))) &&
		(parsed.revalidatedAt === undefined ||
			(typeof parsed.revalidatedAt === "string" &&
				Number.isFinite(Date.parse(parsed.revalidatedAt)))) &&
		queueCountValid(parsed.pausedQueueDepth) &&
		queueCountValid(parsed.drainedCandidateCount) &&
		queueCountValid(parsed.revalidatedCandidateCount) &&
		parsed.integrity?.signatureAlgorithm === SNAPSHOT_SIGNATURE_ALGORITHM &&
		typeof parsed.integrity?.signingKeyId === "string" &&
		HEX_TOKEN_PATTERN.test(parsed.integrity.signingKeyId) &&
		typeof parsed.integrity?.payloadSha256 === "string" &&
		isHexDigest(parsed.integrity.payloadSha256)
	);
}

interface MergeQueueEvidenceRecord {
	sourcePath: string;
	contentSha256: string;
	evidence: MergeQueueCutoverEvidence;
}

function readMergeQueueEvidence(
	targetDir: string,
	snapshotId: string,
	overridePath: string | undefined,
	required: boolean,
	expectedBinding: MergeQueueEvidenceBinding | null,
):
	| { ok: true; value: MergeQueueEvidenceRecord | null }
	| {
			ok: false;
			error: string;
	  } {
	const configuredPath =
		typeof overridePath === "string" && overridePath.trim().length > 0
			? overridePath.trim()
			: DEFAULT_MERGE_QUEUE_EVIDENCE_PATH;
	const resolvedPath = resolve(targetDir, configuredPath);
	if (!existsSync(resolvedPath)) {
		if (required || overridePath !== undefined) {
			return {
				ok: false,
				error: `Merge-queue orchestration evidence file not found: ${configuredPath}`,
			};
		}
		return { ok: true, value: null };
	}
	const signaturePath = `${resolvedPath}.sig`;
	if (!existsSync(signaturePath)) {
		return {
			ok: false,
			error: `Merge-queue orchestration evidence signature is missing: ${configuredPath}.sig`,
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
		const content = readFileSync(resolvedPath, "utf-8");
		const signature = readFileSync(signaturePath, "utf-8").trim();
		if (!isHexDigest(signature)) {
			return {
				ok: false,
				error: `Merge-queue orchestration evidence signature must be a sha256 hex digest: ${configuredPath}.sig`,
			};
		}
		const expectedSignature = signContent(content, signingKeyResult.key);
		if (expectedSignature !== signature) {
			return {
				ok: false,
				error:
					"Merge-queue orchestration evidence signature mismatch. Refusing untrusted cutover evidence.",
			};
		}
		const parsed = JSON.parse(content) as unknown;
		if (!isValidMergeQueueCutoverEvidence(parsed, snapshotId)) {
			return {
				ok: false,
				error:
					"Merge-queue orchestration evidence schema is invalid for the requested snapshot id.",
			};
		}
		if (parsed.integrity.signingKeyId !== signingKeyResult.keyId) {
			return {
				ok: false,
				error:
					"Merge-queue orchestration evidence integrity signingKeyId does not match active signing key.",
			};
		}
		const expectedPayloadSha256 = hashContent(
			canonicalizeMergeQueueEvidenceForDigest(parsed),
		);
		if (parsed.integrity.payloadSha256 !== expectedPayloadSha256) {
			return {
				ok: false,
				error:
					"Merge-queue orchestration evidence integrity payloadSha256 does not match signed payload.",
			};
		}
		if (expectedBinding) {
			const binding = parsed.binding;
			if (
				binding.repoFullName !== expectedBinding.repoFullName ||
				binding.headSha !== expectedBinding.headSha ||
				binding.trustedPolicyRef !== expectedBinding.trustedPolicyRef ||
				binding.authorityConfigSha256 !==
					expectedBinding.authorityConfigSha256 ||
				binding.requiredCheckManifestSha256 !==
					expectedBinding.requiredCheckManifestSha256
			) {
				return {
					ok: false,
					error:
						"Merge-queue orchestration evidence binding does not match current repository/policy identity. Refusing replayed evidence.",
				};
			}
		}
		return {
			ok: true,
			value: {
				sourcePath: configuredPath,
				contentSha256: hashContent(content),
				evidence: parsed,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse merge-queue orchestration evidence: ${sanitizeError(error)}`,
		};
	}
}

function validateMergeQueueEvidenceLifecycle(
	record: MergeQueueEvidenceRecord,
	requireFullLifecycle: boolean,
): string[] {
	const violations: string[] = [];
	const pausedAtMs = Date.parse(record.evidence.pausedAt);
	const drainedAtMs =
		typeof record.evidence.drainedAt === "string"
			? Date.parse(record.evidence.drainedAt)
			: Number.NaN;
	const revalidatedAtMs =
		typeof record.evidence.revalidatedAt === "string"
			? Date.parse(record.evidence.revalidatedAt)
			: Number.NaN;
	if (Number.isFinite(drainedAtMs) && drainedAtMs < pausedAtMs) {
		violations.push(
			"Merge-queue orchestration evidence drainedAt must be on or after pausedAt.",
		);
	}
	if (
		Number.isFinite(revalidatedAtMs) &&
		((Number.isFinite(drainedAtMs) && revalidatedAtMs < drainedAtMs) ||
			revalidatedAtMs < pausedAtMs)
	) {
		violations.push(
			"Merge-queue orchestration evidence revalidatedAt must be on or after drainedAt/pausedAt.",
		);
	}
	if (requireFullLifecycle) {
		if (!Number.isFinite(drainedAtMs)) {
			violations.push(
				"Merge-queue orchestration evidence must include drainedAt for required-mode commit windows.",
			);
		}
		if (!Number.isFinite(revalidatedAtMs)) {
			violations.push(
				"Merge-queue orchestration evidence must include revalidatedAt for required-mode commit windows.",
			);
		}
		if (
			typeof record.evidence.drainedCandidateCount !== "number" ||
			record.evidence.drainedCandidateCount < 1
		) {
			violations.push(
				"Merge-queue orchestration evidence must include drainedCandidateCount >= 1 for required-mode commit windows.",
			);
		}
		if (
			typeof record.evidence.revalidatedCandidateCount !== "number" ||
			record.evidence.revalidatedCandidateCount < 1
		) {
			violations.push(
				"Merge-queue orchestration evidence must include revalidatedCandidateCount >= 1 for required-mode commit windows.",
			);
		}
	}
	return violations;
}

function deriveMergeQueueEvidenceBinding(
	targetDir: string,
):
	| { ok: true; value: MergeQueueEvidenceBinding }
	| { ok: false; error: string } {
	const policyResult = readContractProviderPolicy(targetDir);
	if (!policyResult.ok) {
		return { ok: false, error: policyResult.error };
	}
	const originUrl = readGitOriginUrl(targetDir);
	if (!originUrl) {
		return {
			ok: false,
			error:
				"Git origin URL is required to bind merge-queue orchestration evidence identity.",
		};
	}
	const repoFullName = normalizeRepoFullName(originUrl);
	if (!repoFullName) {
		return {
			ok: false,
			error: `Unsupported origin URL for merge-queue evidence binding: ${originUrl}`,
		};
	}
	const headShaResult = resolveGitRefToCommit(targetDir, "HEAD");
	if (!headShaResult.ok) {
		return { ok: false, error: headShaResult.error };
	}
	const trustedPolicyRefResult = resolveGitRefToCommit(
		targetDir,
		policyResult.value.trustedPolicyRef,
	);
	if (!trustedPolicyRefResult.ok) {
		return { ok: false, error: trustedPolicyRefResult.error };
	}
	const authorityDigestResult = readHashedPolicyFile(
		targetDir,
		policyResult.value.authorityConfigPath,
	);
	if (!authorityDigestResult.ok) {
		return { ok: false, error: authorityDigestResult.error };
	}
	const requiredManifestDigestResult = readHashedPolicyFile(
		targetDir,
		policyResult.value.requiredCheckManifestPath,
	);
	if (!requiredManifestDigestResult.ok) {
		return { ok: false, error: requiredManifestDigestResult.error };
	}
	return {
		ok: true,
		value: {
			repoFullName,
			headSha: headShaResult.commitSha,
			trustedPolicyRef: trustedPolicyRefResult.commitSha,
			authorityConfigSha256: authorityDigestResult.digest,
			requiredCheckManifestSha256: requiredManifestDigestResult.digest,
		},
	};
}

function runMergeQueueOrchestrator(
	targetDir: string,
	orchestratorPath: string,
	snapshotId: string,
	evidencePath: string,
	requireFullLifecycle: boolean,
	binding: MergeQueueEvidenceBinding,
	signingKey: string,
): { ok: true } | { ok: false; error: string } {
	const resolvedOrchestratorPath = resolve(targetDir, orchestratorPath);
	if (!existsSync(resolvedOrchestratorPath)) {
		return {
			ok: false,
			error: `Merge-queue orchestrator executable not found: ${orchestratorPath}`,
		};
	}
	const resolvedEvidencePath = resolve(targetDir, evidencePath);
	const args = [
		"--snapshot",
		snapshotId,
		"--evidence-path",
		resolvedEvidencePath,
		"--require-full-lifecycle",
		requireFullLifecycle ? "true" : "false",
	];
	const orchestratorResult = spawnSync(resolvedOrchestratorPath, args, {
		cwd: targetDir,
		encoding: "utf-8",
		env: {
			...env,
			HARNESS_CI_MIGRATE_SNAPSHOT_ID: snapshotId,
			HARNESS_CI_MIGRATE_EVIDENCE_PATH: resolvedEvidencePath,
			HARNESS_CI_MIGRATE_EVIDENCE_REL_PATH: evidencePath,
			HARNESS_CI_MIGRATE_REQUIRE_FULL_LIFECYCLE: requireFullLifecycle
				? "1"
				: "0",
			HARNESS_CI_MIGRATE_SIGNING_KEY: signingKey,
			HARNESS_CI_MIGRATE_BINDING_REPO_FULL_NAME: binding.repoFullName,
			HARNESS_CI_MIGRATE_BINDING_HEAD_SHA: binding.headSha,
			HARNESS_CI_MIGRATE_BINDING_TRUSTED_POLICY_REF: binding.trustedPolicyRef,
			HARNESS_CI_MIGRATE_BINDING_AUTHORITY_CONFIG_SHA256:
				binding.authorityConfigSha256,
			HARNESS_CI_MIGRATE_BINDING_REQUIRED_CHECK_MANIFEST_SHA256:
				binding.requiredCheckManifestSha256,
		},
	});
	if (orchestratorResult.error) {
		return {
			ok: false,
			error: `Failed to execute merge-queue orchestrator: ${sanitizeError(orchestratorResult.error)}`,
		};
	}
	if (orchestratorResult.status !== 0) {
		const stderr = orchestratorResult.stderr?.trim() ?? "";
		const stdout = orchestratorResult.stdout?.trim() ?? "";
		const detail = stderr.length > 0 ? stderr : stdout;
		return {
			ok: false,
			error:
				detail.length > 0
					? `Merge-queue orchestrator failed: ${detail}`
					: "Merge-queue orchestrator exited non-zero.",
		};
	}
	if (!existsSync(resolvedEvidencePath)) {
		return {
			ok: false,
			error: `Merge-queue orchestrator did not emit evidence file: ${evidencePath}`,
		};
	}
	if (!existsSync(`${resolvedEvidencePath}.sig`)) {
		return {
			ok: false,
			error: `Merge-queue orchestrator did not emit evidence signature: ${evidencePath}.sig`,
		};
	}
	return { ok: true };
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
		error: `Unsupported ci-migrate action: ${value}. Expected prepare, commit, abort, or verify.`,
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

	if (action === "verify") {
		if (options.apply === true || options.rollback === true) {
			return {
				ok: false,
				error:
					"Action 'verify' conflicts with --apply/--rollback. Use action alone or --dry-run.",
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
	options?: { strict?: boolean | undefined },
): { ok: true; value: CIProviderPolicyConfig } | { ok: false; error: string } {
	const strictMode = options?.strict === true;
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
						migrationStage?: string | undefined;
						transitionStatusArtifactPath?: string | undefined;
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
		let migrationStage: CIProviderMigrationStage;
		if (
			policy.migrationStage === "dual-provider" ||
			policy.migrationStage === "circleci-primary" ||
			policy.migrationStage === "circleci-only"
		) {
			migrationStage = policy.migrationStage;
		} else if (strictMode) {
			return {
				ok: false,
				error:
					"ciProviderPolicy.migrationStage must be one of dual-provider, circleci-primary, or circleci-only.",
			};
		} else {
			migrationStage = "dual-provider";
		}
		let transitionStatusArtifactPath: string;
		if (
			typeof policy.transitionStatusArtifactPath === "string" &&
			policy.transitionStatusArtifactPath.trim().length > 0
		) {
			transitionStatusArtifactPath = policy.transitionStatusArtifactPath.trim();
		} else if (strictMode) {
			return {
				ok: false,
				error:
					"ciProviderPolicy.transitionStatusArtifactPath is required and cannot be empty.",
			};
		} else {
			transitionStatusArtifactPath = DEFAULT_TRANSITION_STATUS_ARTIFACT_PATH;
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
				migrationStage,
				transitionStatusArtifactPath,
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

function parseParityProofPackInput(
	content: string,
): { ok: true; value: CIParityProofPackInput } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return {
				ok: false,
				error: "Parity proof pack input must be a JSON object.",
			};
		}
		const record = parsed as Record<string, unknown>;
		if (record.schemaVersion !== "ci-parity-proof-input/v1") {
			return {
				ok: false,
				error:
					"Parity proof pack input schemaVersion must be ci-parity-proof-input/v1.",
			};
		}
		if (
			record.generatedAt !== undefined &&
			(typeof record.generatedAt !== "string" ||
				!Number.isFinite(Date.parse(record.generatedAt)))
		) {
			return {
				ok: false,
				error:
					"Parity proof pack input generatedAt must be a valid ISO timestamp when provided.",
			};
		}
		const behavioralParity = record.behavioralParity;
		const scenarios = (behavioralParity as { scenarios?: unknown })?.scenarios;
		if (!behavioralParity || !Array.isArray(scenarios)) {
			return {
				ok: false,
				error:
					"Parity proof pack input behavioralParity.scenarios must be an array.",
			};
		}
		const parsedScenarios: CIParityScenarioEvidence[] = [];
		for (const scenario of scenarios) {
			if (!scenario || typeof scenario !== "object") {
				return {
					ok: false,
					error: "Parity proof pack input scenarios must be objects.",
				};
			}
			const scenarioRecord = scenario as Record<string, unknown>;
			if (
				typeof scenarioRecord.scenario !== "string" ||
				!isRequiredParityScenario(scenarioRecord.scenario)
			) {
				return {
					ok: false,
					error:
						"Parity proof pack input scenarios must use supported scenario ids.",
				};
			}
			if (!isCIProviderArray(scenarioRecord.providersCompared)) {
				return {
					ok: false,
					error:
						"Parity proof pack input scenario providersCompared must be a CI provider array.",
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
						"Parity proof pack input scenario commitCount must be a positive integer.",
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
						"Parity proof pack input scenario unexpectedDiffs must be an array of strings.",
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
				error: "Parity proof pack input promotionGate section is required.",
			};
		}
		const gateRecord = promotionGate as Record<string, unknown>;
		const gateFields = [
			"zeroUnexpectedDiffs",
			"outcomeParity",
			"skippedSemanticsParity",
			"artifactParity",
			"greptileParity",
			"releaseParity",
		] as const;
		for (const field of gateFields) {
			if (typeof gateRecord[field] !== "boolean") {
				return {
					ok: false,
					error: `Parity proof pack input promotionGate.${field} must be a boolean.`,
				};
			}
		}

		const downstream = record.downstream;
		const repositories = (downstream as { repositories?: unknown })
			?.repositories;
		if (!downstream || !Array.isArray(repositories)) {
			return {
				ok: false,
				error:
					"Parity proof pack input downstream.repositories must be an array.",
			};
		}
		const parsedRepositories: CIParityDownstreamRepositoryEvidence[] = [];
		for (const repository of repositories) {
			if (!repository || typeof repository !== "object") {
				return {
					ok: false,
					error:
						"Parity proof pack input downstream repository entries must be objects.",
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
						"Parity proof pack input downstream repositories require a non-empty repo field.",
				};
			}
			if (
				typeof repositoryRecord.ecosystemProfile !== "string" ||
				repositoryRecord.ecosystemProfile.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity proof pack input downstream repositories require a non-empty ecosystemProfile field.",
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
						"Parity proof pack input downstream repository booleans are required.",
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

		const repoRecord =
			record.repo && typeof record.repo === "object"
				? (record.repo as Record<string, unknown>)
				: null;
		const repo =
			repoRecord === null
				? null
				: {
						baseSha:
							typeof repoRecord.baseSha === "string"
								? repoRecord.baseSha
								: undefined,
						headSha:
							typeof repoRecord.headSha === "string"
								? repoRecord.headSha
								: undefined,
						fullName:
							typeof repoRecord.fullName === "string"
								? repoRecord.fullName
								: undefined,
						originUrl:
							typeof repoRecord.originUrl === "string"
								? repoRecord.originUrl
								: undefined,
					};

		return {
			ok: true,
			value: {
				schemaVersion: "ci-parity-proof-input/v1",
				generatedAt:
					typeof record.generatedAt === "string"
						? record.generatedAt
						: undefined,
				repo,
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
			error: `Failed to parse parity proof pack input JSON: ${sanitizeError(error)}`,
		};
	}
}

function parseParityProvenanceInput(
	content: string,
): { ok: true; value: CIParityProvenanceInput } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return {
				ok: false,
				error: "Parity provenance input must be a JSON object.",
			};
		}
		const record = parsed as Record<string, unknown>;
		if (record.schemaVersion !== PARITY_PROVENANCE_INPUT_SCHEMA_VERSION) {
			return {
				ok: false,
				error: `Parity provenance input schemaVersion must be ${PARITY_PROVENANCE_INPUT_SCHEMA_VERSION}.`,
			};
		}
		if (
			record.generatedAt !== undefined &&
			(typeof record.generatedAt !== "string" ||
				!Number.isFinite(Date.parse(record.generatedAt)))
		) {
			return {
				ok: false,
				error:
					"Parity provenance input generatedAt must be a valid ISO timestamp when provided.",
			};
		}
		const parsedProofInputResult = parseParityProofPackInput(
			JSON.stringify({
				schemaVersion: "ci-parity-proof-input/v1",
				generatedAt:
					typeof record.generatedAt === "string"
						? record.generatedAt
						: undefined,
				repo: record.repo,
				behavioralParity: record.behavioralParity,
				promotionGate: record.promotionGate,
				downstream: record.downstream,
			}),
		);
		if (!parsedProofInputResult.ok) {
			return { ok: false, error: parsedProofInputResult.error };
		}
		if (!Array.isArray(record.artifacts) || record.artifacts.length === 0) {
			return {
				ok: false,
				error: "Parity provenance input artifacts must be a non-empty array.",
			};
		}
		const artifacts: CIParityProvenanceInputArtifact[] = [];
		const artifactIds = new Set<string>();
		for (const artifact of record.artifacts) {
			if (!artifact || typeof artifact !== "object") {
				return {
					ok: false,
					error: "Parity provenance input artifact entries must be objects.",
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
						"Parity provenance input artifact entries require a non-empty artifactId.",
				};
			}
			if (artifactIds.has(artifactRecord.artifactId)) {
				return {
					ok: false,
					error: `Parity provenance input artifactId must be unique. Duplicate: ${artifactRecord.artifactId}.`,
				};
			}
			artifactIds.add(artifactRecord.artifactId);
			if (
				typeof artifactRecord.path !== "string" ||
				artifactRecord.path.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact entries require a non-empty path.",
				};
			}
			if (
				artifactRecord.sourceProvider !== "github-actions" &&
				artifactRecord.sourceProvider !== "circleci"
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact sourceProvider must be github-actions or circleci.",
				};
			}
			if (
				typeof artifactRecord.sourceRunId !== "string" ||
				artifactRecord.sourceRunId.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact sourceRunId must be a non-empty string.",
				};
			}
			if (
				typeof artifactRecord.sourceWorkflowRef !== "string" ||
				artifactRecord.sourceWorkflowRef.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact sourceWorkflowRef must be a non-empty string.",
				};
			}
			if (
				artifactRecord.sourceCommitSha !== undefined &&
				(typeof artifactRecord.sourceCommitSha !== "string" ||
					!isCommitSha(artifactRecord.sourceCommitSha))
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact sourceCommitSha must be a 40-character lowercase commit SHA when provided.",
				};
			}
			if (
				artifactRecord.capturedAt !== undefined &&
				(typeof artifactRecord.capturedAt !== "string" ||
					!Number.isFinite(Date.parse(artifactRecord.capturedAt)))
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact capturedAt must be a valid ISO timestamp when provided.",
				};
			}
			if (
				artifactRecord.scenario !== undefined &&
				(typeof artifactRecord.scenario !== "string" ||
					!isRequiredParityScenario(artifactRecord.scenario))
			) {
				return {
					ok: false,
					error:
						"Parity provenance input artifact scenario must use supported scenario ids when provided.",
				};
			}
			artifacts.push({
				artifactId: artifactRecord.artifactId,
				path: artifactRecord.path,
				sourceProvider: artifactRecord.sourceProvider,
				sourceRunId: artifactRecord.sourceRunId,
				sourceWorkflowRef: artifactRecord.sourceWorkflowRef,
				sourceCommitSha:
					typeof artifactRecord.sourceCommitSha === "string"
						? artifactRecord.sourceCommitSha
						: undefined,
				capturedAt:
					typeof artifactRecord.capturedAt === "string"
						? artifactRecord.capturedAt
						: undefined,
				scenario:
					typeof artifactRecord.scenario === "string"
						? artifactRecord.scenario
						: undefined,
			});
		}
		return {
			ok: true,
			value: {
				schemaVersion: PARITY_PROVENANCE_INPUT_SCHEMA_VERSION,
				generatedAt:
					typeof record.generatedAt === "string"
						? record.generatedAt
						: undefined,
				repo: parsedProofInputResult.value.repo ?? undefined,
				behavioralParity: parsedProofInputResult.value.behavioralParity,
				promotionGate: parsedProofInputResult.value.promotionGate,
				downstream: parsedProofInputResult.value.downstream,
				artifacts,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse parity provenance input JSON: ${sanitizeError(error)}`,
		};
	}
}

function canonicalizeParityProvenanceArtifactIndexForDigest(
	index: CIParityProvenanceArtifactIndex,
): string {
	return JSON.stringify({
		schemaVersion: index.schemaVersion,
		generatedAt: index.generatedAt,
		repo: index.repo,
		behavioralParity: index.behavioralParity,
		promotionGate: index.promotionGate,
		downstream: index.downstream,
		artifacts: index.artifacts.map((artifact) => ({
			artifactId: artifact.artifactId,
			path: artifact.path,
			sha256: artifact.sha256,
			signature: artifact.signature,
			sourceProvider: artifact.sourceProvider,
			sourceRunId: artifact.sourceRunId,
			sourceWorkflowRef: artifact.sourceWorkflowRef,
			sourceCommitSha: artifact.sourceCommitSha,
			capturedAt: artifact.capturedAt,
			scenario: artifact.scenario,
		})),
		integrity: {
			signatureAlgorithm: index.integrity.signatureAlgorithm,
			signingKeyId: index.integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function parseParityProvenanceArtifactIndex(content: string):
	| { ok: true; value: CIParityProvenanceArtifactIndex }
	| {
			ok: false;
			error: string;
	  } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return {
				ok: false,
				error: "Parity provenance artifact index must be a JSON object.",
			};
		}
		const record = parsed as Record<string, unknown>;
		if (
			record.schemaVersion !== PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION
		) {
			return {
				ok: false,
				error: `Parity provenance artifact index schemaVersion must be ${PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION}.`,
			};
		}
		if (
			typeof record.generatedAt !== "string" ||
			!Number.isFinite(Date.parse(record.generatedAt))
		) {
			return {
				ok: false,
				error:
					"Parity provenance artifact index generatedAt must be a valid ISO timestamp.",
			};
		}
		const parsedInputResult = parseParityProvenanceInput(
			JSON.stringify({
				schemaVersion: PARITY_PROVENANCE_INPUT_SCHEMA_VERSION,
				generatedAt: record.generatedAt,
				repo: record.repo ?? undefined,
				behavioralParity: record.behavioralParity,
				promotionGate: record.promotionGate,
				downstream: record.downstream,
				artifacts:
					Array.isArray(record.artifacts) && record.artifacts.length > 0
						? record.artifacts.map((artifact) => ({
								artifactId:
									typeof artifact === "object" &&
									artifact !== null &&
									"artifactId" in artifact
										? (artifact as Record<string, unknown>).artifactId
										: undefined,
								path:
									typeof artifact === "object" &&
									artifact !== null &&
									"path" in artifact
										? (artifact as Record<string, unknown>).path
										: undefined,
								sourceProvider:
									typeof artifact === "object" &&
									artifact !== null &&
									"sourceProvider" in artifact
										? (artifact as Record<string, unknown>).sourceProvider
										: undefined,
								sourceRunId:
									typeof artifact === "object" &&
									artifact !== null &&
									"sourceRunId" in artifact
										? (artifact as Record<string, unknown>).sourceRunId
										: undefined,
								sourceWorkflowRef:
									typeof artifact === "object" &&
									artifact !== null &&
									"sourceWorkflowRef" in artifact
										? (artifact as Record<string, unknown>).sourceWorkflowRef
										: undefined,
								sourceCommitSha:
									typeof artifact === "object" &&
									artifact !== null &&
									"sourceCommitSha" in artifact
										? (artifact as Record<string, unknown>).sourceCommitSha
										: undefined,
								capturedAt:
									typeof artifact === "object" &&
									artifact !== null &&
									"capturedAt" in artifact
										? (artifact as Record<string, unknown>).capturedAt
										: undefined,
								scenario:
									typeof artifact === "object" &&
									artifact !== null &&
									"scenario" in artifact
										? (artifact as Record<string, unknown>).scenario
										: undefined,
							}))
						: record.artifacts,
			}),
		);
		if (!parsedInputResult.ok) {
			return { ok: false, error: parsedInputResult.error };
		}
		if (!Array.isArray(record.artifacts) || record.artifacts.length === 0) {
			return {
				ok: false,
				error:
					"Parity provenance artifact index artifacts must be a non-empty array.",
			};
		}
		const artifacts: CIParityProvenanceArtifactRecord[] = [];
		const artifactIds = new Set<string>();
		for (const artifactEntry of record.artifacts) {
			if (!artifactEntry || typeof artifactEntry !== "object") {
				return {
					ok: false,
					error:
						"Parity provenance artifact index artifact entries must be objects.",
				};
			}
			const artifactRecord = artifactEntry as Record<string, unknown>;
			if (
				typeof artifactRecord.artifactId !== "string" ||
				artifactRecord.artifactId.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact index artifact entries require a non-empty artifactId.",
				};
			}
			if (artifactIds.has(artifactRecord.artifactId)) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifactId must be unique. Duplicate: ${artifactRecord.artifactId}.`,
				};
			}
			artifactIds.add(artifactRecord.artifactId);
			if (
				typeof artifactRecord.sha256 !== "string" ||
				!isHexDigest(artifactRecord.sha256)
			) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact sha256 is invalid for ${artifactRecord.artifactId}.`,
				};
			}
			if (
				typeof artifactRecord.signature !== "string" ||
				!isHexDigest(artifactRecord.signature)
			) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact signature is invalid for ${artifactRecord.artifactId}.`,
				};
			}
			if (
				typeof artifactRecord.sourceCommitSha !== "string" ||
				!isCommitSha(artifactRecord.sourceCommitSha)
			) {
				return {
					ok: false,
					error: `Parity provenance artifact index sourceCommitSha is invalid for ${artifactRecord.artifactId}.`,
				};
			}
			if (
				typeof artifactRecord.capturedAt !== "string" ||
				!Number.isFinite(Date.parse(artifactRecord.capturedAt))
			) {
				return {
					ok: false,
					error: `Parity provenance artifact index capturedAt must be a valid ISO timestamp for ${artifactRecord.artifactId}.`,
				};
			}
			const baseArtifact = parsedInputResult.value.artifacts.find(
				(candidate) => candidate.artifactId === artifactRecord.artifactId,
			);
			if (!baseArtifact) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact ${artifactRecord.artifactId} is missing normalized metadata.`,
				};
			}
			artifacts.push({
				artifactId: baseArtifact.artifactId,
				path: baseArtifact.path,
				sha256: artifactRecord.sha256,
				signature: artifactRecord.signature,
				sourceProvider: baseArtifact.sourceProvider,
				sourceRunId: baseArtifact.sourceRunId,
				sourceWorkflowRef: baseArtifact.sourceWorkflowRef,
				sourceCommitSha: artifactRecord.sourceCommitSha,
				capturedAt: artifactRecord.capturedAt,
				scenario: baseArtifact.scenario,
			});
		}
		const integrity =
			record.integrity && typeof record.integrity === "object"
				? (record.integrity as Record<string, unknown>)
				: null;
		if (
			!integrity ||
			integrity.signatureAlgorithm !== PARITY_PROOF_PACK_SIGNATURE_ALGORITHM ||
			typeof integrity.signingKeyId !== "string" ||
			!HEX_TOKEN_PATTERN.test(integrity.signingKeyId) ||
			typeof integrity.payloadSha256 !== "string" ||
			!isHexDigest(integrity.payloadSha256)
		) {
			return {
				ok: false,
				error:
					"Parity provenance artifact index integrity metadata is invalid.",
			};
		}
		return {
			ok: true,
			value: {
				schemaVersion: PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION,
				generatedAt: record.generatedAt,
				repo: parsedInputResult.value.repo ?? undefined,
				behavioralParity: parsedInputResult.value.behavioralParity,
				promotionGate: parsedInputResult.value.promotionGate,
				downstream: parsedInputResult.value.downstream,
				artifacts,
				integrity: {
					signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
					signingKeyId: integrity.signingKeyId,
					payloadSha256: integrity.payloadSha256,
				},
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse parity provenance artifact index: ${sanitizeError(error)}`,
		};
	}
}

function materializeProvenanceInputFromArtifactIndex(
	targetDir: string,
	signingKey: string,
	signingKeyId: string,
): { ok: true } | { ok: false; error: string } {
	const artifactIndexPath = resolve(
		targetDir,
		PARITY_PROVENANCE_ARTIFACT_INDEX_PATH,
	);
	const artifactIndexSignaturePath = resolve(
		targetDir,
		PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH,
	);
	if (!existsSync(artifactIndexPath)) {
		return {
			ok: false,
			error: `Missing parity provenance artifact index: ${PARITY_PROVENANCE_ARTIFACT_INDEX_PATH}`,
		};
	}
	if (!existsSync(artifactIndexSignaturePath)) {
		return {
			ok: false,
			error: `Missing parity provenance artifact index signature: ${PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH}`,
		};
	}
	try {
		const artifactIndexContent = readFileSync(artifactIndexPath, "utf-8");
		const artifactIndexSignature = readFileSync(
			artifactIndexSignaturePath,
			"utf-8",
		).trim();
		if (!isHexDigest(artifactIndexSignature)) {
			return {
				ok: false,
				error: `Parity provenance artifact index signature must be a sha256 hex digest: ${PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH}`,
			};
		}
		const expectedSignature = signContent(artifactIndexContent, signingKey);
		if (artifactIndexSignature !== expectedSignature) {
			return {
				ok: false,
				error:
					"Parity provenance artifact index signature mismatch. Refusing untrusted provenance automation input.",
			};
		}
		const parsedIndexResult =
			parseParityProvenanceArtifactIndex(artifactIndexContent);
		if (!parsedIndexResult.ok) {
			return { ok: false, error: parsedIndexResult.error };
		}
		const index = parsedIndexResult.value;
		if (index.integrity.signingKeyId !== signingKeyId) {
			return {
				ok: false,
				error:
					"Parity provenance artifact index integrity signingKeyId does not match active signing key.",
			};
		}
		const expectedPayloadSha256 = hashContent(
			canonicalizeParityProvenanceArtifactIndexForDigest(index),
		);
		if (index.integrity.payloadSha256 !== expectedPayloadSha256) {
			return {
				ok: false,
				error:
					"Parity provenance artifact index payloadSha256 does not match signed payload.",
			};
		}
		const normalizedArtifacts: CIParityProvenanceInputArtifact[] = [];
		for (const artifact of index.artifacts) {
			if (!isSafeProofArtifactPath(targetDir, artifact.path)) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact path escapes repository root: ${artifact.path}`,
				};
			}
			const artifactAbsolutePath = resolve(targetDir, artifact.path);
			if (!existsSync(artifactAbsolutePath)) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact missing from repository: ${artifact.path}`,
				};
			}
			const artifactContent = readFileSync(artifactAbsolutePath, "utf-8");
			const artifactSha256 = hashContent(artifactContent);
			if (artifact.sha256 !== artifactSha256) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact digest mismatch for ${artifact.path}.`,
				};
			}
			const expectedArtifactSignature = signContent(
				`${artifact.path}:${artifact.sha256}:${artifact.sourceProvider}:${artifact.sourceRunId}:${artifact.sourceCommitSha}:${artifact.capturedAt}`,
				signingKey,
			);
			if (artifact.signature !== expectedArtifactSignature) {
				return {
					ok: false,
					error: `Parity provenance artifact index artifact signature mismatch for ${artifact.path}.`,
				};
			}
			normalizedArtifacts.push({
				artifactId: artifact.artifactId,
				path: artifact.path,
				sourceProvider: artifact.sourceProvider,
				sourceRunId: artifact.sourceRunId,
				sourceWorkflowRef: artifact.sourceWorkflowRef,
				sourceCommitSha: artifact.sourceCommitSha,
				capturedAt: artifact.capturedAt,
				scenario: artifact.scenario,
			});
		}
		const provenanceInput: CIParityProvenanceInput = {
			schemaVersion: PARITY_PROVENANCE_INPUT_SCHEMA_VERSION,
			generatedAt: index.generatedAt,
			repo: index.repo,
			behavioralParity: index.behavioralParity,
			promotionGate: index.promotionGate,
			downstream: index.downstream,
			artifacts: normalizedArtifacts,
		};
		const provenanceInputPath = resolve(
			targetDir,
			PARITY_PROVENANCE_INPUT_PATH,
		);
		mkdirSync(dirname(provenanceInputPath), { recursive: true });
		writeFileSync(
			provenanceInputPath,
			JSON.stringify(provenanceInput, null, 2),
		);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to materialize provenance input from artifact index: ${sanitizeError(error)}`,
		};
	}
}

function materializeArtifactIndexFromProvenanceInput(
	targetDir: string,
	signingKey: string,
	signingKeyId: string,
): { ok: true } | { ok: false; error: string } {
	const provenanceInputPath = resolve(targetDir, PARITY_PROVENANCE_INPUT_PATH);
	if (!existsSync(provenanceInputPath)) {
		return {
			ok: false,
			error: `Missing parity provenance input: ${PARITY_PROVENANCE_INPUT_PATH}`,
		};
	}
	try {
		const inputContent = readFileSync(provenanceInputPath, "utf-8");
		const parsedInputResult = parseParityProvenanceInput(inputContent);
		if (!parsedInputResult.ok) {
			return { ok: false, error: parsedInputResult.error };
		}
		const input = parsedInputResult.value;
		const generatedAt = input.generatedAt ?? new Date().toISOString();
		const fallbackSourceCommitSha = input.repo?.headSha;
		const sourceCommitShaResult =
			typeof fallbackSourceCommitSha === "string" &&
			isCommitSha(fallbackSourceCommitSha)
				? { ok: true as const, commitSha: fallbackSourceCommitSha }
				: resolveGitRefToCommit(targetDir, "HEAD");
		if (
			!sourceCommitShaResult.ok ||
			!isCommitSha(sourceCommitShaResult.commitSha)
		) {
			return {
				ok: false,
				error: sourceCommitShaResult.ok
					? "Parity provenance input fallback source commit SHA must be a 40-character lowercase commit SHA."
					: sourceCommitShaResult.error,
			};
		}
		const artifacts: CIParityProvenanceArtifactRecord[] = [];
		const artifactIds = new Set<string>();
		for (const artifact of input.artifacts) {
			if (artifactIds.has(artifact.artifactId)) {
				return {
					ok: false,
					error: `Parity provenance input artifactId must be unique. Duplicate: ${artifact.artifactId}.`,
				};
			}
			artifactIds.add(artifact.artifactId);
			if (!isSafeProofArtifactPath(targetDir, artifact.path)) {
				return {
					ok: false,
					error: `Parity provenance input artifact path escapes repository root: ${artifact.path}`,
				};
			}
			const artifactAbsolutePath = resolve(targetDir, artifact.path);
			if (!existsSync(artifactAbsolutePath)) {
				return {
					ok: false,
					error: `Parity provenance input artifact missing from repository: ${artifact.path}`,
				};
			}
			const artifactContent = readFileSync(artifactAbsolutePath, "utf-8");
			const sha256 = hashContent(artifactContent);
			const sourceCommitSha =
				artifact.sourceCommitSha ?? sourceCommitShaResult.commitSha;
			if (!isCommitSha(sourceCommitSha)) {
				return {
					ok: false,
					error: `Parity provenance input artifact sourceCommitSha is invalid for ${artifact.artifactId}.`,
				};
			}
			const capturedAt = artifact.capturedAt ?? generatedAt;
			if (!Number.isFinite(Date.parse(capturedAt))) {
				return {
					ok: false,
					error: `Parity provenance input artifact capturedAt is invalid for ${artifact.artifactId}.`,
				};
			}
			artifacts.push({
				artifactId: artifact.artifactId,
				path: artifact.path,
				sha256,
				signature: signContent(
					`${artifact.path}:${sha256}:${artifact.sourceProvider}:${artifact.sourceRunId}:${sourceCommitSha}:${capturedAt}`,
					signingKey,
				),
				sourceProvider: artifact.sourceProvider,
				sourceRunId: artifact.sourceRunId,
				sourceWorkflowRef: artifact.sourceWorkflowRef,
				sourceCommitSha,
				capturedAt,
				scenario: artifact.scenario,
			});
		}
		const indexBase: CIParityProvenanceArtifactIndex = {
			schemaVersion: PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION,
			generatedAt,
			repo: input.repo,
			behavioralParity: input.behavioralParity,
			promotionGate: input.promotionGate,
			downstream: input.downstream,
			artifacts,
			integrity: {
				signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
				signingKeyId,
				payloadSha256: "",
			},
		};
		const payloadSha256 = hashContent(
			canonicalizeParityProvenanceArtifactIndexForDigest(indexBase),
		);
		const index: CIParityProvenanceArtifactIndex = {
			...indexBase,
			integrity: {
				...indexBase.integrity,
				payloadSha256,
			},
		};
		const indexContent = JSON.stringify(index, null, 2);
		const indexPath = resolve(targetDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH);
		const signaturePath = resolve(
			targetDir,
			PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH,
		);
		mkdirSync(dirname(indexPath), { recursive: true });
		writeFileSync(indexPath, indexContent);
		writeFileSync(signaturePath, `${signContent(indexContent, signingKey)}\n`);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to materialize artifact index from provenance input: ${sanitizeError(error)}`,
		};
	}
}

function materializeArtifactIndexFromProvenanceBundle(
	targetDir: string,
	signingKey: string,
	signingKeyId: string,
): { ok: true } | { ok: false; error: string } {
	const provenanceBundlePath = resolve(
		targetDir,
		PARITY_PROVENANCE_BUNDLE_PATH,
	);
	if (!existsSync(provenanceBundlePath)) {
		return {
			ok: false,
			error: `Missing parity provenance bundle: ${PARITY_PROVENANCE_BUNDLE_PATH}`,
		};
	}
	try {
		const bundleContent = readFileSync(provenanceBundlePath, "utf-8");
		const parsedBundleResult = parseParityProvenanceBundle(bundleContent);
		if (!parsedBundleResult.ok) {
			return { ok: false, error: parsedBundleResult.error };
		}
		const bundle = parsedBundleResult.value;
		for (const artifact of bundle.artifacts) {
			if (!isSafeProofArtifactPath(targetDir, artifact.path)) {
				return {
					ok: false,
					error: `Parity provenance artifact path escapes repository root: ${artifact.path}`,
				};
			}
			const artifactAbsolutePath = resolve(targetDir, artifact.path);
			if (!existsSync(artifactAbsolutePath)) {
				return {
					ok: false,
					error: `Parity provenance artifact missing from repository: ${artifact.path}`,
				};
			}
			const artifactContent = readFileSync(artifactAbsolutePath, "utf-8");
			const computedDigest = hashContent(artifactContent);
			if (computedDigest !== artifact.sha256) {
				return {
					ok: false,
					error: `Parity provenance artifact digest mismatch for ${artifact.path}.`,
				};
			}
			const expectedSignature = signContent(
				`${artifact.path}:${artifact.sha256}:${artifact.sourceProvider}:${artifact.sourceRunId}:${artifact.sourceCommitSha}:${artifact.capturedAt}`,
				signingKey,
			);
			if (expectedSignature !== artifact.signature) {
				return {
					ok: false,
					error: `Parity provenance artifact signature mismatch for ${artifact.path}.`,
				};
			}
		}
		const indexBase: CIParityProvenanceArtifactIndex = {
			schemaVersion: PARITY_PROVENANCE_ARTIFACT_INDEX_SCHEMA_VERSION,
			generatedAt: bundle.generatedAt,
			repo: bundle.repo,
			behavioralParity: bundle.behavioralParity,
			promotionGate: bundle.promotionGate,
			downstream: bundle.downstream,
			artifacts: bundle.artifacts,
			integrity: {
				signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
				signingKeyId,
				payloadSha256: "",
			},
		};
		const payloadSha256 = hashContent(
			canonicalizeParityProvenanceArtifactIndexForDigest(indexBase),
		);
		const index: CIParityProvenanceArtifactIndex = {
			...indexBase,
			integrity: {
				...indexBase.integrity,
				payloadSha256,
			},
		};
		const indexContent = JSON.stringify(index, null, 2);
		const indexPath = resolve(targetDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH);
		const signaturePath = resolve(
			targetDir,
			PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH,
		);
		mkdirSync(dirname(indexPath), { recursive: true });
		writeFileSync(indexPath, indexContent);
		writeFileSync(signaturePath, `${signContent(indexContent, signingKey)}\n`);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to materialize artifact index from provenance bundle: ${sanitizeError(error)}`,
		};
	}
}

function materializeProvenanceBundleFromInput(
	targetDir: string,
	signingKey: string,
): { ok: true } | { ok: false; error: string } {
	const inputPath = resolve(targetDir, PARITY_PROVENANCE_INPUT_PATH);
	if (!existsSync(inputPath)) {
		return {
			ok: false,
			error: `Missing parity provenance input: ${PARITY_PROVENANCE_INPUT_PATH}`,
		};
	}
	const inputContent = readFileSync(inputPath, "utf-8");
	const parsedInputResult = parseParityProvenanceInput(inputContent);
	if (!parsedInputResult.ok) {
		return { ok: false, error: parsedInputResult.error };
	}
	const input = parsedInputResult.value;
	const generatedAt = input.generatedAt ?? new Date().toISOString();
	let fallbackSourceCommitSha = input.repo?.headSha;
	if (!fallbackSourceCommitSha) {
		const headShaResult = resolveGitRefToCommit(targetDir, "HEAD");
		if (!headShaResult.ok) {
			return { ok: false, error: headShaResult.error };
		}
		fallbackSourceCommitSha = headShaResult.commitSha;
	}
	if (!isCommitSha(fallbackSourceCommitSha)) {
		return {
			ok: false,
			error:
				"Parity provenance input fallback source commit SHA must be a 40-character lowercase commit SHA.",
		};
	}
	const artifacts: CIParityProvenanceArtifactRecord[] = [];
	for (const artifact of input.artifacts) {
		if (!isSafeProofArtifactPath(targetDir, artifact.path)) {
			return {
				ok: false,
				error: `Parity provenance input artifact path escapes repository root: ${artifact.path}`,
			};
		}
		const sourcePath = resolve(targetDir, artifact.path);
		if (!existsSync(sourcePath)) {
			return {
				ok: false,
				error: `Parity provenance input artifact missing from repository: ${artifact.path}`,
			};
		}
		const sourceContent = readFileSync(sourcePath, "utf-8");
		const sha256 = hashContent(sourceContent);
		const sourceCommitSha = artifact.sourceCommitSha ?? fallbackSourceCommitSha;
		if (!isCommitSha(sourceCommitSha)) {
			return {
				ok: false,
				error: `Parity provenance input artifact sourceCommitSha is invalid for ${artifact.artifactId}.`,
			};
		}
		const capturedAt = artifact.capturedAt ?? generatedAt;
		artifacts.push({
			artifactId: artifact.artifactId,
			path: artifact.path,
			sha256,
			signature: signContent(
				`${artifact.path}:${sha256}:${artifact.sourceProvider}:${artifact.sourceRunId}:${sourceCommitSha}:${capturedAt}`,
				signingKey,
			),
			sourceProvider: artifact.sourceProvider,
			sourceRunId: artifact.sourceRunId,
			sourceWorkflowRef: artifact.sourceWorkflowRef,
			sourceCommitSha,
			capturedAt,
			scenario: artifact.scenario,
		});
	}
	const bundle: CIParityProvenanceBundle = {
		schemaVersion: PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION,
		generatedAt,
		repo: input.repo,
		behavioralParity: input.behavioralParity,
		promotionGate: input.promotionGate,
		downstream: input.downstream,
		artifacts,
	};
	const bundlePath = resolve(targetDir, PARITY_PROVENANCE_BUNDLE_PATH);
	mkdirSync(dirname(bundlePath), { recursive: true });
	writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
	return { ok: true };
}

function canonicalizeParityProvenanceManifestForDigest(
	manifest: CIParityProvenanceManifest,
): string {
	return JSON.stringify({
		schemaVersion: manifest.schemaVersion,
		generatedAt: manifest.generatedAt,
		sourceBundlePath: manifest.sourceBundlePath,
		sourceBundleSha256: manifest.sourceBundleSha256,
		artifacts: manifest.artifacts.map((artifact) => ({
			artifactId: artifact.artifactId,
			path: artifact.path,
			sha256: artifact.sha256,
			signature: artifact.signature,
			sourceProvider: artifact.sourceProvider,
			sourceRunId: artifact.sourceRunId,
			sourceWorkflowRef: artifact.sourceWorkflowRef,
			sourceCommitSha: artifact.sourceCommitSha,
			capturedAt: artifact.capturedAt,
			scenario: artifact.scenario,
		})),
		integrity: {
			signatureAlgorithm: manifest.integrity.signatureAlgorithm,
			signingKeyId: manifest.integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function parseParityProvenanceManifest(
	content: string,
):
	| { ok: true; value: CIParityProvenanceManifest }
	| { ok: false; error: string } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return {
				ok: false,
				error: "Parity provenance manifest must be a JSON object.",
			};
		}
		const record = parsed as Record<string, unknown>;
		if (record.schemaVersion !== PARITY_PROVENANCE_MANIFEST_SCHEMA_VERSION) {
			return {
				ok: false,
				error: `Parity provenance manifest schemaVersion must be ${PARITY_PROVENANCE_MANIFEST_SCHEMA_VERSION}.`,
			};
		}
		if (
			typeof record.generatedAt !== "string" ||
			!Number.isFinite(Date.parse(record.generatedAt))
		) {
			return {
				ok: false,
				error:
					"Parity provenance manifest generatedAt must be a valid ISO timestamp.",
			};
		}
		if (
			record.sourceBundlePath !== PARITY_PROVENANCE_BUNDLE_PATH ||
			typeof record.sourceBundleSha256 !== "string" ||
			!isHexDigest(record.sourceBundleSha256)
		) {
			return {
				ok: false,
				error: "Parity provenance manifest source bundle metadata is invalid.",
			};
		}
		if (!Array.isArray(record.artifacts) || record.artifacts.length === 0) {
			return {
				ok: false,
				error:
					"Parity provenance manifest artifacts must be a non-empty array.",
			};
		}
		const parsedBundleResult = parseParityProvenanceBundle(
			JSON.stringify({
				schemaVersion: PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION,
				generatedAt: record.generatedAt,
				behavioralParity: {
					scenarios: [
						{
							scenario: "pull_request",
							providersCompared: ["github-actions"],
							commitCount: 1,
							unexpectedDiffs: [],
						},
					],
				},
				promotionGate: {
					zeroUnexpectedDiffs: true,
					outcomeParity: true,
					skippedSemanticsParity: true,
					artifactParity: true,
					greptileParity: true,
					releaseParity: true,
				},
				downstream: {
					repositories: [
						{
							repo: "placeholder/repo",
							ecosystemProfile: "placeholder",
							mergeQueue: true,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
					],
				},
				artifacts: record.artifacts,
			}),
		);
		if (!parsedBundleResult.ok) {
			return { ok: false, error: parsedBundleResult.error };
		}
		const integrity = record.integrity;
		if (!integrity || typeof integrity !== "object") {
			return {
				ok: false,
				error: "Parity provenance manifest integrity section is required.",
			};
		}
		const integrityRecord = integrity as Record<string, unknown>;
		if (
			integrityRecord.signatureAlgorithm !==
				PARITY_PROOF_PACK_SIGNATURE_ALGORITHM ||
			typeof integrityRecord.signingKeyId !== "string" ||
			!HEX_TOKEN_PATTERN.test(integrityRecord.signingKeyId) ||
			typeof integrityRecord.payloadSha256 !== "string" ||
			!isHexDigest(integrityRecord.payloadSha256)
		) {
			return {
				ok: false,
				error: "Parity provenance manifest integrity metadata is invalid.",
			};
		}
		return {
			ok: true,
			value: {
				schemaVersion: PARITY_PROVENANCE_MANIFEST_SCHEMA_VERSION,
				generatedAt: record.generatedAt,
				sourceBundlePath: PARITY_PROVENANCE_BUNDLE_PATH,
				sourceBundleSha256: record.sourceBundleSha256,
				artifacts: parsedBundleResult.value.artifacts,
				integrity: {
					signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
					signingKeyId: integrityRecord.signingKeyId,
					payloadSha256: integrityRecord.payloadSha256,
				},
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse parity provenance manifest JSON: ${sanitizeError(error)}`,
		};
	}
}

function evaluateProvenanceEvidence(
	targetDir: string,
	required: boolean,
	proofPack: CIParityProofPack | undefined,
	signingKey: string,
	signingKeyId: string,
): string[] {
	const violations: string[] = [];
	const manifestPath = resolve(targetDir, PARITY_PROVENANCE_MANIFEST_PATH);
	const signaturePath = resolve(
		targetDir,
		PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH,
	);
	if (!required) {
		return violations;
	}
	if (!existsSync(manifestPath)) {
		violations.push(
			`Missing required parity provenance manifest: ${PARITY_PROVENANCE_MANIFEST_PATH}`,
		);
		return violations;
	}
	if (!existsSync(signaturePath)) {
		violations.push(
			`Missing required parity provenance manifest signature: ${PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH}`,
		);
		return violations;
	}
	let manifestContent = "";
	let signatureContent = "";
	try {
		manifestContent = readFileSync(manifestPath, "utf-8");
		signatureContent = readFileSync(signaturePath, "utf-8").trim();
	} catch (error) {
		violations.push(
			`Failed to read parity provenance manifest trust artifacts: ${sanitizeError(error)}`,
		);
		return violations;
	}
	if (!isHexDigest(signatureContent)) {
		violations.push(
			`Parity provenance manifest signature must be a sha256 hex digest: ${PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH}`,
		);
		return violations;
	}
	const expectedSignature = signContent(manifestContent, signingKey);
	if (expectedSignature !== signatureContent) {
		violations.push(
			"Parity provenance manifest signature mismatch. Refusing unsigned or tampered provenance evidence.",
		);
		return violations;
	}
	const parsedManifestResult = parseParityProvenanceManifest(manifestContent);
	if (!parsedManifestResult.ok) {
		violations.push(parsedManifestResult.error);
		return violations;
	}
	const manifest = parsedManifestResult.value;
	if (manifest.integrity.signingKeyId !== signingKeyId) {
		violations.push(
			"Parity provenance manifest integrity signingKeyId does not match active signing key.",
		);
	}
	const expectedPayloadDigest = hashContent(
		canonicalizeParityProvenanceManifestForDigest(manifest),
	);
	if (expectedPayloadDigest !== manifest.integrity.payloadSha256) {
		violations.push(
			"Parity provenance manifest integrity payloadSha256 does not match signed payload.",
		);
	}
	const sourceBundlePath = resolve(targetDir, PARITY_PROVENANCE_BUNDLE_PATH);
	if (!existsSync(sourceBundlePath)) {
		violations.push(
			`Parity provenance source bundle is missing: ${PARITY_PROVENANCE_BUNDLE_PATH}`,
		);
		return violations;
	}
	const sourceBundleDigest = hashContent(
		readFileSync(sourceBundlePath, "utf-8"),
	);
	if (sourceBundleDigest !== manifest.sourceBundleSha256) {
		violations.push(
			"Parity provenance source bundle digest does not match manifest metadata.",
		);
	}
	if (!proofPack) {
		return violations;
	}
	const proofByArtifactId = new Map(
		proofPack.artifacts.map((artifact) => [artifact.artifactId, artifact]),
	);
	for (const manifestArtifact of manifest.artifacts) {
		const expectedProvenanceSignature = signContent(
			`${manifestArtifact.path}:${manifestArtifact.sha256}:${manifestArtifact.sourceProvider}:${manifestArtifact.sourceRunId}:${manifestArtifact.sourceCommitSha}:${manifestArtifact.capturedAt}`,
			signingKey,
		);
		if (expectedProvenanceSignature !== manifestArtifact.signature) {
			violations.push(
				`Parity provenance manifest source signature mismatch for ${manifestArtifact.artifactId}.`,
			);
		}
		if (!proofByArtifactId.has(manifestArtifact.artifactId)) {
			violations.push(
				`Parity proof pack is missing artifactId ${manifestArtifact.artifactId} required by provenance manifest.`,
			);
		}
	}
	const manifestByArtifact = new Map(
		manifest.artifacts.map((artifact) => [artifact.artifactId, artifact]),
	);
	for (const proofArtifact of proofPack.artifacts) {
		const manifestArtifact = manifestByArtifact.get(proofArtifact.artifactId);
		if (!manifestArtifact) {
			violations.push(
				`Parity provenance manifest is missing artifactId ${proofArtifact.artifactId}.`,
			);
			continue;
		}
		if (manifestArtifact.sha256 !== proofArtifact.sha256) {
			violations.push(
				`Parity provenance manifest artifact digest mismatch for ${proofArtifact.artifactId}.`,
			);
		}
	}
	return violations;
}

function parseParityProvenanceBundle(
	content: string,
):
	| { ok: true; value: CIParityProvenanceBundle }
	| { ok: false; error: string } {
	try {
		const parsed = JSON.parse(content) as unknown;
		if (!parsed || typeof parsed !== "object") {
			return {
				ok: false,
				error: "Parity provenance bundle must be a JSON object.",
			};
		}
		const record = parsed as Record<string, unknown>;
		if (record.schemaVersion !== PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION) {
			return {
				ok: false,
				error: `Parity provenance bundle schemaVersion must be ${PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION}.`,
			};
		}
		if (
			typeof record.generatedAt !== "string" ||
			!Number.isFinite(Date.parse(record.generatedAt))
		) {
			return {
				ok: false,
				error:
					"Parity provenance bundle generatedAt must be a valid ISO timestamp.",
			};
		}
		const parsedInputResult = parseParityProofPackInput(
			JSON.stringify({
				schemaVersion: "ci-parity-proof-input/v1",
				generatedAt: record.generatedAt,
				repo: record.repo ?? undefined,
				behavioralParity: record.behavioralParity,
				promotionGate: record.promotionGate,
				downstream: record.downstream,
			}),
		);
		if (!parsedInputResult.ok) {
			return { ok: false, error: parsedInputResult.error };
		}
		if (!Array.isArray(record.artifacts) || record.artifacts.length === 0) {
			return {
				ok: false,
				error: "Parity provenance bundle artifacts must be a non-empty array.",
			};
		}
		const artifacts: CIParityProvenanceArtifactRecord[] = [];
		const artifactIds = new Set<string>();
		for (const artifact of record.artifacts) {
			if (!artifact || typeof artifact !== "object") {
				return {
					ok: false,
					error: "Parity provenance artifact entries must be objects.",
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
						"Parity provenance artifact entries require a non-empty artifactId.",
				};
			}
			if (artifactIds.has(artifactRecord.artifactId)) {
				return {
					ok: false,
					error: `Parity provenance artifactId must be unique. Duplicate: ${artifactRecord.artifactId}.`,
				};
			}
			artifactIds.add(artifactRecord.artifactId);
			if (
				typeof artifactRecord.path !== "string" ||
				artifactRecord.path.trim().length === 0
			) {
				return {
					ok: false,
					error: "Parity provenance artifact entries require a non-empty path.",
				};
			}
			if (
				typeof artifactRecord.sha256 !== "string" ||
				!isHexDigest(artifactRecord.sha256)
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact sha256 values must be sha256 hex digests.",
				};
			}
			if (
				typeof artifactRecord.signature !== "string" ||
				!isHexDigest(artifactRecord.signature)
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact signatures must be sha256 hex digests.",
				};
			}
			if (
				artifactRecord.sourceProvider !== "github-actions" &&
				artifactRecord.sourceProvider !== "circleci"
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact sourceProvider must be github-actions or circleci.",
				};
			}
			if (
				typeof artifactRecord.sourceRunId !== "string" ||
				artifactRecord.sourceRunId.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact sourceRunId must be a non-empty string.",
				};
			}
			if (
				typeof artifactRecord.sourceWorkflowRef !== "string" ||
				artifactRecord.sourceWorkflowRef.trim().length === 0
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact sourceWorkflowRef must be a non-empty string.",
				};
			}
			if (
				typeof artifactRecord.sourceCommitSha !== "string" ||
				!isCommitSha(artifactRecord.sourceCommitSha)
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact sourceCommitSha must be a 40-character lowercase commit SHA.",
				};
			}
			if (
				typeof artifactRecord.capturedAt !== "string" ||
				!Number.isFinite(Date.parse(artifactRecord.capturedAt))
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact capturedAt must be a valid ISO timestamp.",
				};
			}
			if (
				artifactRecord.scenario !== undefined &&
				(typeof artifactRecord.scenario !== "string" ||
					!isRequiredParityScenario(artifactRecord.scenario))
			) {
				return {
					ok: false,
					error:
						"Parity provenance artifact scenario must use supported scenario ids when provided.",
				};
			}
			artifacts.push({
				artifactId: artifactRecord.artifactId,
				path: artifactRecord.path,
				sha256: artifactRecord.sha256,
				signature: artifactRecord.signature,
				sourceProvider: artifactRecord.sourceProvider,
				sourceRunId: artifactRecord.sourceRunId,
				sourceWorkflowRef: artifactRecord.sourceWorkflowRef,
				sourceCommitSha: artifactRecord.sourceCommitSha,
				capturedAt: artifactRecord.capturedAt,
				scenario: artifactRecord.scenario,
			});
		}
		return {
			ok: true,
			value: {
				schemaVersion: PARITY_PROVENANCE_BUNDLE_SCHEMA_VERSION,
				generatedAt: record.generatedAt,
				repo: parsedInputResult.value.repo,
				behavioralParity: parsedInputResult.value.behavioralParity,
				promotionGate: parsedInputResult.value.promotionGate,
				downstream: parsedInputResult.value.downstream,
				artifacts,
			},
		};
	} catch (error) {
		return {
			ok: false,
			error: `Failed to parse parity provenance bundle JSON: ${sanitizeError(error)}`,
		};
	}
}

function materializeProofPackInputsFromProvenanceBundle(
	targetDir: string,
	signingKey: string,
	signingKeyId: string,
): { ok: true } | { ok: false; error: string } {
	const bundlePath = resolve(targetDir, PARITY_PROVENANCE_BUNDLE_PATH);
	if (!existsSync(bundlePath)) {
		return {
			ok: false,
			error: `Missing parity proof pack input (${PARITY_PROOF_PACK_INPUT_PATH}), provenance bundle (${PARITY_PROVENANCE_BUNDLE_PATH}), and provenance input (${PARITY_PROVENANCE_INPUT_PATH}).`,
		};
	}
	const bundleContent = readFileSync(bundlePath, "utf-8");
	const parsedBundleResult = parseParityProvenanceBundle(bundleContent);
	if (!parsedBundleResult.ok) {
		return { ok: false, error: parsedBundleResult.error };
	}
	const bundle = parsedBundleResult.value;
	const artifactDir = resolve(targetDir, PARITY_PROOF_PACK_ARTIFACTS_DIR);
	mkdirSync(artifactDir, { recursive: true });
	for (const artifact of bundle.artifacts) {
		if (!isSafeProofArtifactPath(targetDir, artifact.path)) {
			return {
				ok: false,
				error: `Parity provenance artifact path escapes repository root: ${artifact.path}`,
			};
		}
		const sourcePath = resolve(targetDir, artifact.path);
		if (!existsSync(sourcePath)) {
			return {
				ok: false,
				error: `Parity provenance artifact missing from repository: ${artifact.path}`,
			};
		}
		const sourceContent = readFileSync(sourcePath, "utf-8");
		const computedDigest = hashContent(sourceContent);
		if (computedDigest !== artifact.sha256) {
			return {
				ok: false,
				error: `Parity provenance artifact digest mismatch for ${artifact.path}.`,
			};
		}
		const expectedSignature = signContent(
			`${artifact.path}:${artifact.sha256}:${artifact.sourceProvider}:${artifact.sourceRunId}:${artifact.sourceCommitSha}:${artifact.capturedAt}`,
			signingKey,
		);
		if (expectedSignature !== artifact.signature) {
			return {
				ok: false,
				error: `Parity provenance artifact signature mismatch for ${artifact.path}.`,
			};
		}
		const destinationPath = resolve(
			targetDir,
			PARITY_PROOF_PACK_ARTIFACTS_DIR,
			`${artifact.artifactId}.json`,
		);
		copyFileSync(sourcePath, destinationPath);
	}
	const inputPayload: CIParityProofPackInput = {
		schemaVersion: "ci-parity-proof-input/v1",
		generatedAt: bundle.generatedAt,
		repo: bundle.repo ?? null,
		behavioralParity: bundle.behavioralParity,
		promotionGate: bundle.promotionGate,
		downstream: bundle.downstream,
	};
	const inputPath = resolve(targetDir, PARITY_PROOF_PACK_INPUT_PATH);
	mkdirSync(dirname(inputPath), { recursive: true });
	writeFileSync(inputPath, JSON.stringify(inputPayload, null, 2));

	const manifestBase: CIParityProvenanceManifest = {
		schemaVersion: PARITY_PROVENANCE_MANIFEST_SCHEMA_VERSION,
		generatedAt: new Date().toISOString(),
		sourceBundlePath: PARITY_PROVENANCE_BUNDLE_PATH,
		sourceBundleSha256: hashContent(bundleContent),
		artifacts: bundle.artifacts,
		integrity: {
			signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
			signingKeyId,
			payloadSha256: "",
		},
	};
	const payloadSha256 = hashContent(
		canonicalizeParityProvenanceManifestForDigest(manifestBase),
	);
	const manifest: CIParityProvenanceManifest = {
		...manifestBase,
		integrity: {
			...manifestBase.integrity,
			payloadSha256,
		},
	};
	const manifestContent = JSON.stringify(manifest, null, 2);
	const manifestPath = resolve(targetDir, PARITY_PROVENANCE_MANIFEST_PATH);
	const manifestSignaturePath = resolve(
		targetDir,
		PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH,
	);
	writeFileSync(manifestPath, manifestContent);
	writeFileSync(
		manifestSignaturePath,
		`${signContent(manifestContent, signingKey)}\n`,
	);
	return { ok: true };
}

function collectProofPackArtifacts(
	targetDir: string,
	signingKey: string,
):
	| { ok: true; artifacts: CIParityProofPackArtifact[] }
	| { ok: false; error: string } {
	const artifactRoot = resolve(targetDir, PARITY_PROOF_PACK_ARTIFACTS_DIR);
	if (!existsSync(artifactRoot)) {
		return {
			ok: false,
			error: `Parity proof pack artifacts directory missing: ${PARITY_PROOF_PACK_ARTIFACTS_DIR}`,
		};
	}
	const entries = readdirSync(artifactRoot, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
	if (entries.length === 0) {
		return {
			ok: false,
			error: `Parity proof pack artifacts directory is empty: ${PARITY_PROOF_PACK_ARTIFACTS_DIR}`,
		};
	}
	const artifacts: CIParityProofPackArtifact[] = [];
	const artifactIds = new Set<string>();
	for (const entryName of entries) {
		const relativePath = `${PARITY_PROOF_PACK_ARTIFACTS_DIR}/${entryName}`;
		if (!isSafeProofArtifactPath(targetDir, relativePath)) {
			return {
				ok: false,
				error: `Parity proof artifact path escapes repository root: ${relativePath}`,
			};
		}
		const artifactContent = readFileSync(
			resolve(targetDir, relativePath),
			"utf-8",
		);
		const digest = hashContent(artifactContent);
		const artifactIdCandidate = entryName
			.replace(/\.[^.]+$/, "")
			.replace(/[^A-Za-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.toLowerCase();
		const artifactId =
			artifactIdCandidate.length > 0
				? artifactIdCandidate
				: `artifact-${artifacts.length + 1}`;
		if (artifactIds.has(artifactId)) {
			return {
				ok: false,
				error: `Duplicate artifact id derived from filenames: ${artifactId}`,
			};
		}
		artifactIds.add(artifactId);
		artifacts.push({
			artifactId,
			path: relativePath,
			sha256: digest,
			signature: signContent(`${relativePath}:${digest}`, signingKey),
		});
	}
	return { ok: true, artifacts };
}

function resolveProofPackRepoBinding(
	targetDir: string,
	policy: CIProviderPolicyConfig,
	input: CIParityProofPackInput,
):
	| { ok: true; value: CIParityProofPackRepoBinding }
	| { ok: false; error: string } {
	const repoInput = input.repo ?? undefined;
	const originUrl = readGitOriginUrl(targetDir);
	if (!originUrl) {
		return {
			ok: false,
			error:
				"Git origin URL is required to bind parity proof pack repository identity.",
		};
	}
	if (repoInput?.originUrl && repoInput.originUrl !== originUrl) {
		return {
			ok: false,
			error: `Parity proof input repo.originUrl (${repoInput.originUrl}) does not match repository origin (${originUrl}).`,
		};
	}
	const normalizedFullName = normalizeRepoFullName(originUrl);
	if (!normalizedFullName) {
		return {
			ok: false,
			error: `Unsupported origin URL for repository identity binding: ${originUrl}`,
		};
	}
	if (repoInput?.fullName && repoInput.fullName !== normalizedFullName) {
		return {
			ok: false,
			error: `Parity proof input repo.fullName (${repoInput.fullName}) does not match repository origin identity (${normalizedFullName}).`,
		};
	}

	const headShaResult = repoInput?.headSha
		? { ok: true as const, commitSha: repoInput.headSha }
		: resolveGitRefToCommit(targetDir, "HEAD");
	if (!headShaResult.ok || !isCommitSha(headShaResult.commitSha)) {
		return {
			ok: false,
			error: headShaResult.ok
				? "Parity proof input repo.headSha must be a 40-character lowercase commit SHA."
				: headShaResult.error,
		};
	}
	const trustedPolicyRefResult = resolveGitRefToCommit(
		targetDir,
		policy.trustedPolicyRef,
	);
	if (!trustedPolicyRefResult.ok) {
		return { ok: false, error: trustedPolicyRefResult.error };
	}
	let baseSha = repoInput?.baseSha ?? trustedPolicyRefResult.commitSha;
	if (!isCommitSha(baseSha)) {
		return {
			ok: false,
			error:
				"Parity proof input repo.baseSha must be a 40-character lowercase commit SHA.",
		};
	}
	if (baseSha === headShaResult.commitSha) {
		const previousCommitResult = resolveGitRefToCommit(targetDir, "HEAD~1");
		if (!previousCommitResult.ok) {
			return {
				ok: false,
				error:
					"Unable to derive distinct baseSha (trustedPolicyRef resolved to HEAD and HEAD~1 is unavailable).",
			};
		}
		baseSha = previousCommitResult.commitSha;
	}
	const ancestryResult = isAncestorCommit(
		targetDir,
		baseSha,
		headShaResult.commitSha,
	);
	if (!ancestryResult.ok) {
		return { ok: false, error: ancestryResult.error };
	}
	if (!ancestryResult.isAncestor) {
		return {
			ok: false,
			error: "Parity proof pack baseSha must be an ancestor of headSha.",
		};
	}
	return {
		ok: true,
		value: {
			fullName: normalizedFullName,
			originUrl,
			trustedPolicyRef: policy.trustedPolicyRef,
			requiredCheckManifestPath: policy.requiredCheckManifestPath,
			baseSha,
			headSha: headShaResult.commitSha,
		},
	};
}

function maybeAutoGenerateParityProofPack(
	targetDir: string,
	targetProvider: CIProvider,
	autoGenerate: boolean,
): { ok: true; generated: boolean } | { ok: false; error: string } {
	if (!autoGenerate) {
		return { ok: true, generated: false };
	}
	if (!shouldRequirePromotionEvidence(targetDir, targetProvider)) {
		return { ok: true, generated: false };
	}
	const proofPackPath = resolve(targetDir, PARITY_PROOF_PACK_PATH);
	const signaturePath = resolve(targetDir, PARITY_PROOF_PACK_SIGNATURE_PATH);
	if (existsSync(proofPackPath) && existsSync(signaturePath)) {
		const existingProofPackTrust = evaluatePromotionEvidence(
			targetDir,
			targetProvider,
		);
		if (existingProofPackTrust.status !== "verified") {
			return {
				ok: false,
				error: `Existing parity proof pack failed trust verification. Refusing reuse for auto-generation path. ${existingProofPackTrust.violations.join(" ")}`,
			};
		}
		return { ok: true, generated: false };
	}
	const policyResult = readContractProviderPolicy(targetDir);
	if (!policyResult.ok) {
		return { ok: false, error: policyResult.error };
	}
	const signingKeyResult = resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return { ok: false, error: signingKeyResult.error };
	}
	const inputPath = resolve(targetDir, PARITY_PROOF_PACK_INPUT_PATH);
	const manifestPath = resolve(targetDir, PARITY_PROVENANCE_MANIFEST_PATH);
	const provenanceInputPath = resolve(targetDir, PARITY_PROVENANCE_INPUT_PATH);
	const provenanceBundlePath = resolve(
		targetDir,
		PARITY_PROVENANCE_BUNDLE_PATH,
	);
	const provenanceArtifactIndexPath = resolve(
		targetDir,
		PARITY_PROVENANCE_ARTIFACT_INDEX_PATH,
	);
	if (
		!existsSync(provenanceInputPath) &&
		existsSync(provenanceArtifactIndexPath)
	) {
		const artifactIndexMaterializationResult =
			materializeProvenanceInputFromArtifactIndex(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!artifactIndexMaterializationResult.ok) {
			return { ok: false, error: artifactIndexMaterializationResult.error };
		}
	}
	if (
		existsSync(provenanceInputPath) &&
		!existsSync(provenanceArtifactIndexPath)
	) {
		const artifactIndexGenerationResult =
			materializeArtifactIndexFromProvenanceInput(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!artifactIndexGenerationResult.ok) {
			return { ok: false, error: artifactIndexGenerationResult.error };
		}
	}
	if (
		!existsSync(provenanceInputPath) &&
		existsSync(provenanceBundlePath) &&
		!existsSync(provenanceArtifactIndexPath)
	) {
		const artifactIndexGenerationResult =
			materializeArtifactIndexFromProvenanceBundle(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!artifactIndexGenerationResult.ok) {
			return { ok: false, error: artifactIndexGenerationResult.error };
		}
	}
	if (!existsSync(provenanceBundlePath) && existsSync(provenanceInputPath)) {
		const materializeBundleResult = materializeProvenanceBundleFromInput(
			targetDir,
			signingKeyResult.key,
		);
		if (!materializeBundleResult.ok) {
			return { ok: false, error: materializeBundleResult.error };
		}
	}
	if (!existsSync(inputPath)) {
		const materializeInputsResult =
			materializeProofPackInputsFromProvenanceBundle(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!materializeInputsResult.ok) {
			return { ok: false, error: materializeInputsResult.error };
		}
	}
	if (
		existsSync(provenanceInputPath) &&
		!existsSync(provenanceArtifactIndexPath)
	) {
		const artifactIndexGenerationResult =
			materializeArtifactIndexFromProvenanceInput(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!artifactIndexGenerationResult.ok) {
			return { ok: false, error: artifactIndexGenerationResult.error };
		}
	}
	if (
		!existsSync(provenanceInputPath) &&
		existsSync(provenanceBundlePath) &&
		!existsSync(provenanceArtifactIndexPath)
	) {
		const artifactIndexGenerationResult =
			materializeArtifactIndexFromProvenanceBundle(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!artifactIndexGenerationResult.ok) {
			return { ok: false, error: artifactIndexGenerationResult.error };
		}
	}
	if (!existsSync(manifestPath) && existsSync(provenanceBundlePath)) {
		const materializeInputsResult =
			materializeProofPackInputsFromProvenanceBundle(
				targetDir,
				signingKeyResult.key,
				signingKeyResult.keyId,
			);
		if (!materializeInputsResult.ok) {
			return { ok: false, error: materializeInputsResult.error };
		}
	}
	const parsedInputResult = parseParityProofPackInput(
		readFileSync(inputPath, "utf-8"),
	);
	if (!parsedInputResult.ok) {
		return { ok: false, error: parsedInputResult.error };
	}
	const input = parsedInputResult.value;
	const artifactResult = collectProofPackArtifacts(
		targetDir,
		signingKeyResult.key,
	);
	if (!artifactResult.ok) {
		return { ok: false, error: artifactResult.error };
	}
	const repoBindingResult = resolveProofPackRepoBinding(
		targetDir,
		policyResult.value,
		input,
	);
	if (!repoBindingResult.ok) {
		return { ok: false, error: repoBindingResult.error };
	}
	const authorityDigestResult = readHashedPolicyFile(
		targetDir,
		policyResult.value.authorityConfigPath,
	);
	if (!authorityDigestResult.ok) {
		return { ok: false, error: authorityDigestResult.error };
	}
	const requiredManifestDigestResult = readHashedPolicyFile(
		targetDir,
		policyResult.value.requiredCheckManifestPath,
	);
	if (!requiredManifestDigestResult.ok) {
		return { ok: false, error: requiredManifestDigestResult.error };
	}
	const proofPackBase: CIParityProofPack = {
		schemaVersion: "ci-parity-proof-pack/v2",
		generatedAt: input.generatedAt ?? new Date().toISOString(),
		sourceProvider: "github-actions",
		targetProvider: "circleci",
		repo: repoBindingResult.value,
		policyDigests: {
			authorityConfigSha256: authorityDigestResult.digest,
			requiredCheckManifestSha256: requiredManifestDigestResult.digest,
		},
		artifacts: artifactResult.artifacts,
		behavioralParity: input.behavioralParity,
		promotionGate: input.promotionGate,
		downstream: input.downstream,
		integrity: {
			signatureAlgorithm: PARITY_PROOF_PACK_SIGNATURE_ALGORITHM,
			signingKeyId: signingKeyResult.keyId,
			payloadSha256: "",
		},
	};
	const payloadSha256 = hashContent(
		canonicalizeParityProofPackForDigest(proofPackBase),
	);
	const proofPack: CIParityProofPack = {
		...proofPackBase,
		integrity: {
			...proofPackBase.integrity,
			payloadSha256,
		},
	};
	const proofPackContent = JSON.stringify(proofPack, null, 2);
	const signature = signContent(proofPackContent, signingKeyResult.key);
	mkdirSync(dirname(proofPackPath), { recursive: true });
	writeFileSync(proofPackPath, proofPackContent);
	writeFileSync(signaturePath, `${signature}\n`);
	return { ok: true, generated: true };
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
	violations.push(
		...evaluateProvenanceEvidence(
			targetDir,
			required,
			proofPack,
			signingKeyResult.key,
			signingKeyResult.keyId,
		),
	);

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

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readRequiredCheckNamesFromContract(targetDir: string): string[] {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return [];
	}
	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			branchProtection?: { requiredChecks?: unknown } | undefined;
			reviewPolicy?: { requiredChecks?: unknown } | undefined;
		};
		const branchChecks = Array.isArray(parsed.branchProtection?.requiredChecks)
			? parsed.branchProtection?.requiredChecks
			: [];
		const reviewChecks = Array.isArray(parsed.reviewPolicy?.requiredChecks)
			? parsed.reviewPolicy?.requiredChecks
			: [];
		return [...branchChecks, ...reviewChecks]
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
	} catch {
		return [];
	}
}

function readRequiredCheckNamesFromSourceProviderConfig(
	targetDir: string,
	sourceProvider: CIProvider,
): string[] {
	if (sourceProvider !== "github-actions") {
		return [];
	}
	const sourceAdapter = createCIProviderAdapter(sourceProvider);
	const sourceConfigPaths = sourceAdapter.discoverConfigPaths(targetDir);
	const checks = new Set<string>();
	for (const configPath of sourceConfigPaths) {
		const absolutePath = resolve(targetDir, configPath);
		if (!existsSync(absolutePath)) {
			continue;
		}
		try {
			const content = readFileSync(absolutePath, "utf-8");
			for (const line of content.split(/\r?\n/)) {
				const nameMatch = line.match(/^ {4}name:\s*(.+?)\s*$/);
				if (!nameMatch?.[1]) {
					continue;
				}
				const displayName = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
				if (displayName.length > 0) {
					checks.add(displayName);
				}
			}
		} catch {
			// Best-effort legacy import: ignore unreadable workflow files.
		}
	}
	return [...checks];
}

function buildImportedRequiredChecks(
	displayNames: string[],
	sourceProvider: CIProvider,
): RequiredCheckIdentity[] {
	return displayNames.map((displayName, index) => ({
		policyId: `imported-required-check-${index + 1}`,
		displayName,
		sourceAppSlug: sourceProvider,
		sourceAppId: sourceProvider,
		externalIdPattern: `^${escapeRegexLiteral(displayName)}$`,
		requiredOnEvents: ["pull_request", "merge_group"],
		freshnessWindowDays: 7,
		class: "required",
	}));
}

function writeRequiredChecksManifest(
	targetDir: string,
	provider: CIProvider,
	requiredChecks: RequiredCheckIdentity[],
): { ok: true } | { ok: false; error: string } {
	try {
		const manifestPath = resolve(
			targetDir,
			HARNESS_DIR,
			"ci-required-checks.json",
		);
		mkdirSync(dirname(manifestPath), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: provider,
					requiredChecks,
				},
				null,
				2,
			),
		);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to write required checks manifest: ${sanitizeError(error)}`,
		};
	}
}

function readOrImportRequiredChecks(
	targetDir: string,
	sourceProvider: CIProvider,
	allowPersistManifest: boolean,
):
	| {
			ok: true;
			value: RequiredCheckIdentity[];
			imported: boolean;
			persisted: boolean;
	  }
	| {
			ok: false;
			error: string;
	  } {
	const requiredChecksResult = readAllRequiredChecks(targetDir);
	if (requiredChecksResult.ok) {
		return {
			ok: true,
			value: requiredChecksResult.value,
			imported: false,
			persisted: false,
		};
	}
	if (
		requiredChecksResult.error !==
		"Required checks manifest missing: .harness/ci-required-checks.json"
	) {
		return requiredChecksResult;
	}

	const contractCheckNames = readRequiredCheckNamesFromContract(targetDir);
	const workflowCheckNames = readRequiredCheckNamesFromSourceProviderConfig(
		targetDir,
		sourceProvider,
	);
	const importedCheckNames = [
		...new Set([...contractCheckNames, ...workflowCheckNames]),
	]
		.map((name) => name.trim())
		.filter((name) => name.length > 0)
		.sort((left, right) => left.localeCompare(right));

	if (importedCheckNames.length === 0) {
		return {
			ok: false,
			error:
				"Required checks manifest missing and no legacy required checks were discovered from harness.contract.json or source workflow metadata.",
		};
	}

	const importedChecks = buildImportedRequiredChecks(
		importedCheckNames,
		sourceProvider,
	);
	if (allowPersistManifest) {
		const writeResult = writeRequiredChecksManifest(
			targetDir,
			sourceProvider,
			importedChecks,
		);
		if (!writeResult.ok) {
			return writeResult;
		}
	}
	return {
		ok: true,
		value: importedChecks,
		imported: true,
		persisted: allowPersistManifest,
	};
}

function escapeRegexLiteral(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readRequiredCheckNamesFromContract(targetDir: string): string[] {
	const contractPath = resolve(targetDir, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return [];
	}
	try {
		const parsed = JSON.parse(readFileSync(contractPath, "utf-8")) as {
			branchProtection?: { requiredChecks?: unknown } | undefined;
			reviewPolicy?: { requiredChecks?: unknown } | undefined;
		};
		const branchChecks = Array.isArray(parsed.branchProtection?.requiredChecks)
			? parsed.branchProtection?.requiredChecks
			: [];
		const reviewChecks = Array.isArray(parsed.reviewPolicy?.requiredChecks)
			? parsed.reviewPolicy?.requiredChecks
			: [];
		return [...branchChecks, ...reviewChecks]
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.trim())
			.filter((value) => value.length > 0);
	} catch {
		return [];
	}
}

function readRequiredCheckNamesFromSourceProviderConfig(
	targetDir: string,
	sourceProvider: CIProvider,
): string[] {
	if (sourceProvider !== "github-actions") {
		return [];
	}
	const sourceAdapter = createCIProviderAdapter(sourceProvider);
	const sourceConfigPaths = sourceAdapter.discoverConfigPaths(targetDir);
	const checks = new Set<string>();
	for (const configPath of sourceConfigPaths) {
		const absolutePath = resolve(targetDir, configPath);
		if (!existsSync(absolutePath)) {
			continue;
		}
		try {
			const content = readFileSync(absolutePath, "utf-8");
			for (const line of content.split(/\r?\n/)) {
				const nameMatch = line.match(/^ {4}name:\s*(.+?)\s*$/);
				if (!nameMatch?.[1]) {
					continue;
				}
				const displayName = nameMatch[1].trim().replace(/^['"]|['"]$/g, "");
				if (displayName.length > 0) {
					checks.add(displayName);
				}
			}
		} catch {
			// Best-effort legacy import: ignore unreadable workflow files.
		}
	}
	return [...checks];
}

function buildImportedRequiredChecks(
	displayNames: string[],
	sourceProvider: CIProvider,
): RequiredCheckIdentity[] {
	return displayNames.map((displayName, index) => ({
		policyId: `imported-required-check-${index + 1}`,
		displayName,
		sourceAppSlug: sourceProvider,
		sourceAppId: sourceProvider,
		externalIdPattern: `^${escapeRegexLiteral(displayName)}$`,
		requiredOnEvents: ["pull_request", "merge_group"],
		freshnessWindowDays: 7,
		class: "required",
	}));
}

function writeRequiredChecksManifest(
	targetDir: string,
	provider: CIProvider,
	requiredChecks: RequiredCheckIdentity[],
): { ok: true } | { ok: false; error: string } {
	try {
		const manifestPath = resolve(
			targetDir,
			HARNESS_DIR,
			"ci-required-checks.json",
		);
		mkdirSync(dirname(manifestPath), { recursive: true });
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					version: 1,
					activeProvider: provider,
					requiredChecks,
				},
				null,
				2,
			),
		);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: `Failed to write required checks manifest: ${sanitizeError(error)}`,
		};
	}
}

function readOrImportRequiredChecks(
	targetDir: string,
	sourceProvider: CIProvider,
	allowPersistManifest: boolean,
):
	| {
			ok: true;
			value: RequiredCheckIdentity[];
			imported: boolean;
			persisted: boolean;
	  }
	| {
			ok: false;
			error: string;
	  } {
	const requiredChecksResult = readAllRequiredChecks(targetDir);
	if (requiredChecksResult.ok) {
		return {
			ok: true,
			value: requiredChecksResult.value,
			imported: false,
			persisted: false,
		};
	}
	if (
		requiredChecksResult.error !==
		"Required checks manifest missing: .harness/ci-required-checks.json"
	) {
		return requiredChecksResult;
	}

	const contractCheckNames = readRequiredCheckNamesFromContract(targetDir);
	const workflowCheckNames = readRequiredCheckNamesFromSourceProviderConfig(
		targetDir,
		sourceProvider,
	);
	const importedCheckNames = [
		...new Set([...contractCheckNames, ...workflowCheckNames]),
	]
		.map((name) => name.trim())
		.filter((name) => name.length > 0)
		.sort((left, right) => left.localeCompare(right));

	if (importedCheckNames.length === 0) {
		return {
			ok: false,
			error:
				"Required checks manifest missing and no legacy required checks were discovered from harness.contract.json or source workflow metadata.",
		};
	}

	const importedChecks = buildImportedRequiredChecks(
		importedCheckNames,
		sourceProvider,
	);
	if (allowPersistManifest) {
		const writeResult = writeRequiredChecksManifest(
			targetDir,
			sourceProvider,
			importedChecks,
		);
		if (!writeResult.ok) {
			return writeResult;
		}
	}
	return {
		ok: true,
		value: importedChecks,
		imported: true,
		persisted: allowPersistManifest,
	};
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
				const requiredOnEvents = record.requiredOnEvents as
					| Array<unknown>
					| undefined;
				const requiredOnEventsValid =
					requiredOnEvents === undefined ||
					(Array.isArray(requiredOnEvents) &&
						requiredOnEvents.every(
							(event) => event === "pull_request" || event === "merge_group",
						));
				const freshnessWindowDays = record.freshnessWindowDays;
				const freshnessWindowDaysValid =
					freshnessWindowDays === undefined ||
					(typeof freshnessWindowDays === "number" &&
						Number.isInteger(freshnessWindowDays) &&
						freshnessWindowDays >= 1 &&
						freshnessWindowDays <= 7);
				return (
					typeof record.policyId === "string" &&
					typeof record.displayName === "string" &&
					typeof record.sourceAppSlug === "string" &&
					typeof record.sourceAppId === "string" &&
					typeof record.externalIdPattern === "string" &&
					requiredOnEventsValid &&
					freshnessWindowDaysValid &&
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

function validateRequiredChecksForVerify(
	requiredChecks: RequiredCheckIdentity[],
): string[] {
	const violations: string[] = [];
	const seenDisplayNames = new Set<string>();
	for (const check of requiredChecks) {
		const trimmedDisplayName = check.displayName.trim();
		if (trimmedDisplayName.startsWith("shadow/")) {
			violations.push(
				`Required check ${trimmedDisplayName} uses forbidden shadow/* namespace. Reclassify this check before strict verify.`,
			);
		}
		if (seenDisplayNames.has(trimmedDisplayName)) {
			violations.push(
				`Duplicate required check displayName detected: ${trimmedDisplayName}. Required check names must be unique to avoid merge deadlocks.`,
			);
		}
		seenDisplayNames.add(trimmedDisplayName);

		const requiredOnEvents = check.requiredOnEvents;
		if (!Array.isArray(requiredOnEvents)) {
			violations.push(
				`Required check ${trimmedDisplayName} is missing requiredOnEvents. Expected both pull_request and merge_group.`,
			);
		} else {
			if (!requiredOnEvents.includes("pull_request")) {
				violations.push(
					`Required check ${trimmedDisplayName} is missing pull_request coverage in requiredOnEvents.`,
				);
			}
			if (!requiredOnEvents.includes("merge_group")) {
				violations.push(
					`Required check ${trimmedDisplayName} is missing merge_group coverage in requiredOnEvents.`,
				);
			}
		}

		const freshnessWindowDays = check.freshnessWindowDays;
		if (
			typeof freshnessWindowDays !== "number" ||
			!Number.isInteger(freshnessWindowDays) ||
			freshnessWindowDays < 1 ||
			freshnessWindowDays > 7
		) {
			violations.push(
				`Required check ${trimmedDisplayName} must define freshnessWindowDays as an integer between 1 and 7.`,
			);
		}

		if (check.sourceAppId.trim().length === 0) {
			violations.push(
				`Required check ${trimmedDisplayName} has an empty sourceAppId.`,
			);
		}

		try {
			void new RegExp(check.externalIdPattern);
		} catch {
			violations.push(
				`Required check ${trimmedDisplayName} has an invalid externalIdPattern regex: ${check.externalIdPattern}`,
			);
		}
	}
	return violations;
}

function validateTransitionStatusArtifact(
	targetDir: string,
	relativePath: string,
	requireNextGateComplete: boolean,
): string[] {
	const artifactPath = resolve(targetDir, relativePath);
	if (!existsSync(artifactPath)) {
		return [
			`Transition status artifact missing: ${relativePath}. Create the artifact before running verify.`,
		];
	}
	try {
		const parsed = JSON.parse(readFileSync(artifactPath, "utf-8")) as {
			schemaVersion?: string | undefined;
			nextGateComplete?: boolean | undefined;
			updatedAt?: string | undefined;
		};
		const violations: string[] = [];
		if (parsed.schemaVersion !== "ci-provider-transition-status/v1") {
			violations.push(
				`Transition status artifact schemaVersion must be ci-provider-transition-status/v1 (received ${String(parsed.schemaVersion)}).`,
			);
		}
		if (typeof parsed.nextGateComplete !== "boolean") {
			violations.push(
				"Transition status artifact must define nextGateComplete as a boolean.",
			);
		} else if (requireNextGateComplete && !parsed.nextGateComplete) {
			violations.push(
				"Transition status artifact nextGateComplete=false blocks strict verify for required-mode migration stages.",
			);
		}
		if (
			typeof parsed.updatedAt !== "string" ||
			!Number.isFinite(Date.parse(parsed.updatedAt))
		) {
			violations.push(
				"Transition status artifact must define updatedAt as a valid ISO-8601 timestamp.",
			);
		}
		return violations;
	} catch (error) {
		return [
			`Failed to parse transition status artifact ${relativePath}: ${sanitizeError(error)}`,
		];
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
	requiredChecksOverride?: RequiredCheckIdentity[],
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
	const checksResult = requiredChecksOverride
		? { ok: true as const, value: requiredChecksOverride }
		: sourceAdapter.readRequiredChecks(targetDir);
	if (!checksResult.ok) {
		return { ok: false, error: checksResult.error };
	}
	const targetChecksResult = requiredChecksOverride
		? { ok: true as const, value: requiredChecksOverride }
		: targetAdapter.readRequiredChecks(targetDir);
	if (!targetChecksResult.ok) {
		return { ok: false, error: targetChecksResult.error };
	}
	const allRequiredChecksResult = requiredChecksOverride
		? { ok: true as const, value: requiredChecksOverride }
		: readAllRequiredChecks(targetDir);
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
	let breakGlassGovernancePolicy: BreakGlassGovernancePolicy | null = null;
	let mergeQueueWindowActive = false;
	let mergeQueueWindowPreCutover: BranchProtectionSatisfiabilityReport | null =
		null;
	let mergeQueueWindowPausedAt: string | null = null;
	let mergeQueueWindowDrainedAt: string | null = null;
	let mergeQueueEvidence: MergeQueueEvidenceRecord | null = null;
	let mergeQueueEvidenceBinding: MergeQueueEvidenceBinding | null = null;
	const writeMergeQueueWindowStage = (
		stage: MergeQueueCutoverWindow["stage"],
		options?: {
			pausedAt?: string | undefined;
			drainedAt?: string | undefined;
			revalidatedAt?: string | undefined;
			abortedAt?: string | undefined;
			postCutover?: BranchProtectionSatisfiabilityReport | undefined;
		},
	): boolean => {
		if (!mergeQueueWindowActive || !mergeQueueWindowPreCutover) {
			return true;
		}
		const pausedAt =
			options?.pausedAt ??
			mergeQueueEvidence?.evidence.pausedAt ??
			mergeQueueWindowPausedAt ??
			new Date().toISOString();
		const drainedAt =
			options?.drainedAt ??
			mergeQueueEvidence?.evidence.drainedAt ??
			mergeQueueWindowDrainedAt;
		const window: MergeQueueCutoverWindow = {
			schemaVersion: "ci-migrate-merge-queue-window/v1",
			snapshotId,
			stage,
			pausedAt,
			preCutover: mergeQueueWindowPreCutover,
			postCutover: options?.postCutover,
			evidence:
				mergeQueueEvidence === null
					? undefined
					: {
							sourcePath: mergeQueueEvidence.sourcePath,
							contentSha256: mergeQueueEvidence.contentSha256,
							binding: mergeQueueEvidence.evidence.binding,
							pausedAt: mergeQueueEvidence.evidence.pausedAt,
							drainedAt: mergeQueueEvidence.evidence.drainedAt,
							revalidatedAt: mergeQueueEvidence.evidence.revalidatedAt,
							pausedQueueDepth: mergeQueueEvidence.evidence.pausedQueueDepth,
							drainedCandidateCount:
								mergeQueueEvidence.evidence.drainedCandidateCount,
							revalidatedCandidateCount:
								mergeQueueEvidence.evidence.revalidatedCandidateCount,
						},
		};
		if (stage === "drained" || stage === "revalidated" || stage === "aborted") {
			window.drainedAt = drainedAt ?? new Date().toISOString();
		}
		if (stage === "revalidated") {
			window.revalidatedAt =
				options?.revalidatedAt ??
				mergeQueueEvidence?.evidence.revalidatedAt ??
				new Date().toISOString();
		}
		if (stage === "aborted") {
			window.abortedAt = options?.abortedAt ?? new Date().toISOString();
		}
		const writeResult = writeMergeQueueWindow(dir, window);
		if (!writeResult.ok) {
			console.error(`Error: ${writeResult.error}`);
			return false;
		}
		mergeQueueWindowPausedAt = pausedAt;
		if (window.drainedAt) {
			mergeQueueWindowDrainedAt = window.drainedAt;
		}
		return true;
	};

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
		const breakGlassPolicyResult = readBreakGlassGovernancePolicy(dir);
		if (!breakGlassPolicyResult.ok) {
			console.error(`Error: ${breakGlassPolicyResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
		breakGlassGovernancePolicy = breakGlassPolicyResult.value;
		const policyViolations = validateBreakGlassApprovalAgainstPolicy(
			breakGlassApproval,
			breakGlassGovernancePolicy,
		);
		if (policyViolations.length > 0) {
			console.error(
				"Error: break-glass approval does not satisfy governance policy:",
			);
			for (const violation of policyViolations) {
				console.error(`- ${violation}`);
			}
			return EXIT_CODES.INVALID_PATH;
		}
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
		if (rollbackMayWeakenChecksOrRulesets && breakGlassApproval) {
			if (!breakGlassGovernancePolicy) {
				console.error(
					`Error: break-glass governance policy is required for rollback weakening: ${BREAK_GLASS_POLICY_PATH}`,
				);
				return EXIT_CODES.INVALID_PATH;
			}
			const weakeningPolicyViolations = validateBreakGlassApprovalAgainstPolicy(
				breakGlassApproval,
				breakGlassGovernancePolicy,
				{ requireDualForRollbackWeakening: true },
			);
			if (weakeningPolicyViolations.length > 0) {
				console.error(
					"Error: break-glass rollback-weakening approval failed governance policy checks:",
				);
				for (const violation of weakeningPolicyViolations) {
					console.error(`- ${violation}`);
				}
				return EXIT_CODES.INVALID_PATH;
			}
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
		const requiredChecksImportResult = readOrImportRequiredChecks(
			dir,
			sourceProvider,
			apply && !dryRun,
		);
		if (!requiredChecksImportResult.ok) {
			console.error(`Error: ${requiredChecksImportResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		if (requiredChecksImportResult.imported) {
			if (requiredChecksImportResult.persisted) {
				console.info(
					"Required checks manifest bootstrapped from legacy contract/workflow evidence: .harness/ci-required-checks.json",
				);
			} else {
				console.info(
					"Required checks manifest missing; using imported legacy contract/workflow checks for this run (dry-run).",
				);
			}
		}
		const autoGenerateProofPackResult = maybeAutoGenerateParityProofPack(
			dir,
			provider,
			options.autoGenerateProofPack === true,
		);
		if (!autoGenerateProofPackResult.ok) {
			console.error(`Error: ${autoGenerateProofPackResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
		if (autoGenerateProofPackResult.generated) {
			console.info(
				`Parity proof pack generated: ${resolve(dir, PARITY_PROOF_PACK_PATH)}`,
			);
		}
		const reportResult = buildMigrationReport(
			dir,
			sourceProvider,
			provider,
			requiredChecksImportResult.value,
		);
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

		if (action === "verify") {
			const policyResult = readContractProviderPolicy(dir, { strict: true });
			if (!policyResult.ok) {
				console.error(`Error: ${policyResult.error}`);
				return EXIT_CODES.INVALID_PATH;
			}
			const requiredChecksResult = readAllRequiredChecks(dir);
			if (!requiredChecksResult.ok) {
				console.error(`Error: ${requiredChecksResult.error}`);
				return EXIT_CODES.INVALID_PATH;
			}
			const verificationViolations = [
				...validateRequiredChecksForVerify(requiredChecksResult.value),
				...validateTransitionStatusArtifact(
					dir,
					policyResult.value.transitionStatusArtifactPath,
					policyResult.value.mode === "required" &&
						policyResult.value.migrationStage !== "circleci-only",
				),
			];
			if (verificationViolations.length > 0) {
				console.error("Error: strict verify failed:");
				for (const violation of verificationViolations) {
					console.error(`- ${violation}`);
				}
				return EXIT_CODES.INVALID_PATH;
			}
			return EXIT_CODES.SUCCESS;
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
		const promotionEvidenceRequired = shouldRequirePromotionEvidence(
			dir,
			provider,
		);
		const requireFullMergeQueueLifecycle = promotionEvidenceRequired;
		const requireMergeQueueEvidence =
			options.mergeQueueEvidencePath !== undefined ||
			requireFullMergeQueueLifecycle;
		const configuredMergeQueueEvidencePath =
			typeof options.mergeQueueEvidencePath === "string" &&
			options.mergeQueueEvidencePath.trim().length > 0
				? options.mergeQueueEvidencePath.trim()
				: DEFAULT_MERGE_QUEUE_EVIDENCE_PATH;
		const configuredOrchestratorPath =
			typeof options.mergeQueueOrchestratorPath === "string"
				? options.mergeQueueOrchestratorPath.trim()
				: undefined;
		if (
			options.mergeQueueOrchestratorPath !== undefined &&
			(!configuredOrchestratorPath || configuredOrchestratorPath.length === 0)
		) {
			console.error(
				"Error: --merge-queue-orchestrator requires a non-empty executable path.",
			);
			return EXIT_CODES.INVALID_PATH;
		}
		const mergeQueueOrchestratorPath =
			configuredOrchestratorPath && configuredOrchestratorPath.length > 0
				? configuredOrchestratorPath
				: requireMergeQueueEvidence &&
						existsSync(resolve(dir, DEFAULT_MERGE_QUEUE_ORCHESTRATOR_PATH))
					? DEFAULT_MERGE_QUEUE_ORCHESTRATOR_PATH
					: undefined;
		const mergeQueueEvidencePathExplicitlyProvided =
			options.mergeQueueEvidencePath !== undefined;
		const hasExistingMergeQueueEvidence = existsSync(
			resolve(dir, configuredMergeQueueEvidencePath),
		);
		if (
			requireFullMergeQueueLifecycle ||
			mergeQueueOrchestratorPath !== undefined ||
			mergeQueueEvidencePathExplicitlyProvided ||
			hasExistingMergeQueueEvidence
		) {
			const mergeQueueBindingResult = deriveMergeQueueEvidenceBinding(dir);
			if (!mergeQueueBindingResult.ok) {
				console.error(`Error: ${mergeQueueBindingResult.error}`);
				return EXIT_CODES.INVALID_PATH;
			}
			mergeQueueEvidenceBinding = mergeQueueBindingResult.value;
		}
		if (mergeQueueOrchestratorPath && mergeQueueEvidenceBinding) {
			const signingKeyResult = resolveSnapshotSigningKey();
			if (!signingKeyResult.ok) {
				console.error(`Error: ${signingKeyResult.error}`);
				return EXIT_CODES.INVALID_PATH;
			}
			const orchestratorRunResult = runMergeQueueOrchestrator(
				dir,
				mergeQueueOrchestratorPath,
				snapshotId,
				configuredMergeQueueEvidencePath,
				requireFullMergeQueueLifecycle,
				mergeQueueEvidenceBinding,
				signingKeyResult.key,
			);
			if (!orchestratorRunResult.ok) {
				console.error(`Error: ${orchestratorRunResult.error}`);
				return EXIT_CODES.INVALID_PATH;
			}
		}
		const mergeQueueEvidenceResult = readMergeQueueEvidence(
			dir,
			snapshotId,
			options.mergeQueueEvidencePath !== undefined ||
				mergeQueueOrchestratorPath !== undefined
				? configuredMergeQueueEvidencePath
				: undefined,
			requireMergeQueueEvidence || mergeQueueOrchestratorPath !== undefined,
			mergeQueueEvidenceBinding,
		);
		if (!mergeQueueEvidenceResult.ok) {
			console.error(`Error: ${mergeQueueEvidenceResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
		mergeQueueEvidence = mergeQueueEvidenceResult.value;
		if (mergeQueueEvidence) {
			const evidenceViolations = validateMergeQueueEvidenceLifecycle(
				mergeQueueEvidence,
				requireFullMergeQueueLifecycle,
			);
			if (evidenceViolations.length > 0) {
				console.error("Error: merge-queue orchestration evidence is invalid:");
				for (const violation of evidenceViolations) {
					console.error(`- ${violation}`);
				}
				return EXIT_CODES.INVALID_PATH;
			}
		}
		const mergeQueueAdmissionResult = assertNoBlockingMergeQueueCutoverWindow(
			dir,
			snapshotId,
		);
		if (!mergeQueueAdmissionResult.ok) {
			console.error(`Error: ${mergeQueueAdmissionResult.error}`);
			return EXIT_CODES.INVALID_PATH;
		}
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

	if (apply && !dryRun && migrationReport) {
		mergeQueueWindowActive = true;
		mergeQueueWindowPreCutover = migrationReport.satisfiability.preCutover;
		mergeQueueWindowPausedAt = new Date().toISOString();
		if (
			!writeMergeQueueWindowStage("paused", {
				pausedAt: mergeQueueWindowPausedAt,
			})
		) {
			return EXIT_CODES.WRITE_ERROR;
		}
	}

	const exitCode = runInitCLI(dir, initOptions);
	if (exitCode !== EXIT_CODES.SUCCESS) {
		if (
			!writeMergeQueueWindowStage("aborted", {
				abortedAt: new Date().toISOString(),
			})
		) {
			return EXIT_CODES.WRITE_ERROR;
		}
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
			if (
				!writeMergeQueueWindowStage("aborted", {
					abortedAt: new Date().toISOString(),
				})
			) {
				return EXIT_CODES.WRITE_ERROR;
			}
			console.error(`Error: ${postCutoverRequiredChecksResult.error}`);
			return EXIT_CODES.WRITE_ERROR;
		}
		mergeQueueWindowDrainedAt = new Date().toISOString();
		if (
			!writeMergeQueueWindowStage("drained", {
				drainedAt: mergeQueueWindowDrainedAt,
			})
		) {
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
			if (
				!writeMergeQueueWindowStage("aborted", {
					abortedAt: new Date().toISOString(),
					postCutover: postCutoverSatisfiability,
				})
			) {
				return EXIT_CODES.WRITE_ERROR;
			}
			return reportExitCode;
		}
		const postCutoverMissingLiveEvidence =
			migrationReport.promotionEvidence.required &&
			postCutoverSatisfiability.scannedOpenPrs < 1;
		if (
			postCutoverSatisfiability.status !== "satisfied" ||
			postCutoverMissingLiveEvidence
		) {
			if (
				!writeMergeQueueWindowStage("aborted", {
					abortedAt: new Date().toISOString(),
					postCutover: postCutoverSatisfiability,
				})
			) {
				return EXIT_CODES.WRITE_ERROR;
			}
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
		if (
			!writeMergeQueueWindowStage("revalidated", {
				revalidatedAt: new Date().toISOString(),
				postCutover: postCutoverSatisfiability,
			})
		) {
			return EXIT_CODES.WRITE_ERROR;
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
