import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	isValidNorthStarContract,
	isValidOverrideReviewerRegistry,
	isValidProductSurfaceRegistry,
} from "../lib/contract/north-star-contract-validators.js";
import {
	isValidContractVersionString,
	requiresCanonicalNorthStarSurfaces,
} from "../lib/contract/validator-helpers.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";
import { normaliseDriftGateResult } from "../lib/output/normalise.js";

export type DriftGateMode = "advisory" | "health";
export type DriftStatus = "success" | "partial" | "blocked";
export type DriftOutcome = "ok" | "error";
export type DriftErrorClass =
	| "none"
	| "evaluator"
	| "io"
	| "schema"
	| "runtime"
	| "integrity";
export type DriftRuleResult = "pass" | "fail" | "not_applicable" | "error";
export type DriftSurface = "command" | "status" | "todo" | "quality-score";
export type DriftSeverity = "info" | "warning" | "error";
export type DriftBaselineState = "preexisting" | "new";

export interface DriftGateOptions {
	mode?: DriftGateMode;
	json?: boolean;
	outPath?: string;
	baselinePath?: string;
	repoRoot?: string;
	seedBaseline?: boolean;
	suppressions?: string[];
}

export interface DriftFixGuidance {
	command?: string;
	manual?: string;
	suppressible?: boolean;
}

export interface DriftFinding {
	findingId?: string;
	rule_id: string;
	surface: DriftSurface;
	field?: string;
	expected?: string;
	actual?: string;
	specSeverity?: "blocking" | "warning";
	remediation?: string;
	rule_result: DriftRuleResult;
	severity: DriftSeverity;
	baseline_state: DriftBaselineState;
	message: string;
	path?: string;
	details?: string;
	fix?: DriftFixGuidance;
}

interface DriftBaselineInfo {
	path: string;
	loaded: boolean;
	reason?: string;
}

export interface DriftReport {
	schemaVersion: "1.0.0";
	command: "drift-gate";
	mode: DriftGateMode;
	status: DriftStatus;
	outcome: DriftOutcome;
	error_class: DriftErrorClass;
	generated_at: string;
	repo_root: string;
	baseline: DriftBaselineInfo;
	summary: {
		finding_count: number;
		new_count: number;
		preexisting_count: number;
		error_count: number;
		suppressed_count: number;
	};
	findings: DriftFinding[];
	suppressed?: DriftFinding[];
	baseline_seeded?: boolean;
}

export interface DriftGateResult {
	report: DriftReport;
	exitCode: number;
}

const DEFAULT_BASELINE_PATH =
	".harness/guardrails/north-star/drift-baseline-latest.json";
const LEGACY_DEFAULT_BASELINE_PATH =
	"artifacts/consistency-gate/consistency-baseline-latest.json";
const DEFAULT_OUT_PATH =
	".harness/guardrails/north-star/drift-advisory-latest.json";
const DEFAULT_DRIFT_FINDINGS_PATH =
	".harness/guardrails/north-star/drift-findings.json";
const DEFAULT_SURFACE_CLASSIFICATION_SNAPSHOT_PATH =
	".harness/guardrails/north-star/surface-classification-snapshot.json";

function normalizePath(repoRoot: string, pathValue: string): string {
	return pathValue.startsWith("/") ? pathValue : resolve(repoRoot, pathValue);
}

function parseContractReferencePath(reference: string): string | undefined {
	const trimmed = reference.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
		return undefined;
	}
	const withoutAnchor = trimmed.replace(/#.*$/, "");
	const withoutLineRef = withoutAnchor.replace(/:(\d+)(?::\d+)?$/, "");
	return withoutLineRef.trim().length > 0 ? withoutLineRef.trim() : undefined;
}

function resolveContractReferencePath(
	repoRoot: string,
	referencePath: string,
): string {
	if (referencePath.startsWith("/")) {
		return resolve(referencePath);
	}
	return resolve(repoRoot, referencePath);
}

function findingFingerprint(finding: DriftFinding): string {
	return [finding.rule_id, finding.surface, finding.path ?? ""].join("|");
}

function loadBaselineFingerprints(
	repoRoot: string,
	baselinePath: string,
): {
	fingerprints: Set<string>;
	info: DriftBaselineInfo;
	loadingError?: { errorClass: DriftErrorClass; message: string };
} {
	const resolved = normalizePath(repoRoot, baselinePath);
	if (!existsSync(resolved)) {
		return {
			fingerprints: new Set(),
			info: {
				path: baselinePath,
				loaded: false,
				reason: "missing_baseline_seed",
			},
		};
	}

	try {
		const raw = readFileSync(resolved, "utf-8");
		const parsed = JSON.parse(raw) as { findings?: unknown };
		if (!Array.isArray(parsed.findings)) {
			return {
				fingerprints: new Set(),
				info: {
					path: baselinePath,
					loaded: false,
					reason: "baseline_schema_invalid",
				},
				loadingError: {
					errorClass: "schema",
					message:
						"Baseline report is missing a valid findings array (baseline schema mismatch).",
				},
			};
		}

		const fingerprints = new Set<string>();
		for (const item of parsed.findings) {
			if (!item || typeof item !== "object") {
				continue;
			}
			const finding = item as Partial<DriftFinding>;
			if (
				typeof finding.rule_id === "string" &&
				typeof finding.surface === "string"
			) {
				fingerprints.add(
					[finding.rule_id, finding.surface, finding.path ?? ""].join("|"),
				);
			}
		}

		return {
			fingerprints,
			info: {
				path: baselinePath,
				loaded: true,
			},
		};
	} catch (error) {
		return {
			fingerprints: new Set(),
			info: {
				path: baselinePath,
				loaded: false,
				reason: "baseline_read_error",
			},
			loadingError: {
				errorClass: "io",
				message: `Failed to load baseline: ${sanitizeError(error)}`,
			},
		};
	}
}

function readTextFile(path: string): string | undefined {
	if (!existsSync(path)) {
		return undefined;
	}
	return readFileSync(path, "utf-8");
}

function extractDispatchCommands(cliSource: string): string[] {
	const commands = new Set<string>();
	const regex = /if \(command === "([^"]+)"(?: \|\| command === "([^"]+)")?/g;
	let match: RegExpExecArray | null = regex.exec(cliSource);
	while (match) {
		if (match[1]) commands.add(match[1]);
		if (match[2]) commands.add(match[2]);
		match = regex.exec(cliSource);
	}
	commands.delete("--help");
	commands.delete("--version");
	return Array.from(commands).sort();
}

function extractRegistryDispatchCommands(repoRoot: string): string[] {
	const commands = new Set<string>();
	const commandSourcePaths = [
		join(repoRoot, "src/lib/cli/registry/command-specs.ts"),
		join(repoRoot, "src/lib/cli/command-registry.ts"),
	];

	for (const sourcePath of commandSourcePaths) {
		const source = readTextFile(sourcePath);
		if (!source) {
			continue;
		}
		const nameRegex = /\bname:\s*"([a-z][a-z0-9:-]*)"/g;
		let match: RegExpExecArray | null = nameRegex.exec(source);
		while (match) {
			if (match[1]) {
				commands.add(match[1]);
			}
			match = nameRegex.exec(source);
		}
	}

	return Array.from(commands).sort();
}

function extractHelpCommands(cliSource: string): {
	commands: string[];
	duplicates: string[];
} {
	const helpRegex = /console\.info\("\s{2}([a-z][a-z0-9:-]*)\s+/gi;
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	let match: RegExpExecArray | null = helpRegex.exec(cliSource);
	while (match) {
		const command = match[1];
		if (!command) {
			match = helpRegex.exec(cliSource);
			continue;
		}
		if (seen.has(command)) {
			duplicates.add(command);
		}
		seen.add(command);
		match = helpRegex.exec(cliSource);
	}
	return {
		commands: Array.from(seen).sort(),
		duplicates: Array.from(duplicates).sort(),
	};
}

function extractCommandTableCommands(markdownSource: string): string[] {
	const commands = new Set<string>();
	const regex = /^\|\s+`([^`]+)`\s+\|/gm;
	let match: RegExpExecArray | null = regex.exec(markdownSource);
	while (match) {
		const rawCommandCell = match[1]?.trim();
		if (rawCommandCell) {
			const canonicalToken = rawCommandCell.split(/\s+/)[0]?.trim();
			if (canonicalToken && /^[a-z][a-z0-9:-]*$/.test(canonicalToken)) {
				commands.add(canonicalToken);
			}
		}
		match = regex.exec(markdownSource);
	}
	return Array.from(commands).sort();
}

function parseFrontmatterStatus(contents: string): string | undefined {
	const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return undefined;
	}
	const statusMatch = frontmatterMatch[1]?.match(/^status:\s*([^\n]+)/m);
	if (!statusMatch?.[1]) {
		return undefined;
	}
	return statusMatch[1].trim().toLowerCase();
}

function normalizeNarrativeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\w\s/-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeMetricLabel(metricId: string): string {
	return metricId.replaceAll("_", " ");
}

function extractMissionSteeringClause(mission: string): string {
	const [clause] = mission.split(/,\s*with\s+/i);
	return clause?.trim() || mission;
}

function splitNarrativeClauses(text: string): string[] {
	return text
		.split(/[.;]\s+/)
		.map((clause) => clause.trim())
		.filter((clause) => clause.length > 0);
}

function hasPrimaryBottleneckNarrative(
	normalizedSource: string,
	primaryBottleneck: string,
): boolean {
	if (primaryBottleneck === "review_rework_loop") {
		return (
			normalizedSource.includes("review or rework loop") ||
			normalizedSource.includes("review and rework loop") ||
			normalizedSource.includes("review and rework loop cost") ||
			normalizedSource.includes("review/rework loop")
		);
	}
	return normalizedSource.includes(
		normalizeNarrativeText(normalizeMetricLabel(primaryBottleneck)),
	);
}

function collectNorthStarDocParityMissing(params: {
	normalizedDoc: string;
	mission: string;
	primaryBottleneck: string;
	autonomyBoundary: string;
	safetyFloor: string[];
	nonGoals: string[];
	decisionQuestionPrompts: string[];
}): string[] {
	const missing: string[] = [];
	if (!params.normalizedDoc.includes(normalizeNarrativeText(params.mission))) {
		missing.push("mission");
	}
	if (
		!hasPrimaryBottleneckNarrative(
			params.normalizedDoc,
			params.primaryBottleneck,
		)
	) {
		missing.push(
			`primary bottleneck (${normalizeMetricLabel(params.primaryBottleneck)})`,
		);
	}
	for (const clause of splitNarrativeClauses(params.autonomyBoundary)) {
		const normalizedClause = normalizeNarrativeText(clause);
		if (normalizedClause.length === 0) {
			continue;
		}
		if (!params.normalizedDoc.includes(normalizedClause)) {
			missing.push(`autonomy boundary clause (${clause})`);
		}
	}
	for (const safetyFloorRule of params.safetyFloor) {
		const normalizedRule = normalizeNarrativeText(safetyFloorRule);
		if (
			normalizedRule.length > 0 &&
			!params.normalizedDoc.includes(normalizedRule)
		) {
			missing.push(`safety floor rule (${safetyFloorRule})`);
		}
	}
	for (const nonGoal of params.nonGoals) {
		const normalizedNonGoal = normalizeNarrativeText(nonGoal);
		if (
			normalizedNonGoal.length > 0 &&
			!params.normalizedDoc.includes(normalizedNonGoal)
		) {
			missing.push(`non-goal (${nonGoal})`);
		}
	}
	for (const prompt of params.decisionQuestionPrompts) {
		const normalizedPrompt = normalizeNarrativeText(prompt);
		if (
			normalizedPrompt.length > 0 &&
			!params.normalizedDoc.includes(normalizedPrompt)
		) {
			missing.push(`decision question (${prompt})`);
		}
	}
	return missing;
}

function collectReadmeParityMissing(params: {
	normalizedReadme: string;
	mission: string;
	primaryMetric: string;
	primaryBottleneck: string;
}): string[] {
	const missing: string[] = [];
	const steeringClause = normalizeNarrativeText(
		extractMissionSteeringClause(params.mission),
	);
	if (!params.normalizedReadme.includes(steeringClause)) {
		missing.push("mission steering clause");
	}
	const primaryMetricLabel = normalizeNarrativeText(
		normalizeMetricLabel(params.primaryMetric),
	);
	if (!params.normalizedReadme.includes(primaryMetricLabel)) {
		missing.push(
			`primary metric (${normalizeMetricLabel(params.primaryMetric)})`,
		);
	}
	if (
		!hasPrimaryBottleneckNarrative(
			params.normalizedReadme,
			params.primaryBottleneck,
		)
	) {
		missing.push(
			`primary bottleneck (${normalizeMetricLabel(params.primaryBottleneck)})`,
		);
	}
	if (
		!params.normalizedReadme.includes("low and medium-risk autonomy") ||
		!params.normalizedReadme.includes("high-risk") ||
		!params.normalizedReadme.includes("human-mediated")
	) {
		missing.push("autonomy boundary semantics");
	}
	if (
		!params.normalizedReadme.includes("evidence") ||
		!params.normalizedReadme.includes("sha") ||
		!params.normalizedReadme.includes("rollback")
	) {
		missing.push("safety floor semantics (evidence, SHA, rollback)");
	}
	return missing;
}

const REQUIRED_STATUS_METRIC_IDS = [
	"pr_lead_time_p50",
	"pr_lead_time_p90",
	"review_rework_retry_rate",
	"manual_interventions_per_agent_change",
	"merge_readiness_block_time",
	"north_star_alignment_pass_rate",
	"blocking_drift_findings_count",
	"surface_class_counts{core,adjacent,experimental}",
	"policy_surface_additions_without_glue_reduction",
	"cadence_breach_count",
	"repeated_failure_class_count",
	"durable_guardrail_added_count",
	"post_guardrail_recurrence_rate",
] as const;

const THROUGHPUT_PATH_METRIC_IDS = [
	"pr_lead_time_p50",
	"pr_lead_time_p90",
	"review_rework_retry_rate",
	"manual_interventions_per_agent_change",
	"merge_readiness_block_time",
] as const;

function parseStatusMetricRows(
	statusSource: string,
): Map<string, { current: string; trend: string }> {
	const metrics = new Map<string, { current: string; trend: string }>();
	for (const rawLine of statusSource.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line.startsWith("|")) {
			continue;
		}
		const cells = line
			.split("|")
			.slice(1, -1)
			.map((cell) => cell.trim());
		if (cells.length < 3) {
			continue;
		}
		if (
			cells.every((cell) => cell.length === 0 || /^:?-{3,}:?$/.test(cell)) ||
			cells[0]?.toLowerCase() === "metric"
		) {
			continue;
		}
		const metricId = (cells[0] ?? "").replaceAll("`", "").trim();
		if (!/^[a-z0-9_{}.,:-]+$/.test(metricId)) {
			continue;
		}
		metrics.set(metricId, {
			current: cells[1] ?? "",
			trend: (cells[2] ?? "").toLowerCase(),
		});
	}
	return metrics;
}

interface SurfaceClassCounts {
	core: number;
	adjacent: number;
	experimental: number;
}

interface SurfaceClassificationSnapshot {
	schemaVersion: "1.0.0";
	generated_at: string;
	repo_root: string;
	contract_path: "harness.contract.json";
	contract_version: string | null;
	total_surfaces: number;
	surface_counts: SurfaceClassCounts;
}

function parseSurfaceClassCounts(
	value: string,
): SurfaceClassCounts | undefined {
	const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)$/);
	if (!match) {
		return undefined;
	}
	return {
		core: Number.parseInt(match[1] ?? "", 10),
		adjacent: Number.parseInt(match[2] ?? "", 10),
		experimental: Number.parseInt(match[3] ?? "", 10),
	};
}

function countSurfaceClasses(
	surfaces: Array<{ class?: string }>,
): SurfaceClassCounts {
	const counts: SurfaceClassCounts = {
		core: 0,
		adjacent: 0,
		experimental: 0,
	};
	for (const surface of surfaces) {
		if (surface.class === "core") {
			counts.core += 1;
		} else if (surface.class === "adjacent") {
			counts.adjacent += 1;
		} else if (surface.class === "experimental") {
			counts.experimental += 1;
		}
	}
	return counts;
}

function formatSurfaceClassCounts(counts: SurfaceClassCounts): string {
	return `${counts.core}/${counts.adjacent}/${counts.experimental}`;
}

function buildSurfaceClassificationSnapshot(
	repoRoot: string,
	generatedAt: string,
): SurfaceClassificationSnapshot {
	const contractPath = join(repoRoot, "harness.contract.json");
	const contractSource = readTextFile(contractPath);
	let contractVersion: string | null = null;
	let surfaces: Array<{ class?: string }> = [];

	if (contractSource) {
		try {
			const parsed = JSON.parse(contractSource) as {
				version?: unknown;
				productSurface?: { surfaces?: Array<{ class?: unknown }> };
			};
			if (typeof parsed.version === "string") {
				contractVersion = parsed.version;
			}
			if (Array.isArray(parsed.productSurface?.surfaces)) {
				surfaces = parsed.productSurface.surfaces
					.map((surface) =>
						typeof surface.class === "string"
							? { class: surface.class }
							: { class: undefined },
					)
					.filter(
						(surface): surface is { class?: string } =>
							surface.class === undefined ||
							surface.class === "core" ||
							surface.class === "adjacent" ||
							surface.class === "experimental",
					);
			}
		} catch {
			// Keep snapshot contract metadata null/empty; drift findings capture parse errors.
		}
	}

	return {
		schemaVersion: "1.0.0",
		generated_at: generatedAt,
		repo_root: repoRoot,
		contract_path: "harness.contract.json",
		contract_version: contractVersion,
		total_surfaces: surfaces.length,
		surface_counts: countSurfaceClasses(surfaces),
	};
}

function updateReportSummary(
	report: DriftReport,
	suppressedCount: number,
): void {
	report.summary = {
		finding_count: report.findings.length,
		new_count: report.findings.filter((f) => f.baseline_state === "new").length,
		preexisting_count: report.findings.filter(
			(f) => f.baseline_state === "preexisting",
		).length,
		error_count: report.findings.filter((f) => f.rule_result === "error")
			.length,
		suppressed_count: suppressedCount,
	};
}

function collectNorthStarContractShapeMissing(northStar: {
	mission?: unknown;
	primaryMetric?: unknown;
	primaryBottleneck?: unknown;
	autonomyBoundary?: unknown;
	safetyFloor?: unknown;
	nonGoals?: unknown;
	decisionQuestions?: unknown;
}): string[] {
	const missing: string[] = [];
	if (
		typeof northStar.mission !== "string" ||
		northStar.mission.trim().length === 0
	) {
		missing.push("northStar.mission");
	}
	if (
		typeof northStar.primaryMetric !== "string" ||
		northStar.primaryMetric.trim().length === 0
	) {
		missing.push("northStar.primaryMetric");
	}
	if (
		typeof northStar.primaryBottleneck !== "string" ||
		northStar.primaryBottleneck.trim().length === 0
	) {
		missing.push("northStar.primaryBottleneck");
	}
	if (
		typeof northStar.autonomyBoundary !== "string" ||
		northStar.autonomyBoundary.trim().length === 0
	) {
		missing.push("northStar.autonomyBoundary");
	}
	if (
		!Array.isArray(northStar.safetyFloor) ||
		northStar.safetyFloor.length === 0 ||
		!northStar.safetyFloor.every(
			(rule) => typeof rule === "string" && rule.trim().length > 0,
		)
	) {
		missing.push("northStar.safetyFloor[]");
	}
	if (
		!Array.isArray(northStar.nonGoals) ||
		northStar.nonGoals.length === 0 ||
		!northStar.nonGoals.every(
			(goal) => typeof goal === "string" && goal.trim().length > 0,
		)
	) {
		missing.push("northStar.nonGoals[]");
	}
	if (
		!Array.isArray(northStar.decisionQuestions) ||
		northStar.decisionQuestions.length === 0 ||
		!northStar.decisionQuestions.every((question) => {
			if (typeof question !== "object" || question === null) {
				return false;
			}
			const record = question as { id?: unknown; prompt?: unknown };
			return (
				typeof record.id === "string" &&
				record.id.trim().length > 0 &&
				typeof record.prompt === "string" &&
				record.prompt.trim().length > 0
			);
		})
	) {
		missing.push("northStar.decisionQuestions[]");
	}
	return missing;
}

function isThroughputTrendRegressing(trend: string): boolean {
	const normalized = trend.toLowerCase();
	return (
		normalized.includes("regress") ||
		normalized.includes("worse") ||
		normalized.includes("degrad") ||
		normalized.includes("increase") ||
		normalized.includes("increasing") ||
		normalized.includes("rising") ||
		/(^|[\s(])up($|[\s).,;!?])/i.test(normalized) ||
		normalized.includes("↑")
	);
}

/** Fix guidance lookup keyed by rule_id */
const FIX_GUIDANCE: Record<string, DriftFixGuidance> = {
	"command.surface.sources.missing": {
		manual:
			"Create the missing source file, or suppress if project type doesn't include a CLI.",
		suppressible: true,
	},
	"command.surface.readme.missing": {
		manual: "Add the command to the README command index table.",
		suppressible: false,
	},
	"command.surface.dispatch.missing": {
		manual:
			"Add a dispatch branch for this command in src/cli.ts, or remove from README.",
		suppressible: false,
	},
	"command.surface.help.duplicate": {
		manual: "Remove the duplicate help entry from src/cli.ts.",
		suppressible: false,
	},
	"todo.lifecycle.status.missing": {
		manual: "Add frontmatter with a status field to the todo file.",
		suppressible: false,
	},
	"todo.lifecycle.status.mismatch": {
		manual:
			"Update the frontmatter status to match the filename convention, or rename the file.",
		suppressible: false,
	},
	"quality.score.missing": {
		command: "harness gardener",
		manual:
			"Create docs/QUALITY_SCORE.md with **Score:** N/100 and last_updated frontmatter.",
		suppressible: true,
	},
	"quality.score.structure.invalid": {
		manual:
			"Add required frontmatter (last_updated) and **Score:** N/100 to docs/QUALITY_SCORE.md.",
		suppressible: false,
	},
	"quality.score.last_updated.invalid": {
		manual:
			"Fix the last_updated date in docs/QUALITY_SCORE.md frontmatter to a valid ISO date.",
		suppressible: false,
	},
	"quality.score.stale": {
		command: "harness gardener",
		manual:
			"Re-run gardener or update the last_updated date in docs/QUALITY_SCORE.md.",
		suppressible: false,
	},
	"status.matrix.missing": {
		manual: "Create docs/roadmap/agent-first-status.md with status sections.",
		suppressible: true,
	},
	"status.narrative.coherence": {
		manual:
			"Resolve remaining ready todos or update the status matrix to reflect incomplete status.",
		suppressible: false,
	},
	"status.metrics.required.missing": {
		manual:
			"Add required north-star observability metric rows to docs/roadmap/agent-first-status.md.",
		suppressible: false,
	},
	"status.outcomes.regressed": {
		manual:
			"When all feature phases are complete, update status output so throughput-path metric trends are improving or explicitly explain blockers and remediation.",
		suppressible: false,
	},
	"status.north_star.contract_parity.north_star_doc": {
		manual:
			"Update docs/roadmap/north-star.md so it includes the canonical north-star mission from harness.contract.json.",
		suppressible: false,
	},
	"status.north_star.contract_parity.readme": {
		manual:
			"Update README north-star summary so it includes the canonical steering clause and primary metric from harness.contract.json.",
		suppressible: false,
	},
	"status.north_star.contract_parity.contract_parse_error": {
		manual:
			"Fix malformed JSON in harness.contract.json so drift-gate can validate canonical north-star parity.",
		suppressible: false,
	},
	"status.north_star.contract_parity.contract_shape_invalid": {
		manual:
			"Fix canonical 1.6+ surfaces in harness.contract.json so northStar, productSurface, and overrideReviewerRegistry are all present and valid.",
		suppressible: false,
	},
	"status.metrics.surface_class_counts.mismatch": {
		manual:
			"Update docs/roadmap/agent-first-status.md surface_class_counts row to match productSurface class totals in harness.contract.json.",
		suppressible: false,
	},
	"baseline.seed.missing": {
		command: "harness drift-gate --seed-baseline",
		manual:
			"Run drift-gate with --seed-baseline to create the initial baseline.",
		suppressible: false,
	},
	"baseline.load.error": {
		manual: "Fix or delete the corrupted baseline file and re-seed.",
		suppressible: false,
	},
};

function push(
	collection: DriftFinding[],
	finding: Omit<DriftFinding, "baseline_state">,
	baselineFingerprints: Set<string>,
): void {
	const guidance = FIX_GUIDANCE[finding.rule_id];
	const staged: DriftFinding = {
		findingId: finding.rule_id,
		...finding,
		field: finding.rule_id,
		expected: "Contract-aligned surface state",
		actual: finding.message,
		specSeverity: finding.severity === "error" ? "blocking" : "warning",
		remediation:
			guidance?.command ?? guidance?.manual ?? "Resolve drift and rerun",
		baseline_state: "new",
	};
	staged.baseline_state = baselineFingerprints.has(findingFingerprint(staged))
		? "preexisting"
		: "new";
	// Attach fix guidance if available
	if (guidance) {
		staged.fix = guidance;
	}
	collection.push(staged);
}

function evaluate(
	repoRoot: string,
	baselineFingerprints: Set<string>,
): DriftFinding[] {
	const findings: DriftFinding[] = [];

	// Rule: command surface parity (CLI dispatch/help vs README/docs command tables)
	const cliPath = join(repoRoot, "src/cli.ts");
	const readmePath = join(repoRoot, "README.md");
	const cliReferencePath = join(repoRoot, "docs/cli-reference.md");
	const cliSource = readTextFile(cliPath);
	const readmeSource = readTextFile(readmePath);
	const cliReferenceSource = readTextFile(cliReferencePath);

	if (!cliSource || !readmeSource) {
		push(
			findings,
			{
				rule_id: "command.surface.sources.missing",
				surface: "command",
				rule_result: "error",
				severity: "error",
				message:
					"Required command surface sources are missing (src/cli.ts or README.md).",
				path: !cliSource ? "src/cli.ts" : "README.md",
			},
			baselineFingerprints,
		);
	} else {
		const registryCommands = extractRegistryDispatchCommands(repoRoot);
		const dispatchCommands =
			registryCommands.length > 0
				? registryCommands
				: extractDispatchCommands(cliSource);
		const helpCommands = extractHelpCommands(cliSource);
		const readmeCommands = extractCommandTableCommands(readmeSource);

		for (const command of dispatchCommands) {
			if (!readmeCommands.includes(command)) {
				push(
					findings,
					{
						rule_id: "command.surface.readme.missing",
						surface: "command",
						rule_result: "fail",
						severity: "warning",
						message: `Command is dispatched but missing from README command index: ${command}`,
						path: "README.md",
					},
					baselineFingerprints,
				);
			}
		}

		for (const command of readmeCommands) {
			if (!dispatchCommands.includes(command)) {
				push(
					findings,
					{
						rule_id: "command.surface.dispatch.missing",
						surface: "command",
						rule_result: "fail",
						severity: "warning",
						message: `Command is documented in README but not dispatched in CLI: ${command}`,
						path: "src/cli.ts",
					},
					baselineFingerprints,
				);
			}
		}

		for (const duplicateCommand of helpCommands.duplicates) {
			push(
				findings,
				{
					rule_id: "command.surface.help.duplicate",
					surface: "command",
					rule_result: "fail",
					severity: "warning",
					message: `Duplicate help entry found in CLI usage: ${duplicateCommand}`,
					path: "src/cli.ts",
				},
				baselineFingerprints,
			);
		}

		if (cliReferenceSource) {
			const cliReferenceCommands =
				extractCommandTableCommands(cliReferenceSource);
			for (const command of dispatchCommands) {
				if (!cliReferenceCommands.includes(command)) {
					push(
						findings,
						{
							rule_id: "command.surface.cli_reference.missing",
							surface: "command",
							rule_result: "fail",
							severity: "warning",
							message: `Command is dispatched but missing from docs/cli-reference command index: ${command}`,
							path: "docs/cli-reference.md",
						},
						baselineFingerprints,
					);
				}
			}
		}
	}

	// Rule: todo filename/frontmatter parity
	const todoDir = join(repoRoot, "todos");
	if (!existsSync(todoDir)) {
		push(
			findings,
			{
				rule_id: "todo.lifecycle.not_applicable",
				surface: "todo",
				rule_result: "not_applicable",
				severity: "info",
				message:
					"Todos directory is missing; todo lifecycle parity check not applicable.",
				path: "todos",
			},
			baselineFingerprints,
		);
	} else {
		const todoFiles = readdirSync(todoDir)
			.filter((name) => /-(ready|complete|deferred)-.*\.md$/i.test(name))
			.sort();

		for (const todoFile of todoFiles) {
			const expectedStatus = todoFile.match(
				/-(ready|complete|deferred)-/i,
			)?.[1];
			if (!expectedStatus) {
				continue;
			}
			const todoPath = join(todoDir, todoFile);
			const contents = readTextFile(todoPath);
			if (!contents) {
				continue;
			}
			const actualStatus = parseFrontmatterStatus(contents);
			if (!actualStatus) {
				push(
					findings,
					{
						rule_id: "todo.lifecycle.status.missing",
						surface: "todo",
						rule_result: "fail",
						severity: "warning",
						message: `Todo file missing frontmatter status: ${todoFile}`,
						path: `todos/${todoFile}`,
					},
					baselineFingerprints,
				);
				continue;
			}
			if (actualStatus !== expectedStatus.toLowerCase()) {
				push(
					findings,
					{
						rule_id: "todo.lifecycle.status.mismatch",
						surface: "todo",
						rule_result: "fail",
						severity: "warning",
						message: `Todo lifecycle mismatch: filename implies '${expectedStatus.toLowerCase()}', frontmatter status is '${actualStatus}'.`,
						path: `todos/${todoFile}`,
					},
					baselineFingerprints,
				);
			}
		}
	}

	// Rule: quality score structure/freshness
	const qualityPath = join(repoRoot, "docs/QUALITY_SCORE.md");
	const qualitySource = readTextFile(qualityPath);
	if (!qualitySource) {
		push(
			findings,
			{
				rule_id: "quality.score.missing",
				surface: "quality-score",
				rule_result: "fail",
				severity: "warning",
				message: "Quality score document is missing.",
				path: "docs/QUALITY_SCORE.md",
			},
			baselineFingerprints,
		);
	} else {
		const hasScore = /\*\*Score:\*\*\s+\d+\/100/.test(qualitySource);
		const frontmatterDate = qualitySource
			.match(/^---[\s\S]*?last_updated:\s*([^\n]+)[\s\S]*?---/m)?.[1]
			?.trim();
		if (!hasScore || !frontmatterDate) {
			push(
				findings,
				{
					rule_id: "quality.score.structure.invalid",
					surface: "quality-score",
					rule_result: "fail",
					severity: "warning",
					message:
						"QUALITY_SCORE.md is missing required structure (frontmatter last_updated and/or **Score:** x/100).",
					path: "docs/QUALITY_SCORE.md",
				},
				baselineFingerprints,
			);
		} else {
			const parsedDate = Number.isNaN(Date.parse(frontmatterDate))
				? undefined
				: new Date(frontmatterDate);
			if (!parsedDate) {
				push(
					findings,
					{
						rule_id: "quality.score.last_updated.invalid",
						surface: "quality-score",
						rule_result: "fail",
						severity: "warning",
						message: `QUALITY_SCORE.md has invalid last_updated date: ${frontmatterDate}`,
						path: "docs/QUALITY_SCORE.md",
					},
					baselineFingerprints,
				);
			} else {
				const ageDays = Math.floor(
					(Date.now() - parsedDate.getTime()) / (24 * 60 * 60 * 1000),
				);
				if (ageDays > 30) {
					push(
						findings,
						{
							rule_id: "quality.score.stale",
							surface: "quality-score",
							rule_result: "fail",
							severity: "warning",
							message: `QUALITY_SCORE.md is stale (${ageDays} days since last_updated).`,
							path: "docs/QUALITY_SCORE.md",
						},
						baselineFingerprints,
					);
				}
			}
		}
	}

	// Rule: status narrative coherence
	const statusPath = join(repoRoot, "docs/roadmap/agent-first-status.md");
	const statusSource = readTextFile(statusPath);
	let statusMetricRows:
		| Map<string, { current: string; trend: string }>
		| undefined;
	if (!statusSource) {
		push(
			findings,
			{
				rule_id: "status.matrix.missing",
				surface: "status",
				rule_result: "fail",
				severity: "warning",
				message: "Status matrix document is missing.",
				path: "docs/roadmap/agent-first-status.md",
			},
			baselineFingerprints,
		);
	} else {
		const statuses = Array.from(
			statusSource.matchAll(/\*\*Status:\*\*\s+([^\n]+)/g),
		).map((match) => match[1]?.trim() ?? "");
		const allComplete =
			statuses.length > 0 &&
			statuses.every((value) => value.includes("✅ Complete"));
		const readyTodos = existsSync(todoDir)
			? readdirSync(todoDir).filter((name) => /-ready-.*\.md$/i.test(name))
					.length
			: 0;
		if (allComplete && readyTodos > 0) {
			push(
				findings,
				{
					rule_id: "status.narrative.coherence",
					surface: "status",
					rule_result: "fail",
					severity: "warning",
					message: `Status matrix reports full completion while ${readyTodos} ready todo item(s) remain.`,
					path: "docs/roadmap/agent-first-status.md",
				},
				baselineFingerprints,
			);
		}

		const metricRows = parseStatusMetricRows(statusSource);
		statusMetricRows = metricRows;
		const missingMetricIds = REQUIRED_STATUS_METRIC_IDS.filter(
			(metricId) => !metricRows.has(metricId),
		);
		if (missingMetricIds.length > 0) {
			push(
				findings,
				{
					rule_id: "status.metrics.required.missing",
					surface: "status",
					rule_result: "fail",
					severity: "warning",
					message: `Status matrix is missing required north-star metric row(s): ${missingMetricIds.join(", ")}`,
					path: "docs/roadmap/agent-first-status.md",
				},
				baselineFingerprints,
			);
		}

		if (allComplete) {
			const regressingThroughputMetrics = THROUGHPUT_PATH_METRIC_IDS.filter(
				(metricId) => {
					const row = metricRows.get(metricId);
					if (!row) {
						return false;
					}
					return isThroughputTrendRegressing(row.trend);
				},
			);
			if (regressingThroughputMetrics.length > 0) {
				push(
					findings,
					{
						rule_id: "status.outcomes.regressed",
						surface: "status",
						rule_result: "fail",
						severity: "warning",
						message: `Status matrix reports full completion while throughput-path metrics are regressing: ${regressingThroughputMetrics.join(", ")}`,
						path: "docs/roadmap/agent-first-status.md",
					},
					baselineFingerprints,
				);
			}
		}
	}

	// Rule: canonical north-star narrative parity (contract → roadmap + README)
	const contractPath = join(repoRoot, "harness.contract.json");
	const contractSource = readTextFile(contractPath);
	if (contractSource) {
		try {
			const parsed = JSON.parse(contractSource) as {
				version?: unknown;
				northStar?: {
					mission?: string;
					primaryMetric?: string;
					primaryBottleneck?: string;
					autonomyBoundary?: string;
					safetyFloor?: string[];
					nonGoals?: string[];
					decisionQuestions?: Array<{ id?: string; prompt?: string }>;
				};
				productSurface?: {
					surfaces?: Array<{
						surfaceId?: string;
						class?: string;
						evidenceReference?: string;
						ownedPaths?: string[];
					}>;
				};
				overrideReviewerRegistry?: unknown;
			};
			const canonicalSurfacesRequired = requiresCanonicalNorthStarSurfaces(
				parsed.version,
			);
			const missingContractShape: string[] = [];
			if (!isValidContractVersionString(parsed.version)) {
				missingContractShape.push("version (canonical numeric format)");
			}
			if (canonicalSurfacesRequired) {
				if (parsed.northStar === undefined) {
					missingContractShape.push("northStar");
				} else if (!isValidNorthStarContract(parsed.northStar)) {
					const northStarShapeMissing = collectNorthStarContractShapeMissing(
						parsed.northStar,
					);
					if (northStarShapeMissing.length > 0) {
						missingContractShape.push(...northStarShapeMissing);
					} else {
						missingContractShape.push(
							"northStar (canonical metric/bottleneck/question set)",
						);
					}
				}

				if (parsed.productSurface === undefined) {
					missingContractShape.push("productSurface");
				} else if (!isValidProductSurfaceRegistry(parsed.productSurface)) {
					missingContractShape.push("productSurface.surfaces");
				}

				if (parsed.overrideReviewerRegistry === undefined) {
					missingContractShape.push("overrideReviewerRegistry");
				} else if (
					!isValidOverrideReviewerRegistry(parsed.overrideReviewerRegistry)
				) {
					missingContractShape.push(
						"overrideReviewerRegistry.trustedReviewers",
					);
				}
			} else if (parsed.northStar !== undefined) {
				const northStarShapeMissing = collectNorthStarContractShapeMissing(
					parsed.northStar,
				);
				if (northStarShapeMissing.length > 0) {
					missingContractShape.push(...northStarShapeMissing);
				}
			}

			if (missingContractShape.length > 0) {
				push(
					findings,
					{
						rule_id: "status.north_star.contract_parity.contract_shape_invalid",
						surface: "status",
						rule_result: "error",
						severity: "error",
						message: `Canonical contract shape is invalid for drift parity checks; missing or malformed field(s): ${missingContractShape.join(", ")}`,
						path: "harness.contract.json",
					},
					baselineFingerprints,
				);
			}

			if (Array.isArray(parsed.productSurface?.surfaces)) {
				for (const surface of parsed.productSurface.surfaces) {
					const surfaceId =
						typeof surface.surfaceId === "string" &&
						surface.surfaceId.trim().length > 0
							? surface.surfaceId
							: "unknown";

					for (const ownedPath of surface.ownedPaths ?? []) {
						const normalizedOwnedPath = parseContractReferencePath(ownedPath);
						if (!normalizedOwnedPath) {
							continue;
						}
						const resolvedOwnedPath = resolveContractReferencePath(
							repoRoot,
							normalizedOwnedPath,
						);
						if (existsSync(resolvedOwnedPath)) {
							continue;
						}
						push(
							findings,
							{
								rule_id:
									"status.north_star.contract_parity.product_surface_owned_path_missing",
								surface: "status",
								rule_result: "fail",
								severity: "warning",
								message: `Product surface '${surfaceId}' declares owned path '${ownedPath}' but the file is missing.`,
								path: ownedPath,
							},
							baselineFingerprints,
						);
					}

					const evidenceReference = surface.evidenceReference;
					if (typeof evidenceReference !== "string") {
						continue;
					}
					const normalizedEvidencePath =
						parseContractReferencePath(evidenceReference);
					if (
						!normalizedEvidencePath ||
						normalizedEvidencePath.startsWith("artifacts/") ||
						normalizedEvidencePath.startsWith("/artifacts/")
					) {
						continue;
					}
					const resolvedEvidencePath = resolveContractReferencePath(
						repoRoot,
						normalizedEvidencePath,
					);
					if (existsSync(resolvedEvidencePath)) {
						continue;
					}
					push(
						findings,
						{
							rule_id:
								"status.north_star.contract_parity.product_surface_evidence_reference_missing",
							surface: "status",
							rule_result: "fail",
							severity: "warning",
							message: `Product surface '${surfaceId}' declares evidenceReference '${evidenceReference}' but the file is missing.`,
							path: evidenceReference,
						},
						baselineFingerprints,
					);
				}
			}

			const northStar = parsed.northStar;
			if (
				northStar &&
				typeof northStar === "object" &&
				missingContractShape.length === 0
			) {
				const mission = northStar.mission as string;
				const primaryMetric = northStar.primaryMetric as string;
				const primaryBottleneck = northStar.primaryBottleneck as string;
				const autonomyBoundary = northStar.autonomyBoundary as string;
				const safetyFloor = northStar.safetyFloor as string[];
				const nonGoals = northStar.nonGoals as string[];
				const decisionQuestionPrompts =
					northStar.decisionQuestions
						?.map((question) => question.prompt)
						.filter((prompt): prompt is string => typeof prompt === "string") ??
					[];
				const northStarDocPath = join(repoRoot, "docs/roadmap/north-star.md");
				const northStarDocSource = readTextFile(northStarDocPath);
				if (!northStarDocSource) {
					push(
						findings,
						{
							rule_id:
								"status.north_star.contract_parity.north_star_doc.missing",
							surface: "status",
							rule_result: "fail",
							severity: "warning",
							message:
								"North-star roadmap doc is missing; canonical narrative parity cannot be verified.",
							path: "docs/roadmap/north-star.md",
						},
						baselineFingerprints,
					);
				} else {
					const normalizedDoc = normalizeNarrativeText(northStarDocSource);
					const missingDocElements = collectNorthStarDocParityMissing({
						normalizedDoc,
						mission,
						primaryBottleneck,
						autonomyBoundary,
						safetyFloor,
						nonGoals,
						decisionQuestionPrompts,
					});
					if (missingDocElements.length > 0) {
						push(
							findings,
							{
								rule_id: "status.north_star.contract_parity.north_star_doc",
								surface: "status",
								rule_result: "fail",
								severity: "warning",
								message: `North-star roadmap doc is missing canonical contract element(s): ${missingDocElements.join(", ")}`,
								path: "docs/roadmap/north-star.md",
							},
							baselineFingerprints,
						);
					}
				}

				const readmePath = join(repoRoot, "README.md");
				const readmeSource = readTextFile(readmePath);
				if (!readmeSource) {
					push(
						findings,
						{
							rule_id: "status.north_star.contract_parity.readme.missing",
							surface: "status",
							rule_result: "fail",
							severity: "warning",
							message:
								"README is missing; north-star product-surface summary parity cannot be verified.",
							path: "README.md",
						},
						baselineFingerprints,
					);
				} else {
					const normalizedReadme = normalizeNarrativeText(readmeSource);
					const missingReadmeElements = collectReadmeParityMissing({
						normalizedReadme,
						mission,
						primaryMetric,
						primaryBottleneck,
					});
					if (missingReadmeElements.length > 0) {
						push(
							findings,
							{
								rule_id: "status.north_star.contract_parity.readme",
								surface: "status",
								rule_result: "fail",
								severity: "warning",
								message: `README north-star summary is missing canonical contract element(s): ${missingReadmeElements.join(", ")}`,
								path: "README.md",
							},
							baselineFingerprints,
						);
					}
				}
			}

			if (statusMetricRows && Array.isArray(parsed.productSurface?.surfaces)) {
				const surfaceClassRow = statusMetricRows.get(
					"surface_class_counts{core,adjacent,experimental}",
				);
				const actualCounts = surfaceClassRow
					? parseSurfaceClassCounts(surfaceClassRow.current)
					: undefined;
				const expectedCounts = countSurfaceClasses(
					parsed.productSurface.surfaces,
				);
				if (!actualCounts) {
					push(
						findings,
						{
							rule_id: "status.metrics.surface_class_counts.mismatch",
							surface: "status",
							rule_result: "fail",
							severity: "warning",
							message:
								"Status matrix surface_class_counts metric is malformed; expected format core/adjacent/experimental (for example 2/3/0).",
							path: "docs/roadmap/agent-first-status.md",
						},
						baselineFingerprints,
					);
				} else if (
					actualCounts.core !== expectedCounts.core ||
					actualCounts.adjacent !== expectedCounts.adjacent ||
					actualCounts.experimental !== expectedCounts.experimental
				) {
					push(
						findings,
						{
							rule_id: "status.metrics.surface_class_counts.mismatch",
							surface: "status",
							rule_result: "fail",
							severity: "warning",
							message: `Status matrix surface_class_counts (${formatSurfaceClassCounts(actualCounts)}) does not match contract productSurface class totals (${formatSurfaceClassCounts(expectedCounts)}).`,
							path: "docs/roadmap/agent-first-status.md",
						},
						baselineFingerprints,
					);
				}
			}
		} catch (error) {
			push(
				findings,
				{
					rule_id: "status.north_star.contract_parity.contract_parse_error",
					surface: "status",
					rule_result: "error",
					severity: "error",
					message: `Failed to parse harness.contract.json for north-star parity checks: ${sanitizeError(error)}`,
					path: "harness.contract.json",
				},
				baselineFingerprints,
			);
		}
	} else {
		push(
			findings,
			{
				rule_id: "status.north_star.contract_parity.contract_missing",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message:
					"Canonical harness.contract.json is missing; north-star contract parity checks cannot run.",
				path: "harness.contract.json",
			},
			baselineFingerprints,
		);
	}

	return findings;
}

function hasHealthBlockingFindings(findings: DriftFinding[]): boolean {
	return findings.some(
		(finding) =>
			finding.surface === "status" &&
			finding.baseline_state === "new" &&
			(finding.rule_result === "fail" || finding.rule_result === "error"),
	);
}

function resolveDefaultBaselinePath(repoRoot: string): string {
	const canonicalBaselinePath = normalizePath(repoRoot, DEFAULT_BASELINE_PATH);
	if (existsSync(canonicalBaselinePath)) {
		return DEFAULT_BASELINE_PATH;
	}
	const legacyBaselinePath = normalizePath(
		repoRoot,
		LEGACY_DEFAULT_BASELINE_PATH,
	);
	if (existsSync(legacyBaselinePath)) {
		return LEGACY_DEFAULT_BASELINE_PATH;
	}
	return DEFAULT_BASELINE_PATH;
}

export function runDriftGate(options: DriftGateOptions = {}): DriftGateResult {
	const mode: DriftGateMode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const baselinePath =
		options.baselinePath ?? resolveDefaultBaselinePath(repoRoot);
	const suppressions = new Set(options.suppressions ?? []);
	const baseline = loadBaselineFingerprints(repoRoot, baselinePath);

	let outcome: DriftOutcome = "ok";
	let errorClass: DriftErrorClass = "none";
	let baselineSeeded = false;
	const allFindings = evaluate(repoRoot, baseline.fingerprints);

	// Separate suppressed findings
	const suppressed: DriftFinding[] = [];
	const findings: DriftFinding[] = [];
	for (const finding of allFindings) {
		const suppressible = FIX_GUIDANCE[finding.rule_id]?.suppressible ?? true;
		if (suppressions.has(finding.rule_id) && suppressible) {
			suppressed.push(finding);
		} else {
			findings.push(finding);
		}
	}

	if (baseline.loadingError) {
		outcome = "error";
		errorClass = baseline.loadingError.errorClass;
		push(
			findings,
			{
				rule_id: "baseline.load.error",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: baseline.loadingError.message,
				path: baselinePath,
			},
			baseline.fingerprints,
		);
	} else if (!baseline.info.loaded) {
		if (options.seedBaseline === true) {
			// Seed baseline explicitly when requested.
			try {
				const resolvedBaseline = normalizePath(repoRoot, baselinePath);
				mkdirSync(dirname(resolvedBaseline), { recursive: true });
				const baselineReport = {
					schemaVersion: "1.0.0",
					generated_at: new Date().toISOString(),
					findings: findings.map((f) => ({
						rule_id: f.rule_id,
						surface: f.surface,
						path: f.path,
					})),
				};
				writeFileSync(
					resolvedBaseline,
					`${JSON.stringify(baselineReport, null, 2)}\n`,
					"utf-8",
				);
				// Mark all current findings as preexisting since we just seeded
				for (const f of findings) {
					f.baseline_state = "preexisting";
				}
				baseline.info = { path: baseline.info.path, loaded: true };
				baselineSeeded = true;
			} catch {
				// Fall through to "seed missing" finding if write fails
				push(
					findings,
					{
						rule_id: "baseline.seed.missing",
						surface: "status",
						rule_result: "not_applicable",
						severity: "info",
						message:
							"Baseline seed is missing and explicit --seed-baseline write failed; reporting current findings as new.",
						path: baselinePath,
					},
					baseline.fingerprints,
				);
			}
		} else {
			push(
				findings,
				{
					rule_id: "baseline.seed.missing",
					surface: "status",
					rule_result: "not_applicable",
					severity: "info",
					message:
						"Baseline seed is missing; reporting current findings as new until default-branch baseline is published.",
					path: baselinePath,
				},
				baseline.fingerprints,
			);
		}
	}

	let status: DriftStatus = "success";
	if (outcome === "error") {
		status = "blocked";
	} else if (findings.length > 0) {
		status = "partial";
	}

	const report: DriftReport = {
		schemaVersion: "1.0.0",
		command: "drift-gate",
		mode,
		status,
		outcome,
		error_class: errorClass,
		generated_at: new Date().toISOString(),
		repo_root: repoRoot,
		baseline: baseline.info,
		summary: {
			finding_count: findings.length,
			new_count: findings.filter((f) => f.baseline_state === "new").length,
			preexisting_count: findings.filter(
				(f) => f.baseline_state === "preexisting",
			).length,
			error_count: findings.filter((f) => f.rule_result === "error").length,
			suppressed_count: suppressed.length,
		},
		findings,
		...(suppressed.length > 0 ? { suppressed } : {}),
		...(baselineSeeded ? { baseline_seeded: true } : {}),
	};

	const outPath =
		options.outPath ?? (mode === "advisory" ? DEFAULT_OUT_PATH : undefined);
	if (outPath) {
		try {
			const resolvedOutPath = validatePath(repoRoot, outPath);
			mkdirSync(dirname(resolvedOutPath), { recursive: true });
			writeFileSync(
				resolvedOutPath,
				`${JSON.stringify(report, null, 2)}\n`,
				"utf-8",
			);
		} catch (error) {
			report.outcome = "error";
			report.error_class = "io";
			report.status = "blocked";
			push(
				report.findings,
				{
					rule_id: "report.output.write_error",
					surface: "status",
					rule_result: "error",
					severity: "error",
					message: `Failed to write report output: ${sanitizeError(error)}`,
					path: outPath,
				},
				baseline.fingerprints,
			);
			updateReportSummary(report, suppressed.length);
		}
	}

	const canonicalArtifacts: Array<{ path: string; payload: unknown }> = [
		{
			path: DEFAULT_DRIFT_FINDINGS_PATH,
			payload: report,
		},
		{
			path: DEFAULT_SURFACE_CLASSIFICATION_SNAPSHOT_PATH,
			payload: buildSurfaceClassificationSnapshot(
				repoRoot,
				report.generated_at,
			),
		},
	];
	for (const artifact of canonicalArtifacts) {
		try {
			const resolvedArtifactPath = validatePath(repoRoot, artifact.path);
			mkdirSync(dirname(resolvedArtifactPath), { recursive: true });
			writeFileSync(
				resolvedArtifactPath,
				`${JSON.stringify(artifact.payload, null, 2)}\n`,
				"utf-8",
			);
		} catch (error) {
			report.outcome = "error";
			report.error_class = "io";
			report.status = "blocked";
			push(
				report.findings,
				{
					rule_id: "report.output.write_error",
					surface: "status",
					rule_result: "error",
					severity: "error",
					message: `Failed to write report output: ${sanitizeError(error)}`,
					path: artifact.path,
				},
				baseline.fingerprints,
			);
			updateReportSummary(report, suppressed.length);
		}
	}

	const healthBlockedByFindings =
		mode === "health" && hasHealthBlockingFindings(report.findings);
	const exitCode =
		mode === "health" && (report.outcome === "error" || healthBlockedByFindings)
			? 1
			: 0;
	return { report, exitCode };
}

export function runDriftGateCLI(options: DriftGateOptions = {}): number {
	const result = runDriftGate(options);

	if (options.json) {
		const gateResult = normaliseDriftGateResult(result);
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		const icon =
			result.report.status === "success"
				? "✓"
				: result.report.status === "partial"
					? "⚠"
					: "✗";
		console.info(
			`${icon} drift-gate (${result.report.mode}) ${result.report.status}`,
		);
		console.info(
			`Findings: ${result.report.summary.finding_count} (new: ${result.report.summary.new_count}, preexisting: ${result.report.summary.preexisting_count})`,
		);
		if (result.report.summary.suppressed_count > 0) {
			console.info(`Suppressed: ${result.report.summary.suppressed_count}`);
		}
		if (result.report.baseline_seeded) {
			console.info(
				`Baseline: seeded with ${result.report.summary.preexisting_count} findings`,
			);
		} else if (result.report.baseline.loaded) {
			console.info(`Baseline: loaded from ${result.report.baseline.path}`);
		} else {
			console.info(
				`Baseline: unavailable (${result.report.baseline.reason ?? "unknown"})`,
			);
		}

		if (result.report.findings.length > 0) {
			console.info("");
			for (const finding of result.report.findings) {
				const level =
					finding.severity === "error"
						? "ERROR"
						: finding.severity === "warning"
							? "WARN"
							: "INFO";
				const suffix = finding.path ? ` (${finding.path})` : "";
				console.info(
					`- [${level}] ${finding.rule_id}: ${finding.message}${suffix}`,
				);
				// JSC-68: Show fix guidance in human-readable output
				if (finding.fix) {
					if (finding.fix.command) {
						console.info(`  Fix: ${finding.fix.command}`);
					} else if (finding.fix.manual) {
						console.info(`  Fix: ${finding.fix.manual}`);
					}
				}
			}
		}
	}

	return result.exitCode;
}
