import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
// LOCAL_EDIT
import {
	DEFAULT_REVIEW_POLICY,
	type ReviewPolicy,
} from "../lib/contract/types.js";
import {
	findReviewCheckRun,
	isCheckRunInProgress,
	isCheckRunPassing,
} from "../lib/github/check-run.js";
import { GitHubClient } from "../lib/github/client.js";
import {
	formatRerunComment,
	hasRerunCommentForSha,
} from "../lib/github/comments.js";
import { validateSha } from "../lib/github/sha.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { runCheckAuthz } from "./check-authz.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	TIMEOUT: 4,
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
	json?: boolean;
}

export interface ReviewGateOutput {
	verified: boolean;
	headSha: string;
	checkStatus: "completed" | "in_progress" | "queued" | "pending" | "not_found";
	checkConclusion?: string | undefined;
	needsRerun: boolean;
	timedOut?: boolean;
}

export type ReviewGateResult =
	| { ok: true; output: ReviewGateOutput }
	| { ok: false; error: { code: string; message: string } };

const POLL_INTERVAL_MS = 5000; // 5 seconds
const DEFAULT_REVIEW_GATE_AUTHZ_CONTRACT = "harness.contract.json";

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

		// Poll for check run completion with timeout
		while (Date.now() - startTime < timeoutMs) {
			const checkRuns = await client.listCheckRunsForRef(options.headSha);
			const checkResult = findReviewCheckRun(checkRuns, options.checkName);

			if (!checkResult.found) {
				return {
					ok: true,
					output: {
						verified: false,
						headSha: options.headSha,
						checkStatus: "not_found",
						needsRerun: true,
					},
				};
			}

			if (isCheckRunPassing(checkResult)) {
				return {
					ok: true,
					output: {
						verified: true,
						headSha: options.headSha,
						checkStatus: checkResult.status,
						checkConclusion: checkResult.conclusion ?? undefined,
						needsRerun: false,
					},
				};
			}

			// If completed but not passing, needs rerun
			if (checkResult.status === "completed") {
				return {
					ok: true,
					output: {
						verified: false,
						headSha: options.headSha,
						checkStatus: checkResult.status,
						checkConclusion: checkResult.conclusion ?? undefined,
						needsRerun: true,
					},
				};
			}

			// Still in progress - wait and retry
			if (isCheckRunInProgress(checkResult)) {
				await sleep(POLL_INTERVAL_MS);
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
			output: {
				verified: false,
				headSha: options.headSha,
				checkStatus: "in_progress",
				needsRerun: true,
				timedOut: true,
			},
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

	if (result.ok) {
		if (options.json) {
			console.info(JSON.stringify(result.output));
		} else if (result.output.verified) {
			console.info(`✓ Review verified for SHA ${result.output.headSha}`);
		} else if (result.output.timedOut) {
			console.warn(`⚠ Review check timed out for SHA ${result.output.headSha}`);
		} else {
			console.error(
				`✗ Review not verified: check ${result.output.checkStatus}`,
			);
		}

		return result.output.verified
			? EXIT_CODES.SUCCESS
			: EXIT_CODES.VALIDATION_ERROR;
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
