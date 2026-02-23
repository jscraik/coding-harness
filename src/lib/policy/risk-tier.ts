import picomatch from "picomatch";
import type { HarnessContract, RiskTier } from "../contract/types.js";

interface Rule {
	pattern: string;
	tier: RiskTier;
	matcher: (input: string) => boolean;
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
		.sort((a, b) => b.pattern.length - a.pattern.length);

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
