import { readFileSync } from "node:fs";

import { classifyRepo } from "./fleet-plan-repo.js";
import {
	countReposWithReason,
	pluralize,
	repoVerb,
	type FleetPlanCommand,
	type FleetPlanRepo,
	type FleetRemediationPlan,
	type MatrixReport,
	type ParsedFleetPlanArgs,
	FLEET_PLAN_SCHEMA_VERSION,
} from "./fleet-plan-types.js";

export {
	FLEET_PLAN_SCHEMA_VERSION,
	type FleetPlanCommand,
	type FleetPlanRepo,
	type FleetRemediationPlan,
} from "./fleet-plan-types.js";

/**
 * Compute aggregated counts of repository statuses for inclusion in a fleet remediation summary.
 *
 * @returns An object containing counts keyed by status:
 * - `repoCount`: total number of repos
 * - `ready`: repos classified as `ready`
 * - `needsAdoption`: repos classified as `needs-adoption`
 * - `needsCircleCiMigration`: repos classified as `needs-circleci-migration`
 * - `needsCodeRabbitSetup`: repos classified as `needs-coderabbit-setup`
 * - `needsCodestyleInstall`: repos classified as `needs-codestyle-install`
 * - `needsCodestyleRefresh`: repos classified as `needs-codestyle-refresh`
 * - `needsGreptileCleanup`: repos classified as `needs-greptile-cleanup`
 * - `blocked`: repos classified as `blocked`
 */
function buildSummary(repos: FleetPlanRepo[]): FleetRemediationPlan["summary"] {
	return {
		repoCount: repos.length,
		ready: repos.filter((repo) => repo.status === "ready").length,
		needsAdoption: repos.filter((repo) => repo.status === "needs-adoption")
			.length,
		needsCircleCiMigration: repos.filter(
			(repo) => repo.status === "needs-circleci-migration",
		).length,
		needsCodeRabbitSetup: repos.filter(
			(repo) => repo.status === "needs-coderabbit-setup",
		).length,
		needsCodestyleInstall: repos.filter(
			(repo) => repo.status === "needs-codestyle-install",
		).length,
		needsCodestyleRefresh: repos.filter(
			(repo) => repo.status === "needs-codestyle-refresh",
		).length,
		needsGreptileCleanup: repos.filter(
			(repo) => repo.status === "needs-greptile-cleanup",
		).length,
		blocked: repos.filter((repo) => repo.status === "blocked").length,
	};
}

/**
 * Compute aggregated counts of predefined finding categories from a list of per-repo recommendations.
 *
 * @param repos - Array of per-repo remediation recommendations to aggregate
 * @returns An object with numeric counts for each finding category:
 *  - `notHarnessTracked`: repos not tracked by Harness
 *  - `missingCircleCi`: repos missing CircleCI surfaces
 *  - `missingCodeRabbit`: repos missing CodeRabbit surfaces
 *  - `missingCodestyle`: repos missing codestyle installation
 *  - `staleCodestyle`: repos with codestyle parity failures
 *  - `legacyGreptile`: repos containing legacy Greptile artifacts
 *  - `dryRunMutatedRepository`: repos whose dry-run mutated repository state
 *  - `matrixCommandFailed`: repos where the matrix command returned a non-zero exit code
 *  - `invalidMatrixJsonOutput`: repos with invalid JSON reported by the matrix
 */
function buildFindingCounts(
	repos: FleetPlanRepo[],
): FleetRemediationPlan["findingCounts"] {
	return {
		notHarnessTracked: countReposWithReason(repos, "repo-not-harness-tracked"),
		missingCircleCi: countReposWithReason(
			repos,
			"tracked-repo-missing-circleci",
		),
		missingCodeRabbit: countReposWithReason(repos, "missing-coderabbit"),
		missingCodestyle: countReposWithReason(repos, "missing-codestyle"),
		staleCodestyle: countReposWithReason(repos, "stale-codestyle"),
		legacyGreptile: countReposWithReason(repos, "legacy-greptile-present"),
		dryRunMutatedRepository: countReposWithReason(
			repos,
			"dry-run-mutated-repository",
		),
		matrixCommandFailed: countReposWithReason(repos, "matrix-command-failed"),
		invalidMatrixJsonOutput: countReposWithReason(
			repos,
			"invalid-matrix-json-output",
		),
		matrixReportedErrors: countReposWithReason(repos, "matrix-reported-errors"),
	};
}

/**
 * Build human-readable top-level live-upgrade blocker messages from finding counts.
 *
 * @param findingCounts - Counts of categorized findings used to generate blocker messages
 * @returns An array of human-readable blocker strings; empty when no blockers are present
 */
function buildLiveUpgradeBlockers(
	findingCounts: FleetRemediationPlan["findingCounts"],
): string[] {
	const blockers: string[] = [];
	if (findingCounts.dryRunMutatedRepository > 0) {
		blockers.push(
			`${pluralize(findingCounts.dryRunMutatedRepository, "repo", "repos")} changed git status during dry-run`,
		);
	}
	if (findingCounts.matrixCommandFailed > 0) {
		blockers.push(
			`${pluralize(findingCounts.matrixCommandFailed, "repo", "repos")} failed the matrix command`,
		);
	}
	if (findingCounts.invalidMatrixJsonOutput > 0) {
		blockers.push(
			`${pluralize(findingCounts.invalidMatrixJsonOutput, "repo", "repos")} emitted invalid matrix JSON`,
		);
	}
	if (findingCounts.matrixReportedErrors > 0) {
		blockers.push(
			`${pluralize(findingCounts.matrixReportedErrors, "repo", "repos")} reported matrix errors`,
		);
	}
	if (findingCounts.notHarnessTracked > 0) {
		blockers.push(
			`${pluralize(findingCounts.notHarnessTracked, "repo", "repos")} ${repoVerb(findingCounts.notHarnessTracked, "needs", "need")} harness adoption before live upgrade`,
		);
	}
	if (findingCounts.missingCircleCi > 0) {
		blockers.push(
			`${pluralize(findingCounts.missingCircleCi, "repo", "repos")} ${repoVerb(findingCounts.missingCircleCi, "is", "are")} missing CircleCI governance surfaces`,
		);
	}
	if (findingCounts.missingCodeRabbit > 0) {
		blockers.push(
			`${pluralize(findingCounts.missingCodeRabbit, "repo", "repos")} ${repoVerb(findingCounts.missingCodeRabbit, "is", "are")} missing CodeRabbit review surfaces`,
		);
	}
	if (findingCounts.missingCodestyle > 0) {
		blockers.push(
			`${pluralize(findingCounts.missingCodestyle, "repo", "repos")} ${repoVerb(findingCounts.missingCodestyle, "is", "are")} missing CODESTYLE surfaces`,
		);
	}
	if (findingCounts.staleCodestyle > 0) {
		blockers.push(
			`${pluralize(findingCounts.staleCodestyle, "repo", "repos")} ${repoVerb(findingCounts.staleCodestyle, "has", "have")} CODESTYLE parity failures`,
		);
	}
	if (findingCounts.legacyGreptile > 0) {
		blockers.push(
			`${pluralize(findingCounts.legacyGreptile, "repo", "repos")} still ${repoVerb(findingCounts.legacyGreptile, "contains", "contain")} legacy Greptile artifacts`,
		);
	}
	return blockers;
}

/**
 * Builds a bounded list of agent-ready, read-only commands representing the first safe wave of remediation.
 *
 * Filters the provided per-repo recommendations by status priority and safety, selecting up to five commands total and enforcing per-status limits:
 * adoption (max 3), circleci migration (2), coderabbit setup (2), codestyle install (2), codestyle refresh (2), greptile cleanup (2).
 * Only repos with `safeToRun`, a non-null `nextCommand`, and a `nextCommandArgv` are included.
 *
 * @param repos - Array of per-repo recommendations from which to select the first safe wave
 * @returns An ordered array of `FleetPlanCommand` objects suitable for agents to run as the first safe wave
 */
function buildFirstSafeWave(repos: FleetPlanRepo[]): FleetPlanCommand[] {
	const wave: FleetPlanCommand[] = [];
	const statusOrder: Array<{ status: FleetPlanRepo["status"]; limit: number }> =
		[
			{ status: "needs-adoption", limit: 3 },
			{ status: "needs-circleci-migration", limit: 2 },
			{ status: "needs-coderabbit-setup", limit: 2 },
			{ status: "needs-codestyle-install", limit: 2 },
			{ status: "needs-codestyle-refresh", limit: 2 },
			{ status: "needs-greptile-cleanup", limit: 2 },
		];
	for (const { status, limit } of statusOrder) {
		let addedForStatus = 0;
		for (const repo of repos) {
			if (wave.length >= 5 || addedForStatus >= limit) {
				break;
			}
			if (
				repo.status !== status ||
				!repo.safeToRun ||
				!repo.nextCommandArgv ||
				repo.nextCommand === null
			) {
				continue;
			}
			wave.push({
				repo: repo.repo,
				status: repo.status,
				risk: repo.risk,
				nextCommand: repo.nextCommand,
				nextCommandArgv: repo.nextCommandArgv,
				nextAction: repo.nextAction,
			});
			addedForStatus += 1;
		}
	}
	return wave;
}

/** Build the first live-upgrade dry-run wave when every matrix repo is ready. */
function buildReadyUpgradeWave(repos: FleetPlanRepo[]): FleetPlanCommand[] {
	return repos
		.filter(
			(repo) =>
				repo.status === "ready" &&
				repo.safeToRun &&
				repo.nextCommandArgv &&
				repo.nextCommand !== null,
		)
		.slice(0, 5)
		.map((repo) => ({
			repo: repo.repo,
			status: repo.status,
			risk: repo.risk,
			nextCommand: repo.nextCommand as string,
			nextCommandArgv: repo.nextCommandArgv as string[],
			nextAction: repo.nextAction,
		}));
}

/**
 * Build a read-only remediation plan from a Harness upgrade matrix report.
 *
 * @param args.matrix - The parsed matrix report produced by the upgrade dry-run.
 * @param args.matrixArtifact - Path or identifier of the source matrix artifact (recorded in plan evidence).
 * @param args.generatedAt - Optional ISO timestamp to embed as the plan generation time; defaults to now.
 * @returns A complete FleetRemediationPlan describing per-repo recommendations, summary counts, live-upgrade blockers, the first safe command wave, and the selected next runnable action and command.
 */
export function buildFleetRemediationPlan(args: {
	matrix: MatrixReport;
	matrixArtifact: string;
	generatedAt?: string;
}): FleetRemediationPlan {
	const matrixResults = Array.isArray(args.matrix.results)
		? args.matrix.results
		: [];
	const rawResults = Array.isArray(args.matrix.results)
		? args.matrix.results.filter(
				(
					result,
				): result is MatrixReport["results"] extends (infer U)[] ? U : never =>
					typeof result === "object" && result !== null,
			)
		: [];
	const droppedResultCount = matrixResults.length - rawResults.length;
	const matrixArtifactBlockers = [
		...(args.matrix.pass === true
			? []
			: ["matrix artifact did not report pass: true"]),
		...(droppedResultCount > 0
			? [`${droppedResultCount} matrix rows were malformed`]
			: []),
	];
	const matrixArtifactValid = matrixArtifactBlockers.length === 0;
	const repos = rawResults.map((result) =>
		classifyRepo(
			result as import("./fleet-plan-types.js").MatrixRepoResult,
			args.matrixArtifact,
		),
	);
	const summary = buildSummary(repos);
	const findingCounts = buildFindingCounts(repos);
	const liveUpgradeBlockedBecause =
		rawResults.length === 0
			? [
					...matrixArtifactBlockers,
					"matrix artifact contained no repository results",
				]
			: [...matrixArtifactBlockers, ...buildLiveUpgradeBlockers(findingCounts)];
	// Avoid empty-artifact true positives: require repos.length > 0
	const liveUpgradeReady =
		matrixArtifactValid &&
		repos.length > 0 &&
		repos.every((repo) => repo.status === "ready");
	const firstSafeWave = matrixArtifactValid
		? liveUpgradeReady
			? buildReadyUpgradeWave(repos)
			: buildFirstSafeWave(repos)
		: [];
	// Derive nextRunnable from firstSafeWave to reflect wave priority
	const nextRunnable = firstSafeWave.length > 0 ? firstSafeWave[0] : undefined;
	return {
		schemaVersion: FLEET_PLAN_SCHEMA_VERSION,
		generatedAt: args.generatedAt ?? new Date().toISOString(),
		generatedFrom: args.matrixArtifact,
		liveUpgradeReady,
		safeToRun: liveUpgradeReady || nextRunnable !== undefined,
		nextAction: liveUpgradeReady
			? "Run upgrade dry-runs for ready repos before live update."
			: (nextRunnable?.nextAction ??
				"Inspect blocked matrix results before running remediation."),
		nextCommand: nextRunnable?.nextCommand ?? null,
		nextCommandArgv: nextRunnable?.nextCommandArgv ?? null,
		summary,
		findingCounts,
		liveUpgradeBlockedBecause,
		firstSafeWave,
		repos,
	};
}

/**
 * Parse CLI arguments for the fleet-plan command.
 *
 * Recognizes `--help`/`-h`, `--json`, and `--from <path>`. Validates that `--from` is followed by a non-flag value and returns a descriptive `error` when an unknown flag is encountered or `--from` is missing its path.
 *
 * @param argv - Array of command-line arguments (typically process.argv.slice(n))
 * @returns An object with:
 *  - `from` — the matrix artifact path when provided,
 *  - `json` — `true` when `--json` was present,
 *  - `help` — `true` when `--help` or `-h` was present,
 *  - `error` — an error message when arguments are invalid
 */
function parseArgs(argv: string[]): ParsedFleetPlanArgs {
	let from: string | undefined;
	let json = false;
	let help = false;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}
		if (arg === "--json") {
			json = true;
			continue;
		}
		if (arg === "--from") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				return { json, help, error: "--from requires a matrix artifact path" };
			}
			from = value;
			index += 1;
			continue;
		}
		return { json, help, error: `Unknown argument: ${arg}` };
	}
	return {
		...(from === undefined ? {} : { from }),
		json,
		help,
	};
}

/**
 * Print usage instructions and a brief description for the `harness fleet-plan` CLI.
 *
 * Outputs the expected flags (`--from <matrix.json>`, optional `--json`) and a one-line summary
 * of what the command does.
 */
function printUsage(): void {
	console.info("Usage: harness fleet-plan --from <matrix.json> [--json]");
	console.info("");
	console.info(
		"Build an agent-native, read-only remediation plan from a harness upgrade matrix artifact.",
	);
}

/**
 * Prints a human-readable summary of a fleet remediation plan to stdout.
 *
 * Renders overall plan metadata (source and live-upgrade readiness), aggregated status counts,
 * any live-upgrade blocker messages, the first safe wave of agent commands, and a per-repo
 * listing that includes the repo status, next action/command, and blocking reasons.
 *
 * @param plan - The remediation plan to render
 */
function printHuman(plan: FleetRemediationPlan): void {
	console.info(`Fleet remediation plan: ${plan.generatedFrom}`);
	console.info(`Live upgrade ready: ${plan.liveUpgradeReady ? "yes" : "no"}`);
	console.info(
		`Ready=${plan.summary.ready} adoption=${plan.summary.needsAdoption} circleci=${plan.summary.needsCircleCiMigration} coderabbit=${plan.summary.needsCodeRabbitSetup} codestyleInstall=${plan.summary.needsCodestyleInstall} codestyleRefresh=${plan.summary.needsCodestyleRefresh} greptile=${plan.summary.needsGreptileCleanup} blocked=${plan.summary.blocked}`,
	);
	if (plan.liveUpgradeBlockedBecause.length > 0) {
		console.info("");
		console.info("Live upgrade blockers:");
		for (const blocker of plan.liveUpgradeBlockedBecause) {
			console.info(`  - ${blocker}`);
		}
	}
	if (plan.firstSafeWave.length > 0) {
		console.info("");
		console.info("First safe wave:");
		for (const command of plan.firstSafeWave) {
			console.info(`  - ${command.nextCommand}`);
		}
	}
	console.info("");
	for (const repo of plan.repos) {
		console.info(`${repo.status}: ${repo.repo}`);
		console.info(`  next: ${repo.nextCommand ?? repo.nextAction}`);
		if (repo.blockingReasons.length > 0) {
			console.info(`  reasons: ${repo.blockingReasons.join(", ")}`);
		}
	}
}

/**
 * Entrypoint for the `harness fleet-plan` CLI.
 *
 * Parses CLI arguments, requires `--from <path>` to a matrix JSON artifact, builds a fleet remediation
 * plan from that artifact, and writes either the plan as JSON (when `--json` is provided) or a
 * human-readable summary to stdout.
 *
 * @param argv - The CLI arguments (typically `process.argv.slice(2)`)
 * @returns `0` on success, `1` if the matrix artifact could not be read or parsed, `2` for invalid or missing CLI arguments
 */
export function runFleetPlanCLI(argv: string[]): number {
	const parsed = parseArgs(argv);
	if (parsed.help) {
		printUsage();
		return 0;
	}
	if (parsed.error) {
		console.error(parsed.error);
		printUsage();
		return 2;
	}
	if (!parsed.from) {
		console.error("--from is required");
		printUsage();
		return 2;
	}

	let matrix: MatrixReport;
	try {
		matrix = JSON.parse(readFileSync(parsed.from, "utf8")) as MatrixReport;
	} catch (error) {
		console.error(
			`Failed to read matrix artifact: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}

	const plan = buildFleetRemediationPlan({
		matrix,
		matrixArtifact: parsed.from,
	});
	if (parsed.json) {
		console.info(JSON.stringify(plan, null, 2));
	} else {
		printHuman(plan);
	}
	return 0;
}
