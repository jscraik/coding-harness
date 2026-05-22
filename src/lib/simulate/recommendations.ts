import type {
	ConfidenceAssessment,
	DataQualityAssessment,
	DecisionDelta,
	DeltaSummary,
	SimulationFlag,
	SimulationMetrics,
	SimulationRecommendation,
} from "./types.js";

/**
 * Generate advisory recommendations from simulation metric signals.
 */
export function generateRecommendations(
	metrics: SimulationMetrics,
	deltas: { summary: DeltaSummary; topDeltas: DecisionDelta[] },
	confidence: ConfidenceAssessment,
): SimulationRecommendation[] {
	const recs: SimulationRecommendation[] = [];

	if (confidence.level === "insufficient-data") {
		recs.push({
			id: "rec-insufficient-data",
			severity: "high",
			category: "evidence",
			title: "Insufficient data for reliable simulation",
			rationale: `Only ${confidence.dataQuality.effectiveSampleSize} effective sample(s) found. Results are not statistically meaningful.`,
			suggestion:
				"Run at least 20 remediation cycles against the baseline contract before comparing.",
			relatedMetrics: ["effectiveSampleSize", "traceCoverage"],
			confidence: "high",
		});
	}

	if (metrics.falseBlockRate.delta > 0.05) {
		recs.push({
			id: "rec-high-false-block-rate",
			severity: "high",
			category: "policy",
			title: "Candidate policy increases false block rate",
			rationale: `False block rate increased by ${(metrics.falseBlockRate.delta * 100).toFixed(1)}% (${(metrics.falseBlockRate.baseline * 100).toFixed(1)}% -> ${(metrics.falseBlockRate.candidate * 100).toFixed(1)}%). This may increase developer friction without proportional risk reduction.`,
			suggestion:
				"Review risk-tier thresholds in the candidate contract. Consider raising autoApplyMaxTier or adjusting pattern specificity.",
			relatedMetrics: ["falseBlockRate"],
			confidence: confidence.level === "high" ? "high" : "medium",
		});
	}

	if (metrics.leadTimeDelta.delta > 0.5) {
		recs.push({
			id: "rec-lead-time-regression",
			severity: "medium",
			category: "workflow",
			title: "Candidate policy increases average lead time",
			rationale: `Average run duration increased by ${metrics.leadTimeDelta.delta.toFixed(2)}h under the candidate contract.`,
			suggestion:
				"Check if new required checks or stricter timeoutAction settings are causing slowdowns.",
			relatedMetrics: ["leadTimeDelta"],
			confidence: "medium",
		});
	}

	if (metrics.leadTimeDelta.delta < -0.5) {
		recs.push({
			id: "rec-lead-time-improvement",
			severity: "info",
			category: "workflow",
			title: "Candidate policy reduces average lead time",
			rationale: `Average run duration decreased by ${Math.abs(metrics.leadTimeDelta.delta).toFixed(2)}h. This is a positive throughput signal.`,
			suggestion:
				"Confirm improvement is not due to fewer checks being enforced (verify requiredChecks coverage).",
			relatedMetrics: ["leadTimeDelta"],
			confidence: "medium",
		});
	}

	if (metrics.rollbackPressureDelta.delta > 0.1) {
		recs.push({
			id: "rec-rollback-pressure",
			severity: "critical",
			category: "policy",
			title: "Candidate policy increases rollback pressure",
			rationale: `Rollback rate increased by ${(metrics.rollbackPressureDelta.delta * 100).toFixed(1)}% (${(metrics.rollbackPressureDelta.baseline * 100).toFixed(1)}% -> ${(metrics.rollbackPressureDelta.candidate * 100).toFixed(1)}%). This suggests the candidate policy creates unsafe conditions that trigger auto-rollback.`,
			suggestion:
				"Do not promote the candidate contract until rollback triggers are fully investigated.",
			relatedMetrics: ["rollbackPressureDelta"],
			confidence: "high",
		});
	}

	if (deltas.summary.total > 0) {
		const changeRate =
			(deltas.summary.blockedToAllowed + deltas.summary.allowedToBlocked) /
			deltas.summary.total;
		if (changeRate > 0.3) {
			recs.push({
				id: "rec-high-delta-churn",
				severity: "medium",
				category: "threshold",
				title: "High decision churn between baseline and candidate",
				rationale: `${(changeRate * 100).toFixed(0)}% of evaluated decisions changed outcome (${deltas.summary.blockedToAllowed} blocked->allowed, ${deltas.summary.allowedToBlocked} allowed->blocked). Large-scale changes increase deployment risk.`,
				suggestion:
					"Consider a staged rollout: apply the candidate to a subset of repos first and monitor for regressions.",
				relatedMetrics: ["blockedToAllowed", "allowedToBlocked"],
				confidence: "medium",
			});
		}
	}

	if (metrics.preventedRisk.delta > 0.05) {
		recs.push({
			id: "rec-prevented-risk-improvement",
			severity: "info",
			category: "policy",
			title: "Candidate policy prevents more risk",
			rationale: `Remediation success rate increased by ${(metrics.preventedRisk.delta * 100).toFixed(1)}% under the candidate contract. This is a positive safety signal.`,
			suggestion:
				"Verify improvements are not coming from reduced enforcement scope (confirm requiredChecks coverage).",
			relatedMetrics: ["preventedRisk"],
			confidence: confidence.level === "high" ? "high" : "medium",
		});
	}

	return recs;
}

/**
 * Determine simulation flags from data quality and metric shifts.
 */
export function determineFlags(
	dataQuality: DataQualityAssessment,
	metrics: SimulationMetrics,
): SimulationFlag[] {
	const flags: SimulationFlag[] = [];

	if (dataQuality.sampleSize === "insufficient") {
		flags.push("insufficient_data");
	}
	if (dataQuality.traceCoverage < 50) {
		flags.push("partial_coverage");
	}
	if (metrics.falseBlockRate.delta > 0.1) {
		flags.push("high_false_block_risk");
	}
	if (Math.abs(metrics.leadTimeDelta.delta) > 2) {
		flags.push("significant_lead_time_impact");
	}

	return flags;
}
