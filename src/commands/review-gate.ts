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
import {
	normaliseReviewGateResult,
	renderGateDecision,
} from "../lib/output/normalise.js";
import { runPlanGate } from "../lib/plan-gate/detector.js";
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
	policyCheckName?: string;
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
	const policyCheckName = options.policyCheckName ?? "risk-policy-gate";
	const planTraceabilityStatus =
		options.planTraceability?.status ?? ("missing" as const);
	const planIds = options.planTraceability?.planIds ?? [];
	if (policyGateStatus === "missing") {
		blockers.push(
			`${policyCheckName} check run not found for current HEAD SHA`,
		);
	}
	if (policyGateStatus === "fail") {
		blockers.push(
			`${policyCheckName} check did not pass (conclusion: ${base.checkConclusion ?? "unknown"})`,
		);
	}
	if (policyGateStatus === "pending" && (base.needsRerun || base.timedOut)) {
		blockers.push(
			`${policyCheckName} verification is incomplete for current HEAD SHA`,
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
						`${policyCheckName} passed for the current HEAD SHA`,
						"PR work maps to validated plan IDs",
						"no merge blockers detected in review gate",
					],
				}
			: policyGateStatus === "pending"
				? {
						score: 2,
						level: "low",
						rationale: [
							`${policyCheckName} verification has not reached a terminal pass state`,
							"merge confidence is reduced until blockers are resolved",
						],
					}
				: policyGateStatus === "pass"
					? {
							score: 2,
							level: "low",
							rationale: [
								`${policyCheckName} passed but merge-readiness blockers remain`,
								"merge should remain blocked until required checks and review policies are satisfied",
							],
						}
					: {
							score: 1,
							level: "low",
							rationale: [
								`${policyCheckName} did not provide a passing result for current HEAD SHA`,
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
							policyCheckName: options.checkName,
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
							policyCheckName: options.checkName,
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
							policyCheckName: options.checkName,
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
					policyCheckName: options.checkName,
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
		const gateResult = normaliseReviewGateResult(result);

		if (options.json) {
			const jsonOutput = {
				...gateResult,
				meta: {
					...(gateResult.meta ?? {}),
					exitCode,
				},
			};
			process.stdout.write(`${JSON.stringify(jsonOutput, null, 2)}\n`);
		} else {
			renderGateDecision(gateResult);
			logConfidenceExport(result.output);
		}

		try {
			emitReviewGateDecisionArtifacts({
				options,
				startedAt,
				finishedAt: new Date().toISOString(),
				exitCode,
				result,
			});
		} catch (error) {
			console.error(
				`Failed to emit review-gate decision artifacts: ${sanitizeError(error)}`,
			);
		}

		return exitCode;
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
	const gateResult = normaliseReviewGateResult(result, recoveryHint);

	if (options.json) {
		const jsonOutput = {
			...gateResult,
			meta: {
				...(gateResult.meta ?? {}),
				exitCode,
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

	try {
		emitReviewGateDecisionArtifacts({
			options,
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
		return EXIT_CODES.SYSTEM_ERROR;
	}

	return exitCode;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
