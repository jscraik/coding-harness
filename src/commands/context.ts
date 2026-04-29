/**
 * Context Compound CLI command
 *
 * Retrieve relevant prior work using semantic search.
 */

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
import { searchLexicalFallback } from "../lib/context-compound/lexical-fallback.js";
import { OllamaClient } from "../lib/context-compound/ollama.js";
import {
	CP4B_ENABLED_ENV,
	isCp4bLexicalFallbackEnabled,
} from "../lib/context-compound/rollout.js";
import { VectorStore } from "../lib/context-compound/store.js";
import type { SearchResult } from "../lib/context-compound/types.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NO_RESULTS: 1,
	OLLAMA_UNAVAILABLE: 2,
	ERROR: 3,
} as const;

/**
 * CLI options for `harness context`.
 */
export interface ContextOptions {
	/** Query string */
	query: string;
	/** Maximum results to return */
	limit?: number | undefined;
	/** Similarity threshold (0-1) */
	threshold?: number | undefined;
	/** Output as JSON */
	json?: boolean | undefined;
	/** Base directory */
	baseDir?: string | undefined;
	/** Harness directory name */
	harnessDir?: string | undefined;
	/** Explicitly enable CP4b lexical fallback when semantic backend is unavailable */
	lexicalFallback?: boolean | undefined;
}

/**
 * Structured output for context query execution.
 */
export interface ContextOutput {
	/** Whether the query succeeded */
	success: boolean;
	/** Query that was run */
	query: string;
	/** Number of results found */
	count: number;
	/** Search results */
	results: SearchResult[];
	/** Result source lane */
	source?: "semantic" | "lexical_degraded";
	/** Error message if failed */
	error?: string;
}

function printContextUsage(write: (message: string) => void): void {
	write("Usage: harness context <query> [options]");
	write("");
	write("Options:");
	write(
		"  --limit, -l       Maximum results (if omitted: contextCompact policy, then DEFAULT_SEARCH_LIMIT)",
	);
	write(
		"  --threshold, -t   Similarity threshold 0-1 (if omitted: contextCompact policy, then DEFAULT_SIMILARITY_THRESHOLD)",
	);
	write("  --json, -j        Output as JSON");
	write(
		"  --harness-dir     Directory for context database (default: .harness)",
	);
	write(
		`  --lexical-fallback  Use CP4b lexical fallback when enabled or ${CP4B_ENABLED_ENV}=1`,
	);
	write("  --help, -h        Show this help");
	write("");
	write("Examples:");
	write('  harness context "implementing OAuth"');
	write('  harness context "database migrations" --limit 5');
	write('  harness context "API design" --threshold 0.8 --json');
}

function isFlagToken(value: string | undefined): boolean {
	return value?.startsWith("-") ?? false;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!/^-?\d+$/.test(trimmed)) {
		return undefined;
	}
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return undefined;
	}
	return parsed;
}

function parseThreshold(value: string | undefined): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const trimmed = value.trim();
	if (!/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) {
		return undefined;
	}
	const parsed = Number.parseFloat(trimmed);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
		return undefined;
	}
	return parsed;
}

/**
 * Resolve search limit and threshold from options and compact policy.
 *
 * @param options - Query options
 * @param baseDir - Base directory
 * @returns Resolved parameters, or null if policy loading failed
 */
function resolveSearchParameters(
	options: ContextOptions,
	baseDir: string,
): { limit: number; threshold: number } | null {
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
			if (options.json) {
				const output: ContextOutput = {
					success: false,
					query: options.query,
					count: 0,
					results: [],
					error: message,
				};
				console.info(JSON.stringify(output, null, 2));
			} else {
				console.error(`Error: ${message}`);
			}
			return null;
		}
	}
	const limit = options.limit ?? compactDefaults?.limit ?? DEFAULT_SEARCH_LIMIT;
	const threshold =
		options.threshold ??
		compactDefaults?.threshold ??
		DEFAULT_SIMILARITY_THRESHOLD;
	return { limit, threshold };
}

/**
 * Attempt lexical fallback search when semantic backend is unavailable.
 *
 * @param options - Query options
 * @param baseDir - Base directory
 * @param harnessDir - Harness directory name
 * @param limit - Maximum results
 * @returns Exit code if fallback was executed, or null if Ollama is available
 */
async function tryLexicalFallback(
	options: ContextOptions,
	baseDir: string,
	harnessDir: string,
	limit: number,
): Promise<number | null> {
	const ollama = new OllamaClient();
	if (await ollama.isAvailable()) return null;

	const results = searchLexicalFallback(baseDir, options.query, {
		harnessDir,
		limit,
	});
	printSearchResults(options, results, "lexical_degraded");
	return results.length > 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.NO_RESULTS;
}

/**
 * Write a context failure message in JSON or plain text format.
 *
 * @param options - Query options
 * @param error - Error message
 */
function writeContextFailure(options: ContextOptions, error: string): void {
	if (options.json) {
		console.info(
			JSON.stringify({
				success: false,
				query: options.query,
				count: 0,
				results: [],
				error,
			}),
		);
	} else {
		console.error(`✗ ${error}`);
	}
}

/**
 * Print search results in JSON or plain text format.
 *
 * @param options - Query options
 * @param results - Search results
 * @param source - Result source lane
 * @param threshold - Similarity threshold (for semantic output only)
 */
function printSearchResults(
	options: ContextOptions,
	results: SearchResult[],
	source: "semantic" | "lexical_degraded",
	threshold?: number,
): void {
	if (options.json) {
		const output: ContextOutput = {
			success: true,
			query: options.query,
			count: results.length,
			results,
			source,
		};
		console.info(JSON.stringify(output, null, 2));
		return;
	}

	if (results.length === 0) {
		if (source === "lexical_degraded") {
			console.info(`No lexical fallback results found for: "${options.query}"`);
		} else {
			console.info(`No results found for: "${options.query}"`);
			if (threshold !== undefined) {
				console.info(`Threshold: ${threshold}`);
			}
		}
		return;
	}

	const label =
		source === "lexical_degraded" ? "lexical fallback result(s)" : "result(s)";
	console.info(`Found ${results.length} ${label} for: "${options.query}"`);
	console.info();

	for (const [i, r] of results.entries()) {
		console.info(`${i + 1}. ${r.path}`);
		console.info(`   Similarity: ${(r.similarity * 100).toFixed(1)}%`);
		if (r.metadata) {
			console.info(`   Type: ${r.metadata.type}`);
			console.info(`   Topic: ${r.metadata.topic}`);
			console.info(`   Date: ${r.metadata.date}`);
		}
		if (source === "lexical_degraded") {
			console.info("   Mode: lexical_degraded");
		}
		console.info();
	}
}

/**
 * Run a context query.
 *
 * @param options - Query options
 * @returns Exit code
 */
export async function runContext(options: ContextOptions): Promise<number> {
	const baseDir = options.baseDir ?? process.cwd();
	const harnessDir = options.harnessDir ?? DEFAULT_HARNESS_DIR;
	const params = resolveSearchParameters(options, baseDir);
	if (!params) return EXIT_CODES.ERROR;
	const { limit, threshold } = params;
	const dbPath = join(baseDir, harnessDir, DEFAULT_DB_FILENAME);
	const lexicalFallbackEnabled = isCp4bLexicalFallbackEnabled(
		options.lexicalFallback,
	);

	if (lexicalFallbackEnabled) {
		const fallbackResult = await tryLexicalFallback(
			options,
			baseDir,
			harnessDir,
			limit,
		);
		if (fallbackResult !== null) return fallbackResult;
	}

	const store = new VectorStore(dbPath);
	const initResult = store.init();
	if (!initResult.ok) {
		const normalized = normalizeStoreInitError(initResult.error.message);
		writeContextFailure(
			options,
			`Failed to initialize store: ${normalized.message}`,
		);
		return EXIT_CODES.ERROR;
	}

	const ollama = new OllamaClient();
	const isAvailable = await ollama.isAvailable();
	if (!isAvailable) {
		writeContextFailure(
			options,
			"Ollama not available. Please start Ollama or install it.",
		);
		if (!options.json) {
			console.error("   Install: https://ollama.com");
			console.error("   Start: ollama serve");
		}
		store.close();
		return EXIT_CODES.OLLAMA_UNAVAILABLE;
	}

	const embedResult = await ollama.embed(options.query);
	if (!embedResult.ok) {
		writeContextFailure(
			options,
			`Embedding failed: ${embedResult.error.message}`,
		);
		store.close();
		return EXIT_CODES.ERROR;
	}

	const searchResult = store.search(embedResult.value, {
		threshold,
		limit,
		includeMetadata: true,
	});
	store.close();

	if (!searchResult.ok) {
		writeContextFailure(
			options,
			`Search failed: ${searchResult.error.message}`,
		);
		return EXIT_CODES.ERROR;
	}

	printSearchResults(options, searchResult.value, "semantic", threshold);
	return searchResult.value.length > 0
		? EXIT_CODES.SUCCESS
		: EXIT_CODES.NO_RESULTS;
}

/**
 * CLI entry point for context command
 */
export async function runContextCLI(args: string[]): Promise<number> {
	// Parse arguments
	let query = "";
	let limit: number | undefined;
	let threshold: number | undefined;
	let json = false;
	let harnessDir: string | undefined;
	let lexicalFallback = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--limit" || arg === "-l") {
			const val = args[i + 1];
			if (!val || isFlagToken(val)) {
				console.error("Error: --limit requires a numeric value");
				return EXIT_CODES.ERROR;
			}
			const parsedLimit = parsePositiveInteger(val);
			if (parsedLimit !== undefined) {
				limit = parsedLimit;
			} else {
				console.error(
					`Error: --limit expects a positive integer, got '${val}'`,
				);
				return EXIT_CODES.ERROR;
			}
			i++;
		} else if (arg === "--threshold" || arg === "-t") {
			const val = args[i + 1];
			if (!val || isFlagToken(val)) {
				console.error("Error: --threshold requires a numeric value");
				return EXIT_CODES.ERROR;
			}
			const parsedThreshold = parseThreshold(val);
			if (parsedThreshold !== undefined) {
				threshold = parsedThreshold;
			} else {
				console.error(
					`Error: --threshold expects a number between 0 and 1, got '${val}'`,
				);
				return EXIT_CODES.ERROR;
			}
			i++;
		} else if (arg === "--json" || arg === "-j") {
			json = true;
		} else if (arg === "--lexical-fallback") {
			lexicalFallback = true;
		} else if (arg === "--harness-dir") {
			const val = args[i + 1];
			if (!val || isFlagToken(val)) {
				continue;
			}
			harnessDir = val;
			i++;
		} else if (arg === "--help" || arg === "-h") {
			printContextUsage(console.info);
			return EXIT_CODES.SUCCESS;
		} else if (arg && !arg.startsWith("-") && !query) {
			query = arg;
		} else if (arg && !arg.startsWith("-")) {
			query += ` ${arg}`;
		}
	}

	if (!query) {
		printContextUsage(console.error);
		return EXIT_CODES.ERROR;
	}

	return runContext({
		query,
		limit,
		threshold,
		json,
		harnessDir,
		lexicalFallback,
	});
}
