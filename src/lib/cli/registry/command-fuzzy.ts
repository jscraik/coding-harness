import type { CommandCapability } from "./command-capabilities.js";
import type { CommandSpec } from "./types.js";

/**
 * Compute the Levenshtein edit distance between two strings.
 * Uses a single-row DP approach for O(n) space.
 */
function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);
	for (let i = 1; i <= m; i++) {
		let prev = i;
		for (let j = 1; j <= n; j++) {
			const val =
				a[i - 1] === b[j - 1]
					? (row[j - 1] ?? 0)
					: 1 + Math.min(prev, row[j] ?? 0, row[j - 1] ?? 0);
			row[j - 1] = prev;
			prev = val;
		}
		row[n] = prev;
	}
	return row[n] ?? 0;
}

export function normalizeCommandName(name: string): string {
	return name
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/_/g, "-");
}

function fuzzyThreshold(len: number): number {
	if (len <= 5) {
		return 1;
	}
	return 2;
}

export type FuzzyMatchConfidence = "normalized" | "near";

export interface FuzzyCommandMatch {
	spec: CommandSpec;
	confidence: FuzzyMatchConfidence;
	distance: number;
}

export function fuzzyFindCommand(
	name: string,
	specs: CommandSpec[],
	commandIndex: Map<string, CommandSpec>,
): FuzzyCommandMatch | undefined {
	const normalized = normalizeCommandName(name);
	const spec = commandIndex.get(normalized);
	if (spec && spec.name !== name) {
		return { spec, confidence: "normalized", distance: 0 };
	}

	const threshold = fuzzyThreshold(Math.max(name.length, normalized.length));
	let best: FuzzyCommandMatch | undefined;

	for (const spec of specs) {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		for (const candidate of candidates) {
			const normalizedCandidate = normalizeCommandName(candidate);
			const distance = levenshtein(normalized, normalizedCandidate);
			if (
				distance > 0 &&
				distance <= threshold &&
				(!best || distance < best.distance)
			) {
				best = { spec, confidence: "near", distance };
			}
		}
	}

	return best;
}

export function suggestCommands(
	name: string,
	specs: CommandSpec[],
	limit = 3,
): Array<{ spec: CommandSpec; distance: number }> {
	const normalized = normalizeCommandName(name);
	const scored = specs.map((spec) => {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		const distance =
			candidates.length > 0
				? Math.min(
						...candidates.map((candidate) =>
							levenshtein(normalized, normalizeCommandName(candidate)),
						),
					)
				: Infinity;
		return { spec, distance };
	});
	scored.sort((a, b) => a.distance - b.distance);
	return scored.slice(0, limit);
}

export function suggestCommandCapabilities(
	name: string,
	capabilities: CommandCapability[],
	limit = 3,
): Array<{ capability: CommandCapability; distance: number }> {
	const normalized = normalizeCommandName(name);
	const scored = capabilities.map((capability) => {
		const candidates = [capability.name, ...(capability.aliases ?? [])];
		const distance =
			candidates.length > 0
				? Math.min(
						...candidates.map((candidate) =>
							levenshtein(normalized, normalizeCommandName(candidate)),
						),
					)
				: Infinity;
		return { capability, distance };
	});
	scored.sort((a, b) => a.distance - b.distance);
	return scored.slice(0, limit);
}