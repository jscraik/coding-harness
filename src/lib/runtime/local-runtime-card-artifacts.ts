import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeError } from "../input/sanitize.js";
import { detectIssueKey, issueKeysMatch } from "./issue-key.js";
import type {
	RuntimeCardArtifactState,
	RuntimeCardSource,
} from "./runtime-card.js";

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const MARKDOWN_CODE_MARKER = String.fromCharCode(96);

/** Collapsed active-artifact index evidence for runtime-card generation. */
export interface RuntimeCardArtifactSnapshot {
	/** Issue key derived from caller input or the active artifact row. */
	issueKey: string | null;
	/** Spec and plan freshness state derived from the active artifact index. */
	artifacts: RuntimeCardArtifactState;
	/** Source record describing how the active artifact index was inspected. */
	source: RuntimeCardSource;
	/** Artifact blockers that should prevent continuation. */
	blockers: string[];
}

function hasCodePath(line: string, path: string): boolean {
	return line.includes(MARKDOWN_CODE_MARKER + path);
}

function extractCodePath(line: string, prefix: string): string | null {
	const expression = new RegExp(
		`${MARKDOWN_CODE_MARKER}([^${MARKDOWN_CODE_MARKER}]+)${MARKDOWN_CODE_MARKER}`,
		"gu",
	);
	const matches = line.matchAll(expression);
	for (const match of matches) {
		const path = match[1];
		if (path?.startsWith(prefix)) return path;
	}
	return null;
}

function extractRowIssueKey(line: string): string | null {
	const cells = line.split("|").map((cell) => cell.trim());
	return cells[1] ?? null;
}

function findArtifactLine(
	activeArtifacts: string,
	issueKey: string | null,
): string | null {
	const lines = activeArtifacts.split(/\r?\n/u);
	if (issueKey) {
		const issueLine = lines.find(
			(line) =>
				issueKeysMatch(extractRowIssueKey(line), issueKey) &&
				line.includes(`${MARKDOWN_CODE_MARKER}.harness/`),
		);
		if (issueLine) return issueLine;
	}
	return (
		lines.find(
			(line) =>
				hasCodePath(line, ".harness/specs/") &&
				hasCodePath(line, ".harness/plan/"),
		) ?? null
	);
}

function emptyArtifactSnapshot(
	issueKey: string | null,
	status: "missing" | "unknown",
	sourceStatus: RuntimeCardSource["status"],
	failureClass: string,
	blockers: string[] = [],
): RuntimeCardArtifactSnapshot {
	return {
		issueKey,
		artifacts: { activeSpec: null, activePlan: null, status, staleRefs: [] },
		source: {
			kind: "artifact",
			ref: `path:${ACTIVE_ARTIFACTS_PATH}`,
			freshness: status,
			status: sourceStatus,
			failureClass,
		},
		blockers,
	};
}

/** Inspect the active artifact index and collapse spec/plan freshness for runtime-card generation. */
export function inspectRuntimeCardArtifacts(
	repoRoot: string,
	issueKey: string | null,
): RuntimeCardArtifactSnapshot {
	const activePath = join(repoRoot, ACTIVE_ARTIFACTS_PATH);
	if (!existsSync(activePath)) {
		return emptyArtifactSnapshot(
			issueKey,
			"missing",
			"empty",
			"active_artifacts_missing",
		);
	}

	let activeArtifacts: string;
	try {
		activeArtifacts = readFileSync(activePath, "utf8");
	} catch (error) {
		return emptyArtifactSnapshot(
			issueKey,
			"unknown",
			"blocked",
			`active_artifacts_unreadable:${sanitizeError(error)}`,
			["Active artifact index could not be read."],
		);
	}

	const line = findArtifactLine(activeArtifacts, issueKey);
	const activeSpec = line ? extractCodePath(line, ".harness/specs/") : null;
	const activePlan = line ? extractCodePath(line, ".harness/plan/") : null;
	const derivedIssueKey = detectIssueKey(
		extractRowIssueKey(line ?? ""),
		issueKey,
	);
	const staleRefs = [activeSpec, activePlan].filter(
		(path): path is string =>
			path !== null && !existsSync(join(repoRoot, path)),
	);
	const status =
		activeSpec === null && activePlan === null
			? "unknown"
			: staleRefs.length > 0
				? "stale"
				: "current";
	return {
		issueKey: derivedIssueKey,
		artifacts: {
			activeSpec,
			activePlan,
			status,
			staleRefs,
		},
		source: {
			kind: "artifact",
			ref: `path:${ACTIVE_ARTIFACTS_PATH}`,
			freshness: status === "current" ? "current" : "unknown",
			status: status === "current" ? "usable" : "invalid",
			failureClass: status === "current" ? null : "active_artifacts_unresolved",
		},
		blockers:
			status === "stale"
				? ["Active spec or plan references are stale or missing on disk."]
				: [],
	};
}
