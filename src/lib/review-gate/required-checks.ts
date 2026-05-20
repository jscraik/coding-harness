import type { HarnessContract } from "../contract/types.js";
import { findReviewCheckRun } from "../github/check-run.js";
import type { CheckRun } from "../github/client.js";
import { loadNormalizedRequiredChecksManifest } from "./required-check-manifest.js";

export const DEFAULT_REVIEW_CHECK_NAME = "pr-pipeline";
export const LEGACY_REVIEW_CHECK_NAME_FALLBACKS = [
	"risk-policy-gate",
	"code-review",
] as const;

/** Required-check provider identity constraints from the active CI manifest. */
export interface RequiredCheckSourceConstraint {
	providerSlugs: Set<string>;
	sourceAppIds: Set<string>;
}

function normalizeConstraintSourceToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeSourceToken(
	value: string | number | undefined,
): string | undefined {
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value !== "string") {
		return undefined;
	}
	const normalized = normalizeConstraintSourceToken(value);
	return normalized.length > 0 ? normalized : undefined;
}

function matchesExpectedSource(
	run: CheckRun,
	constraint: RequiredCheckSourceConstraint | undefined,
): boolean {
	if (!constraint) {
		return true;
	}

	const appSlug = normalizeSourceToken(run.app?.slug);
	const appId = normalizeSourceToken(run.app?.id);
	const appName = normalizeSourceToken(run.app?.name);

	if (!appSlug && !appId && !appName) {
		return false;
	}
	return Boolean(
		(appSlug && constraint.providerSlugs.has(appSlug)) ||
			(appSlug && constraint.sourceAppIds.has(appSlug)) ||
			(appId && constraint.sourceAppIds.has(appId)) ||
			(appName && constraint.providerSlugs.has(appName)) ||
			(appName && constraint.sourceAppIds.has(appName)),
	);
}

function describeExpectedSource(
	constraint: RequiredCheckSourceConstraint | undefined,
): string | undefined {
	if (!constraint) {
		return undefined;
	}
	const expected = [
		...constraint.providerSlugs.values(),
		...constraint.sourceAppIds.values(),
	].filter((value, index, values) => values.indexOf(value) === index);
	return expected.length > 0 ? expected.join(", ") : undefined;
}

/** Resolve the most authoritative review-gate check run for the requested check. */
export function resolveReviewCheckResult(
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

/** Resolve source-authority constraints for required checks from the active provider manifest. */
export function resolveRequiredCheckSources(
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

		const normalizedSourceAppSlug = normalizeConstraintSourceToken(
			gate.sourceAppSlug,
		);
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
			if (normalizedSourceAppSlug.length > 0) {
				existing.providerSlugs.add(normalizedSourceAppSlug);
			}
			if (normalizedSourceAppId.length > 0) {
				existing.sourceAppIds.add(normalizedSourceAppId);
			}
			sources.set(key, existing);
		}
	}

	return sources;
}
