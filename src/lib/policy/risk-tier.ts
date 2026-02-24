import picomatch from "picomatch";
import type { HarnessContract, RiskTier } from "../contract/types.js";

interface Rule {
	pattern: string;
	tier: RiskTier;
	matcher: (input: string) => boolean;
}

/**
 * Score glob pattern specificity.
 * Higher score means more specific and therefore higher precedence.
 */
function patternSpecificity(pattern: string): number {
	const segments = pattern.split("/").filter((s) => s.length > 0);
	const literalSegments = segments.filter((segment) => !segment.includes("*"));
	const wildcardCount = (pattern.match(/\*/g) ?? []).length;
	const literalLength = pattern.replace(/\*/g, "").length;

	let score = 0;
	score += literalSegments.length * 100;
	score += segments.length * 10;
	score += literalLength;

	if (!pattern.includes("**")) {
		score += 30;
	}
	if (!pattern.includes("*")) {
		score += 200;
	}
	if (pattern.startsWith("**")) {
		score -= 100;
	}

	score -= wildcardCount * 10;
	return score;
}

/**
 * Create a risk-tier resolver with pre-compiled matchers.
 */
export function createResolver(
	rules: Record<string, RiskTier>,
): (file: string) => RiskTier {
	// Pre-compile and sort by specificity (most specific first)
	const compiled: Rule[] = Object.entries(rules)
		.map(([pattern, tier]) => ({
			pattern,
			tier,
			matcher: picomatch(pattern),
		}))
		.sort((a, b) => {
			const specificityDiff =
				patternSpecificity(b.pattern) - patternSpecificity(a.pattern);
			if (specificityDiff !== 0) {
				return specificityDiff;
			}
			return b.pattern.length - a.pattern.length;
		});

	return (filePath: string): RiskTier => {
		for (const rule of compiled) {
			if (rule.matcher(filePath)) {
				return rule.tier;
			}
		}
		return "medium"; // Default tier
	};
}

/**
 * Resolve the overall risk tier for a set of changed files.
 * Returns the highest tier across all files.
 */
export function resolveOverallTier(
	files: string[],
	contract: HarnessContract,
): RiskTier {
	const resolve = createResolver(contract.riskTierRules);
	const tiers: RiskTier[] = ["high", "medium", "low"];
	const fileTiers = files.map(resolve);

	for (const tier of tiers) {
		if (fileTiers.includes(tier)) {
			return tier;
		}
	}

	return "medium";
}
