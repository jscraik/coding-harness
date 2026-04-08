/**
 * Search CLI command
 *
 * Agent-first hybrid search that combines lexical (ripgrep) and semantic
 * (context-compound embeddings) retrieval.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
	DEFAULT_DB_FILENAME,
	DEFAULT_HARNESS_DIR,
	DEFAULT_SEARCH_LIMIT,
	DEFAULT_SIMILARITY_THRESHOLD,
} from "../lib/context-compound/constants.js";
import {
	loadContextCompactPolicy,
	resolveContextCompactDefaults,
} from "../lib/context-compound/context-compact-policy.js";
import { normalizeStoreInitError } from "../lib/context-compound/init-error.js";
import { OllamaClient } from "../lib/context-compound/ollama.js";
import { VectorStore } from "../lib/context-compound/store.js";
import type { SearchResult as SemanticSearchResult } from "../lib/context-compound/types.js";
import {
	MAX_INPUT_LENGTH,
	validateLength,
	validatePathComponent,
} from "../lib/input/validation.js";
import { validatePath } from "../lib/input/validator.js";
import { type CliResult, createError, err, ok } from "../lib/result/types.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	NO_RESULTS: 1,
	SEMANTIC_UNAVAILABLE: 2,
	ERROR: 3,
	VALIDATION_ERROR: 4,
} as const;

export type SearchMode = "lexical" | "semantic" | "hybrid";
export type SearchSource = "lexical" | "semantic";

export interface SearchOptions {
	query: string;
	mode?: SearchMode;
	limit?: number;
	threshold?: number;
	json?: boolean;
	baseDir?: string;
	harnessDir?: string;
	text?: boolean;
	includePaths?: string[];
	excludePaths?: string[];
	strictSemantic?: boolean;
}

export interface SearchMatch {
	path: string;
	line?: number;
	column?: number;
	snippet?: string;
	score: number;
	source: SearchSource;
	metadata?: SemanticSearchResult["metadata"];
}

export interface SearchOutput {
	success: boolean;
	query: string;
	mode: SearchMode;
	count: number;
	results: SearchMatch[];
	warnings?: string[];
	error?: string;
}

interface RgJsonMatch {
	type: "match";
	data: {
		path?: { text?: string };
		line_number?: number;
		lines?: { text?: string };
		submatches?: Array<{ start?: number }>;
	};
}

function isSearchMode(value: string | undefined): value is SearchMode {
	return value === "lexical" || value === "semantic" || value === "hybrid";
}

function normalizeRelativePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function matchesPrefixFilter(path: string, prefixes: string[]): boolean {
	if (prefixes.length === 0) return true;
	const normalized = normalizeRelativePath(path);
	return prefixes.some((prefix) => {
		const normalizedPrefix = normalizeRelativePath(prefix).replace(/\/+$/, "");
		return (
			normalized === normalizedPrefix ||
			normalized.startsWith(`${normalizedPrefix}/`)
		);
	});
}

function matchesPathFilters(
	path: string,
	includePaths: string[],
	excludePaths: string[],
): boolean {
	const included = matchesPrefixFilter(path, includePaths);
	if (!included) return false;
	if (excludePaths.length === 0) return true;
	return !excludePaths.some((prefix) => {
		const normalizedPath = normalizeRelativePath(path);
		const normalizedPrefix = normalizeRelativePath(prefix).replace(/\/+$/, "");
		return (
			normalizedPath === normalizedPrefix ||
			normalizedPath.startsWith(`${normalizedPrefix}/`)
		);
	});
}

interface PathFilterResult {
	include: string[];
	exclude: string[];
	warnings: string[];
}

function parsePathFilters(parts: string[]): PathFilterResult {
	const include: string[] = [];
	const exclude: string[] = [];
	const warnings: string[] = [];

	for (const rawPart of parts) {
		const part = rawPart.trim();
		if (!part) continue;
		const [kind, value] = part.split(":");
		if (!kind || !value) {
			warnings.push(
				`Invalid filter format: "${rawPart}" (expected format: include:path or exclude:path)`,
			);
			continue;
		}
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
		if (kind === "include") {
			include.push(...tokens);
		} else {
			exclude.push(...tokens);
		}
	}
	return { include, exclude, warnings };
}

function validatePathPrefix(value: string, field: string): CliResult<string> {
	const normalized = normalizeRelativePath(value).replace(/\/+$/, "");
	if (!normalized) {
		return err(
			createError("VALIDATION_ERROR", `${field} cannot be empty`, {
				field,
				value,
			}),
		);
	}
	if (normalized.startsWith("/")) {
		return err(
			createError(
				"VALIDATION_ERROR",
				`${field} must be a relative path prefix`,
				{
					field,
					value,
				},
			),
		);
	}
	if (normalized.includes("\0")) {
		return err(
			createError("VALIDATION_ERROR", `${field} cannot contain null bytes`, {
				field,
				value,
			}),
		);
	}

	const segments = normalized.split("/");
	for (const segment of segments) {
		if (segment === "" || segment === "." || segment === "..") {
			return err(
				createError(
					"VALIDATION_ERROR",
					`${field} cannot contain relative path segments`,
					{
						field,
						value,
					},
				),
			);
		}
		const segmentValidation = validatePathComponent(
			segment,
			undefined,
			`${field} segment`,
		);
		if (!segmentValidation.ok) {
			return err(segmentValidation.error);
		}
	}

	return ok(normalized);
}

/**
 * Run lexical search using ripgrep.
 */
function runLexicalSearch(
	query: string,
	baseDir: string,
	limit: number,
	includePaths: string[],
	excludePaths: string[],
): CliResult<SearchMatch[]> {
	const maxMatches = Math.max(limit * 8, 50);
	const rgArgs = [
		"--json",
		"--line-number",
		"--column",
		"--smart-case",
		"--fixed-strings",
		"--glob",
		"!.git",
		"--glob",
		"!node_modules",
		"--glob",
		"!dist",
		"--max-count",
		String(maxMatches),
		"--",
		query,
		baseDir,
	];
	for (const includePath of includePaths) {
		rgArgs.push("--glob", `${normalizeRelativePath(includePath)}/**`);
	}
	for (const excludePath of excludePaths) {
		rgArgs.push("--glob", `!${normalizeRelativePath(excludePath)}/**`);
	}

	const result = spawnSync("rg", rgArgs, {
		encoding: "utf-8",
		timeout: 30000,
		maxBuffer: 10 * 1024 * 1024,
	});

	if (result.error) {
		return err(
			createError(
				"SYSTEM_ERROR",
				`Failed to run rg: ${result.error.message}`,
				undefined,
				result.error,
			),
		);
	}

	if (result.status !== 0 && result.status !== 1) {
		const stderr = result.stderr.trim();
		return err(
			createError(
				"SYSTEM_ERROR",
				stderr ? `rg failed: ${stderr}` : "rg failed",
			),
		);
	}

	if (result.status === 1 || !result.stdout.trim()) {
		return ok([]);
	}

	const matches: SearchMatch[] = [];
	const lowerQuery = query.toLowerCase();

	for (const line of result.stdout.split("\n")) {
		if (!line.trim()) continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}

		const event = parsed as { type?: string };
		if (event.type !== "match") continue;

		const match = parsed as RgJsonMatch;
		const path = match.data.path?.text;
		if (!path) continue;
		const relativePath = normalizeRelativePath(path.replace(`${baseDir}/`, ""));
		if (!matchesPathFilters(relativePath, includePaths, excludePaths)) {
			continue;
		}

		const snippet = match.data.lines?.text?.replace(/\r?\n$/, "");
		const snippetLower = snippet?.toLowerCase() ?? "";
		const queryIsExact = snippetLower.includes(lowerQuery);
		const score = queryIsExact ? 1 : 0.9;

		const lexicalMatch: SearchMatch = {
			path: relativePath,
			...(match.data.line_number !== undefined
				? { line: match.data.line_number }
				: {}),
			...(match.data.submatches?.[0]?.start !== undefined
				? { column: match.data.submatches[0].start }
				: {}),
			...(snippet !== undefined ? { snippet } : {}),
			score,
			source: "lexical",
		};
		matches.push(lexicalMatch);

		if (matches.length >= maxMatches) break;
	}

	return ok(matches.slice(0, limit));
}

async function runSemanticSearch(
	query: string,
	baseDir: string,
	harnessDir: string,
	limit: number,
	threshold: number,
	includePaths: string[],
	excludePaths: string[],
): Promise<{
	results: SearchMatch[];
	warning?: string;
	unavailable?: boolean;
}> {
	let harnessPath: string;
	try {
		harnessPath = validatePath(baseDir, harnessDir);
	} catch {
		return {
			results: [],
			warning: `Invalid harness directory: ${harnessDir}`,
		};
	}

	const dbPath = join(harnessPath, DEFAULT_DB_FILENAME);
	const store = new VectorStore(dbPath);
	const initResult = store.init();

	if (!initResult.ok) {
		const normalized = normalizeStoreInitError(initResult.error.message);
		return {
			results: [],
			warning: `Failed to initialize semantic store: ${normalized.message}`,
			unavailable: normalized.unavailable,
		};
	}

	const ollama = new OllamaClient();
	const isAvailable = await ollama.isAvailable();

	if (!isAvailable) {
		store.close();
		return {
			results: [],
			warning: "Semantic search unavailable: Ollama is not running",
			unavailable: true,
		};
	}

	const embedResult = await ollama.embed(query);
	if (!embedResult.ok) {
		store.close();
		return {
			results: [],
			warning: `Embedding failed: ${embedResult.error.message}`,
		};
	}

	const searchResult = store.search(embedResult.value, {
		threshold,
		limit,
		includeMetadata: true,
	});
	store.close();

	if (!searchResult.ok) {
		return {
			results: [],
			warning: `Semantic search failed: ${searchResult.error.message}`,
		};
	}

	const results = searchResult.value
		.map((item) => ({
			path: normalizeRelativePath(item.path),
			score: item.similarity,
			source: "semantic" as const,
			...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
		}))
		.filter((item) =>
			matchesPathFilters(item.path, includePaths, excludePaths),
		);

	return { results };
}

function mergeResults(
	lexical: SearchMatch[],
	semantic: SearchMatch[],
	limit: number,
): SearchMatch[] {
	const seen = new Set<string>();
	const merged: SearchMatch[] = [];

	const ingest = (items: SearchMatch[]) => {
		for (const item of items) {
			const key = `${item.source}:${item.path}:${item.line ?? ""}:${item.snippet ?? ""}`;
			if (seen.has(key)) continue;
			seen.add(key);
			merged.push(item);
			if (merged.length >= limit) return;
		}
	};

	// Gold-standard agent-first preference: exact lexical hits first, semantic second.
	ingest(lexical.sort((a, b) => b.score - a.score));
	if (merged.length < limit) {
		ingest(semantic.sort((a, b) => b.score - a.score));
	}

	return merged;
}

export async function runSearch(options: SearchOptions): Promise<number> {
	const mode = options.mode ?? "hybrid";
	if (!isSearchMode(mode)) {
		const error = `Invalid mode: ${String(options.mode)}. Use lexical|semantic|hybrid`;
		if (options.json ?? !options.text) {
			console.info(
				JSON.stringify({
					success: false,
					query: options.query,
					mode,
					count: 0,
					results: [],
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
		}
		return EXIT_CODES.ERROR;
	}

	const baseDir = options.baseDir ?? process.cwd();
	let compactDefaults: { limit: number; threshold: number } | undefined;
	if (options.limit === undefined || options.threshold === undefined) {
		const compactPolicy = loadContextCompactPolicy(baseDir);
		compactDefaults = resolveContextCompactDefaults(
			options.query,
			compactPolicy,
			DEFAULT_SEARCH_LIMIT,
			DEFAULT_SIMILARITY_THRESHOLD,
		);
	}

	const outputJson = options.json ?? !options.text;
	const limit = options.limit ?? compactDefaults?.limit ?? DEFAULT_SEARCH_LIMIT;
	if (!Number.isFinite(limit) || limit < 1) {
		const error = "--limit must be a positive number";
		if (outputJson) {
			console.info(
				JSON.stringify({
					success: false,
					query: options.query,
					mode,
					count: 0,
					results: [],
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
		}
		return EXIT_CODES.ERROR;
	}

	const threshold =
		options.threshold ??
		compactDefaults?.threshold ??
		DEFAULT_SIMILARITY_THRESHOLD;
	const harnessDir = options.harnessDir ?? DEFAULT_HARNESS_DIR;
	const includePaths = options.includePaths ?? [];
	const excludePaths = options.excludePaths ?? [];
	const warnings: string[] = [];

	let lexicalResults: SearchMatch[] = [];
	let semanticResults: SearchMatch[] = [];
	let semanticUnavailable = false;

	if (mode === "lexical" || mode === "hybrid") {
		const lexicalResult = runLexicalSearch(
			options.query,
			baseDir,
			limit,
			includePaths,
			excludePaths,
		);
		if (!lexicalResult.ok) {
			const message = lexicalResult.error.message;
			if (outputJson) {
				console.info(
					JSON.stringify({
						success: false,
						query: options.query,
						mode,
						count: 0,
						results: [],
						error: message,
					}),
				);
			} else {
				console.error(`✗ ${message}`);
			}
			return EXIT_CODES.ERROR;
		}
		lexicalResults = lexicalResult.value;
	}

	if (mode === "semantic" || mode === "hybrid") {
		const semantic = await runSemanticSearch(
			options.query,
			baseDir,
			harnessDir,
			limit,
			threshold,
			includePaths,
			excludePaths,
		);
		semanticResults = semantic.results;
		if (semantic.warning) warnings.push(semantic.warning);
		semanticUnavailable = semantic.unavailable ?? false;
	}

	if ((options.strictSemantic ?? false) && warnings.length > 0) {
		const error = `Strict semantic mode enabled: ${warnings.join("; ")}`;
		if (outputJson) {
			console.info(
				JSON.stringify({
					success: false,
					query: options.query,
					mode,
					count: 0,
					results: [],
					warnings,
					error,
				}),
			);
		} else {
			console.error(`✗ ${error}`);
		}
		return semanticUnavailable
			? EXIT_CODES.SEMANTIC_UNAVAILABLE
			: EXIT_CODES.ERROR;
	}

	const results =
		mode === "lexical"
			? lexicalResults
			: mode === "semantic"
				? semanticResults
				: mergeResults(lexicalResults, semanticResults, limit);

	const output: SearchOutput = {
		success: true,
		query: options.query,
		mode,
		count: results.length,
		results,
		...(warnings.length > 0 ? { warnings } : {}),
	};

	if (outputJson) {
		console.info(JSON.stringify(output, null, 2));
	} else if (results.length === 0) {
		console.info(`No results found for: "${options.query}"`);
		for (const warning of warnings) {
			console.info(`Warning: ${warning}`);
		}
	} else {
		console.info(
			`Found ${results.length} result(s) for "${options.query}" [${mode}]`,
		);
		for (const [index, result] of results.entries()) {
			console.info(`${index + 1}. ${result.path}`);
			if (result.line !== undefined) {
				console.info(`   Line: ${result.line}`);
			}
			console.info(
				`   Source: ${result.source} | Score: ${(result.score * 100).toFixed(1)}%`,
			);
			if (result.snippet) {
				console.info(`   ${result.snippet.slice(0, 200)}`);
			}
		}
		for (const warning of warnings) {
			console.info(`Warning: ${warning}`);
		}
	}

	if (results.length > 0) return EXIT_CODES.SUCCESS;
	if (mode === "semantic" && semanticUnavailable) {
		return EXIT_CODES.SEMANTIC_UNAVAILABLE;
	}
	return EXIT_CODES.NO_RESULTS;
}

export async function runSearchCLI(args: string[]): Promise<number> {
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
				return EXIT_CODES.ERROR;
			}
			i++;
			mode = value;
		} else if (arg === "--limit" || arg === "-l") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --limit requires a numeric value");
				return EXIT_CODES.ERROR;
			}
			i++;
			limit = Number.parseInt(value, 10);
		} else if (arg === "--threshold" || arg === "-t") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --threshold requires a numeric value");
				return EXIT_CODES.ERROR;
			}
			i++;
			threshold = Number.parseFloat(value);
		} else if (arg === "--json" || arg === "-j") {
			json = true;
		} else if (arg === "--text") {
			text = true;
			if (json === undefined) {
				json = false;
			}
		} else if (arg === "--harness-dir") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error("Error: --harness-dir requires a value");
				return EXIT_CODES.ERROR;
			}
			// Validate harness-dir as a path component (no path traversal)
			const dirValidation = validatePathComponent(
				value,
				undefined,
				"harness-dir",
			);
			if (!dirValidation.ok) {
				console.error(`Error: ${dirValidation.error.message}`);
				return EXIT_CODES.VALIDATION_ERROR;
			}
			i++;
			rawHarnessDir = dirValidation.value;
		} else if (arg === "--paths") {
			const value = args[i + 1];
			if (!value || value.startsWith("-")) {
				console.error(
					"Error: --paths requires a value like include:src,docs;exclude:dist,node_modules",
				);
				return EXIT_CODES.ERROR;
			}
			i++;
			const parsed = parsePathFilters(value.split(";"));
			// Report warnings for malformed filters
			for (const warning of parsed.warnings) {
				console.warn(`Warning: ${warning}`);
			}
			// Validate each path component
			for (const p of parsed.include) {
				const v = validatePathPrefix(p, "include path");
				if (!v.ok) {
					console.error(`Error: ${v.error.message}`);
					return EXIT_CODES.VALIDATION_ERROR;
				}
				rawIncludePaths.push(v.value);
			}
			for (const p of parsed.exclude) {
				const v = validatePathPrefix(p, "exclude path");
				if (!v.ok) {
					console.error(`Error: ${v.error.message}`);
					return EXIT_CODES.VALIDATION_ERROR;
				}
				rawExcludePaths.push(v.value);
			}
		} else if (arg === "--strict-semantic") {
			strictSemantic = true;
		} else if (arg === "--help" || arg === "-h") {
			console.info("Usage: harness search <query> [options]");
			console.info("");
			console.info("Options:");
			console.info("  --mode, -m        Search mode: lexical|semantic|hybrid");
			console.info("  --limit, -l       Maximum results (default: 10)");
			console.info(
				"  --threshold, -t   Semantic similarity threshold 0-1 (default: 0.7)",
			);
			console.info(
				"  --harness-dir     Directory for semantic index (default: .harness)",
			);
			console.info(
				"  --paths           Path filters: include:src,docs;exclude:dist,node_modules",
			);
			console.info(
				"  --strict-semantic Fail if semantic retrieval is unavailable",
			);
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
			return EXIT_CODES.SUCCESS;
		} else if (arg && !arg.startsWith("-") && !rawQuery) {
			rawQuery = arg;
		} else if (arg && !arg.startsWith("-")) {
			rawQuery += ` ${arg}`;
		}
	}

	if (!rawQuery) {
		console.error("Usage: harness search <query> [options]");
		console.error("Try: harness search --help");
		return EXIT_CODES.ERROR;
	}

	// Validate query length (prevent DoS with extremely long queries)
	const queryValidation = validateLength(rawQuery, MAX_INPUT_LENGTH, "query");
	if (!queryValidation.ok) {
		console.error(`Error: ${queryValidation.error.message}`);
		return EXIT_CODES.VALIDATION_ERROR;
	}
	const query = queryValidation.value;

	const options: SearchOptions = {
		query,
		mode,
		text,
		strictSemantic,
		...(rawIncludePaths.length > 0 ? { includePaths: rawIncludePaths } : {}),
		...(rawExcludePaths.length > 0 ? { excludePaths: rawExcludePaths } : {}),
		...(limit !== undefined ? { limit } : {}),
		...(threshold !== undefined ? { threshold } : {}),
		...(json !== undefined ? { json } : {}),
		...(rawHarnessDir !== undefined ? { harnessDir: rawHarnessDir } : {}),
	};

	return runSearch(options);
}
