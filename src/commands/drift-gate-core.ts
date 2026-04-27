import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import {
	evaluateNorthStarSurfaceParity,
	evaluateProductSurfaceCadence,
	findMatchingProductSurfaces,
} from "../lib/contract/north-star-alignment.js";
import {
	type DurableGuardrail,
	resolveActiveOverrides,
	resolveGuardrailRecurrence,
	writeNorthStarDurableGuardrail,
} from "../lib/contract/north-star-artifact-io.js";
import type { HarnessContract } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";
import { normaliseDriftGateResult } from "../lib/output/normalise.js";
import {
	type DriftSummary,
	type NorthStarDriftArtifactRef,
	createNorthStarDriftArtifactRef,
	getNorthStarDriftArtifactPath,
	summarizeDriftFindings,
	writeNorthStarDriftFindingsArtifact,
} from "./drift-gate-artifacts.js";

/** Drift-gate execution mode. */
export type DriftGateMode = "advisory" | "health";
/** Aggregate drift-gate report status. */
export type DriftStatus = "success" | "partial" | "blocked";
/** Top-level drift-gate runtime outcome. */
export type DriftOutcome = "ok" | "error";
/** Machine-readable drift-gate failure class. */
export type DriftErrorClass =
	| "none"
	| "evaluator"
	| "io"
	| "schema"
	| "runtime"
	| "integrity";
/** Result of one drift rule evaluation. */
export type DriftRuleResult = "pass" | "fail" | "not_applicable" | "error";
/** Drift surface family used for grouping findings. */
export type DriftSurface = "command" | "status" | "todo" | "quality-score";
/** Finding severity emitted by drift-gate. */
export type DriftSeverity = "info" | "warning" | "error";
/** Whether a finding already exists in the drift baseline. */
export type DriftBaselineState = "preexisting" | "new";

/** Runtime options for invoking drift-gate directly or through the CLI adapter. */
export interface DriftGateOptions {
	mode?: DriftGateMode;
	json?: boolean;
	outPath?: string;
	baselinePath?: string;
	repoRoot?: string;
	seedBaseline?: boolean;
	suppressions?: string[];
}

/** Remediation guidance attached to a drift finding. */
export interface DriftFixGuidance {
	command?: string;
	manual?: string;
	suppressible?: boolean;
}

/** One drift-gate finding before conversion to canonical structured output. */
export interface DriftFinding {
	rule_id: string;
	surface: DriftSurface;
	rule_result: DriftRuleResult;
	severity: DriftSeverity;
	baseline_state: DriftBaselineState;
	message: string;
	path?: string;
	details?: string;
	fix?: DriftFixGuidance;
	/** Spec-aligned failure class for blocked-state resume routing */
	failureClass?: string;
}

interface DriftBaselineInfo {
	path: string;
	loaded: boolean;
	reason?: string;
}

/** Full drift-gate report persisted to disk and returned by programmatic callers. */
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
	summary: DriftSummary;
	findings: DriftFinding[];
	suppressed?: DriftFinding[];
	baseline_seeded?: boolean;
	artifact_refs?: NorthStarDriftArtifactRef[];
	/** Canonical paths of durable guardrail artifacts emitted during this run */
	guardrail_refs?: string[];
}

/** Programmatic result returned by a drift-gate run. */
export interface DriftGateResult {
	report: DriftReport;
	exitCode: number;
}

const DEFAULT_BASELINE_PATH =
	"artifacts/consistency-gate/consistency-baseline-latest.json";
const DEFAULT_OUT_PATH =
	"artifacts/consistency-gate/consistency-drift-advisory-latest.json";

function normalizePath(repoRoot: string, pathValue: string): string {
	return pathValue.startsWith("/") ? pathValue : resolve(repoRoot, pathValue);
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

function extractReadmeCommands(readmeSource: string): string[] {
	const commands = new Set<string>();
	const regex = /^\|\s+`([^`]+)`\s+\|/gm;
	let match: RegExpExecArray | null = regex.exec(readmeSource);
	while (match) {
		if (match[1]) {
			commands.add(match[1]);
		}
		match = regex.exec(readmeSource);
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
	"status.north_star.contract.invalid": {
		manual:
			"Repair harness.contract.json so north-star runtime surfaces can be validated against the canonical contract.",
		suppressible: false,
	},
	"status.north_star.contract_parity.readme": {
		manual:
			"Restore the README north-star framing so it preserves the canonical mission, metric, and bottleneck.",
		suppressible: false,
	},
	"status.north_star.contract_parity.north_star_doc": {
		manual:
			"Restore docs/roadmap/north-star.md so it matches the canonical mission, metric, autonomy boundary, and safety floor.",
		suppressible: false,
	},
	"status.north_star.contract_parity.agent_first_status": {
		manual:
			"Update docs/roadmap/agent-first-status.md so it reports progress against PR lead time and the review/rework loop bottleneck.",
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
	const staged: DriftFinding = {
		...finding,
		baseline_state: "new",
	};
	staged.baseline_state = baselineFingerprints.has(findingFingerprint(staged))
		? "preexisting"
		: "new";
	// Attach fix guidance if available
	const guidance = FIX_GUIDANCE[staged.rule_id];
	if (guidance) {
		staged.fix = guidance;
	}
	collection.push(staged);
}

/**
 * Evaluates repository consistency rules and returns detected drift findings.
 *
 * Performs checks across command surface parity (CLI vs README), todo filename vs frontmatter status, quality score structure and freshness, status narrative coherence, and—when a harness contract with a northStar is provided—north star document parity. Each detected issue is returned as a `DriftFinding`.
 *
 * @param repoRoot - Absolute path to the repository root to evaluate
 * @param baselineFingerprints - Set of baseline fingerprints used to mark findings as `preexisting` when a match is found
 * @param contract - Optional harness contract; when present and containing `northStar`, north-star parity checks are executed
 * @returns An array of `DriftFinding` objects describing discovered issues; each finding includes rule metadata, message, optional `path` and `fix` guidance, and a `baseline_state` of `preexisting` or `new`
 */
function evaluate(
	repoRoot: string,
	baselineFingerprints: Set<string>,
	contract: HarnessContract | undefined,
): DriftFinding[] {
	const findings: DriftFinding[] = [];

	// Rule: command surface parity (CLI dispatch/help vs README command table)
	const cliPath = join(repoRoot, "src/cli.ts");
	const readmePath = join(repoRoot, "README.md");
	const cliSource = readTextFile(cliPath);
	const readmeSource = readTextFile(readmePath);

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
		const dispatchCommands = extractDispatchCommands(cliSource);
		const helpCommands = extractHelpCommands(cliSource);
		const readmeCommands = extractReadmeCommands(readmeSource);

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
	}

	if (contract?.northStar) {
		const northStarPath = join(repoRoot, "docs/roadmap/north-star.md");
		const northStarSource = readTextFile(northStarPath);
		const parityIssues = evaluateNorthStarSurfaceParity(contract, [
			{
				key: "readme",
				path: "README.md",
				content: readmeSource,
			},
			{
				key: "north_star_doc",
				path: "docs/roadmap/north-star.md",
				content: northStarSource,
			},
			{
				key: "agent_first_status",
				path: "docs/roadmap/agent-first-status.md",
				content: statusSource,
			},
		]);
		for (const issue of parityIssues) {
			push(
				findings,
				{
					rule_id: issue.ruleId,
					surface: "status",
					rule_result: "fail",
					severity: issue.severity,
					message: issue.message,
					path: issue.path,
					...(issue.failureClass !== undefined
						? { failureClass: issue.failureClass }
						: {}),
				},
				baselineFingerprints,
			);
		}
	}

	if (contract?.productSurface) {
		const cadenceIssues = evaluateProductSurfaceCadence(
			contract.productSurface,
		);
		for (const issue of cadenceIssues) {
			push(
				findings,
				{
					rule_id: issue.ruleId,
					surface: "status",
					rule_result: "fail",
					severity: issue.severity,
					message: issue.message,
					path: issue.path,
					...(issue.failureClass !== undefined
						? { failureClass: issue.failureClass }
						: {}),
				},
				baselineFingerprints,
			);
		}
	}

	return findings;
}

/**
 * Emit or update durable guardrail artifacts for blocking findings.
 *
 * For each finding with a `failureClass`, resolves the deterministic guardrailId,
 * checks recurrence state on disk, and creates or updates the guardrail artifact.
 * Returns the set of artifact paths that were written.
 */
function emitGuardrailsForFindings(
	repoRoot: string,
	findings: DriftFinding[],
	contract: HarnessContract | undefined,
): string[] {
	if (!contract?.productSurface) {
		return [];
	}

	const emittedPaths: string[] = [];
	const processedKeys = new Set<string>();

	for (const finding of findings) {
		if (!finding.failureClass) {
			continue;
		}
		// Map finding path to governed surface IDs
		const pathValue = finding.path ?? "";
		const matchingSurfaces = findMatchingProductSurfaces(
			contract.productSurface,
			pathValue ? [pathValue] : [],
		);
		const surfaceIds =
			matchingSurfaces.length > 0
				? matchingSurfaces.map((s) => s.surfaceId)
				: ["global"];

		const recurrence = resolveGuardrailRecurrence(
			repoRoot,
			finding.failureClass,
			surfaceIds,
		);
		const key = `${finding.failureClass}::${recurrence.guardrailId}`;
		if (processedKeys.has(key)) {
			continue;
		}
		processedKeys.add(key);

		const now = new Date().toISOString();
		const guardrail: DurableGuardrail = {
			schemaVersion: "north-star-durable-guardrail/v1",
			guardrailId: recurrence.guardrailId,
			failureClass: finding.failureClass,
			triggeredByFindingIds: [finding.rule_id],
			recurrenceCount: recurrence.exists ? recurrence.recurrenceCount + 1 : 1,
			createdAtUtc: now,
			owner: "workflow",
			implementationTarget: pathValue || "repo-root",
			status: recurrence.exists ? "implemented" : "proposed",
		};

		const writtenPath = writeNorthStarDurableGuardrail(repoRoot, guardrail);
		emittedPaths.push(writtenPath);
	}

	return emittedPaths;
}

/**
 * Execute the drift-gate evaluation and produce a DriftReport plus a process-style exit code.
 *
 * Runs repository consistency checks, compares findings against an optional baseline and contract,
 * optionally seeds or writes baseline/output artifacts, and persists a north-star drift artifact.
 *
 * @param options - Configuration for the run (mode, JSON/output handling, baseline behavior, repoRoot override, seedBaseline toggle, suppressions)
 * @returns An object with `report` containing the generated `DriftReport` and `exitCode` where:
 *          - In non-health mode the exit code is always `0`.
 *          - In health mode `2` indicates an error outcome, `1` indicates a health-blocking finding, and `0` indicates success.
 */
export function runDriftGate(options: DriftGateOptions = {}): DriftGateResult {
	const mode: DriftGateMode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const baselinePath = options.baselinePath ?? DEFAULT_BASELINE_PATH;
	const suppressions = new Set(options.suppressions ?? []);
	const baseline = loadBaselineFingerprints(repoRoot, baselinePath);
	let contract: HarnessContract | undefined;
	let contractLoadingError: string | undefined;
	const contractPath = join(repoRoot, "harness.contract.json");
	if (existsSync(contractPath)) {
		try {
			contract = loadContract(contractPath, repoRoot);
		} catch (error) {
			contractLoadingError =
				error instanceof ContractLoadError
					? sanitizeError(error)
					: `Failed to load contract: ${sanitizeError(error)}`;
		}
	}

	let outcome: DriftOutcome = "ok";
	let errorClass: DriftErrorClass = "none";
	let baselineSeeded = false;
	const allFindings = evaluate(repoRoot, baseline.fingerprints, contract);

	// Separate suppressed findings
	const suppressed: DriftFinding[] = [];
	const findings: DriftFinding[] = [];
	for (const finding of allFindings) {
		if (suppressions.has(finding.rule_id)) {
			suppressed.push(finding);
		} else {
			findings.push(finding);
		}
	}

	// Apply override acknowledgements for north-star blocker findings
	if (
		contract?.overrideReviewerRegistry &&
		contract.overrideReviewerRegistry.trustedReviewers.length > 0
	) {
		const northStarFindingIds = findings
			.filter((f) => f.failureClass)
			.map((f) => f.rule_id);
		if (northStarFindingIds.length > 0) {
			const activeOverrides = resolveActiveOverrides(
				repoRoot,
				contract.overrideReviewerRegistry,
				{ activeFindingIds: northStarFindingIds },
			);
			if (activeOverrides.size > 0) {
				const remaining: DriftFinding[] = [];
				for (const finding of findings) {
					if (activeOverrides.has(finding.rule_id)) {
						suppressed.push(finding);
					} else {
						remaining.push(finding);
					}
				}
				findings.length = 0;
				findings.push(...remaining);
			}
		}
	}

	if (contractLoadingError) {
		outcome = "error";
		errorClass = "schema";
		push(
			findings,
			{
				rule_id: "status.north_star.contract.invalid",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: contractLoadingError,
				path: "harness.contract.json",
			},
			baseline.fingerprints,
		);
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
		// JSC-64: Auto-seed baseline when missing
		if (options.seedBaseline !== false) {
			// Auto-seed: write current findings as baseline
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
							"Baseline seed is missing and auto-seed failed; reporting current findings as new.",
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

	// AC3: emit durable guardrails for blocking findings with failure classes
	const guardrailPaths = emitGuardrailsForFindings(
		repoRoot,
		findings,
		contract,
	);

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
		summary: summarizeDriftFindings(findings, suppressed),
		findings,
		...(suppressed.length > 0 ? { suppressed } : {}),
		...(baselineSeeded ? { baseline_seeded: true } : {}),
		...(guardrailPaths.length > 0 ? { guardrail_refs: guardrailPaths } : {}),
	};

	const hasHealthBlockingFinding = report.findings.some(
		(finding) =>
			finding.severity === "error" ||
			(finding.surface === "status" && finding.rule_result === "fail"),
	);
	if (
		mode === "health" &&
		report.outcome !== "error" &&
		hasHealthBlockingFinding
	) {
		report.status = "blocked";
	}
	try {
		writeNorthStarDriftFindingsArtifact(repoRoot, report);
		report.artifact_refs = [createNorthStarDriftArtifactRef()];
	} catch (error) {
		report.outcome = "error";
		report.error_class = "io";
		report.status = "blocked";
		push(
			report.findings,
			{
				rule_id: "status.north_star.drift_artifact.write_error",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: `Failed to write north-star drift artifact: ${sanitizeError(error)}`,
				path: getNorthStarDriftArtifactPath(),
			},
			baseline.fingerprints,
		);
		report.summary = summarizeDriftFindings(report.findings, suppressed);
	}

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
			report.summary = summarizeDriftFindings(report.findings, suppressed);
			// Note: hasHealthBlockingFinding is stale but report.outcome="error" takes precedence in exit code logic
		}
	}
	const exitCode =
		mode !== "health"
			? 0
			: report.outcome === "error"
				? 2
				: hasHealthBlockingFinding
					? 1
					: 0;
	return { report, exitCode };
}

/**
 * Runs the drift-gate process and writes either JSON or human-readable CLI output.
 *
 * If `options.json` is true, writes a normalized JSON result to stdout; otherwise prints a concise human-readable summary and per-finding details.
 *
 * @returns The exit code to use for the process: `0` for success (or non-blocking advisory runs), `1` when health-mode findings block the gate, `2` for error conditions encountered during execution.
 */
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
				const level = finding.severity === "error" ? "ERROR" : "WARN";
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
