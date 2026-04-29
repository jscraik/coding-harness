import { createHash } from "node:crypto";
import type {
	LearningClassification,
	LearningEnforcement,
	LearningImportWarning,
	LearningItem,
	LearningSourceRef,
	ParsedCodeRabbitLearningRow,
} from "./types.js";

/** Result from normalizing parsed CodeRabbit rows into learning items. */
export interface NormalizeLearningRowsResult {
	/** Deterministically ordered learning items. */
	items: LearningItem[];
	/** Additional normalization warnings. */
	warnings: LearningImportWarning[];
}

/** Normalize parsed rows into deterministic learning items. */
export function normalizeLearningRows(
	rows: ParsedCodeRabbitLearningRow[],
	options: { sourceUri: string },
): NormalizeLearningRowsResult {
	const idCounts = new Map<string, number>();
	const items = rows.map((row) => {
		const source: LearningSourceRef = {
			kind: "coderabbit_csv",
			uri: options.sourceUri,
			row: row.row,
			live: false,
		};
		const classification = classifyLearning(row);
		const enforcement = deriveEnforcement(row.usage, classification);
		const baseId = buildLearningId(row);
		const count = idCounts.get(baseId) ?? 0;
		idCounts.set(baseId, count + 1);
		const id =
			count === 0 ? baseId : `${baseId}-${shortHash(`${baseId}:${row.row}`)}`;
		const promotionStatus = ENFORCED_LEARNING_IDS.has(id)
			? "enforced"
			: row.usage >= 25
				? "candidate"
				: "unenforced";
		const item: LearningItem = {
			id,
			provider: "coderabbit",
			source,
			repository: row.repository,
			usage: row.usage,
			learning: row.learning,
			classification,
			enforcement,
			promotionStatus,
		};
		assignOptional(item, "file", row.file);
		assignOptional(item, "pullRequest", row.pullRequest);
		assignOptional(item, "githubUrl", row.url ?? synthesizeGithubUrl(row));
		assignOptional(item, "createdBy", row.createdBy);
		if (Object.hasOwn(row, "lastUsed")) item.lastUsed = row.lastUsed ?? null;
		assignOptional(item, "createdAt", row.createdAt);
		assignOptional(item, "updatedAt", row.updatedAt);
		if (row.targetPatterns && row.targetPatterns.length > 0) {
			item.targetPatterns = [...row.targetPatterns].sort();
		}
		return item;
	});
	return { items: sortLearningItems(items), warnings: [] };
}

/** Build the deterministic base identifier for a learning row. */
export function buildLearningId(row: ParsedCodeRabbitLearningRow): string {
	const repository = slugify(row.repository) || "unknown-repo";
	const topic = buildTopicSlug(row);
	return `coderabbit.${repository}.${topic}`;
}

/** Classify a learning into the Phase 1A provisional buckets. */
export function classifyLearning(
	row: ParsedCodeRabbitLearningRow,
): LearningClassification {
	const text = `${row.file ?? ""} ${row.learning}`.toLowerCase();
	if (text.includes("frontmatter") || text.includes("must not")) {
		return "guardrail";
	}
	if (
		text.includes("pnpm test") ||
		text.includes("validation") ||
		text.includes("circleci parity")
	) {
		return "validation_contract";
	}
	if (text.includes("source of truth") || text.includes("package.json")) {
		return "source_of_truth";
	}
	if (text.includes("generated") || text.includes("template")) {
		return "generated_artifact";
	}
	if (text.includes("scaffold") || text.includes(".npmrc")) {
		return "scaffold_default";
	}
	if (
		text.includes("circleci") ||
		text.includes("github actions") ||
		text.includes("semgrep")
	) {
		return "ci_ownership";
	}
	return row.usage < 5 ? "memory_only" : "review_context";
}

/** Derive the advisory enforcement hint from usage and classification. */
export function deriveEnforcement(
	usage: number,
	classification: LearningClassification,
): LearningEnforcement {
	if (classification === "memory_only") return "none";
	if (usage >= 100) return "error";
	if (usage >= 25) return "warning";
	return "info";
}

/** Sort learning items deterministically for stable artifacts. */
export function sortLearningItems(items: LearningItem[]): LearningItem[] {
	return [...items].sort(
		(a, b) =>
			a.repository.localeCompare(b.repository) ||
			(a.file ?? "").localeCompare(b.file ?? "") ||
			b.usage - a.usage ||
			a.id.localeCompare(b.id),
	);
}

/** Build stable count maps for normalized learning items. */
export function countLearningItems(items: LearningItem[]): {
	byClassification: Partial<Record<LearningClassification, number>>;
	byEnforcement: Partial<Record<LearningEnforcement, number>>;
} {
	const byClassification: Partial<Record<LearningClassification, number>> = {};
	const byEnforcement: Partial<Record<LearningEnforcement, number>> = {};
	for (const item of items) {
		byClassification[item.classification] =
			(byClassification[item.classification] ?? 0) + 1;
		byEnforcement[item.enforcement] =
			(byEnforcement[item.enforcement] ?? 0) + 1;
	}
	return { byClassification, byEnforcement };
}

function buildTopicSlug(row: ParsedCodeRabbitLearningRow): string {
	const pathPrefix = row.file?.split(/[\\/]/).find(Boolean) ?? "learning";
	const text = row.learning.toLowerCase();
	if (text.includes("frontmatter") && text.includes("machine")) {
		return `${slugify(pathPrefix)}-frontmatter-machine-readable`;
	}
	if (text.includes("pnpm") && text.includes("test:ci")) {
		return `${slugify(pathPrefix)}-pnpm-test-ci-validation`;
	}
	const words = text
		.replace(/[`'"()]/g, " ")
		.split(/[^a-z0-9]+/)
		.filter((word) => word.length > 2 && !STOP_WORDS.has(word))
		.slice(0, 4);
	return slugify(`${pathPrefix}-${words.join("-")}`) || "learning";
}

const STOP_WORDS = new Set([
	"and",
	"are",
	"but",
	"for",
	"from",
	"into",
	"must",
	"not",
	"that",
	"the",
	"this",
	"use",
	"with",
]);

const ENFORCED_LEARNING_IDS = new Set([
	"coderabbit.coding-harness.docs-frontmatter-machine-readable",
]);

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^jscraik\//, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function shortHash(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function synthesizeGithubUrl(
	row: ParsedCodeRabbitLearningRow,
): string | undefined {
	if (!row.pullRequest) return undefined;
	return `https://github.com/jscraik/${row.repository}/pull/${row.pullRequest}`;
}

function assignOptional<T extends object, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined,
): void {
	if (value !== undefined && value !== "") {
		target[key] = value;
	}
}
