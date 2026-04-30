import type { LearningItem } from "./types.js";

/** Machine-readable learning/file match kind. */
export type LearningFileMatchKind = "exact_file" | "path_pattern" | "keyword";

/** Learning/file match metadata for measurement and review context. */
export interface LearningFileMatch {
	/** Match kind selected for the learning/file pair. */
	kind: LearningFileMatchKind;
	/** Confidence score from 0 to 1. */
	confidence: number;
	/** Human-readable reason for the selected match. */
	reason: string;
	/** Keyword-only matches are advisory until false-positive behavior is measured. */
	advisoryOnly: boolean;
	/** Whether this match should be counted as a false-positive candidate. */
	falsePositiveCandidate: boolean;
}

/**
 * Determine whether a learning item applies to a given file and produce match metadata.
 *
 * @param item - The learning item to evaluate
 * @param file - The file path to check (will be normalized before matching)
 * @returns A `LearningFileMatch` describing the detected match when the learning applies, or `undefined` if there is no match
 */
export function matchLearningToFile(
	item: LearningItem,
	file: string,
): LearningFileMatch | undefined {
	const normalizedFile = normalizeFile(file);
	if (item.file && normalizeFile(item.file) === normalizedFile) {
		return {
			kind: "exact_file",
			confidence: 1,
			reason: "Learning file exactly matches the changed file.",
			advisoryOnly: false,
			falsePositiveCandidate: false,
		};
	}
	for (const pattern of item.targetPatterns ?? []) {
		if (!patternMatchesFile(pattern, normalizedFile)) continue;
		return {
			kind: "path_pattern",
			confidence: 0.95,
			reason: `Learning target pattern ${pattern} matches the changed file.`,
			advisoryOnly: false,
			falsePositiveCandidate: false,
		};
	}
	const keywordMatch = buildKeywordMatch(item, normalizedFile);
	if (!keywordMatch) return undefined;
	return keywordMatch;
}

/**
 * Determines whether a path pattern applies to a normalized file path.
 *
 * @param pattern - A normalized path pattern; supports recursive suffix `/**` and single-level suffix `/*`
 * @param file - A normalized file path to test against `pattern`
 * @returns `true` if `pattern` matches `file` (recursive match, single-level child match, or exact equality), `false` otherwise
 */
export function patternMatchesFile(pattern: string, file: string): boolean {
	const normalized = normalizeFile(pattern);
	if (normalized.endsWith("/**")) {
		const prefix = normalized.slice(0, -3);
		return file === prefix || file.startsWith(`${prefix}/`);
	}
	if (normalized.endsWith("/*")) {
		const prefix = normalized.slice(0, -2);
		const rest = file.startsWith(`${prefix}/`)
			? file.slice(prefix.length + 1)
			: "";
		return rest.length > 0 && !rest.includes("/");
	}
	return normalized === file;
}

/**
 * Produce an advisory keyword match when the file's tokens overlap with tokens from the learning item.
 *
 * Token overlap is computed from the normalized file path and the learning item's `file`, `targetPatterns`, `classification`, and `learning` fields. If there is no overlap, no match is produced.
 *
 * @param item - The learning item whose `file`, `targetPatterns`, `classification`, and `learning` fields are used for token extraction
 * @param file - The normalized file path to tokenize and compare against the learning item
 * @returns A `LearningFileMatch` of kind `"keyword"` with confidence based on token overlap, a `reason` listing up to the first four overlapping tokens, `advisoryOnly: true`, and `falsePositiveCandidate` set to `true` when confidence is less than 0.7; `undefined` if there are no overlapping tokens
 */
function buildKeywordMatch(
	item: LearningItem,
	file: string,
): LearningFileMatch | undefined {
	const fileTokens = tokenize(file);
	const learningTokens = tokenize(
		`${item.file ?? ""} ${item.targetPatterns?.join(" ") ?? ""} ${item.classification} ${item.learning}`,
	);
	const overlap = [...fileTokens]
		.filter((token) => learningTokens.has(token))
		.sort();
	if (overlap.length === 0) return undefined;
	const confidence = Math.min(0.85, 0.35 + overlap.length * 0.15);
	return {
		kind: "keyword",
		confidence,
		reason: `Keyword-only match on ${overlap.slice(0, 4).join(", ")}.`,
		advisoryOnly: true,
		falsePositiveCandidate: confidence < 0.7,
	};
}

/**
 * Normalize a file path string for consistent matching.
 *
 * Trims surrounding whitespace, converts backslashes to forward slashes, and removes a leading `./` if present.
 *
 * @param file - The input path which may contain backslashes, leading `./`, or extra whitespace
 * @returns The normalized path suitable for pattern matching
 */
function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Extracts a set of meaningful lowercase tokens from a string for keyword matching.
 *
 * @param value - The input text or path (e.g., filename, pattern, or descriptive text) to tokenize.
 * @returns A set of unique lowercase tokens longer than two characters and not present in the stop-word list.
 */
function tokenize(value: string): Set<string> {
	return new Set(
		value
			.toLowerCase()
			.replace(/\.[a-z0-9]+$/g, " ")
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
	);
}

const STOP_WORDS = new Set([
	"and",
	"app",
	"are",
	"build",
	"but",
	"dist",
	"for",
	"from",
	"index",
	"into",
	"main",
	"must",
	"not",
	"spec",
	"src",
	"test",
	"that",
	"the",
	"this",
	"util",
	"use",
	"with",
]);
