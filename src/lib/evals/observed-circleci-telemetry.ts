import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import {
	arrayStrings,
	firstArray,
	firstString,
	isPathInside,
	isRecord,
	redactSecrets,
	safeReadDir,
	safeLabel,
	shouldInspectTelemetry,
	uniqueStrings,
} from "./observed-circleci-telemetry-support.js";

/** Schema version for sanitized CircleCI observed-eval feeds. */
export const OBSERVED_CIRCLECI_TELEMETRY_SCHEMA_VERSION =
	"observed-circleci-telemetry/v1";

/** Normalized CircleCI job evidence safe for local eval seed generation. */
export interface ObservedCircleCiJob {
	id: string;
	checkName: string | null;
	workflowName: string | null;
	jobName: string | null;
	pipelineId: string | null;
	workflowId: string | null;
	jobNumber: string | null;
	headSha: string | null;
	branch: string | null;
	pr: string | null;
	status: "pass" | "fail" | "blocked" | "unknown";
	failureClass: string | null;
	excerpt: string | null;
	evidenceRefs: string[];
	candidateEvalSeed: string | null;
}

/** Sanitized CircleCI telemetry artifact consumed by eval feedback loops. */
export interface ObservedCircleCiTelemetryArtifact {
	schemaVersion: typeof OBSERVED_CIRCLECI_TELEMETRY_SCHEMA_VERSION;
	generatedAt: string;
	source: {
		circleciTelemetryRoot: string | null;
		status: "available" | "unavailable";
		reason: string;
	};
	redaction: {
		rawLogsPersisted: false;
		secretsRedacted: true;
		excerptMaxChars: number;
	};
	summary: {
		jobsObserved: number;
		failedJobs: number;
		blockedJobs: number;
		candidateEvalSeeds: number;
		failureClasses: Record<string, number>;
	};
	jobs: ObservedCircleCiJob[];
}

/** Options for building a sanitized CircleCI telemetry artifact. */
export interface BuildObservedCircleCiTelemetryOptions {
	repoRoot?: string;
	circleciTelemetryRoot?: string;
	generatedAt?: string;
	outputPath?: string;
}

const EXCERPT_MAX_CHARS = 280;
const MAX_FILES = 200;
const TELEMETRY_EXTENSIONS = new Set([".json", ".jsonl", ".ndjson"]);
const FAILURE_CLASSIFIERS = [
	{ pattern: /TS\d+|typescript|tsc\b/i, failureClass: "typescript_error" },
	{ pattern: /biome|format|lint/i, failureClass: "lint_format_error" },
	{
		pattern: /docs-gate|markdownlint|docs:lint/i,
		failureClass: "docs_gate_failure",
	},
	{ pattern: /memory|heap|oom|out of memory/i, failureClass: "memory_failure" },
	{
		pattern: /unauthorized|forbidden|token|permission/i,
		failureClass: "circleci_auth_blocked",
	},
	{
		pattern: /timed? out|network|ECONN|ENOTFOUND/i,
		failureClass: "circleci_network_blocked",
	},
] as const;

/**
 * Build and optionally persist a sanitized CircleCI observed-eval feed.
 *
 * @param options - Source telemetry root and output path.
 * @returns Sanitized CircleCI telemetry artifact.
 */
export function buildObservedCircleCiTelemetry(
	options: BuildObservedCircleCiTelemetryOptions,
): ObservedCircleCiTelemetryArtifact {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const sourceRoot = options.circleciTelemetryRoot
		? resolve(options.circleciTelemetryRoot)
		: null;
	const jobs = sourceRoot ? collectJobs(sourceRoot) : [];
	const artifact: ObservedCircleCiTelemetryArtifact = {
		schemaVersion: OBSERVED_CIRCLECI_TELEMETRY_SCHEMA_VERSION,
		generatedAt: options.generatedAt ?? new Date().toISOString(),
		source: sourceStatus(sourceRoot),
		redaction: {
			rawLogsPersisted: false,
			secretsRedacted: true,
			excerptMaxChars: EXCERPT_MAX_CHARS,
		},
		summary: summarizeJobs(jobs),
		jobs,
	};
	if (options.outputPath) {
		writeArtifact(repoRoot, options.outputPath, artifact);
	}
	return artifact;
}

function sourceStatus(
	sourceRoot: string | null,
): ObservedCircleCiTelemetryArtifact["source"] {
	if (!sourceRoot) {
		return {
			circleciTelemetryRoot: null,
			status: "unavailable",
			reason: "No CircleCI telemetry root was configured.",
		};
	}
	if (!existsSync(sourceRoot)) {
		return {
			circleciTelemetryRoot: sourceRoot,
			status: "unavailable",
			reason: "CircleCI telemetry root does not exist.",
		};
	}
	return {
		circleciTelemetryRoot: sourceRoot,
		status: "available",
		reason: "CircleCI telemetry root was readable.",
	};
}

function collectJobs(sourceRoot: string): ObservedCircleCiJob[] {
	if (!existsSync(sourceRoot)) return [];
	return telemetryFiles(sourceRoot)
		.flatMap((filePath) => recordsFromFile(filePath))
		.map((record, index) => normalizeJob(record, index + 1))
		.filter((job): job is ObservedCircleCiJob => job !== null);
}

function telemetryFiles(sourceRoot: string): string[] {
	const files: string[] = [];
	const pending = [sourceRoot];
	let inspected = 0;
	while (shouldInspectTelemetry(pending, files, inspected)) {
		const current = pending.shift();
		if (!current) break;
		inspected += 1;
		const stat = safeStat(current);
		if (!stat) continue;
		if (stat.isSymbolicLink()) continue;
		if (stat.isDirectory()) {
			for (const entry of safeReadDir(current)) {
				if (pending.length + files.length >= MAX_FILES) break;
				pending.push(join(current, entry));
			}
			continue;
		}
		if (stat.isFile() && TELEMETRY_EXTENSIONS.has(extname(current))) {
			files.push(current);
		}
	}
	return files;
}

function safeStat(path: string) {
	try {
		return lstatSync(path);
	} catch {
		return null;
	}
}

function recordsFromFile(filePath: string): Record<string, unknown>[] {
	const stat = safeStat(filePath);
	if (!stat || stat.isSymbolicLink() || !stat.isFile()) return [];
	let content: string;
	try {
		content = readFileSync(filePath, "utf8");
	} catch {
		return [];
	}
	const parsed =
		extname(filePath) === ".json"
			? parseJson(content)
			: parseJsonLines(content);
	return recordsFromValue(parsed).map((record) => ({
		...record,
		__sourcePath: filePath,
	}));
}

function parseJson(content: string): unknown {
	try {
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function parseJsonLines(content: string): unknown[] {
	return content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map(parseJson)
		.filter((value) => value !== null);
}

function recordsFromValue(value: unknown): Record<string, unknown>[] {
	if (Array.isArray(value)) return value.flatMap(recordsFromValue);
	if (!isRecord(value)) return [];
	const nested = firstArray(value, ["jobs", "items", "records", "builds"]);
	return nested ? nested.flatMap(recordsFromValue) : [value];
}

function normalizeJob(
	value: Record<string, unknown>,
	index: number,
): ObservedCircleCiJob | null {
	if (!hasCircleCiJobIdentity(value)) return null;
	const jobName = firstString(value, ["jobName", "job_name"]);
	const workflowName = firstString(value, ["workflowName", "workflow_name"]);
	const status = normalizeStatus(
		firstString(value, ["status", "outcome", "conclusion"]),
	);
	const excerpt = redactedExcerpt(value);
	const failureClass = classifyFailure(value, status, excerpt);
	return {
		id: firstString(value, ["id"]) ?? `circleci-job-${index}`,
		checkName:
			firstString(value, ["checkName", "check_name"]) ?? checkName(jobName),
		workflowName,
		jobName,
		pipelineId: firstString(value, ["pipelineId", "pipeline_id"]),
		workflowId: firstString(value, ["workflowId", "workflow_id"]),
		jobNumber: firstString(value, ["jobNumber", "job_number", "build_num"]),
		headSha: firstString(value, ["headSha", "head_sha", "vcs_revision"]),
		branch: firstString(value, ["branch", "vcs_branch"]),
		pr: firstString(value, ["pr", "pullRequest", "pull_request"]),
		status,
		failureClass,
		excerpt,
		evidenceRefs: evidenceRefs(value),
		candidateEvalSeed: failureClass
			? `circleci-${failureClass.replaceAll("_", "-")}`
			: null,
	};
}

function hasCircleCiJobIdentity(value: Record<string, unknown>): boolean {
	return (
		firstString(value, ["jobName", "job_name"]) !== null ||
		firstString(value, ["checkName", "check_name"]) !== null ||
		firstString(value, ["workflowName", "workflow_name"]) !== null ||
		firstString(value, ["jobNumber", "job_number", "build_num"]) !== null ||
		firstString(value, ["pipelineId", "pipeline_id"]) !== null ||
		firstString(value, ["workflowId", "workflow_id"]) !== null
	);
}

function normalizeStatus(value: string | null): ObservedCircleCiJob["status"] {
	const status = value?.toLowerCase() ?? "";
	if (["success", "passed", "pass"].includes(status)) return "pass";
	if (["failed", "failure", "error", "fail"].includes(status)) return "fail";
	if (["blocked", "canceled", "cancelled", "unauthorized"].includes(status)) {
		return "blocked";
	}
	return "unknown";
}

function classifyFailure(
	record: Record<string, unknown>,
	status: ObservedCircleCiJob["status"],
	excerpt: string | null,
): string | null {
	const explicit = firstString(record, ["failureClass", "failure_class"]);
	if (explicit) return safeLabel(explicit);
	if (status === "pass" || status === "unknown") return null;
	const text = `${excerpt ?? ""} ${firstString(record, ["step", "stepName"]) ?? ""}`;
	const classifier = FAILURE_CLASSIFIERS.find(({ pattern }) =>
		pattern.test(text),
	);
	if (classifier) return classifier.failureClass;
	return status === "blocked" ? "circleci_blocked" : "circleci_job_failure";
}

function evidenceRefs(record: Record<string, unknown>): string[] {
	const refs = arrayStrings(record.evidenceRefs ?? record.evidence_refs).map(
		redactSecrets,
	);
	const jobNumber = firstString(record, [
		"jobNumber",
		"job_number",
		"build_num",
	]);
	const sourcePath = firstString(record, ["__sourcePath"]);
	return uniqueStrings([
		...refs,
		...(jobNumber ? [`circleci://build/${jobNumber}`] : []),
		...(sourcePath
			? [`local-circleci-telemetry://${basename(sourcePath)}`]
			: []),
	]);
}

function redactedExcerpt(record: Record<string, unknown>): string | null {
	const value = firstString(record, [
		"excerpt",
		"message",
		"error",
		"failure",
		"output",
		"log",
	]);
	if (!value) return null;
	return redactSecrets(value)
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, EXCERPT_MAX_CHARS);
}

function summarizeJobs(
	jobs: ObservedCircleCiJob[],
): ObservedCircleCiTelemetryArtifact["summary"] {
	const failureClasses: Record<string, number> = {};
	for (const job of jobs) {
		if (job.failureClass) {
			failureClasses[job.failureClass] =
				(failureClasses[job.failureClass] ?? 0) + 1;
		}
	}
	return {
		jobsObserved: jobs.length,
		failedJobs: jobs.filter((job) => job.status === "fail").length,
		blockedJobs: jobs.filter(
			(job) =>
				job.status === "blocked" || job.failureClass?.endsWith("_blocked"),
		).length,
		candidateEvalSeeds: jobs.filter((job) => job.candidateEvalSeed).length,
		failureClasses,
	};
}

function writeArtifact(
	repoRoot: string,
	outputPath: string,
	artifact: ObservedCircleCiTelemetryArtifact,
): void {
	const absolute = resolveRepoPath(repoRoot, outputPath);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, `${JSON.stringify(artifact, null, 2)}\n`);
}

function resolveRepoPath(repoRoot: string, requestedPath: string): string {
	const absolute = resolve(repoRoot, requestedPath);
	if (!isPathInside(repoRoot, absolute)) {
		throw new Error(
			"Observed CircleCI telemetry paths must stay inside repoRoot.",
		);
	}
	return absolute;
}

function checkName(jobName: string | null): string | null {
	return jobName ? `ci/circleci: ${jobName}` : null;
}
