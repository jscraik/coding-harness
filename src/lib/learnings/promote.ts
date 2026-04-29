import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import { loadLearningArtifact } from "./gate.js";
import type { LearningItem } from "./types.js";

/** Options for generating promotion candidates from imported learnings. */
export interface LearningsPromoteOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Minimum usage count required for promotion candidacy. */
	minUsage?: number;
	/** Repository root used for relative artifact resolution. */
	repoRoot?: string;
}

/** Promotion candidate emitted for high-signal imported learnings. */
export interface LearningPromotionCandidate {
	/** Stable learning identifier. */
	id: string;
	/** Original learning usage count from the provider export. */
	usage: number;
	/** Existing normalized classification. */
	classification: LearningItem["classification"];
	/** Recommended implementation target for the promoted rule. */
	recommendedTarget: string;
	/** Recommended enforcement severity after promotion. */
	recommendedSeverity: LearningItem["enforcement"];
	/** Suggested regression test path or test surface. */
	recommendedTest: string;
	/** Human-readable reason for the promotion recommendation. */
	reason: string;
	/** Matched file or target patterns that justify the destination. */
	targets: string[];
	/** Current promotion lifecycle status for this learning. */
	promotionStatus: LearningItem["promotionStatus"];
}

/** Result for `harness learnings promote`. */
export interface LearningsPromoteResult {
	schemaVersion: "learnings-promote-result/v1";
	status: "success" | "error";
	source: string;
	minUsage: number;
	promotionCandidates: LearningPromotionCandidate[];
	summary: {
		total: number;
		eligible: number;
		deferred: number;
	};
	error?: {
		code: string;
		message: string;
		fix?: string;
	};
}

const DEFAULT_MIN_USAGE = 25;

/** Generate high-usage promotion candidates from a local learning artifact. */
export function buildLearningPromotionCandidates(
	options: LearningsPromoteOptions = {},
): LearningsPromoteResult {
	const source = options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT;
	const minUsage = options.minUsage ?? DEFAULT_MIN_USAGE;
	const loaded = loadLearningArtifact(source, options.repoRoot);

	if (!loaded.ok) {
		return {
			schemaVersion: "learnings-promote-result/v1",
			status: "error",
			source,
			minUsage,
			promotionCandidates: [],
			summary: {
				total: 0,
				eligible: 0,
				deferred: 0,
			},
			error: {
				code: loaded.code,
				message: loaded.message,
				...(loaded.fix ? { fix: loaded.fix } : {}),
			},
		};
	}

	const promotionCandidates = loaded.artifact.items
		.filter((item) => item.usage >= minUsage)
		.map(buildPromotionCandidate)
		.sort((a, b) => b.usage - a.usage || a.id.localeCompare(b.id));

	return {
		schemaVersion: "learnings-promote-result/v1",
		status: "success",
		source,
		minUsage,
		promotionCandidates,
		summary: {
			total: loaded.artifact.items.length,
			eligible: promotionCandidates.length,
			deferred: loaded.artifact.items.length - promotionCandidates.length,
		},
	};
}

function buildPromotionCandidate(
	item: LearningItem,
): LearningPromotionCandidate {
	const destination = destinationFor(item);
	return {
		id: item.id,
		usage: item.usage,
		classification: item.classification,
		recommendedTarget: destination.target,
		recommendedSeverity: recommendedSeverityFor(item),
		recommendedTest: destination.test,
		reason: reasonFor(item),
		targets: targetRefsFor(item),
		promotionStatus: item.promotionStatus,
	};
}

function destinationFor(item: LearningItem): {
	target: string;
	test: string;
} {
	if (item.file?.startsWith("docs/") || hasTargetPrefix(item, "docs/")) {
		return {
			target: "docs-gate",
			test: "src/commands/docs-gate.test.ts",
		};
	}
	if (item.classification === "validation_contract") {
		return {
			target: "validation-plan",
			test: "src/lib/learnings/promote.test.ts",
		};
	}
	if (item.classification === "generated_artifact") {
		return {
			target: "artifact-provenance-gate",
			test: "src/lib/learnings/promote.test.ts",
		};
	}
	if (item.classification === "scaffold_default") {
		return {
			target: "scaffold-contracts",
			test: "src/lib/init/scaffold-contract-template.test.ts",
		};
	}
	return {
		target: "learnings-gate",
		test: "src/lib/learnings/promote.test.ts",
	};
}

function recommendedSeverityFor(
	item: LearningItem,
): LearningItem["enforcement"] {
	if (item.enforcement !== "none") return item.enforcement;
	return item.usage >= 100 ? "error" : "warning";
}

function reasonFor(item: LearningItem): string {
	if (item.usage >= 100) {
		return "High-usage repeated learning should become an enforced guardrail, validator, scaffold rule, or explicit exception.";
	}
	return "Repeated learning meets the promotion threshold and should be reviewed for permanent enforcement.";
}

function targetRefsFor(item: LearningItem): string[] {
	const refs = [item.file, ...(item.targetPatterns ?? [])].filter(
		(ref): ref is string => Boolean(ref),
	);
	return [...new Set(refs)].sort();
}

function hasTargetPrefix(item: LearningItem, prefix: string): boolean {
	return (item.targetPatterns ?? []).some((pattern) =>
		pattern.startsWith(prefix),
	);
}
