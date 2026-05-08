import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	OBSERVED_SKILL_USAGE_SCHEMA_VERSION,
	buildObservedSkillUsage,
} from "./observed-skill-usage.js";

function writeJson(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

describe("buildObservedSkillUsage", () => {
	it("classifies missing helper remediation as a future eval seed", () => {
		const dir = mkdtempSync(join(tmpdir(), "observed-skill-usage-"));
		const sessionCollectorPath = join(
			dir,
			"artifacts/session-collector/session-collector.json",
		);
		const pluginEvalBudgetPath = join(
			dir,
			"artifacts/plugin-eval/he-eval-report-budget.json",
		);
		const outputPath = "artifacts/evals/observed-skill-usage.json";
		const summaryPath = "artifacts/evals/observed-skill-usage-summary.md";

		writeJson(sessionCollectorPath, {
			generatedAt: "2026-05-08T11:30:00.000Z",
			sessions: [
				{
					first_seen_at: "2026-05-08T10:15:00.000Z",
					last_seen_at: "2026-05-08T10:47:00.000Z",
					skill_mentions: { "he-eval-report": 2 },
					token_usage: {
						input_tokens: 2100,
						output_tokens: 900,
						total_tokens: 3000,
						cached_tokens: 0,
					},
					command_fingerprints: {
						"python3 /skills/he-eval-report/scripts/validate_eval_report.py report.md --json": 1,
						"pnpm test:artifacts:evals": 1,
					},
					validation_gates: {
						"pnpm test:artifacts:evals": "pass",
					},
				},
			],
		});
		writeJson(pluginEvalBudgetPath, {
			staticEstimate: {
				triggerTokens: 62,
				invokeTokens: 1292,
				deferredTokens: 8182,
			},
		});

		const artifact = buildObservedSkillUsage({
			skill: "he-eval-report",
			repoRoot: dir,
			sessionCollectorPath,
			pluginEvalBudgetPath,
			gitLogText: [
				"abc123\t2026-05-08 12:00:00 +0100\tfix: restore missing side_effect_consistency import",
				"def456\t2026-05-08 12:05:00 +0100\ttest: add missing helper import regression coverage",
				"ghi789\t2026-05-08 12:10:00 +0100\tchore: unrelated cleanup",
			].join("\n"),
			gitRange: "HEAD~20..HEAD",
			chronicle: {
				status: "available",
				reason: "Chronicle running; latest frame age 0s.",
				latestFrameAgeSeconds: 0,
			},
			generatedAt: "2026-05-08T12:30:00.000Z",
			outputPath,
			summaryPath,
		});

		expect(artifact).toMatchObject({
			schemaVersion: OBSERVED_SKILL_USAGE_SCHEMA_VERSION,
			skill: "he-eval-report",
			timeWindow: {
				startedAt: "2026-05-08T10:15:00.000Z",
				endedAt: "2026-05-08T10:47:00.000Z",
			},
			observedUsage: {
				inputTokens: 2100,
				outputTokens: 900,
				totalTokens: 3000,
				cachedTokens: 0,
				attribution: "direct-skill-window",
				confidence: "high",
			},
			staticEstimate: {
				triggerTokens: 62,
				invokeTokens: 1292,
				deferredTokens: 8182,
			},
			estimateComparison: {
				staticActiveTokens: 1354,
				observedInputTokens: 2100,
				deferredBudgetWasActuallyLoaded: false,
			},
			remediationEvidence: {
				followUpCommits: 2,
				repeatedFailureClass: "missing validator helper",
			},
			evalJudgment: {
				missedIssue: true,
				smallestNextEvalSeed:
					"missing helper imports in external skill validators",
			},
		});
		expect(artifact.workflowEvidence.commands).toContain(
			"pnpm test:artifacts:evals",
		);
		expect(existsSync(join(dir, outputPath))).toBe(true);
		expect(readFileSync(join(dir, summaryPath), "utf-8")).toContain(
			"missing helper imports in external skill validators",
		);
	});

	it("reads Plugin Eval budget explanation JSON as the static estimate", () => {
		const dir = mkdtempSync(join(tmpdir(), "observed-skill-usage-budget-"));
		const pluginEvalBudgetPath = join(
			dir,
			"artifacts/plugin-eval/he-eval-report-budget.json",
		);
		writeJson(pluginEvalBudgetPath, {
			kind: "budget-explanation",
			budgets: {
				method: "estimated-static",
				trigger_cost_tokens: { value: 48, band: "good" },
				invoke_cost_tokens: { value: 220, band: "good" },
				deferred_cost_tokens: { value: 180, band: "good" },
			},
		});

		const artifact = buildObservedSkillUsage({
			skill: "he-eval-report",
			repoRoot: dir,
			pluginEvalBudgetPath,
			generatedAt: "2026-05-08T12:30:00.000Z",
		});

		expect(artifact.staticEstimate).toEqual({
			triggerTokens: 48,
			invokeTokens: 220,
			deferredTokens: 180,
		});
		expect(artifact.estimateComparison.staticActiveTokens).toBe(268);
	});

	it("does not treat generic eval project hints as skill usage", () => {
		const dir = mkdtempSync(join(tmpdir(), "observed-skill-usage-generic-"));
		const sessionCollectorPath = join(
			dir,
			"artifacts/session-collector/session-collector.json",
		);

		writeJson(sessionCollectorPath, {
			sessions: [
				{
					first_seen_at: "2026-05-08T10:15:00.000Z",
					last_seen_at: "2026-05-08T10:47:00.000Z",
					project_hints: { evals: 1 },
					token_usage: {
						input_tokens: 999999,
						output_tokens: 1,
						total_tokens: 1000000,
						cached_tokens: 0,
					},
				},
			],
		});

		const artifact = buildObservedSkillUsage({
			skill: "he-eval-report",
			repoRoot: dir,
			sessionCollectorPath,
			generatedAt: "2026-05-08T12:30:00.000Z",
		});

		expect(artifact.observedUsage.inputTokens).toBeNull();
		expect(artifact.observedUsage.attribution).toBe("none");
		expect(artifact.observedUsage.confidence).toBe("none");
		expect(artifact.estimateComparison.observedInputTokens).toBeNull();
	});

	it("prefers direct skill token events over coarse eval-session totals", () => {
		const dir = mkdtempSync(join(tmpdir(), "observed-skill-usage-direct-"));
		const sessionCollectorPath = join(
			dir,
			"artifacts/session-collector/session-collector.json",
		);

		writeJson(sessionCollectorPath, {
			sessions: [
				{
					first_seen_at: "2026-05-08T09:00:00.000Z",
					last_seen_at: "2026-05-08T09:30:00.000Z",
					command_fingerprints: {
						"pnpm test:artifacts:evals": 1,
					},
					token_usage: {
						input_tokens: 999999,
						output_tokens: 1,
						total_tokens: 1000000,
						cached_tokens: 0,
					},
				},
				{
					first_seen_at: "2026-05-08T10:00:00.000Z",
					last_seen_at: "2026-05-08T10:10:00.000Z",
					skill_mentions: { "he-eval-report": 1 },
					command_fingerprints: {
						"python3 /skills/he-eval-report/scripts/validate_eval_report.py report.md --json": 1,
					},
					token_usage_events_detail: [
						{
							source: "codex_rollout.last_token_usage",
							token_usage: {
								input_tokens: 100,
								output_tokens: 25,
								total_tokens: 125,
								cached_tokens: 40,
							},
						},
						{
							source: "codex_rollout.last_token_usage",
							token_usage: {
								input_tokens: 50,
								output_tokens: 10,
								total_tokens: 60,
								cached_tokens: 20,
							},
						},
					],
					token_usage: {
						input_tokens: 999,
						output_tokens: 999,
						total_tokens: 1998,
						cached_tokens: 999,
					},
				},
			],
		});

		const artifact = buildObservedSkillUsage({
			skill: "he-eval-report",
			repoRoot: dir,
			sessionCollectorPath,
			generatedAt: "2026-05-08T12:30:00.000Z",
		});

		expect(artifact.observedUsage).toMatchObject({
			inputTokens: 150,
			outputTokens: 35,
			totalTokens: 185,
			cachedTokens: 60,
			attribution: "direct-skill-window",
			confidence: "high",
		});
		expect(artifact.workflowEvidence.commands).toEqual([
			"python3 /skills/he-eval-report/scripts/validate_eval_report.py report.md --json",
		]);
	});

	it("keeps coarse eval-session tokens unattributed", () => {
		const dir = mkdtempSync(join(tmpdir(), "observed-skill-usage-coarse-"));
		const sessionCollectorPath = join(
			dir,
			"artifacts/session-collector/session-collector.json",
		);

		writeJson(sessionCollectorPath, {
			sessions: [
				{
					first_seen_at: "2026-05-08T09:00:00.000Z",
					last_seen_at: "2026-05-08T09:30:00.000Z",
					command_fingerprints: {
						"pnpm test:artifacts:evals": 1,
					},
					validation_gates: {
						"pnpm test:artifacts:evals": "pass",
					},
					token_usage: {
						input_tokens: 999999,
						output_tokens: 1,
						total_tokens: 1000000,
						cached_tokens: 0,
					},
				},
			],
		});

		const artifact = buildObservedSkillUsage({
			skill: "he-eval-report",
			repoRoot: dir,
			sessionCollectorPath,
			generatedAt: "2026-05-08T12:30:00.000Z",
		});

		expect(artifact.observedUsage).toMatchObject({
			inputTokens: null,
			outputTokens: null,
			totalTokens: null,
			cachedTokens: null,
			attribution: "coarse-eval-session",
			confidence: "low",
		});
		expect(artifact.workflowEvidence).toMatchObject({
			commands: ["pnpm test:artifacts:evals"],
			validationOutcome: "pass",
		});
	});

	it("stays honest when optional telemetry sources are unavailable", () => {
		const dir = mkdtempSync(join(tmpdir(), "observed-skill-usage-empty-"));

		const artifact = buildObservedSkillUsage({
			skill: "he-eval-report",
			repoRoot: dir,
			chronicle: {
				status: "unavailable",
				reason: "Chronicle was not running during collection.",
			},
			gitRange: "unknown",
			generatedAt: "2026-05-08T12:30:00.000Z",
		});

		expect(artifact.source.sessionCollector).toBeNull();
		expect(artifact.source.pluginEvalBudget).toBeNull();
		expect(artifact.observedUsage.inputTokens).toBeNull();
		expect(artifact.observedUsage.attribution).toBe("none");
		expect(artifact.observedUsage.confidence).toBe("none");
		expect(
			artifact.estimateComparison.deferredBudgetWasActuallyLoaded,
		).toBeNull();
		expect(artifact.workflowEvidence.validationOutcome).toBe("unknown");
		expect(artifact.evalJudgment).toMatchObject({
			didCatchIssue: false,
			missedIssue: false,
			smallestNextEvalSeed: null,
		});
	});
});
