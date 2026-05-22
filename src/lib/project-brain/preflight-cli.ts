import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mapFilesToDomains } from "./domain-mapper.js";
import {
	EXIT_CODES,
	type BrainCliResult,
	type BrainPreflightContext,
	type BrainPreflightResult,
} from "./cli-types.js";
import {
	getBrainFlagValue,
	inspectBrainFilesFlag,
	resolveBrainHarnessDir,
	shouldRenderBrainJson,
} from "./cli-args.js";

function extractRules(content: string): string[] {
	const rules: string[] = [];
	const regex = /^\s*-\s*\*\*R-\d+\*\*:\s*(.+)$/gm;
	for (const match of content.matchAll(regex)) {
		const rule = match[1];
		if (rule) rules.push(rule.trim());
	}
	return rules;
}

/**
 * Extracts list items from a second-level (##) markdown section with the given header.
 *
 * @param content - The full markdown document to search.
 * @param sectionHeader - The literal section header text (omit the leading `##`); matching is case-insensitive and captures until the next `##` header or end of file.
 * @returns An array of trimmed list item strings (lines starting with `-`) found in the section; an empty array if the section is not present or contains no list items.
 */
function extractListItems(content: string, sectionHeader: string): string[] {
	const items: string[] = [];
	const escapedHeader = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sectionRegex = new RegExp(
		`## ${escapedHeader}[\\s\\S]*?(?=## |$)`,
		"i",
	);
	const sectionMatch = sectionRegex.exec(content);
	if (!sectionMatch) return items;

	const section = sectionMatch[0];
	if (!section) return items;

	for (const lineMatch of section.matchAll(/^\s*-\s+(.+)$/gm)) {
		const item = lineMatch[1];
		if (item) items.push(item.trim());
	}
	return items;
}

/** Public API export. */
export function runBrainPreflight(
	harnessDir: string,
	files: string[],
): BrainPreflightResult {
	const domainMappings = mapFilesToDomains(files);
	const contexts: BrainPreflightContext[] = [];
	let totalRules = 0;
	let totalFacts = 0;

	for (const mapping of domainMappings) {
		const ctx: BrainPreflightContext = {
			domain: mapping.domain,
			relevance: mapping.relevance,
			rules: [],
			learnings: [],
			qualityCriteria: [],
			facts: [],
			gotchas: [],
		};

		const rulesPath = join(harnessDir, "knowledge", mapping.domain, "rules.md");
		if (existsSync(rulesPath)) {
			const content = readFileSync(rulesPath, "utf-8");
			ctx.rules = extractRules(content);
			totalRules += ctx.rules.length;
		}

		const knowledgePath = join(
			harnessDir,
			"knowledge",
			mapping.domain,
			"knowledge.md",
		);
		if (existsSync(knowledgePath)) {
			const content = readFileSync(knowledgePath, "utf-8");
			ctx.facts = extractListItems(content, "Confirmed facts");
			ctx.gotchas = extractListItems(content, "Gotchas");
			totalFacts += ctx.facts.length;
		}

		const learningsPath = join(harnessDir, "memory", "LEARNINGS.md");
		if (existsSync(learningsPath) && mapping.relevance >= 0.5) {
			const content = readFileSync(learningsPath, "utf-8");
			ctx.learnings = extractListItems(content, "Learnings");
		}

		if (mapping.relevance >= 0.7) {
			const qualityPath = join(harnessDir, "quality", "criteria.md");
			if (existsSync(qualityPath)) {
				const content = readFileSync(qualityPath, "utf-8");
				for (const qMatch of content.matchAll(
					/\|\s*(Q-\d+)\s*\|\s*([^|]+)\s*\|/g,
				)) {
					const criterion = qMatch[2];
					if (criterion) {
						ctx.qualityCriteria.push(`${qMatch[1]}: ${criterion.trim()}`);
					}
				}
			}
		}

		const hasContent =
			ctx.rules.length > 0 ||
			ctx.facts.length > 0 ||
			ctx.gotchas.length > 0 ||
			ctx.qualityCriteria.length > 0;
		if (hasContent || mapping.relevance >= 0.5) {
			contexts.push(ctx);
		}
	}

	return {
		files,
		domainMappings,
		contexts,
		totalRules,
		totalFacts,
	};
}

function renderBrainPreflightHuman(result: BrainPreflightResult): string {
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Brain Preflight Context ===");
	lines.push(
		`  Files: ${result.files.length} | Domains: ${result.domainMappings.length} | Rules: ${result.totalRules} | Facts: ${result.totalFacts}`,
	);
	lines.push("");

	for (const ctx of result.contexts) {
		const relevancePercent = `${Math.round(ctx.relevance * 100)}%`;
		lines.push(`  📦 ${ctx.domain} (${relevancePercent} relevance)`);

		if (ctx.rules.length > 0) {
			lines.push("    Rules:");
			for (const rule of ctx.rules) {
				lines.push(`      - ${rule}`);
			}
		}
		if (ctx.facts.length > 0) {
			lines.push("    Facts:");
			for (const fact of ctx.facts) {
				lines.push(`      - ${fact}`);
			}
		}
		if (ctx.gotchas.length > 0) {
			lines.push("    Gotchas:");
			for (const gotcha of ctx.gotchas) {
				lines.push(`      ⚠️  ${gotcha}`);
			}
		}
		if (ctx.qualityCriteria.length > 0) {
			lines.push("    Quality criteria:");
			for (const criterion of ctx.qualityCriteria) {
				lines.push(`      ✓ ${criterion}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

/** Run the Project Brain preflight subcommand and render CLI output. */
export function cliBrainPreflight(args: string[]): BrainCliResult {
	const files = inspectBrainFilesFlag(args);

	if (!files.present || files.missingValue) {
		process.stderr.write(
			"Error: --files <path...> is required for brain preflight\n",
		);
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

	const result = runBrainPreflight(harnessDir, files.values);
	const json = shouldRenderBrainJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainPreflightHuman(result));
	}

	return { exitCode: EXIT_CODES.SUCCESS, result };
}
