import { loadContract } from "../contract/loader.js";
import type { ContextCompactPolicy } from "../contract/types.js";

const ESTIMATED_CONTEXT_WINDOW_TOKENS = 200_000;
const AUTOCOMPACT_BUFFER_TOKENS = 13_000;
const ESTIMATED_TOKENS_PER_RESULT = 300;

function isMissingContractError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code === "ENOENT"
	);
}

function estimateRetrievalBudgetTokens(limit: number): number {
	// Rough planning heuristic: each retrieved item is budgeted at ~300 tokens.
	return Math.max(1, limit) * ESTIMATED_TOKENS_PER_RESULT;
}

function resolveThresholdFromPolicy(policy: ContextCompactPolicy): number {
	// Mirror autocompact-style threshold behavior used by Claude Code:
	// cap percentage thresholds by an upper token buffer to leave room
	// for model output and post-processing.
	const percentThreshold = Math.min(
		1,
		Math.max(0, policy.thresholdPercent / 100),
	);
	const autoCompactThreshold =
		(ESTIMATED_CONTEXT_WINDOW_TOKENS - AUTOCOMPACT_BUFFER_TOKENS) /
		ESTIMATED_CONTEXT_WINDOW_TOKENS;
	return Math.min(percentThreshold, autoCompactThreshold);
}

export function loadContextCompactPolicy(
	baseDir: string,
): ContextCompactPolicy | undefined {
	try {
		return loadContract("harness.contract.json", baseDir, {
			allowExtends: false,
		}).contextCompact;
	} catch (error) {
		if (isMissingContractError(error)) {
			return undefined;
		}
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Failed to load contextCompact policy from harness.contract.json in ${baseDir}: ${message}`,
			{ cause: error },
		);
	}
}

export function resolveContextCompactDefaults(
	query: string,
	policy: ContextCompactPolicy | undefined,
	fallbackLimit: number,
	fallbackThreshold: number,
): { limit: number; threshold: number } {
	if (!policy) {
		return { limit: fallbackLimit, threshold: fallbackThreshold };
	}

	const threshold = resolveThresholdFromPolicy(policy);
	const retrievalBudgetTokens = estimateRetrievalBudgetTokens(fallbackLimit);
	const queryTokens = Math.max(1, Math.ceil(query.trim().length / 4));
	const estimatedInputTokens = retrievalBudgetTokens + queryTokens;
	const shouldUseMicro =
		policy.strategy === "micro" ||
		estimatedInputTokens >= policy.microCompactThresholdTokens;

	const limit = shouldUseMicro
		? Math.min(fallbackLimit, policy.strategy === "aggressive" ? 3 : 5)
		: policy.strategy === "aggressive"
			? Math.min(fallbackLimit, 7)
			: fallbackLimit;

	return { limit, threshold };
}
