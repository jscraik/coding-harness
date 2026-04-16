/**
 * Suggestion generator for Project Brain (JSC-186).
 *
 * Mines run artifacts, gate summaries, and test failures to produce
 * review-ready Project Brain entry suggestions. Never auto-writes —
 * all suggestions require explicit human approval.
 *
 * @module lib/project-brain/suggestion-generator
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SuggestionType =
	| "learning"
	| "hypothesis"
	| "rule_promotion_candidate"
	| "quality_criterion_proposal";

export type SuggestionSource =
	| "gate_failure"
	| "gate_warning"
	| "consistency_drift"
	| "pilot_evaluation"
	| "test_failure";

export interface BrainSuggestion {
	/** Unique suggestion ID */
	id: string;
	/** Suggestion type */
	type: SuggestionType;
	/** Source that generated this suggestion */
	source: SuggestionSource;
	/** Domain this suggestion relates to */
	domain: string;
	/** Suggested entry title */
	title: string;
	/** Suggested entry body */
	body: string;
	/** Source artifact reference */
	evidenceRef: string;
	/** Whether this suggestion is deduplicated */
	deduplicated: boolean;
	/** Confidence: high, medium, low */
	confidence: "high" | "medium" | "low";
}

export interface SuggestionReport {
	/** Total suggestions generated */
	total: number;
	/** Suggestions by type (sparse — only types with count > 0 are present) */
	byType: Partial<Record<SuggestionType, number>>;
	/** Suggestions by source (sparse — only sources with count > 0 are present) */
	bySource: Partial<Record<SuggestionSource, number>>;
	/** Deduplicated count */
	deduplicatedCount: number;
	/** All suggestions */
	suggestions: BrainSuggestion[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

let suggestionCounter = 0;

function nextSuggestionId(): string {
	suggestionCounter++;
	return `sug-${Date.now()}-${suggestionCounter}`;
}

// ─── Artifact mining ─────────────────────────────────────────────────────────

interface GateFinding {
	category?: string;
	severity?: string;
	message?: string;
	path?: string;
	description?: string;
}

interface GateReport {
	schemaVersion?: string;
	command?: string;
	mode?: string;
	status?: string;
	outcome?: string;
	error_class?: string;
	findings?: GateFinding[];
	summary?: {
		finding_count?: number;
		error_count?: number;
		warning_count?: number;
	};
}

function readJsonFile(filePath: string): unknown {
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function extractGateFindings(
	artifactsDir: string,
): { findings: GateFinding[]; source: string }[] {
	const results: { findings: GateFinding[]; source: string }[] = [];

	const consistencyDir = join(artifactsDir, "consistency-gate");
	if (existsSync(consistencyDir)) {
		for (const entry of readdirSync(consistencyDir)) {
			if (!entry.endsWith(".json")) continue;
			const report = readJsonFile(
				join(consistencyDir, entry),
			) as GateReport | null;
			if (report?.findings && report.findings.length > 0) {
				results.push({ findings: report.findings, source: entry });
			}
		}
	}

	return results;
}

function classifyDomain(path?: string): string {
	if (!path) return "general";
	if (path.includes("src/commands/")) return "cli";
	if (path.includes("src/lib/contract/")) return "governance";
	if (path.includes("src/lib/policy/")) return "governance";
	if (path.includes("src/lib/cli/")) return "cli";
	if (path.includes("src/lib/context-compound/")) return "tooling";
	if (path.includes("src/lib/init/")) return "tooling";
	if (path.includes("src/lib/project-brain/")) return "project-brain";
	if (path.includes(".github/workflows/")) return "ci";
	if (path.includes(".circleci/")) return "ci";
	if (path.includes("docs/")) return "docs";
	return "general";
}

function findingToSuggestion(
	finding: GateFinding,
	source: string,
	sourceType: SuggestionSource,
): BrainSuggestion {
	const domain = classifyDomain(finding.path);
	const severity = finding.severity ?? "unknown";
	const category = finding.category ?? "uncategorized";
	const message =
		finding.message ?? finding.description ?? "No details available";
	const path = finding.path ?? "unknown";

	return {
		id: nextSuggestionId(),
		type:
			severity === "error" || severity === "critical"
				? "rule_promotion_candidate"
				: "learning",
		source: sourceType,
		domain,
		title: `${category}: ${message.slice(0, 80)}`,
		body: `**Finding:** ${message}\n\n**Path:** ${path}\n**Severity:** ${severity}\n**Category:** ${category}\n\n**Source:** ${source}`,
		evidenceRef: source,
		deduplicated: false,
		confidence: severity === "error" ? "high" : "medium",
	};
}

// ─── Deduplication ───────────────────────────────────────────────────────────

function deduplicateSuggestions(
	suggestions: BrainSuggestion[],
): BrainSuggestion[] {
	const seen = new Set<string>();
	const result: BrainSuggestion[] = [];

	for (const suggestion of suggestions) {
		const key = `${suggestion.type}:${suggestion.domain}:${suggestion.title}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push({ ...suggestion, deduplicated: true });
	}

	return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate Project Brain suggestions from repo artifacts.
 *
 * Scans gate reports, consistency findings, and pilot evaluations
 * to produce review-ready suggestions. Never auto-writes.
 */
export function generateSuggestions(artifactsDir: string): SuggestionReport {
	const rawSuggestions: BrainSuggestion[] = [];

	// Mine gate findings
	const gateResults = extractGateFindings(artifactsDir);
	for (const { findings, source } of gateResults) {
		for (const finding of findings) {
			const severity = finding.severity ?? "unknown";
			const sourceType: SuggestionSource =
				severity === "error" || severity === "critical"
					? "gate_failure"
					: "gate_warning";
			rawSuggestions.push(findingToSuggestion(finding, source, sourceType));
		}
	}

	// Deduplicate
	const suggestions = deduplicateSuggestions(rawSuggestions);

	// Build report
	const byType = {} as Record<SuggestionType, number>;
	const bySource = {} as Record<SuggestionSource, number>;
	for (const s of suggestions) {
		byType[s.type] = (byType[s.type] ?? 0) + 1;
		bySource[s.source] = (bySource[s.source] ?? 0) + 1;
	}

	return {
		total: suggestions.length,
		byType,
		bySource,
		deduplicatedCount: rawSuggestions.length - suggestions.length,
		suggestions,
	};
}

/**
 * Format suggestions for human review.
 */
export function formatSuggestionsForReview(report: SuggestionReport): string {
	if (report.total === 0) {
		return "No suggestions found from run artifacts.";
	}

	const lines: string[] = [
		`## Project Brain Suggestions (${report.total})`,
		"",
	];

	for (const suggestion of report.suggestions) {
		lines.push(`### ${suggestion.type}: ${suggestion.title}`);
		lines.push(`- **Domain:** ${suggestion.domain}`);
		lines.push(`- **Source:** ${suggestion.source}`);
		lines.push(`- **Confidence:** ${suggestion.confidence}`);
		lines.push(`- **Evidence:** ${suggestion.evidenceRef}`);
		if (suggestion.deduplicated) {
			lines.push("- **Deduplicated:** yes");
		}
		lines.push("");
		lines.push(suggestion.body);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	if (report.deduplicatedCount > 0) {
		lines.push(
			`_${report.deduplicatedCount} duplicate suggestion(s) removed._`,
		);
	}

	return lines.join("\n");
}
