export type RiskTier = "high" | "medium" | "low";

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
}

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.0",
	riskTierRules: {},
};
