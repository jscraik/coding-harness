import { dirname } from "node:path/posix";
import { fileExists } from "./repo-evidence.js";
import type { AgentReadinessMissingContextRef } from "./types.js";

/** Active-route refs resolved from the current active-artifacts route section. */
export interface ActiveRouteRefsAssessment {
	/** Existing route refs resolved from the active-artifacts route section. */
	evidenceRefs: string[];
	/** Human-readable reasons the active route is missing or stale. */
	staleReasons: string[];
	/** Source-attributed route refs that could not be resolved. */
	missingRefs: AgentReadinessMissingContextRef[];
}

/** Resolve and classify repo refs declared by the active-artifacts route section. */
export function assessActiveRouteRefs(input: {
	repoRoot: string;
	activeArtifactsText: string;
	activeArtifactsPath: string;
}): ActiveRouteRefsAssessment {
	const activeRouteText = sectionText(
		input.activeArtifactsText,
		"Current Active Route",
	);
	const declaredRefs = extractRepoRelativeBacktickPaths(activeRouteText);
	const evidenceRefs = resolveExistingActiveRouteRefs(
		input.repoRoot,
		declaredRefs,
	);
	const missingRefs = activeRouteMissingRefs(
		input.repoRoot,
		input.activeArtifactsPath,
		declaredRefs,
	);
	const staleReasons = activeRouteStaleReasons(
		activeRouteText,
		declaredRefs,
		missingRefs,
	);

	return { evidenceRefs, staleReasons, missingRefs };
}

function activeRouteStaleReasons(
	activeRouteText: string,
	activeRouteRefs: string[],
	missingActiveRouteRefs: AgentReadinessMissingContextRef[],
): string[] {
	const staleReasons =
		activeRouteRefs.length === 0
			? ["Current Active Route does not contain repo-relative artifact refs."]
			: missingActiveRouteRefs.map(
					(ref) =>
						`Active route ref \`${ref.ref}\` declared by ${ref.declaredBy} is missing.`,
				);
	if (
		activeRouteText.toLowerCase().includes("not the current execution route")
	) {
		staleReasons.push(
			"Current Active Route contains a row marked not the current execution route.",
		);
	}
	return staleReasons;
}

function activeRouteMissingRefs(
	repoRoot: string,
	activeArtifactsPath: string,
	activeRouteRefs: string[],
): AgentReadinessMissingContextRef[] {
	return activeRouteRefs
		.map((path) => ({
			ref: path,
			normalizedPath: resolveActiveRouteRef(repoRoot, activeRouteRefs, path),
		}))
		.filter((ref) => !fileExists(repoRoot, ref.normalizedPath))
		.map((ref) => ({
			ref: ref.ref,
			declaredBy: `${activeArtifactsPath}#Current Active Route`,
			normalizedPath: ref.normalizedPath,
			reason: "missing_ref" as const,
		}));
}

function resolveExistingActiveRouteRefs(
	repoRoot: string,
	activeRouteRefs: string[],
): string[] {
	return uniqueStrings(
		activeRouteRefs
			.map((path) => resolveActiveRouteRef(repoRoot, activeRouteRefs, path))
			.filter((path) => fileExists(repoRoot, path)),
	);
}

function resolveActiveRouteRef(
	repoRoot: string,
	activeRouteRefs: string[],
	path: string,
): string {
	const baseDirs = activeRouteBaseDirs(repoRoot, activeRouteRefs);
	for (const base of baseDirs) {
		if (path.startsWith(`${base}/`)) continue;
		const candidate = `${base}/${path}`;
		if (fileExists(repoRoot, candidate)) return candidate;
	}
	if (baseDirs.length > 0 && isShorthandRouteRef(path)) {
		return `${baseDirs[0]}/${path}`;
	}
	if (fileExists(repoRoot, path)) return path;
	return path;
}

function isShorthandRouteRef(path: string): boolean {
	return !path.includes("/");
}

function activeRouteBaseDirs(
	repoRoot: string,
	activeRouteRefs: string[],
): string[] {
	return activeRouteRefs
		.filter((path) => path.endsWith("/current-route.json"))
		.filter((path) => fileExists(repoRoot, path))
		.map((path) => dirname(path));
}

function sectionText(markdown: string, heading: string): string {
	const lines = markdown.split(/\r?\n/);
	const start = lines.findIndex(
		(line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`,
	);
	if (start === -1) return "";
	const nextHeading = lines.findIndex(
		(line, index) => index > start && /^##\s+/.test(line.trim()),
	);
	return lines
		.slice(start + 1, nextHeading === -1 ? undefined : nextHeading)
		.join("\n");
}

function extractRepoRelativeBacktickPaths(markdown: string): string[] {
	const paths: string[] = [];
	const pathPattern = /\x60([^\x60]+)\x60/g;
	let match = pathPattern.exec(markdown);
	while (match !== null) {
		const token = match[1]?.trim() ?? "";
		const repoPath = normalizeRepoRelativePathToken(token);
		if (repoPath !== undefined) {
			paths.push(repoPath);
		}
		match = pathPattern.exec(markdown);
	}
	return uniqueStrings(paths);
}

function normalizeRepoRelativePathToken(token: string): string | undefined {
	const value = token.trim();
	if (value.length === 0) return undefined;
	if (value.startsWith("/") || value.startsWith("~")) return undefined;
	if (value.includes("://") || value.includes("\\")) return undefined;
	if (/[;&|$<>]/.test(value)) return undefined;

	const normalized = value.startsWith("./") ? value.slice(2) : value;
	if (normalized.length === 0 || normalized === ".") return undefined;
	if (normalized.split("/").includes("..")) return undefined;
	if (!normalized.includes("/") && !/\.[a-z0-9]+$/i.test(normalized)) {
		return undefined;
	}
	return normalized;
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values)];
}
