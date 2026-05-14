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
	"solo developer with limited cognitive bandwidth",
	"agentic software work to professional standards",
	"compact orientation",
	"executable guardrails",
	"durable memory",
	"evidence-based handoff",
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

/** Canonical north-star surface keys used for parity checking. */
export type NorthStarSurfaceKey =
	| "readme"
	| "north_star_doc"
	| "agent_first_status";

/** Input describing a single north-star surface to evaluate. */
export interface NorthStarSurfaceInput {
	key: NorthStarSurfaceKey;
	path: string;
	content: string | undefined;
}

/** A parity issue detected between a surface and the contract. */
export interface NorthStarParityIssue {
	ruleId: string;
	path: string;
	message: string;
	severity: "error" | "warning";
	failureClass?: string;
}

/** Result of evaluating north-star review evidence in a PR body. */
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

/** Find product surfaces that match the given changed file paths. */
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

/** Evaluate whether governed surfaces preserve the canonical north-star clauses. */
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
					failureClass: "drift_blocking",
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
				failureClass: "drift_blocking",
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
				failureClass: "drift_blocking",
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

/** Evaluate north-star decision-question evidence in a PR body. */
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

const CADENCE_MS: Record<string, number> = {
	weekly: 7 * 24 * 60 * 60 * 1000,
	per_release: 30 * 24 * 60 * 60 * 1000,
};

/** Evaluate whether non-core product surfaces are within their review cadence. */
export function evaluateProductSurfaceCadence(
	registry: ProductSurfaceRegistry | undefined,
	referenceDate: Date = new Date(),
): NorthStarParityIssue[] {
	if (!registry || registry.surfaces.length === 0) {
		return [];
	}

	const issues: NorthStarParityIssue[] = [];
	for (const surface of registry.surfaces) {
		if (surface.class === "core" || !surface.reviewCadence) {
			continue;
		}

		const threshold = CADENCE_MS[surface.reviewCadence];
		if (!threshold) {
			continue;
		}

		const reviewed = Date.parse(surface.lastReviewedAt ?? "");
		if (Number.isNaN(reviewed)) {
			issues.push({
				ruleId: "status.north_star.cadence.invalid_date",
				path: surface.ownedPaths[0] ?? surface.surfaceId,
				message: `Surface ${surface.surfaceId} has an invalid or missing lastReviewedAt date.`,
				severity: "error",
				failureClass: "cadence_breach",
			});
			continue;
		}

		const elapsed = referenceDate.getTime() - reviewed;
		if (elapsed > threshold) {
			const days = Math.round(elapsed / (24 * 60 * 60 * 1000));
			issues.push({
				ruleId: "status.north_star.cadence.breach",
				path: surface.ownedPaths[0] ?? surface.surfaceId,
				message: `Surface ${surface.surfaceId} has not been reviewed in ${days} days (exceeds ${surface.reviewCadence} cadence).`,
				severity: "error",
				failureClass: "cadence_breach",
			});
		}
	}

	return issues;
}
