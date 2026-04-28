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
import { validatePath } from "../lib/input/validator.js";
import { type CliResult, createError, err, ok } from "../lib/result/types.js";
import { parseSearchArgs } from "./search-cli-args.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	NO_RESULTS: 1,
	SEMANTIC_UNAVAILABLE: 2,
	ERROR: 3,
	VALIDATION_ERROR: 4,
} as const;

/**
 * Search execution mode.
 */
export type SearchMode = "lexical" | "semantic" | "hybrid";
/**
 * Source label for a search match.
 */
export type SearchSource = "lexical" | "semantic";

/**
 * Options for `harness search` execution.
 */
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

/**
 * Individual search match result.
 */
export interface SearchMatch {
	path: string;
	line?: number;
	column?: number;
	snippet?: string;
	score: number;
	source: SearchSource;
	metadata?: SemanticSearchResult["metadata"];
}

/**
 * Structured search command output.
 */
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

interface ResolvedSearchConfig {
	mode: SearchMode;
	baseDir: string;
	outputJson: boolean;
	limit: number;
	threshold: number;
	harnessDir: string;
	includePaths: string[];
	excludePaths: string[];
}

/**
 * Resolve and validate search configuration from options.
 */
function resolveSearchConfig(
	options: SearchOptions,
):
	| { ok: true; config: ResolvedSearchConfig }
	| { ok: false; exitCode: number } {
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
		return { ok: false, exitCode: EXIT_CODES.ERROR };
	}

	const baseDir = options.baseDir ?? process.cwd();
	const outputJson = options.json ?? !options.text;
	let compactDefaults: { limit: number; threshold: number } | undefined;
	if (options.limit === undefined || options.threshold === undefined) {
		try {
			const compactPolicy = loadContextCompactPolicy(baseDir);
			compactDefaults = resolveContextCompactDefaults(
				options.query,
				compactPolicy,
				DEFAULT_SEARCH_LIMIT,
				DEFAULT_SIMILARITY_THRESHOLD,
			);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to load context policy";
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
			return { ok: false, exitCode: EXIT_CODES.ERROR };
		}
	}
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
		return { ok: false, exitCode: EXIT_CODES.ERROR };
	}

	const threshold =
		options.threshold ??
		compactDefaults?.threshold ??
		DEFAULT_SIMILARITY_THRESHOLD;
	const harnessDir = options.harnessDir ?? DEFAULT_HARNESS_DIR;
	const includePaths = options.includePaths ?? [];
	const excludePaths = options.excludePaths ?? [];

	return {
		ok: true,
		config: {
			mode,
			baseDir,
			outputJson,
			limit,
			threshold,
			harnessDir,
			includePaths,
			excludePaths,
		},
	};
}

/**
 * Print search results to stdout in JSON or human-readable format.
 */
function printSearchOutput(
	options: SearchOptions,
	mode: SearchMode,
	results: SearchMatch[],
	warnings: string[],
	outputJson: boolean,
): void {
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
}
/**
 * Execute search retrieval and print formatted output.
 */
export async function runSearch(options: SearchOptions): Promise<number> {
	const configResult = resolveSearchConfig(options);
	if (!configResult.ok) {
		return configResult.exitCode;
	}
	const {
		mode,
		baseDir,
		outputJson,
		limit,
		threshold,
		harnessDir,
		includePaths,
		excludePaths,
	} = configResult.config;

	let lexicalResults: SearchMatch[] = [];
	let semanticResults: SearchMatch[] = [];
	let semanticUnavailable = false;
	const warnings: string[] = [];

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

	printSearchOutput(options, mode, results, warnings, outputJson);

	if (results.length > 0) return EXIT_CODES.SUCCESS;
	if (mode === "semantic" && semanticUnavailable) {
		return EXIT_CODES.SEMANTIC_UNAVAILABLE;
	}
	return EXIT_CODES.NO_RESULTS;
}
/**
 * Parse CLI args and execute the search command.
 */
export async function runSearchCLI(args: string[]): Promise<number> {
	const parseResult = parseSearchArgs(args);
	if (!parseResult.ok) {
		return parseResult.exitCode;
	}
	return runSearch(parseResult.options);
}
