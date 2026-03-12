import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import {
	DEFAULT_REVIEW_POLICY,
	type ReviewPolicy,
} from "../lib/contract/types.js";
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
import { runPlanGate } from "../lib/plan-gate/detector.js";
import { runCheckAuthz } from "./check-authz.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	TIMEOUT: 4,
	REVIEW_NOT_VERIFIED: 5,
	SYSTEM_ERROR: 10,
} as const;

export interface ReviewGateOptions {
	contractPath: string;
	token: string;
	owner: string;
	repo: string;
	prNumber: number;
	headSha: string;
	checkName: string;
	botLogin?: string;
	autoResolveBotThreads?: boolean;
	json?: boolean;
}

export interface ReviewGateOutput {
	verified: boolean;
	headSha: string;
	checkStatus: "completed" | "in_progress" | "queued" | "pending" | "not_found";
	checkConclusion?: string | undefined;
	needsRerun: boolean;
	timedOut?: boolean;
	policy_gate_status: "pass" | "fail" | "pending" | "missing";
	plan_traceability_status: "pass" | "fail" | "missing";
	plan_ids: string[];
	blockers: string[];
	actionable_count: number;
	informational_count: number;
	confidence_rubric: {
		score: 1 | 2 | 3 | 4 | 5;
		level: "low" | "medium" | "high";
		rationale: string[];
	};
}

export type ReviewGateResult =
	| { ok: true; output: ReviewGateOutput }
	| { ok: false; error: { code: string; message: string } };

const POLL_INTERVAL_MS = 5000; // 5 seconds
const DEFAULT_REVIEW_GATE_AUTHZ_CONTRACT = "harness.contract.json";

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
	planTraceability?: {
		status: ReviewGateOutput["plan_traceability_status"];
		planIds: string[];
	};
}

function withReadinessFields(
	base: BaseReviewGateOutput,
	options: ReadinessOptions = {},
): ReviewGateOutput {
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
		blockers.push("risk-policy-gate check run not found for current HEAD SHA");
	}
	if (policyGateStatus === "fail") {
		blockers.push(
			`risk-policy-gate check did not pass (conclusion: ${base.checkConclusion ?? "unknown"})`,
		);
	}
	if (policyGateStatus === "pending" && (base.needsRerun || base.timedOut)) {
		blockers.push(
			"risk-policy-gate verification is incomplete for current HEAD SHA",
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
						"risk-policy-gate passed for the current HEAD SHA",
						"PR work maps to validated plan IDs",
						"no merge blockers detected in review gate",
					],
				}
			: policyGateStatus === "pending"
				? {
						score: 2,
						level: "low",
						rationale: [
							"risk-policy-gate verification has not reached a terminal pass state",
							"merge confidence is reduced until blockers are resolved",
						],
					}
				: policyGateStatus === "pass"
					? {
							score: 2,
							level: "low",
							rationale: [
								"risk-policy-gate passed but merge-readiness blockers remain",
								"merge should remain blocked until required checks and review policies are satisfied",
							],
						}
					: {
							score: 1,
							level: "low",
							rationale: [
								"risk-policy-gate did not provide a passing result for current HEAD SHA",
								"merge should remain blocked until policy gate issues are resolved",
							],
						};

	return {
		...base,
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

function resolveCurrentApprovers(
	reviews: PullRequestReview[],
	headSha: string,
): string[] {
	const latestStateByReviewer = new Map<
		string,
		{ state: string; commitId?: string | null; submittedAt: number }
	>();

	for (const review of reviews) {
		const login = review.user?.login?.trim();
		if (!login) {
			continue;
		}
		const submittedAt = review.submitted_at
			? Date.parse(review.submitted_at)
			: Number.MIN_SAFE_INTEGER;
		if (Number.isNaN(submittedAt)) {
			continue;
		}
		const previousState = latestStateByReviewer.get(login);
		if (!previousState || submittedAt > previousState.submittedAt) {
			latestStateByReviewer.set(login, {
				state: review.state,
				commitId: review.commit_id ?? null,
				submittedAt,
			});
		}
	}

	return [...latestStateByReviewer.entries()]
		.filter(([, review]) => {
			if (review.state !== "APPROVED") {
				return false;
			}
			return review.commitId === headSha;
		})
		.map(([login]) => login);
}

async function evaluateApprovals(
	client: GitHubClient,
	prNumber: number,
	headSha: string,
	codingActor: string | undefined,
): Promise<ApprovalResult> {
	const reviews = await client.listPullRequestReviews(prNumber);
	const approvers = resolveCurrentApprovers(reviews, headSha);

	const blockers: string[] = [];
	if (!codingActor) {
		blockers.push(
			"Unable to determine coding actor from PR author; cannot verify reviewer independence",
		);
		return { passed: false, blockers, approvers };
	}

	if (approvers.length === 0) {
		blockers.push("No APPROVED reviews found for the current HEAD SHA");
		return { passed: false, blockers, approvers, codingActor };
	}

	return { passed: true, blockers: [], approvers, codingActor };
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
): string[] {
	const blockers: string[] = [];
	const latestByCheckName = new Map<string, CheckRun>();

	for (const run of checkRuns) {
		const current = latestByCheckName.get(run.name);
		if (!current || run.id > current.id) {
			latestByCheckName.set(run.name, run);
		}
	}

	for (const checkName of requiredChecks) {
		const checkRun = latestByCheckName.get(checkName);
		if (!checkRun) {
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

function buildBotLoginSet(botLogin?: string): Set<string> {
	return new Set<string>(
		[
			botLogin,
			"greptile-apps",
			"greptile-apps[bot]",
			"greptile[bot]",
			"greptileai[bot]",
			"greptile",
			"greptileai",
			"chatgpt-codex-connector",
		]
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

	let contract: { reviewPolicy?: ReviewPolicy | undefined };
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
			const checkResult = findReviewCheckRun(checkRuns, options.checkName);

			if (!checkResult.found) {
				return {
					ok: true,
					output: withReadinessFields(
						{
							verified: false,
							headSha: pullRequestHeadSha,
							checkStatus: "not_found",
							needsRerun: true,
						},
						{
							additionalBlockers: planTraceability.blockers,
							planTraceability: {
								status: planTraceability.status,
								planIds: planTraceability.planIds,
							},
						},
					),
				};
			}

			if (isCheckRunPassing(checkResult)) {
				const enforceReviewerIndependence =
					reviewPolicy.enforceReviewerIndependence ??
					DEFAULT_REVIEW_POLICY.enforceReviewerIndependence ??
					false;
				const requiredChecks = (reviewPolicy.requiredChecks ?? []).filter(
					(checkName) => checkName !== options.checkName,
				);
				// Always enforce that at least one APPROVED review exists for the
				// current HEAD SHA. enforceReviewerIndependence only controls
				// whether the approver must be different from the PR author —
				// it cannot skip the approval requirement itself.
				const approvals = await evaluateApprovals(
					client,
					options.prNumber,
					pullRequestHeadSha,
					pullRequest.user?.login?.trim(),
				);
				const independence =
					enforceReviewerIndependence && approvals.passed
						? evaluateReviewerIndependence({
								approvers: approvals.approvers,
								codingActor: approvals.codingActor ?? "",
							})
						: { passed: true, blockers: [] };
				const threads =
					typeof (client as Partial<GitHubClient>)
						.listPullRequestReviewThreads === "function"
						? await client.listPullRequestReviewThreads(options.prNumber)
						: [];
				const threadReadiness = evaluateUnresolvedReviewThreads(
					threads,
					buildBotLoginSet(options.botLogin),
				);
				const requiredCheckBlockers = evaluateRequiredChecks(
					checkRuns,
					requiredChecks,
				);
				const additionalBlockers = [
					...approvals.blockers,
					...independence.blockers,
					...threadReadiness.blockers,
					...requiredCheckBlockers,
					...planTraceability.blockers,
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
							additionalBlockers: planTraceability.blockers,
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
					checkStatus: "in_progress",
					needsRerun: true,
					timedOut: true,
				},
				{
					additionalBlockers: planTraceability.blockers,
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
 * CLI entry point with output formatting and exit codes.
 */
export async function runReviewGateCLI(
	options: ReviewGateOptions,
): Promise<number> {
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

		if (options.json) {
			console.info(JSON.stringify(result.output));
		} else if (result.output.verified) {
			console.info(`✓ Review verified for SHA ${result.output.headSha}`);
			logConfidenceExport(result.output);
		} else if (result.output.timedOut) {
			console.warn(`⚠ Review check timed out for SHA ${result.output.headSha}`);
			logConfidenceExport(result.output);
		} else {
			console.error(
				`✗ Review not verified: check ${result.output.checkStatus}`,
			);
			logConfidenceExport(result.output);
		}

		return result.output.verified
			? EXIT_CODES.SUCCESS
			: EXIT_CODES.REVIEW_NOT_VERIFIED;
	}

	console.error(result.error.message);
	if (options.json) {
		console.error(JSON.stringify({ error: result.error }));
	}

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
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
