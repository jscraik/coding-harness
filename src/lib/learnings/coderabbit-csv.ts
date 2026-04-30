import { pathToFileURL } from "node:url";
import { detectSensitiveText, redactSensitiveText } from "./sensitive-text.js";
import type {
	LearningImportSummary,
	LearningImportWarning,
	ParsedCodeRabbitLearningRow,
} from "./types.js";

const REQUIRED_HEADERS = ["Repository", "Usage", "Learning"] as const;
const OPTIONAL_HEADERS = [
	"File",
	"Pull Request",
	"URL",
	"Created By",
	"Last Used",
	"Created At",
	"Updated At",
] as const;
const TARGET_PREFIX = /^Applies to\s+([^:]+?)\s*:\s*/i;

/** Result from parsing a CodeRabbit CSV export. */
export interface ParseCodeRabbitCsvResult {
	/** Rows valid for the requested repository. */
	rows: ParsedCodeRabbitLearningRow[];
	/** Rows skipped because they target another repository. */
	skipped: number;
	/** Invalid row count. */
	invalid: number;
	/** Data-row count, excluding the header. */
	totalRows: number;
	/** Parser warnings. */
	warnings: LearningImportWarning[];
}

/** Convert a local path into a file URI for Phase 1A source provenance. */
export function toSourceUri(sourcePath: string): string {
	return pathToFileURL(sourcePath).href;
}

/** Normalize repository names for matching and deterministic IDs. */
export function normalizeRepositorySlug(repository: string): string {
	return repository
		.trim()
		.toLowerCase()
		.replace(/^jscraik\//, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Parse CodeRabbit CSV content into normalized import rows. */
export function parseCodeRabbitCsv(
	csv: string,
	options: { repository: string },
): ParseCodeRabbitCsvResult {
	const records = parseCsvRecords(csv);
	const warnings: LearningImportWarning[] = [];
	if (records.length === 0) {
		return {
			rows: [],
			skipped: 0,
			invalid: 0,
			totalRows: 0,
			warnings: [
				{ code: "learnings.csv.empty", message: "CSV file is empty." },
			],
		};
	}

	const header = records[0] ?? [];
	const headerIndex = buildHeaderIndex(header);
	const missing = REQUIRED_HEADERS.filter((name) => !headerIndex.has(name));
	if (missing.length > 0) {
		return {
			rows: [],
			skipped: 0,
			invalid: records.length - 1,
			totalRows: Math.max(records.length - 1, 0),
			warnings: [
				{
					code: "learnings.csv.missing_headers",
					message: `Missing required CodeRabbit CSV headers: ${missing.join(", ")}.`,
				},
			],
		};
	}

	const targetRepository = normalizeRepositorySlug(options.repository);
	const rows: ParsedCodeRabbitLearningRow[] = [];
	let skipped = 0;
	let invalid = 0;

	for (let index = 1; index < records.length; index++) {
		const record = records[index] ?? [];
		const rowNumber = index + 1;
		const repositoryRaw = getCell(record, headerIndex, "Repository");
		const repository = normalizeRepositorySlug(repositoryRaw);
		const learningRaw = getCell(record, headerIndex, "Learning").trim();
		if (!repository || !learningRaw) {
			invalid += 1;
			warnings.push({
				row: rowNumber,
				code: "learnings.csv.invalid_row",
				message: "Row is missing Repository or Learning.",
			});
			continue;
		}
		if (repository !== targetRepository) {
			skipped += 1;
			continue;
		}
		warnings.push(...detectSensitiveRowFields(record, headerIndex, rowNumber));

		const usageResult = parseUsage(getCell(record, headerIndex, "Usage"));
		if (!usageResult.ok) {
			invalid += 1;
			warnings.push({
				row: rowNumber,
				code: "learnings.csv.invalid_usage",
				message: usageResult.message,
			});
			continue;
		}

		const targetResult = extractTargetPatterns(learningRaw);
		const row: ParsedCodeRabbitLearningRow = {
			row: rowNumber,
			repository,
			usage: usageResult.usage,
			learning: targetResult.learning,
		};
		assignOptional(row, "file", getCell(record, headerIndex, "File"));
		assignOptional(
			row,
			"pullRequest",
			getCell(record, headerIndex, "Pull Request"),
		);
		assignOptional(row, "url", getCell(record, headerIndex, "URL"));
		assignOptional(
			row,
			"createdBy",
			getCell(record, headerIndex, "Created By"),
		);
		assignOptional(
			row,
			"createdAt",
			getCell(record, headerIndex, "Created At"),
		);
		assignOptional(
			row,
			"updatedAt",
			getCell(record, headerIndex, "Updated At"),
		);
		const lastUsed = normalizeLastUsed(
			getCell(record, headerIndex, "Last Used"),
		);
		if (lastUsed.present) row.lastUsed = lastUsed.value;
		if (targetResult.targetPatterns.length > 0) {
			row.targetPatterns = targetResult.targetPatterns;
		}
		rows.push(row);
	}

	return {
		rows,
		skipped,
		invalid,
		totalRows: records.length - 1,
		warnings: sortWarnings(warnings),
	};
}

/** Build a stable summary from parser and normalized item counts. */
export function buildLearningSummary(input: {
	totalRows: number;
	imported: number;
	skipped: number;
	invalid: number;
	warnings: number;
	byClassification?: LearningImportSummary["byClassification"];
	byEnforcement?: LearningImportSummary["byEnforcement"];
}): LearningImportSummary {
	return {
		totalRows: input.totalRows,
		imported: input.imported,
		skipped: input.skipped,
		invalid: input.invalid,
		warnings: input.warnings,
		byClassification: sortCountMap(input.byClassification ?? {}),
		byEnforcement: sortCountMap(input.byEnforcement ?? {}),
	};
}

function buildHeaderIndex(header: string[]): Map<string, number> {
	const allowed = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
	const headerIndex = new Map<string, number>();
	for (let index = 0; index < header.length; index++) {
		const name = (header[index] ?? "").replace(/^\uFEFF/, "").trim();
		if (allowed.has(name) && !headerIndex.has(name)) {
			headerIndex.set(name, index);
		}
	}
	return headerIndex;
}

function getCell(
	record: string[],
	headerIndex: Map<string, number>,
	header: string,
): string {
	const index = headerIndex.get(header);
	if (index === undefined) return "";
	return record[index]?.trim() ?? "";
}

function parseUsage(
	raw: string,
): { ok: true; usage: number } | { ok: false; message: string } {
	const value = raw.trim();
	if (value === "") return { ok: true, usage: 0 };
	if (!/^\d+$/.test(value)) {
		return {
			ok: false,
			message: `Usage must be a non-negative integer: ${redactSensitiveText(value)}`,
		};
	}
	return { ok: true, usage: Number.parseInt(value, 10) };
}

function detectSensitiveRowFields(
	record: string[],
	headerIndex: Map<string, number>,
	row: number,
): LearningImportWarning[] {
	const warnings: LearningImportWarning[] = [];
	for (const header of [
		"File",
		"Pull Request",
		"URL",
		"Learning",
		"Created By",
		"Last Used",
		"Created At",
		"Updated At",
	]) {
		const value = getCell(record, headerIndex, header);
		if (value.length === 0) continue;
		const findings = detectSensitiveText(value);
		for (const finding of findings) {
			warnings.push({
				row,
				code: `learnings.csv.${finding.code}`,
				message: `Sensitive ${finding.label} detected in CodeRabbit CSV field ${header}; value is preserved only in the local artifact and redacted from shareable output.`,
			});
		}
	}
	return warnings;
}

function normalizeLastUsed(
	raw: string,
): { present: true; value: string | null } | { present: false } {
	const value = raw.trim();
	if (value === "") return { present: false };
	if (value.toLowerCase() === "never") return { present: true, value: null };
	return { present: true, value };
}

function extractTargetPatterns(learning: string): {
	learning: string;
	targetPatterns: string[];
} {
	const match = TARGET_PREFIX.exec(learning);
	if (!match?.[1]) return { learning, targetPatterns: [] };
	const targetPatterns = match[1]
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
	return {
		learning: learning.slice(match[0].length).trim(),
		targetPatterns,
	};
}

function assignOptional<T extends object, K extends keyof T>(
	target: T,
	key: K,
	value: string,
): void {
	const trimmed = value.trim();
	if (trimmed.length > 0) {
		target[key] = trimmed as T[K];
	}
}

function parseCsvRecords(csv: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let field = "";
	let inQuotes = false;
	for (let index = 0; index < csv.length; index++) {
		const char = csv[index];
		const next = csv[index + 1];
		if (char === '"') {
			if (inQuotes && next === '"') {
				field += '"';
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (char === "," && !inQuotes) {
			record.push(field);
			field = "";
			continue;
		}
		if ((char === "\n" || char === "\r") && !inQuotes) {
			if (char === "\r" && next === "\n") index += 1;
			record.push(field);
			field = "";
			if (record.some((cell) => cell.trim().length > 0)) records.push(record);
			record = [];
			continue;
		}
		field += char ?? "";
	}
	record.push(field);
	if (record.some((cell) => cell.trim().length > 0)) records.push(record);
	return records;
}

function sortWarnings(
	warnings: LearningImportWarning[],
): LearningImportWarning[] {
	return [...warnings].sort(
		(a, b) =>
			(a.row ?? Number.MAX_SAFE_INTEGER) - (b.row ?? Number.MAX_SAFE_INTEGER) ||
			a.code.localeCompare(b.code) ||
			a.message.localeCompare(b.message),
	);
}

function sortCountMap<T extends string>(
	map: Partial<Record<T, number>>,
): Partial<Record<T, number>> {
	return Object.fromEntries(
		Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
	) as Partial<Record<T, number>>;
}
