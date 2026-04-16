/**
 * harness brain — JSC-184
 *
 * Project Brain command suite for knowledge, rules, and quality management.
 *
 * Subcommands:
 *   brain status  — Health summary of Project Brain artifacts
 *   brain query   — Search across knowledge, rules, and quality criteria
 *   brain add     — Capture a learning, decision, rule, or hypothesis
 *
 * Exit codes:
 *   0 — success
 *   1 — warnings found (status) or no results (query)
 *   2 — errors found
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
	type BrainValidationResult,
	validateProjectBrain,
} from "../lib/project-brain/brain-validator.js";

// ─── Exit codes ──────────────────────────────────────────────────────────────

export const EXIT_CODES = {
	SUCCESS: 0,
	WARNINGS: 1,
	ERRORS: 2,
	NOT_FOUND: 3,
	INVALID_ARGS: 4,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrainStatusResult {
	valid: boolean;
	harnessDir: string;
	validation: BrainValidationResult;
}

export interface BrainQueryMatch {
	path: string;
	lineNumber: number;
	line: string;
	domain?: string | undefined;
}

export interface BrainQueryResult {
	query: string;
	matches: BrainQueryMatch[];
	total: number;
}

export type BrainAddType = "learning" | "rule" | "hypothesis" | "decision";

export interface BrainAddResult {
	type: BrainAddType;
	domain: string;
	path: string;
	content: string;
	appended: boolean;
}

export interface BrainCliResult {
	exitCode: number;
	result?: BrainStatusResult | BrainQueryResult | BrainAddResult;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findHarnessDir(explicitDir?: string): string {
	const dir = resolve(explicitDir ?? process.cwd());
	const harnessDir = join(dir, ".harness");
	return harnessDir;
}

function getOutputJson(args: string[]): boolean {
	return args.includes("--json");
}

function getFlagValue(args: string[], index: number): string | undefined {
	if (index < 0 || index >= args.length - 1) return undefined;
	const val = args[index + 1];
	if (!val || val.startsWith("-")) return undefined;
	return val;
}

// ─── brain status ────────────────────────────────────────────────────────────

export function runBrainStatus(harnessDir: string): BrainStatusResult {
	const validation = validateProjectBrain(harnessDir);
	return {
		valid: validation.valid,
		harnessDir,
		validation,
	};
}

function renderBrainStatusHuman(result: BrainStatusResult): string {
	const { validation } = result;
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Project Brain Status ===");
	lines.push(`  Directory: ${result.harnessDir}`);
	lines.push(`  Valid: ${validation.valid ? "Yes" : "No"}`);
	lines.push(`  Files scanned: ${validation.filesScanned}`);
	lines.push("");

	const s = validation.summary;
	lines.push("  Summary:");
	lines.push(`    Errors:    ${s.errors}`);
	lines.push(`    Warnings:  ${s.warnings}`);
	lines.push(`    Info:      ${s.info}`);
	lines.push(`    Missing:   ${s.missingFiles}`);
	lines.push(`    Placeholders: ${s.placeholderCount}`);
	lines.push(`    Missing metadata: ${s.missingMetadata}`);

	if (validation.findings.length > 0) {
		lines.push("");
		lines.push("  Findings:");
		for (const f of validation.findings) {
			const icon =
				f.severity === "error" ? "❌" : f.severity === "warning" ? "⚠️ " : "ℹ️ ";
			lines.push(`    ${icon} [${f.path}] ${f.field}: ${f.message}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

function cliBrainStatus(args: string[]): BrainCliResult {
	const harnessDir = findHarnessDir(getFlagValue(args, args.indexOf("--dir")));

	if (!existsSync(harnessDir)) {
		const json = getOutputJson(args);
		if (json) {
			process.stdout.write(
				`${JSON.stringify(
					{
						error: "No .harness directory found",
						path: harnessDir,
					},
					null,
					2,
				)}\n`,
			);
		} else {
			process.stderr.write(
				`Error: No .harness directory found at ${harnessDir}\n`,
			);
		}
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const result = runBrainStatus(harnessDir);
	const json = getOutputJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainStatusHuman(result));
	}

	if (result.validation.summary.errors > 0)
		return { exitCode: EXIT_CODES.ERRORS, result };
	if (result.validation.summary.warnings > 0)
		return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}

// ─── brain query ─────────────────────────────────────────────────────────────

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

	// Add domain files
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

	// Also search memory
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

function renderBrainQueryHuman(result: BrainQueryResult): string {
	const lines: string[] = [];

	lines.push("");
	lines.push(`=== Brain Query: "${result.query}" ===`);
	lines.push(`  ${result.total} match${result.total !== 1 ? "es" : ""} found`);
	lines.push("");

	for (const m of result.matches) {
		const domainTag = m.domain ? `[${m.domain}] ` : "";
		lines.push(`  ${domainTag}${m.path}:${m.lineNumber}`);
		lines.push(`    ${m.line}`);
	}

	lines.push("");
	return lines.join("\n");
}

function cliBrainQuery(args: string[]): BrainCliResult {
	const queryIndex = args.indexOf("--query");
	const query = getFlagValue(args, queryIndex);

	if (!query) {
		process.stderr.write("Error: --query <text> is required for brain query\n");
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	const harnessDir = findHarnessDir(getFlagValue(args, args.indexOf("--dir")));

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const result = runBrainQuery(harnessDir, query);
	const json = getOutputJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainQueryHuman(result));
	}

	if (result.total === 0) return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}

// ─── brain add ───────────────────────────────────────────────────────────────

const VALID_ADD_TYPES = new Set<BrainAddType>([
	"learning",
	"rule",
	"hypothesis",
	"decision",
]);

const VALID_SEVERITIES = new Set(["must", "should", "may"]);

export function runBrainAdd(
	harnessDir: string,
	type: BrainAddType,
	domain: string,
	content: string,
	options?: { severity?: string },
): BrainAddResult {
	// Determine target file
	let targetFile: string;
	let formattedContent: string;

	const date = new Date().toISOString().slice(0, 10);

	switch (type) {
		case "rule": {
			targetFile = `knowledge/${domain}/rules.md`;
			const severity = options?.severity ?? "should";
			formattedContent = `\n- **R-auto**: ${content}\n  - Severity: ${severity}\n  - Rationale: (to be confirmed)\n  - Last promoted: ${date}\n  - Promoted from: brain add`;
			break;
		}
		case "hypothesis": {
			targetFile = `knowledge/${domain}/hypotheses.md`;
			formattedContent = `\n- **${date}**: ${content}`;
			break;
		}
		case "decision": {
			targetFile = `decisions/${date}-${content
				.slice(0, 40)
				.replace(/[^a-z0-9]/gi, "-")
				.toLowerCase()}.md`;
			formattedContent = `# Decision: ${content}\n\n**Date:** ${date}\n**Status:** proposed\n**Context:** (to be filled)\n\n## Decision\n\n${content}\n\n## Consequences\n\n(to be documented)\n`;
			break;
		}
		default: {
			targetFile = "memory/LEARNINGS.md";
			formattedContent = `\n**${date} [manual]:** ${content}`;
			break;
		}
	}

	const fullPath = join(harnessDir, targetFile);
	const dirPath = join(harnessDir, type === "decision" ? "decisions" : "");

	// Ensure directory exists
	if (dirPath) {
		mkdirSync(dirPath, { recursive: true });
	}

	// Append or create
	if (type === "decision") {
		writeFileSync(fullPath, formattedContent, "utf-8");
	} else {
		appendFileSync(fullPath, formattedContent, "utf-8");
	}

	return {
		type,
		domain,
		path: targetFile,
		content: formattedContent,
		appended: true,
	};
}

function cliBrainAdd(args: string[]): BrainCliResult {
	const typeIndex = args.indexOf("--type");
	const typeVal = getFlagValue(args, typeIndex);
	const domainIndex = args.indexOf("--domain");
	const domainVal = getFlagValue(args, domainIndex);
	const contentIndex = args.indexOf("--content");
	const contentVal = getFlagValue(args, contentIndex);
	const severityIndex = args.indexOf("--severity");
	const severityVal = getFlagValue(args, severityIndex);

	if (!typeVal || !VALID_ADD_TYPES.has(typeVal as BrainAddType)) {
		process.stderr.write(
			`Error: --type must be one of: ${[...VALID_ADD_TYPES].join(", ")}\n`,
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	const type = typeVal as BrainAddType;

	if (type !== "learning" && !domainVal) {
		process.stderr.write(
			"Error: --domain is required for non-learning types\n",
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	if (!contentVal) {
		process.stderr.write("Error: --content is required\n");
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	if (severityVal && !VALID_SEVERITIES.has(severityVal)) {
		process.stderr.write(
			`Error: --severity must be one of: ${[...VALID_SEVERITIES].join(", ")}\n`,
		);
		return { exitCode: EXIT_CODES.INVALID_ARGS };
	}

	const harnessDir = findHarnessDir(getFlagValue(args, args.indexOf("--dir")));

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const addOptions: { severity?: string } = {};
	if (severityVal) addOptions.severity = severityVal;

	const result = runBrainAdd(
		harnessDir,
		type,
		domainVal ?? "general",
		contentVal,
		addOptions,
	);
	const json = getOutputJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(`\n✅ Added ${result.type} to ${result.path}\n\n`);
	}

	return { exitCode: EXIT_CODES.SUCCESS, result };
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

/**
 * Main CLI entry point for `harness brain`.
 */
export function runBrainCLI(args: string[]): number {
	if (args.includes("--help") || args.includes("-h") || args.length === 0) {
		process.stdout.write(`Usage: harness brain <subcommand> [options]

Subcommands:
  status              Health summary of Project Brain artifacts
  query               Search across knowledge, rules, and quality criteria
  add                 Capture a learning, decision, rule, or hypothesis

Options:
  --json              Output in JSON format
  --dir <path>        Target directory (default: current directory)
  --help, -h          Show this help

Examples:
  harness brain status --json
  harness brain query --query "vitest" --json
  harness brain add --type rule --domain api --content "All commands must have --help"
  harness brain add --type learning --content "Biome requires tabs for JSON"
`);
		return EXIT_CODES.SUCCESS;
	}

	const subcommand = args[0];
	const subArgs = args.slice(1);

	switch (subcommand) {
		case "status": {
			const r = cliBrainStatus(subArgs);
			return r.exitCode;
		}
		case "query": {
			const r = cliBrainQuery(subArgs);
			return r.exitCode;
		}
		case "add": {
			const r = cliBrainAdd(subArgs);
			return r.exitCode;
		}
		default:
			process.stderr.write(
				`Error: Unknown brain subcommand "${subcommand}"\n  Available: status, query, add\n`,
			);
			return EXIT_CODES.INVALID_ARGS;
	}
}
