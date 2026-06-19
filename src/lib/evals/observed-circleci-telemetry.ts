import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

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
	while (pending.length > 0 && files.length < MAX_FILES) {
		const current = pending.shift();
		if (!current) break;
		const stat = safeStat(current);
		if (!stat) continue;
		if (stat.isDirectory()) {
			for (const entry of readdirSync(current).sort()) {
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
		return statSync(path);
	} catch {
		return null;
	}
}

function recordsFromFile(filePath: string): Record<string, unknown>[] {
	const content = readFileSync(filePath, "utf8");
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
	const jobName = firstString(value, ["jobName", "job_name", "name"]);
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
	const refs = arrayStrings(record.evidenceRefs ?? record.evidence_refs);
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
			? [`local-circleci-telemetry://${sourcePath.split("/").pop()}`]
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

function redactSecrets(value: string): string {
	return value
		.replace(
			/\b([A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD)[A-Z0-9_]*)=\S+/gi,
			"$1=<redacted>",
		)
		.replace(/Circle-Token:\s*\S+/gi, "Circle-Token: <redacted>")
		.replace(
			/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
			"<redacted-jwt>",
		);
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
		blockedJobs: jobs.filter((job) => job.status === "blocked").length,
		candidateEvalSeeds: jobs.filter((job) => job.candidateEvalSeed).length,
		failureClasses,
	};
}

function writeArtifact(
	repoRoot: string,
	outputPath: string,
	artifact: ObservedCircleCiTelemetryArtifact,
): void {
	const absolute = resolve(repoRoot, outputPath);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, `${JSON.stringify(artifact, null, 2)}\n`);
}

function checkName(jobName: string | null): string | null {
	return jobName ? `ci/circleci: ${jobName}` : null;
}

function firstString(
	record: Record<string, unknown>,
	keys: string[],
): string | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim() !== "") return value.trim();
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
	}
	return null;
}

function firstArray(
	record: Record<string, unknown>,
	keys: string[],
): unknown[] | null {
	for (const key of keys) {
		const value = record[key];
		if (Array.isArray(value)) return value;
	}
	return null;
}

function arrayStrings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

function safeLabel(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
