import { classifyRepo } from "./fleet-plan-repo.js";
import {
	countReposWithReason,
	pluralize,
	repoVerb,
	type FleetPlanCommand,
	type FleetPlanRepo,
	type FleetRemediationPlan,
	type MatrixReport,
	type MatrixRepoResult,
	FLEET_PLAN_SCHEMA_VERSION,
} from "./fleet-plan-types.js";

type FindingCounts = FleetRemediationPlan["findingCounts"];

type LiveUpgradeBlockerRule = {
	count: (findingCounts: FindingCounts) => number;
	message: (count: number) => string;
};

const LIVE_UPGRADE_BLOCKER_RULES: LiveUpgradeBlockerRule[] = [
	{
		count: (findingCounts) => findingCounts.dryRunMutatedRepository,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} changed git status during dry-run`,
	},
	{
		count: (findingCounts) => findingCounts.matrixCommandFailed,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} failed the matrix command`,
	},
	{
		count: (findingCounts) => findingCounts.invalidMatrixJsonOutput,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} emitted invalid matrix JSON`,
	},
	{
		count: (findingCounts) => findingCounts.matrixReportedErrors,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} reported matrix errors`,
	},
	{
		count: (findingCounts) => findingCounts.notHarnessTracked,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} ${repoVerb(count, "needs", "need")} harness adoption before live upgrade`,
	},
	{
		count: (findingCounts) => findingCounts.missingCircleCi,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} ${repoVerb(count, "is", "are")} missing CircleCI governance surfaces`,
	},
	{
		count: (findingCounts) => findingCounts.missingCodeRabbit,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} ${repoVerb(count, "is", "are")} missing CodeRabbit review surfaces`,
	},
	{
		count: (findingCounts) => findingCounts.missingCodestyle,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} ${repoVerb(count, "is", "are")} missing CODESTYLE surfaces`,
	},
	{
		count: (findingCounts) => findingCounts.staleCodestyle,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} ${repoVerb(count, "has", "have")} CODESTYLE parity failures`,
	},
	{
		count: (findingCounts) => findingCounts.legacyGreptile,
		message: (count) =>
			`${pluralize(count, "repo", "repos")} still ${repoVerb(count, "contains", "contain")} legacy Greptile artifacts`,
	},
];

export {
	FLEET_PLAN_SCHEMA_VERSION,
	type FleetPlanCommand,
	type FleetPlanRepo,
	type FleetRemediationPlan,
} from "./fleet-plan-types.js";
export { runFleetPlanCLI } from "./fleet-plan-cli.js";

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
	return LIVE_UPGRADE_BLOCKER_RULES.flatMap((rule) => {
		const count = rule.count(findingCounts);
		return count > 0 ? [rule.message(count)] : [];
	});
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

function rawMatrixResults(matrix: MatrixReport): MatrixRepoResult[] {
	if (!Array.isArray(matrix.results)) {
		return [];
	}
	return matrix.results.filter(
		(result): result is MatrixRepoResult =>
			typeof result === "object" && result !== null,
	);
}

function matrixArtifactBlockers(
	matrix: MatrixReport,
	droppedResultCount: number,
): string[] {
	return [
		...(matrix.pass === true
			? []
			: ["matrix artifact did not report pass: true"]),
		...(droppedResultCount > 0
			? [`${droppedResultCount} matrix rows were malformed`]
			: []),
	];
}

function classifyMatrixRepos(
	results: MatrixRepoResult[],
	matrixArtifact: string,
): FleetPlanRepo[] {
	return results.map((result) => classifyRepo(result, matrixArtifact));
}

function liveUpgradeBlockers(
	results: MatrixRepoResult[],
	artifactBlockers: string[],
	findingCounts: FindingCounts,
): string[] {
	if (results.length === 0) {
		return [
			...artifactBlockers,
			"matrix artifact contained no repository results",
		];
	}
	return [...artifactBlockers, ...buildLiveUpgradeBlockers(findingCounts)];
}

function isLiveUpgradeReady(
	matrixArtifactValid: boolean,
	repos: FleetPlanRepo[],
): boolean {
	return (
		matrixArtifactValid &&
		repos.length > 0 &&
		repos.every((repo) => repo.status === "ready")
	);
}

function firstWaveFor(
	matrixArtifactValid: boolean,
	liveUpgradeReady: boolean,
	repos: FleetPlanRepo[],
): FleetPlanCommand[] {
	if (!matrixArtifactValid) {
		return [];
	}
	return liveUpgradeReady
		? buildReadyUpgradeWave(repos)
		: buildFirstSafeWave(repos);
}

function planNextAction(
	liveUpgradeReady: boolean,
	nextRunnable: FleetPlanCommand | undefined,
): string {
	if (liveUpgradeReady) {
		return "Run upgrade dry-runs for ready repos before live update.";
	}
	return (
		nextRunnable?.nextAction ??
		"Inspect blocked matrix results before running remediation."
	);
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
	const rawResults = rawMatrixResults(args.matrix);
	const droppedResultCount = matrixResults.length - rawResults.length;
	const artifactBlockers = matrixArtifactBlockers(
		args.matrix,
		droppedResultCount,
	);
	const matrixArtifactValid = artifactBlockers.length === 0;
	const repos = classifyMatrixRepos(rawResults, args.matrixArtifact);
	const summary = buildSummary(repos);
	const findingCounts = buildFindingCounts(repos);
	const liveUpgradeBlockedBecause = liveUpgradeBlockers(
		rawResults,
		artifactBlockers,
		findingCounts,
	);
	const liveUpgradeReady = isLiveUpgradeReady(matrixArtifactValid, repos);
	const firstSafeWave = firstWaveFor(
		matrixArtifactValid,
		liveUpgradeReady,
		repos,
	);
	const nextRunnable = firstSafeWave.length > 0 ? firstSafeWave[0] : undefined;
	return {
		schemaVersion: FLEET_PLAN_SCHEMA_VERSION,
		generatedAt: args.generatedAt ?? new Date().toISOString(),
		generatedFrom: args.matrixArtifact,
		liveUpgradeReady,
		safeToRun: liveUpgradeReady || nextRunnable !== undefined,
		nextAction: planNextAction(liveUpgradeReady, nextRunnable),
		nextCommand: nextRunnable?.nextCommand ?? null,
		nextCommandArgv: nextRunnable?.nextCommandArgv ?? null,
		summary,
		findingCounts,
		liveUpgradeBlockedBecause,
		firstSafeWave,
		repos,
	};
}
