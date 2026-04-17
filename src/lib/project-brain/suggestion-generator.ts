/**
 * Suggestion generator for Project Brain (JSC-186).
 *
 * Mines consistency-gate artifact reports to produce
 * review-ready Project Brain entry suggestions. Never auto-writes —
 * all suggestions require explicit human approval.
 *
 * @module lib/project-brain/suggestion-generator
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sanitizeEvidenceText } from "../input/sanitize.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SuggestionType = "learning" | "rule_promotion_candidate";

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
	/** Additional source artifact references merged by deduplication */
	additionalEvidenceRefs?: string[];
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

interface SuggestionIdContext {
	source: string;
	sourceType: SuggestionSource;
	finding: GateFinding;
	index: number;
}

type SuggestionIdFactory = (context: SuggestionIdContext) => string;
type ArtifactReadErrorCallback = (context: {
	filePath: string;
	error: unknown;
}) => void;

function createDefaultIdFactory(): SuggestionIdFactory {
	let counter = 0;

	return ({ source, index }) => {
		counter++;
		const normalizedSource =
			source
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || "source";
		return `sug-${normalizedSource}-${index + 1}-${counter}`;
	};
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function readGateFinding(value: unknown): GateFinding | null {
	if (!isRecord(value)) {
		return null;
	}

	const category = readOptionalString(value, "category");
	const severity = readOptionalString(value, "severity");
	const message = readOptionalString(value, "message");
	const path = readOptionalString(value, "path");
	const description = readOptionalString(value, "description");

	return {
		...(category !== undefined ? { category } : {}),
		...(severity !== undefined ? { severity } : {}),
		...(message !== undefined ? { message } : {}),
		...(path !== undefined ? { path } : {}),
		...(description !== undefined ? { description } : {}),
	};
}

function readGateReport(
	filePath: string,
	onArtifactReadError?: ArtifactReadErrorCallback,
): GateReport | null {
	if (!existsSync(filePath)) return null;
	try {
		const parsed: unknown = JSON.parse(readFileSync(filePath, "utf-8"));
		if (!isRecord(parsed)) {
			return null;
		}

		const findingsRaw = parsed.findings;
		const findings = Array.isArray(findingsRaw)
			? findingsRaw
					.map((finding) => readGateFinding(finding))
					.filter((finding): finding is GateFinding => finding !== null)
			: undefined;

		const summaryRaw = parsed.summary;
		const summary = isRecord(summaryRaw)
			? {
					...(typeof summaryRaw.finding_count === "number"
						? { finding_count: summaryRaw.finding_count }
						: {}),
					...(typeof summaryRaw.error_count === "number"
						? { error_count: summaryRaw.error_count }
						: {}),
					...(typeof summaryRaw.warning_count === "number"
						? { warning_count: summaryRaw.warning_count }
						: {}),
				}
			: undefined;

		const schemaVersion = readOptionalString(parsed, "schemaVersion");
		const command = readOptionalString(parsed, "command");
		const mode = readOptionalString(parsed, "mode");
		const status = readOptionalString(parsed, "status");
		const outcome = readOptionalString(parsed, "outcome");
		const errorClass = readOptionalString(parsed, "error_class");

		return {
			...(schemaVersion !== undefined ? { schemaVersion } : {}),
			...(command !== undefined ? { command } : {}),
			...(mode !== undefined ? { mode } : {}),
			...(status !== undefined ? { status } : {}),
			...(outcome !== undefined ? { outcome } : {}),
			...(errorClass !== undefined ? { error_class: errorClass } : {}),
			...(findings !== undefined ? { findings } : {}),
			...(summary !== undefined ? { summary } : {}),
		};
	} catch (error: unknown) {
		onArtifactReadError?.({ filePath, error });
		return null;
	}
}

function extractGateFindings(
	artifactsDir: string,
	onArtifactReadError?: ArtifactReadErrorCallback,
): { findings: GateFinding[]; source: string }[] {
	const results: { findings: GateFinding[]; source: string }[] = [];

	const consistencyDir = join(artifactsDir, "consistency-gate");
	if (existsSync(consistencyDir)) {
		for (const entry of readdirSync(consistencyDir).sort()) {
			if (!entry.endsWith(".json")) continue;
			// Ignore baseline snapshots; only current run findings are actionable.
			if (entry.toLowerCase().includes("baseline")) continue;
			const report = readGateReport(
				join(consistencyDir, entry),
				onArtifactReadError,
			);
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
	if (path.includes("src/lib/governance/")) return "governance";
	if (path.includes("src/lib/cli/")) return "cli";
	if (path.includes("src/lib/ci/")) return "ci";
	if (path.includes("src/lib/verify/")) return "verify";
	if (path.includes("src/lib/workflow-contract/")) return "workflow";
	if (path.includes("src/lib/workflow/")) return "workflow";
	if (path.includes("src/lib/review-gate/")) return "review-gate";
	if (path.includes("src/lib/plan-gate/")) return "plan-gate";
	if (path.includes("src/lib/linear/")) return "linear";
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
	id: string,
): BrainSuggestion {
	const domain = classifyDomain(finding.path);
	const severity = finding.severity ?? "unknown";
	const category = finding.category ?? "uncategorized";
	const message =
		finding.message ?? finding.description ?? "No details available";
	const path = finding.path ?? "unknown";
	const safeCategory = sanitizeEvidenceText(category);
	const safeMessage = sanitizeEvidenceText(message);
	const safePath = sanitizeEvidenceText(path);

	return {
		id,
		type:
			severity === "error" || severity === "critical"
				? "rule_promotion_candidate"
				: "learning",
		source: sourceType,
		domain,
		title: `${safeCategory}: ${safeMessage.slice(0, 80)}`,
		body: `**Finding:** ${safeMessage}\n\n**Path:** ${safePath}\n**Severity:** ${severity}\n**Category:** ${safeCategory}\n\n**Source:** ${source}`,
		evidenceRef: source,
		deduplicated: false,
		confidence:
			severity === "error" || severity === "critical" ? "high" : "medium",
	};
}

// ─── Deduplication ───────────────────────────────────────────────────────────

interface SuggestionCandidate {
	suggestion: BrainSuggestion;
	dedupeKey: string;
}

function normalizeDedupeValue(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildSuggestionCandidate(
	finding: GateFinding,
	source: string,
	sourceType: SuggestionSource,
	id: string,
): SuggestionCandidate {
	const suggestion = findingToSuggestion(finding, source, sourceType, id);
	const message = sanitizeEvidenceText(
		finding.message ?? finding.description ?? "No details available",
	);
	const category = sanitizeEvidenceText(finding.category ?? "uncategorized");
	const path = sanitizeEvidenceText(finding.path ?? "unknown");
	const severity = normalizeDedupeValue(finding.severity ?? "unknown");
	const dedupeKey = [
		suggestion.type,
		suggestion.domain,
		normalizeDedupeValue(category),
		normalizeDedupeValue(message),
		normalizeDedupeValue(path),
		severity,
	].join("|");

	return { suggestion, dedupeKey };
}

function deduplicateSuggestions(
	candidates: SuggestionCandidate[],
): BrainSuggestion[] {
	const deduped = new Map<string, BrainSuggestion>();

	for (const { suggestion, dedupeKey } of candidates) {
		const existing = deduped.get(dedupeKey);
		if (existing) {
			existing.deduplicated = true;
			if (
				suggestion.evidenceRef !== existing.evidenceRef &&
				!(existing.additionalEvidenceRefs ?? []).includes(
					suggestion.evidenceRef,
				)
			) {
				existing.additionalEvidenceRefs = [
					...(existing.additionalEvidenceRefs ?? []),
					suggestion.evidenceRef,
				];
			}
			continue;
		}
		deduped.set(dedupeKey, { ...suggestion, deduplicated: false });
	}

	return [...deduped.values()];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate Project Brain suggestions from repo artifacts.
 *
 * Scans consistency-gate reports to produce review-ready suggestions.
 * Never auto-writes.
 */
interface GenerateSuggestionsOptions {
	idFactory?: SuggestionIdFactory;
	onArtifactReadError?: ArtifactReadErrorCallback;
}

export function generateSuggestions(
	artifactsDir: string,
	options: GenerateSuggestionsOptions = {},
): SuggestionReport {
	const rawSuggestions: SuggestionCandidate[] = [];
	const idFactory = options.idFactory ?? createDefaultIdFactory();
	let suggestionIndex = 0;

	// Mine gate findings
	const gateResults = extractGateFindings(
		artifactsDir,
		options.onArtifactReadError,
	);
	for (const { findings, source } of gateResults) {
		for (const finding of findings) {
			const severity = finding.severity ?? "unknown";
			const sourceType: SuggestionSource =
				severity === "error" || severity === "critical"
					? "gate_failure"
					: "gate_warning";
			rawSuggestions.push(
				buildSuggestionCandidate(
					finding,
					source,
					sourceType,
					idFactory({
						source,
						sourceType,
						finding,
						index: suggestionIndex++,
					}),
				),
			);
		}
	}

	// Deduplicate
	const suggestions = deduplicateSuggestions(rawSuggestions);

	// Build report
	const byType: Partial<Record<SuggestionType, number>> = {};
	const bySource: Partial<Record<SuggestionSource, number>> = {};
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
		const evidenceRefs = [
			suggestion.evidenceRef,
			...(suggestion.additionalEvidenceRefs ?? []),
		];
		lines.push(`### ${suggestion.type}: ${suggestion.title}`);
		lines.push(`- **Domain:** ${suggestion.domain}`);
		lines.push(`- **Source:** ${suggestion.source}`);
		lines.push(`- **Confidence:** ${suggestion.confidence}`);
		lines.push(`- **Evidence:** ${evidenceRefs.join(", ")}`);
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
