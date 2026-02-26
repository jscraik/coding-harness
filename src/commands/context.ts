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
import { OllamaClient } from "../lib/context-compound/ollama.js";
import { VectorStore } from "../lib/context-compound/store.js";
import type { SearchResult } from "../lib/context-compound/types.js";
import { validatePath } from "../lib/input/validator.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	NO_RESULTS: 1,
	OLLAMA_UNAVAILABLE: 2,
	ERROR: 3,
} as const;

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
}

export interface ContextOutput {
	/** Whether the query succeeded */
	success: boolean;
	/** Query that was run */
	query: string;
	/** Number of results found */
	count: number;
	/** Search results */
	results: SearchResult[];
	/** Error message if failed */
	error?: string;
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
	let harnessPath: string;
	try {
		harnessPath = validatePath(baseDir, harnessDir);
	} catch {
		const error = `Invalid harness directory: ${harnessDir}`;
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
		return EXIT_CODES.ERROR;
	}
	const dbPath = join(harnessPath, DEFAULT_DB_FILENAME);

	// Initialize store
	const store = new VectorStore(dbPath);
	const initResult = store.init();

	if (!initResult.ok) {
		const error = `Failed to initialize store: ${initResult.error.message}`;
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
		return EXIT_CODES.ERROR;
	}

	// Check Ollama availability
	const ollama = new OllamaClient();
	const isAvailable = await ollama.isAvailable();

	if (!isAvailable) {
		const error = "Ollama not available. Please start Ollama or install it.";
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
			console.error("   Install: https://ollama.com");
			console.error("   Start: ollama serve");
		}
		store.close();
		return EXIT_CODES.OLLAMA_UNAVAILABLE;
	}

	// Generate query embedding
	const embedResult = await ollama.embed(options.query);

	if (!embedResult.ok) {
		const error = `Embedding failed: ${embedResult.error.message}`;
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
		store.close();
		return EXIT_CODES.ERROR;
	}

	// Search
	const threshold = options.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
	const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;

	const searchResult = store.search(embedResult.value, {
		threshold,
		limit,
		includeMetadata: true,
	});

	store.close();

	if (!searchResult.ok) {
		const error = `Search failed: ${searchResult.error.message}`;
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
		return EXIT_CODES.ERROR;
	}

	const results = searchResult.value;

	// Output results
	if (options.json) {
		const output: ContextOutput = {
			success: true,
			query: options.query,
			count: results.length,
			results,
		};
		console.info(JSON.stringify(output, null, 2));
	} else {
		if (results.length === 0) {
			console.info(`No results found for: "${options.query}"`);
			console.info(`Threshold: ${threshold}`);
		} else {
			console.info(`Found ${results.length} result(s) for: "${options.query}"`);
			console.info();

			for (const [i, r] of results.entries()) {
				console.info(`${i + 1}. ${r.path}`);
				console.info(`   Similarity: ${(r.similarity * 100).toFixed(1)}%`);
				if (r.metadata) {
					console.info(`   Type: ${r.metadata.type}`);
					console.info(`   Topic: ${r.metadata.topic}`);
					console.info(`   Date: ${r.metadata.date}`);
				}
				console.info();
			}
		}
	}

	return results.length > 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.NO_RESULTS;
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

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--limit" || arg === "-l") {
			const val = args[i + 1];
			if (!val || val.startsWith("-")) {
				console.error("Error: --limit requires a numeric value");
				return EXIT_CODES.ERROR;
			}
			i++;
			if (val) limit = Number.parseInt(val, 10);
		} else if (arg === "--threshold" || arg === "-t") {
			const val = args[i + 1];
			if (!val || val.startsWith("-")) {
				console.error("Error: --threshold requires a numeric value");
				return EXIT_CODES.ERROR;
			}
			i++;
			if (val) threshold = Number.parseFloat(val);
		} else if (arg === "--json" || arg === "-j") {
			json = true;
		} else if (arg === "--harness-dir") {
			const val = args[i + 1];
			if (!val || val.startsWith("-")) {
				console.error("Error: --harness-dir requires a value");
				return EXIT_CODES.ERROR;
			}
			i++;
			if (val) harnessDir = val;
		} else if (arg && !arg.startsWith("-") && !query) {
			query = arg;
		} else if (arg && !arg.startsWith("-")) {
			query += ` ${arg}`;
		}
	}

	if (!query) {
		console.error("Usage: harness context <query> [options]");
		console.error("");
		console.error("Options:");
		console.error("  --limit, -l       Maximum results (default: 10)");
		console.error(
			"  --threshold, -t   Similarity threshold 0-1 (default: 0.7)",
		);
		console.error("  --json, -j        Output as JSON");
		console.error(
			"  --harness-dir     Directory for context database (default: .harness)",
		);
		console.error("");
		console.error("Examples:");
		console.error('  harness context "implementing OAuth"');
		console.error('  harness context "database migrations" --limit 5');
		console.error('  harness context "API design" --threshold 0.8 --json');
		return EXIT_CODES.ERROR;
	}

	return runContext({ query, limit, threshold, json, harnessDir });
}
