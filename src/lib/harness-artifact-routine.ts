import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
	containsGlobToken,
	extractBacktickPaths,
	formatLocalDate,
	isBlank,
	isPathInsideRepo,
	normalizeRepoPath,
	parseFrontMatter,
	resolvedPathStaysInsideRepo,
	section,
	validateHistoricalRows,
} from "./harness-artifact-routine-utils.js";

export const ARTIFACT_HANDLING_ROUTINE_SCHEMA_VERSION =
	"artifact-handling-routine/v1";

/** Checks performed by the route-driving artifact routine gate. */
export type ArtifactHandlingCheck =
	| "active_index"
	| "closeout_refresh"
	| "linear_owner"
	| "reference_integrity"
	| "runtime_boundary"
	| "stale_frontmatter_guard"
	| "tracked_state";

/** Machine-readable finding emitted when an artifact routine check fails. */
export interface ArtifactHandlingFinding {
	check: ArtifactHandlingCheck;
	code: string;
	message: string;
	path?: string;
}

/** Complete artifact routine validation result for CLI and automation consumers. */
export interface ArtifactHandlingRoutineResult {
	checks: Record<ArtifactHandlingCheck, "fail" | "not_run" | "pass">;
	findings: ArtifactHandlingFinding[];
	referencedArtifacts: string[];
	repoRoot: string;
	schemaVersion: typeof ARTIFACT_HANDLING_ROUTINE_SCHEMA_VERSION;
	status: "pass" | "fail";
}

/** Inputs used to run the artifact routine against a repository. */
export interface ArtifactHandlingRoutineOptions {
	activeIndexPath?: string;
	repoRoot?: string;
	today?: string;
}

/** Flat front-matter fields parsed from a markdown artifact. */
export interface FrontMatter {
	fields: Record<string, string>;
}

const CHECKS: ArtifactHandlingCheck[] = [
	"active_index",
	"closeout_refresh",
	"linear_owner",
	"reference_integrity",
	"runtime_boundary",
	"stale_frontmatter_guard",
	"tracked_state",
];

/**
 * Constructs an ArtifactHandlingRoutineResult from validation findings and check execution state.
 *
 * Per-check statuses are `"fail"` for checks present in `checkFailures`, `"pass"` for checks in `executedChecks` that did not fail, and `"not_run"` otherwise. `schemaVersion` is set to `ARTIFACT_HANDLING_ROUTINE_SCHEMA_VERSION`.
 *
 * @param repoRoot - Repository root path to include in the result
 * @param referencedArtifacts - Repository-relative paths referenced by the active route
 * @param findings - Collected findings emitted during validation
 * @param checkFailures - Set of checks that failed; any check in this set will be marked `"fail"`
 * @param executedChecks - Set of checks that were executed; executed checks not in `checkFailures` will be marked `"pass"` (defaults to all checks in `CHECKS`)
 * @returns An ArtifactHandlingRoutineResult containing per-check statuses, the provided findings and referenced artifacts, the `repoRoot`, `schemaVersion`, and overall `status` (`"pass"` if `findings` is empty, otherwise `"fail"`)
 */
function buildResult(
	repoRoot: string,
	referencedArtifacts: string[],
	findings: ArtifactHandlingFinding[],
	checkFailures: Set<ArtifactHandlingCheck>,
	executedChecks: Set<ArtifactHandlingCheck> = new Set(CHECKS),
): ArtifactHandlingRoutineResult {
	return {
		checks: Object.fromEntries(
			CHECKS.map((check) => [
				check,
				checkFailures.has(check)
					? "fail"
					: executedChecks.has(check)
						? "pass"
						: "not_run",
			]),
		) as Record<ArtifactHandlingCheck, "fail" | "not_run" | "pass">,
		findings,
		referencedArtifacts,
		repoRoot,
		schemaVersion: ARTIFACT_HANDLING_ROUTINE_SCHEMA_VERSION,
		status: findings.length === 0 ? "pass" : "fail",
	};
}

/**
 * Validate route-driving .harness artifacts before they are used as execution input.
 *
 * The routine intentionally stays local and read-only: it proves the active
 * index exists, active artifact references resolve inside the repository,
 * active specs/plans name a Linear owner or local-only exception, runtime
 * artifacts are not route-driving inputs, and historical rows are classified by
 * the active index instead of stale front matter.
 */
export function validateHarnessArtifactRoutine(
	options: ArtifactHandlingRoutineOptions = {},
): ArtifactHandlingRoutineResult {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const activeIndexPath = normalizeRepoPath(
		repoRoot,
		options.activeIndexPath ?? ".harness/active-artifacts.md",
	);
	const findings: ArtifactHandlingFinding[] = [];
	const checkFailures = new Set<ArtifactHandlingCheck>();

	const fail = (finding: ArtifactHandlingFinding): void => {
		findings.push(finding);
		checkFailures.add(finding.check);
	};

	if (!isPathInsideRepo(activeIndexPath)) {
		fail({
			check: "active_index",
			code: "active_index_outside_repo",
			message: `Active artifact index must stay inside repo root: ${activeIndexPath}`,
			path: activeIndexPath,
		});
		return buildResult(
			repoRoot,
			[],
			findings,
			checkFailures,
			new Set(["active_index"]),
		);
	}

	const absoluteIndexPath = resolve(repoRoot, activeIndexPath);
	if (!existsSync(absoluteIndexPath)) {
		fail({
			check: "active_index",
			code: "active_index_missing",
			message: `Active artifact index is missing: ${activeIndexPath}`,
			path: activeIndexPath,
		});
		return buildResult(
			repoRoot,
			[],
			findings,
			checkFailures,
			new Set(["active_index"]),
		);
	}
	if (!statSync(absoluteIndexPath).isFile()) {
		fail({
			check: "active_index",
			code: "active_index_not_file",
			message: `Active artifact index must be a file: ${activeIndexPath}`,
			path: activeIndexPath,
		});
		return buildResult(
			repoRoot,
			[],
			findings,
			checkFailures,
			new Set(["active_index"]),
		);
	}

	const indexText = readFileSync(absoluteIndexPath, "utf8");
	const activeRouteText = section(indexText, "Current Active Route");
	const artifactIndexText = section(indexText, "Artifact Index");
	const activeArtifacts = extractBacktickPaths(activeRouteText);
	const today = options.today ?? formatLocalDate(new Date());
	const reconciledDate = indexText.match(
		/Last reconciled:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/,
	)?.[1];

	if (activeArtifacts.length === 0) {
		fail({
			check: "tracked_state",
			code: "no_active_artifacts",
			message:
				"Current Active Route must list at least one canonical artifact path.",
			path: activeIndexPath,
		});
	}

	if (reconciledDate !== today) {
		fail({
			check: "closeout_refresh",
			code: "active_index_stale",
			message:
				"Active artifact index must be reconciled today (" +
				today +
				"); found " +
				(reconciledDate ?? "missing") +
				".",
			path: activeIndexPath,
		});
	}

	validateActiveArtifacts(repoRoot, activeArtifacts, fail);

	validateHistoricalRows(activeIndexPath, artifactIndexText, fail);

	return buildResult(repoRoot, activeArtifacts, findings, checkFailures);
}

/**
 * Validates each artifact path from the active route for repo containment, existence, runtime-vs-route boundary violations, and ownership/metadata checks for `.harness/plan` and `.harness/specs` artifacts.
 *
 * @param repoRoot - Absolute filesystem path to the repository root used to resolve and normalize artifact paths
 * @param activeArtifacts - Array of repo-relative artifact paths extracted from the active route
 * @param fail - Callback invoked with an `ArtifactHandlingFinding` when a validation rule fails
 */
function validateActiveArtifacts(
	repoRoot: string,
	activeArtifacts: string[],
	fail: (finding: ArtifactHandlingFinding) => void,
): void {
	for (const rawArtifactPath of activeArtifacts) {
		const artifactPath = normalizeRepoPath(repoRoot, rawArtifactPath);
		const absoluteArtifactPath = resolve(repoRoot, artifactPath);
		const canonicalPath = artifactPath;
		if (!isPathInsideRepo(artifactPath)) {
			fail({
				check: "reference_integrity",
				code: "artifact_path_outside_repo",
				message:
					"Route-driving artifact path must stay inside repo root: " +
					rawArtifactPath,
				path: rawArtifactPath,
			});
			continue;
		}
		if (canonicalPath.startsWith("artifacts/")) {
			fail({
				check: "runtime_boundary",
				code: "runtime_artifact_is_route_driving",
				message: `Runtime output must not be a route-driving artifact: ${artifactPath}`,
				path: artifactPath,
			});
		}
		if (!existsSync(absoluteArtifactPath)) {
			fail({
				check: "reference_integrity",
				code: "artifact_missing",
				message: `Route-driving artifact is missing: ${artifactPath}`,
				path: artifactPath,
			});
			continue;
		}
		if (!resolvedPathStaysInsideRepo(repoRoot, absoluteArtifactPath)) {
			fail({
				check: "reference_integrity",
				code: "artifact_path_resolves_outside_repo",
				message: `Route-driving artifact must resolve inside repo root: ${artifactPath}`,
				path: artifactPath,
			});
			continue;
		}
		if (!statSync(absoluteArtifactPath).isFile()) {
			fail({
				check: "reference_integrity",
				code: "artifact_not_file",
				message: `Route-driving artifact must be a file: ${artifactPath}`,
				path: artifactPath,
			});
			continue;
		}
		if (/^\.harness\/(plan|specs)\//.test(canonicalPath)) {
			validatePlanOrSpecOwnership(
				repoRoot,
				artifactPath,
				readFileSync(absoluteArtifactPath, "utf8"),
				fail,
			);
		}
	}
}

/**
 * Validate front-matter ownership requirements and referenced repo paths for a `.harness/plan/*` or `.harness/specs/*` artifact, emitting findings via `fail`.
 *
 * Performs these checks:
 * - Ensures `linear_issue` is present unless `linear_status` is `"local_only"`, and ensures `owner` is present when `linear_status` is `"local_only"`.
 * - Collects referenced paths from front matter (`source_spec`) and backtick-quoted paths (limited to `.harness/*` and `docs/*`, excluding globbed entries), then ensures each referenced path is inside the repository and exists on disk.
 *
 * @param repoRoot - Absolute filesystem path to the repository root used to normalize and resolve referenced paths.
 * @param artifactPath - Repo-relative path to the artifact being validated (used in emitted findings).
 * @param text - Full file contents of the artifact.
 * @param fail - Callback to record an `ArtifactHandlingFinding` when a validation rule fails.
 */
function validatePlanOrSpecOwnership(
	repoRoot: string,
	artifactPath: string,
	text: string,
	fail: (finding: ArtifactHandlingFinding) => void,
): void {
	const frontMatter = parseFrontMatter(text);
	const linearIssue = frontMatter.fields.linear_issue;
	const localStatus = frontMatter.fields.linear_status;
	if (isBlank(linearIssue) && localStatus !== "local_only") {
		fail({
			check: "linear_owner",
			code: "linear_owner_missing",
			message: `Active artifact must name linear_issue or linear_status: local_only: ${artifactPath}`,
			path: artifactPath,
		});
	}
	if (localStatus === "local_only" && isBlank(frontMatter.fields.owner)) {
		fail({
			check: "linear_owner",
			code: "local_only_owner_missing",
			message: `Local-only active artifact must name an owner: ${artifactPath}`,
			path: artifactPath,
		});
	}

	const referencedPaths = [
		frontMatter.fields.source_spec,
		...extractBacktickPaths(text).filter(
			(path) => /^(\.harness|docs)\//.test(path) && !containsGlobToken(path),
		),
	].filter((path): path is string => path !== undefined && !isBlank(path));

	for (const referencedPath of referencedPaths) {
		const normalizedPath = normalizeRepoPath(repoRoot, referencedPath);
		const absoluteReferencedPath = resolve(repoRoot, normalizedPath);
		if (!isPathInsideRepo(normalizedPath)) {
			fail({
				check: "reference_integrity",
				code: "referenced_path_outside_repo",
				message: `Referenced path must stay inside repo root: ${referencedPath}`,
				path: artifactPath,
			});
			continue;
		}
		if (!existsSync(absoluteReferencedPath)) {
			fail({
				check: "reference_integrity",
				code: "referenced_path_missing",
				message: `Referenced path is missing: ${referencedPath}`,
				path: artifactPath,
			});
			continue;
		}
		if (!resolvedPathStaysInsideRepo(repoRoot, absoluteReferencedPath)) {
			fail({
				check: "reference_integrity",
				code: "referenced_path_resolves_outside_repo",
				message: `Referenced path must resolve inside repo root: ${referencedPath}`,
				path: artifactPath,
			});
			continue;
		}
		if (!statSync(absoluteReferencedPath).isFile()) {
			fail({
				check: "reference_integrity",
				code: "referenced_path_not_file",
				message: `Referenced path must be a file: ${referencedPath}`,
				path: artifactPath,
			});
		}
	}
}
