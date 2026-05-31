import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	EXIT_CODES,
	type BrainCliResult,
	type BrainQueryMatch,
	type BrainQueryResult,
} from "./cli-types.js";
import {
	getBrainFlagValue,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";
import { renderBrainQueryHuman } from "./query-presenter.js";

/** Public API export. */
export function runBrainQuery(
	harnessDir: string,
	query: string,
): BrainQueryResult {
	const matches: BrainQueryMatch[] = [];
	const normalizedQuery = query.toLowerCase();

	const searchPaths: Array<{ path: string; domain: string | undefined }> = [
		{ path: "knowledge/INDEX.md", domain: undefined },
		{ path: "quality/criteria.md", domain: undefined },
		{ path: "review-log.md", domain: undefined },
	];

	const knowledgeDir = join(harnessDir, "knowledge");
	if (existsSync(knowledgeDir)) {
		for (const entry of readdirSync(knowledgeDir)) {
			const entryPath = join(knowledgeDir, entry);
			if (statSync(entryPath).isDirectory()) {
				for (const file of ["knowledge.md", "rules.md", "hypotheses.md"]) {
					searchPaths.push({
						path: `knowledge/${entry}/${file}`,
						domain: entry,
					});
				}
			}
		}
	}

	searchPaths.push({
		path: "memory/LEARNINGS.md",
		domain: undefined,
	});

	for (const sp of searchPaths) {
		const fullPath = join(harnessDir, sp.path);
		if (!existsSync(fullPath)) continue;

		const content = readFileSync(fullPath, "utf-8");
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (lines[i]?.toLowerCase().includes(normalizedQuery)) {
				matches.push({
					path: sp.path,
					lineNumber: i + 1,
					line: (lines[i] ?? "").trim(),
					domain: sp.domain,
				});
			}
		}
	}

	return { query, matches, total: matches.length };
}

/** Run the Project Brain query subcommand and render CLI output. */
export function cliBrainQuery(args: string[]): BrainCliResult {
	const queryIndex = args.indexOf("--query");
	const query = getBrainFlagValue(args, queryIndex);

	if (!query) {
		process.stderr.write("Error: --query <text> is required for brain query\n");
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	const harnessDir = resolveBrainHarnessDir(
		getBrainFlagValue(args, args.indexOf("--dir")),
	);

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const result = runBrainQuery(harnessDir, query);
	const json = shouldRenderBrainJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainQueryHuman(result));
	}

	if (result.total === 0) return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}
