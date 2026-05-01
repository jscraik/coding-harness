import { createHash } from "node:crypto";
import { redactSensitiveText } from "./sensitive-text.js";
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

/**
 * Convert parsed CodeRabbit CSV rows into deterministically identified and sorted LearningItem objects.
 *
 * @param rows - Parsed CodeRabbit CSV rows to normalize into learning items.
 * @param options - Configuration options.
 * @param options.sourceUri - URI used as the `source.uri` for each generated item.
 * @returns An object with `items`: a deterministically ordered array of `LearningItem`, and `warnings`: an array of `LearningImportWarning` (currently always empty).
 */
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
		const promotionStatus = row.usage >= 25 ? "candidate" : "unreviewed";
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

/**
 * Constructs a deterministic base identifier for a parsed learning row.
 *
 * @param row - The parsed learning row whose repository and topic are used to derive the identifier
 * @returns The identifier in the form `coderabbit.<repository>.<topic>`
 */
export function buildLearningId(row: ParsedCodeRabbitLearningRow): string {
	const repository = slugify(row.repository) || "unknown-repo";
	const topic = buildTopicSlug(row);
	return `coderabbit.${repository}.${topic}`;
}

/**
 * Assigns a provisional Phase 1A classification to a parsed learning row.
 *
 * Classification is determined by keyword heuristics applied to the concatenation of the row's `file` and `learning` text; if no keyword matches, the `usage` count decides between `memory_only` and `review_context`.
 *
 * @param row - Parsed row whose `file`, `learning`, and `usage` fields are used to determine classification
 * @returns
 * - `guardrail` if the text includes "frontmatter" or "must not".
 * - `validation_contract` if the text includes "pnpm test", "validation", or "circleci parity".
 * - `source_of_truth` if the text includes "source of truth" or "package.json".
 * - `generated_artifact` if the text includes "generated" or "template".
 * - `scaffold_default` if the text includes "scaffold" or ".npmrc".
 * - `ci_ownership` if the text includes "circleci", "github actions", or "semgrep".
 * - `memory_only` if no keyword matches and `usage` < 5.
 * - `review_context` if no keyword matches and `usage` >= 5.
 */
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

/**
 * Determine the enforcement hint for a learning item based on its usage and classification.
 *
 * @returns One of `"none"`, `"info"`, `"warning"`, or `"error"`:
 * - `"none"` when `classification` is `"memory_only"`.
 * - `"error"` when `usage` is greater than or equal to 100.
 * - `"warning"` when `usage` is greater than or equal to 25.
 * - `"info"` otherwise.
 */
export function deriveEnforcement(
	usage: number,
	classification: LearningClassification,
): LearningEnforcement {
	if (classification === "memory_only") return "none";
	if (usage >= 100) return "error";
	if (usage >= 25) return "warning";
	return "info";
}

/**
 * Produce a deterministically ordered array of learning items for stable artifacts.
 *
 * The returned array is a new, sorted copy of `items` using these keys (in order):
 * 1. `repository` (lexicographic)
 * 2. `file` (lexicographic, treating absent as empty string)
 * 3. `usage` (descending)
 * 4. `id` (lexicographic)
 *
 * @returns A new array containing the same `LearningItem` objects sorted deterministically by the criteria above
 */
export function sortLearningItems(items: LearningItem[]): LearningItem[] {
	return [...items].sort(
		(a, b) =>
			a.repository.localeCompare(b.repository) ||
			(a.file ?? "").localeCompare(b.file ?? "") ||
			b.usage - a.usage ||
			a.id.localeCompare(b.id),
	);
}

/**
 * Compute counts of learning items grouped by classification and by enforcement.
 *
 * @returns An object containing:
 * - `byClassification` — a partial map of `LearningClassification` to their counts
 * - `byEnforcement` — a partial map of `LearningEnforcement` to their counts
 */
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

/**
 * Builds a deterministic topic slug from a parsed learning row using the row's file path and learning text.
 *
 * Special-cases produce readable slugs for frontmatter machine-readable content and pnpm CI test validation; otherwise the slug is constructed from the first meaningful words of the learning text combined with the file's top directory (or `learning` when unavailable).
 *
 * @param row - Parsed learning row whose `file` and `learning` fields are used to derive the topic slug
 * @returns A URL- and ID-safe slug for the row's topic (e.g., `dir-some-topic`); returns `"learning"` if no meaningful slug can be produced
 */
function buildTopicSlug(row: ParsedCodeRabbitLearningRow): string {
	const pathPrefix = row.file?.split(/[\\/]/).find(Boolean) ?? "learning";
	const text = redactSensitiveText(row.learning).toLowerCase();
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

/**
 * Produces a normalized slug suitable for identifiers, filenames, or URLs.
 *
 * Converts the input to lowercase, removes a leading `jscraik/` prefix if present,
 * replaces non-alphanumeric characters with single hyphens, and trims leading/trailing hyphens.
 *
 * @param value - The input string to normalize into a slug
 * @returns A lowercase slug containing only `a`–`z`, `0`–`9`, and `-` with no leading or trailing hyphens
 */
function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/^jscraik\//, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Produces a short deterministic hexadecimal fingerprint for a string.
 *
 * @param value - The input string to fingerprint
 * @returns An 8-character lowercase hexadecimal string derived from the SHA-256 digest of `value`
 */
function shortHash(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

/**
 * Build a GitHub pull request URL for the given parsed learning row when a pull request is present.
 *
 * @param row - Parsed learning row whose `repository` and `pullRequest` fields are used to construct the URL
 * @returns The GitHub pull request URL for owner-qualified repositories, or the legacy `jscraik/<repository>` fallback for ownerless rows, if `row.pullRequest` is set; `undefined` otherwise
 */
function synthesizeGithubUrl(
	row: ParsedCodeRabbitLearningRow,
): string | undefined {
	if (!row.pullRequest) return undefined;
	const repository = row.repository.trim();
	const parts = repository.split("/").filter((part) => part.length > 0);
	const githubRepository =
		parts.length >= 2 ? `${parts[0]}/${parts[1]}` : `jscraik/${repository}`;
	return `https://github.com/${githubRepository}/pull/${row.pullRequest}`;
}

/**
 * Assigns a property on `target` when `value` is neither `undefined` nor an empty string.
 *
 * @param target - The object to receive the assignment
 * @param key - The property key to set on `target`
 * @param value - The value to assign; ignored if `undefined` or `""`
 */
function assignOptional<T extends object, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined,
): void {
	if (value !== undefined && value !== "") {
		target[key] = value;
	}
}
