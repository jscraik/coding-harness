import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import {
	chmodSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { CIRCLECI_PRIMARY_CHECK } from "../lib/ci/branch-protect-sync.js";
import type {
	BranchProtectionSatisfiabilityReport,
	scanOpenPullRequestSatisfiability as scanOpenPullRequestSatisfiabilityType,
} from "../lib/ci/satisfiability.js";
import { EXIT_CODES } from "../lib/init/types.js";
import { sanitizeGitEnv } from "../lib/workflow-contract/test-harness.js";
import type { runInitCLI as runInitCLIType } from "./init.js";

type RunInitCLIImpl = typeof runInitCLIType;
type ScanOpenPullRequestSatisfiabilityImpl =
	typeof scanOpenPullRequestSatisfiabilityType;

const runInitCLIMock = vi.hoisted(() => vi.fn<RunInitCLIImpl>(() => 0));
const scanOpenPullRequestSatisfiabilityMock = vi.hoisted(() =>
	vi.fn<ScanOpenPullRequestSatisfiabilityImpl>(
		(): BranchProtectionSatisfiabilityReport => ({
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		}),
	),
);
const { runCIMigrateCLI, setCIMigrateTestOverrides } = await import(
	"./ci-migrate.js"
);

function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

const TEST_SNAPSHOT_SIGNING_KEY =
	"test-signing-key-for-ci-migrate-snapshots-0123456789";
const CI_MIGRATE_VERIFY_FAILED_EXIT_CODE = 1;
const SNAPSHOT_SIGNING_KEY_ENV = "HARNESS_CI_MIGRATE_SIGNING_KEY";
const EXTERNAL_CONTROL_PLANE_PATHS = [
	".harness/control-plane/github-rulesets.json",
	".harness/control-plane/circleci-project-settings.json",
	".harness/control-plane/circleci-context-bindings.json",
	".harness/control-plane/github-app-installation.json",
] as const;
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
const TEST_REPO_FULL_NAME = "jamie/coding-harness-test";
const TEST_REPO_ORIGIN_URL = `https://github.com/${TEST_REPO_FULL_NAME}.git`;
const TEST_REQUIRED_CHECK_MANIFEST_PATH = ".harness/ci-required-checks.json";
const TEST_TRANSITION_STATUS_ARTIFACT_PATH =
	".harness/ci-provider-transition-status.json";
const TEST_TRUSTED_POLICY_REF = "refs/heads/main";
const MERGE_QUEUE_WINDOW_PATH =
	".harness/control-plane/merge-queue-cutover-window.json";
const PARITY_PROOF_INPUT_PATH = ".harness/ci-parity-proof-pack.input.json";
const PARITY_PROOF_PACK_PATH = ".harness/ci-parity-proof-pack.json";
const PARITY_PROOF_PACK_SIGNATURE_PATH = ".harness/ci-parity-proof-pack.sig";
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
const MERGE_QUEUE_EVIDENCE_PATH =
	".harness/control-plane/merge-queue-cutover-evidence.json";
const MERGE_QUEUE_ORCHESTRATOR_PATH =
	".harness/control-plane/merge-queue-cutover-orchestrator";
const MERGE_QUEUE_PROVIDER_API_PATH =
	".harness/control-plane/merge-queue-provider-api.json";
const BREAK_GLASS_POLICY_PATH =
	".harness/control-plane/ci-migrate-break-glass-policy.json";
const BREAK_GLASS_ROSTER_PATH =
	".harness/control-plane/ci-migrate-break-glass-roster.json";
const BREAK_GLASS_OPS_WORKFLOW_PATH =
	".harness/control-plane/ci-migrate-break-glass-ops-workflow.json";
const PARITY_PROOF_HARVEST_MANIFEST_PATH =
	".harness/ci-parity-proof-harvest-manifest.json";

function signContent(content: string, signingKey: string): string {
	return createHmac("sha256", signingKey)
		.update(content, "utf-8")
		.digest("hex");
}

function hashSigningKeyId(signingKey: string): string {
	return hashContent(signingKey).slice(0, 16);
}

function runTestGitCommand(
	targetDir: string,
	args: string[],
): { ok: true; stdout: string } | { ok: false; error: string } {
	const result = spawnSync("git", args, {
		cwd: targetDir,
		encoding: "utf-8",
		env: sanitizeGitEnv(),
	});
	if (result.error) {
		return {
			ok: false,
			error: `git command failed: ${result.error.message}`,
		};
	}
	if (result.status !== 0) {
		const stderr = result.stderr?.trim();
		const output = stderr.length > 0 ? stderr : (result.stdout ?? "").trim();
		return {
			ok: false,
			error: output.length > 0 ? output : "git command failed.",
		};
	}
	return {
		ok: true,
		stdout: (result.stdout ?? "").trim(),
	};
}

function resolveHeadSha(targetDir: string): string | null {
	const headResult = runTestGitCommand(targetDir, [
		"rev-parse",
		"--verify",
		"HEAD^{commit}",
	]);
	if (!headResult.ok) {
		return null;
	}
	const candidate = headResult.stdout.trim();
	return candidate.length === 40 ? candidate : null;
}

function resolveParentSha(targetDir: string, commitSha: string): string | null {
	const baseResult = runTestGitCommand(targetDir, [
		"rev-parse",
		"--verify",
		`${commitSha}^`,
	]);
	if (!baseResult.ok) {
		return null;
	}
	const candidate = baseResult.stdout.trim();
	return candidate.length === 40 ? candidate : null;
}

function ensureProofPackFixtureHistory(targetDir: string): {
	baseSha: string;
	headSha: string;
} {
	const ensureCommand = (args: string[], errorMessage: string): void => {
		const result = runTestGitCommand(targetDir, args);
		if (!result.ok) {
			throw new Error(`${errorMessage}: ${result.error}`);
		}
	};

	const existingHeadSha = resolveHeadSha(targetDir);
	if (!existingHeadSha) {
		ensureCommand(["init", "-q"], "Unable to initialize fixture git");
		ensureCommand(
			["config", "user.name", "Harness Test"],
			"Unable to configure fixture git user",
		);
		ensureCommand(
			["config", "user.email", "harness@test.local"],
			"Unable to configure fixture git email",
		);
		writeFileSync(
			join(targetDir, ".harness/ci-migrate-history-seed.txt"),
			"proof pack fixture seed\n",
		);
		ensureCommand(["add", "-A"], "Unable to stage fixture seed commit");
		ensureCommand(
			["commit", "-q", "-m", "test fixture initial commit"],
			"Unable to write fixture initial commit",
		);
	} else {
		ensureCommand(
			["config", "user.name", "Harness Test"],
			"Unable to configure fixture git user",
		);
		ensureCommand(
			["config", "user.email", "harness@test.local"],
			"Unable to configure fixture git email",
		);
	}

	let headSha = resolveHeadSha(targetDir);
	if (!headSha) {
		throw new Error(
			"Unable to establish fixture git HEAD for proof pack tests.",
		);
	}

	const workingTreeStatusResult = runTestGitCommand(targetDir, [
		"status",
		"--porcelain",
	]);
	if (!workingTreeStatusResult.ok) {
		throw new Error("Unable to read proof-pack fixture git status.");
	}
	if (workingTreeStatusResult.stdout.trim().length > 0) {
		ensureCommand(["add", "-A"], "Unable to stage proof-pack fixture changes");
		ensureCommand(
			["commit", "-q", "-m", "test fixture proof-pack state"],
			"Unable to write proof-pack fixture state commit",
		);
		headSha = resolveHeadSha(targetDir);
		if (!headSha) {
			throw new Error("Unable to advance proof-pack fixture git HEAD.");
		}
	}

	let baseSha = resolveParentSha(targetDir, headSha);
	if (!baseSha) {
		const baseline = Date.now().toString();
		writeFileSync(
			join(targetDir, ".harness/ci-migrate-history-head.txt"),
			`${baseline}\n`,
		);
		ensureCommand(["add", "-A"], "Unable to stage fallback base-commit probe");
		ensureCommand(
			["commit", "-q", "-m", "test fixture head commit"],
			"Unable to write fallback proof-pack head commit",
		);
		headSha = resolveHeadSha(targetDir);
		if (!headSha) {
			throw new Error("Unable to establish fixture git head commit.");
		}
		baseSha = resolveParentSha(targetDir, headSha);
		if (!baseSha) {
			throw new Error(
				"Unable to derive distinct base/head SHAs from fixture git history.",
			);
		}
	}
	if (baseSha === headSha) {
		throw new Error(
			"Proof pack fixture baseSha and headSha must differ to prove parity comparison.",
		);
	}
	// CircleCI Linux images may default fixture repos to `master`.
	// Force a concrete `refs/heads/main` ref so trustedPolicyRef ancestry checks
	// behave consistently across platforms.
	ensureCommand(
		["update-ref", "refs/heads/main", headSha],
		"Unable to align fixture main branch ref",
	);
	ensureCommand(
		["symbolic-ref", "HEAD", "refs/heads/main"],
		"Unable to align fixture main branch",
	);
	return {
		baseSha,
		headSha,
	};
}

function canonicalizeParityProofPackForDigest(
	proofPack: Record<string, unknown>,
): string {
	const repo = proofPack.repo as Record<string, unknown>;
	const policyDigests = proofPack.policyDigests as Record<string, unknown>;
	const behavioralParity = proofPack.behavioralParity as Record<
		string,
		unknown
	>;
	const promotionGate = proofPack.promotionGate as Record<string, unknown>;
	const downstream = proofPack.downstream as Record<string, unknown>;
	const integrity = proofPack.integrity as Record<string, unknown>;
	const artifacts =
		(proofPack.artifacts as Array<Record<string, unknown>>) ?? [];
	const scenarios =
		(behavioralParity.scenarios as Array<Record<string, unknown>>) ?? [];
	const repositories =
		(downstream.repositories as Array<Record<string, unknown>>) ?? [];
	return JSON.stringify({
		schemaVersion: proofPack.schemaVersion,
		generatedAt: proofPack.generatedAt,
		sourceProvider: proofPack.sourceProvider,
		targetProvider: proofPack.targetProvider,
		repo: {
			fullName: repo.fullName,
			originUrl: repo.originUrl,
			trustedPolicyRef: repo.trustedPolicyRef,
			requiredCheckManifestPath: repo.requiredCheckManifestPath,
			baseSha: repo.baseSha,
			headSha: repo.headSha,
		},
		policyDigests: {
			authorityConfigSha256: policyDigests.authorityConfigSha256,
			requiredCheckManifestSha256: policyDigests.requiredCheckManifestSha256,
		},
		artifacts: artifacts.map((artifact) => ({
			artifactId: artifact.artifactId,
			path: artifact.path,
			sha256: artifact.sha256,
			signature: artifact.signature,
		})),
		behavioralParity: {
			scenarios: scenarios.map((scenario) => ({
				scenario: scenario.scenario,
				providersCompared: scenario.providersCompared,
				commitCount: scenario.commitCount,
				unexpectedDiffs: scenario.unexpectedDiffs,
			})),
		},
		promotionGate: {
			zeroUnexpectedDiffs: promotionGate.zeroUnexpectedDiffs,
			outcomeParity: promotionGate.outcomeParity,
			skippedSemanticsParity: promotionGate.skippedSemanticsParity,
			artifactParity: promotionGate.artifactParity,
			codeRabbitParity: promotionGate.codeRabbitParity,
			releaseParity: promotionGate.releaseParity,
		},
		downstream: {
			repositories: repositories.map((repository) => ({
				repo: repository.repo,
				ecosystemProfile: repository.ecosystemProfile,
				mergeQueue: repository.mergeQueue,
				parityMatrixVerified: repository.parityMatrixVerified,
				rollbackRehearsed: repository.rollbackRehearsed,
			})),
		},
		integrity: {
			signatureAlgorithm: integrity.signatureAlgorithm,
			signingKeyId: integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function writeSignedSnapshot(
	targetDir: string,
	snapshotId: string,
	content: string,
	options?: {
		createdAt?: string | undefined;
		expiresAt?: string | undefined;
		externalStateContent?: string | undefined;
	},
): void {
	const snapshotDir = join(targetDir, ".harness/ci-migrate-snapshots");
	mkdirSync(snapshotDir, { recursive: true });
	const snapshotPath = join(snapshotDir, `${snapshotId}.json`);
	const digestPath = join(snapshotDir, `${snapshotId}.sha256`);
	const attestationPath = join(snapshotDir, `${snapshotId}.attestation.json`);
	const signaturePath = join(snapshotDir, `${snapshotId}.attestation.sig`);
	const externalStatePath = join(
		snapshotDir,
		`${snapshotId}.external-control-plane.json`,
	);
	const now = new Date();
	const createdAt = options?.createdAt ?? now.toISOString();
	const expiresAt =
		options?.expiresAt ??
		new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
	const payloadDigest = hashContent(content);
	const externalStateContent =
		options?.externalStateContent ??
		JSON.stringify(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId,
				capturedAt: createdAt,
				artifacts: EXTERNAL_CONTROL_PLANE_PATHS.map((relativePath) => ({
					relativePath,
					existed: false,
				})),
			},
			null,
			2,
		);
	const externalStateDigest = hashContent(externalStateContent);
	const attestation = {
		schemaVersion: "ci-migrate-snapshot-attestation/v1",
		snapshotId,
		createdAt,
		expiresAt,
		payloadPath: `${snapshotId}.json`,
		payloadDigest,
		externalControlPlaneStatePath: `${snapshotId}.external-control-plane.json`,
		externalControlPlaneStateDigest: externalStateDigest,
		signatureAlgorithm: "hmac-sha256",
		signingKeyId: hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY),
	};
	const attestationContent = JSON.stringify(attestation, null, 2);
	writeFileSync(snapshotPath, content);
	writeFileSync(digestPath, `${payloadDigest}\n`);
	writeFileSync(externalStatePath, externalStateContent);
	writeFileSync(attestationPath, attestationContent);
	writeFileSync(
		signaturePath,
		`${signContent(attestationContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
}

function readMergeQueueCutoverWindow(targetDir: string): {
	snapshotId: string;
	stage: string;
	pausedAt: string;
	drainedAt?: string | undefined;
	revalidatedAt?: string | undefined;
	abortedAt?: string | undefined;
	preCutover: { status: string; scannedOpenPrs: number };
	postCutover?: { status: string; scannedOpenPrs: number } | undefined;
	evidence?:
		| {
				sourcePath: string;
				contentSha256: string;
				pausedQueueDepth?: number | undefined;
		  }
		| undefined;
} {
	return JSON.parse(
		readFileSync(join(targetDir, MERGE_QUEUE_WINDOW_PATH), "utf-8"),
	) as {
		snapshotId: string;
		stage: string;
		pausedAt: string;
		drainedAt?: string | undefined;
		revalidatedAt?: string | undefined;
		abortedAt?: string | undefined;
		preCutover: { status: string; scannedOpenPrs: number };
		postCutover?: { status: string; scannedOpenPrs: number } | undefined;
		evidence?:
			| {
					sourcePath: string;
					contentSha256: string;
					pausedQueueDepth?: number | undefined;
			  }
			| undefined;
	};
}

function writeMergeQueueCutoverWindow(
	targetDir: string,
	window: {
		snapshotId: string;
		stage: "paused" | "drained" | "revalidated" | "aborted";
	},
): void {
	const pausedAt = new Date().toISOString();
	const baseWindow: Record<string, unknown> = {
		schemaVersion: "ci-migrate-merge-queue-window/v1",
		snapshotId: window.snapshotId,
		stage: window.stage,
		pausedAt,
		preCutover: {
			status: "satisfied",
			scannedOpenPrs: 1,
			failingPrs: [],
		},
	};
	if (
		window.stage === "drained" ||
		window.stage === "revalidated" ||
		window.stage === "aborted"
	) {
		baseWindow.drainedAt = pausedAt;
	}
	if (window.stage === "revalidated") {
		baseWindow.revalidatedAt = pausedAt;
		baseWindow.postCutover = {
			status: "satisfied",
			scannedOpenPrs: 1,
			failingPrs: [],
		};
	}
	if (window.stage === "aborted") {
		baseWindow.abortedAt = pausedAt;
	}
	mkdirSync(dirname(join(targetDir, MERGE_QUEUE_WINDOW_PATH)), {
		recursive: true,
	});
	const windowContent = JSON.stringify(baseWindow, null, 2);
	writeFileSync(join(targetDir, MERGE_QUEUE_WINDOW_PATH), windowContent);
	writeFileSync(
		join(targetDir, `${MERGE_QUEUE_WINDOW_PATH}.sig`),
		`${signContent(windowContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
}

function seedMigratableFixture(targetDir: string): void {
	mkdirSync(join(targetDir, ".harness"), { recursive: true });
	mkdirSync(join(targetDir, ".github", "workflows"), { recursive: true });
	mkdirSync(join(targetDir, ".git"), { recursive: true });
	writeFileSync(
		join(targetDir, ".git/config"),
		[
			'[remote "origin"]',
			`\turl = ${TEST_REPO_ORIGIN_URL}`,
			"\tfetch = +refs/heads/*:refs/remotes/origin/*",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(targetDir, ".harness/restore-manifest.json"),
		JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		}),
	);
	writeFileSync(
		join(targetDir, ".github/workflows/pr-pipeline.yml"),
		"name: test",
	);
	writeFileSync(
		join(targetDir, ".harness/ci-required-checks.json"),
		JSON.stringify(
			{
				version: 1,
				activeProvider: "github-actions",
				requiredChecks: [
					{
						policyId: "required-check-1",
						displayName: "pr-pipeline",
						sourceAppSlug: "github-actions",
						sourceAppId: "github-actions",
						externalIdPattern: "^pr-pipeline$",
						class: "required",
					},
				],
			},
			null,
			2,
		),
	);
}

function writeCIProviderPolicyContract(
	targetDir: string,
	mode: "shadow" | "required",
	overrides?: Partial<{
		activeProvider: string;
		migrationStage: string;
		transitionStatusArtifactPath: string;
		authorityConfigPath: string;
		requiredCheckManifestPath: string;
		trustedPolicyRef: string;
	}>,
): void {
	writeFileSync(
		join(targetDir, "harness.contract.json"),
		JSON.stringify(
			{
				ciProviderPolicy: {
					activeProvider: overrides?.activeProvider ?? "github-actions",
					mode,
					migrationStage: overrides?.migrationStage ?? "dual-provider",
					transitionStatusArtifactPath:
						overrides?.transitionStatusArtifactPath ??
						TEST_TRANSITION_STATUS_ARTIFACT_PATH,
					authorityConfigPath:
						overrides?.authorityConfigPath ?? "harness.contract.json",
					requiredCheckManifestPath:
						overrides?.requiredCheckManifestPath ??
						TEST_REQUIRED_CHECK_MANIFEST_PATH,
					trustedPolicyRef:
						overrides?.trustedPolicyRef ?? TEST_TRUSTED_POLICY_REF,
				},
			},
			null,
			2,
		),
	);
}

function buildMergeQueueEvidenceBinding(targetDir: string): {
	repoFullName: string;
	headSha: string;
	trustedPolicyRef: string;
	authorityConfigSha256: string;
	requiredCheckManifestSha256: string;
} {
	const placeholderSha = "0".repeat(40);
	const headSha = resolveHeadSha(targetDir) ?? placeholderSha;
	const trustedPolicyRefResult = runTestGitCommand(targetDir, [
		"rev-parse",
		"--verify",
		`${TEST_TRUSTED_POLICY_REF}^{commit}`,
	]);
	const trustedPolicyRef =
		trustedPolicyRefResult.ok && trustedPolicyRefResult.stdout.length === 40
			? trustedPolicyRefResult.stdout
			: headSha;
	const authorityConfigPath = join(targetDir, "harness.contract.json");
	const requiredChecksPath = join(targetDir, TEST_REQUIRED_CHECK_MANIFEST_PATH);
	const authorityConfigSha256 = existsSync(authorityConfigPath)
		? hashContent(readFileSync(authorityConfigPath, "utf-8"))
		: hashContent("{}");
	const requiredCheckManifestSha256 = existsSync(requiredChecksPath)
		? hashContent(readFileSync(requiredChecksPath, "utf-8"))
		: hashContent("{}");
	return {
		repoFullName: TEST_REPO_FULL_NAME,
		headSha,
		trustedPolicyRef,
		authorityConfigSha256,
		requiredCheckManifestSha256,
	};
}

function writeParityProofPack(
	targetDir: string,
	options?: {
		overrideUnexpectedDiffs?:
			| Partial<Record<(typeof REQUIRED_PARITY_SCENARIOS)[number], string[]>>
			| undefined;
		downstreamRepositories?:
			| Array<{
					repo: string;
					ecosystemProfile: string;
					mergeQueue: boolean;
					parityMatrixVerified: boolean;
					rollbackRehearsed: boolean;
			  }>
			| undefined;
		overridePromotionGate?:
			| Partial<{
					zeroUnexpectedDiffs: boolean;
					outcomeParity: boolean;
					skippedSemanticsParity: boolean;
					artifactParity: boolean;
					codeRabbitParity: boolean;
					releaseParity: boolean;
			  }>
			| undefined;
		generatedAt?: string | undefined;
	},
): void {
	const history = ensureProofPackFixtureHistory(targetDir);
	mkdirSync(join(targetDir, ".harness"), { recursive: true });
	const artifactDir = join(
		targetDir,
		".harness/ci-parity-proof-pack-artifacts",
	);
	mkdirSync(artifactDir, { recursive: true });
	const scenarios = REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
		scenario,
		providersCompared: ["github-actions", "circleci"],
		commitCount: 3,
		unexpectedDiffs: options?.overrideUnexpectedDiffs?.[scenario] ?? [],
	}));
	const downstreamRepositories = options?.downstreamRepositories ?? [
		{
			repo: "jamie/repo-a",
			ecosystemProfile: "node-library",
			mergeQueue: false,
			parityMatrixVerified: true,
			rollbackRehearsed: true,
		},
		{
			repo: "jamie/repo-b",
			ecosystemProfile: "worker-service",
			mergeQueue: true,
			parityMatrixVerified: true,
			rollbackRehearsed: true,
		},
		{
			repo: "jamie/repo-c",
			ecosystemProfile: "node-library",
			mergeQueue: false,
			parityMatrixVerified: true,
			rollbackRehearsed: true,
		},
	];
	const promotionGate = {
		zeroUnexpectedDiffs: true,
		outcomeParity: true,
		skippedSemanticsParity: true,
		artifactParity: true,
		codeRabbitParity: true,
		releaseParity: true,
		...options?.overridePromotionGate,
	};
	const paritySummaryArtifactPath =
		".harness/ci-parity-proof-pack-artifacts/parity-summary.json";
	const downstreamArtifactPath =
		".harness/ci-parity-proof-pack-artifacts/downstream-proof.json";
	const paritySummaryContent = JSON.stringify(
		{
			scenarios: scenarios.map((scenario) => ({
				scenario: scenario.scenario,
				commitCount: scenario.commitCount,
			})),
		},
		null,
		2,
	);
	const downstreamProofContent = JSON.stringify(
		{
			repositories: downstreamRepositories.map((repository) => repository.repo),
			profiles: downstreamRepositories.map(
				(repository) => repository.ecosystemProfile,
			),
		},
		null,
		2,
	);
	writeFileSync(
		join(targetDir, paritySummaryArtifactPath),
		paritySummaryContent,
	);
	writeFileSync(
		join(targetDir, downstreamArtifactPath),
		downstreamProofContent,
	);

	const paritySummaryDigest = hashContent(paritySummaryContent);
	const downstreamProofDigest = hashContent(downstreamProofContent);
	const signingKeyId = hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY);
	const artifacts = [
		{
			artifactId: "parity-summary",
			path: paritySummaryArtifactPath,
			sha256: paritySummaryDigest,
			signature: signContent(
				`${paritySummaryArtifactPath}:${paritySummaryDigest}`,
				TEST_SNAPSHOT_SIGNING_KEY,
			),
		},
		{
			artifactId: "downstream-proof",
			path: downstreamArtifactPath,
			sha256: downstreamProofDigest,
			signature: signContent(
				`${downstreamArtifactPath}:${downstreamProofDigest}`,
				TEST_SNAPSHOT_SIGNING_KEY,
			),
		},
	];

	const authorityConfigPath = join(targetDir, "harness.contract.json");
	const requiredChecksPath = join(targetDir, TEST_REQUIRED_CHECK_MANIFEST_PATH);
	const authorityConfigDigest = hashContent(
		readFileSync(authorityConfigPath, "utf-8"),
	);
	const requiredChecksDigest = hashContent(
		readFileSync(requiredChecksPath, "utf-8"),
	);

	const proofPack = {
		schemaVersion: "ci-parity-proof-pack/v2",
		generatedAt: options?.generatedAt ?? new Date().toISOString(),
		sourceProvider: "github-actions",
		targetProvider: "circleci",
		repo: {
			fullName: TEST_REPO_FULL_NAME,
			originUrl: TEST_REPO_ORIGIN_URL,
			trustedPolicyRef: TEST_TRUSTED_POLICY_REF,
			requiredCheckManifestPath: TEST_REQUIRED_CHECK_MANIFEST_PATH,
			baseSha: history.baseSha,
			headSha: history.headSha,
		},
		policyDigests: {
			authorityConfigSha256: authorityConfigDigest,
			requiredCheckManifestSha256: requiredChecksDigest,
		},
		artifacts,
		behavioralParity: { scenarios },
		promotionGate,
		downstream: {
			repositories: downstreamRepositories,
		},
		integrity: {
			signatureAlgorithm: "hmac-sha256",
			signingKeyId,
			payloadSha256: "",
		},
	} as const;
	const payloadDigest = hashContent(
		canonicalizeParityProofPackForDigest(proofPack),
	);
	const proofPackWithDigest = {
		...proofPack,
		integrity: {
			...proofPack.integrity,
			payloadSha256: payloadDigest,
		},
	};
	const proofPackContent = JSON.stringify(proofPackWithDigest, null, 2);
	const proofPackSignature = signContent(
		proofPackContent,
		TEST_SNAPSHOT_SIGNING_KEY,
	);
	writeFileSync(join(targetDir, PARITY_PROOF_PACK_PATH), proofPackContent);
	writeFileSync(
		join(targetDir, PARITY_PROOF_PACK_SIGNATURE_PATH),
		`${proofPackSignature}\n`,
	);
	const provenanceBundle = {
		schemaVersion: "ci-parity-proof-provenance-bundle/v1",
		generatedAt: proofPack.generatedAt,
		repo: {
			baseSha: history.baseSha,
			headSha: history.headSha,
			fullName: TEST_REPO_FULL_NAME,
			originUrl: TEST_REPO_ORIGIN_URL,
		},
		behavioralParity: proofPack.behavioralParity,
		promotionGate,
		downstream: {
			repositories: downstreamRepositories,
		},
		artifacts: artifacts.map((artifact) => {
			const sourceProvider = "circleci" as const;
			const sourceRunId = `run-${artifact.artifactId}`;
			const sourceCommitSha = history.headSha;
			const capturedAt = proofPack.generatedAt;
			return {
				artifactId: artifact.artifactId,
				path: artifact.path,
				sha256: artifact.sha256,
				signature: signContent(
					`${artifact.path}:${artifact.sha256}:${sourceProvider}:${sourceRunId}:${sourceCommitSha}:${capturedAt}`,
					TEST_SNAPSHOT_SIGNING_KEY,
				),
				sourceProvider,
				sourceRunId,
				sourceWorkflowRef: "circleci/proof-pack@v1",
				sourceCommitSha,
				capturedAt,
				scenario:
					artifact.artifactId === "parity-summary" ? "merge_queue" : undefined,
			};
		}),
	};
	const provenanceBundleContent = JSON.stringify(provenanceBundle, null, 2);
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_BUNDLE_PATH),
		provenanceBundleContent,
	);
	const manifestBase = {
		schemaVersion: "ci-parity-proof-provenance-manifest/v1",
		generatedAt: proofPack.generatedAt,
		sourceBundlePath: PARITY_PROVENANCE_BUNDLE_PATH,
		sourceBundleSha256: hashContent(provenanceBundleContent),
		artifacts: provenanceBundle.artifacts,
		integrity: {
			signatureAlgorithm: "hmac-sha256",
			signingKeyId,
			payloadSha256: "",
		},
	};
	const manifestDigest = hashContent(
		JSON.stringify({
			...manifestBase,
			integrity: {
				...manifestBase.integrity,
				payloadSha256: "",
			},
		}),
	);
	const manifest = {
		...manifestBase,
		integrity: {
			...manifestBase.integrity,
			payloadSha256: manifestDigest,
		},
	};
	const manifestContent = JSON.stringify(manifest, null, 2);
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_MANIFEST_PATH),
		manifestContent,
	);
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH),
		`${signContent(manifestContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
}

function writeParityProofPackInput(targetDir: string): void {
	const history = ensureProofPackFixtureHistory(targetDir);
	const artifactDir = join(
		targetDir,
		".harness/ci-parity-proof-pack-artifacts",
	);
	mkdirSync(artifactDir, { recursive: true });
	writeFileSync(
		join(artifactDir, "parity-summary.json"),
		JSON.stringify(
			{
				scenarios: REQUIRED_PARITY_SCENARIOS,
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(artifactDir, "downstream-proof.json"),
		JSON.stringify(
			{
				repositories: ["jamie/repo-a", "jamie/repo-b", "jamie/repo-c"],
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(targetDir, PARITY_PROOF_INPUT_PATH),
		JSON.stringify(
			{
				schemaVersion: "ci-parity-proof-input/v1",
				generatedAt: new Date().toISOString(),
				repo: {
					baseSha: history.baseSha,
					headSha: history.headSha,
					fullName: TEST_REPO_FULL_NAME,
					originUrl: TEST_REPO_ORIGIN_URL,
				},
				behavioralParity: {
					scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
						scenario,
						providersCompared: ["github-actions", "circleci"],
						commitCount: 2,
						unexpectedDiffs: [],
					})),
				},
				promotionGate: {
					zeroUnexpectedDiffs: true,
					outcomeParity: true,
					skippedSemanticsParity: true,
					artifactParity: true,
					codeRabbitParity: true,
					releaseParity: true,
				},
				downstream: {
					repositories: [
						{
							repo: "jamie/repo-a",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-b",
							ecosystemProfile: "worker-service",
							mergeQueue: true,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-c",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
					],
				},
			},
			null,
			2,
		),
	);
}

function writeParityProvenanceBundleInput(targetDir: string): void {
	const history = ensureProofPackFixtureHistory(targetDir);
	const sourceArtifactDir = join(
		targetDir,
		".harness/ci-parity-proof-source-artifacts",
	);
	mkdirSync(sourceArtifactDir, { recursive: true });
	const paritySourcePath =
		".harness/ci-parity-proof-source-artifacts/parity-summary.json";
	const downstreamSourcePath =
		".harness/ci-parity-proof-source-artifacts/downstream-proof.json";
	const paritySummaryContent = JSON.stringify(
		{
			scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
				scenario,
				commitCount: 2,
			})),
		},
		null,
		2,
	);
	const downstreamProofContent = JSON.stringify(
		{
			repositories: ["jamie/repo-a", "jamie/repo-b", "jamie/repo-c"],
			profiles: ["node-library", "worker-service"],
		},
		null,
		2,
	);
	writeFileSync(join(targetDir, paritySourcePath), paritySummaryContent);
	writeFileSync(join(targetDir, downstreamSourcePath), downstreamProofContent);
	const parityDigest = hashContent(paritySummaryContent);
	const downstreamDigest = hashContent(downstreamProofContent);
	const now = new Date().toISOString();
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_BUNDLE_PATH),
		JSON.stringify(
			{
				schemaVersion: "ci-parity-proof-provenance-bundle/v1",
				generatedAt: now,
				repo: {
					baseSha: history.baseSha,
					headSha: history.headSha,
					fullName: TEST_REPO_FULL_NAME,
					originUrl: TEST_REPO_ORIGIN_URL,
				},
				behavioralParity: {
					scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
						scenario,
						providersCompared: ["github-actions", "circleci"],
						commitCount: 2,
						unexpectedDiffs: [],
					})),
				},
				promotionGate: {
					zeroUnexpectedDiffs: true,
					outcomeParity: true,
					skippedSemanticsParity: true,
					artifactParity: true,
					codeRabbitParity: true,
					releaseParity: true,
				},
				downstream: {
					repositories: [
						{
							repo: "jamie/repo-a",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-b",
							ecosystemProfile: "worker-service",
							mergeQueue: true,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-c",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
					],
				},
				artifacts: [
					{
						artifactId: "parity-summary",
						path: paritySourcePath,
						sha256: parityDigest,
						signature: signContent(
							`${paritySourcePath}:${parityDigest}:circleci:run-parity-001:${history.headSha}:${now}`,
							TEST_SNAPSHOT_SIGNING_KEY,
						),
						sourceProvider: "circleci",
						sourceRunId: "run-parity-001",
						sourceWorkflowRef: "circleci/parity@v1",
						sourceCommitSha: history.headSha,
						capturedAt: now,
						scenario: "merge_queue",
					},
					{
						artifactId: "downstream-proof",
						path: downstreamSourcePath,
						sha256: downstreamDigest,
						signature: signContent(
							`${downstreamSourcePath}:${downstreamDigest}:circleci:run-downstream-001:${history.headSha}:${now}`,
							TEST_SNAPSHOT_SIGNING_KEY,
						),
						sourceProvider: "circleci",
						sourceRunId: "run-downstream-001",
						sourceWorkflowRef: "circleci/downstream@v1",
						sourceCommitSha: history.headSha,
						capturedAt: now,
					},
				],
			},
			null,
			2,
		),
	);
}

function writeParityProvenanceInput(
	targetDir: string,
	options?: { includeMissingArtifact?: boolean | undefined },
): void {
	const history = ensureProofPackFixtureHistory(targetDir);
	const sourceArtifactDir = join(
		targetDir,
		".harness/ci-parity-proof-source-artifacts",
	);
	mkdirSync(sourceArtifactDir, { recursive: true });
	const paritySourcePath =
		".harness/ci-parity-proof-source-artifacts/parity-summary.json";
	const downstreamSourcePath =
		".harness/ci-parity-proof-source-artifacts/downstream-proof.json";
	const paritySummaryContent = JSON.stringify(
		{
			scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
				scenario,
				commitCount: 2,
			})),
		},
		null,
		2,
	);
	const downstreamProofContent = JSON.stringify(
		{
			repositories: ["jamie/repo-a", "jamie/repo-b", "jamie/repo-c"],
			profiles: ["node-library", "worker-service"],
		},
		null,
		2,
	);
	writeFileSync(join(targetDir, paritySourcePath), paritySummaryContent);
	writeFileSync(join(targetDir, downstreamSourcePath), downstreamProofContent);
	const now = new Date().toISOString();
	const artifacts: Array<Record<string, unknown>> = [
		{
			artifactId: "parity-summary",
			path: paritySourcePath,
			sourceProvider: "circleci",
			sourceRunId: "run-parity-001",
			sourceWorkflowRef: "circleci/parity@v1",
			sourceCommitSha: history.headSha,
			capturedAt: now,
			scenario: "merge_queue",
		},
		{
			artifactId: "downstream-proof",
			path: downstreamSourcePath,
			sourceProvider: "circleci",
			sourceRunId: "run-downstream-001",
			sourceWorkflowRef: "circleci/downstream@v1",
			sourceCommitSha: history.headSha,
			capturedAt: now,
		},
	];
	if (options?.includeMissingArtifact === true) {
		artifacts.push({
			artifactId: "missing-artifact",
			path: ".harness/ci-parity-proof-source-artifacts/missing.json",
			sourceProvider: "circleci",
			sourceRunId: "run-missing-001",
			sourceWorkflowRef: "circleci/proof@v1",
			sourceCommitSha: history.headSha,
			capturedAt: now,
		});
	}
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_INPUT_PATH),
		JSON.stringify(
			{
				schemaVersion: "ci-parity-proof-provenance-input/v1",
				generatedAt: now,
				repo: {
					baseSha: history.baseSha,
					headSha: history.headSha,
					fullName: TEST_REPO_FULL_NAME,
					originUrl: TEST_REPO_ORIGIN_URL,
				},
				behavioralParity: {
					scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
						scenario,
						providersCompared: ["github-actions", "circleci"],
						commitCount: 2,
						unexpectedDiffs: [],
					})),
				},
				promotionGate: {
					zeroUnexpectedDiffs: true,
					outcomeParity: true,
					skippedSemanticsParity: true,
					artifactParity: true,
					codeRabbitParity: true,
					releaseParity: true,
				},
				downstream: {
					repositories: [
						{
							repo: "jamie/repo-a",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-b",
							ecosystemProfile: "worker-service",
							mergeQueue: true,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-c",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
					],
				},
				artifacts,
			},
			null,
			2,
		),
	);
}

function canonicalizeParityProvenanceArtifactIndexForDigest(
	index: Record<string, unknown>,
): string {
	const integrity = index.integrity as Record<string, unknown>;
	const artifacts = (index.artifacts as Array<Record<string, unknown>>) ?? [];
	return JSON.stringify({
		schemaVersion: index.schemaVersion,
		generatedAt: index.generatedAt,
		repo: index.repo,
		behavioralParity: index.behavioralParity,
		promotionGate: index.promotionGate,
		downstream: index.downstream,
		artifacts: artifacts.map((artifact) => ({
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
			signatureAlgorithm: integrity.signatureAlgorithm,
			signingKeyId: integrity.signingKeyId,
			payloadSha256: "",
		},
	});
}

function writeParityProvenanceArtifactIndex(
	targetDir: string,
	options?: {
		tamperSignature?: boolean | undefined;
		tamperArtifactDigest?: boolean | undefined;
		tamperArtifactSignature?: boolean | undefined;
	},
): void {
	const history = ensureProofPackFixtureHistory(targetDir);
	const sourceArtifactDir = join(
		targetDir,
		".harness/ci-parity-proof-source-artifacts",
	);
	mkdirSync(sourceArtifactDir, { recursive: true });
	const paritySourcePath =
		".harness/ci-parity-proof-source-artifacts/parity-summary.json";
	const downstreamSourcePath =
		".harness/ci-parity-proof-source-artifacts/downstream-proof.json";
	writeFileSync(
		join(targetDir, paritySourcePath),
		JSON.stringify(
			{
				scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
					scenario,
					commitCount: 2,
				})),
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(targetDir, downstreamSourcePath),
		JSON.stringify(
			{
				repositories: ["jamie/repo-a", "jamie/repo-b", "jamie/repo-c"],
				profiles: ["node-library", "worker-service"],
			},
			null,
			2,
		),
	);
	const now = new Date().toISOString();
	const signingKeyId = hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY);
	const paritySha256 = hashContent(
		readFileSync(join(targetDir, paritySourcePath), "utf-8"),
	);
	const downstreamSha256 = hashContent(
		readFileSync(join(targetDir, downstreamSourcePath), "utf-8"),
	);
	const parityArtifactSignature = signContent(
		`${paritySourcePath}:${paritySha256}:circleci:run-parity-001:${history.headSha}:${now}`,
		TEST_SNAPSHOT_SIGNING_KEY,
	);
	const downstreamArtifactSignature = signContent(
		`${downstreamSourcePath}:${downstreamSha256}:circleci:run-downstream-001:${history.headSha}:${now}`,
		TEST_SNAPSHOT_SIGNING_KEY,
	);
	const indexBase = {
		schemaVersion: "ci-parity-proof-artifact-index/v2",
		generatedAt: now,
		repo: {
			baseSha: history.baseSha,
			headSha: history.headSha,
			fullName: TEST_REPO_FULL_NAME,
			originUrl: TEST_REPO_ORIGIN_URL,
		},
		behavioralParity: {
			scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
				scenario,
				providersCompared: ["github-actions", "circleci"],
				commitCount: 2,
				unexpectedDiffs: [],
			})),
		},
		promotionGate: {
			zeroUnexpectedDiffs: true,
			outcomeParity: true,
			skippedSemanticsParity: true,
			artifactParity: true,
			codeRabbitParity: true,
			releaseParity: true,
		},
		downstream: {
			repositories: [
				{
					repo: "jamie/repo-a",
					ecosystemProfile: "node-library",
					mergeQueue: false,
					parityMatrixVerified: true,
					rollbackRehearsed: true,
				},
				{
					repo: "jamie/repo-b",
					ecosystemProfile: "worker-service",
					mergeQueue: true,
					parityMatrixVerified: true,
					rollbackRehearsed: true,
				},
				{
					repo: "jamie/repo-c",
					ecosystemProfile: "node-library",
					mergeQueue: false,
					parityMatrixVerified: true,
					rollbackRehearsed: true,
				},
			],
		},
		artifacts: [
			{
				artifactId: "parity-summary",
				path: paritySourcePath,
				sha256: options?.tamperArtifactDigest ? "ff" : paritySha256,
				signature: options?.tamperArtifactSignature
					? `${parityArtifactSignature}ff`
					: parityArtifactSignature,
				sourceProvider: "circleci",
				sourceRunId: "run-parity-001",
				sourceWorkflowRef: "circleci/parity@v1",
				sourceCommitSha: history.headSha,
				capturedAt: now,
				scenario: "merge_queue",
			},
			{
				artifactId: "downstream-proof",
				path: downstreamSourcePath,
				sha256: downstreamSha256,
				signature: downstreamArtifactSignature,
				sourceProvider: "circleci",
				sourceRunId: "run-downstream-001",
				sourceWorkflowRef: "circleci/downstream@v1",
				sourceCommitSha: history.headSha,
				capturedAt: now,
			},
		],
		integrity: {
			signatureAlgorithm: "hmac-sha256",
			signingKeyId,
			payloadSha256: "",
		},
	} as const;
	const payloadSha256 = hashContent(
		canonicalizeParityProvenanceArtifactIndexForDigest(indexBase),
	);
	const artifactIndex = {
		...indexBase,
		integrity: {
			...indexBase.integrity,
			payloadSha256,
		},
	};
	const content = JSON.stringify(artifactIndex, null, 2);
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH),
		content,
	);
	const signature = signContent(content, TEST_SNAPSHOT_SIGNING_KEY);
	writeFileSync(
		join(targetDir, PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH),
		`${options?.tamperSignature ? `${signature}ff` : signature}\n`,
	);
}

function writeSignedMergeQueueEvidence(
	targetDir: string,
	snapshotId: string,
	options?: {
		includeLifecycle?: boolean | undefined;
		bindingOverride?:
			| Partial<{
					repoFullName: string;
					headSha: string;
					trustedPolicyRef: string;
					authorityConfigSha256: string;
					requiredCheckManifestSha256: string;
			  }>
			| undefined;
	},
): void {
	const now = new Date();
	const pausedAt = now.toISOString();
	const drainedAt = new Date(now.getTime() + 60_000).toISOString();
	const revalidatedAt = new Date(now.getTime() + 120_000).toISOString();
	const signingKeyId = hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY);
	const binding = {
		...buildMergeQueueEvidenceBinding(targetDir),
		...options?.bindingOverride,
	};
	const evidenceBase = {
		schemaVersion: "ci-migrate-merge-queue-evidence/v2",
		snapshotId,
		generatedAt: pausedAt,
		binding,
		pausedAt,
		drainedAt: options?.includeLifecycle === false ? undefined : drainedAt,
		revalidatedAt:
			options?.includeLifecycle === false ? undefined : revalidatedAt,
		pausedQueueDepth: 2,
		drainedCandidateCount: options?.includeLifecycle === false ? undefined : 2,
		revalidatedCandidateCount:
			options?.includeLifecycle === false ? undefined : 2,
		integrity: {
			signatureAlgorithm: "hmac-sha256",
			signingKeyId,
			payloadSha256: "",
		},
	};
	const payloadSha256 = hashContent(
		JSON.stringify({
			...evidenceBase,
			integrity: {
				...evidenceBase.integrity,
				payloadSha256: "",
			},
		}),
	);
	const evidence = {
		...evidenceBase,
		integrity: {
			...evidenceBase.integrity,
			payloadSha256,
		},
	};
	const content = JSON.stringify(evidence, null, 2);
	mkdirSync(dirname(join(targetDir, MERGE_QUEUE_EVIDENCE_PATH)), {
		recursive: true,
	});
	writeFileSync(join(targetDir, MERGE_QUEUE_EVIDENCE_PATH), content);
	writeFileSync(
		join(targetDir, `${MERGE_QUEUE_EVIDENCE_PATH}.sig`),
		`${signContent(content, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
}

function writeMergeQueueOrchestratorFixture(
	targetDir: string,
	options?: { shouldFail?: boolean | undefined },
): void {
	const orchestratorPath = join(targetDir, MERGE_QUEUE_ORCHESTRATOR_PATH);
	mkdirSync(dirname(orchestratorPath), { recursive: true });
	writeFileSync(
		orchestratorPath,
		`#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
if (${options?.shouldFail ? "true" : "false"}) {
  console.error("forced merge-queue orchestrator failure");
  process.exit(23);
}
const env = process.env;
const snapshotId = env.HARNESS_CI_MIGRATE_SNAPSHOT_ID ?? "";
const evidencePath = env.HARNESS_CI_MIGRATE_EVIDENCE_PATH ?? "";
const signingKey = env.HARNESS_CI_MIGRATE_SIGNING_KEY ?? "";
if (!snapshotId || !evidencePath || !signingKey) {
  console.error("missing orchestration env vars");
  process.exit(11);
}
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
const pausedAt = "2026-03-14T00:00:00.000Z";
const fullLifecycle = env.HARNESS_CI_MIGRATE_REQUIRE_FULL_LIFECYCLE === "1";
const evidence = {
  schemaVersion: "ci-migrate-merge-queue-evidence/v2",
  snapshotId,
  generatedAt: pausedAt,
  binding: {
    repoFullName: env.HARNESS_CI_MIGRATE_BINDING_REPO_FULL_NAME,
    headSha: env.HARNESS_CI_MIGRATE_BINDING_HEAD_SHA,
    trustedPolicyRef: env.HARNESS_CI_MIGRATE_BINDING_TRUSTED_POLICY_REF,
    authorityConfigSha256: env.HARNESS_CI_MIGRATE_BINDING_AUTHORITY_CONFIG_SHA256,
    requiredCheckManifestSha256: env.HARNESS_CI_MIGRATE_BINDING_REQUIRED_CHECK_MANIFEST_SHA256,
  },
  pausedAt,
  drainedAt: fullLifecycle ? "2026-03-14T00:01:00.000Z" : undefined,
  revalidatedAt: fullLifecycle ? "2026-03-14T00:02:00.000Z" : undefined,
  pausedQueueDepth: 2,
  drainedCandidateCount: fullLifecycle ? 2 : undefined,
  revalidatedCandidateCount: fullLifecycle ? 2 : undefined,
  integrity: {
    signatureAlgorithm: "hmac-sha256",
    signingKeyId: crypto
      .createHash("sha256")
      .update(signingKey, "utf8")
      .digest("hex")
      .slice(0, 16),
    payloadSha256: "",
  },
};
const canonical = JSON.stringify({
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
evidence.integrity.payloadSha256 = crypto
  .createHash("sha256")
  .update(canonical, "utf8")
  .digest("hex");
const content = JSON.stringify(evidence, null, 2);
fs.writeFileSync(evidencePath, content);
const signature = crypto
  .createHmac("sha256", signingKey)
  .update(content, "utf8")
  .digest("hex");
fs.writeFileSync(\`\${evidencePath}.sig\`, \`\${signature}\\n\`);
`,
	);
	chmodSync(orchestratorPath, 0o755);
}

function mutateParityProofPack(
	targetDir: string,
	mutate: (proofPack: Record<string, unknown>) => void,
): void {
	const proofPackPath = join(targetDir, ".harness/ci-parity-proof-pack.json");
	const current = JSON.parse(readFileSync(proofPackPath, "utf-8")) as Record<
		string,
		unknown
	>;
	mutate(current);
	const integrity = current.integrity as Record<string, unknown>;
	integrity.payloadSha256 = hashContent(
		canonicalizeParityProofPackForDigest(current),
	);
	const updatedContent = JSON.stringify(current, null, 2);
	writeFileSync(proofPackPath, updatedContent);
	writeFileSync(
		join(targetDir, ".harness/ci-parity-proof-pack.sig"),
		`${signContent(updatedContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
}

function writeMigrationState(
	targetDir: string,
	snapshotId: string,
	stage: "prepared" | "committed" | "aborted" | "rollback-failed",
	provider: "github-actions" | "circleci" = "circleci",
	sourceProvider: "github-actions" | "circleci" = "github-actions",
): void {
	const stateDir = join(targetDir, ".harness/ci-migrate-snapshots");
	mkdirSync(stateDir, { recursive: true });
	const state = {
		schemaVersion: "ci-migrate-state/v1",
		snapshotId,
		stage,
		sourceProvider,
		targetProvider: provider,
		reportDigest: "digest",
		requiredChecksDigest: "checks",
		preCutoverStatus: "satisfied",
		proofPackPayloadSha256: undefined as string | undefined,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	const stateContent = JSON.stringify(state, null, 2);
	const stateDigest = hashContent(stateContent);
	const stateAttestation = {
		schemaVersion: "ci-migrate-state-attestation/v1",
		snapshotId,
		stage,
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		payloadPath: `${snapshotId}.state.json`,
		payloadDigest: stateDigest,
		reportDigest: state.reportDigest,
		requiredChecksDigest: state.requiredChecksDigest,
		proofPackPayloadSha256: state.proofPackPayloadSha256,
		signatureAlgorithm: "hmac-sha256",
		signingKeyId: hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY),
	};
	const stateAttestationContent = JSON.stringify(stateAttestation, null, 2);
	writeFileSync(join(stateDir, `${snapshotId}.state.json`), stateContent);
	writeFileSync(
		join(stateDir, `${snapshotId}.state.sha256`),
		`${stateDigest}\n`,
	);
	writeFileSync(
		join(stateDir, `${snapshotId}.state.sig`),
		`${signContent(stateContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
	writeFileSync(
		join(stateDir, `${snapshotId}.state.attestation.json`),
		stateAttestationContent,
	);
	writeFileSync(
		join(stateDir, `${snapshotId}.state.attestation.sig`),
		`${signContent(stateAttestationContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
}

function writeBreakGlassApproval(
	targetDir: string,
	snapshotId: string,
	options?: {
		allowExpiredSnapshotRestore?: boolean;
		allowRollbackWeakening?: boolean;
		expiresAt?: string;
		approvedBy?: string;
		approvers?: string[];
	},
): string {
	const approvalDir = join(targetDir, ".harness/ci-migrate-approvals");
	mkdirSync(approvalDir, { recursive: true });
	const approvalPath = join(approvalDir, `${snapshotId}.break-glass.json`);
	const now = new Date();
	const approval = {
		schemaVersion: "ci-migrate-break-glass-approval/v1",
		snapshotId,
		approvedBy: options?.approvedBy ?? "migration-admin",
		approvers: options?.approvers ?? ["migration-admin", "security-lead"],
		reason: "approved emergency rollback override",
		approvedAt: now.toISOString(),
		expiresAt:
			options?.expiresAt ??
			new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
		allowExpiredSnapshotRestore: options?.allowExpiredSnapshotRestore ?? false,
		allowRollbackWeakening: options?.allowRollbackWeakening ?? false,
		signatureAlgorithm: "hmac-sha256",
		signingKeyId: hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY),
	};
	const approvalContent = JSON.stringify(approval, null, 2);
	writeFileSync(approvalPath, approvalContent);
	writeFileSync(
		`${approvalPath}.sig`,
		`${signContent(approvalContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
	return approvalPath;
}

function writeBreakGlassGovernancePolicy(
	targetDir: string,
	options?: {
		approverAllowlist?: string[];
		maxApprovalTtlHours?: number;
		requireDualApprovalForRollbackWeakening?: boolean;
	},
): string {
	const policyDir = join(targetDir, ".harness/control-plane");
	mkdirSync(policyDir, { recursive: true });
	const policyPath = join(policyDir, "ci-migrate-break-glass-policy.json");
	const policy = {
		schemaVersion: "ci-migrate-break-glass-policy/v1",
		approverAllowlist: options?.approverAllowlist ?? [
			"migration-admin",
			"security-lead",
		],
		maxApprovalTtlHours: options?.maxApprovalTtlHours ?? 24,
		requireDualApprovalForRollbackWeakening:
			options?.requireDualApprovalForRollbackWeakening ?? true,
		integrity: {
			signatureAlgorithm: "hmac-sha256",
			signingKeyId: hashSigningKeyId(TEST_SNAPSHOT_SIGNING_KEY),
			payloadSha256: "",
		},
	};
	const canonicalPolicy = JSON.stringify({
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
	const payloadSha256 = hashContent(canonicalPolicy);
	const policyContent = JSON.stringify(
		{
			...policy,
			integrity: {
				...policy.integrity,
				payloadSha256,
			},
		},
		null,
		2,
	);
	writeFileSync(policyPath, policyContent);
	writeFileSync(
		`${policyPath}.sig`,
		`${signContent(policyContent, TEST_SNAPSHOT_SIGNING_KEY)}\n`,
	);
	return policyPath;
}

function writeBreakGlassRoster(
	targetDir: string,
	options?: {
		approvers?: string[] | undefined;
		maxApprovalTtlHours?: number | undefined;
		requireDualApprovalForRollbackWeakening?: boolean | undefined;
		cadenceHours?: number | undefined;
		lastRotatedAt?: string | undefined;
	},
): string {
	const rosterPath = join(targetDir, BREAK_GLASS_ROSTER_PATH);
	mkdirSync(dirname(rosterPath), { recursive: true });
	writeFileSync(
		rosterPath,
		JSON.stringify(
			{
				schemaVersion: "ci-migrate-break-glass-roster/v1",
				generatedAt: new Date().toISOString(),
				approvers: options?.approvers ?? ["migration-admin", "security-lead"],
				maxApprovalTtlHours: options?.maxApprovalTtlHours ?? 24,
				requireDualApprovalForRollbackWeakening:
					options?.requireDualApprovalForRollbackWeakening ?? true,
				rotation: {
					cadenceHours: options?.cadenceHours ?? 72,
					lastRotatedAt:
						options?.lastRotatedAt ??
						new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
					runbookUrl: "https://example.com/runbooks/break-glass",
					owner: "security-team",
				},
			},
			null,
			2,
		),
	);
	return rosterPath;
}

function writeMergeQueueProviderAPIFixture(
	targetDir: string,
	options?: { includeLifecycle?: boolean | undefined },
): void {
	const controlPlaneDir = join(targetDir, ".harness/control-plane");
	mkdirSync(controlPlaneDir, { recursive: true });
	const pausedResponsePath = join(
		controlPlaneDir,
		"merge-queue-provider-api.paused.json",
	);
	const drainedResponsePath = join(
		controlPlaneDir,
		"merge-queue-provider-api.drained.json",
	);
	const revalidatedResponsePath = join(
		controlPlaneDir,
		"merge-queue-provider-api.revalidated.json",
	);
	writeFileSync(
		pausedResponsePath,
		JSON.stringify(
			{
				pausedAt: "2026-03-14T00:00:00.000Z",
				queueDepth: 3,
			},
			null,
			2,
		),
	);
	writeFileSync(
		drainedResponsePath,
		JSON.stringify(
			{
				drainedAt: "2026-03-14T00:01:00.000Z",
				candidateCount: 2,
			},
			null,
			2,
		),
	);
	writeFileSync(
		revalidatedResponsePath,
		JSON.stringify(
			{
				revalidatedAt: "2026-03-14T00:02:00.000Z",
				candidateCount: 2,
			},
			null,
			2,
		),
	);
	const includeLifecycle = options?.includeLifecycle !== false;
	const config = {
		schemaVersion: "ci-migrate-merge-queue-provider-api/v1",
		provider: "circleci",
		paused: {
			url: pathToFileURL(pausedResponsePath).toString(),
			timestampPath: "pausedAt",
			queueDepthPath: "queueDepth",
		},
		...(includeLifecycle
			? {
					drained: {
						url: pathToFileURL(drainedResponsePath).toString(),
						timestampPath: "drainedAt",
						candidateCountPath: "candidateCount",
					},
					revalidated: {
						url: pathToFileURL(revalidatedResponsePath).toString(),
						timestampPath: "revalidatedAt",
						candidateCountPath: "candidateCount",
					},
				}
			: {}),
	};
	writeFileSync(
		join(targetDir, MERGE_QUEUE_PROVIDER_API_PATH),
		JSON.stringify(config, null, 2),
	);
}

function writeParityProofHarvestManifest(targetDir: string): void {
	const history = ensureProofPackFixtureHistory(targetDir);
	const controlPlaneDir = join(targetDir, ".harness/control-plane");
	mkdirSync(controlPlaneDir, { recursive: true });
	const generatedAt = new Date().toISOString();
	const parityRawSourcePath = ".harness/control-plane/parity-summary.raw.json";
	const downstreamRawSourcePath =
		".harness/control-plane/downstream-proof.raw.json";
	writeFileSync(
		join(targetDir, parityRawSourcePath),
		JSON.stringify(
			{
				scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
					scenario,
					commitCount: 2,
				})),
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(targetDir, downstreamRawSourcePath),
		JSON.stringify(
			{
				repositories: ["jamie/repo-a", "jamie/repo-b", "jamie/repo-c"],
			},
			null,
			2,
		),
	);
	const scheduleResponsePath = join(
		controlPlaneDir,
		"parity-harvest.schedule.json",
	);
	const discoveryResponsePath = join(
		controlPlaneDir,
		"parity-harvest.discovery.json",
	);
	writeFileSync(
		scheduleResponsePath,
		JSON.stringify({ scheduledAt: generatedAt }, null, 2),
	);
	writeFileSync(
		discoveryResponsePath,
		JSON.stringify(
			{
				artifactUrl: pathToFileURL(
					join(targetDir, parityRawSourcePath),
				).toString(),
				sourceRunId: "run-harvest-parity-001",
				sourceCommitSha: history.headSha,
				capturedAt: generatedAt,
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(targetDir, PARITY_PROOF_HARVEST_MANIFEST_PATH),
		JSON.stringify(
			{
				schemaVersion: "ci-parity-proof-harvest-manifest/v1",
				generatedAt,
				repo: {
					baseSha: history.baseSha,
					headSha: history.headSha,
					fullName: TEST_REPO_FULL_NAME,
					originUrl: TEST_REPO_ORIGIN_URL,
				},
				behavioralParity: {
					scenarios: REQUIRED_PARITY_SCENARIOS.map((scenario) => ({
						scenario,
						providersCompared: ["github-actions", "circleci"],
						commitCount: 2,
						unexpectedDiffs: [],
					})),
				},
				promotionGate: {
					zeroUnexpectedDiffs: true,
					outcomeParity: true,
					skippedSemanticsParity: true,
					artifactParity: true,
					codeRabbitParity: true,
					releaseParity: true,
				},
				downstream: {
					repositories: [
						{
							repo: "jamie/repo-a",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-b",
							ecosystemProfile: "worker-service",
							mergeQueue: true,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
						{
							repo: "jamie/repo-c",
							ecosystemProfile: "node-library",
							mergeQueue: false,
							parityMatrixVerified: true,
							rollbackRehearsed: true,
						},
					],
				},
				artifacts: [
					{
						artifactId: "parity-summary",
						destinationPath:
							".harness/ci-parity-proof-source-artifacts/parity-summary.json",
						sourceProvider: "circleci",
						sourceWorkflowRef: "circleci/parity@v1",
						scenario: "merge_queue",
						source: {
							discovery: {
								url: pathToFileURL(discoveryResponsePath).toString(),
								artifactUrlPath: "artifactUrl",
								sourceRunIdPath: "sourceRunId",
								sourceCommitShaPath: "sourceCommitSha",
								capturedAtPath: "capturedAt",
								schedule: {
									url: pathToFileURL(scheduleResponsePath).toString(),
								},
							},
						},
					},
					{
						artifactId: "downstream-proof",
						destinationPath:
							".harness/ci-parity-proof-source-artifacts/downstream-proof.json",
						sourceProvider: "circleci",
						sourceRunId: "run-harvest-downstream-001",
						sourceWorkflowRef: "circleci/downstream@v1",
						sourceCommitSha: history.headSha,
						capturedAt: generatedAt,
						source: {
							path: downstreamRawSourcePath,
						},
					},
				],
			},
			null,
			2,
		),
	);
}

describe("runCIMigrateCLI", () => {
	let tempDir: string;
	let externalFixtureDir: string;
	let previousSnapshotSigningKey: string | undefined;
	let previousGitHookEnv: Record<string, string | undefined>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;
	let consoleLogSpy: ReturnType<typeof vi.spyOn> | undefined;
	let consoleInfoSpy: ReturnType<typeof vi.spyOn> | undefined;
	// Pre-seeded git template: built once, copied per test to avoid
	// repeated git init+commit (the main cause of the 128s timeout).
	let gitTemplateDir: string;

	beforeAll(() => {
		gitTemplateDir = mkdtempSync(
			join(tmpdir(), "harness-ci-migrate-git-template-"),
		);
		// Bootstrap a two-commit history so ensureProofPackFixtureHistory
		// finds distinct baseSha / headSha without doing any git work.
		const git = (args: string[]) =>
			spawnSync("git", args, {
				cwd: gitTemplateDir,
				encoding: "utf-8",
				env: sanitizeGitEnv(),
			});
		git(["init", "-q"]);
		git(["config", "user.name", "Harness Test"]);
		git(["config", "user.email", "harness@test.local"]);
		mkdirSync(join(gitTemplateDir, ".harness"), { recursive: true });
		writeFileSync(
			join(gitTemplateDir, ".harness/ci-migrate-history-seed.txt"),
			"proof pack fixture seed\n",
		);
		git(["add", "-A"]);
		git(["commit", "-q", "-m", "test fixture initial commit"]);
		writeFileSync(
			join(gitTemplateDir, ".harness/ci-migrate-history-head.txt"),
			`${Date.now()}\n`,
		);
		git(["add", "-A"]);
		git(["commit", "-q", "-m", "test fixture head commit"]);
	});

	afterAll(() => {
		rmSync(gitTemplateDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		previousGitHookEnv = {};
		for (const [key, value] of Object.entries(process.env)) {
			if (key.startsWith("GIT_")) {
				previousGitHookEnv[key] = value;
				Reflect.deleteProperty(process.env, key);
			}
		}
		tempDir = mkdtempSync(join(tmpdir(), "harness-ci-migrate-"));
		externalFixtureDir = mkdtempSync(
			join(tmpdir(), "harness-ci-migrate-external-"),
		);
		// Copy the pre-seeded git history into the fresh tempDir so that
		// any test calling ensureProofPackFixtureHistory skips git init/commit.
		const gitDir = join(gitTemplateDir, ".git");
		const harnessDir = join(gitTemplateDir, ".harness");
		cpSync(gitDir, join(tempDir, ".git"), { recursive: true });
		cpSync(harnessDir, join(tempDir, ".harness"), { recursive: true });
		// Update the working tree to match HEAD so git status is clean.
		spawnSync("git", ["checkout", "."], {
			cwd: tempDir,
			encoding: "utf-8",
			env: sanitizeGitEnv(),
		});
		spawnSync("git", ["config", "user.name", "Harness Test"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: sanitizeGitEnv(),
		});
		spawnSync("git", ["config", "user.email", "harness@test.local"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: sanitizeGitEnv(),
		});
		previousSnapshotSigningKey = process.env[SNAPSHOT_SIGNING_KEY_ENV];
		process.env[SNAPSHOT_SIGNING_KEY_ENV] = TEST_SNAPSHOT_SIGNING_KEY;
		// This suite intentionally exercises many failure modes; suppressing
		// console noise keeps Vitest worker IPC stable in long runs.
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			return undefined;
		});
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
			return undefined;
		});
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
			return undefined;
		});
		consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {
			return undefined;
		});
		vi.clearAllMocks();
		setCIMigrateTestOverrides({
			runInitCLI: runInitCLIMock,
			scanOpenPullRequestSatisfiability: scanOpenPullRequestSatisfiabilityMock,
		});
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		});
	});

	afterEach(() => {
		for (const key of Object.keys(process.env)) {
			if (key.startsWith("GIT_")) {
				Reflect.deleteProperty(process.env, key);
			}
		}
		for (const [key, value] of Object.entries(previousGitHookEnv)) {
			if (value === undefined) {
				Reflect.deleteProperty(process.env, key);
			} else {
				process.env[key] = value;
			}
		}
		consoleErrorSpy?.mockRestore();
		consoleWarnSpy?.mockRestore();
		consoleLogSpy?.mockRestore();
		consoleInfoSpy?.mockRestore();
		consoleErrorSpy = undefined;
		consoleWarnSpy = undefined;
		consoleLogSpy = undefined;
		consoleInfoSpy = undefined;
		if (previousSnapshotSigningKey === undefined) {
			delete process.env[SNAPSHOT_SIGNING_KEY_ENV];
		} else {
			process.env[SNAPSHOT_SIGNING_KEY_ENV] = previousSnapshotSigningKey;
		}
		setCIMigrateTestOverrides();
		rmSync(externalFixtureDir, { recursive: true, force: true });
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("maps apply mode to tracked force init and writes a snapshot", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-1",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: true,
			track: true,
			rollback: false,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "circleci",
		});

		const snapshotContent = readFileSync(
			join(tempDir, ".harness/ci-migrate-snapshots/cutover-1.json"),
			"utf-8",
		);
		expect(JSON.parse(snapshotContent).harnessVersion).toBe("0.0.0");
		expect(
			existsSync(
				join(tempDir, ".harness/ci-migrate-snapshots/cutover-1.report.json"),
			),
		).toBe(true);
		expect(
			existsSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/cutover-1.attestation.json",
				),
			),
		).toBe(true);
		expect(
			existsSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/cutover-1.attestation.sig",
				),
			),
		).toBe(true);
	});

	it("fails closed on apply when another snapshot has an active paused cutover window", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		writeMergeQueueCutoverWindow(tempDir, {
			snapshotId: "cutover-active-paused",
			stage: "paused",
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-new",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when another snapshot has an active drained cutover window", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		writeMergeQueueCutoverWindow(tempDir, {
			snapshotId: "cutover-active-drained",
			stage: "drained",
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-new",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed when existing merge-queue cutover window signature is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		writeMergeQueueCutoverWindow(tempDir, {
			snapshotId: "cutover-active-paused",
			stage: "paused",
		});
		rmSync(join(tempDir, `${MERGE_QUEUE_WINDOW_PATH}.sig`), { force: true });

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-new",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("allows apply when prior cutover window is terminal", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		writeMergeQueueCutoverWindow(tempDir, {
			snapshotId: "cutover-terminal",
			stage: "aborted",
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-new",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledTimes(1);
	});

	it("records signed merge-queue cutover evidence in window metadata when provided", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		ensureProofPackFixtureHistory(tempDir);
		writeSignedMergeQueueEvidence(tempDir, "cutover-with-evidence");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-with-evidence",
			mergeQueueEvidencePath: MERGE_QUEUE_EVIDENCE_PATH,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		const mergeQueueWindow = readMergeQueueCutoverWindow(tempDir);
		expect(mergeQueueWindow.evidence?.sourcePath).toBe(
			MERGE_QUEUE_EVIDENCE_PATH,
		);
		expect(mergeQueueWindow.evidence?.contentSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(mergeQueueWindow.evidence?.pausedQueueDepth).toBe(2);
	});

	it("rejects explicit merge-queue evidence when binding does not match apply identity in shadow mode", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		ensureProofPackFixtureHistory(tempDir);
		writeSignedMergeQueueEvidence(tempDir, "cutover-shadow-binding-mismatch", {
			bindingOverride: {
				headSha: "f".repeat(40),
			},
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-shadow-binding-mismatch",
			mergeQueueEvidencePath: MERGE_QUEUE_EVIDENCE_PATH,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects discovered merge-queue evidence when binding does not match apply identity in shadow mode", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "shadow");
		ensureProofPackFixtureHistory(tempDir);
		writeSignedMergeQueueEvidence(
			tempDir,
			"cutover-shadow-discovered-mismatch",
			{
				bindingOverride: {
					headSha: "f".repeat(40),
				},
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-shadow-discovered-mismatch",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails apply when signed merge-queue evidence is required but lifecycle fields are missing in required mode", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeSignedMergeQueueEvidence(tempDir, "cutover-required-evidence", {
			includeLifecycle: false,
		});
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-required-evidence",
			mergeQueueEvidencePath: MERGE_QUEUE_EVIDENCE_PATH,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("requires signed merge-queue evidence on explicit required-mode commit windows", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const snapshotId = "cutover-required-commit-missing-evidence";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("accepts signed merge-queue evidence on explicit required-mode commit windows", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const snapshotId = "cutover-required-commit-with-evidence";
		writeSignedMergeQueueEvidence(tempDir, snapshotId);
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: true,
			track: true,
			rollback: false,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "circleci",
		});
		const mergeQueueWindow = readMergeQueueCutoverWindow(tempDir);
		expect(mergeQueueWindow.evidence?.sourcePath).toBe(
			MERGE_QUEUE_EVIDENCE_PATH,
		);
	});

	it("runs merge-queue orchestrator on required-mode commit and accepts emitted signed evidence", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeMergeQueueOrchestratorFixture(tempDir);
		const snapshotId = "cutover-required-commit-orchestrated";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueOrchestratorPath: MERGE_QUEUE_ORCHESTRATOR_PATH,
		});

		expect(commitExitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalled();
		expect(existsSync(join(tempDir, MERGE_QUEUE_EVIDENCE_PATH))).toBe(true);
		expect(existsSync(join(tempDir, `${MERGE_QUEUE_EVIDENCE_PATH}.sig`))).toBe(
			true,
		);
	});

	it("fails closed when merge-queue orchestrator exits non-zero", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeMergeQueueOrchestratorFixture(tempDir, { shouldFail: true });
		const snapshotId = "cutover-required-commit-orchestrator-fails";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueOrchestratorPath: MERGE_QUEUE_ORCHESTRATOR_PATH,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects merge-queue orchestrator paths that escape repository root", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const outsideOrchestratorPath = join(
			externalFixtureDir,
			"outside-orchestrator.sh",
		);
		writeFileSync(
			outsideOrchestratorPath,
			"#!/usr/bin/env bash\necho outside\n",
		);
		chmodSync(outsideOrchestratorPath, 0o755);
		const snapshotId = "cutover-required-commit-orchestrator-escape";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueOrchestratorPath: "../outside-orchestrator.sh",
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects merge-queue orchestrator symlinks", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const outsideOrchestratorPath = join(
			externalFixtureDir,
			"outside-orchestrator-symlink.sh",
		);
		writeFileSync(
			outsideOrchestratorPath,
			"#!/usr/bin/env bash\necho outside\n",
		);
		chmodSync(outsideOrchestratorPath, 0o755);

		const orchestratorLinkPath = join(
			tempDir,
			".harness/control-plane/orchestrator-link.sh",
		);
		mkdirSync(dirname(orchestratorLinkPath), { recursive: true });
		symlinkSync(outsideOrchestratorPath, orchestratorLinkPath);
		const snapshotId = "cutover-required-commit-orchestrator-symlink";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueOrchestratorPath: ".harness/control-plane/orchestrator-link.sh",
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("runs merge-queue provider API orchestrator and records signed evidence", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeMergeQueueProviderAPIFixture(tempDir);
		const snapshotId = "cutover-required-commit-provider-api";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueProviderAPIPath: MERGE_QUEUE_PROVIDER_API_PATH,
		});

		expect(commitExitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalled();
		const evidence = JSON.parse(
			readFileSync(join(tempDir, MERGE_QUEUE_EVIDENCE_PATH), "utf-8"),
		) as {
			pausedAt: string;
			drainedAt: string;
			revalidatedAt: string;
			pausedQueueDepth: number;
			drainedCandidateCount: number;
			revalidatedCandidateCount: number;
		};
		expect(evidence.pausedAt).toBe("2026-03-14T00:00:00.000Z");
		expect(evidence.drainedAt).toBe("2026-03-14T00:01:00.000Z");
		expect(evidence.revalidatedAt).toBe("2026-03-14T00:02:00.000Z");
		expect(evidence.pausedQueueDepth).toBe(3);
		expect(evidence.drainedCandidateCount).toBe(2);
		expect(evidence.revalidatedCandidateCount).toBe(2);
		expect(existsSync(join(tempDir, `${MERGE_QUEUE_EVIDENCE_PATH}.sig`))).toBe(
			true,
		);
	});

	it("rejects merge-queue provider API file URLs that escape repository root", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeMergeQueueProviderAPIFixture(tempDir);
		const outsideResponsePath = join(
			externalFixtureDir,
			"merge-queue-provider-api.paused.json",
		);
		writeFileSync(
			outsideResponsePath,
			JSON.stringify(
				{
					pausedAt: "2026-03-14T00:00:00.000Z",
					queueDepth: 3,
				},
				null,
				2,
			),
		);
		const providerConfigPath = join(tempDir, MERGE_QUEUE_PROVIDER_API_PATH);
		const providerConfig = JSON.parse(
			readFileSync(providerConfigPath, "utf-8"),
		) as { paused: { url: string } };
		providerConfig.paused.url = pathToFileURL(outsideResponsePath).toString();
		writeFileSync(providerConfigPath, JSON.stringify(providerConfig, null, 2));
		const snapshotId = "cutover-required-commit-provider-api-escape";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueProviderAPIPath: MERGE_QUEUE_PROVIDER_API_PATH,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails required-mode commit when provider API orchestration omits drained/revalidated lifecycle", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeMergeQueueProviderAPIFixture(tempDir, { includeLifecycle: false });
		const snapshotId = "cutover-required-commit-provider-api-missing-lifecycle";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueProviderAPIPath: MERGE_QUEUE_PROVIDER_API_PATH,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects commit when merge-queue executable and provider API orchestrators are both configured", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		writeMergeQueueOrchestratorFixture(tempDir);
		writeMergeQueueProviderAPIFixture(tempDir);
		const snapshotId = "cutover-required-commit-dual-orchestrators";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			mergeQueueOrchestratorPath: MERGE_QUEUE_ORCHESTRATOR_PATH,
			mergeQueueProviderAPIPath: MERGE_QUEUE_PROVIDER_API_PATH,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	// Security regression: the default orchestrator path must NOT be auto-executed
	// when the operator has not explicitly passed --merge-queue-orchestrator.
	// An attacker who can add .harness/control-plane/merge-queue-cutover-orchestrator
	// to a repo would otherwise get arbitrary code execution when ci-migrate apply
	// is run against that repo in required mode.
	it("does not auto-execute default orchestrator when flag is omitted", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		// Place a fixture orchestrator at the default well-known path — without
		// passing --merge-queue-orchestrator to the CLI.
		writeMergeQueueOrchestratorFixture(tempDir);
		const snapshotId = "cutover-required-commit-no-auto-orchestrate";
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		// Commit WITHOUT --merge-queue-orchestrator: the default path file exists
		// but must not be auto-executed.
		void runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
			// mergeQueueOrchestratorPath intentionally omitted
		});

		// The commit may succeed or fail for unrelated reasons (missing evidence
		// in required mode), but the key invariant is that the orchestrator was
		// NOT executed — proven by the absence of the evidence file it would write.
		expect(existsSync(join(tempDir, MERGE_QUEUE_EVIDENCE_PATH))).toBe(false);
	});

	it("rejects merge-queue evidence when binding does not match required-mode commit identity", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const snapshotId = "cutover-required-commit-binding-mismatch";
		writeSignedMergeQueueEvidence(tempDir, snapshotId, {
			bindingOverride: {
				headSha: "f".repeat(40),
			},
		});
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		scanOpenPullRequestSatisfiabilityMock.mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 2,
			failingPrs: [],
		});

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("restores snapshot before rollback", () => {
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(tempDir, "cutover-1", snapshotContent);
		writeMigrationState(
			tempDir,
			"cutover-1",
			"committed",
			"circleci",
			"github-actions",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-1",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "github-actions",
		});
	});

	it("restores external control-plane snapshot artifacts during rollback", () => {
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		const externalStateContent = JSON.stringify(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId: "cutover-external-state",
				capturedAt: new Date().toISOString(),
				artifacts: [
					{
						relativePath: ".harness/control-plane/github-rulesets.json",
						existed: true,
						content: '{"ruleset":"snapshot"}',
						contentDigest: hashContent('{"ruleset":"snapshot"}'),
					},
					{
						relativePath:
							".harness/control-plane/circleci-project-settings.json",
						existed: false,
					},
				],
			},
			null,
			2,
		);
		writeSignedSnapshot(tempDir, "cutover-external-state", snapshotContent, {
			externalStateContent,
		});
		writeMigrationState(
			tempDir,
			"cutover-external-state",
			"committed",
			"circleci",
			"github-actions",
		);
		mkdirSync(join(tempDir, ".harness/control-plane"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/control-plane/github-rulesets.json"),
			'{"ruleset":"drifted"}',
		);
		writeFileSync(
			join(tempDir, ".harness/control-plane/circleci-project-settings.json"),
			'{"settings":"drifted"}',
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-external-state",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(
			readFileSync(
				join(tempDir, ".harness/control-plane/github-rulesets.json"),
				"utf-8",
			),
		).toBe('{"ruleset":"snapshot"}');
		expect(
			existsSync(
				join(tempDir, ".harness/control-plane/circleci-project-settings.json"),
			),
		).toBe(false);
	});

	it("restores all canonical control-plane artifacts during rollback", () => {
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		const externalStateContent = JSON.stringify(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId: "cutover-external-all",
				capturedAt: new Date().toISOString(),
				artifacts: [
					{
						relativePath: ".harness/control-plane/github-rulesets.json",
						existed: true,
						content: '{"ruleset":"snapshot"}',
						contentDigest: hashContent('{"ruleset":"snapshot"}'),
					},
					{
						relativePath:
							".harness/control-plane/circleci-project-settings.json",
						existed: false,
					},
					{
						relativePath:
							".harness/control-plane/circleci-context-bindings.json",
						existed: true,
						content: '{"contexts":["snapshot"]}',
						contentDigest: hashContent('{"contexts":["snapshot"]}'),
					},
					{
						relativePath: ".harness/control-plane/github-app-installation.json",
						existed: true,
						content: '{"app":"snapshot"}',
						contentDigest: hashContent('{"app":"snapshot"}'),
					},
				],
			},
			null,
			2,
		);
		writeSignedSnapshot(tempDir, "cutover-external-all", snapshotContent, {
			externalStateContent,
		});
		writeMigrationState(
			tempDir,
			"cutover-external-all",
			"committed",
			"circleci",
			"github-actions",
		);
		mkdirSync(join(tempDir, ".harness/control-plane"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/control-plane/github-rulesets.json"),
			'{"ruleset":"drifted"}',
		);
		writeFileSync(
			join(tempDir, ".harness/control-plane/circleci-project-settings.json"),
			'{"settings":"drifted"}',
		);
		writeFileSync(
			join(tempDir, ".harness/control-plane/circleci-context-bindings.json"),
			'{"contexts":["drifted"]}',
		);
		writeFileSync(
			join(tempDir, ".harness/control-plane/github-app-installation.json"),
			'{"app":"drifted"}',
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-external-all",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(
			readFileSync(
				join(tempDir, ".harness/control-plane/github-rulesets.json"),
				"utf-8",
			),
		).toBe('{"ruleset":"snapshot"}');
		expect(
			readFileSync(
				join(tempDir, ".harness/control-plane/circleci-context-bindings.json"),
				"utf-8",
			),
		).toBe('{"contexts":["snapshot"]}');
		expect(
			readFileSync(
				join(tempDir, ".harness/control-plane/github-app-installation.json"),
				"utf-8",
			),
		).toBe('{"app":"snapshot"}');
		expect(
			existsSync(
				join(tempDir, ".harness/control-plane/circleci-project-settings.json"),
			),
		).toBe(false);
	});

	it("uses source provider from migration state during rollback", () => {
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(tempDir, "cutover-provider", snapshotContent);
		writeMigrationState(
			tempDir,
			"cutover-provider",
			"committed",
			"circleci",
			"github-actions",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-provider",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "github-actions",
		});
	});

	it("requires committed migration state for rollback", () => {
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(tempDir, "cutover-prepared", snapshotContent);
		writeMigrationState(tempDir, "cutover-prepared", "prepared");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-prepared",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("syncs signed break-glass governance policy from roster when requested", () => {
		seedMigratableFixture(tempDir);
		writeBreakGlassRoster(tempDir);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: "cutover-break-glass-roster-sync",
			syncBreakGlassPolicy: true,
			breakGlassRosterPath: BREAK_GLASS_ROSTER_PATH,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, BREAK_GLASS_POLICY_PATH))).toBe(true);
		expect(existsSync(join(tempDir, `${BREAK_GLASS_POLICY_PATH}.sig`))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, BREAK_GLASS_OPS_WORKFLOW_PATH))).toBe(true);
		const policy = JSON.parse(
			readFileSync(join(tempDir, BREAK_GLASS_POLICY_PATH), "utf-8"),
		) as {
			approverAllowlist: string[];
			requireDualApprovalForRollbackWeakening: boolean;
		};
		expect(policy.approverAllowlist).toEqual([
			"migration-admin",
			"security-lead",
		]);
		expect(policy.requireDualApprovalForRollbackWeakening).toBe(true);
	});

	it("fails break-glass roster sync when requested roster file is missing", () => {
		seedMigratableFixture(tempDir);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: "cutover-break-glass-roster-sync-missing",
			syncBreakGlassPolicy: true,
			breakGlassRosterPath: BREAK_GLASS_ROSTER_PATH,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(existsSync(join(tempDir, BREAK_GLASS_POLICY_PATH))).toBe(false);
		expect(existsSync(join(tempDir, BREAK_GLASS_OPS_WORKFLOW_PATH))).toBe(
			false,
		);
	});

	it("blocks required-mode rollback weakening without break-glass approval", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(tempDir, "cutover-required-rollback", snapshotContent);
		writeMigrationState(
			tempDir,
			"cutover-required-rollback",
			"committed",
			"circleci",
			"github-actions",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-required-rollback",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("allows required-mode rollback weakening with break-glass approval", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeBreakGlassGovernancePolicy(tempDir);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(
			tempDir,
			"cutover-required-rollback-break-glass",
			snapshotContent,
		);
		writeMigrationState(
			tempDir,
			"cutover-required-rollback-break-glass",
			"committed",
			"circleci",
			"github-actions",
		);
		const approvalPath = writeBreakGlassApproval(
			tempDir,
			"cutover-required-rollback-break-glass",
			{
				allowRollbackWeakening: true,
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-required-rollback-break-glass",
			breakGlassApprovalPath: approvalPath,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "github-actions",
		});
	});

	it("rejects required-mode rollback weakening approval when governance policy is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(
			tempDir,
			"cutover-required-rollback-policy-missing",
			snapshotContent,
		);
		writeMigrationState(
			tempDir,
			"cutover-required-rollback-policy-missing",
			"committed",
			"circleci",
			"github-actions",
		);
		const approvalPath = writeBreakGlassApproval(
			tempDir,
			"cutover-required-rollback-policy-missing",
			{
				allowRollbackWeakening: true,
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-required-rollback-policy-missing",
			breakGlassApprovalPath: approvalPath,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects break-glass approval when approvers are not allowlisted by policy", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeBreakGlassGovernancePolicy(tempDir, {
			approverAllowlist: ["migration-admin", "security-lead"],
		});
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(
			tempDir,
			"cutover-required-rollback-approver-not-allowlisted",
			snapshotContent,
		);
		writeMigrationState(
			tempDir,
			"cutover-required-rollback-approver-not-allowlisted",
			"committed",
			"circleci",
			"github-actions",
		);
		const approvalPath = writeBreakGlassApproval(
			tempDir,
			"cutover-required-rollback-approver-not-allowlisted",
			{
				allowRollbackWeakening: true,
				approvedBy: "rogue-admin",
				approvers: ["rogue-admin", "security-lead"],
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-required-rollback-approver-not-allowlisted",
			breakGlassApprovalPath: approvalPath,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects rollback weakening when governance policy requires dual approval and only one approver is present", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeBreakGlassGovernancePolicy(tempDir, {
			requireDualApprovalForRollbackWeakening: true,
		});
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "circleci",
			files: [],
		});
		writeSignedSnapshot(
			tempDir,
			"cutover-required-rollback-single-approver",
			snapshotContent,
		);
		writeMigrationState(
			tempDir,
			"cutover-required-rollback-single-approver",
			"committed",
			"circleci",
			"github-actions",
		);
		const approvalPath = writeBreakGlassApproval(
			tempDir,
			"cutover-required-rollback-single-approver",
			{
				allowRollbackWeakening: true,
				approvedBy: "migration-admin",
				approvers: ["migration-admin"],
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-required-rollback-single-approver",
			breakGlassApprovalPath: approvalPath,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails fast for conflicting mode flags", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			apply: true,
			rollback: true,
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("refuses rollback from tampered snapshot", () => {
		writeMigrationState(
			tempDir,
			"cutover-tampered",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		writeSignedSnapshot(tempDir, "cutover-tampered", snapshotContent);
		writeFileSync(
			join(tempDir, ".harness/ci-migrate-snapshots/cutover-tampered.sha256"),
			"not-a-real-digest\n",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-tampered",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("refuses rollback from stale snapshot", () => {
		writeMigrationState(
			tempDir,
			"cutover-stale",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		const staleCreatedAt = new Date(
			Date.now() - 32 * 24 * 60 * 60 * 1000,
		).toISOString();
		const staleExpiresAt = new Date(
			Date.now() - 2 * 24 * 60 * 60 * 1000,
		).toISOString();
		writeSignedSnapshot(tempDir, "cutover-stale", snapshotContent, {
			createdAt: staleCreatedAt,
			expiresAt: staleExpiresAt,
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-stale",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("allows rollback from stale snapshot with break-glass approval", () => {
		writeBreakGlassGovernancePolicy(tempDir, {
			requireDualApprovalForRollbackWeakening: false,
		});
		writeMigrationState(
			tempDir,
			"cutover-stale-break-glass",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		const staleCreatedAt = new Date(
			Date.now() - 32 * 24 * 60 * 60 * 1000,
		).toISOString();
		const staleExpiresAt = new Date(
			Date.now() - 2 * 24 * 60 * 60 * 1000,
		).toISOString();
		writeSignedSnapshot(tempDir, "cutover-stale-break-glass", snapshotContent, {
			createdAt: staleCreatedAt,
			expiresAt: staleExpiresAt,
		});
		const approvalPath = writeBreakGlassApproval(
			tempDir,
			"cutover-stale-break-glass",
			{
				allowExpiredSnapshotRestore: true,
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-stale-break-glass",
			breakGlassApprovalPath: approvalPath,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "github-actions",
		});
	});

	it("refuses rollback when snapshot attestation signature is missing", () => {
		writeMigrationState(
			tempDir,
			"cutover-missing-signature",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		writeSignedSnapshot(tempDir, "cutover-missing-signature", snapshotContent);
		rmSync(
			join(
				tempDir,
				".harness/ci-migrate-snapshots/cutover-missing-signature.attestation.sig",
			),
			{ force: true },
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-missing-signature",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("refuses rollback when external control-plane snapshot includes non-allowlisted paths", () => {
		writeMigrationState(
			tempDir,
			"cutover-invalid-external-path",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		const externalStateContent = JSON.stringify(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId: "cutover-invalid-external-path",
				capturedAt: new Date().toISOString(),
				artifacts: [
					{
						relativePath: "../outside.txt",
						existed: true,
						content: "leak",
						contentDigest: hashContent("leak"),
					},
				],
			},
			null,
			2,
		);
		writeSignedSnapshot(
			tempDir,
			"cutover-invalid-external-path",
			snapshotContent,
			{
				externalStateContent,
			},
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-invalid-external-path",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	// Security regression: isSafeRestorePath must reject symlinks even when the
	// symlink sits at an allowlisted path.
	it("refuses rollback when an external control-plane artifact path resolves through a symlink", () => {
		writeMigrationState(
			tempDir,
			"cutover-symlink-external-path",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		const externalStateContent = JSON.stringify(
			{
				schemaVersion: "ci-migrate-external-control-plane-state/v1",
				snapshotId: "cutover-symlink-external-path",
				capturedAt: new Date().toISOString(),
				artifacts: [
					{
						relativePath: ".harness/control-plane/github-rulesets.json",
						existed: true,
						content: "{}",
						contentDigest: hashContent("{}"),
					},
				],
			},
			null,
			2,
		);
		writeSignedSnapshot(
			tempDir,
			"cutover-symlink-external-path",
			snapshotContent,
			{ externalStateContent },
		);

		// Place a symlink at the allowlisted path pointing outside the repo.
		const externalTarget = join(tempDir, "..", "outside-rollback.txt");
		writeFileSync(externalTarget, "do-not-touch");
		mkdirSync(join(tempDir, ".harness/control-plane"), { recursive: true });
		symlinkSync(
			externalTarget,
			join(tempDir, ".harness/control-plane/github-rulesets.json"),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-symlink-external-path",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(readFileSync(externalTarget, "utf-8")).toBe("do-not-touch");
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("refuses rollback when external control-plane snapshot is missing", () => {
		writeMigrationState(
			tempDir,
			"cutover-missing-external-state",
			"committed",
			"circleci",
			"github-actions",
		);
		const snapshotContent = JSON.stringify({
			harnessVersion: "0.0.0",
			ciProvider: "github-actions",
			files: [],
		});
		writeSignedSnapshot(
			tempDir,
			"cutover-missing-external-state",
			snapshotContent,
		);
		rmSync(
			join(
				tempDir,
				".harness/ci-migrate-snapshots/cutover-missing-external-state.external-control-plane.json",
			),
			{ force: true },
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			rollback: true,
			snapshot: "cutover-missing-external-state",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails apply when snapshot signing key env is missing", () => {
		delete process.env[SNAPSHOT_SIGNING_KEY_ENV];
		seedMigratableFixture(tempDir);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-no-signing-key",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails fast for apply + dry-run combination", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			apply: true,
			dryRun: true,
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("requires snapshot for explicit abort action", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "abort",
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("requires prepared state for explicit commit action", () => {
		seedMigratableFixture(tempDir);
		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: "phase-missing-state",
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects explicit commit when provider does not match prepared state", () => {
		seedMigratableFixture(tempDir);
		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: "phase-provider-mismatch",
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "github-actions",
			action: "commit",
			snapshot: "phase-provider-mismatch",
		});
		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("refuses prepare when the snapshot id already has phased artifacts", () => {
		seedMigratableFixture(tempDir);
		mkdirSync(join(tempDir, ".harness/ci-migrate-snapshots"), {
			recursive: true,
		});
		writeFileSync(
			join(tempDir, ".harness/ci-migrate-snapshots/phase-reused.report.json"),
			JSON.stringify({
				schemaVersion: "ci-migrate-report/v1",
				requiredCheckNames: [],
				satisfiability: {
					preCutover: {
						status: "satisfied",
						scannedOpenPrs: 0,
						failingPrs: [],
					},
				},
			}),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: "phase-reused",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("refuses legacy apply when the snapshot id already has phased artifacts", () => {
		seedMigratableFixture(tempDir);
		mkdirSync(join(tempDir, ".harness/ci-migrate-snapshots"), {
			recursive: true,
		});
		writeFileSync(
			join(tempDir, ".harness/ci-migrate-snapshots/legacy-reused.report.json"),
			JSON.stringify({
				schemaVersion: "ci-migrate-report/v1",
				requiredCheckNames: [],
				satisfiability: {
					preCutover: {
						status: "satisfied",
						scannedOpenPrs: 0,
						failingPrs: [],
					},
				},
			}),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "legacy-reused",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("writes prepared state for explicit prepare and commits it on explicit commit", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-success";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		const preparedState = JSON.parse(
			readFileSync(
				join(tempDir, `.harness/ci-migrate-snapshots/${snapshotId}.state.json`),
				"utf-8",
			),
		);
		expect(preparedState.stage).toBe("prepared");
		expect(preparedState.targetProvider).toBe("circleci");

		vi.clearAllMocks();
		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});
		expect(commitExitCode).toBe(EXIT_CODES.SUCCESS);

		const committedState = JSON.parse(
			readFileSync(
				join(tempDir, `.harness/ci-migrate-snapshots/${snapshotId}.state.json`),
				"utf-8",
			),
		);
		expect(committedState.stage).toBe("committed");
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: true,
			track: true,
			rollback: false,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "circleci",
		});
	});

	it("requires the prepared migration report artifact to still exist before commit", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-missing-report";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		rmSync(
			join(tempDir, `.harness/ci-migrate-snapshots/${snapshotId}.report.json`),
		);
		vi.clearAllMocks();

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects commit when the prepared migration report is tampered after prepare", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-tampered-report";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		const reportPath = join(
			tempDir,
			`.harness/ci-migrate-snapshots/${snapshotId}.report.json`,
		);
		const report = JSON.parse(readFileSync(reportPath, "utf-8")) as {
			requiredCheckNames: string[];
		};
		report.requiredCheckNames = [
			...report.requiredCheckNames,
			"unexpected-check",
		];
		writeFileSync(reportPath, JSON.stringify(report, null, 2));
		vi.clearAllMocks();

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("persists proof-pack metadata in prepared migration state", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const snapshotId = "phase-proof-state";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		const report = JSON.parse(
			readFileSync(
				join(
					tempDir,
					`.harness/ci-migrate-snapshots/${snapshotId}.report.json`,
				),
				"utf-8",
			),
		) as {
			promotionEvidence: {
				proofPackPayloadSha256?: string;
				proofPackSignature?: string;
			};
		};
		const state = JSON.parse(
			readFileSync(
				join(tempDir, `.harness/ci-migrate-snapshots/${snapshotId}.state.json`),
				"utf-8",
			),
		) as {
			proofPackPayloadSha256?: string;
			proofPackSignature?: string;
		};

		expect(state.proofPackPayloadSha256).toBe(
			report.promotionEvidence.proofPackPayloadSha256,
		);
		expect(state.proofPackSignature).toBe(
			report.promotionEvidence.proofPackSignature,
		);
	});

	it("writes parity proof pack with 40-char git SHAs from fixture history", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);

		const proofPack = JSON.parse(
			readFileSync(
				join(tempDir, ".harness/ci-parity-proof-pack.json"),
				"utf-8",
			),
		) as {
			repo: {
				baseSha: string;
				headSha: string;
			};
		};

		expect(/^[a-f0-9]{40}$/.test(proofPack.repo.baseSha)).toBe(true);
		expect(/^[a-f0-9]{40}$/.test(proofPack.repo.headSha)).toBe(true);
		expect(proofPack.repo.baseSha).not.toBe(proofPack.repo.headSha);
		expect(
			runTestGitCommand(tempDir, [
				"merge-base",
				"--is-ancestor",
				proofPack.repo.baseSha,
				proofPack.repo.headSha,
			]).ok,
		).toBe(true);
	});

	it("rejects commit when prepared proof-pack metadata is tampered in state", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const snapshotId = "phase-tampered-proof-state";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		const statePath = join(
			tempDir,
			`.harness/ci-migrate-snapshots/${snapshotId}.state.json`,
		);
		const stateDigestPath = join(
			tempDir,
			`.harness/ci-migrate-snapshots/${snapshotId}.state.sha256`,
		);
		const state = JSON.parse(readFileSync(statePath, "utf-8")) as {
			proofPackPayloadSha256?: string;
		};
		state.proofPackPayloadSha256 = "00".repeat(32);
		const updatedStateContent = JSON.stringify(state, null, 2);
		writeFileSync(statePath, updatedStateContent);
		writeFileSync(stateDigestPath, `${hashContent(updatedStateContent)}\n`);

		vi.clearAllMocks();
		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects commit when prepared state attestation signature is missing", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-missing-state-attestation-signature";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		rmSync(
			join(
				tempDir,
				`.harness/ci-migrate-snapshots/${snapshotId}.state.attestation.sig`,
			),
			{ force: true },
		);
		vi.clearAllMocks();

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects commit when prepared state is stale", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-stale-prepared";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		const statePath = join(
			tempDir,
			`.harness/ci-migrate-snapshots/${snapshotId}.state.json`,
		);
		const stateDigestPath = join(
			tempDir,
			`.harness/ci-migrate-snapshots/${snapshotId}.state.sha256`,
		);
		const staleState = JSON.parse(readFileSync(statePath, "utf-8")) as {
			updatedAt: string;
		};
		staleState.updatedAt = new Date(
			Date.now() - 26 * 60 * 60 * 1000,
		).toISOString();
		const staleStateContent = JSON.stringify(staleState, null, 2);
		writeFileSync(statePath, staleStateContent);
		writeFileSync(stateDigestPath, `${hashContent(staleStateContent)}\n`);
		vi.clearAllMocks();

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});

		expect(commitExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects abort when snapshot is not in committed stage", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-abort-prepared";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);
		vi.clearAllMocks();

		const abortExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "abort",
			snapshot: snapshotId,
		});

		expect(abortExitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("marks state aborted for explicit abort action", () => {
		seedMigratableFixture(tempDir);
		const snapshotId = "phase-abort";

		const prepareExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "prepare",
			snapshot: snapshotId,
		});
		expect(prepareExitCode).toBe(EXIT_CODES.SUCCESS);

		const commitExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: snapshotId,
		});
		expect(commitExitCode).toBe(EXIT_CODES.SUCCESS);

		vi.clearAllMocks();
		const abortExitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "abort",
			snapshot: snapshotId,
		});
		expect(abortExitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "github-actions",
		});

		const abortedState = JSON.parse(
			readFileSync(
				join(tempDir, `.harness/ci-migrate-snapshots/${snapshotId}.state.json`),
				"utf-8",
			),
		);
		expect(abortedState.stage).toBe("aborted");
	});

	it("fails closed on apply when source provider config is missing", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-2",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(
			existsSync(
				join(tempDir, ".harness/ci-migrate-snapshots/cutover-2.report.json"),
			),
		).toBe(true);
	});

	it("bootstraps required checks from legacy contract/workflow evidence in dry-run without writing manifest", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			[
				"name: PR Pipeline",
				"",
				"jobs:",
				"  lint:",
				"    name: lint",
				"    runs-on: ubuntu-latest",
				"    steps:",
				"      - run: echo lint",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					branchProtection: {
						requiredChecks: ["lint", "typecheck"],
					},
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			dryRun: true,
			snapshot: "dryrun-import-required-checks",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, ".harness/ci-required-checks.json"))).toBe(
			false,
		);
		const report = JSON.parse(
			readFileSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/dryrun-import-required-checks.report.json",
				),
				"utf-8",
			),
		) as {
			requiredCheckNames: string[];
		};
		expect(report.requiredCheckNames).toEqual(["lint", "typecheck"]);
	});

	it("writes imported required checks manifest on apply when manifest is missing", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			[
				"name: PR Pipeline",
				"",
				"jobs:",
				"  lint:",
				"    name: lint",
				"    runs-on: ubuntu-latest",
				"    steps:",
				"      - run: echo lint",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					branchProtection: {
						requiredChecks: ["lint", "typecheck"],
					},
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "apply-import-required-checks",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, ".harness/ci-required-checks.json"))).toBe(
			true,
		);
		const manifest = JSON.parse(
			readFileSync(join(tempDir, ".harness/ci-required-checks.json"), "utf-8"),
		) as {
			activeProvider: string;
			requiredChecks: Array<{
				displayName: string;
				sourceAppSlug: string;
				sourceAppId: string;
			}>;
		};
		expect(manifest.activeProvider).toBe("github-actions");
		expect(manifest.requiredChecks.map((check) => check.displayName)).toEqual([
			"lint",
			"typecheck",
		]);
		expect(
			manifest.requiredChecks.every(
				(check) => check.sourceAppSlug === "github-actions",
			),
		).toBe(true);
		expect(
			manifest.requiredChecks.every(
				(check) => check.sourceAppId === "github-actions",
			),
		).toBe(true);
	});

	it("maps imported CircleCI checks to workflow-level github check names", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".circleci"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "circleci",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".circleci/config.yml"),
			[
				"version: 2.1",
				"",
				"workflows:",
				"  pr-pipeline:",
				"    jobs:",
				"      - lint",
				"      - typecheck",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					branchProtection: {
						requiredChecks: [
							"lint",
							"typecheck",
							"security-scan",
							"CodeRabbit",
							"semgrep-cloud-platform/scan",
						],
					},
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "apply-import-circleci-github-check-name-map",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		const manifest = JSON.parse(
			readFileSync(join(tempDir, ".harness/ci-required-checks.json"), "utf-8"),
		) as {
			activeProvider: string;
			requiredChecks: Array<{
				displayName: string;
				sourceAppSlug: string;
				sourceAppId: string;
				externalIdPattern: string;
				githubCheckName: string | null;
				class: "required" | "informational";
				enabled?: boolean;
			}>;
		};
		expect(manifest.activeProvider).toBe("circleci");
		expect(manifest.requiredChecks.map((check) => check.displayName)).toEqual([
			"CodeRabbit",
			"lint",
			"security-scan",
			"semgrep-cloud-platform/scan",
			"typecheck",
		]);
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "CodeRabbit",
			)?.sourceAppSlug,
		).toBe("coderabbit");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "CodeRabbit",
			)?.sourceAppId,
		).toBe("coderabbit");
		const circleCiWorkflowChecks = manifest.requiredChecks.filter(
			(check) =>
				check.displayName !== "CodeRabbit" &&
				check.displayName !== "security-scan" &&
				check.displayName !== "semgrep-cloud-platform/scan",
		);
		expect(
			circleCiWorkflowChecks.every(
				(check) => check.sourceAppSlug === "circleci",
			),
		).toBe(true);
		expect(
			circleCiWorkflowChecks.every((check) => check.sourceAppId === "circleci"),
		).toBe(true);
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "security-scan",
			)?.sourceAppSlug,
		).toBe("circleci");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "security-scan",
			)?.sourceAppId,
		).toBe("circleci");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "security-scan",
			)?.githubCheckName,
		).toBe("security-scan");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "security-scan",
			)?.externalIdPattern,
		).toBe("^security-scan$");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "security-scan",
			)?.class,
		).toBe("required");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "security-scan",
			)?.enabled,
		).toBeUndefined();
		expect(
			circleCiWorkflowChecks.every((check) => check.class === "required"),
		).toBe(true);
		expect(
			circleCiWorkflowChecks.every(
				(check) => check.githubCheckName === CIRCLECI_PRIMARY_CHECK,
			),
		).toBe(true);
		expect(
			circleCiWorkflowChecks.every(
				(check) => check.externalIdPattern === `^${CIRCLECI_PRIMARY_CHECK}$`,
			),
		).toBe(true);
		const externalCheck = manifest.requiredChecks.find(
			(check) => check.displayName === "semgrep-cloud-platform/scan",
		);
		expect(externalCheck?.sourceAppSlug).toBe("semgrep-cloud-platform");
		expect(externalCheck?.sourceAppId).toBe("semgrep-cloud-platform");
		expect(externalCheck?.githubCheckName).toBe("semgrep-cloud-platform/scan");
		expect(externalCheck?.class).toBe("required");
		expect(
			manifest.requiredChecks.find(
				(check) => check.displayName === "CodeRabbit",
			)?.githubCheckName,
		).toBe("CodeRabbit");
	});

	it("honors ciProviderPolicy.primaryCheckName for imported CircleCI workflow checks", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".circleci"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "circleci",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".circleci/config.yml"),
			[
				"version: 2.1",
				"",
				"workflows:",
				"  pr-pipeline:",
				"    jobs:",
				"      - lint",
				"      - typecheck",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					ciProviderPolicy: {
						primaryCheckName: "quality-gates",
					},
					branchProtection: {
						requiredChecks: ["lint", "typecheck"],
					},
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "apply-import-circleci-primary-check-name-override",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		const manifest = JSON.parse(
			readFileSync(join(tempDir, ".harness/ci-required-checks.json"), "utf-8"),
		) as {
			requiredChecks: Array<{
				displayName: string;
				githubCheckName: string | null;
				externalIdPattern: string;
			}>;
		};
		const workflowOwnedChecks = manifest.requiredChecks.filter(
			(check) =>
				check.displayName === "lint" || check.displayName === "typecheck",
		);
		expect(workflowOwnedChecks.length).toBe(2);
		expect(
			workflowOwnedChecks.every(
				(check) => check.githubCheckName === "quality-gates",
			),
		).toBe(true);
		expect(
			workflowOwnedChecks.every(
				(check) => check.externalIdPattern === "^quality-gates$",
			),
		).toBe(true);
	});

	it("fails closed on apply when the required-check manifest contains malformed entries", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
						{
							policyId: "required-check-2",
							displayName: "missing-provider-fields",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-malformed-required-checks",
		});

		expect(exitCode).toBe(EXIT_CODES.WRITE_ERROR);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("writes a parity report during dry-run mode", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			dryRun: true,
			snapshot: "dryrun-1",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: true,
			force: false,
			track: false,
			rollback: false,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "circleci",
		});

		const report = JSON.parse(
			readFileSync(
				join(tempDir, ".harness/ci-migrate-snapshots/dryrun-1.report.json"),
				"utf-8",
			),
		);
		expect(report.schemaVersion).toBe("ci-migrate-report/v1");
		expect(report.parity.status).toBe("parity");
	});

	it("emits JSON dry-run report without writing migration artifacts", () => {
		delete process.env[SNAPSHOT_SIGNING_KEY_ENV];
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			dryRun: true,
			json: true,
			snapshot: "dryrun-json-1",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(
			existsSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/dryrun-json-1.report.json",
				),
			),
		).toBe(false);
		expect(
			existsSync(
				join(tempDir, ".harness/ci-migrate-snapshots/dryrun-json-1.state.json"),
			),
		).toBe(false);
		const consoleInfoCalls = consoleInfoSpy.mock.calls as unknown[][];
		const jsonPayloadCalls = consoleInfoCalls.filter((call) => {
			const value = call[0] as unknown;
			if (typeof value !== "string") {
				return false;
			}
			try {
				JSON.parse(value);
				return true;
			} catch {
				return false;
			}
		});
		expect(jsonPayloadCalls).toHaveLength(1);
		const payload = JSON.parse(jsonPayloadCalls[0]?.[0] as string) as {
			status: string;
			plan: Array<{ action: string; target: string; reason: string }>;
			report: { schemaVersion: string; parity: { status: string } };
		};
		expect(payload.status).toBe("dry-run");
		expect(payload.plan).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					target: ".harness/ci-migrate-snapshots/dryrun-json-1.report.json",
				}),
			]),
		);
		expect(payload.report.schemaVersion).toBe("ci-migrate-report/v1");
		expect(payload.report.parity.status).toBe("parity");
	});

	it("fails closed on apply when source provider config is missing", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-2",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(
			existsSync(
				join(tempDir, ".harness/ci-migrate-snapshots/cutover-2.report.json"),
			),
		).toBe(true);
	});

	it("bootstraps required checks from legacy contract/workflow evidence in dry-run without writing manifest", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			[
				"name: PR Pipeline",
				"",
				"jobs:",
				"  lint:",
				"    name: lint",
				"    runs-on: ubuntu-latest",
				"    steps:",
				"      - run: echo lint",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					branchProtection: {
						requiredChecks: ["lint", "typecheck"],
					},
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			dryRun: true,
			snapshot: "dryrun-import-required-checks",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, ".harness/ci-required-checks.json"))).toBe(
			false,
		);
		const report = JSON.parse(
			readFileSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/dryrun-import-required-checks.report.json",
				),
				"utf-8",
			),
		) as {
			requiredCheckNames: string[];
		};
		expect(report.requiredCheckNames).toEqual(["lint", "typecheck"]);
	});

	it("writes imported required checks manifest on apply when manifest is missing", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			[
				"name: PR Pipeline",
				"",
				"jobs:",
				"  lint:",
				"    name: lint",
				"    runs-on: ubuntu-latest",
				"    steps:",
				"      - run: echo lint",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, "harness.contract.json"),
			JSON.stringify(
				{
					branchProtection: {
						requiredChecks: ["lint", "typecheck"],
					},
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "apply-import-required-checks",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, ".harness/ci-required-checks.json"))).toBe(
			true,
		);
		const manifest = JSON.parse(
			readFileSync(join(tempDir, ".harness/ci-required-checks.json"), "utf-8"),
		) as {
			activeProvider: string;
			requiredChecks: Array<{
				displayName: string;
				sourceAppSlug: string;
				sourceAppId: string;
			}>;
		};
		expect(manifest.activeProvider).toBe("github-actions");
		expect(manifest.requiredChecks.map((check) => check.displayName)).toEqual([
			"lint",
			"typecheck",
		]);
		expect(
			manifest.requiredChecks.every(
				(check) => check.sourceAppSlug === "github-actions",
			),
		).toBe(true);
		expect(
			manifest.requiredChecks.every(
				(check) => check.sourceAppId === "github-actions",
			),
		).toBe(true);
	});

	it("fails closed on apply when the required-check manifest contains malformed entries", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
						{
							policyId: "required-check-2",
							displayName: "missing-provider-fields",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-malformed-required-checks",
		});

		expect(exitCode).toBe(EXIT_CODES.WRITE_ERROR);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("writes a parity report during dry-run mode", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			dryRun: true,
			snapshot: "dryrun-1",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: true,
			force: false,
			track: false,
			rollback: false,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "circleci",
		});

		const report = JSON.parse(
			readFileSync(
				join(tempDir, ".harness/ci-migrate-snapshots/dryrun-1.report.json"),
				"utf-8",
			),
		);
		expect(report.schemaVersion).toBe("ci-migrate-report/v1");
		expect(report.parity.status).toBe("parity");
	});

	it("requires snapshot when rollback mode is requested", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			rollback: true,
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("rejects invalid snapshot id values", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "../unsafe",
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required-check ownership is ambiguous", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
						{
							policyId: "required-check-2",
							displayName: "pr-pipeline",
							sourceAppSlug: "circleci",
							sourceAppId: "circleci",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-ambiguous-owner",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("allows external GitHub App checks during apply ownership validation", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
						{
							policyId: "required-check-2",
							displayName: "CodeRabbit",
							sourceAppSlug: "coderabbit",
							sourceAppId: "coderabbit",
							externalIdPattern: "^CodeRabbit$",
							class: "required",
							githubCheckName: "CodeRabbit",
						},
					],
				},
				null,
				2,
			),
		);

		scanOpenPullRequestSatisfiabilityMock.mockReturnValueOnce({
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-external-check-owner",
		});

		expect(exitCode).not.toBe(EXIT_CODES.INVALID_PATH);
	});

	it("fails closed on apply when a required check uses shadow namespace", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-shadow",
							displayName: "shadow/pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^shadow/pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-shadow-required",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when pre-cutover satisfiability is unsatisfied", () => {
		scanOpenPullRequestSatisfiabilityMock.mockReturnValueOnce({
			status: "unsatisfied",
			scannedOpenPrs: 1,
			failingPrs: [
				{
					number: 101,
					missingChecks: ["pr-pipeline"],
				},
			],
		});

		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-precheck-fail",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode is set and parity proof pack is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-missing",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("auto-generates signed parity proof pack evidence when requested", {
		timeout: 120000,
	}, () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPackInput(tempDir);
		writeParityProvenanceBundleInput(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(tempDir, "cutover-auto-generated-proof-pack");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-proof-pack",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(
			existsSync(join(tempDir, ".harness/ci-parity-proof-pack.json")),
		).toBe(true);
		expect(existsSync(join(tempDir, ".harness/ci-parity-proof-pack.sig"))).toBe(
			true,
		);
		const report = JSON.parse(
			readFileSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/cutover-auto-generated-proof-pack.report.json",
				),
				"utf-8",
			),
		) as {
			promotionEvidence: { status: string };
		};
		expect(report.promotionEvidence.status).toBe("verified");
		const mergeQueueWindow = readMergeQueueCutoverWindow(tempDir);
		expect(mergeQueueWindow.stage).toBe("revalidated");
		expect(mergeQueueWindow.preCutover.status).toBe("satisfied");
		expect(mergeQueueWindow.postCutover?.status).toBe("satisfied");
		expect(typeof mergeQueueWindow.pausedAt).toBe("string");
		expect(typeof mergeQueueWindow.drainedAt).toBe("string");
		expect(typeof mergeQueueWindow.revalidatedAt).toBe("string");
	});

	it("fails auto-generation when proof-pack input is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-proof-pack-missing-input",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(
			existsSync(join(tempDir, ".harness/ci-parity-proof-pack.json")),
		).toBe(false);
	});

	it("auto-generates proof-pack inputs from signed provenance bundle when input is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceBundleInput(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(
			tempDir,
			"cutover-auto-generated-from-provenance",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-from-provenance",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, PARITY_PROOF_INPUT_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_SIGNATURE_PATH))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, PARITY_PROVENANCE_MANIFEST_PATH))).toBe(
			true,
		);
		expect(
			existsSync(join(tempDir, PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH)),
		).toBe(true);
		expect(
			existsSync(join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH)),
		).toBe(true);
		expect(
			existsSync(
				join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH),
			),
		).toBe(true);
		const artifactIndexContent = readFileSync(
			join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH),
			"utf-8",
		);
		const artifactIndexSignature = readFileSync(
			join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH),
			"utf-8",
		).trim();
		expect(artifactIndexSignature).toBe(
			signContent(artifactIndexContent, TEST_SNAPSHOT_SIGNING_KEY),
		);
		const parsedArtifactIndex = JSON.parse(artifactIndexContent) as {
			schemaVersion: string;
			integrity: { payloadSha256: string };
		};
		expect(parsedArtifactIndex.schemaVersion).toBe(
			"ci-parity-proof-artifact-index/v2",
		);
		const canonicalDigest = hashContent(
			JSON.stringify({
				...parsedArtifactIndex,
				integrity: {
					...parsedArtifactIndex.integrity,
					payloadSha256: "",
				},
			}),
		);
		expect(parsedArtifactIndex.integrity.payloadSha256).toBe(canonicalDigest);
	});

	it("auto-generates provenance bundle and signed proof-pack from provenance input", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceInput(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(
			tempDir,
			"cutover-auto-generated-from-provenance-input",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-from-provenance-input",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, PARITY_PROVENANCE_BUNDLE_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_INPUT_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_SIGNATURE_PATH))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, PARITY_PROVENANCE_MANIFEST_PATH))).toBe(
			true,
		);
		expect(
			existsSync(join(tempDir, PARITY_PROVENANCE_MANIFEST_SIGNATURE_PATH)),
		).toBe(true);
		expect(
			existsSync(join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH)),
		).toBe(true);
		expect(
			existsSync(
				join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_SIGNATURE_PATH),
			),
		).toBe(true);
	});

	it("auto-generates provenance input, bundle, and proof-pack from signed artifact index", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceArtifactIndex(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(
			tempDir,
			"cutover-auto-generated-from-artifact-index",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-from-artifact-index",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, PARITY_PROVENANCE_INPUT_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROVENANCE_BUNDLE_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_INPUT_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_SIGNATURE_PATH))).toBe(
			true,
		);
	});

	it("auto-generates provenance input and proof-pack from harvest manifest discovery", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofHarvestManifest(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(
			tempDir,
			"cutover-auto-generated-from-harvest",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-from-harvest",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(join(tempDir, PARITY_PROVENANCE_INPUT_PATH))).toBe(true);
		expect(
			existsSync(join(tempDir, PARITY_PROVENANCE_ARTIFACT_INDEX_PATH)),
		).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_INPUT_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(true);
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_SIGNATURE_PATH))).toBe(
			true,
		);
		const parsedInput = JSON.parse(
			readFileSync(join(tempDir, PARITY_PROVENANCE_INPUT_PATH), "utf-8"),
		) as {
			artifacts: Array<{ artifactId: string; sourceRunId: string }>;
		};
		expect(parsedInput.artifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					artifactId: "parity-summary",
					sourceRunId: "run-harvest-parity-001",
				}),
				expect.objectContaining({
					artifactId: "downstream-proof",
					sourceRunId: "run-harvest-downstream-001",
				}),
			]),
		);
		expect(
			existsSync(
				join(
					tempDir,
					".harness/ci-parity-proof-source-artifacts/parity-summary.json",
				),
			),
		).toBe(true);
		expect(
			existsSync(
				join(
					tempDir,
					".harness/ci-parity-proof-source-artifacts/downstream-proof.json",
				),
			),
		).toBe(true);
	});

	it("fails auto-generation from artifact index when signature is invalid", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceArtifactIndex(tempDir, { tamperSignature: true });

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-artifact-index-invalid-signature",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(false);
	});

	it("fails auto-generation from artifact index when artifact digest is invalid", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceArtifactIndex(tempDir, { tamperArtifactDigest: true });

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-artifact-index-invalid-artifact-digest",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(false);
	});

	it("fails auto-generation from artifact index when artifact signature is invalid", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceArtifactIndex(tempDir, {
			tamperArtifactSignature: true,
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot:
				"cutover-auto-generated-artifact-index-invalid-artifact-signature",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(false);
	});

	it("fails auto-generation from provenance input when source artifact is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceInput(tempDir, { includeMissingArtifact: true });

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-provenance-input-missing-artifact",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(false);
	});

	it("fails auto-generation from provenance bundle when artifact signature is invalid", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProvenanceBundleInput(tempDir);
		const bundlePath = join(tempDir, PARITY_PROVENANCE_BUNDLE_PATH);
		const bundle = JSON.parse(readFileSync(bundlePath, "utf-8")) as {
			artifacts: Array<{ signature: string }>;
		};
		const firstArtifact = bundle.artifacts[0];
		if (!firstArtifact) {
			throw new Error("Expected provenance bundle to include artifacts");
		}
		firstArtifact.signature = "f".repeat(64);
		writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			autoGenerateProofPack: true,
			snapshot: "cutover-auto-generated-provenance-signature-invalid",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
		expect(existsSync(join(tempDir, PARITY_PROOF_PACK_PATH))).toBe(false);
	});

	it("fails closed on apply when required mode parity proof pack signature sidecar is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		rmSync(join(tempDir, ".harness/ci-parity-proof-pack.sig"), { force: true });

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-missing-signature",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode parity provenance manifest is missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		rmSync(join(tempDir, PARITY_PROVENANCE_MANIFEST_PATH), { force: true });

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-missing-provenance-manifest",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode parity proof pack timestamp is too far in the future", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir, {
			generatedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-future-generated-at",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode parity proof pack contains duplicate scenarios", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		mutateParityProofPack(tempDir, (proofPack) => {
			const scenarios = (proofPack.behavioralParity as Record<string, unknown>)
				.scenarios as Array<Record<string, unknown>>;
			scenarios.push({ ...scenarios[0] });
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-duplicate-scenarios",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode parity proof pack artifact digest mismatches content", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		const proofPack = JSON.parse(
			readFileSync(
				join(tempDir, ".harness/ci-parity-proof-pack.json"),
				"utf-8",
			),
		) as {
			artifacts: Array<{ path: string }>;
		};
		const firstArtifactPath = proofPack.artifacts[0]?.path;
		expect(firstArtifactPath).toBeTruthy();
		if (!firstArtifactPath) {
			throw new Error(
				"Expected parity proof pack to include at least one artifact",
			);
		}
		writeFileSync(join(tempDir, firstArtifactPath), '{"tampered":true}');

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-artifact-digest-mismatch",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode parity proof pack artifact signature mismatches hash", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		mutateParityProofPack(tempDir, (proofPack) => {
			const artifacts = proofPack.artifacts as Array<Record<string, unknown>>;
			const firstArtifact = artifacts[0];
			if (!firstArtifact) {
				throw new Error("Expected at least one artifact in proof pack");
			}
			firstArtifact.signature = "0".repeat(64);
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-artifact-signature-mismatch",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails closed on apply when required mode parity proof pack evidence is insufficient", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir, {
			overrideUnexpectedDiffs: {
				merge_queue: ["artifact-mismatch"],
			},
			downstreamRepositories: [
				{
					repo: "jamie/repo-a",
					ecosystemProfile: "node-library",
					mergeQueue: false,
					parityMatrixVerified: true,
					rollbackRehearsed: true,
				},
				{
					repo: "jamie/repo-b",
					ecosystemProfile: "node-library",
					mergeQueue: false,
					parityMatrixVerified: true,
					rollbackRehearsed: false,
				},
			],
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-insufficient",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("allows apply when required mode parity proof pack evidence is verified", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(tempDir, "cutover-proof-pack-verified");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-verified",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).toHaveBeenCalledWith(tempDir, {
			dryRun: false,
			force: true,
			track: true,
			rollback: false,
			checkUpdates: false,
			update: false,
			interactive: false,
			migrate: false,
			ciProvider: "circleci",
		});
		const report = JSON.parse(
			readFileSync(
				join(
					tempDir,
					".harness/ci-migrate-snapshots/cutover-proof-pack-verified.report.json",
				),
				"utf-8",
			),
		);
		expect(report.promotionEvidence.required).toBe(true);
		expect(report.promotionEvidence.status).toBe("verified");
	});

	it("fails closed on required mode apply when no open PR parity evidence is available", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		scanOpenPullRequestSatisfiabilityMock.mockReturnValueOnce({
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		});
		writeSignedMergeQueueEvidence(tempDir, "cutover-proof-pack-no-open-prs");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-no-open-prs",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("auto-rolls back when required mode post-cutover satisfiability has zero open PR evidence", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 2,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 0,
				failingPrs: [],
			});
		writeSignedMergeQueueEvidence(tempDir, "cutover-postcheck-no-open-prs");

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-postcheck-no-open-prs",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).toHaveBeenCalledTimes(2);
		expect(runInitCLIMock.mock.calls[0]?.[1]).toMatchObject({
			rollback: false,
			ciProvider: "circleci",
		});
		expect(runInitCLIMock.mock.calls[1]?.[1]).toMatchObject({
			rollback: true,
			ciProvider: "github-actions",
		});
	});

	it("auto-rolls back when post-cutover satisfiability fails", () => {
		scanOpenPullRequestSatisfiabilityMock
			.mockReturnValueOnce({
				status: "satisfied",
				scannedOpenPrs: 1,
				failingPrs: [],
			})
			.mockReturnValueOnce({
				status: "unsatisfied",
				scannedOpenPrs: 1,
				failingPrs: [
					{
						number: 201,
						missingChecks: [],
					},
				],
			});

		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		mkdirSync(join(tempDir, ".github", "workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".harness/restore-manifest.json"),
			JSON.stringify({
				harnessVersion: "0.0.0",
				ciProvider: "github-actions",
				files: [],
			}),
		);
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: test",
		);
		writeFileSync(
			join(tempDir, ".harness/ci-required-checks.json"),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-postcheck-fail",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(runInitCLIMock).toHaveBeenCalledTimes(2);
		expect(runInitCLIMock.mock.calls[0]?.[1]).toMatchObject({
			dryRun: false,
			force: true,
			track: true,
			rollback: false,
			ciProvider: "circleci",
		});
		expect(runInitCLIMock.mock.calls[1]?.[1]).toMatchObject({
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			ciProvider: "github-actions",
		});
		const mergeQueueWindow = readMergeQueueCutoverWindow(tempDir);
		expect(mergeQueueWindow.stage).toBe("aborted");
		expect(mergeQueueWindow.preCutover.status).toBe("satisfied");
		expect(mergeQueueWindow.postCutover?.status).toBe("unsatisfied");
		expect(typeof mergeQueueWindow.pausedAt).toBe("string");
		expect(typeof mergeQueueWindow.drainedAt).toBe("string");
		expect(typeof mergeQueueWindow.abortedAt).toBe("string");
	});

	it("fails strict verify when required-check metadata or transition status are missing", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");

		const exitCode = runCIMigrateCLI(tempDir, {
			action: "verify",
			provider: "circleci",
		});

		expect(exitCode).toBe(CI_MIGRATE_VERIFY_FAILED_EXIT_CODE);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails strict verify when ciProviderPolicy migration metadata is malformed", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required", {
			migrationStage: "legacy-default",
			transitionStatusArtifactPath: " ",
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			action: "verify",
			provider: "circleci",
		});

		expect(exitCode).toBe(CI_MIGRATE_VERIFY_FAILED_EXIT_CODE);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("fails strict verify when required checks use shadow namespace", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeFileSync(
			join(tempDir, TEST_TRANSITION_STATUS_ARTIFACT_PATH),
			JSON.stringify(
				{
					schemaVersion: "ci-provider-transition-status/v1",
					nextGateComplete: true,
					updatedAt: "2026-03-14T00:00:00.000Z",
				},
				null,
				2,
			),
		);
		writeFileSync(
			join(tempDir, TEST_REQUIRED_CHECK_MANIFEST_PATH),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-shadow",
							displayName: "shadow/pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^shadow/pr-pipeline$",
							requiredOnEvents: ["pull_request", "merge_group"],
							freshnessWindowDays: 7,
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			action: "verify",
			provider: "circleci",
		});

		expect(exitCode).toBe(CI_MIGRATE_VERIFY_FAILED_EXIT_CODE);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});

	it("passes strict verify when required-check metadata and transition status are valid", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		// Create a valid CircleCI config so validateCIConfigSyntax (JSC-59) passes.
		mkdirSync(join(tempDir, ".circleci"), { recursive: true });
		writeFileSync(
			join(tempDir, ".circleci/config.yml"),
			[
				"version: 2.1",
				"workflows:",
				"  build:",
				"    jobs:",
				"      - pr-pipeline",
				"jobs:",
				"  pr-pipeline:",
				"    docker:",
				"      - image: cimg/node:20.0",
				"    steps:",
				"      - run: echo ok",
				"",
			].join("\n"),
		);
		writeFileSync(
			join(tempDir, TEST_TRANSITION_STATUS_ARTIFACT_PATH),
			JSON.stringify(
				{
					schemaVersion: "ci-provider-transition-status/v1",
					nextGateComplete: true,
					updatedAt: "2026-03-14T00:00:00.000Z",
				},
				null,
				2,
			),
		);
		writeFileSync(
			join(tempDir, TEST_REQUIRED_CHECK_MANIFEST_PATH),
			JSON.stringify(
				{
					version: 1,
					activeProvider: "github-actions",
					requiredChecks: [
						{
							policyId: "required-check-1",
							displayName: "pr-pipeline",
							sourceAppSlug: "github-actions",
							sourceAppId: "github-actions",
							externalIdPattern: "^pr-pipeline$",
							requiredOnEvents: ["pull_request", "merge_group"],
							freshnessWindowDays: 7,
							class: "required",
						},
					],
				},
				null,
				2,
			),
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			action: "verify",
			provider: "circleci",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(runInitCLIMock).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// bootstrap action — JSC-54
// ---------------------------------------------------------------------------
describe("runCIMigrateCLI bootstrap action", () => {
	let tempDir: string;
	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "ci-migrate-bootstrap-test-"));
	});
	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("creates the draft transition-status artifact when it does not exist", () => {
		const artifactPath = join(
			tempDir,
			".harness/ci-provider-transition-status.json",
		);
		const exitCode = runCIMigrateCLI(tempDir, { action: "bootstrap" });
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(existsSync(artifactPath)).toBe(true);
		const parsed = JSON.parse(readFileSync(artifactPath, "utf-8")) as {
			schemaVersion: string;
			nextGateComplete: boolean;
			updatedAt: string;
		};
		expect(parsed.schemaVersion).toBe("ci-provider-transition-status/v1");
		expect(parsed.nextGateComplete).toBe(false);
		expect(typeof parsed.updatedAt).toBe("string");
		expect(Number.isFinite(Date.parse(parsed.updatedAt))).toBe(true);
	});

	it("skips without overwriting when the artifact already exists and --force is not set", () => {
		const harnessDir = join(tempDir, ".harness");
		mkdirSync(harnessDir, { recursive: true });
		const artifactPath = join(harnessDir, "ci-provider-transition-status.json");
		const original = JSON.stringify({
			schemaVersion: "ci-provider-transition-status/v1",
			nextGateComplete: true,
			updatedAt: "2026-01-01T00:00:00.000Z",
		});
		writeFileSync(artifactPath, original, "utf-8");

		const exitCode = runCIMigrateCLI(tempDir, { action: "bootstrap" });
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		// File must be unchanged
		expect(readFileSync(artifactPath, "utf-8")).toBe(original);
	});

	it("overwrites the existing artifact when --force is set", () => {
		const harnessDir = join(tempDir, ".harness");
		mkdirSync(harnessDir, { recursive: true });
		const artifactPath = join(harnessDir, "ci-provider-transition-status.json");
		writeFileSync(
			artifactPath,
			JSON.stringify({
				schemaVersion: "ci-provider-transition-status/v1",
				nextGateComplete: true,
				updatedAt: "2020-01-01T00:00:00.000Z",
			}),
			"utf-8",
		);

		const exitCode = runCIMigrateCLI(tempDir, {
			action: "bootstrap",
			force: true,
		});
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		const parsed = JSON.parse(readFileSync(artifactPath, "utf-8")) as {
			nextGateComplete: boolean;
		};
		// Should have been reset to false by bootstrap
		expect(parsed.nextGateComplete).toBe(false);
	});
});
