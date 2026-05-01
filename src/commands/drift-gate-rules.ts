import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	evaluateNorthStarSurfaceParity,
	evaluateProductSurfaceCadence,
	findMatchingProductSurfaces,
} from "../lib/contract/north-star-alignment.js";
import {
	type DurableGuardrail,
	resolveGuardrailRecurrence,
	writeNorthStarDurableGuardrail,
} from "../lib/contract/north-star-artifact-io.js";
import type { HarnessContract } from "../lib/contract/types.js";
import {
	type DriftBaselineState,
	type DriftFinding,
	type DriftFixGuidance,
	readTextFile,
} from "./drift-gate-types.js";

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

function extractRegistryCommands(commandSpecsSource: string): string[] {
	const commands = new Set<string>();
	const nameRegex = /name:\s*"([a-z][a-z0-9:-]*)"/g;
	let match: RegExpExecArray | null = nameRegex.exec(commandSpecsSource);
	while (match) {
		if (match[1]) {
			commands.add(match[1]);
		}
		match = nameRegex.exec(commandSpecsSource);
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
		manual: "Remove duplicate help entry in CLI usage output.",
		suppressible: false,
	},
	"todo.lifecycle.not_applicable": {
		manual:
			"Create a todos/ directory if your project uses todo lifecycle tracking.",
		suppressible: true,
	},
	"todo.lifecycle.status.missing": {
		manual: "Add frontmatter status to the todo file.",
		suppressible: false,
	},
	"todo.lifecycle.status.mismatch": {
		manual: "Align todo filename status segment with frontmatter status.",
		suppressible: false,
	},
	"quality.score.missing": {
		manual: "Create docs/QUALITY_SCORE.md with required structure.",
		suppressible: true,
	},
	"quality.score.structure.invalid": {
		manual:
			"Add frontmatter with last_updated and a **Score:** x/100 line to docs/QUALITY_SCORE.md.",
		suppressible: false,
	},
	"quality.score.last_updated.invalid": {
		manual: "Fix the last_updated date format in docs/QUALITY_SCORE.md.",
		suppressible: false,
	},
	"quality.score.stale": {
		manual: "Update docs/QUALITY_SCORE.md last_updated date.",
		suppressible: false,
	},
	"status.matrix.missing": {
		manual: "Create docs/roadmap/agent-first-status.md with a status matrix.",
		suppressible: true,
	},
	"status.narrative.coherence": {
		manual:
			"Ensure status matrix accurately reflects outstanding work (ready todos vs complete status).",
		suppressible: false,
	},
	"status.north_star.doc.missing": {
		manual:
			"Create docs/roadmap/north-star.md with the canonical mission, metric, and bottleneck.",
		suppressible: false,
	},
	"status.north_star.mission.mismatch": {
		manual:
			"Align README and docs/roadmap/north-star.md with the contract mission.",
		suppressible: false,
	},
	"status.north_star.metric.mismatch": {
		manual:
			"Align README and docs/roadmap/north-star.md with the contract primaryMetric (pr_lead_time).",
		suppressible: false,
	},
	"status.north_star.bottleneck.mismatch": {
		manual:
			"Align README and docs/roadmap/north-star.md with the contract primaryBottleneck (review_rework_loop).",
		suppressible: false,
	},
	"status.north_star.autonomy.mismatch": {
		manual:
			"Align docs/roadmap/north-star.md with the contract autonomyBoundary.",
		suppressible: false,
	},
	"status.north_star.safety_floor.mismatch": {
		manual:
			"Align docs/roadmap/north-star.md with the contract safetyFloor clauses.",
		suppressible: false,
	},
	"status.north_star.status.mismatch": {
		manual:
			"Align docs/roadmap/agent-first-status.md with the contract primaryMetric and primaryBottleneck.",
		suppressible: false,
	},
	"status.north_star.contract.invalid": {
		manual:
			"Repair harness.contract.json so north-star runtime surfaces can be validated against the canonical contract.",
		suppressible: false,
	},
	"status.north_star.readme.mismatch": {
		manual:
			"Restore the README north-star framing so it preserves the canonical mission, metric, and bottleneck.",
		suppressible: false,
	},
	"status.north_star.doc.mismatch": {
		manual:
			"Restore docs/roadmap/north-star.md so it matches the canonical mission, metric, autonomy boundary, and safety floor.",
		suppressible: false,
	},
	"status.north_star.status_doc.mismatch": {
		manual:
			"Update docs/roadmap/agent-first-status.md so it reports progress against PR lead time and the review/rework loop bottleneck.",
		suppressible: false,
	},
	"product.surface.cadence.stale": {
		manual: "Review the registered surface and update lastReviewedAt.",
		suppressible: false,
	},
	"product.surface.cadence.breached": {
		manual: "Schedule a review for the registered surface.",
		suppressible: false,
	},
	"product.surface.owned_paths.gap": {
		manual:
			"Register the changed path under the appropriate surface's ownedPaths.",
		suppressible: false,
	},
	"baseline.load.error": {
		manual: "Fix or regenerate the baseline file.",
		suppressible: false,
	},
	"baseline.seed.missing": {
		manual:
			"Run drift-gate on the default branch to publish a baseline, or use --seed-baseline.",
		suppressible: true,
	},
	"report.output.write_error": {
		manual: "Check output path permissions and disk space.",
		suppressible: false,
	},
	"status.north_star.drift_artifact.write_error": {
		manual:
			"Confirm .harness/guardrails/north-star is writable, then rerun harness drift-gate --json.",
		suppressible: false,
	},
};

function attachFixGuidance(finding: DriftFinding): void {
	const guidance = FIX_GUIDANCE[finding.rule_id];
	if (guidance) {
		finding.fix = guidance;
	}
}

/**
 * Push a drift finding into the findings array, computing its baseline state from fingerprints.
 *
 * @param findings - Mutable array of findings to append to
 * @param raw - Finding data without baseline_state (computed automatically)
 * @param baselineFingerprints - Set of fingerprints for baseline comparison
 */
export function push(
	findings: DriftFinding[],
	raw: Omit<DriftFinding, "baseline_state"> & {
		baseline_state?: DriftBaselineState;
	},
	baselineFingerprints: Set<string>,
): void {
	const discriminator =
		(raw as { fingerprint_key?: unknown }).fingerprint_key ??
		(raw as { command?: unknown }).command ??
		(raw as { command_name?: unknown }).command_name ??
		(raw as { target?: unknown }).target ??
		"";
	const fingerprintParts = [raw.rule_id, raw.surface, raw.path ?? ""];
	if (String(discriminator).length > 0)
		fingerprintParts.push(String(discriminator));
	const fingerprint = fingerprintParts.join("|");
	const baseline_state: DriftBaselineState = baselineFingerprints.has(
		fingerprint,
	)
		? "preexisting"
		: "new";
	const finding: DriftFinding = {
		...(raw as DriftFinding),
		baseline_state,
	};
	attachFixGuidance(finding);
	findings.push(finding);
}

function evaluateCommandSurface(
	findings: DriftFinding[],
	repoRoot: string,
	baselineFingerprints: Set<string>,
): void {
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
		return;
	}

	const dispatchCommands = extractDispatchCommands(cliSource);
	const usesRegistryDispatch = cliSource.includes("dispatchRegistryCommand(");
	const commandSpecsPath = join(
		repoRoot,
		"src/lib/cli/registry/command-specs.ts",
	);
	const commandSpecsSource = usesRegistryDispatch
		? readTextFile(commandSpecsPath)
		: undefined;
	if (usesRegistryDispatch && !commandSpecsSource) {
		push(
			findings,
			{
				rule_id: "command.surface.sources.missing",
				surface: "command",
				rule_result: "error",
				severity: "error",
				message:
					"Registry-backed command surface is missing src/lib/cli/registry/command-specs.ts.",
				path: "src/lib/cli/registry/command-specs.ts",
			},
			baselineFingerprints,
		);
		return;
	}
	const canonicalCommands =
		usesRegistryDispatch && commandSpecsSource
			? extractRegistryCommands(commandSpecsSource)
			: dispatchCommands;
	const helpCommands = extractHelpCommands(cliSource);
	const readmeCommands = extractReadmeCommands(readmeSource);

	for (const command of canonicalCommands) {
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
		if (!canonicalCommands.includes(command)) {
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

function evaluateTodoLifecycle(
	findings: DriftFinding[],
	repoRoot: string,
	baselineFingerprints: Set<string>,
): void {
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
		return;
	}

	const todoFiles = readdirSync(todoDir)
		.filter((name) => /-(ready|complete|deferred)-.*\.md$/i.test(name))
		.sort();

	for (const todoFile of todoFiles) {
		const expectedStatus = todoFile.match(/-(ready|complete|deferred)-/i)?.[1];
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

function evaluateQualityScore(
	findings: DriftFinding[],
	repoRoot: string,
	baselineFingerprints: Set<string>,
): void {
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
		return;
	}

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
		return;
	}

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
		return;
	}

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

function evaluateStatusNarrative(
	findings: DriftFinding[],
	repoRoot: string,
	baselineFingerprints: Set<string>,
): void {
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
		return;
	}

	const statuses = Array.from(
		statusSource.matchAll(/\*\*Status:\*\*\s+([^\n]+)/g),
	).map((match) => match[1]?.trim() ?? "");
	const allComplete =
		statuses.length > 0 &&
		statuses.every((value) => value.includes("✅ Complete"));
	const todoDir = join(repoRoot, "todos");
	const readyTodos = existsSync(todoDir)
		? readdirSync(todoDir).filter((name) => /-ready-.*\.md$/i.test(name)).length
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

function evaluateNorthStarParity(
	findings: DriftFinding[],
	repoRoot: string,
	contract: HarnessContract,
	baselineFingerprints: Set<string>,
): void {
	const northStarPath = join(repoRoot, "docs/roadmap/north-star.md");
	const northStarSource = readTextFile(northStarPath);
	const readmePath = join(repoRoot, "README.md");
	const readmeSource = readTextFile(readmePath);
	const statusPath = join(repoRoot, "docs/roadmap/agent-first-status.md");
	const statusSource = readTextFile(statusPath);

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

function evaluateProductSurface(
	findings: DriftFinding[],
	contract: HarnessContract,
	baselineFingerprints: Set<string>,
): void {
	if (!contract.productSurface) {
		return;
	}
	const cadenceIssues = evaluateProductSurfaceCadence(contract.productSurface);
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

/**
 * Performs checks across command surface parity, todo lifecycle, quality score,
 * status narrative coherence, and—when a harness contract with a northStar is
 * provided—north star document parity.
 *
 * @param repoRoot - Repository root path
 * @param baselineFingerprints - Set of baseline finding fingerprints
 * @param contract - Optional harness contract; when present and containing northStar, north-star parity checks are executed
 * @returns Array of drift findings
 */
export function evaluate(
	repoRoot: string,
	baselineFingerprints: Set<string>,
	contract: HarnessContract | undefined,
): DriftFinding[] {
	const findings: DriftFinding[] = [];

	evaluateCommandSurface(findings, repoRoot, baselineFingerprints);
	evaluateTodoLifecycle(findings, repoRoot, baselineFingerprints);
	evaluateQualityScore(findings, repoRoot, baselineFingerprints);
	evaluateStatusNarrative(findings, repoRoot, baselineFingerprints);

	if (contract?.northStar) {
		evaluateNorthStarParity(findings, repoRoot, contract, baselineFingerprints);
	}

	if (contract?.productSurface) {
		evaluateProductSurface(findings, contract, baselineFingerprints);
	}

	return findings;
}

/**
 * Create or update durable guardrail artifacts for findings that include a `failureClass`.
 *
 * @param repoRoot - Filesystem path to the repository root used for reading and writing artifacts
 * @param findings - Findings to evaluate; only entries with `failureClass` are processed
 * @param contract - Harness contract; if `productSurface` is absent, eligible findings are grouped under a global surface fallback
 * @returns The filesystem paths of durable guardrail artifact files that were written
 */
export function emitGuardrailsForFindings(
	repoRoot: string,
	findings: DriftFinding[],
	contract: HarnessContract | undefined,
): string[] {
	if (!contract) {
		return [];
	}

	const emittedPaths: string[] = [];
	const groupedFindings = new Map<
		string,
		{
			failureClass: string;
			surfaceIds: string[];
			pathValue: string;
			ruleIds: Set<string>;
		}
	>();

	for (const finding of findings) {
		if (
			!finding.failureClass ||
			(finding.severity !== "error" &&
				!(finding.surface === "status" && finding.rule_result === "fail"))
		) {
			continue;
		}
		const pathValue = finding.path ?? "";
		const matchingSurfaces = contract.productSurface
			? findMatchingProductSurfaces(
					contract.productSurface,
					pathValue ? [pathValue] : [],
				)
			: [];
		const surfaceIds =
			matchingSurfaces.length > 0
				? matchingSurfaces.map((s) => s.surfaceId)
				: ["global"];

		const key = `${finding.failureClass}::${surfaceIds.join(",")}`;
		const existing = groupedFindings.get(key);
		if (existing) {
			existing.ruleIds.add(finding.rule_id);
			continue;
		}
		groupedFindings.set(key, {
			failureClass: finding.failureClass,
			surfaceIds,
			pathValue,
			ruleIds: new Set([finding.rule_id]),
		});
	}

	for (const entry of groupedFindings.values()) {
		const recurrence = resolveGuardrailRecurrence(
			repoRoot,
			entry.failureClass,
			entry.surfaceIds,
		);

		const now = new Date().toISOString();
		const guardrail: DurableGuardrail = {
			schemaVersion: "north-star-durable-guardrail/v1",
			guardrailId: recurrence.guardrailId,
			failureClass: entry.failureClass,
			triggeredByFindingIds: Array.from(entry.ruleIds).sort(),
			recurrenceCount: recurrence.exists ? recurrence.recurrenceCount + 1 : 1,
			createdAtUtc: now,
			owner: "workflow",
			implementationTarget: entry.pathValue || "repo-root",
			// "implemented" = guardrail artifact exists; "proposed" = newly detected
			status: recurrence.exists ? "implemented" : "proposed",
		};

		const writtenPath = writeNorthStarDurableGuardrail(repoRoot, guardrail);
		emittedPaths.push(writtenPath);
	}

	return emittedPaths;
}
