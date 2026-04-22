import type { CheckRun } from "./client.js";

export interface ReviewCheckResult {
	found: boolean;
	status: "completed" | "in_progress" | "queued" | "pending" | "not_found";
	conclusion: string | null;
	checkRun?: CheckRun;
}

/**
 * Find a specific check run by name from a list of check runs.
 */
export function findReviewCheckRun(
	checkRuns: CheckRun[],
	checkName: string,
	options: {
		headSha?: string;
		providerSlugs?: ReadonlySet<string>;
		sourceAppIds?: ReadonlySet<string>;
	} = {},
): ReviewCheckResult {
	const expectedHeadSha = options.headSha?.toLowerCase();
	const providerSlugs = options.providerSlugs;
	const sourceAppIds = options.sourceAppIds;
	const hasSourceConstraint =
		(providerSlugs?.size ?? 0) > 0 || (sourceAppIds?.size ?? 0) > 0;
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
	let reviewCheck: CheckRun | undefined;
	for (const check of checkRuns) {
		if (check.name !== checkName) {
			continue;
		}
		const checkHeadSha =
			typeof check.head_sha === "string" ? check.head_sha.toLowerCase() : "";
		if (expectedHeadSha && checkHeadSha !== expectedHeadSha) {
			continue;
		}
		if (hasSourceConstraint) {
			const appSlug = normalizeSourceToken(check.app?.slug);
			const appId = normalizeSourceToken(check.app?.id);
			const appName = normalizeSourceToken(check.app?.name);
			const sourceMatches =
				(appSlug && providerSlugs?.has(appSlug)) ||
				(appSlug && sourceAppIds?.has(appSlug)) ||
				(appId && sourceAppIds?.has(appId)) ||
				(appName && providerSlugs?.has(appName)) ||
				(appName && sourceAppIds?.has(appName));
			if (!sourceMatches) {
				continue;
			}
		}
		if (!reviewCheck || check.id > reviewCheck.id) {
			reviewCheck = check;
		}
	}

	if (!reviewCheck) {
		return {
			found: false,
			status: "not_found",
			conclusion: null,
		};
	}

	return {
		found: true,
		status: reviewCheck.status,
		conclusion: reviewCheck.conclusion,
		checkRun: reviewCheck,
	};
}

/**
 * Check if a review check run is complete and successful.
 */
export function isCheckRunPassing(result: ReviewCheckResult): boolean {
	return (
		result.found &&
		result.status === "completed" &&
		result.conclusion === "success"
	);
}

/**
 * Check if a review check run is still in progress.
 */
export function isCheckRunInProgress(result: ReviewCheckResult): boolean {
	return (
		result.found &&
		(result.status === "in_progress" ||
			result.status === "queued" ||
			result.status === "pending")
	);
}
