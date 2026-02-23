export type RiskTier = "high" | "medium" | "low";

export type TimeoutAction = "fail" | "warn";

export interface ReviewPolicy {
	timeoutSeconds: number;
	timeoutAction: TimeoutAction;
}

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
	reviewPolicy?: ReviewPolicy | undefined;
}

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
	timeoutSeconds: 600, // 10 minutes
	timeoutAction: "fail",
};

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.0",
	riskTierRules: {},
	reviewPolicy: DEFAULT_REVIEW_POLICY,
};
