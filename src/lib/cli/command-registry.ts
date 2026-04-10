import { COMMAND_SPECS } from "./registry/command-specs.js";
import type { CommandSpec, RegistryDispatchResult } from "./registry/types.js";

export type { CommandSpec, RegistryDispatchResult } from "./registry/types.js";

const COMMAND_INDEX = new Map<string, CommandSpec>();
for (const spec of COMMAND_SPECS) {
	COMMAND_INDEX.set(spec.name, spec);
	for (const alias of spec.aliases ?? []) {
		COMMAND_INDEX.set(alias, spec);
	}
}

export const MIGRATED_COMMAND_NAMES = COMMAND_SPECS.map((spec) => spec.name);
export const MIGRATED_COMMAND_AND_ALIAS_NAMES = COMMAND_SPECS.flatMap(
	(spec) => [spec.name, ...(spec.aliases ?? [])],
);

export function getRegistryCommandHelpRows(): Array<{
	name: string;
	summary: string;
}> {
	return COMMAND_SPECS.map((spec) => ({
		name: spec.name,
		summary: spec.summary,
	}));
}

export function dispatchRegistryCommand(
	command: string | undefined,
	args: string[],
): RegistryDispatchResult | undefined {
	if (!command) {
		return undefined;
	}
	const spec = COMMAND_INDEX.get(command);
	if (!spec) {
		return undefined;
	}
	return {
		spec,
		result: spec.execute(args.slice(1)),
	};
}

// ---------------------------------------------------------------------------
// Fuzzy command resolution — for agent-friendly error recovery
// ---------------------------------------------------------------------------

/**
 * Compute the Levenshtein edit distance between two strings.
 * Uses a single-row DP approach for O(n) space.
 */
function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	// row[j] = edit distance between a[0..i] and b[0..j] for current i
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

/**
 * Normalize a command name to kebab-case.
 * Handles camelCase (blastRadius → blast-radius) and snake_case (blast_radius → blast-radius).
 */
export function normalizeCommandName(name: string): string {
	return name
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.toLowerCase()
		.replace(/_/g, "-");
}

function fuzzyThreshold(len: number): number {
	if (len <= 5) return 1;
	return 2;
}

export type FuzzyMatchConfidence = "normalized" | "near";

export interface FuzzyCommandMatch {
	spec: CommandSpec;
	confidence: FuzzyMatchConfidence;
	/** Edit distance (0 for normalized matches). */
	distance: number;
}

/**
 * Try to find a registry command that matches a potentially malformed name.
 *
 * Resolution order:
 * 1. Normalization (camelCase/snake_case → kebab-case): free correction, high confidence.
 * 2. Levenshtein near-match against canonical names and aliases.
 *
 * Returns `undefined` when no confident match exists.
 */
export function fuzzyFindCommand(name: string): FuzzyCommandMatch | undefined {
	// 1. Normalization pass
	const normalized = normalizeCommandName(name);
	if (normalized !== name) {
		const spec = COMMAND_INDEX.get(normalized);
		if (spec) {
			return { spec, confidence: "normalized", distance: 0 };
		}
	}

	// 2. Levenshtein near-match (compare normalized input against all entries)
	const threshold = fuzzyThreshold(Math.max(name.length, normalized.length));
	let best: FuzzyCommandMatch | undefined;

	for (const spec of COMMAND_SPECS) {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		for (const candidate of candidates) {
			const d = levenshtein(normalized, candidate);
			if (d > 0 && d <= threshold && (!best || d < best.distance)) {
				best = { spec, confidence: "near", distance: d };
			}
		}
	}

	return best;
}

/**
 * Return the top-N registry commands ranked by edit distance from `name`.
 * Used to populate suggestions in "unknown command" error messages.
 */
export function suggestCommands(
	name: string,
	limit = 3,
): Array<{ spec: CommandSpec; distance: number }> {
	const normalized = normalizeCommandName(name);
	const scored = COMMAND_SPECS.map((spec) => {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		const distance = Math.min(
			...candidates.map((c) => levenshtein(normalized, c)),
		);
		return { spec, distance };
	});
	scored.sort((a, b) => a.distance - b.distance);
	return scored.slice(0, limit);
}
