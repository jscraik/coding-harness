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

/** Return match metadata when a learning applies to a file. */
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

/** Return true when a path pattern applies to a changed file. */
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

function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

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
