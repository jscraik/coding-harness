import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

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

interface FrontMatter {
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

/**
 * Validate the "Artifact Index" markdown table for a "Local Status" column and report rows that use draft/unknown/maybe.
 *
 * @param activeIndexPath - Repository-relative path to the active index file (used as the finding `path`)
 * @param artifactIndexText - The markdown text of the "Artifact Index" section
 * @param fail - Callback to record an ArtifactHandlingFinding when the Local Status column is missing or a row is unclassified
 */
function validateHistoricalRows(
	activeIndexPath: string,
	artifactIndexText: string,
	fail: (finding: ArtifactHandlingFinding) => void,
): void {
	const rows = artifactIndexText
		.split(/\r?\n/)
		.filter((line) => line.startsWith("|") && !line.includes("---"));
	const header = rows[0];
	if (header === undefined) {
		fail({
			check: "stale_frontmatter_guard",
			code: "artifact_index_missing",
			message:
				"Active artifact index must include an Artifact Index table for stale artifact classification.",
			path: activeIndexPath,
		});
		return;
	}
	const headerCells = parseMarkdownTableCells(header);
	const localStatusIndex = headerCells.findIndex(
		(cell) => cell.toLowerCase() === "local status",
	);
	if (localStatusIndex < 0) {
		fail({
			check: "stale_frontmatter_guard",
			code: "artifact_status_column_missing",
			message:
				"Artifact Index table must include a Local Status column for stale artifact classification.",
			path: activeIndexPath,
		});
		return;
	}
	for (const row of rows.slice(1)) {
		const cells = parseMarkdownTableCells(row);
		const localStatus = cells[localStatusIndex]?.toLowerCase() ?? "";
		if (
			localStatus.includes("draft") ||
			localStatus.includes("unknown") ||
			localStatus.includes("maybe")
		) {
			fail({
				check: "stale_frontmatter_guard",
				code: "artifact_status_unclassified",
				message:
					"Artifact Index rows must classify route-driving status instead of leaving draft/unknown/maybe state.",
				path: activeIndexPath,
			});
		}
	}
}

/**
 * Split a markdown table row into its constituent cells and trim surrounding whitespace.
 *
 * @param row - A markdown table row string (for example, `"| col1 | col2 |"`)
 * @returns The trimmed cell values in order
 */
function parseMarkdownTableCells(row: string): string[] {
	return row
		.split("|")
		.slice(1, -1)
		.map((cell) => cell.trim());
}

/**
 * Builds the final ArtifactHandlingRoutineResult summarizing check outcomes, findings, and referenced artifacts.
 *
 * @param repoRoot - The repository root path used to normalize referenced artifact paths
 * @param referencedArtifacts - The list of repo-relative artifact paths referenced by the active index
 * @param findings - Collected findings produced during validation
 * @param checkFailures - Set of checks that failed during validation
 * @param executedChecks - Set of checks that were executed; checks not in this set are reported as `not_run` (defaults to all checks)
 * @returns The assembled ArtifactHandlingRoutineResult containing:
 *  - `checks`: a mapping of each check to `"pass" | "fail" | "not_run"`,
 *  - `findings`: the provided findings,
 *  - `referencedArtifacts`: the provided artifact paths,
 *  - `repoRoot` and `schemaVersion`,
 *  - `status`: `"pass"` when there are no findings, otherwise `"fail"`.
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
 * Extracts top-of-file YAML-like front matter into a flat fields map.
 *
 * Parses the first `--- ... ---` block at the start of `text` and returns its
 * key/value pairs as plain strings. Only lines matching `key: value` are
 * captured; surrounding single or double quotes around values are removed.
 *
 * @returns An object with a `fields` map where each front-matter key maps to its unquoted string value. Missing or non-matching lines are omitted from the map.
 */
function parseFrontMatter(text: string): FrontMatter {
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	const raw = match?.[1] ?? "";
	const fields: Record<string, string> = {};
	for (const line of raw.split(/\r?\n/)) {
		const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
		if (!fieldMatch) continue;
		const [, key, value] = fieldMatch;
		if (key === undefined || value === undefined) continue;
		fields[key] = value.replace(/^['"]|['"]$/g, "");
	}
	return { fields };
}

/**
 * Extracts the content under the markdown "## <heading>" section.
 *
 * @param text - The full markdown text to search.
 * @param heading - The section heading text (without leading `## `).
 * @returns The lines between the matching `## <heading>` and the next `## ` heading joined by newlines, or an empty string if the heading is not present.
 */
function section(text: string, heading: string): string {
	const lines = text.split("\n");
	const headingLine = `## ${heading}`;
	const start = lines.findIndex((line) => line.trim() === headingLine);
	if (start < 0) return "";
	const nextHeading = lines.findIndex(
		(line, index) => index > start && line.startsWith("## "),
	);
	return lines
		.slice(start + 1, nextHeading === -1 ? undefined : nextHeading)
		.join("\n");
}

/**
 * Extract backtick-quoted paths from `text` and keep only likely repo-relative locations.
 *
 * @param text - The input content to scan for backtick-quoted paths
 * @returns An array of extracted paths that start with `.harness/`, `docs/`, `src/`, `scripts/`, `e2e/`, or `artifacts/`
 */
function extractBacktickPaths(text: string): string[] {
	return Array.from(text.matchAll(/`([^`]+)`/g))
		.map((match) => match[1])
		.filter((value): value is string => value !== undefined)
		.filter((value) =>
			/^(\.harness|docs|src|scripts|e2e|artifacts)\//.test(value),
		);
}

/**
 * Determines whether a path pattern contains glob tokens.
 *
 * @param path - The path or pattern to inspect
 * @returns `true` if `path` contains any of the glob tokens `*`, `?`, or `[`, `false` otherwise.
 */
function containsGlobToken(path: string): boolean {
	return path.includes("*") || path.includes("?") || path.includes("[");
}

/**
 * Converts an input path into a normalized repo-relative POSIX-style path.
 *
 * @param repoRoot - The repository root directory used as the base for resolution.
 * @param path - The input path to normalize; may be absolute or relative.
 * @returns The repo-relative path with forward slashes (`/`); may be an empty string when the input resolves to `repoRoot`.
 */
function normalizeRepoPath(repoRoot: string, path: string): string {
	const absolute = resolve(repoRoot, path);
	return relative(repoRoot, absolute)
		.split(/[/\\]+/)
		.join("/");
}

/**
 * Determines if a repo-relative path refers to a location inside the repository.
 *
 * @param repoRelativePath - Path expressed relative to the repository root
 * @returns `true` if the path is non-empty, does not start with `..`, and is not absolute; `false` otherwise.
 */
function isPathInsideRepo(repoRelativePath: string): boolean {
	return (
		repoRelativePath.length > 0 &&
		!repoRelativePath.startsWith("..") &&
		!isAbsolute(repoRelativePath)
	);
}

/**
 * Determine whether a string value should be treated as blank for validation.
 *
 * @param value - The string to test; may be `undefined`
 * @returns `true` if `value` is `undefined`, an empty string, contains only whitespace, or is exactly `"n.a."`, `false` otherwise
 */
function isBlank(value: string | undefined): boolean {
	return value === undefined || value.trim().length === 0 || value === "n.a.";
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
