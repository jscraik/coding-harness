import type { HarnessContract } from "../contract/types.js";
import { findReviewCheckRun } from "../github/check-run.js";
import type { ReviewCheckResult } from "../github/check-run.js";
import type { CheckRun } from "../github/client.js";
import {
	describeExpectedSource,
	hasCheckRunSourceMetadata,
	matchesExpectedSource,
} from "./required-check-sources.js";
import type { RequiredCheckSourceConstraint } from "./required-check-sources.js";
import { loadNormalizedRequiredChecksManifest } from "./required-check-manifest.js";
export { resolveRequiredCheckSources } from "./required-check-sources.js";
export type { RequiredCheckSourceConstraint } from "./required-check-sources.js";

export const DEFAULT_REVIEW_CHECK_NAME = "pr-pipeline";
export const LEGACY_REVIEW_CHECK_NAME_FALLBACKS = [
	"risk-policy-gate",
	"code-review",
] as const;

/** Same-name check run found from a source that is not authoritative. */
export interface ReviewCheckSourceMismatch {
	checkName: string;
	expectedSource?: string | undefined;
}

/** Review check resolution plus diagnostic details for source-authority failures. */
export interface ReviewCheckResolution {
	checkResult: ReviewCheckResult;
	resolvedCheckName: string;
	sourceMismatch?: ReviewCheckSourceMismatch | undefined;
}

function resolveConstrainedCheckRun(
	checkRuns: CheckRun[],
	checkName: string,
	pullRequestHeadSha: string,
	sourceConstraint: RequiredCheckSourceConstraint | undefined,
): {
	checkResult: ReviewCheckResult;
	sourceMismatch?: ReviewCheckSourceMismatch | undefined;
} {
	const checkResult = findReviewCheckRun(checkRuns, checkName, {
		headSha: pullRequestHeadSha,
		...(sourceConstraint?.providerSlugs
			? { providerSlugs: sourceConstraint.providerSlugs }
			: {}),
		...(sourceConstraint?.sourceAppIds
			? { sourceAppIds: sourceConstraint.sourceAppIds }
			: {}),
	});
	if (checkResult.found || !sourceConstraint) {
		return { checkResult };
	}

	const unconstrainedCheckResult = findReviewCheckRun(checkRuns, checkName, {
		headSha: pullRequestHeadSha,
	});
	if (!unconstrainedCheckResult.found) {
		return { checkResult };
	}
	if (!hasCheckRunSourceMetadata(unconstrainedCheckResult.checkRun)) {
		return { checkResult: unconstrainedCheckResult };
	}

	return {
		checkResult,
		sourceMismatch: {
			checkName,
			expectedSource: describeExpectedSource(sourceConstraint),
		},
	};
}

/** Resolve the most authoritative review-gate check run for the requested check. */
export function resolveReviewCheckResult(
	checkRuns: CheckRun[],
	requestedCheckName: string,
	pullRequestHeadSha: string,
	requiredCheckSources?: Map<string, RequiredCheckSourceConstraint>,
): ReviewCheckResolution {
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

	let firstSourceMismatch: ReviewCheckSourceMismatch | undefined;
	for (const candidateCheckName of candidates) {
		const sourceConstraint = requiredCheckSources?.get(candidateCheckName);
		const { checkResult, sourceMismatch } = resolveConstrainedCheckRun(
			checkRuns,
			candidateCheckName,
			pullRequestHeadSha,
			sourceConstraint,
		);
		firstSourceMismatch ??= sourceMismatch;
		if (checkResult.found) {
			return {
				checkResult,
				resolvedCheckName: candidateCheckName,
			};
		}
	}

	const fallbackSourceConstraint =
		requiredCheckSources?.get(requestedCheckName);
	const {
		checkResult: fallbackCheckResult,
		sourceMismatch: fallbackSourceMismatch,
	} = resolveConstrainedCheckRun(
		checkRuns,
		requestedCheckName,
		pullRequestHeadSha,
		fallbackSourceConstraint,
	);

	return {
		checkResult: fallbackCheckResult,
		resolvedCheckName: requestedCheckName,
		sourceMismatch: firstSourceMismatch ?? fallbackSourceMismatch,
	};
}

/** Evaluate required check runs, aliases, and source-authority constraints. */
export function evaluateRequiredChecks(
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

/** Resolve the default review check from contract policy or the active provider manifest. */
export function resolveDefaultReviewCheckName(
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

/** Resolve the requested review check, honoring explicit CLI input first. */
export function resolveRequestedReviewCheckName(
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

/** Resolve required-check aliases from the active provider manifest. */
export function resolveRequiredCheckAliases(
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
