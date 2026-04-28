import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import type { HarnessContract, PolicyAction } from "../lib/contract/types.js";
import {
	resolveGateVerdict,
	resolvePolicyChain,
} from "../lib/policy/policy-chain.js";
import {
	CONFIDENCE_SCORES,
	type ConfidenceAssessment,
	type DataQualityAssessment,
	type DecisionDelta,
	type DeltaSummary,
	type DeltaType,
	type MetricDelta,
	SIMULATION_LIMITS,
	type SimulationFlag,
	type SimulationMetrics,
	type SimulationRecommendation,
} from "../lib/simulate/types.js";

type ResolvedPolicyChain = ReturnType<typeof resolvePolicyChain>;

interface AgentRunManifest {
	schemaVersion: string;
	runId: string;
	command: string;
	startedAt: string;
	finishedAt?: string;
	durationMs?: number;
	contract?: { hash?: string };
	outcome: string;
	exit?: { code?: number; classification?: string };
}

interface AgentRunEvent {
	schemaVersion: string;
	eventType: string;
	status: string;
	payload?: {
		outcome?: string;
		exitCode?: number;
		effectiveMode?: string;
		findingsProcessed?: number;
	};
}

/**
 * Compute deterministic hash of a contract.
 */
export function computeContractHash(contract: HarnessContract): string {
	const content = JSON.stringify(contract, Object.keys(contract).sort());
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Read all agent-run manifests from an artifacts directory.
 * Bounded by SIMULATION_LIMITS.maxArtifactCount.
 */
export function readArtifactManifests(artifactsDir: string): {
	manifests: AgentRunManifest[];
	fileCount: number;
} {
	if (!existsSync(artifactsDir)) return { manifests: [], fileCount: 0 };

	let fileCount = 0;
	const manifests: AgentRunManifest[] = [];

	try {
		const entries = readdirSync(artifactsDir, { withFileTypes: true });
		for (const entry of entries) {
			if (manifests.length >= SIMULATION_LIMITS.maxArtifactCount) break;
			if (!entry.isDirectory()) continue;

			const manifestPath = join(artifactsDir, entry.name, "manifest.json");
			if (!existsSync(manifestPath)) continue;

			try {
				const stat = statSync(manifestPath);
				if (stat.size > SIMULATION_LIMITS.maxArtifactSizeMB * 1024 * 1024) {
					continue;
				}
				const raw = readFileSync(manifestPath, "utf-8");
				const parsed = JSON.parse(raw) as AgentRunManifest;
				if (parsed.schemaVersion?.startsWith("agent-run-manifest/")) {
					manifests.push(parsed);
				}
				fileCount++;
			} catch {
				// skip malformed manifests
			}
		}
	} catch {
		// directory read error — return empty
	}

	return { manifests, fileCount };
}

/**
 * Read trace files from the traces directory.
 * Returns count of valid trace files found.
 */
export function readTraceFiles(tracesDir: string): {
	traceCount: number;
	legacyCount: number;
} {
	if (!existsSync(tracesDir)) return { traceCount: 0, legacyCount: 0 };

	let traceCount = 0;
	let legacyCount = 0;

	try {
		const entries = readdirSync(tracesDir, { recursive: false });
		for (const entry of entries) {
			if (traceCount >= SIMULATION_LIMITS.maxTraceCount) break;
			const name = typeof entry === "string" ? entry : entry.toString();
			if (!name.endsWith(".json") && !name.endsWith(".jsonl")) continue;
			try {
				const stat = statSync(join(tracesDir, name));
				if (stat.size > SIMULATION_LIMITS.maxTraceSizeMB * 1024 * 1024) {
					continue;
				}
				if (name.includes("-legacy-") || name.includes("_v0")) {
					legacyCount++;
				}
				traceCount++;
			} catch {
				// skip
			}
		}
	} catch {
		// directory read error
	}

	return { traceCount, legacyCount };
}

/**
 * Assess data quality from available artifact manifests and trace files.
 * Reads actual files from disk; bounded by SIMULATION_LIMITS.
 */
export function assessDataQuality(
	contractA: HarnessContract,
	_contractB: HarnessContract,
	artifactsDirOverride: string | undefined,
	tracesDirOverride: string | undefined,
): DataQualityAssessment {
	const artifactsDir = artifactsDirOverride
		? resolve(artifactsDirOverride)
		: resolve("./artifacts/agent-runs");
	const tracesDir = tracesDirOverride
		? resolve(tracesDirOverride)
		: resolve("./.traces");

	const { manifests, fileCount } = readArtifactManifests(artifactsDir);
	const { traceCount } = readTraceFiles(tracesDir);

	const baselineHash = computeContractHash(contractA);
	const matchingManifests = manifests.filter(
		(m) => m.contract?.hash === baselineHash,
	);
	const effectiveSampleSize = matchingManifests.length || manifests.length;

	const withEvents = manifests.filter((m) =>
		existsSync(join(artifactsDir, m.runId, "events.jsonl")),
	).length;
	const artifactCompleteness =
		manifests.length > 0
			? Math.round((withEvents / manifests.length) * 100)
			: 0;

	const traceCoverage =
		fileCount > 0
			? Math.min(100, Math.round((traceCount / fileCount) * 100))
			: traceCount > 0
				? 100
				: 0;

	let sampleSize: "adequate" | "marginal" | "insufficient";
	if (effectiveSampleSize >= 20) {
		sampleSize = "adequate";
	} else if (effectiveSampleSize >= 5) {
		sampleSize = "marginal";
	} else {
		sampleSize = "insufficient";
	}

	return {
		sampleSize,
		traceCoverage,
		artifactCompleteness,
		effectiveSampleSize,
	};
}

/**
 * Build MetricDelta from two counts with safe percent-change.
 */
function buildMetricDelta(
	baseline: number,
	candidate: number,
	ciHalfWidth?: number,
): MetricDelta {
	const delta = candidate - baseline;
	const percentChange =
		baseline !== 0 ? (delta / baseline) * 100 : candidate !== 0 ? 100 : 0;
	return {
		baseline,
		candidate,
		delta,
		percentChange,
		...(ciHalfWidth !== undefined ? { ciHalfWidth } : {}),
	};
}

/**
 * Compute simulation metrics comparing baseline vs candidate contract hashes
 * against the actual event log in the artifacts directory.
 */
export function computeMetrics(
	contractA: HarnessContract,
	contractB: HarnessContract,
	dataQuality: DataQualityAssessment,
): SimulationMetrics {
	const zeroDelta = buildMetricDelta(0, 0);

	if (dataQuality.sampleSize === "insufficient") {
		return {
			preventedRisk: zeroDelta,
			falseBlockRate: zeroDelta,
			leadTimeDelta: zeroDelta,
			rollbackPressureDelta: zeroDelta,
		};
	}

	const artifactsDir = resolve("./artifacts/agent-runs");
	const { manifests } = readArtifactManifests(artifactsDir);
	if (manifests.length === 0) {
		return {
			preventedRisk: zeroDelta,
			falseBlockRate: zeroDelta,
			leadTimeDelta: zeroDelta,
			rollbackPressureDelta: zeroDelta,
		};
	}

	const hashA = computeContractHash(contractA);
	const hashB = computeContractHash(contractB);

	const manifestsA = manifests.filter((m) => m.contract?.hash === hashA);
	const manifestsB = manifests.filter((m) => m.contract?.hash === hashB);
	const baselineSet =
		manifestsA.length > 0
			? manifestsA
			: manifests.slice(0, Math.ceil(manifests.length / 2));
	const candidateSet =
		manifestsB.length > 0
			? manifestsB
			: manifests.slice(Math.ceil(manifests.length / 2));

	const baselineStats = computeOutcomeStats(baselineSet);
	const candidateStats = computeOutcomeStats(candidateSet);

	const baselinePreventedRisk =
		baselineStats.total > 0
			? baselineStats.remediateSuccess / baselineStats.total
			: 0;
	const candidatePreventedRisk =
		candidateStats.total > 0
			? candidateStats.remediateSuccess / candidateStats.total
			: 0;

	const baselineFalseBlock =
		baselineStats.total > 0
			? baselineStats.unexpectedFailures / baselineStats.total
			: 0;
	const candidateFalseBlock =
		candidateStats.total > 0
			? candidateStats.unexpectedFailures / candidateStats.total
			: 0;

	const baselineLeadTime = baselineStats.avgDurationMs / 3600000;
	const candidateLeadTime = candidateStats.avgDurationMs / 3600000;

	const baselineRollback =
		baselineStats.total > 0
			? baselineStats.rollbackCount / baselineStats.total
			: 0;
	const candidateRollback =
		candidateStats.total > 0
			? candidateStats.rollbackCount / candidateStats.total
			: 0;

	const n = Math.max(dataQuality.effectiveSampleSize, 1);
	const ciHW = 1 / Math.sqrt(n);

	return {
		preventedRisk: buildMetricDelta(
			baselinePreventedRisk,
			candidatePreventedRisk,
			ciHW,
		),
		falseBlockRate: buildMetricDelta(
			baselineFalseBlock,
			candidateFalseBlock,
			ciHW,
		),
		leadTimeDelta: buildMetricDelta(baselineLeadTime, candidateLeadTime, ciHW),
		rollbackPressureDelta: buildMetricDelta(
			baselineRollback,
			candidateRollback,
			ciHW,
		),
	};
}

interface OutcomeStats {
	total: number;
	remediateSuccess: number;
	unexpectedFailures: number;
	rollbackCount: number;
	avgDurationMs: number;
}

function computeOutcomeStats(manifests: AgentRunManifest[]): OutcomeStats {
	let remediateSuccess = 0;
	let unexpectedFailures = 0;
	let rollbackCount = 0;
	let totalDurationMs = 0;

	for (const m of manifests) {
		const isRollback =
			m.command?.includes("rollback") || m.runId?.includes("rollback");
		const isRemediate = m.command === "remediate";
		const isSuccess = m.outcome === "success";
		const isFailure = m.outcome === "failed";

		if (isRollback) rollbackCount++;
		if (isRemediate && isSuccess) remediateSuccess++;
		if (isFailure && !isRollback) unexpectedFailures++;
		totalDurationMs += m.durationMs ?? 0;
	}

	return {
		total: manifests.length,
		remediateSuccess,
		unexpectedFailures,
		rollbackCount,
		avgDurationMs:
			manifests.length > 0 ? totalDurationMs / manifests.length : 0,
	};
}

/**
 * Read JSONL events for a single run directory.
 * Bounded by SIMULATION_LIMITS.maxEventCount.
 */
function readRunEvents(
	artifactsDir: string,
	runId: string,
	total: { count: number },
): AgentRunEvent[] {
	const eventsPath = join(artifactsDir, runId, "events.jsonl");
	if (!existsSync(eventsPath)) return [];

	try {
		const stat = statSync(eventsPath);
		if (stat.size > SIMULATION_LIMITS.maxArtifactSizeMB * 1024 * 1024) {
			return [];
		}
		const lines = readFileSync(eventsPath, "utf-8").split("\n");
		const events: AgentRunEvent[] = [];
		for (const line of lines) {
			if (total.count >= SIMULATION_LIMITS.maxEventCount) break;
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				events.push(JSON.parse(trimmed) as AgentRunEvent);
				total.count++;
			} catch {
				// skip malformed lines
			}
		}
		return events;
	} catch {
		return [];
	}
}

function mapOutcomeToAction(outcome: string | undefined): PolicyAction {
	if (!outcome) return "warn";
	if (outcome === "success" || outcome === "ok") return "allow";
	if (
		outcome === "failed" ||
		outcome === "error" ||
		outcome === "validation_failed"
	) {
		return "block";
	}
	return "warn";
}

function mapStatusToConfidence(status: string | undefined): number {
	if (status === "completed") return 0.9;
	if (status === "failed") return 0.3;
	if (status === "skipped") return 0.5;
	return 0.6;
}

function classifyDecisionDelta(
	evt: AgentRunEvent,
	matchingCandidate: AgentRunManifest | undefined,
	baselinePolicyChain: ResolvedPolicyChain,
	candidatePolicyChain: ResolvedPolicyChain,
	eventIndex: number,
): { delta: DecisionDelta; deltaType: DeltaType } {
	const baselineAction = mapOutcomeToAction(evt.payload?.outcome);
	const baselineVerdict = resolveGateVerdict(
		baselineAction,
		baselinePolicyChain,
	);
	const baselineConfidence = mapStatusToConfidence(evt.status);

	let candidateAction: PolicyAction = baselineAction;
	let candidateVerdict = resolveGateVerdict(
		candidateAction,
		candidatePolicyChain,
	);
	let candidateConfidence = baselineConfidence;

	if (matchingCandidate) {
		candidateAction = mapOutcomeToAction(matchingCandidate.outcome);
		candidateVerdict = resolveGateVerdict(
			candidateAction,
			candidatePolicyChain,
		);
		candidateConfidence = matchingCandidate.outcome === "success" ? 0.9 : 0.5;
	}

	const changed = candidateAction !== baselineAction;
	let deltaType: DeltaType = "none";

	if (changed) {
		if (baselineAction === "block" && candidateAction !== "block") {
			deltaType = "blocked_to_allowed";
		} else if (baselineAction !== "block" && candidateAction === "block") {
			deltaType = "allowed_to_blocked";
		}
	} else if (Math.abs(candidateConfidence - baselineConfidence) > 0.1) {
		deltaType = "confidence_change";
	}

	const delta: DecisionDelta = {
		eventIndex,
		baseline: {
			action: baselineAction,
			verdict: baselineVerdict,
			reason: `baseline outcome: ${evt.payload?.outcome ?? evt.status}`,
			confidence: baselineConfidence,
			traceEventIndex: eventIndex,
		},
		candidate: {
			action: candidateAction,
			verdict: candidateVerdict,
			reason: matchingCandidate
				? `candidate outcome: ${matchingCandidate.outcome}`
				: "no matching candidate run",
			confidence: candidateConfidence,
			traceEventIndex: eventIndex,
		},
		changed,
		deltaType,
	};

	return { delta, deltaType };
}

/**
 * Compute decision deltas between baseline and candidate contracts.
 */
export function computeDeltas(
	contractA: HarnessContract,
	contractB: HarnessContract,
): { summary: DeltaSummary; topDeltas: DecisionDelta[] } {
	const artifactsDir = resolve("./artifacts/agent-runs");
	const { manifests } = readArtifactManifests(artifactsDir);

	if (manifests.length === 0) {
		return {
			summary: {
				total: 0,
				blockedToAllowed: 0,
				allowedToBlocked: 0,
				confidenceChanges: 0,
				unchanged: 0,
			},
			topDeltas: [],
		};
	}

	const hashA = computeContractHash(contractA);
	const candidateManifests = manifests.filter(
		(m) => m.contract?.hash !== hashA,
	);
	const baselineManifests = manifests.filter((m) => m.contract?.hash === hashA);

	const usingBaseline =
		baselineManifests.length > 0 ? baselineManifests : manifests;
	const usingCandidate =
		candidateManifests.length > 0 ? candidateManifests : [];

	const eventsTotal = { count: 0 };
	const topDeltas: DecisionDelta[] = [];

	let blockedToAllowed = 0;
	let allowedToBlocked = 0;
	let confidenceChanges = 0;
	let unchanged = 0;
	let eventIndex = 0;
	const baselinePolicyChain = resolvePolicyChain(contractA);
	const candidatePolicyChain = resolvePolicyChain(contractB);

	for (const manifest of usingBaseline) {
		const baselineEvents = readRunEvents(
			artifactsDir,
			manifest.runId,
			eventsTotal,
		);
		const matchingCandidate = usingCandidate.find(
			(m) => m.command === manifest.command,
		);

		for (const evt of baselineEvents) {
			if (evt.eventType !== "decision") continue;
			const { delta, deltaType } = classifyDecisionDelta(
				evt,
				matchingCandidate,
				baselinePolicyChain,
				candidatePolicyChain,
				eventIndex,
			);
			if (deltaType === "blocked_to_allowed") blockedToAllowed++;
			else if (deltaType === "allowed_to_blocked") allowedToBlocked++;
			else if (deltaType === "confidence_change") confidenceChanges++;
			else unchanged++;
			if (delta.changed && topDeltas.length < 5) {
				topDeltas.push(delta);
			}
			eventIndex++;
		}
	}

	return {
		summary: {
			total: eventIndex,
			blockedToAllowed,
			allowedToBlocked,
			confidenceChanges,
			unchanged,
		},
		topDeltas,
	};
}

/**
 * Compute confidence assessment from data quality.
 */
export function computeConfidence(
	dataQuality: DataQualityAssessment,
): ConfidenceAssessment {
	let level: ConfidenceAssessment["level"] = "insufficient-data";
	const rationale: string[] = [];

	if (
		dataQuality.effectiveSampleSize >= 20 &&
		dataQuality.traceCoverage >= 80
	) {
		level = "high";
		rationale.push("Adequate sample size with good trace coverage");
	} else if (
		dataQuality.effectiveSampleSize >= 10 &&
		dataQuality.traceCoverage >= 50
	) {
		level = "medium";
		rationale.push("Marginal sample size or partial trace coverage");
	} else if (dataQuality.effectiveSampleSize >= 5) {
		level = "low";
		rationale.push("Limited sample size or poor trace coverage");
	} else {
		level = "insufficient-data";
		rationale.push("Insufficient data for reliable simulation");
	}

	return {
		level,
		score: CONFIDENCE_SCORES[level],
		rationale,
		dataQuality,
	};
}

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
