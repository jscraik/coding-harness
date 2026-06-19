import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ContextContradictionCategory } from "../lib/contract/types.js";
import { validatePath } from "../lib/input/validator.js";
import { loadFileIfPresent } from "./docs-gate-files.js";
import type {
	ContradictionFinding,
	ContradictionRecord,
} from "./docs-gate-types.js";
import { CONTRADICTION_HISTORY_PATH } from "./docs-gate-types.js";

function loadOpenContradictions(
	repoRoot: string,
): Map<string, ContradictionRecord> {
	const content = loadFileIfPresent(join(repoRoot, CONTRADICTION_HISTORY_PATH));
	const history = new Map<string, ContradictionRecord>();
	if (!content) return history;
	for (const line of content.split(/\r?\n/)) {
		if (!line.trim()) continue;
		try {
			const entry = JSON.parse(line) as ContradictionRecord;
			history.set(entry.findingId, entry);
		} catch {
			// Ignore malformed history rows so one bad line does not hide valid findings.
		}
	}
	return history;
}

/** Append newly opened or resolved contradiction history rows. */
export function appendContradictionHistory(
	repoRoot: string,
	findings: readonly ContradictionFinding[],
): void {
	const historyPath = validatePath(repoRoot, CONTRADICTION_HISTORY_PATH);
	const existing = loadOpenContradictions(repoRoot);
	const timestamp = new Date().toISOString();
	const currentIds = new Set(findings.map((finding) => finding.finding_id));
	const appendEntries = [
		...newOpenEntries(findings, existing, timestamp),
		...resolvedEntries(existing, currentIds, timestamp),
	];
	if (appendEntries.length === 0) return;
	mkdirSync(dirname(historyPath), { recursive: true });
	const existingContent = loadFileIfPresent(historyPath) ?? "";
	const serialized = appendEntries
		.map((entry) => JSON.stringify(entry))
		.join("\n");
	writeFileSync(
		historyPath,
		existingContent
			? `${existingContent.trimEnd()}\n${serialized}\n`
			: `${serialized}\n`,
		"utf-8",
	);
}

function newOpenEntries(
	findings: readonly ContradictionFinding[],
	existing: ReadonlyMap<string, ContradictionRecord>,
	timestamp: string,
): ContradictionRecord[] {
	return findings.flatMap((finding) =>
		existing.get(finding.finding_id)?.status === "open"
			? []
			: [
					{
						findingId: finding.finding_id,
						category: finding.category as ContextContradictionCategory,
						status: "open",
						message: finding.message,
						sourcePaths: finding.source_paths,
						detectedAt: timestamp,
					},
				],
	);
}

function resolvedEntries(
	existing: ReadonlyMap<string, ContradictionRecord>,
	currentIds: ReadonlySet<string>,
	timestamp: string,
): ContradictionRecord[] {
	return Array.from(existing.entries()).flatMap((entry) => {
		const [findingId, previous] = entry;
		return previous.status !== "open" || currentIds.has(findingId)
			? []
			: [{ ...previous, status: "resolved" as const, resolvedAt: timestamp }];
	});
}
