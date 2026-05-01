/**
 * harness brain — JSC-184, JSC-185
 *
 * Project Brain command suite for knowledge, rules, and quality management.
 *
 * Subcommands:
 *   brain status    — Health summary of Project Brain artifacts
 *   brain query     — Search across knowledge, rules, and quality criteria
 *   brain add       — Capture a learning, decision, rule, or hypothesis
 *   brain preflight — Load relevant context for a set of changed files
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
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { inspectFlagList } from "../lib/cli/parse-utils.js";
import {
	type BrainValidationResult,
	validateProjectBrain,
} from "../lib/project-brain/brain-validator.js";
import {
	type DomainMapping,
	mapFilesToDomains,
} from "../lib/project-brain/domain-mapper.js";
import {
	type StalenessReport,
	scanBrainMetadata,
} from "../lib/project-brain/metadata-scanner.js";

// ─── Exit codes ──────────────────────────────────────────────────────────────

/** Public API export. */
export const EXIT_CODES = {
	SUCCESS: 0,
	WARNINGS: 1,
	ERRORS: 2,
	NOT_FOUND: 3,
	INVALID_ARGS: 4,
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Public API export. */
export interface BrainStatusResult {
	valid: boolean;
	harnessDir: string;
	validation: BrainValidationResult;
	maturity: {
		level: "seeded" | "partial" | "mature";
		placeholderDomains: string[];
		recommendations: string[];
	};
}

/** Public API export. */
export interface BrainQueryMatch {
	path: string;
	lineNumber: number;
	line: string;
	domain?: string | undefined;
}

/** Public API export. */
export interface BrainQueryResult {
	query: string;
	matches: BrainQueryMatch[];
	total: number;
}

/** Public API export. */
export type BrainAddType = "learning" | "rule" | "hypothesis" | "decision";

/** Public API export. */
export interface BrainAddResult {
	type: BrainAddType;
	domain: string;
	path: string;
	content: string;
	appended: boolean;
}

/** Public API export. */
export interface BrainPreflightContext {
	/** Domain that this context relates to */
	domain: string;
	/** Relevance score 0–1 */
	relevance: number;
	/** Active rules for this domain */
	rules: string[];
	/** Recent learnings relevant to this domain */
	learnings: string[];
	/** Relevant quality criteria */
	qualityCriteria: string[];
	/** Relevant confirmed facts */
	facts: string[];
	/** Relevant gotchas */
	gotchas: string[];
}

/** Public API export. */
export interface BrainPreflightResult {
	files: string[];
	domainMappings: DomainMapping[];
	contexts: BrainPreflightContext[];
	totalRules: number;
	totalFacts: number;
}

/** Public API export. */
export interface BrainStaleResult {
	report: StalenessReport;
}

/** Public API export. */
export interface BrainCliResult {
	exitCode: number;
	result?:
		| BrainStatusResult
		| BrainQueryResult
		| BrainAddResult
		| BrainPreflightResult
		| BrainStaleResult;
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

/** Public API export. */
export function runBrainStatus(harnessDir: string): BrainStatusResult {
	const validation = validateProjectBrain(harnessDir);
	const placeholderDomains = Object.keys(
		validation.summary.placeholderDomains ?? {},
	).sort();
	const level =
		placeholderDomains.length === 0
			? "mature"
			: validation.summary.errors > 0
				? "seeded"
				: "partial";
	const recommendations =
		placeholderDomains.length === 0
			? []
			: [
					`Populate non-placeholder focus/knowledge content for: ${placeholderDomains.join(", ")}`,
					"Re-run: harness brain status --json",
				];
	return {
		valid: validation.valid,
		harnessDir,
		validation,
		maturity: {
			level,
			placeholderDomains,
			recommendations,
		},
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
	if (result.maturity.placeholderDomains.length > 0) {
		lines.push(
			`    Placeholder domains: ${result.maturity.placeholderDomains.join(", ")}`,
		);
	}
	lines.push(`    Maturity: ${result.maturity.level}`);

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

function isSafeDomainSegment(domain: string): boolean {
	return /^[a-z0-9][a-z0-9_-]*$/i.test(domain);
}

function isInsideDirectory(rootDir: string, targetPath: string): boolean {
	const relativePath = relative(rootDir, targetPath);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !isAbsolute(relativePath))
	);
}

/**
 * Adds a knowledge item to the harness repository by creating or appending the appropriate file for the given type.
 *
 * The function writes or appends a formatted entry for `type` into the harness directory structure (e.g., knowledge/<domain>/rules.md,
 * knowledge/<domain>/hypotheses.md, decisions/<date>-<slug>.md, or memory/LEARNINGS.md) and returns metadata about the created/updated file.
 *
 * @param harnessDir - Path to the root harness directory (the function writes under this directory)
 * @param type - One of `"learning" | "rule" | "hypothesis" | "decision"` selecting the target file and formatting
 * @param domain - Domain name used for domain-scoped files (e.g., `knowledge/<domain>/...`); ignored for decisions and global learnings
 * @param content - The textual content to be inserted into the selected file
 * @param options - Optional settings
 * @param options.severity - Severity label used when `type` is `"rule"` (default: `"should"`)
 * @returns An object describing the addition: `type`, `domain`, `path` (relative to the harness dir), the `content` written, and `appended: true`
 */
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
	const domainIsRequired = type === "rule" || type === "hypothesis";
	if (domainIsRequired && !isSafeDomainSegment(domain)) {
		throw new Error(
			'Invalid domain: use a single segment with letters, numbers, "_" or "-".',
		);
	}

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

	const resolvedHarnessDir = resolve(harnessDir);
	const fullPath = resolve(resolvedHarnessDir, targetFile);
	if (!isInsideDirectory(resolvedHarnessDir, fullPath)) {
		throw new Error(
			"Refusing to write Project Brain content outside .harness.",
		);
	}
	mkdirSync(dirname(fullPath), { recursive: true });

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

/**
 * Handle the `brain add` CLI subcommand: validate flags, perform the add action, and emit output.
 *
 * Processes expected flags from `args` (e.g., `--type`, `--domain`, `--content`, `--severity`, `--dir`, and `--json`),
 * writes human or JSON output to stdout (and error messages to stderr), and invokes the add operation.
 *
 * @param args - The CLI token array passed to the `add` subcommand
 * @returns A `BrainCliResult` containing an `exitCode` and, on success, the `result` produced by `runBrainAdd`.
 *          Returns `EXIT_CODES.INVALID_ARGS` when required flags are missing or invalid, and
 *          `EXIT_CODES.NOT_FOUND` when a `.harness` directory cannot be located.
 */
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
	if (
		(type === "rule" || type === "hypothesis") &&
		!isSafeDomainSegment(domainVal ?? "")
	) {
		process.stderr.write(
			'Error: --domain must be a single segment using letters, numbers, "_" or "-"\n',
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

// ─── brain preflight ─────────────────────────────────────────────────────────

/**
 * Extract rules from a rules.md file content.
 */
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

		// Load domain rules
		const rulesPath = join(harnessDir, "knowledge", mapping.domain, "rules.md");
		if (existsSync(rulesPath)) {
			const content = readFileSync(rulesPath, "utf-8");
			ctx.rules = extractRules(content);
			totalRules += ctx.rules.length;
		}

		// Load domain knowledge
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

		// Load learnings
		const learningsPath = join(harnessDir, "memory", "LEARNINGS.md");
		if (existsSync(learningsPath) && mapping.relevance >= 0.5) {
			const content = readFileSync(learningsPath, "utf-8");
			ctx.learnings = extractListItems(content, "Learnings");
		}

		// Load quality criteria (always include for high-relevance)
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

		// Only include domains that have some content
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

function cliBrainPreflight(args: string[]): BrainCliResult {
	const files = inspectFlagList(args, "--files");

	if (!files.present || files.missingValue) {
		process.stderr.write(
			"Error: --files <path...> is required for brain preflight\n",
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

	const result = runBrainPreflight(harnessDir, files.values);
	const json = getOutputJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainPreflightHuman(result));
	}

	return { exitCode: EXIT_CODES.SUCCESS, result };
}

// ─── brain stale ─────────────────────────────────────────────────────────────

/** Public API export. */
export function runBrainStale(
	harnessDir: string,
	options?: { thresholdDays?: number },
): BrainStaleResult {
	const scanOptions: { thresholdDays?: number; now?: Date } = {};
	if (options?.thresholdDays) scanOptions.thresholdDays = options.thresholdDays;
	const report = scanBrainMetadata(harnessDir, scanOptions);
	return { report };
}

function renderBrainStaleHuman(result: BrainStaleResult): string {
	const { report } = result;
	const lines: string[] = [];

	lines.push("");
	lines.push("=== Brain Staleness Report ===");
	lines.push(
		`  Domains: ${report.totalDomains} | Files: ${report.totalFiles} | Threshold: ${report.thresholdDays} days`,
	);
	lines.push(
		`  Average staleness: ${report.averageStaleness} | Needs review: ${report.staleFiles.length}`,
	);
	lines.push("");

	if (report.staleFiles.length > 0) {
		lines.push("  Stale / needs review:");
		for (const f of report.staleFiles) {
			const stalenessPercent = `${Math.round(f.stalenessScore * 100)}%`;
			const verified = f.lastVerified ?? "never";
			lines.push(
				`    [${f.domain}] ${stalenessPercent} stale - last verified: ${verified}`,
			);
			lines.push(`      ${f.stalenessReason}`);
		}
		lines.push("");
	}

	if (report.freshFiles.length > 0) {
		lines.push("  Fresh:");
		for (const f of report.freshFiles) {
			const stalenessPercent = `${Math.round(f.stalenessScore * 100)}%`;
			lines.push(
				`    [${f.domain}] ${stalenessPercent} stale - ${f.stalenessReason}`,
			);
		}
		lines.push("");
	}

	return lines.join("\n");
}

function cliBrainStale(args: string[]): BrainCliResult {
	const harnessDir = findHarnessDir(getFlagValue(args, args.indexOf("--dir")));
	const thresholdIndex = args.indexOf("--threshold-days");
	const thresholdVal = getFlagValue(args, thresholdIndex);
	const thresholdDays = thresholdVal
		? Number.parseInt(thresholdVal, 10)
		: undefined;

	if (!existsSync(harnessDir)) {
		process.stderr.write(
			`Error: No .harness directory found at ${harnessDir}\n`,
		);
		return { exitCode: EXIT_CODES.NOT_FOUND };
	}

	const staleOptions: { thresholdDays?: number } = {};
	if (thresholdDays) staleOptions.thresholdDays = thresholdDays;
	const result = runBrainStale(harnessDir, staleOptions);
	const json = getOutputJson(args);

	if (json) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
	} else {
		process.stdout.write(renderBrainStaleHuman(result));
	}

	if (result.report.staleFiles.length > 0)
		return { exitCode: EXIT_CODES.WARNINGS, result };
	return { exitCode: EXIT_CODES.SUCCESS, result };
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

/**
 * Entrypoint that parses arguments and dispatches the `harness brain` subcommands.
 *
 * @param args - Command-line arguments passed to the CLI (subcommand followed by its options)
 * @returns An integer exit code: 0 for success, 1 for warnings, 2 for errors, 3 for not found, 4 for invalid arguments
 */
export function runBrainCLI(args: string[]): number {
	if (args.includes("--help") || args.includes("-h") || args.length === 0) {
		process.stdout.write(`Usage: harness brain <subcommand> [options]

Subcommands:
  status              Health summary of Project Brain artifacts
  query               Search across knowledge, rules, and quality criteria
  add                 Capture a learning, decision, rule, or hypothesis
  preflight           Load relevant context for a set of changed files
  stale               Report staleness of Project Brain artifacts

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
		case "preflight": {
			const r = cliBrainPreflight(subArgs);
			return r.exitCode;
		}
		case "stale": {
			const r = cliBrainStale(subArgs);
			return r.exitCode;
		}
		default:
			process.stderr.write(
				`Error: Unknown brain subcommand "${subcommand}"\n  Available: status, query, add, preflight, stale\n`,
			);
			return EXIT_CODES.INVALID_ARGS;
	}
}
