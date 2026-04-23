import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_REVIEW_POLICY,
	type HarnessContract,
	type NorthStarDecisionQuestion,
} from "../lib/contract/types.js";
import { requiresCanonicalNorthStarSurfaces } from "../lib/contract/validator-helpers.js";
import {
	findReviewCheckRun,
	isCheckRunInProgress,
	isCheckRunPassing,
} from "../lib/github/check-run.js";
import type { CheckRun, PullRequestReview } from "../lib/github/client.js";
import { GitHubClient } from "../lib/github/client.js";
import {
	formatRerunComment,
	hasRerunCommentForSha,
} from "../lib/github/comments.js";
import { validateSha } from "../lib/github/sha.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	normaliseReviewGateResult,
	renderGateDecision,
} from "../lib/output/normalise.js";
import { runPlanGate } from "../lib/plan-gate/detector.js";
import {
	type NormalizedRequiredChecksManifest,
	normalizeRequiredChecksManifest,
} from "../lib/policy/required-checks.js";
// Use the lib-layer bridge instead of importing directly from another command.
import { runCheckAuthz } from "../lib/review-gate/authz.js";
import { emitReviewGateDecisionArtifacts } from "../lib/review-gate/decision-packet.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	TIMEOUT: 4,
	REVIEW_NOT_VERIFIED: 5,
	SYSTEM_ERROR: 10,
} as const;

// Re-export canonical types from the lib layer so existing consumers are
// unaffected. The source of truth has moved to src/lib/review-gate/types.ts.
export type {
	ReviewDecisionState,
	ReviewGateErrorCode,
	ReviewGateOptions,
	ReviewGateOutput,
	ReviewGateResult,
	ReviewPRClosureStatus,
} from "../lib/review-gate/types.js";
// Also import them for local use within this file.
import type {
	ReviewGateErrorCode,
	ReviewGateOptions,
	ReviewGateOutput,
	ReviewGateResult,
} from "../lib/review-gate/types.js";

// Local aliases (not re-exported) still needed for internal use

const POLL_INTERVAL_MS = 5000; // 5 seconds
const DEFAULT_REVIEW_GATE_AUTHZ_CONTRACT = "harness.contract.json";
const DEFAULT_REVIEW_CHECK_NAME = "pr-pipeline";
const DEFAULT_REQUIRED_CHECK_MANIFEST_PATH = ".harness/ci-required-checks.json";
const LEGACY_REVIEW_CHECK_NAME_FALLBACKS = [
	"risk-policy-gate",
	"code-review",
] as const;

class RequiredChecksManifestError extends Error {
	readonly manifestPath: string;

	constructor(manifestPath: string, reason: string) {
		super(`Invalid required-check manifest '${manifestPath}': ${reason}`);
		this.name = "RequiredChecksManifestError";
		this.manifestPath = manifestPath;
	}
}

type BaseReviewGateOutput = Omit<
	ReviewGateOutput,
	| "policy_gate_status"
	| "plan_traceability_status"
	| "plan_ids"
	| "blockers"
	| "actionable_count"
	| "informational_count"
	| "confidence_rubric"
>;

interface ReadinessOptions {
	additionalBlockers?: string[];
	checkName?: string;
	planTraceability?: {
		status: ReviewGateOutput["plan_traceability_status"];
		planIds: string[];
	};
}

function getReadinessCheckLabel(checkName?: string): string {
	const normalizedCheckName = checkName?.trim();
	if (!normalizedCheckName) {
		return DEFAULT_REVIEW_CHECK_NAME;
	}
	return normalizedCheckName;
}

function normalizeConstraintSourceToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function resolveReviewCheckResult(
	checkRuns: CheckRun[],
	requestedCheckName: string,
	pullRequestHeadSha: string,
	requiredCheckSources?: Map<string, RequiredCheckSourceConstraint>,
): {
	checkResult: ReturnType<typeof findReviewCheckRun>;
	resolvedCheckName: string;
} {
	const candidates = [requestedCheckName];
	const canonicalFallbackCandidates = new Set<string>([
		DEFAULT_REVIEW_CHECK_NAME,
		...LEGACY_REVIEW_CHECK_NAME_FALLBACKS,
	]);
	if (canonicalFallbackCandidates.has(requestedCheckName)) {
		for (const fallbackCheckName of canonicalFallbackCandidates) {
			if (fallbackCheckName === requestedCheckName) {
				continue;
			}
			if (!candidates.includes(fallbackCheckName)) {
				candidates.push(fallbackCheckName);
			}
		}
	}

	for (const candidateCheckName of candidates) {
		const sourceConstraint = requiredCheckSources?.get(candidateCheckName);
		let checkResult = findReviewCheckRun(checkRuns, candidateCheckName, {
			headSha: pullRequestHeadSha,
			...(sourceConstraint?.providerSlugs
				? { providerSlugs: sourceConstraint.providerSlugs }
				: {}),
			...(sourceConstraint?.sourceAppIds
				? { sourceAppIds: sourceConstraint.sourceAppIds }
				: {}),
		});
		if (!checkResult.found && sourceConstraint) {
			checkResult = findReviewCheckRun(checkRuns, candidateCheckName, {
				headSha: pullRequestHeadSha,
			});
		}
		if (checkResult.found) {
			return {
				checkResult,
				resolvedCheckName: candidateCheckName,
			};
		}
	}

	const fallbackSourceConstraint =
		requiredCheckSources?.get(requestedCheckName);
	let fallbackCheckResult = findReviewCheckRun(checkRuns, requestedCheckName, {
		headSha: pullRequestHeadSha,
		...(fallbackSourceConstraint?.providerSlugs
			? { providerSlugs: fallbackSourceConstraint.providerSlugs }
			: {}),
		...(fallbackSourceConstraint?.sourceAppIds
			? { sourceAppIds: fallbackSourceConstraint.sourceAppIds }
			: {}),
	});
	if (!fallbackCheckResult.found && fallbackSourceConstraint) {
		fallbackCheckResult = findReviewCheckRun(checkRuns, requestedCheckName, {
			headSha: pullRequestHeadSha,
		});
	}

	return {
		checkResult: fallbackCheckResult,
		resolvedCheckName: requestedCheckName,
	};
}

function withReadinessFields(
	base: BaseReviewGateOutput,
	options: ReadinessOptions = {},
): ReviewGateOutput {
	const checkLabel = getReadinessCheckLabel(options.checkName);
	const effectiveCheckName = options.checkName?.trim();
	const policyGateStatus: ReviewGateOutput["policy_gate_status"] =
		base.checkStatus === "not_found"
			? "missing"
			: base.checkStatus === "completed"
				? base.checkConclusion === "success"
					? "pass"
					: "fail"
				: "pending";

	const blockers: string[] = [];
	const planTraceabilityStatus =
		options.planTraceability?.status ?? ("missing" as const);
	const planIds = options.planTraceability?.planIds ?? [];
	if (policyGateStatus === "missing") {
		blockers.push(`${checkLabel} check run not found for current HEAD SHA`);
	}
	if (policyGateStatus === "fail") {
		blockers.push(
			`${checkLabel} check did not pass (conclusion: ${base.checkConclusion ?? "unknown"})`,
		);
	}
	if (policyGateStatus === "pending" && (base.needsRerun || base.timedOut)) {
		blockers.push(
			`${checkLabel} verification is incomplete for current HEAD SHA`,
		);
	}
	if (options.additionalBlockers && options.additionalBlockers.length > 0) {
		blockers.push(...options.additionalBlockers);
	}

	const actionableCount = blockers.length;
	const informationalCount = base.verified ? 3 : 1;

	const confidenceRubric: ReviewGateOutput["confidence_rubric"] =
		actionableCount === 0 &&
		policyGateStatus === "pass" &&
		planTraceabilityStatus === "pass"
			? {
					score: 5,
					level: "high",
					rationale: [
						`${checkLabel} passed for the current HEAD SHA`,
						"PR work maps to validated plan IDs",
						"no merge blockers detected in review gate",
					],
				}
			: policyGateStatus === "pending"
				? {
						score: 2,
						level: "low",
						rationale: [
							`${checkLabel} verification has not reached a terminal pass state`,
							"merge confidence is reduced until blockers are resolved",
						],
					}
				: policyGateStatus === "pass"
					? {
							score: 2,
							level: "low",
							rationale: [
								`${checkLabel} passed but merge-readiness blockers remain`,
								"merge should remain blocked until required checks and review policies are satisfied",
							],
						}
					: {
							score: 1,
							level: "low",
							rationale: [
								`${checkLabel} did not provide a passing result for current HEAD SHA`,
								"merge should remain blocked until policy gate issues are resolved",
							],
						};

	return {
		...base,
		...(effectiveCheckName ? { effectiveCheckName } : {}),
		policy_gate_status: policyGateStatus,
		plan_traceability_status: planTraceabilityStatus,
		plan_ids: planIds,
		blockers,
		actionable_count: actionableCount,
		informational_count: informationalCount,
		confidence_rubric: confidenceRubric,
	};
}

interface ApprovalResult {
	passed: boolean;
	blockers: string[];
	approvers: string[];
	codingActor?: string;
}

interface ReviewerIndependenceResult {
	passed: boolean;
	blockers: string[];
}

interface ThreadReadinessResult {
	passed: boolean;
	blockers: string[];
}

interface PlanTraceabilityResult {
	passed: boolean;
	status: ReviewGateOutput["plan_traceability_status"];
	planIds: string[];
	blockers: string[];
}

interface RequiredCheckSourceConstraint {
	providerSlugs: Set<string>;
	sourceAppIds: Set<string>;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuestionText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\w\s/-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function hasEvidenceReference(text: string): boolean {
	const evidencePatterns = [
		/\[[^\]]+\]\([^)]+\)/i,
		/https?:\/\/\S+/i,
		/(?:^|[\s(\[])(?:\/|\.\.?\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+:[0-9]+(?:$|[\s),.;\]])/i,
		/(?:^|[\s(\[])(?:\/|\.\.?\/)?[A-Za-z._-][A-Za-z0-9._-]*:[0-9]+(?:$|[\s),.;\]])/i,
		/artifacts\/[A-Za-z0-9._/-]+/i,
	];
	return evidencePatterns.some((pattern) => pattern.test(text));
}

function getStructuredListIndent(line: string): number | undefined {
	const match = line.match(/^(\s*)(?:[-*+](?:\s+\[[xX ]\])?|\d+[.)])\s+/);
	if (!match) {
		return undefined;
	}
	return match[1]?.length ?? 0;
}

function extractQuestionResponseBlock(
	rawBody: string,
	question: NorthStarDecisionQuestion,
): string {
	const lines = rawBody.split(/\r?\n/);
	const questionPrompt = normalizeQuestionText(question.prompt);
	const idPattern = new RegExp(`\\b${escapeRegExp(question.id)}\\b`, "i");
	const collected: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const normalizedLine = normalizeQuestionText(line);
		if (!idPattern.test(line) && !normalizedLine.includes(questionPrompt)) {
			continue;
		}
		const startListIndent =
			getStructuredListIndent(line) ?? line.match(/^\s*/)?.[0].length ?? 0;
		collected.push(line);
		for (let next = index + 1; next < lines.length; next += 1) {
			const continuation = lines[next] ?? "";
			const continuationListIndent = getStructuredListIndent(continuation);
			if (continuation.trim().length === 0) {
				collected.push(continuation);
				continue;
			}
			if (
				continuationListIndent !== undefined &&
				continuationListIndent <= startListIndent
			) {
				break;
			}
			collected.push(continuation);
		}
	}

	return collected.join("\n");
}

function hasExplicitNegativeAnswer(responseBlock: string): boolean {
	for (const line of responseBlock.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0) {
			continue;
		}
		const leadingToken = normalizeQuestionText(trimmedLine).split(" ")[0];
		if (leadingToken === "no" || leadingToken === "false") {
			return true;
		}
		const separatorIndex = trimmedLine.indexOf(":");
		const answerCandidate =
			separatorIndex === -1
				? trimmedLine
				: trimmedLine.slice(separatorIndex + 1).trim();
		const answerToken = normalizeQuestionText(answerCandidate).split(" ")[0];
		if (answerToken === "no" || answerToken === "false") {
			return true;
		}
	}
	return false;
}

function hasNoImpactDeclaration(responseBlock: string): boolean {
	const normalizedBlock = normalizeQuestionText(responseBlock);
	if (normalizedBlock.includes("metric_impact_declared none")) {
		return true;
	}
	if (normalizedBlock.includes("metric impact declared none")) {
		return true;
	}
	return normalizedBlock.includes("no direct metric impact");
}

function hasPositivePolicySurfaceDelta(responseBlock: string): boolean {
	const match = responseBlock.match(
		/policy[_\s-]*surface[_\s-]*delta\s*:?\s*([+-]?\d+(?:\.\d+)?)/i,
	);
	if (!match) {
		return false;
	}
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0;
}

function evaluateNorthStarDecisionQuestions(params: {
	prBody?: string | null | undefined;
	decisionQuestions: NorthStarDecisionQuestion[];
	requireQuestions?: boolean;
}): string[] {
	if (params.decisionQuestions.length === 0) {
		return params.requireQuestions
			? [
					"contract_invalid: Canonical north-star contracts must declare at least one decision question.",
				]
			: [];
	}

	const rawBody = params.prBody ?? "";
	const normalizedBody = normalizeQuestionText(rawBody);
	const missingQuestionIds: string[] = [];
	const questionIdsMissingEvidence: string[] = [];
	const questionIdsWithNegativeAnswer: string[] = [];
	for (const question of params.decisionQuestions) {
		const idPattern = new RegExp(`\\b${escapeRegExp(question.id)}\\b`, "i");
		const hasIdReference = idPattern.test(rawBody);
		const hasPromptReference = normalizedBody.includes(
			normalizeQuestionText(question.prompt),
		);
		if (!hasIdReference && !hasPromptReference) {
			missingQuestionIds.push(question.id);
			continue;
		}
		const responseBlock = extractQuestionResponseBlock(rawBody, question);
		if (!hasEvidenceReference(responseBlock)) {
			questionIdsMissingEvidence.push(question.id);
		}
		if (
			hasExplicitNegativeAnswer(responseBlock) &&
			!(
				hasNoImpactDeclaration(responseBlock) &&
				!hasPositivePolicySurfaceDelta(responseBlock)
			)
		) {
			questionIdsWithNegativeAnswer.push(question.id);
		}
	}

	const blockers: string[] = [];
	if (missingQuestionIds.length > 0) {
		blockers.push(
			`review_evidence_contradiction: North-star decision questions missing from PR context: ${missingQuestionIds.join(", ")}`,
		);
	}
	if (questionIdsMissingEvidence.length > 0) {
		blockers.push(
			`review_evidence_contradiction: North-star decision responses must include evidence references for each question (URL, artifact path, or file:line link); missing evidence for: ${questionIdsMissingEvidence.join(", ")}`,
		);
	}
	if (questionIdsWithNegativeAnswer.length > 0) {
		blockers.push(
			`safety_floor_violation: North-star decision responses contradict throughput intent unless explicitly declared as no-impact (metric_impact_declared:none with non-positive policy_surface_delta); negative answers found for: ${questionIdsWithNegativeAnswer.join(", ")}`,
		);
	}
	return blockers;
}

function resolveCurrentApprovers(
	reviews: PullRequestReview[],
	headSha: string,
	botLogins: Set<string>,
): string[] {
	const approvalStateByReviewer = new Map<string, boolean>();
	const reviewsInChronologicalOrder = reviews
		.map((review, index) => {
			const submittedAt = review.submitted_at
				? Date.parse(review.submitted_at)
				: Number.MIN_SAFE_INTEGER;
			return {
				review,
				order: index,
				submittedAt: Number.isNaN(submittedAt)
					? Number.MIN_SAFE_INTEGER
					: submittedAt,
			};
		})
		.sort(
			(left, right) =>
				left.submittedAt - right.submittedAt || left.order - right.order,
		);

	for (const { review } of reviewsInChronologicalOrder) {
		const login = normalizeBotLogin(review.user?.login);
		if (!login || isAutomatedActorLogin(login, botLogins)) {
			continue;
		}
		if (review.state === "CHANGES_REQUESTED" || review.state === "DISMISSED") {
			approvalStateByReviewer.set(login, false);
			continue;
		}
		if (review.commit_id !== headSha) {
			continue;
		}

		if (review.state === "APPROVED") {
			approvalStateByReviewer.set(login, true);
		}
	}

	return [...approvalStateByReviewer.entries()]
		.filter(([, approved]) => approved)
		.map(([login]) => login);
}

async function evaluateApprovals(
	client: GitHubClient,
	prNumber: number,
	headSha: string,
	codingActor: string | undefined,
	botLogins: Set<string>,
	options: {
		requireCodingActor: boolean;
	},
): Promise<ApprovalResult> {
	const reviews = await client.listPullRequestReviews(prNumber);
	const approvers = resolveCurrentApprovers(reviews, headSha, botLogins);

	const blockers: string[] = [];
	if (options.requireCodingActor && !codingActor) {
		blockers.push(
			"Unable to determine coding actor from PR commit metadata; cannot verify reviewer independence",
		);
		return { passed: false, blockers, approvers };
	}

	if (approvers.length === 0) {
		blockers.push("No APPROVED reviews found for the current HEAD SHA");
		return {
			passed: false,
			blockers,
			approvers,
			...(codingActor ? { codingActor } : {}),
		};
	}

	return {
		passed: true,
		blockers: [],
		approvers,
		...(codingActor ? { codingActor } : {}),
	};
}

async function resolveCodingActor(
	client: GitHubClient,
	prNumber: number,
	headSha: string,
	prAuthorLogin: string | undefined,
	botLogins: Set<string>,
): Promise<string | undefined> {
	const normalizedPrAuthor = normalizeBotLogin(prAuthorLogin);
	if (
		typeof (client as Partial<GitHubClient>).listPullRequestCommits !==
		"function"
	) {
		return isAutomatedActorLogin(normalizedPrAuthor, botLogins)
			? undefined
			: normalizedPrAuthor;
	}

	try {
		const commits = await client.listPullRequestCommits(prNumber);
		const headCommit = commits.find((commit) => commit.sha === headSha);
		if (!headCommit) {
			return isAutomatedActorLogin(normalizedPrAuthor, botLogins)
				? undefined
				: normalizedPrAuthor;
		}

		const commitActorCandidates = [
			normalizeBotLogin(headCommit.author?.login) ??
				normalizeBotLogin(headCommit.committer?.login),
			normalizeBotLogin(headCommit.committer?.login),
		].filter((login): login is string => login !== undefined);
		const headCommitHumanActor = commitActorCandidates.find(
			(login) => !isAutomatedActorLogin(login, botLogins),
		);
		if (headCommitHumanActor) {
			return headCommitHumanActor;
		}

		const latestHumanCommitActor = [...commits]
			.reverse()
			.map(
				(commit) =>
					normalizeBotLogin(commit.author?.login) ??
					normalizeBotLogin(commit.committer?.login),
			)
			.filter((login): login is string => login !== undefined)
			.find((login) => !isAutomatedActorLogin(login, botLogins));
		if (latestHumanCommitActor) {
			return latestHumanCommitActor;
		}

		return isAutomatedActorLogin(normalizedPrAuthor, botLogins)
			? undefined
			: normalizedPrAuthor;
	} catch {
		return isAutomatedActorLogin(normalizedPrAuthor, botLogins)
			? undefined
			: normalizedPrAuthor;
	}
}

function evaluateReviewerIndependence({
	approvers,
	codingActor,
}: {
	approvers: string[];
	codingActor: string;
}): ReviewerIndependenceResult {
	const independentApprovers = approvers.filter(
		(reviewer) => reviewer !== codingActor,
	);

	if (independentApprovers.length === 0) {
		return {
			passed: false,
			blockers: [
				`Reviewer independence failed: coding actor '${codingActor}' is the sole approving reviewer`,
			],
		};
	}

	return { passed: true, blockers: [] };
}

function evaluateRequiredChecks(
	checkRuns: CheckRun[],
	requiredChecks: string[],
	requiredCheckAliases: Map<string, string[]>,
	requiredCheckSources: Map<string, RequiredCheckSourceConstraint>,
): string[] {
	const blockers: string[] = [];
	const latestByCheckName = new Map<string, CheckRun[]>();

	for (const run of checkRuns) {
		const existing = latestByCheckName.get(run.name) ?? [];
		existing.push(run);
		latestByCheckName.set(run.name, existing);
	}

	const normalizeSourceToken = (
		value: string | number | undefined,
	): string | undefined => {
		if (typeof value === "number") {
			return String(value);
		}
		if (typeof value !== "string") {
			return undefined;
		}
		const normalized = value
			.trim()
			.toLowerCase()
			.replace(/[\s_]+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-+|-+$/g, "");
		return normalized.length > 0 ? normalized : undefined;
	};

	const matchesExpectedSource = (
		run: CheckRun,
		constraint: RequiredCheckSourceConstraint | undefined,
	): boolean => {
		if (!constraint) {
			return true;
		}

		const appSlug = normalizeSourceToken(run.app?.slug);
		const appId = normalizeSourceToken(run.app?.id);
		const appName = normalizeSourceToken(run.app?.name);

		if (!appSlug && !appId && !appName) {
			return false;
		}
		if (
			(appSlug && constraint.providerSlugs.has(appSlug)) ||
			(appSlug && constraint.sourceAppIds.has(appSlug)) ||
			(appId && constraint.sourceAppIds.has(appId)) ||
			(appName && constraint.providerSlugs.has(appName)) ||
			(appName && constraint.sourceAppIds.has(appName))
		) {
			return true;
		}
		return false;
	};

	const describeExpectedSource = (
		constraint: RequiredCheckSourceConstraint | undefined,
	): string | undefined => {
		if (!constraint) {
			return undefined;
		}
		const expected = [
			...constraint.providerSlugs.values(),
			...constraint.sourceAppIds.values(),
		].filter((value, index, values) => values.indexOf(value) === index);
		return expected.length > 0 ? expected.join(", ") : undefined;
	};

	for (const checkName of requiredChecks) {
		const candidateNames = [
			checkName,
			...(requiredCheckAliases.get(checkName) ?? []),
		].filter((value, index, values) => values.indexOf(value) === index);
		const sourceConstraint = requiredCheckSources.get(checkName);
		const candidateRuns = candidateNames
			.flatMap((candidateName) => latestByCheckName.get(candidateName) ?? [])
			.filter((run, index, runs) => runs.indexOf(run) === index);
		const sourceMatchedRuns = candidateRuns
			.filter((run) => matchesExpectedSource(run, sourceConstraint))
			.sort((left, right) => right.id - left.id);
		const checkRun = sourceMatchedRuns[0];
		if (!checkRun) {
			if (candidateRuns.length > 0 && sourceConstraint) {
				const expectedSource = describeExpectedSource(sourceConstraint);
				blockers.push(
					expectedSource
						? `Required check '${checkName}' was found, but only from non-authoritative providers (expected source: ${expectedSource})`
						: `Required check '${checkName}' was found, but only from non-authoritative providers`,
				);
				continue;
			}
			blockers.push(
				`Required check '${checkName}' was not found for current HEAD SHA`,
			);
			continue;
		}
		if (checkRun.status !== "completed") {
			blockers.push(
				`Required check '${checkName}' is not complete (status: ${checkRun.status})`,
			);
			continue;
		}
		if (checkRun.conclusion !== "success") {
			blockers.push(
				`Required check '${checkName}' did not pass (conclusion: ${checkRun.conclusion ?? "unknown"})`,
			);
		}
	}

	return blockers;
}

function resolveRequiredChecksManifestPath(
	contract: HarnessContract,
	contractPath?: string,
): string {
	const manifestPath =
		contract.ciProviderPolicy?.requiredCheckManifestPath ??
		DEFAULT_REQUIRED_CHECK_MANIFEST_PATH;
	const resolvedContractPath =
		typeof contractPath === "string" && contractPath.trim().length > 0
			? resolvePath(contractPath)
			: undefined;
	const contractDir = resolvedContractPath
		? dirname(resolvedContractPath)
		: process.cwd();
	if (isAbsolute(manifestPath)) {
		return manifestPath;
	}
	const manifestFromContractDir = resolvePath(contractDir, manifestPath);
	if (existsSync(manifestFromContractDir)) {
		return manifestFromContractDir;
	}
	const usesDefaultManifestPath =
		manifestPath === DEFAULT_REQUIRED_CHECK_MANIFEST_PATH;
	if (!usesDefaultManifestPath) {
		return manifestFromContractDir;
	}
	let cursor = contractDir;
	while (true) {
		if (existsSync(resolvePath(cursor, ".git"))) {
			const manifestFromRepoRoot = resolvePath(cursor, manifestPath);
			if (existsSync(manifestFromRepoRoot)) {
				return manifestFromRepoRoot;
			}
		}
		const parent = dirname(cursor);
		if (parent === cursor) {
			return manifestFromContractDir;
		}
		cursor = parent;
	}
}

function loadNormalizedRequiredChecksManifest(
	contract: HarnessContract,
	contractPath?: string,
): NormalizedRequiredChecksManifest | undefined {
	const resolvedManifestPath = resolveRequiredChecksManifestPath(
		contract,
		contractPath,
	);
	if (!existsSync(resolvedManifestPath)) {
		return undefined;
	}
	let parsedManifest: unknown;
	try {
		parsedManifest = JSON.parse(readFileSync(resolvedManifestPath, "utf-8"));
	} catch (error) {
		throw new RequiredChecksManifestError(
			resolvedManifestPath,
			`malformed JSON (${sanitizeError(error)})`,
		);
	}
	const normalized = normalizeRequiredChecksManifest(parsedManifest);
	if (!normalized.ok) {
		throw new RequiredChecksManifestError(
			resolvedManifestPath,
			normalized.error,
		);
	}
	return normalized.value;
}

function resolveDefaultReviewCheckName(
	contract: HarnessContract,
	contractPath?: string,
): string {
	const policyPrimaryCheck =
		contract.ciProviderPolicy?.primaryCheckName?.trim() ?? "";
	if (policyPrimaryCheck.length > 0) {
		return policyPrimaryCheck;
	}

	const normalizedManifest = loadNormalizedRequiredChecksManifest(
		contract,
		contractPath,
	);
	if (!normalizedManifest) {
		return DEFAULT_REVIEW_CHECK_NAME;
	}

	const activeProviderGate = normalizedManifest.gates.find(
		(gate) =>
			gate.enabled !== false &&
			gate.class === "required" &&
			gate.provider === normalizedManifest.activeProvider &&
			typeof gate.githubCheckName === "string" &&
			gate.githubCheckName.trim().length > 0,
	);
	return activeProviderGate?.githubCheckName ?? DEFAULT_REVIEW_CHECK_NAME;
}

function resolveRequestedReviewCheckName(
	checkName: string,
	contract: HarnessContract,
	contractPath?: string,
): string {
	const explicitCheckName = checkName.trim();
	if (explicitCheckName.length > 0) {
		return explicitCheckName;
	}
	return resolveDefaultReviewCheckName(contract, contractPath);
}

function resolveRequiredCheckAliases(
	contract: HarnessContract,
	contractPath?: string,
): Map<string, string[]> {
	const aliases = new Map<string, string[]>();
	const normalizedManifest = loadNormalizedRequiredChecksManifest(
		contract,
		contractPath,
	);
	if (!normalizedManifest) {
		return aliases;
	}
	for (const gate of normalizedManifest.gates) {
		if (
			gate.enabled === false ||
			gate.class !== "required" ||
			gate.provider !== normalizedManifest.activeProvider
		) {
			continue;
		}
		if (!gate.githubCheckName || gate.githubCheckName === gate.displayName) {
			continue;
		}
		const existing = aliases.get(gate.displayName) ?? [];
		if (!existing.includes(gate.githubCheckName)) {
			existing.push(gate.githubCheckName);
		}
		aliases.set(gate.displayName, existing);
	}
	return aliases;
}

function resolveRequiredCheckSources(
	contract: HarnessContract,
	contractPath?: string,
): Map<string, RequiredCheckSourceConstraint> {
	const sources = new Map<string, RequiredCheckSourceConstraint>();
	const normalizedManifest = loadNormalizedRequiredChecksManifest(
		contract,
		contractPath,
	);
	if (!normalizedManifest) {
		return sources;
	}

	for (const gate of normalizedManifest.gates) {
		if (
			gate.enabled === false ||
			gate.class !== "required" ||
			gate.provider !== normalizedManifest.activeProvider
		) {
			continue;
		}

		const normalizedProvider = normalizeConstraintSourceToken(gate.provider);
		const normalizedSourceAppId = normalizeConstraintSourceToken(
			gate.sourceAppId,
		);
		const keys = [
			gate.displayName,
			...(gate.githubCheckName ? [gate.githubCheckName] : []),
		];
		for (const key of keys) {
			const existing = sources.get(key) ?? {
				providerSlugs: new Set<string>(),
				sourceAppIds: new Set<string>(),
			};
			if (normalizedProvider.length > 0) {
				existing.providerSlugs.add(normalizedProvider);
			}
			if (normalizedSourceAppId.length > 0) {
				existing.sourceAppIds.add(normalizedSourceAppId);
			}
			sources.set(key, existing);
		}
	}

	return sources;
}

/**
 * Evaluates plan traceability for a pull request by running the plan gate and converting its result into a concise traceability outcome.
 *
 * @param prTitle - Optional PR title included when present to assist plan ID extraction.
 * @param prBody - Optional PR body included when provided to assist plan ID extraction.
 * @param changedFiles - Paths of files changed in the PR used to detect referenced plan IDs.
 * @returns An object with:
 *  - `passed`: `true` when the plan gate passed its checks, `false` otherwise.
 *  - `status`: `"missing"` when no plan IDs were found, `"pass"` when the gate passed, or `"fail"` when traceability checks failed.
 *  - `planIds`: the array of discovered plan identifiers (empty if none found).
 *  - `blockers`: human-readable blocker messages derived from plan gate errors, each prefixed with `Plan traceability:`.
 */
function evaluatePlanTraceability({
	prTitle,
	prBody,
	changedFiles,
}: {
	prTitle?: string;
	prBody?: string | null;
	changedFiles: string[];
}): PlanTraceabilityResult {
	const result = runPlanGate({
		...(prTitle ? { prTitle } : {}),
		...(typeof prBody === "string" ? { prBody } : {}),
		changedFiles,
		maxAge: Number.MAX_SAFE_INTEGER,
		requirePlanId: true,
		requireAcceptanceEvidence: true,
		requireTraceability: true,
	});

	const blockers = result.errors.map((error) => {
		const prefix = error.path ? `${error.path}: ` : "";
		return `Plan traceability: ${prefix}${error.message}`;
	});

	const status: ReviewGateOutput["plan_traceability_status"] =
		result.traceability?.planIds.length === 0
			? "missing"
			: result.passed
				? "pass"
				: "fail";

	return {
		passed: result.passed,
		status,
		planIds: result.traceability?.planIds ?? [],
		blockers,
	};
}

/**
 * Constructs a set of normalized bot account logins used to identify bot authors.
 *
 * @param botLogin - An optional additional bot login to include; it will be normalized and omitted if empty or invalid.
 * @returns A Set of normalized (lowercased, trimmed) bot login strings containing the configured defaults and the provided `botLogin` when valid.
 */
function buildBotLoginSet(botLogin?: string): Set<string> {
	return new Set<string>(
		[botLogin, "coderabbitai", "coderabbitai[bot]", "chatgpt-codex-connector"]
			.map((login) => normalizeBotLogin(login))
			.filter((login): login is string => login !== undefined),
	);
}

function evaluateUnresolvedReviewThreads(
	threads: Awaited<ReturnType<GitHubClient["listPullRequestReviewThreads"]>>,
	botLogins: Set<string>,
): ThreadReadinessResult {
	const unresolvedThreads = threads.filter((thread) => !thread.isResolved);
	if (unresolvedThreads.length === 0) {
		return { passed: true, blockers: [] };
	}

	const unresolvedHumanThreads = unresolvedThreads.filter((thread) => {
		const commentAuthors = thread.comments
			.map((comment) => normalizeBotLogin(comment.author?.login))
			.filter((login): login is string => login !== undefined);

		if (commentAuthors.length === 0) {
			return true;
		}

		return commentAuthors.some((login) => !botLogins.has(login));
	});

	if (unresolvedHumanThreads.length === 0) {
		return { passed: true, blockers: [] };
	}

	return {
		passed: false,
		blockers: [
			`Unresolved review thread comments remain (${unresolvedHumanThreads.length}); resolve all non-bot threads before merge`,
		],
	};
}

/**
 * Run review gate check with timeout polling.
 * Returns structured result usable as a library function.
 */
export async function runReviewGate(
	options: ReviewGateOptions,
): Promise<ReviewGateResult> {
	// Validate SHA format
	try {
		validateSha(options.headSha);
	} catch {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: `Invalid SHA format: ${options.headSha}`,
			},
		};
	}

	let contract: HarnessContract;
	try {
		contract = loadContract(options.contractPath);
	} catch (e) {
		if (e instanceof ContractLoadError) {
			return {
				ok: false,
				error: { code: "VALIDATION_ERROR", message: sanitizeError(e) },
			};
		}
		return {
			ok: false,
			error: { code: "SYSTEM_ERROR", message: sanitizeError(e) },
		};
	}

	const reviewPolicy = contract.reviewPolicy ?? DEFAULT_REVIEW_POLICY;
	const timeoutMs = reviewPolicy.timeoutSeconds * 1000;
	const startTime = Date.now();
	let requestedCheckName: string;
	try {
		requestedCheckName = resolveRequestedReviewCheckName(
			options.checkName,
			contract,
			options.contractPath,
		);
	} catch (error) {
		if (error instanceof RequiredChecksManifestError) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: error.message,
				},
			};
		}
		return {
			ok: false,
			error: { code: "SYSTEM_ERROR", message: sanitizeError(error) },
		};
	}
	let lastResolvedCheckName = requestedCheckName;
	let checkRunObserved = false;

	try {
		const client = new GitHubClient({
			token: options.token,
			owner: options.owner,
			repo: options.repo,
		});

		// SECURITY: Verify the caller-supplied SHA matches the PR's current head.
		// Without this check, an attacker controlling headSha could point to an older
		// commit with a passing review check and bypass the intended gate.
		const pullRequest = await client.getPullRequest(options.prNumber);
		const pullRequestHeadSha = pullRequest.head.sha;
		const changedFiles =
			typeof (client as Partial<GitHubClient>).listPullRequestFiles ===
			"function"
				? (await client.listPullRequestFiles(options.prNumber)).map(
						(file) => file.filename,
					)
				: [];
		const planTraceability = evaluatePlanTraceability({
			...(pullRequest.title ? { prTitle: pullRequest.title } : {}),
			...(pullRequest.body !== undefined ? { prBody: pullRequest.body } : {}),
			changedFiles,
		});
		const decisionQuestionBlockers = evaluateNorthStarDecisionQuestions({
			prBody: pullRequest.body,
			decisionQuestions: requiresCanonicalNorthStarSurfaces(contract.version)
				? (contract.northStar?.decisionQuestions ?? [])
				: [],
			requireQuestions: requiresCanonicalNorthStarSurfaces(contract.version),
		});
		const requiredCheckAliases = resolveRequiredCheckAliases(
			contract,
			options.contractPath,
		);
		const requiredCheckSources = resolveRequiredCheckSources(
			contract,
			options.contractPath,
		);

		if (pullRequestHeadSha.toLowerCase() !== options.headSha.toLowerCase()) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: `Provided SHA (${options.headSha}) does not match the pull request's current head SHA (${pullRequestHeadSha})`,
				},
			};
		}

		// Poll for check run completion with timeout
		while (Date.now() - startTime < timeoutMs) {
			const checkRuns = await client.listCheckRunsForRef(pullRequestHeadSha);
			const { checkResult, resolvedCheckName } = resolveReviewCheckResult(
				checkRuns,
				requestedCheckName,
				pullRequestHeadSha,
				requiredCheckSources,
			);
			lastResolvedCheckName = resolvedCheckName;

			if (!checkResult.found) {
				const elapsedMs = Date.now() - startTime;
				const remainingMs = timeoutMs - elapsedMs;
				if (remainingMs <= 0) {
					break;
				}
				await sleep(Math.min(POLL_INTERVAL_MS, remainingMs));
				continue;
			}
			checkRunObserved = true;

			if (isCheckRunPassing(checkResult)) {
				const enforceReviewerIndependence =
					reviewPolicy.enforceReviewerIndependence ??
					DEFAULT_REVIEW_POLICY.enforceReviewerIndependence ??
					false;
				const activeReviewGateChecks = new Set([
					requestedCheckName,
					resolvedCheckName,
				]);
				const canonicalReviewGateChecks = new Set([
					DEFAULT_REVIEW_CHECK_NAME,
					...LEGACY_REVIEW_CHECK_NAME_FALLBACKS,
				]);
				if (
					canonicalReviewGateChecks.has(requestedCheckName) ||
					canonicalReviewGateChecks.has(resolvedCheckName)
				) {
					for (const checkName of canonicalReviewGateChecks) {
						activeReviewGateChecks.add(checkName);
					}
				}
				const requiredChecks = (reviewPolicy.requiredChecks ?? []).filter(
					(checkName) => !activeReviewGateChecks.has(checkName),
				);
				const botLogins = buildBotLoginSet(options.botLogin);
				// Always enforce that at least one APPROVED review exists for the
				// current HEAD SHA. enforceReviewerIndependence only controls
				// whether the approver must be different from the PR author —
				// it cannot skip the approval requirement itself.
				const codingActor = await resolveCodingActor(
					client,
					options.prNumber,
					pullRequestHeadSha,
					pullRequest.user?.login?.trim(),
					botLogins,
				);
				const approvals = await evaluateApprovals(
					client,
					options.prNumber,
					pullRequestHeadSha,
					codingActor,
					botLogins,
					{
						requireCodingActor: enforceReviewerIndependence,
					},
				);
				const independence =
					enforceReviewerIndependence && approvals.passed
						? approvals.codingActor
							? evaluateReviewerIndependence({
									approvers: approvals.approvers,
									codingActor: approvals.codingActor,
								})
							: {
									passed: false,
									blockers: [
										"Unable to determine coding actor from PR commit metadata; cannot verify reviewer independence",
									],
								}
						: { passed: true, blockers: [] };
				const threads =
					typeof (client as Partial<GitHubClient>)
						.listPullRequestReviewThreads === "function"
						? await client.listPullRequestReviewThreads(options.prNumber)
						: [];
				const threadReadiness = evaluateUnresolvedReviewThreads(
					threads,
					botLogins,
				);
				const requiredCheckBlockers = evaluateRequiredChecks(
					checkRuns,
					requiredChecks,
					requiredCheckAliases,
					requiredCheckSources,
				);
				const additionalBlockers = [
					...approvals.blockers,
					...independence.blockers,
					...threadReadiness.blockers,
					...requiredCheckBlockers,
					...planTraceability.blockers,
					...decisionQuestionBlockers,
				];
				return {
					ok: true,
					output: withReadinessFields(
						{
							verified:
								additionalBlockers.length === 0 &&
								approvals.passed &&
								independence.passed &&
								threadReadiness.passed,
							headSha: pullRequestHeadSha,
							checkStatus: checkResult.status,
							checkConclusion: checkResult.conclusion ?? undefined,
							needsRerun: false,
						},
						{
							checkName: resolvedCheckName,
							additionalBlockers,
							planTraceability: {
								status: planTraceability.status,
								planIds: planTraceability.planIds,
							},
						},
					),
				};
			}

			// If completed but not passing, needs rerun
			if (checkResult.status === "completed") {
				return {
					ok: true,
					output: withReadinessFields(
						{
							verified: false,
							headSha: pullRequestHeadSha,
							checkStatus: checkResult.status,
							checkConclusion: checkResult.conclusion ?? undefined,
							needsRerun: true,
						},
						{
							checkName: resolvedCheckName,
							additionalBlockers: [
								...planTraceability.blockers,
								...decisionQuestionBlockers,
							],
							planTraceability: {
								status: planTraceability.status,
								planIds: planTraceability.planIds,
							},
						},
					),
				};
			}

			// Still in progress - wait and retry
			if (isCheckRunInProgress(checkResult)) {
				const elapsedMs = Date.now() - startTime;
				const remainingMs = timeoutMs - elapsedMs;
				if (remainingMs <= 0) {
					break;
				}
				await sleep(Math.min(POLL_INTERVAL_MS, remainingMs));
			}
		}

		// Timeout reached
		if (reviewPolicy.timeoutAction === "fail") {
			return {
				ok: false,
				error: {
					code: "TIMEOUT",
					message: `Review check timed out after ${reviewPolicy.timeoutSeconds} seconds`,
				},
			};
		}

		// Warn mode - return needsRerun
		return {
			ok: true,
			output: withReadinessFields(
				{
					verified: false,
					headSha: pullRequestHeadSha,
					checkStatus: checkRunObserved ? "in_progress" : "not_found",
					needsRerun: true,
					timedOut: true,
				},
				{
					checkName: lastResolvedCheckName,
					additionalBlockers: [
						...(!checkRunObserved && lastResolvedCheckName
							? [
									`${lastResolvedCheckName} check run not found for HEAD SHA ${pullRequestHeadSha}`,
								]
							: []),
						...planTraceability.blockers,
						...decisionQuestionBlockers,
					],
					planTraceability: {
						status: planTraceability.status,
						planIds: planTraceability.planIds,
					},
				},
			),
		};
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		const errorName = e instanceof Error ? e.name : "UnknownError";

		if (errorName === "NotFoundError") {
			return {
				ok: false,
				error: { code: "NOT_FOUND", message: errorMessage },
			};
		}
		if (errorName === "ForbiddenError") {
			return {
				ok: false,
				error: { code: "PERMISSION_DENIED", message: errorMessage },
			};
		}
		if (errorName === "UnauthorizedError") {
			return {
				ok: false,
				error: { code: "PERMISSION_DENIED", message: errorMessage },
			};
		}
		if (e instanceof RequiredChecksManifestError) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: e.message,
				},
			};
		}

		return {
			ok: false,
			error: { code: "SYSTEM_ERROR", message: sanitizeError(e) },
		};
	}
}

/**
 * Post a rerun comment if one doesn't already exist for this SHA.
 */
export async function postRerunCommentIfNeeded(
	client: GitHubClient,
	prNumber: number,
	headSha: string,
	botLogin: string,
	reason: string,
	contractPath = DEFAULT_REVIEW_GATE_AUTHZ_CONTRACT,
	targetBranch?: string,
): Promise<{ posted: boolean; message?: string }> {
	try {
		const authzResult = await runAuthzPreflight({
			client,
			contractPath,
			prNumber,
			...(targetBranch !== undefined ? { targetBranch } : {}),
		});
		if (!authzResult.passed) {
			const { message } = authzResult;
			return {
				posted: false,
				message:
					message ??
					"Governance hold: authz check returned violations or failed",
			};
		}

		const comments = await client.listIssueComments(prNumber);
		const existingComment = hasRerunCommentForSha(comments, headSha, botLogin);

		if (existingComment.found) {
			return {
				posted: false,
				message: `Rerun comment already exists for SHA ${headSha} from ${existingComment.timestamp.toISOString()}`,
			};
		}

		const commentBody = formatRerunComment(headSha, reason);
		await client.createIssueComment(prNumber, commentBody);

		return { posted: true };
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		return {
			posted: false,
			message: `Failed to post rerun comment: ${errorMessage}`,
		};
	}
}

interface AuthzPreflightInput {
	client: GitHubClient;
	contractPath: string;
	prNumber: number;
	targetBranch?: string;
}

interface AuthzPreflightResult {
	passed: boolean;
	message?: string;
}

function normalizeBotLogin(login: string | undefined): string | undefined {
	const trimmed = login?.trim().toLowerCase();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isAutomatedActorLogin(
	login: string | undefined,
	botLogins: Set<string>,
): boolean {
	if (!login) {
		return true;
	}
	return botLogins.has(login) || /\[bot\]$/u.test(login);
}

async function resolveBotOnlyThreads(
	client: GitHubClient,
	prNumber: number,
	botLogins: Set<string>,
): Promise<{ resolvedCount: number; unresolvedCount: number }> {
	if (botLogins.size === 0) {
		return { resolvedCount: 0, unresolvedCount: 0 };
	}

	const threads = await client.listPullRequestReviewThreads(prNumber);
	const unresolvedThreads = threads.filter((thread) => !thread.isResolved);
	let resolvedCount = 0;

	for (const thread of unresolvedThreads) {
		const commentAuthors = thread.comments
			.map((comment) => normalizeBotLogin(comment.author?.login))
			.filter((login): login is string => login !== undefined);
		if (commentAuthors.length === 0) {
			continue;
		}

		const isBotOnly = commentAuthors.every((login) => botLogins.has(login));
		if (!isBotOnly) {
			continue;
		}

		await client.resolvePullRequestReviewThread(thread.id);
		resolvedCount += 1;
	}

	return {
		resolvedCount,
		unresolvedCount: unresolvedThreads.length - resolvedCount,
	};
}

async function runAuthzPreflight({
	client,
	contractPath,
	prNumber,
	targetBranch,
}: AuthzPreflightInput): Promise<AuthzPreflightResult> {
	let branch = targetBranch;
	if (branch === undefined) {
		const pullRequest = await client.getPullRequest(prNumber);
		branch = pullRequest.head.ref;
	}

	const result = await runCheckAuthz({
		contractPath,
		repo: client.getRepositoryIdentifier(),
		branch,
	});

	if (!result.ok) {
		return {
			passed: false,
			message: `Governance hold: failed to run authz preflight (${result.error.message})`,
		};
	}

	if (!result.output.passed) {
		const violationSummary = result.output.violations
			.map((violation) => `${violation.type}: ${violation.message}`)
			.join("; ");
		return {
			passed: false,
			message: `Governance hold: ${violationSummary}`,
		};
	}

	return { passed: true };
}

/**
 * Get recovery hint for common error codes.
 */
function getRecoveryHint(code: string): string | undefined {
	switch (code) {
		case "VALIDATION_ERROR":
			return "Ensure the SHA format is valid and matches the PR's current head SHA";
		case "NOT_FOUND":
			return "Verify the PR number, owner, and repo are correct and accessible";
		case "PERMISSION_DENIED":
			return "Ensure the GitHub token has repo scope and write access to checks";
		case "TIMEOUT":
			return "Increase timeoutSeconds in harness.contract.json or re-run the check";
		default:
			return undefined;
	}
}

function resolveArtifactCheckName(options: ReviewGateOptions): string {
	const explicitCheckName = options.checkName.trim();
	if (explicitCheckName.length > 0) {
		return explicitCheckName;
	}

	try {
		const contract = loadContract(options.contractPath);
		return resolveRequestedReviewCheckName(
			options.checkName,
			contract,
			options.contractPath,
		);
	} catch {
		return DEFAULT_REVIEW_CHECK_NAME;
	}
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export async function runReviewGateCLI(
	options: ReviewGateOptions,
): Promise<number> {
	const startedAt = new Date().toISOString();
	const result = await runReviewGate(options);

	const logConfidenceExport = (output: ReviewGateOutput): void => {
		console.info(
			[
				`REVIEW_CONFIDENCE_SCORE=${output.confidence_rubric.score}/5`,
				`REVIEW_CONFIDENCE_LEVEL=${output.confidence_rubric.level}`,
				`REVIEW_POLICY_GATE=${output.policy_gate_status}`,
				`REVIEW_PLAN_TRACEABILITY=${output.plan_traceability_status}`,
				`REVIEW_ACTIONABLE=${output.actionable_count}`,
				`REVIEW_INFORMATIONAL=${output.informational_count}`,
			].join(" "),
		);
	};

	if (result.ok) {
		if (result.output.verified && options.autoResolveBotThreads) {
			try {
				const client = new GitHubClient({
					token: options.token,
					owner: options.owner,
					repo: options.repo,
				});
				const botLogins = buildBotLoginSet(options.botLogin);
				const threadResolutionResult = await resolveBotOnlyThreads(
					client,
					options.prNumber,
					botLogins,
				);
				if (!options.json) {
					console.info(
						`Resolved ${threadResolutionResult.resolvedCount} bot-only review thread(s).`,
					);
				}
			} catch (error) {
				const message = sanitizeError(error);
				if (options.json) {
					console.error(
						JSON.stringify({
							warning: `Failed to auto-resolve bot-only threads: ${message}`,
						}),
					);
				} else {
					console.warn(`⚠ Failed to auto-resolve bot-only threads: ${message}`);
				}
			}
		}

		const exitCode = result.output.verified
			? EXIT_CODES.SUCCESS
			: EXIT_CODES.REVIEW_NOT_VERIFIED;
		let finalExitCode: number = exitCode;

		try {
			emitReviewGateDecisionArtifacts({
				options,
				...(result.output.effectiveCheckName
					? { effectiveCheckName: result.output.effectiveCheckName }
					: {}),
				startedAt,
				finishedAt: new Date().toISOString(),
				exitCode,
				result,
			});
		} catch (error) {
			console.error(
				`Failed to emit review-gate decision artifacts: ${sanitizeError(error)}`,
			);
			finalExitCode = EXIT_CODES.SYSTEM_ERROR;
		}
		const gateResult = normaliseReviewGateResult(result);

		if (options.json) {
			const jsonOutput = {
				...gateResult,
				meta: {
					...(gateResult.meta ?? {}),
					exitCode: finalExitCode,
				},
			};
			process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
		} else {
			renderGateDecision(gateResult);
			logConfidenceExport(result.output);
		}

		return finalExitCode;
	}

	const recoveryHint = getRecoveryHint(result.error.code);
	const exitCode = (() => {
		switch (result.error.code) {
			case "VALIDATION_ERROR":
				return EXIT_CODES.VALIDATION_ERROR;
			case "NOT_FOUND":
				return EXIT_CODES.NOT_FOUND;
			case "PERMISSION_DENIED":
				return EXIT_CODES.PERMISSION_DENIED;
			case "TIMEOUT":
				return EXIT_CODES.TIMEOUT;
			default:
				return EXIT_CODES.SYSTEM_ERROR;
		}
	})();
	let finalExitCode = exitCode;

	try {
		emitReviewGateDecisionArtifacts({
			options,
			effectiveCheckName: resolveArtifactCheckName(options),
			startedAt,
			finishedAt: new Date().toISOString(),
			exitCode,
			result: {
				ok: false,
				error: {
					code: result.error.code as ReviewGateErrorCode,
					message: result.error.message,
				},
			},
		});
	} catch (error) {
		console.error(
			`Failed to emit review-gate decision artifacts: ${sanitizeError(error)}`,
		);
		finalExitCode = EXIT_CODES.SYSTEM_ERROR;
	}
	const gateResult = normaliseReviewGateResult(result, recoveryHint);

	if (options.json) {
		const jsonOutput = {
			...gateResult,
			meta: {
				...(gateResult.meta ?? {}),
				exitCode: finalExitCode,
			},
		};
		process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
	} else {
		// Error path uses stderr instead of stdout
		console.error(`✗ ${gateResult.gate} ${gateResult.status}`);
		console.error(`Reason: ${gateResult.reason}`);
		if (gateResult.action_now.length > 0) {
			console.error("Action now:");
			for (const step of gateResult.action_now) {
				console.error(`- ${step}`);
			}
		}
	}

	return finalExitCode;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
