import type { DetectionResult } from "../project-type/types.js";
import type { InitOptions } from "./types.js";

/** Profile selected for a normal init dry-run plan. */
export type InitDryRunProfile = "minimal" | "standard";

/** Risk level assigned to a dry-run plan from planned write breadth. */
export type InitDryRunRiskLevel = "low" | "medium" | "high";

/** Advisory plan metadata emitted for normal init dry-runs. */
export interface InitDryRunPlan {
	profile: InitDryRunProfile;
	riskScore: number;
	riskLevel: InitDryRunRiskLevel;
	plannedCreates: number;
	plannedSkips: number;
	recommendation: string;
}

/** Classify a numeric dry-run risk score into the public risk level. */
function dryRunRiskLevel(riskScore: number): InitDryRunPlan["riskLevel"] {
	if (riskScore >= 70) return "high";
	if (riskScore >= 35) return "medium";
	return "low";
}

/** Return operator guidance for the computed dry-run risk level and profile. */
function dryRunRecommendation(
	riskLevel: InitDryRunPlan["riskLevel"],
	options: InitOptions,
): string {
	if (riskLevel === "high" && !options.minimal) {
		return "Review planned files before applying; consider harness init --dry-run --minimal or harness upgrade --dry-run for existing repos.";
	}
	if (riskLevel === "high") {
		return "Review planned files before applying; minimal profile still has a broad planned write set.";
	}
	if (riskLevel === "medium") {
		return "Review planned files before applying; prefer the smallest profile that covers your goal.";
	}
	return "Review the resulting diff after apply before committing.";
}

/** Build advisory metadata for normal init dry-runs from planned file counts. */
export function buildDryRunPlan(
	created: string[],
	skipped: string[],
	options: InitOptions,
	detectionResult: DetectionResult,
): InitDryRunPlan {
	let riskScore = Math.min(60, Math.ceil(created.length / 2));
	if (created.length >= 75) riskScore += 20;
	else if (created.length >= 40) riskScore += 10;
	if (created.length > 0 && skipped.length === 0) riskScore += 15;
	if (detectionResult.projectType === "unknown") riskScore += 10;
	if (!options.minimal && created.length >= 40) riskScore += 10;
	riskScore = Math.min(100, riskScore);

	const riskLevel = dryRunRiskLevel(riskScore);
	return {
		profile: options.minimal ? "minimal" : "standard",
		riskScore,
		riskLevel,
		plannedCreates: created.length,
		plannedSkips: skipped.length,
		recommendation: dryRunRecommendation(riskLevel, options),
	};
}
