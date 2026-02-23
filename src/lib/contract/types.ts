export type RiskTier = "high" | "medium" | "low";

export type TimeoutAction = "fail" | "warn";

export type ImageFormat = "png" | "jpeg";

export interface ReviewPolicy {
	timeoutSeconds: number;
	timeoutAction: TimeoutAction;
}

/**
 * Evidence policy configuration for requiring evidence files.
 */
export interface EvidencePolicy {
	/** Glob patterns for paths requiring evidence */
	requiredFor: string[];
	/** Allowed image formats for evidence */
	allowedTypes: ImageFormat[];
	/** Maximum file size in bytes (optional, defaults to 1MB) */
	maxFileSizeBytes?: number | undefined;
}

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
	reviewPolicy?: ReviewPolicy | undefined;
	/** Evidence policy for requiring verification artifacts */
	evidencePolicy?: EvidencePolicy | undefined;
}

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
	timeoutSeconds: 600, // 10 minutes
	timeoutAction: "fail",
};

export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
	requiredFor: [],
	allowedTypes: ["png", "jpeg"],
	maxFileSizeBytes: 1024 * 1024, // 1MB
};

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.0",
	riskTierRules: {},
	reviewPolicy: DEFAULT_REVIEW_POLICY,
	evidencePolicy: DEFAULT_EVIDENCE_POLICY,
};
