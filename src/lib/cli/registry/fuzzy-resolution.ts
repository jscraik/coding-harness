import type { CommandSpec } from "./types.js";

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
	if (len <= 5) return 1;
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
	commandSpecs: CommandSpec[],
	commandIndex: ReadonlyMap<string, CommandSpec>,
): FuzzyCommandMatch | undefined {
	const normalized = normalizeCommandName(name);
	if (normalized !== name) {
		const spec = commandIndex.get(normalized);
		if (spec) {
			return { spec, confidence: "normalized", distance: 0 };
		}
	}

	const threshold = fuzzyThreshold(Math.max(name.length, normalized.length));
	let best: FuzzyCommandMatch | undefined;

	for (const spec of commandSpecs) {
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

export function suggestCommands(
	name: string,
	commandSpecs: CommandSpec[],
	limit = 3,
): Array<{ spec: CommandSpec; distance: number }> {
	const normalized = normalizeCommandName(name);
	const scored = commandSpecs.map((spec) => {
		const candidates = [spec.name, ...(spec.aliases ?? [])];
		const distance = Math.min(
			...candidates.map((candidate) => levenshtein(normalized, candidate)),
		);
		return { spec, distance };
	});
	scored.sort((a, b) => a.distance - b.distance);
	return scored.slice(0, limit);
}
