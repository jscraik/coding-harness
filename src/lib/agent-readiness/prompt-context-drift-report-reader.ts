import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	openSync as openReportNoFollow,
	readSync,
	realpathSync,
} from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { PROMPT_CONTEXT_DRIFT_REPORT_PATHS } from "../prompt-context-drift/index.js";

const MAX_REPORT_BYTES = 1_000_000;
const REPORT_OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW;

type KnownPromptContextDriftReport = {
	segments: readonly string[];
};

const KNOWN_REPORT_PATHS = new Map<string, KnownPromptContextDriftReport>([
	[
		"artifacts/context-integrity/prompt-context-drift-report.json",
		{
			segments: [
				"artifacts",
				"context-integrity",
				"prompt-context-drift-report.json",
			],
		},
	],
	[
		"artifacts/prompt-context-drift-report.json",
		{
			segments: ["artifacts", "prompt-context-drift-report.json"],
		},
	],
	[
		".harness/runtime/prompt-context-drift-report.json",
		{
			segments: [".harness", "runtime", "prompt-context-drift-report.json"],
		},
	],
]);

type ContainedPromptContextDriftReport = {
	realPath: string;
};

/** Return discovered prompt-context drift report paths that pass repo containment checks. */
export function promptContextDriftReportEvidence(repoRoot: string): string[] {
	return PROMPT_CONTEXT_DRIFT_REPORT_PATHS.filter(
		(reportPath) => safeReportPath(repoRoot, reportPath) !== null,
	);
}

/** Read a canonical prompt-context drift report through a bounded no-follow descriptor. */
export function readPromptContextDriftReport(
	repoRoot: string,
	reportPath: string,
): string {
	const file = containedReportFile(repoRoot, reportPath);
	return file === null ? "" : readValidatedReportFile(file);
}

function containedReportFile(
	repoRoot: string,
	reportPath: string,
): ContainedPromptContextDriftReport | null {
	try {
		const realRepoRoot = realpathSync(repoRoot);
		const absolutePath = knownReportAbsolutePath(realRepoRoot, reportPath);
		if (absolutePath === null || escapesRepoRoot(realRepoRoot, absolutePath)) {
			return null;
		}
		const stat = lstatSync(absolutePath);
		if (!isReadableReportFile(stat)) return null;
		const realPath = realpathSync(absolutePath);
		if (escapesRepoRoot(realRepoRoot, realPath)) return null;
		const report = knownReport(reportPath);
		if (report === null) return null;
		return {
			realPath,
		};
	} catch {
		return null;
	}
}

function readValidatedReportFile(
	file: ContainedPromptContextDriftReport,
): string {
	let fileDescriptor: number | null = null;
	try {
		fileDescriptor = openValidatedReportPath(file);
		const stat = fstatSync(fileDescriptor);
		if (!isReadableReportFile(stat)) return "";
		const buffer = Buffer.alloc(stat.size);
		const bytesRead = readSync(fileDescriptor, buffer, 0, buffer.length, 0);
		return buffer.subarray(0, bytesRead).toString("utf8");
	} catch {
		return "";
	} finally {
		if (fileDescriptor !== null) {
			closeSync(fileDescriptor);
		}
	}
}

function openValidatedReportPath(
	file: ContainedPromptContextDriftReport,
): number {
	return openReportNoFollow(file.realPath, REPORT_OPEN_FLAGS);
}

function safeReportPath(repoRoot: string, reportPath: string): string | null {
	try {
		const realRepoRoot = realpathSync(repoRoot);
		if (isInvalidReportPath(reportPath)) {
			return null;
		}
		const absolutePath = knownReportAbsolutePath(realRepoRoot, reportPath);
		if (absolutePath === null) return null;
		if (escapesRepoRoot(realRepoRoot, absolutePath)) return null;
		const stat = lstatSync(absolutePath);
		if (!isReadableReportFile(stat)) return null;
		const realPath = realpathSync(absolutePath);
		if (escapesRepoRoot(realRepoRoot, realPath)) return null;
		return realPath;
	} catch {
		return null;
	}
}

function isInvalidReportPath(reportPath: string): boolean {
	return typeof reportPath !== "string" || /[\r\n\0]/.test(reportPath);
}

function isReadableReportFile(stat: {
	isSymbolicLink(): boolean;
	isFile(): boolean;
	size: number;
}): boolean {
	return (
		!stat.isSymbolicLink() && stat.isFile() && stat.size <= MAX_REPORT_BYTES
	);
}

function knownReportAbsolutePath(
	realRepoRoot: string,
	reportPath: string,
): string | null {
	const report = knownReport(reportPath);
	return report === null ? null : [realRepoRoot, ...report.segments].join(sep);
}

function knownReport(reportPath: string): KnownPromptContextDriftReport | null {
	return KNOWN_REPORT_PATHS.get(reportPath) ?? null;
}

function escapesRepoRoot(repoRoot: string, absolutePath: string): boolean {
	const relativePath = relative(repoRoot, absolutePath);
	return (
		relativePath === ".." ||
		relativePath.startsWith(`..${sep}`) ||
		isAbsolute(relativePath)
	);
}
