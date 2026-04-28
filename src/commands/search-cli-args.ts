import {
	MAX_INPUT_LENGTH,
	validateLength,
	validatePathComponent,
} from "../lib/input/validation.js";
import type { SearchMode, SearchOptions } from "./search.js";

const PARSE_EXIT_CODES = {
	SUCCESS: 0,
	ERROR: 3,
	VALIDATION_ERROR: 4,
} as const;

interface PathFilterResult {
	include: string[];
	exclude: string[];
	warnings: string[];
}

function isSearchMode(value: string | undefined): value is SearchMode {
	return value === "lexical" || value === "semantic" || value === "hybrid";
}

function normalizeRelativePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function parsePathFilters(parts: string[]): PathFilterResult {
	const include: string[] = [];
	const exclude: string[] = [];
	const warnings: string[] = [];
	for (const rawPart of parts) {
		const part = rawPart.trim();
		if (!part) continue;
		const separatorIndex = part.indexOf(":");
		if (separatorIndex <= 0 || separatorIndex === part.length - 1) {
			warnings.push(
				`Invalid filter format: "${rawPart}" (expected format: include:path or exclude:path)`,
			);
			continue;
		}
		const kind = part.slice(0, separatorIndex);
		const value = part.slice(separatorIndex + 1);
		if (kind !== "include" && kind !== "exclude") {
			warnings.push(
				`Unknown filter kind: "${kind}" (expected include or exclude)`,
			);
			continue;
		}
		const tokens = value
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
		if (tokens.length === 0) {
			warnings.push(`Empty ${kind} filter value: "${rawPart}"`);
			continue;
		}
		if (kind === "include") include.push(...tokens);
		else exclude.push(...tokens);
	}
	return { include, exclude, warnings };
}

function validatePathPrefix(
	value: string,
	field: string,
): { ok: true; value: string } | { ok: false; message: string } {
	const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
	if (!normalized) {
		return { ok: false, message: `${field} cannot be empty` };
	}
	if (normalized.startsWith("/")) {
		return { ok: false, message: `${field} must be a relative path prefix` };
	}
	if (normalized.includes("\0")) {
		return { ok: false, message: `${field} cannot contain null bytes` };
	}
	const segments = normalized.split("/");
	for (const segment of segments) {
		if (segment === "" || segment === "." || segment === "..") {
			return {
				ok: false,
				message: `${field} cannot contain relative path segments`,
			};
		}
		const segmentValidation = validatePathComponent(
			segment,
			undefined,
			`${field} segment`,
		);
		if (!segmentValidation.ok) {
			return { ok: false, message: segmentValidation.error.message };
		}
	}
	return { ok: true, value: normalized };
}

function printSearchUsage(): number {
	console.info("Usage: harness search <query> [options]");
	console.info("");
	console.info("Options:");
	console.info("  --mode, -m        Search mode: lexical|semantic|hybrid");
	console.info(
		"  --limit, -l       Maximum results (if omitted: contextCompact policy, then DEFAULT_SEARCH_LIMIT)",
	);
	console.info(
		"  --threshold, -t   Semantic similarity threshold 0-1 (if omitted: contextCompact policy, then DEFAULT_SIMILARITY_THRESHOLD)",
	);
	console.info(
		"  --harness-dir     Directory for semantic index (default: .harness)",
	);
	console.info(
		"  --paths           Path filters: include:src,docs;exclude:dist,node_modules",
	);
	console.info("  --strict-semantic Fail if semantic retrieval is unavailable");
	console.info("  --json, -j        Output as JSON (default)");
	console.info("  --text            Output human-readable text");
	console.info("  --help, -h        Show this help");
	console.info("");
	console.info("Examples:");
	console.info('  harness search "policy gate"');
	console.info('  harness search "risk tier" --mode lexical --text');
	console.info('  harness search "oauth" --mode semantic --threshold 0.8');
	console.info(
		'  harness search "gate" --paths "include:src;exclude:src/generated"',
	);
	console.info('  harness search "authz" --mode hybrid --strict-semantic');
	return PARSE_EXIT_CODES.SUCCESS;
}

function parsePathsArg(
	value: string,
	rawIncludePaths: string[],
	rawExcludePaths: string[],
): { ok: true } | { ok: false; exitCode: number } {
	const parsed = parsePathFilters(value.split(";"));
	for (const warning of parsed.warnings) {
		console.warn(`Warning: ${warning}`);
	}
	for (const path of parsed.include) {
		const validation = validatePathPrefix(path, "include path");
		if (!validation.ok) {
			console.error(`Error: ${validation.message}`);
			return { ok: false, exitCode: PARSE_EXIT_CODES.VALIDATION_ERROR };
		}
		rawIncludePaths.push(validation.value);
	}
	for (const path of parsed.exclude) {
		const validation = validatePathPrefix(path, "exclude path");
		if (!validation.ok) {
			console.error(`Error: ${validation.message}`);
			return { ok: false, exitCode: PARSE_EXIT_CODES.VALIDATION_ERROR };
		}
		rawExcludePaths.push(validation.value);
	}
	return { ok: true };
}

interface ParsedSearchState {
	rawQuery: string;
	mode: SearchMode;
	limit?: number;
	threshold?: number;
	json?: boolean;
	text: boolean;
	rawHarnessDir?: string;
	rawIncludePaths: string[];
	rawExcludePaths: string[];
	strictSemantic: boolean;
}

function finalizeParsedSearchState(
	state: ParsedSearchState,
): { ok: true; options: SearchOptions } | { ok: false; exitCode: number } {
	if (!state.rawQuery) {
		console.error("Usage: harness search <query> [options]");
		console.error("Try: harness search --help");
		return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
	}
	const queryValidation = validateLength(
		state.rawQuery,
		MAX_INPUT_LENGTH,
		"query",
	);
	if (!queryValidation.ok) {
		console.error(`Error: ${queryValidation.error.message}`);
		return { ok: false, exitCode: PARSE_EXIT_CODES.VALIDATION_ERROR };
	}
	return {
		ok: true,
		options: {
			query: queryValidation.value,
			mode: state.mode,
			text: state.text,
			strictSemantic: state.strictSemantic,
			...(state.rawIncludePaths.length > 0
				? { includePaths: state.rawIncludePaths }
				: {}),
			...(state.rawExcludePaths.length > 0
				? { excludePaths: state.rawExcludePaths }
				: {}),
			...(state.limit !== undefined ? { limit: state.limit } : {}),
			...(state.threshold !== undefined ? { threshold: state.threshold } : {}),
			...(state.json !== undefined ? { json: state.json } : {}),
			...(state.rawHarnessDir !== undefined
				? { harnessDir: state.rawHarnessDir }
				: {}),
		},
	};
}

/**
 * Parse `harness search` CLI args into normalized options.
 */
export function parseSearchArgs(
	args: string[],
): { ok: true; options: SearchOptions } | { ok: false; exitCode: number } {
	let rawQuery = "";
	let mode: SearchMode = "hybrid";
	let limit: number | undefined;
	let threshold: number | undefined;
	let json: boolean | undefined;
	let text = false;
	let rawHarnessDir: string | undefined;
	const rawIncludePaths: string[] = [];
	const rawExcludePaths: string[] = [];
	let strictSemantic = false;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--mode" || arg === "-m") {
			const value = args[i + 1];
			if (!isSearchMode(value)) {
				console.error("Error: --mode requires lexical, semantic, or hybrid");
				return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
			}
			i++;
			mode = value;
			continue;
		}
			if (arg === "--limit" || arg === "-l") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --limit requires a numeric value");
				return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
			}
				i++;
				limit = Number.parseInt(value, 10);
				if (!Number.isInteger(limit) || limit <= 0) {
					console.error("Error: --limit must be a positive integer");
					return { ok: false, exitCode: PARSE_EXIT_CODES.VALIDATION_ERROR };
				}
				continue;
			}
		if (arg === "--threshold" || arg === "-t") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --threshold requires a numeric value");
				return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
			}
				i++;
				threshold = Number.parseFloat(value);
				if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
					console.error("Error: --threshold must be between 0 and 1");
					return { ok: false, exitCode: PARSE_EXIT_CODES.VALIDATION_ERROR };
				}
				continue;
			}
			if (arg === "--json" || arg === "-j") {
				json = true;
				text = false;
				continue;
			}
			if (arg === "--text") {
				text = true;
				json = false;
				continue;
			}
		if (arg === "--harness-dir") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --harness-dir requires a value");
				return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
			}
			const dirValidation = validatePathComponent(
				value,
				undefined,
				"harness-dir",
			);
			if (!dirValidation.ok) {
				console.error(`Error: ${dirValidation.error.message}`);
				return { ok: false, exitCode: PARSE_EXIT_CODES.VALIDATION_ERROR };
			}
			i++;
			rawHarnessDir = dirValidation.value;
			continue;
		}
		if (arg === "--paths") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error(
					"Error: --paths requires a value like include:src,docs;exclude:dist,node_modules",
				);
				return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
			}
			i++;
			const parsed = parsePathsArg(value, rawIncludePaths, rawExcludePaths);
			if (!parsed.ok) return parsed;
			continue;
		}
		if (arg === "--strict-semantic") {
			strictSemantic = true;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			return { ok: false, exitCode: printSearchUsage() };
		}
		if (arg?.startsWith("-")) {
			console.error(`Error: unknown argument '${arg}'`);
			return { ok: false, exitCode: PARSE_EXIT_CODES.ERROR };
		}
		if (arg && !rawQuery) {
			rawQuery = arg;
			continue;
		}
		if (arg) {
			rawQuery += ` ${arg}`;
		}
	}
	return finalizeParsedSearchState({
		rawQuery,
		mode,
		text,
		rawIncludePaths,
		rawExcludePaths,
		strictSemantic,
		...(limit !== undefined ? { limit } : {}),
		...(threshold !== undefined ? { threshold } : {}),
		...(json !== undefined ? { json } : {}),
		...(rawHarnessDir !== undefined ? { rawHarnessDir } : {}),
	});
}
