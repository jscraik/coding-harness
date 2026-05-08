import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

/** Schema version for observed skill usage artifacts. */
export const OBSERVED_SKILL_USAGE_SCHEMA_VERSION = "observed-skill-usage/v1";

/** Chronicle availability summary attached to observed usage evidence. */
export interface ObservedChronicleStatus {
	/** Whether Chronicle was running and fresh enough to be used as context. */
	status: "available" | "unavailable";
	/** Human-readable status reason suitable for local artifacts. */
	reason: string;
	/** Age of the newest frame, when available. */
	latestFrameAgeSeconds?: number;
	/** OCR or memory-summary matches used only as coarse workflow context. */
	matches?: string[];
}

/** Static Plugin Eval token estimate for the target skill. */
export interface ObservedStaticEstimate {
	/** Trigger text token estimate. */
	triggerTokens: number;
	/** Invoke-time token estimate. */
	invokeTokens: number;
	/** Deferred support-file token estimate. */
	deferredTokens: number;
}

/** How closely observed tokens can be attributed to the target skill. */
export type ObservedUsageAttribution =
	| "direct-skill-window"
	| "command-window"
	| "coarse-eval-session"
	| "none";

/** Confidence level for observed token attribution. */
export type ObservedUsageConfidence = "high" | "medium" | "low" | "none";

/** Token usage observed from session telemetry. */
export interface ObservedTokenUsage {
	/** Observed prompt/input tokens. */
	inputTokens: number | null;
	/** Observed completion/output tokens. */
	outputTokens: number | null;
	/** Observed total tokens. */
	totalTokens: number | null;
	/** Observed cached tokens. */
	cachedTokens: number | null;
	/** Attribution method used for the observed token values. */
	attribution: ObservedUsageAttribution;
	/** Confidence in the token attribution. */
	confidence: ObservedUsageConfidence;
}

/** Workflow evidence inferred from session telemetry. */
export interface ObservedWorkflowEvidence {
	/** Commands or command fingerprints associated with the observed sessions. */
	commands: string[];
	/** Validation outcome inferred from validation gate or blocker signals. */
	validationOutcome: "pass" | "fail" | "unknown";
	/** First failure string when a blocker or failed gate was observed. */
	firstFailure: string | null;
	/** Classified blocker when available. */
	blockerClass: string | null;
}

/** Git-history remediation evidence connected to the skill/eval workflow. */
export interface ObservedRemediationEvidence {
	/** Follow-up commits matching remediation-oriented terms. */
	followUpCommits: number;
	/** Review-fix commits. */
	reviewFixCommits: number;
	/** CircleCI-fix commits. */
	circleciFixCommits: number;
	/** CodeRabbit-fix commits. */
	coderabbitFixCommits: number;
	/** Repeated failure class inferred from commit subjects. */
	repeatedFailureClass: string | null;
	/** Matching commit subjects kept as redacted local evidence. */
	commitSubjects: string[];
}

/** Eval judgment derived from usage plus remediation evidence. */
export interface ObservedEvalJudgment {
	/** Whether the eval/report workflow appears to have caught an issue. */
	didCatchIssue: boolean;
	/** Whether later remediation suggests a missed issue. */
	missedIssue: boolean;
	/** Smallest future eval seed candidate, when one is available. */
	smallestNextEvalSeed: string | null;
}

/** Observed skill usage artifact consumed by eval and Plugin Eval feedback loops. */
export interface ObservedSkillUsageArtifact {
	/** Artifact schema version. */
	schemaVersion: typeof OBSERVED_SKILL_USAGE_SCHEMA_VERSION;
	/** Artifact generation timestamp. */
	generatedAt: string;
	/** Target skill or workflow name. */
	skill: string;
	/** Evidence source references. */
	source: {
		/** Session collector JSON path when used. */
		sessionCollector: string | null;
		/** Chronicle status and optional window context. */
		chronicleWindow: ObservedChronicleStatus;
		/** Git range or log scope scanned for remediation evidence. */
		gitRange: string;
		/** Static Plugin Eval budget source path when used. */
		pluginEvalBudget: string | null;
	};
	/** Coarse observed time window across matching sessions. */
	timeWindow: {
		startedAt: string | null;
		endedAt: string | null;
	};
	/** Observed token usage from telemetry when present. */
	observedUsage: ObservedTokenUsage;
	/** Static token estimate from Plugin Eval when present. */
	staticEstimate: ObservedStaticEstimate | null;
	/** Comparison between static estimate and observed usage. */
	estimateComparison: {
		staticActiveTokens: number | null;
		observedInputTokens: number | null;
		deferredBudgetWasActuallyLoaded: boolean | null;
	};
	/** Workflow evidence from sessions. */
	workflowEvidence: ObservedWorkflowEvidence;
	/** Remediation evidence from git history. */
	remediationEvidence: ObservedRemediationEvidence;
	/** Final eval feedback judgment. */
	evalJudgment: ObservedEvalJudgment;
}

/** Options for building an observed skill usage artifact. */
export interface BuildObservedSkillUsageOptions {
	/** Target skill or workflow name. */
	skill: string;
	/** Repository root used for path resolution. */
	repoRoot?: string;
	/** Session collector JSON path. */
	sessionCollectorPath?: string;
	/** Plugin Eval static budget output path. */
	pluginEvalBudgetPath?: string;
	/** Git log text, one commit per line, for deterministic tests. */
	gitLogText?: string;
	/** Git log range or scope label. */
	gitRange?: string;
	/** Chronicle status from the CLI wrapper. */
	chronicle?: ObservedChronicleStatus;
	/** Deterministic generation time for tests. */
	generatedAt?: string;
	/** Optional output path for JSON persistence. */
	outputPath?: string;
	/** Optional Markdown summary output path. */
	summaryPath?: string;
}

interface SessionObservation {
	startedAt: string | null;
	endedAt: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	totalTokens: number | null;
	cachedTokens: number | null;
	attribution: ObservedUsageAttribution;
	confidence: ObservedUsageConfidence;
	commands: string[];
	validationOutcome: ObservedWorkflowEvidence["validationOutcome"];
	firstFailure: string | null;
	blockerClass: string | null;
}

interface SessionMatch {
	session: Record<string, unknown>;
	attribution: ObservedUsageAttribution;
	confidence: ObservedUsageConfidence;
	includeTokens: boolean;
	rank: number;
}

const REMEDIATION_TERMS =
	/\b(fix|restore|review|coderabbit|circleci|ci|validation|eval|helper|regression)\b/i;
const MISSING_HELPER_TERMS =
	/\b(missing helper|side_effect_consistency|module not found|import error|failed to import|cannot import)\b/i;

/**
 * Build and optionally persist an observed skill usage artifact.
 *
 * @param options - Evidence source paths, git history text, Chronicle status, and output paths.
 * @returns The observed usage artifact.
 */
export function buildObservedSkillUsage(
	options: BuildObservedSkillUsageOptions,
): ObservedSkillUsageArtifact {
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const sessionCollectorPath = resolveOptional(
		repoRoot,
		options.sessionCollectorPath,
	);
	const pluginEvalBudgetPath = resolveOptional(
		repoRoot,
		options.pluginEvalBudgetPath,
	);
	const sessionObservation = sessionCollectorPath
		? observeSessions(sessionCollectorPath, options.skill)
		: emptySessionObservation();
	const staticEstimate = pluginEvalBudgetPath
		? parseStaticEstimate(pluginEvalBudgetPath)
		: null;
	const remediationEvidence = observeGitRemediation(options.gitLogText ?? "");
	const artifact: ObservedSkillUsageArtifact = {
		schemaVersion: OBSERVED_SKILL_USAGE_SCHEMA_VERSION,
		generatedAt: options.generatedAt ?? new Date().toISOString(),
		skill: options.skill,
		source: {
			sessionCollector: sessionCollectorPath,
			chronicleWindow: options.chronicle ?? {
				status: "unavailable",
				reason: "Chronicle status was not collected.",
			},
			gitRange: options.gitRange ?? "unknown",
			pluginEvalBudget: pluginEvalBudgetPath,
		},
		timeWindow: {
			startedAt: sessionObservation.startedAt,
			endedAt: sessionObservation.endedAt,
		},
		observedUsage: {
			inputTokens: sessionObservation.inputTokens,
			outputTokens: sessionObservation.outputTokens,
			totalTokens: sessionObservation.totalTokens,
			cachedTokens: sessionObservation.cachedTokens,
			attribution: sessionObservation.attribution,
			confidence: sessionObservation.confidence,
		},
		staticEstimate,
		estimateComparison: compareEstimates(staticEstimate, sessionObservation),
		workflowEvidence: {
			commands: sessionObservation.commands,
			validationOutcome: sessionObservation.validationOutcome,
			firstFailure: sessionObservation.firstFailure,
			blockerClass: sessionObservation.blockerClass,
		},
		remediationEvidence,
		evalJudgment: judgeEval(sessionObservation, remediationEvidence),
	};
	writeOutputs(artifact, repoRoot, options);
	return artifact;
}

function resolveOptional(repoRoot: string, path?: string): string | null {
	if (!path) return null;
	return resolve(repoRoot, path);
}

function observeSessions(
	sessionCollectorPath: string,
	skill: string,
): SessionObservation {
	if (!existsSync(sessionCollectorPath)) return emptySessionObservation();
	const root = parseJsonRecord(readFileSync(sessionCollectorPath, "utf-8"));
	const matches = arrayValue(root.sessions)
		.map((item) => classifySessionMatch(item, skill))
		.filter((item): item is SessionMatch => item !== null);
	const bestRank = Math.max(0, ...matches.map((match) => match.rank));
	const selected = matches.filter((match) => match.rank === bestRank);
	return selected.reduce(mergeSessionMatch, emptySessionObservation());
}

function classifySessionMatch(
	value: unknown,
	skill: string,
): SessionMatch | null {
	if (!isRecord(value)) return null;
	const normalizedSkill = skill.toLowerCase();
	const directMentionNeedles = [normalizedSkill];
	const directCommandNeedles = [
		normalizedSkill,
		"validate_eval_report",
		"observed-skill",
	];
	const coarseCommandNeedles = ["plugin-eval", "test:artifacts:evals"];
	const hasDirectMention = [
		"skill_mentions",
		"he_stage_mentions",
		"plugin_mentions",
		"project_hints",
	].some((key) => recordMentions(value[key], directMentionNeedles));
	const hasDirectCommand = [
		"command_fingerprints",
		"validation_gates",
		"tool_calls",
		"trace_names",
	].some((key) => recordMentions(value[key], directCommandNeedles));
	const hasCoarseEvalCommand = [
		"command_fingerprints",
		"validation_gates",
		"tool_calls",
		"trace_names",
	].some((key) => recordMentions(value[key], coarseCommandNeedles));
	if (hasDirectMention) {
		return {
			session: value,
			attribution: "direct-skill-window",
			confidence: "high",
			includeTokens: true,
			rank: 3,
		};
	}
	if (hasDirectCommand) {
		return {
			session: value,
			attribution: "command-window",
			confidence: "medium",
			includeTokens: true,
			rank: 2,
		};
	}
	if (hasCoarseEvalCommand) {
		return {
			session: value,
			attribution: "coarse-eval-session",
			confidence: "low",
			includeTokens: false,
			rank: 1,
		};
	}
	return null;
}

function recordMentions(value: unknown, needles: string[]): boolean {
	if (!isRecord(value)) return false;
	return Object.keys(value).some((key) =>
		needles.some((needle) => key.toLowerCase().includes(needle)),
	);
}

function mergeSessionMatch(
	accumulator: SessionObservation,
	match: SessionMatch,
): SessionObservation {
	const session = match.session;
	const inputTokens = match.includeTokens
		? tokenMetric(session, ["input_tokens", "prompt_tokens"])
		: null;
	const outputTokens = match.includeTokens
		? tokenMetric(session, ["output_tokens", "completion_tokens"])
		: null;
	const totalTokens = match.includeTokens
		? tokenMetric(session, ["total_tokens", "tokens"])
		: null;
	const cachedTokens = match.includeTokens
		? tokenMetric(session, ["cached_tokens"])
		: null;
	return {
		startedAt: minIso(
			accumulator.startedAt,
			stringValue(session.first_seen_at),
		),
		endedAt: maxIso(accumulator.endedAt, stringValue(session.last_seen_at)),
		inputTokens: sumNullable(accumulator.inputTokens, inputTokens),
		outputTokens: sumNullable(accumulator.outputTokens, outputTokens),
		totalTokens: sumNullable(accumulator.totalTokens, totalTokens),
		cachedTokens: sumNullable(accumulator.cachedTokens, cachedTokens),
		attribution:
			accumulator.attribution === "none"
				? match.attribution
				: accumulator.attribution,
		confidence:
			accumulator.confidence === "none"
				? match.confidence
				: accumulator.confidence,
		commands: uniqueStrings([
			...accumulator.commands,
			...Object.keys(recordValue(session.command_fingerprints)),
			...Object.keys(recordValue(session.validation_gates)),
			...Object.keys(recordValue(session.tool_calls)).filter((tool) =>
				/(pytest|vitest|pnpm|validate|test|exec|bash)/i.test(tool),
			),
		]),
		validationOutcome: mergeValidationOutcome(
			accumulator.validationOutcome,
			sessionValidationOutcome(session),
		),
		firstFailure: accumulator.firstFailure ?? firstRecordKey(session.blockers),
		blockerClass: accumulator.blockerClass ?? firstRecordKey(session.blockers),
	};
}

function sessionValidationOutcome(
	session: Record<string, unknown>,
): ObservedWorkflowEvidence["validationOutcome"] {
	if (Object.keys(recordValue(session.blockers)).length > 0) return "fail";
	if (Object.keys(recordValue(session.validation_gates)).length > 0)
		return "pass";
	return "unknown";
}

function tokenMetric(
	session: Record<string, unknown>,
	keys: string[],
): number | null {
	const eventTotal = tokenEventMetric(session, keys);
	if (eventTotal !== null) return eventTotal;
	const metricSources = [
		recordValue(session.token_usage),
		recordValue(session.usage),
		recordValue(session.metrics),
		session,
	];
	for (const source of metricSources) {
		for (const key of keys) {
			const value = numberValue(source[key]);
			if (value !== null) return value;
		}
	}
	return null;
}

function tokenEventMetric(
	session: Record<string, unknown>,
	keys: string[],
): number | null {
	const eventValues = arrayValue(session.token_usage_events_detail)
		.map((event) => recordValue(recordValue(event).token_usage))
		.map((usage) => firstNumber(usage, keys))
		.filter((value): value is number => value !== null);
	if (eventValues.length === 0) return null;
	return eventValues.reduce((total, value) => total + value, 0);
}

function parseStaticEstimate(path: string): ObservedStaticEstimate | null {
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, "utf-8");
	const parsed = tryParseJson(raw);
	if (parsed) {
		const estimate = extractStaticEstimate(parsed);
		if (estimate) return estimate;
	}
	return extractMarkdownEstimate(raw);
}

function extractStaticEstimate(value: unknown): ObservedStaticEstimate | null {
	if (!isRecord(value)) return null;
	const direct = readEstimateRecord(value);
	if (direct) return direct;
	const pluginEvalBudget = readPluginEvalBudgetRecord(value);
	if (pluginEvalBudget) return pluginEvalBudget;
	for (const nested of Object.values(value)) {
		const estimate = readEstimateRecord(nested);
		if (estimate) return estimate;
		const budgetEstimate = readPluginEvalBudgetRecord(nested);
		if (budgetEstimate) return budgetEstimate;
	}
	return null;
}

function readEstimateRecord(value: unknown): ObservedStaticEstimate | null {
	if (!isRecord(value)) return null;
	const triggerTokens = firstNumber(value, ["triggerTokens", "trigger_tokens"]);
	const invokeTokens = firstNumber(value, ["invokeTokens", "invoke_tokens"]);
	const deferredTokens = firstNumber(value, [
		"deferredTokens",
		"deferred_tokens",
	]);
	if (
		triggerTokens === null ||
		invokeTokens === null ||
		deferredTokens === null
	) {
		return null;
	}
	return { triggerTokens, invokeTokens, deferredTokens };
}

function readPluginEvalBudgetRecord(
	value: unknown,
): ObservedStaticEstimate | null {
	if (!isRecord(value)) return null;
	const budgets = recordValue(value.budgets);
	const triggerTokens = budgetValue(budgets.trigger_cost_tokens);
	const invokeTokens = budgetValue(budgets.invoke_cost_tokens);
	const deferredTokens = budgetValue(budgets.deferred_cost_tokens);
	if (
		triggerTokens === null ||
		invokeTokens === null ||
		deferredTokens === null
	) {
		return null;
	}
	return { triggerTokens, invokeTokens, deferredTokens };
}

function budgetValue(value: unknown): number | null {
	if (typeof value === "number") return numberValue(value);
	return numberValue(recordValue(value).value);
}

function extractMarkdownEstimate(raw: string): ObservedStaticEstimate | null {
	const triggerTokens = regexNumber(
		raw,
		/trigger(?:\s+text)?\s+tokens?\D+(\d+)/i,
	);
	const invokeTokens = regexNumber(
		raw,
		/invoke(?:\s+time)?\s+tokens?\D+(\d+)/i,
	);
	const deferredTokens = regexNumber(
		raw,
		/deferred(?:\s+support)?\s+tokens?\D+(\d+)/i,
	);
	if (
		triggerTokens === null ||
		invokeTokens === null ||
		deferredTokens === null
	) {
		return null;
	}
	return { triggerTokens, invokeTokens, deferredTokens };
}

function compareEstimates(
	staticEstimate: ObservedStaticEstimate | null,
	sessionObservation: SessionObservation,
): ObservedSkillUsageArtifact["estimateComparison"] {
	if (!staticEstimate) {
		return {
			staticActiveTokens: null,
			observedInputTokens: sessionObservation.inputTokens,
			deferredBudgetWasActuallyLoaded: null,
		};
	}
	return {
		staticActiveTokens:
			staticEstimate.triggerTokens + staticEstimate.invokeTokens,
		observedInputTokens: sessionObservation.inputTokens,
		deferredBudgetWasActuallyLoaded:
			sessionObservation.inputTokens === null
				? null
				: sessionObservation.inputTokens >=
					staticEstimate.triggerTokens +
						staticEstimate.invokeTokens +
						staticEstimate.deferredTokens,
	};
}

function observeGitRemediation(
	gitLogText: string,
): ObservedRemediationEvidence {
	const commitSubjects = gitLogText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => REMEDIATION_TERMS.test(line))
		.slice(0, 50);
	return {
		followUpCommits: commitSubjects.length,
		reviewFixCommits: countMatches(commitSubjects, /\breview|codex review/i),
		circleciFixCommits: countMatches(commitSubjects, /\bcircleci|ci\b/i),
		coderabbitFixCommits: countMatches(commitSubjects, /\bcoderabbit/i),
		repeatedFailureClass: classifyRepeatedFailure(commitSubjects),
		commitSubjects,
	};
}

function classifyRepeatedFailure(commitSubjects: string[]): string | null {
	if (commitSubjects.some((subject) => MISSING_HELPER_TERMS.test(subject))) {
		return "missing validator helper";
	}
	if (
		commitSubjects.some((subject) =>
			/\bgenerated|artifact|drift/i.test(subject),
		)
	) {
		return "generated artifact drift";
	}
	if (commitSubjects.some((subject) => /\bcircleci|ci\b/i.test(subject))) {
		return "ci remediation";
	}
	if (commitSubjects.length > 0) return "review remediation";
	return null;
}

function judgeEval(
	sessionObservation: SessionObservation,
	remediationEvidence: ObservedRemediationEvidence,
): ObservedEvalJudgment {
	const missedIssue = remediationEvidence.followUpCommits > 0;
	return {
		didCatchIssue: sessionObservation.validationOutcome === "fail",
		missedIssue,
		smallestNextEvalSeed: missedIssue
			? seedForFailure(remediationEvidence.repeatedFailureClass)
			: null,
	};
}

function seedForFailure(failureClass: string | null): string | null {
	if (failureClass === "missing validator helper") {
		return "missing helper imports in external skill validators";
	}
	if (failureClass === "generated artifact drift") {
		return "generated eval artifacts remain synchronized with source validators";
	}
	if (failureClass === "ci remediation") {
		return "CI failure class is reproduced by a deterministic eval fixture";
	}
	return failureClass
		? `${failureClass} deterministic regression fixture`
		: null;
}

function writeOutputs(
	artifact: ObservedSkillUsageArtifact,
	repoRoot: string,
	options: BuildObservedSkillUsageOptions,
): void {
	if (options.outputPath) {
		writeJson(resolve(repoRoot, options.outputPath), artifact);
	}
	if (options.summaryPath) {
		writeText(
			resolve(repoRoot, options.summaryPath),
			renderObservedSkillUsageSummary(artifact),
		);
	}
}

/** Render a concise Markdown summary for an observed skill usage artifact. */
export function renderObservedSkillUsageSummary(
	artifact: ObservedSkillUsageArtifact,
): string {
	return [
		`# Observed Skill Usage: ${artifact.skill}`,
		"",
		`- Schema: ${artifact.schemaVersion}`,
		`- Generated: ${artifact.generatedAt}`,
		`- Chronicle: ${artifact.source.chronicleWindow.status} (${artifact.source.chronicleWindow.reason})`,
		`- Session collector: ${artifact.source.sessionCollector ?? "not provided"}`,
		`- Git range: ${artifact.source.gitRange}`,
		`- Observed input tokens: ${artifact.observedUsage.inputTokens ?? "unknown"}`,
		`- Token attribution: ${artifact.observedUsage.attribution} (${artifact.observedUsage.confidence})`,
		`- Static active tokens: ${artifact.estimateComparison.staticActiveTokens ?? "unknown"}`,
		`- Deferred budget loaded: ${String(artifact.estimateComparison.deferredBudgetWasActuallyLoaded)}`,
		`- Validation outcome: ${artifact.workflowEvidence.validationOutcome}`,
		`- Follow-up commits: ${artifact.remediationEvidence.followUpCommits}`,
		`- Repeated failure class: ${artifact.remediationEvidence.repeatedFailureClass ?? "none"}`,
		`- Next eval seed: ${artifact.evalJudgment.smallestNextEvalSeed ?? "none"}`,
		"",
	].join("\n");
}

function emptySessionObservation(): SessionObservation {
	return {
		startedAt: null,
		endedAt: null,
		inputTokens: null,
		outputTokens: null,
		totalTokens: null,
		cachedTokens: null,
		attribution: "none",
		confidence: "none",
		commands: [],
		validationOutcome: "unknown",
		firstFailure: null,
		blockerClass: null,
	};
}

function writeJson(path: string, value: unknown): void {
	writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(`${path}.tmp`, value, "utf-8");
	renameSync(`${path}.tmp`, path);
}

function parseJsonRecord(raw: string): Record<string, unknown> {
	const parsed = JSON.parse(raw) as unknown;
	return isRecord(parsed) ? parsed : {};
}

function tryParseJson(raw: string): unknown | null {
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

function arrayValue(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstNumber(
	record: Record<string, unknown>,
	keys: string[],
): number | null {
	for (const key of keys) {
		const value = numberValue(record[key]);
		if (value !== null) return value;
	}
	return null;
}

function regexNumber(raw: string, pattern: RegExp): number | null {
	const match = raw.match(pattern);
	return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function sumNullable(left: number | null, right: number | null): number | null {
	if (left === null) return right;
	if (right === null) return left;
	return left + right;
}

function minIso(left: string | null, right: string | null): string | null {
	if (!left) return right;
	if (!right) return left;
	return right < left ? right : left;
}

function maxIso(left: string | null, right: string | null): string | null {
	if (!left) return right;
	if (!right) return left;
	return right > left ? right : left;
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter((value) => value.length > 0))].sort();
}

function mergeValidationOutcome(
	left: ObservedWorkflowEvidence["validationOutcome"],
	right: ObservedWorkflowEvidence["validationOutcome"],
): ObservedWorkflowEvidence["validationOutcome"] {
	if (left === "fail" || right === "fail") return "fail";
	if (left === "pass" || right === "pass") return "pass";
	return "unknown";
}

function firstRecordKey(value: unknown): string | null {
	const keys = Object.keys(recordValue(value));
	return keys[0] ?? null;
}

function countMatches(values: string[], pattern: RegExp): number {
	return values.filter((value) => pattern.test(value)).length;
}
