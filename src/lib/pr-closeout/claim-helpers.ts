import type { MissingContextClassification } from "../missing-context/classifier.js";
import { classifyMissingContext } from "../missing-context/classifier.js";
import type {
	PrCloseoutBlockerClassification,
	PrCloseoutCheckInput,
	PrCloseoutClaim,
	PrCloseoutClaimSource,
	PrCloseoutClaimStatus,
	PrCloseoutEvidenceFreshness,
	PrCloseoutInput,
} from "./types.js";

/** Return explicitly required checks, or all checks when callers cannot distinguish required status. */
export function requiredChecks(
	checks: readonly PrCloseoutCheckInput[],
): readonly PrCloseoutCheckInput[] {
	const explicitlyRequired = checks.filter((check) => check.required === true);
	return explicitlyRequired.length > 0 ? explicitlyRequired : checks;
}

/** Detect whether a check contributes test or quality evidence to closeout claims. */
export function isTestCheck(check: PrCloseoutCheckInput): boolean {
	return /\b(?:test|tests|vitest|jest|playwright|check|quality|pipeline)\b/iu.test(
		check.name,
	);
}

function normalizedSha(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/** Resolve the current PR head SHA from PR evidence, falling back to local branch evidence. */
export function currentHeadSha(input: PrCloseoutInput): string | null {
	return (
		normalizedSha(input.pullRequest.headSha) ??
		normalizedSha(input.branch?.headSha) ??
		null
	);
}

/** Classify whether one check result belongs to the current PR head SHA. */
export function checkFreshness(
	check: PrCloseoutCheckInput,
	headSha: string | null,
): PrCloseoutEvidenceFreshness {
	const checkSha = normalizedSha(check.headSha);
	if (!headSha || !checkSha) return "unknown";
	return checkSha === headSha ? "current" : "stale";
}

/** Report whether all required checks are tied to the current PR head SHA. */
export function requiredChecksAreCurrent(
	checks: readonly PrCloseoutCheckInput[],
	headSha: string | null,
): boolean {
	const required = requiredChecks(checks);
	return (
		headSha !== null &&
		required.length > 0 &&
		required.every((check) => checkFreshness(check, headSha) === "current")
	);
}

/** Build a stable evidence reference for a check result. */
export function evidenceRefFromCheck(check: PrCloseoutCheckInput): string {
	return check.url ?? `check:${check.name}`;
}

function claimBlockerClass(
	status: PrCloseoutClaimStatus,
): PrCloseoutBlockerClassification | null {
	if (status === "pass" || status === "not_applicable") return null;
	return status === "blocked" || status === "unknown"
		? "unknown"
		: "introduced";
}

function claimMissingContext(
	claim: PrCloseoutClaim["claim"],
	status: PrCloseoutClaimStatus,
	source: PrCloseoutClaimSource,
	freshness: PrCloseoutEvidenceFreshness,
): MissingContextClassification | null {
	if (status === "pass" || status === "not_applicable") return null;
	if (status === "fail" && freshness === "current") return null;
	return classifyMissingContext({
		surface: source,
		claim,
		problem:
			freshness === "stale"
				? "stale"
				: freshness === "missing"
					? "missing"
					: status === "blocked"
						? "blocked"
						: "unknown",
	});
}

/** Build one normalized closeout claim with blocker and missing-context metadata. */
export function buildClaim(
	claim: PrCloseoutClaim["claim"],
	status: PrCloseoutClaimStatus,
	source: PrCloseoutClaimSource,
	verifiedAt: string,
	options: {
		evidenceRef?: string | null;
		headSha?: string | null;
		freshness?: PrCloseoutEvidenceFreshness;
		blockerClass?: PrCloseoutBlockerClassification | null;
		missingContext?: MissingContextClassification | null;
	} = {},
): PrCloseoutClaim {
	const freshness =
		options.freshness ?? (status === "pass" ? "current" : "missing");
	return {
		claim,
		status,
		evidenceRef: options.evidenceRef ?? null,
		source,
		headSha: options.headSha ?? null,
		freshness,
		blockerClass:
			options.blockerClass === undefined
				? claimBlockerClass(status)
				: options.blockerClass,
		missingContext:
			options.missingContext === undefined
				? claimMissingContext(claim, status, source, freshness)
				: options.missingContext,
		verifiedAt,
	};
}
