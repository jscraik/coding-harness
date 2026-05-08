import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { CIProvider } from "../init/types.js";
import { sanitizeError } from "../input/sanitize.js";
export const PARITY_PROOF_PACK_PATH = ".harness/ci-parity-proof-pack.json";
export const PARITY_PROOF_PACK_SIGNATURE_PATH =
	".harness/ci-parity-proof-pack.sig";
export const PARITY_PROOF_PACK_SIGNATURE_ALGORITHM = "hmac-sha256";
export const REQUIRED_PARITY_SCENARIOS = [
	"pull_request",
	"main",
	"merge_queue",
	"fork_pr",
	"docs_only_pr",
	"canceled_run",
	"flaky_retry",
	"release_candidate_tag",
] as const;
export const MIN_PARITY_DOWNSTREAM_REPOS = 3;
export const MIN_PARITY_ECOSYSTEM_PROFILES = 2;

/** Required CI parity scenario identifiers that every promotion proof pack must cover. */
export type RequiredParityScenario = (typeof REQUIRED_PARITY_SCENARIOS)[number];

/** Promotion evidence evaluation result returned to the CI migration command. */
export interface PromotionEvidenceReport {
	required: boolean;
	status: "verified" | "missing" | "insufficient" | "not-required";
	proofPackPath: string;
	proofPackPayloadSha256?: string | undefined;
	proofPackSignature?: string | undefined;
	violations: string[];
}

/** Signed CI parity proof pack used to gate CircleCI promotion. */
export interface CIParityProofPack {
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
		codeRabbitParity: boolean;
		releaseParity: boolean;
	};
	downstream: {
		repositories: CIParityDownstreamRepositoryEvidence[];
	};
}

/** Repository binding that proves a proof pack was generated from the current repository lineage. */
export interface CIParityProofPackRepoBinding {
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

/** Proof-pack artifact entry with digest and detached signature evidence. */
export interface CIParityProofPackArtifact {
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

/** Behavioral parity evidence for one required CI scenario. */
export interface CIParityScenarioEvidence {
	scenario: RequiredParityScenario;
	providersCompared: CIProvider[];
	commitCount: number;
	unexpectedDiffs: string[];
}

/** Downstream repository evidence used to prove cross-repo CI migration safety. */
export interface CIParityDownstreamRepositoryEvidence {
	repo: string;
	ecosystemProfile: string;
	mergeQueue: boolean;
	parityMatrixVerified: boolean;
	rollbackRehearsed: boolean;
}

/** Unsigned input shape used to generate a CI parity proof pack. */
export interface CIParityProofPackInput {
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
		codeRabbitParity: boolean;
		releaseParity: boolean;
	};
	downstream: {
		repositories: CIParityDownstreamRepositoryEvidence[];
	};
}

interface CIProviderPolicyConfigLike {
	mode: "shadow" | "required";
	migrationStage: "dual-provider" | "circleci-primary" | "circleci-only";
	transitionStatusArtifactPath: string;
	trustedPolicyRef: string;
	requiredCheckManifestPath: string;
	authorityConfigPath: string;
	primaryCheckName?: string | undefined;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type DigestResult =
	| { ok: true; path: string; digest: string }
	| { ok: false; error: string };

/** Runtime collaborators supplied by the command layer to keep the extraction acyclic. */
export interface PromotionEvidenceDependencies {
	shouldRequirePromotionEvidence(
		targetDir: string,
		targetProvider: CIProvider,
	): boolean;
	readContractProviderPolicy(
		targetDir: string,
	): Result<CIProviderPolicyConfigLike>;
	resolveSnapshotSigningKey():
		| { ok: true; key: string; keyId: string }
		| { ok: false; error: string };
	isHexDigest(value: string): boolean;
	signContent(content: string, key: string): string;
	parseParityProofPack(content: string): Result<CIParityProofPack>;
	resolveGitRefToCommit(
		targetDir: string,
		ref: string,
	): { ok: true; commitSha: string } | { ok: false; error: string };
	validateProofPackFreshness(
		generatedAt: string,
	): { ok: true } | { ok: false; error: string };
	hashContent(content: string): string;
	canonicalizeParityProofPackForDigest(proofPack: CIParityProofPack): string;
	isCommitSha(value: string): boolean;
	isAncestorCommit(
		targetDir: string,
		ancestor: string,
		descendant: string,
	): { ok: true; isAncestor: boolean } | { ok: false; error: string };
	readHashedPolicyFile(targetDir: string, relativePath: string): DigestResult;
	readHashedPolicyFileFromCommit(
		targetDir: string,
		commit: string,
		relativePath: string,
	): DigestResult;
	readGitOriginUrl(targetDir: string): string | null;
	normalizeRepoFullName(originUrl: string): string | null;
	isSafeProofArtifactPath(targetDir: string, relativePath: string): boolean;
	evaluateProvenanceEvidence(
		targetDir: string,
		required: boolean,
		proofPack: CIParityProofPack,
		signingKey: string,
		signingKeyId: string,
	): string[];
}

interface PromotionEvidenceContext {
	required: boolean;
	proofPackPath: string;
	proofPackSignature: string;
	proofPack: CIParityProofPack;
	policy: CIProviderPolicyConfigLike;
	signingKey: string;
	signingKeyId: string;
}

type PromotionEvidencePreparation =
	| { ok: true; context: PromotionEvidenceContext }
	| { ok: false; report: PromotionEvidenceReport };

/**
 * Evaluates whether required CI promotion evidence is present, trusted, and aligned with repository policy.
 *
 * @param targetDir - Repository root used to resolve proof-pack artifacts and policy files.
 * @param targetProvider - Target CI provider whose promotion evidence requirement is being evaluated.
 * @param dependencies - Runtime collaborators supplied by the command module to keep import direction acyclic.
 * @returns Promotion evidence status, proof-pack metadata, and human-readable violations.
 */
export function evaluatePromotionEvidence(
	targetDir: string,
	targetProvider: CIProvider,
	dependencies: PromotionEvidenceDependencies,
): PromotionEvidenceReport {
	const proofPackPath = resolve(targetDir, PARITY_PROOF_PACK_PATH);
	const required = dependencies.shouldRequirePromotionEvidence(
		targetDir,
		targetProvider,
	);
	const prepared = preparePromotionEvidenceContext(
		targetDir,
		required,
		proofPackPath,
		dependencies,
	);
	if (!prepared.ok) {
		return prepared.report;
	}

	const { context } = prepared;
	const violations = [
		...evaluateProofPackIntegrity(context, dependencies),
		...evaluateProofPackPolicyBinding(targetDir, context, dependencies),
		...evaluateProofPackArtifacts(targetDir, context, dependencies),
		...dependencies.evaluateProvenanceEvidence(
			targetDir,
			context.required,
			context.proofPack,
			context.signingKey,
			context.signingKeyId,
		),
		...evaluateProofPackScenarios(context.proofPack),
		...evaluateProofPackPromotionGate(context.proofPack),
		...evaluateProofPackDownstream(context.proofPack),
	];
	return reportPromotionEvidence(
		context.required,
		violations.length > 0 ? "insufficient" : "verified",
		context.proofPackPath,
		violations,
		context.proofPack.integrity.payloadSha256,
		context.proofPackSignature,
	);
}

function preparePromotionEvidenceContext(
	targetDir: string,
	required: boolean,
	proofPackPath: string,
	dependencies: PromotionEvidenceDependencies,
): PromotionEvidencePreparation {
	const signaturePath = resolve(targetDir, PARITY_PROOF_PACK_SIGNATURE_PATH);
	if (!required) {
		return preparedReport(required, "not-required", proofPackPath, []);
	}
	if (!existsSync(proofPackPath)) {
		return preparedReport(required, "missing", proofPackPath, [
			`Missing required parity proof pack: ${PARITY_PROOF_PACK_PATH}`,
		]);
	}
	if (!existsSync(signaturePath)) {
		return preparedReport(required, "insufficient", proofPackPath, [
			`Missing required parity proof pack signature: ${PARITY_PROOF_PACK_SIGNATURE_PATH}`,
		]);
	}

	const policyResult = dependencies.readContractProviderPolicy(targetDir);
	if (!policyResult.ok) {
		return preparedReport(required, "insufficient", proofPackPath, [
			policyResult.error,
		]);
	}
	const signingKeyResult = dependencies.resolveSnapshotSigningKey();
	if (!signingKeyResult.ok) {
		return preparedReport(required, "insufficient", proofPackPath, [
			signingKeyResult.error,
		]);
	}
	return readSignedProofPack(
		required,
		proofPackPath,
		signaturePath,
		policyResult.value,
		signingKeyResult.key,
		signingKeyResult.keyId,
		dependencies,
	);
}

function readSignedProofPack(
	required: boolean,
	proofPackPath: string,
	signaturePath: string,
	policy: CIProviderPolicyConfigLike,
	signingKey: string,
	signingKeyId: string,
	dependencies: PromotionEvidenceDependencies,
): PromotionEvidencePreparation {
	let proofPackContent = "";
	let proofPackSignature = "";
	try {
		proofPackContent = readFileSync(proofPackPath, "utf-8");
		proofPackSignature = readFileSync(signaturePath, "utf-8").trim();
	} catch (error) {
		return preparedReport(required, "insufficient", proofPackPath, [
			`Failed to read parity proof pack trust artifacts: ${sanitizeError(error)}`,
		]);
	}
	if (!dependencies.isHexDigest(proofPackSignature)) {
		return preparedReport(required, "insufficient", proofPackPath, [
			`Parity proof pack signature must be a sha256 hex digest: ${PARITY_PROOF_PACK_SIGNATURE_PATH}`,
		]);
	}
	if (
		dependencies.signContent(proofPackContent, signingKey) !==
		proofPackSignature
	) {
		return preparedReport(
			required,
			"insufficient",
			proofPackPath,
			[
				"Parity proof pack signature mismatch. Refusing unsigned or tampered promotion evidence.",
			],
			undefined,
			proofPackSignature,
		);
	}

	const parsedResult = dependencies.parseParityProofPack(proofPackContent);
	if (!parsedResult.ok) {
		return preparedReport(
			required,
			"insufficient",
			proofPackPath,
			[parsedResult.error],
			undefined,
			proofPackSignature,
		);
	}
	return {
		ok: true,
		context: {
			required,
			proofPackPath,
			proofPackSignature,
			proofPack: parsedResult.value,
			policy,
			signingKey,
			signingKeyId,
		},
	};
}

function preparedReport(
	required: boolean,
	status: PromotionEvidenceReport["status"],
	proofPackPath: string,
	violations: string[],
	proofPackPayloadSha256?: string | undefined,
	proofPackSignature?: string | undefined,
): PromotionEvidencePreparation {
	return {
		ok: false,
		report: reportPromotionEvidence(
			required,
			status,
			proofPackPath,
			violations,
			proofPackPayloadSha256,
			proofPackSignature,
		),
	};
}

function reportPromotionEvidence(
	required: boolean,
	status: PromotionEvidenceReport["status"],
	proofPackPath: string,
	violations: string[],
	proofPackPayloadSha256?: string | undefined,
	proofPackSignature?: string | undefined,
): PromotionEvidenceReport {
	return {
		required,
		status,
		proofPackPath,
		proofPackPayloadSha256,
		proofPackSignature,
		violations,
	};
}

function evaluateProofPackIntegrity(
	context: PromotionEvidenceContext,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	const { proofPack } = context;
	const violations: string[] = [];
	const freshnessResult = dependencies.validateProofPackFreshness(
		proofPack.generatedAt,
	);
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
	const payloadSha256 = dependencies.hashContent(
		dependencies.canonicalizeParityProofPackForDigest(proofPack),
	);
	if (proofPack.integrity.payloadSha256 !== payloadSha256) {
		violations.push(
			"Parity proof pack integrity payloadSha256 does not match signed payload.",
		);
	}
	if (proofPack.integrity.signingKeyId !== context.signingKeyId) {
		violations.push(
			"Parity proof pack integrity signingKeyId does not match active signing key.",
		);
	}
	if (proofPack.repo.trustedPolicyRef !== context.policy.trustedPolicyRef) {
		violations.push(
			`Parity proof pack trustedPolicyRef (${proofPack.repo.trustedPolicyRef}) does not match ciProviderPolicy.trustedPolicyRef (${context.policy.trustedPolicyRef}).`,
		);
	}
	if (
		proofPack.repo.requiredCheckManifestPath !==
		context.policy.requiredCheckManifestPath
	) {
		violations.push(
			`Parity proof pack requiredCheckManifestPath (${proofPack.repo.requiredCheckManifestPath}) does not match ciProviderPolicy.requiredCheckManifestPath (${context.policy.requiredCheckManifestPath}).`,
		);
	}
	return violations;
}

function evaluateProofPackPolicyBinding(
	targetDir: string,
	context: PromotionEvidenceContext,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	const { proofPack } = context;
	const violations: string[] = [];
	const trustedPolicyRefResult = dependencies.resolveGitRefToCommit(
		targetDir,
		context.policy.trustedPolicyRef,
	);
	const trustedPolicyRefCommit = trustedPolicyRefResult.ok
		? trustedPolicyRefResult.commitSha
		: null;
	if (!trustedPolicyRefResult.ok) {
		violations.push(trustedPolicyRefResult.error);
	}
	violations.push(
		...evaluateProofPackCommitLineage(
			targetDir,
			proofPack,
			trustedPolicyRefCommit,
			dependencies,
		),
		...evaluateProofPackPolicyDigests(targetDir, context, dependencies),
		...evaluateProofPackRepositoryOrigin(targetDir, proofPack, dependencies),
	);
	return violations;
}

function evaluateProofPackCommitLineage(
	targetDir: string,
	proofPack: CIParityProofPack,
	trustedPolicyRefCommit: string | null,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	const violations: string[] = [];
	if (
		!dependencies.isCommitSha(proofPack.repo.baseSha) ||
		!dependencies.isCommitSha(proofPack.repo.headSha)
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
		const trustedRefToHeadResult = dependencies.isAncestorCommit(
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
	const baseToHeadResult = dependencies.isAncestorCommit(
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
	return violations;
}

function evaluateProofPackPolicyDigests(
	targetDir: string,
	context: PromotionEvidenceContext,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	const { proofPack } = context;
	const violations: string[] = [];
	const authorityDigestResult = dependencies.readHashedPolicyFile(
		targetDir,
		context.policy.authorityConfigPath,
	);
	const authorityHeadDigestResult = dependencies.readHashedPolicyFileFromCommit(
		targetDir,
		proofPack.repo.headSha,
		context.policy.authorityConfigPath,
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
	const requiredManifestDigestResult = dependencies.readHashedPolicyFile(
		targetDir,
		context.policy.requiredCheckManifestPath,
	);
	const requiredManifestHeadDigestResult =
		dependencies.readHashedPolicyFileFromCommit(
			targetDir,
			proofPack.repo.headSha,
			context.policy.requiredCheckManifestPath,
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
	return violations;
}

function evaluateProofPackRepositoryOrigin(
	targetDir: string,
	proofPack: CIParityProofPack,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	const originUrl = dependencies.readGitOriginUrl(targetDir);
	if (!originUrl) {
		return [
			"Git origin URL is not available; cannot verify parity proof pack repository binding.",
		];
	}
	const violations: string[] = [];
	if (originUrl !== proofPack.repo.originUrl) {
		violations.push(
			`Parity proof pack originUrl (${proofPack.repo.originUrl}) does not match repository origin (${originUrl}).`,
		);
	}
	const normalizedOriginRepo = dependencies.normalizeRepoFullName(originUrl);
	if (!normalizedOriginRepo) {
		violations.push(
			`Repository origin URL is unsupported for repo binding verification: ${originUrl}`,
		);
	} else if (normalizedOriginRepo !== proofPack.repo.fullName) {
		violations.push(
			`Parity proof pack repo.fullName (${proofPack.repo.fullName}) does not match repository origin identity (${normalizedOriginRepo}).`,
		);
	}
	return violations;
}

function evaluateProofPackArtifacts(
	targetDir: string,
	context: PromotionEvidenceContext,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	const violations: string[] = [];
	const artifactIds = new Set<string>();
	const artifactPaths = new Set<string>();
	for (const artifact of context.proofPack.artifacts) {
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
		violations.push(
			...evaluateProofPackArtifact(
				targetDir,
				artifact,
				context.signingKey,
				dependencies,
			),
		);
	}
	return violations;
}

function evaluateProofPackArtifact(
	targetDir: string,
	artifact: CIParityProofPackArtifact,
	signingKey: string,
	dependencies: PromotionEvidenceDependencies,
): string[] {
	if (!dependencies.isSafeProofArtifactPath(targetDir, artifact.path)) {
		return [
			`Parity proof pack artifact path escapes repository root: ${artifact.path}.`,
		];
	}
	const artifactAbsolutePath = resolve(targetDir, artifact.path);
	if (!existsSync(artifactAbsolutePath)) {
		return [`Parity proof artifact missing from repository: ${artifact.path}.`];
	}
	const artifactContent = readFileSync(artifactAbsolutePath, "utf-8");
	const violations: string[] = [];
	if (dependencies.hashContent(artifactContent) !== artifact.sha256) {
		violations.push(
			`Parity proof artifact digest mismatch for ${artifact.path}.`,
		);
	}
	const expectedArtifactSignature = dependencies.signContent(
		`${artifact.path}:${artifact.sha256}`,
		signingKey,
	);
	if (expectedArtifactSignature !== artifact.signature) {
		violations.push(
			`Parity proof artifact signature mismatch for ${artifact.path}.`,
		);
	}
	return violations;
}

function evaluateProofPackScenarios(proofPack: CIParityProofPack): string[] {
	const violations: string[] = [];
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
	return violations;
}

function evaluateProofPackPromotionGate(
	proofPack: CIParityProofPack,
): string[] {
	if (
		proofPack.promotionGate.zeroUnexpectedDiffs !== true ||
		proofPack.promotionGate.outcomeParity !== true ||
		proofPack.promotionGate.skippedSemanticsParity !== true ||
		proofPack.promotionGate.artifactParity !== true ||
		proofPack.promotionGate.codeRabbitParity !== true ||
		proofPack.promotionGate.releaseParity !== true
	) {
		return [
			"Promotion gate booleans must all be true (zeroUnexpectedDiffs, outcomeParity, skippedSemanticsParity, artifactParity, codeRabbitParity, releaseParity).",
		];
	}
	return [];
}

function evaluateProofPackDownstream(proofPack: CIParityProofPack): string[] {
	const violations: string[] = [];
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
	return violations;
}

/** Returns true when a proof-pack artifact path resolves within the repository root. */
export function isPathInsideRepository(
	targetDir: string,
	relativePath: string,
): boolean {
	const rootPath = resolve(targetDir);
	const absolutePath = resolve(targetDir, relativePath);
	return (
		absolutePath === rootPath || absolutePath.startsWith(`${rootPath}${sep}`)
	);
}
