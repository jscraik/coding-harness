import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";

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
}

export interface DriftFinding {
	rule_id: string;
	surface: DriftSurface;
	rule_result: DriftRuleResult;
	severity: DriftSeverity;
	baseline_state: DriftBaselineState;
	message: string;
	path?: string;
	details?: string;
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
	};
	findings: DriftFinding[];
}

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
	collection.push(staged);
}

function evaluate(
	repoRoot: string,
	baselineFingerprints: Set<string>,
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

	return findings;
}

export function runDriftGate(options: DriftGateOptions = {}): DriftGateResult {
	const mode: DriftGateMode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const baselinePath = options.baselinePath ?? DEFAULT_BASELINE_PATH;
	const baseline = loadBaselineFingerprints(repoRoot, baselinePath);

	let outcome: DriftOutcome = "ok";
	let errorClass: DriftErrorClass = "none";
	const findings = evaluate(repoRoot, baseline.fingerprints);

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
		},
		findings,
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
			report.summary = {
				finding_count: report.findings.length,
				new_count: report.findings.filter((f) => f.baseline_state === "new")
					.length,
				preexisting_count: report.findings.filter(
					(f) => f.baseline_state === "preexisting",
				).length,
				error_count: report.findings.filter((f) => f.rule_result === "error")
					.length,
			};
		}
	}

	const exitCode = mode === "health" && report.outcome === "error" ? 2 : 0;
	return { report, exitCode };
}

export function runDriftGateCLI(options: DriftGateOptions = {}): number {
	const result = runDriftGate(options);

	if (options.json) {
		console.info(JSON.stringify(result.report, null, 2));
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
		if (result.report.baseline.loaded) {
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
			}
		}
	}

	return result.exitCode;
}
