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

/**
 * Convert a filesystem path to a `file://` URI for source provenance.
 *
 * @param sourcePath - The local filesystem path to convert
 * @returns The corresponding `file://` URI string
 */
export function toSourceUri(sourcePath: string): string {
	return pathToFileURL(sourcePath).href;
}

/**
 * Produce a deterministic, URL-friendly slug from a repository name.
 *
 * @param repository - The repository name or identifier to normalize
 * @returns A lowercase slug containing only letters, digits, and hyphens with no leading or trailing hyphens
 */
export function normalizeRepositorySlug(repository: string): string {
	return repository
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Parse a CodeRabbit CSV into normalized learning import rows for a specific repository.
 *
 * @param csv - The raw CSV content to parse.
 * @param options - Parsing options.
 * @param options.repository - Repository identifier used to match and normalize rows.
 * @returns A ParseCodeRabbitCsvResult containing parsed rows for the target repository, counts for skipped/invalid/total rows, and sorted parser warnings.
 */
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
	const missingHeaderResult = buildMissingHeaderResult(records, headerIndex);
	if (missingHeaderResult) return missingHeaderResult;

	const targetRepositoryAliases = repositoryAliases(options.repository);
	const targetRepositoryHasOwner = options.repository.includes("/");
	const canonicalRepository = options.repository.trim();
	if (!canonicalRepository) {
		throw new TypeError("CodeRabbit CSV import requires a target repository.");
	}
	const rows: ParsedCodeRabbitLearningRow[] = [];
	let skipped = 0;
	let invalid = 0;

	for (let index = 1; index < records.length; index++) {
		const record = records[index] ?? [];
		const rowNumber = index + 1;
		const repositoryRaw = getCell(record, headerIndex, "Repository");
		const repositoryMatch = matchRepository(
			repositoryRaw,
			targetRepositoryAliases,
			targetRepositoryHasOwner,
		);
		const learningRaw = getCell(record, headerIndex, "Learning").trim();
		if (repositoryMatch === "missing" || !learningRaw) {
			invalid += 1;
			warnings.push({
				row: rowNumber,
				code: "learnings.csv.invalid_row",
				message: "Row is missing Repository or Learning.",
			});
			continue;
		}
		if (repositoryMatch === "skip") {
			skipped += 1;
			continue;
		}
		const repository = canonicalRepository;
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

/**
 * Produce normalized repository slug aliases used for matching.
 *
 * @param repository - The repository identifier (e.g., "owner/repo" or any repository string)
 * @returns A set containing the normalized full repository slug and, when present, the normalized ownerless repository name, excluding empty values.
 */
function repositoryAliases(repository: string): Set<string> {
	const normalized = normalizeRepositorySlug(repository);
	const ownerless = normalizeRepositorySlug(repository.split("/").pop() ?? "");
	const aliases = new Set<string>();
	if (normalized) aliases.add(normalized);
	if (ownerless) aliases.add(ownerless);
	return aliases;
}

/**
 * Determines whether a CSV row's repository targets the requested repository.
 *
 * @param repository - The raw repository string from the CSV row.
 * @param targetRepositoryAliases - Set containing normalized full and ownerless target repository aliases.
 * @param targetRepositoryHasOwner - Whether the requested target repository included an owner; ownerless CSV rows may match owner-qualified targets, and owner-qualified CSV rows may match ownerless targets only when this is false.
 * @returns `'matched'` when the normalized full source slug is in `targetRepositoryAliases`, or when the ownerless source name is allowed and matched; `'missing'` when `repository` yields no normalized slug; `'skip'` otherwise.
 */
function matchRepository(
	repository: string,
	targetRepositoryAliases: Set<string>,
	targetRepositoryHasOwner: boolean,
): "matched" | "missing" | "skip" {
	const normalizedSource = normalizeRepositorySlug(repository);
	const sourceOwnerless = normalizeRepositorySlug(
		repository.split("/").pop() ?? "",
	);
	if (!normalizedSource) return "missing";
	return targetRepositoryAliases.has(normalizedSource) ||
		((!repository.includes("/") || !targetRepositoryHasOwner) &&
			targetRepositoryAliases.has(sourceOwnerless))
		? "matched"
		: "skip";
}

/**
 * Builds a parse result indicating missing required headers when any are absent from the header index.
 *
 * @param records - Parsed CSV records (array of rows), where the header row is expected at index 0
 * @param headerIndex - Map of header name to its first column index
 * @returns A `ParseCodeRabbitCsvResult` with empty `rows`, `invalid` and `totalRows` reflecting the number of data rows, and a `learnings.csv.missing_headers` warning listing the missing headers; returns `undefined` if no required headers are missing
 */
function buildMissingHeaderResult(
	records: string[][],
	headerIndex: Map<string, number>,
): ParseCodeRabbitCsvResult | undefined {
	const missing = REQUIRED_HEADERS.filter((name) => !headerIndex.has(name));
	if (missing.length === 0) return undefined;
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

/**
 * Builds a mapping from allowed CSV header names to their first column index.
 *
 * Header cells are normalized by removing a leading UTF-8 BOM marker and trimming whitespace.
 * Only names present in the union of REQUIRED_HEADERS and OPTIONAL_HEADERS are included,
 * and the first occurrence of each allowed header is recorded.
 *
 * @param header - The CSV header row as an array of cell strings
 * @returns A Map where keys are allowed header names (normalized) and values are their column index
 */
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

/**
 * Retrieve the trimmed cell value for a given header from a CSV record.
 *
 * @param record - Array of cell values for the CSV row
 * @param headerIndex - Mapping of header names to their column indices
 * @param header - Header name to retrieve from the record
 * @returns The cell's trimmed string value, or an empty string if the header is missing or the cell is absent
 */
function getCell(
	record: string[],
	headerIndex: Map<string, number>,
	header: string,
): string {
	const index = headerIndex.get(header);
	if (index === undefined) return "";
	return record[index]?.trim() ?? "";
}

/**
 * Parse a usage value from a CSV cell into a validated numeric usage count.
 *
 * @param raw - The raw cell text (may be empty or contain digits)
 * @returns `{ ok: true, usage: number }` when the input is a valid non-negative integer or empty (empty -> 0); `{ ok: false, message: string }` when the input is invalid, with `message` describing the problem (sensitive input is redacted)
 */
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

/**
 * Detects sensitive content in selected CSV columns for a parsed CodeRabbit row and produces warning entries.
 *
 * @param record - The parsed CSV record (array of cell strings) for the row being inspected
 * @param headerIndex - Map from allowed header names to their column index used to locate cells in `record`
 * @param row - The original CSV row number (used on each generated warning)
 * @returns An array of `LearningImportWarning` objects, one per detected sensitive finding; empty if no sensitive content is found
 */
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

/**
 * Normalize a raw "Last Used" CSV cell into a presence flag and an optional normalized value.
 *
 * @param raw - The raw cell value from the "Last Used" column
 * @returns `{ present: false }` when `raw` is empty after trimming; `{ present: true, value: null }` when the trimmed value equals `"never"` (case-insensitive); otherwise `{ present: true, value: <trimmed string> }`
 */
function normalizeLastUsed(
	raw: string,
): { present: true; value: string | null } | { present: false } {
	const value = raw.trim();
	if (value === "") return { present: false };
	if (value.toLowerCase() === "never") return { present: true, value: null };
	return { present: true, value };
}

/**
 * Extracts a leading "Applies to <patterns>:" prefix from a learning string and returns any parsed target patterns along with the remaining learning text.
 *
 * @param learning - The raw learning text that may start with an "Applies to ..." prefix
 * @returns An object containing:
 *  - `learning`: the input text with the prefix removed and trimmed (or the original text if no prefix was present)
 *  - `targetPatterns`: an array of trimmed, non-empty target pattern strings parsed from the prefix (empty if no prefix was present)
 */
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

/**
 * Assigns a trimmed string to a given property on an object only if the trimmed value is non-empty.
 *
 * @param target - The object to which the property may be assigned
 * @param key - The property key to assign on `target`
 * @param value - The raw string value to trim and conditionally assign
 */
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

/**
 * Parses CSV text into an array of records (rows) with their cell values.
 *
 * Supports comma separators outside quoted fields, double-quote escaping by doubling (`""`),
 * CRLF and LF line endings, and omits rows where every cell is empty or whitespace.
 *
 * @param csv - The raw CSV content to parse
 * @returns An array of records; each record is an array of cell strings. Rows with only whitespace cells are omitted.
 */
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

/**
 * Produce a new array of warnings sorted by row, code, and message.
 *
 * @param warnings - The warnings to sort.
 * @returns A new array with warnings ordered first by numeric `row` (missing `row` is treated as after any numbered row), then by `code` using locale comparison, and finally by `message` using locale comparison.
 */
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

/**
 * Returns a new object with the same key/value pairs as `map`, but with entries ordered by key.
 *
 * @param map - A partial mapping of string keys to numeric counts
 * @returns A new object containing the same keys and counts as `map`, sorted by key using localeCompare
 */
function sortCountMap<T extends string>(
	map: Partial<Record<T, number>>,
): Partial<Record<T, number>> {
	return Object.fromEntries(
		Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
	) as Partial<Record<T, number>>;
}
