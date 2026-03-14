import { spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scanOpenPullRequestSatisfiability } from "../lib/ci/satisfiability.js";
import { EXIT_CODES } from "../lib/init/types.js";
import { runCIMigrateCLI } from "./ci-migrate.js";
import { runInitCLI } from "./init.js";

vi.mock("./init.js", () => ({
	runInitCLI: vi.fn(() => 0),
}));

vi.mock("../lib/ci/satisfiability.js", () => ({
	scanOpenPullRequestSatisfiability: vi.fn(() => ({
		status: "satisfied",
		scannedOpenPrs: 0,
		failingPrs: [],
	})),
}));

function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

const TEST_SNAPSHOT_SIGNING_KEY =
	"test-signing-key-for-ci-migrate-snapshots-0123456789";
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
const TEST_TRUSTED_POLICY_REF = "refs/heads/main";

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
	ensureCommand(
		["branch", "-f", "main", "HEAD"],
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
			greptileParity: promotionGate.greptileParity,
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
): void {
	writeFileSync(
		join(targetDir, "harness.contract.json"),
		JSON.stringify(
			{
				ciProviderPolicy: {
					activeProvider: "github-actions",
					mode,
					authorityConfigPath: "harness.contract.json",
					requiredCheckManifestPath: TEST_REQUIRED_CHECK_MANIFEST_PATH,
					trustedPolicyRef: TEST_TRUSTED_POLICY_REF,
				},
			},
			null,
			2,
		),
	);
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
					greptileParity: boolean;
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
		greptileParity: true,
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
	writeFileSync(
		join(targetDir, ".harness/ci-parity-proof-pack.json"),
		proofPackContent,
	);
	writeFileSync(
		join(targetDir, ".harness/ci-parity-proof-pack.sig"),
		`${proofPackSignature}\n`,
	);
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
	},
): string {
	const approvalDir = join(targetDir, ".harness/ci-migrate-approvals");
	mkdirSync(approvalDir, { recursive: true });
	const approvalPath = join(approvalDir, `${snapshotId}.break-glass.json`);
	const now = new Date();
	const approval = {
		schemaVersion: "ci-migrate-break-glass-approval/v1",
		snapshotId,
		approvedBy: "migration-admin",
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

describe("runCIMigrateCLI", () => {
	let tempDir: string;
	let previousSnapshotSigningKey: string | undefined;

	beforeEach(() => {
		tempDir = join(tmpdir(), `harness-ci-migrate-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		previousSnapshotSigningKey = process.env[SNAPSHOT_SIGNING_KEY_ENV];
		process.env[SNAPSHOT_SIGNING_KEY_ENV] = TEST_SNAPSHOT_SIGNING_KEY;
		vi.clearAllMocks();
		vi.mocked(scanOpenPullRequestSatisfiability).mockReturnValue({
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		});
	});

	afterEach(() => {
		if (previousSnapshotSigningKey === undefined) {
			delete process.env[SNAPSHOT_SIGNING_KEY_ENV];
		} else {
			process.env[SNAPSHOT_SIGNING_KEY_ENV] = previousSnapshotSigningKey;
		}
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("allows required-mode rollback weakening with break-glass approval", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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

	it("fails fast for conflicting mode flags", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			apply: true,
			rollback: true,
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("allows rollback from stale snapshot with break-glass approval", () => {
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("fails fast for apply + dry-run combination", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			apply: true,
			dryRun: true,
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("requires snapshot for explicit abort action", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "abort",
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("requires prepared state for explicit commit action", () => {
		seedMigratableFixture(tempDir);
		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			action: "commit",
			snapshot: "phase-missing-state",
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
		expect(
			existsSync(
				join(tempDir, ".harness/ci-migrate-snapshots/cutover-2.report.json"),
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("rejects invalid snapshot id values", () => {
		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "../unsafe",
		});
		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("fails closed on apply when pre-cutover satisfiability is unsatisfied", () => {
		vi.mocked(scanOpenPullRequestSatisfiability).mockReturnValueOnce({
			status: "unsatisfied",
			scannedOpenPrs: 1,
			failingPrs: [
				{
					number: 101,
					title: "upgrade migration",
					missingChecks: ["pr-pipeline"],
					nonPassingChecks: [],
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
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
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("allows apply when required mode parity proof pack evidence is verified", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		vi.mocked(scanOpenPullRequestSatisfiability)
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
			snapshot: "cutover-proof-pack-verified",
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledWith(tempDir, {
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
		vi.mocked(scanOpenPullRequestSatisfiability).mockReturnValueOnce({
			status: "satisfied",
			scannedOpenPrs: 0,
			failingPrs: [],
		});

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-proof-pack-no-open-prs",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).not.toHaveBeenCalled();
	});

	it("auto-rolls back when required mode post-cutover satisfiability has zero open PR evidence", () => {
		seedMigratableFixture(tempDir);
		writeCIProviderPolicyContract(tempDir, "required");
		writeParityProofPack(tempDir);
		vi.mocked(scanOpenPullRequestSatisfiability)
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

		const exitCode = runCIMigrateCLI(tempDir, {
			provider: "circleci",
			apply: true,
			snapshot: "cutover-postcheck-no-open-prs",
		});

		expect(exitCode).toBe(EXIT_CODES.INVALID_PATH);
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(runInitCLI).mock.calls[0]?.[1]).toMatchObject({
			rollback: false,
			ciProvider: "circleci",
		});
		expect(vi.mocked(runInitCLI).mock.calls[1]?.[1]).toMatchObject({
			rollback: true,
			ciProvider: "github-actions",
		});
	});

	it("auto-rolls back when post-cutover satisfiability fails", () => {
		vi.mocked(scanOpenPullRequestSatisfiability)
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
						title: "post-cutover regression",
						missingChecks: [],
						nonPassingChecks: [{ name: "pr-pipeline", state: "FAILURE" }],
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
		expect(vi.mocked(runInitCLI)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(runInitCLI).mock.calls[0]?.[1]).toMatchObject({
			dryRun: false,
			force: true,
			track: true,
			rollback: false,
			ciProvider: "circleci",
		});
		expect(vi.mocked(runInitCLI).mock.calls[1]?.[1]).toMatchObject({
			dryRun: false,
			force: false,
			track: false,
			rollback: true,
			ciProvider: "github-actions",
		});
	});
});
