import type {
	HarnessContract,
	NorthStarDecisionQuestionId,
	ProductSurfaceRegistry,
	SurfaceRegistration,
} from "./types.js";

const METRIC_ALIASES = [
	"pr_lead_time",
	"PR lead time",
	"pr lead time",
	"PR lead time from open to merge",
];

const PRIMARY_BOTTLENECK_ALIASES = [
	"review_rework_loop",
	"review or rework loop",
	"review/rework loop",
	"review and rework loop",
	"review and rework loop cost",
];

const MISSION_CLAUSES = [
	"humans steer and agents execute safely",
	"PR lead time as the primary north-star metric",
];

const AUTONOMY_BOUNDARY_CLAUSES = [
	"low and medium-risk autonomy should be automated",
	"high-risk changes remain human-mediated",
];

const SAFETY_FLOOR_CLAUSES = [
	"deterministic evidence",
	"current-head sha discipline",
	"bounded auto-remediation",
	"explicit rollback paths",
	"independent review",
];

export type NorthStarSurfaceKey =
	| "readme"
	| "north_star_doc"
	| "agent_first_status";

export interface NorthStarSurfaceInput {
	key: NorthStarSurfaceKey;
	path: string;
	content: string | undefined;
}

export interface NorthStarParityIssue {
	ruleId: string;
	path: string;
	message: string;
	severity: "error" | "warning";
}

export interface NorthStarReviewEvidenceResult {
	blockers: string[];
	failureClasses: string[];
	answeredQuestionIds: NorthStarDecisionQuestionId[];
}

function normalizeNarrativeValue(value: string): string {
	return value
		.toLowerCase()
		.replace(/[`*_]/g, " ")
		.replace(/[-/]/g, " ")
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function includesAnyAlias(content: string, aliases: string[]): boolean {
	const normalized = normalizeNarrativeValue(content);
	return aliases.some((alias) =>
		normalized.includes(normalizeNarrativeValue(alias)),
	);
}

function hasAllClauses(content: string, clauses: string[]): boolean {
	const normalized = normalizeNarrativeValue(content);
	return clauses.every((clause) =>
		normalized.includes(normalizeNarrativeValue(clause)),
	);
}

function includesSurfacePath(changedPath: string, ownedPath: string): boolean {
	const normalizedChangedPath = changedPath
		.replace(/\\/g, "/")
		.replace(/^\.\//, "");
	const normalizedOwnedPath = ownedPath
		.replace(/\\/g, "/")
		.replace(/^\.\//, "");
	if (normalizedChangedPath === normalizedOwnedPath) {
		return true;
	}
	return normalizedChangedPath.startsWith(`${normalizedOwnedPath}/`);
}

export function findMatchingProductSurfaces(
	registry: ProductSurfaceRegistry | undefined,
	changedFiles: string[],
): SurfaceRegistration[] {
	if (!registry || changedFiles.length === 0) {
		return [];
	}

	return registry.surfaces.filter((surface) =>
		surface.ownedPaths.some((ownedPath) =>
			changedFiles.some((changedFile) =>
				includesSurfacePath(changedFile, ownedPath),
			),
		),
	);
}

export function evaluateNorthStarSurfaceParity(
	contract: HarnessContract | undefined,
	surfaces: NorthStarSurfaceInput[],
): NorthStarParityIssue[] {
	if (!contract?.northStar) {
		return [];
	}

	const issues: NorthStarParityIssue[] = [];
	for (const surface of surfaces) {
		if (!surface.content) {
			continue;
		}

		const missingMetric = !includesAnyAlias(surface.content, METRIC_ALIASES);
		const missingBottleneck = !includesAnyAlias(
			surface.content,
			PRIMARY_BOTTLENECK_ALIASES,
		);

		if (surface.key === "north_star_doc") {
			if (
				missingMetric ||
				missingBottleneck ||
				!hasAllClauses(surface.content, MISSION_CLAUSES) ||
				!hasAllClauses(surface.content, AUTONOMY_BOUNDARY_CLAUSES) ||
				!hasAllClauses(surface.content, SAFETY_FLOOR_CLAUSES)
			) {
				issues.push({
					ruleId: "status.north_star.contract_parity.north_star_doc",
					path: surface.path,
					message:
						"North-star roadmap doc does not preserve the canonical mission, metric, bottleneck, autonomy boundary, and safety-floor clauses from harness.contract.json.",
					severity: "error",
				});
			}
			continue;
		}

		if (
			surface.key === "readme" &&
			(missingMetric ||
				missingBottleneck ||
				!hasAllClauses(surface.content, MISSION_CLAUSES))
		) {
			issues.push({
				ruleId: "status.north_star.contract_parity.readme",
				path: surface.path,
				message:
					"README no longer reflects the canonical north-star mission, metric, and bottleneck from harness.contract.json.",
				severity: "warning",
			});
		}

		if (
			surface.key === "agent_first_status" &&
			(missingMetric || missingBottleneck)
		) {
			issues.push({
				ruleId: "status.north_star.contract_parity.agent_first_status",
				path: surface.path,
				message:
					"Agent-first status matrix is missing the canonical PR lead-time metric or review/rework bottleneck framing.",
				severity: "warning",
			});
		}
	}

	return issues;
}

function parseDecisionQuestionLine(
	body: string,
	questionId: NorthStarDecisionQuestionId,
): { answer: string; evidence: string } | undefined {
	const pattern = new RegExp(
		`(?:^|\\n)-\\s*\`?${questionId}\`?\\s*:\\s*(yes|no)\\.?\\s*(?:Evidence:\\s*([^\\n]+))?`,
		"i",
	);
	const match = body.match(pattern);
	if (!match) {
		return undefined;
	}
	return {
		answer: (match[1] ?? "").trim().toLowerCase(),
		evidence: (match[2] ?? "").trim(),
	};
}

export function evaluateNorthStarReviewEvidence(
	contract: HarnessContract | undefined,
	prBody: string | null | undefined,
	changedFiles: string[],
): NorthStarReviewEvidenceResult {
	if (!contract?.northStar) {
		return {
			blockers: [],
			failureClasses: [],
			answeredQuestionIds: [],
		};
	}

	const matchedSurfaces = findMatchingProductSurfaces(
		contract.productSurface,
		changedFiles,
	);
	if (matchedSurfaces.length === 0) {
		return {
			blockers: [],
			failureClasses: [],
			answeredQuestionIds: [],
		};
	}

	const normalizedBody = prBody?.trim() ?? "";
	const blockers: string[] = [];
	const failureClasses = new Set<string>();
	const answeredQuestionIds: NorthStarDecisionQuestionId[] = [];

	if (normalizedBody.length === 0) {
		for (const question of contract.northStar.decisionQuestions) {
			blockers.push(
				`review_evidence_incomplete: missing ${question.id} decision evidence in PR body`,
			);
			failureClasses.add("review_evidence_incomplete");
		}
		return {
			blockers,
			failureClasses: [...failureClasses],
			answeredQuestionIds,
		};
	}

	for (const question of contract.northStar.decisionQuestions) {
		const parsed = parseDecisionQuestionLine(normalizedBody, question.id);
		if (!parsed) {
			blockers.push(
				`review_evidence_incomplete: missing ${question.id} decision evidence in PR body`,
			);
			failureClasses.add("review_evidence_incomplete");
			continue;
		}

		answeredQuestionIds.push(question.id);
		if (parsed.answer !== "yes") {
			blockers.push(
				`review_evidence_contradiction: ${question.id} must be answered yes for governed north-star surfaces`,
			);
			failureClasses.add("review_evidence_contradiction");
		}
		if (parsed.evidence.length === 0) {
			blockers.push(
				`review_evidence_incomplete: ${question.id} is missing an Evidence: reference`,
			);
			failureClasses.add("review_evidence_incomplete");
		}
	}

	return {
		blockers,
		failureClasses: [...failureClasses],
		answeredQuestionIds,
	};
}
