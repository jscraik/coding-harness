import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-goal-board.py");

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

function writeValidator(path: string, marker: string) {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(
		path,
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"import sys",
			`print("${marker}:" + sys.argv[1])`,
			"",
		].join("\n"),
	);
}

function writeReviewBackfillValidator(repo: string) {
	const scriptsDir = join(repo, "scripts");
	const ledgerPath = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json",
	);
	mkdirSync(scriptsDir, { recursive: true });
	mkdirSync(join(ledgerPath, ".."), { recursive: true });
	writeFileSync(ledgerPath, "{}");
	writeFileSync(
		join(scriptsDir, "check-goal-review-backfill.py"),
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"raise SystemExit(0)",
			"",
		].join("\n"),
	);
}

function writeRuntimeEvidenceActiveArtifacts(repo: string, content: string) {
	writeReviewBackfillValidator(repo);
	const harnessDir = join(repo, ".harness");
	const goalDir = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit",
	);
	mkdirSync(harnessDir, { recursive: true });
	mkdirSync(goalDir, { recursive: true });
	writeFileSync(join(harnessDir, "active-artifacts.md"), content);
}

function activeArtifactsRow(status: string) {
	return [
		"# Active Harness Specs And Plans",
		"",
		"## Current Active Route",
		"",
		"| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |",
		"| --- | --- | --- | --- | --- |",
		`| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md | ${status} | continue |`,
		"",
	].join("\n");
}

function writeRuntimeEvidenceReceipts(repo: string, headSha: string) {
	const receiptsDir = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit",
	);
	mkdirSync(receiptsDir, { recursive: true });
	writeFileSync(
		join(receiptsDir, "receipts.jsonl"),
		[
			JSON.stringify({
				id: "R999",
				head_sha: headSha,
				lifecycle_unit: "pr-309-current-state-refresh",
				pr_state_snapshot: {
					head_sha: headSha,
					pr: 309,
					status: "checks green",
				},
			}),
			"",
		].join("\n"),
	);
	writeFileSync(
		join(receiptsDir, "current-route.json"),
		JSON.stringify(
			{
				activeRoute: "fixture route",
				blockers: [{ code: "fixture_blocker" }],
				canonicalRefs: [
					".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md",
					".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md",
					"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
					".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md",
				],
				claimBoundaries: ["fixture claim boundary"],
				currentHeadSha: headSha,
				currentSlice: "fixture slice",
				goalSlug: "codex-runtime-evidence-verifier-cockpit",
				issueKey: "JSC-363",
				lastReceipt: "R999",
				schemaVersion: "goal-current-route/v1",
				status: "blocked",
			},
			null,
			2,
		),
	);
}

function writeAuditFreshnessValidator(repo: string) {
	writeFileSync(
		join(repo, "scripts/check-goal-audit-freshness.py"),
		[
			"#!/usr/bin/env python3",
			"from __future__ import annotations",
			"raise SystemExit(0)",
			"",
		].join("\n"),
	);
}

function writeGenericGoalMarkdown(goalDir: string) {
	writeFileSync(
		join(goalDir, "goal.md"),
		[
			"# Fixture Runtime Evidence Goal",
			"",
			"## Table of Contents",
			"",
			"- [Scope](#scope)",
			"",
			"## Scope",
			"",
		].join("\n"),
	);
}

function runtimeStateYaml(openPrCount: number) {
	return [
		"tasks:",
		'  - id: "T004"',
		'    type: "worker"',
		'    assignee: "Worker"',
		'    status: "active"',
		'    objective: "Fixture runtime route task."',
		'    receipt_id: "R999"',
		"thin_execution_tracker:",
		"  active_route:",
		'    kind: "github_pr"',
		'    active_branch: "codex/jsc-363-runtime-evidence-cockpit-refresh"',
		`    open_pr_count: ${openPrCount}`,
		"",
	].join("\n");
}

function runGoalBoard(repo: string, goalDir: string, validatorPath: string) {
	return spawnSync("python3", ["scripts/check-goal-board.py", goalDir], {
		cwd: repo,
		encoding: "utf8",
		env: {
			...process.env,
			GOAL_GOVERNOR_CHECK_BOARD: validatorPath,
			GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
			PYTHONDONTWRITEBYTECODE: "1",
		},
	});
}

function runGoalBoardWithoutExternalValidator(repo: string, goalDir: string) {
	return spawnSync("python3", ["scripts/check-goal-board.py", goalDir], {
		cwd: repo,
		encoding: "utf8",
		env: {
			...process.env,
			GOAL_GOVERNOR_CHECK_BOARD: "",
			GOAL_GOVERNOR_CHECK_GOAL_BOARD: "",
			HOME: join(repo, "home-without-agent-skills"),
			PYTHONDONTWRITEBYTECODE: "1",
		},
	});
}

function createRouteFixture(prefix: string, headSha: string, status: string) {
	const root = createTempRoot(prefix);
	const repo = join(root, "coding-harness");
	const scriptsDir = join(repo, "scripts");
	const goalDir = join(
		repo,
		"docs/goals/codex-runtime-evidence-verifier-cockpit",
	);
	const validatorPath = join(root, "check_goal_board.py");
	mkdirSync(scriptsDir, { recursive: true });
	mkdirSync(goalDir, { recursive: true });
	copyFileSync(SCRIPT_PATH, join(scriptsDir, "check-goal-board.py"));
	writeValidator(validatorPath, "goal-board");
	writeGenericGoalMarkdown(goalDir);
	writeRuntimeEvidenceReceipts(repo, headSha);
	writeRuntimeEvidenceActiveArtifacts(repo, activeArtifactsRow(status));
	writeAuditFreshnessValidator(repo);
	writeFileSync(join(goalDir, "state.yaml"), runtimeStateYaml(1));
	return { goalDir, repo, validatorPath };
}

describe("check-goal-board.py runtime route validation", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("passes when active artifacts include the latest route receipt head", () => {
		const fixture = createRouteFixture(
			"goal-board-current-pr-head-",
			"current-pr-head",
			"latest route head current-pr-head",
		);

		const result = runGoalBoard(
			fixture.repo,
			fixture.goalDir,
			fixture.validatorPath,
		);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain(`goal-board:${fixture.goalDir}`);
	});

	it("fails when a merged PR route still tells operators to merge the stale branch", () => {
		const fixture = createRouteFixture(
			"goal-board-stale-merged-route-",
			"merged-main-head",
			"merged-main-head | Next Safe Action: merge this post-PR384 blocker refresh",
		);
		writeFileSync(
			join(fixture.goalDir, "state.yaml"),
			runtimeStateYaml(0),
		);

		const result = runGoalBoard(
			fixture.repo,
			fixture.goalDir,
			fixture.validatorPath,
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("github_pr active_route");
		expect(result.stderr).toContain("open_pr_count: 0");
		expect(result.stderr).toContain("merge this post-PR");
	});

	it("parses runtime active_route through YAML rather than line regexes", () => {
		const fixture = createRouteFixture(
			"goal-board-yaml-active-route-",
			"merged-main-head",
			"merged-main-head",
		);
		writeFileSync(
			join(fixture.goalDir, "state.yaml"),
			[
				"tasks:",
				'  - id: "T004"',
				'    type: "worker"',
				'    assignee: "Worker"',
				'    status: "active"',
				'    objective: "Fixture runtime route task."',
				'    receipt_id: "R999"',
				"thin_execution_tracker:",
				"  active_route:",
				"    kind: 'github_pr' # single quotes and comment need YAML parsing",
				"    active_branch: 'codex/jsc-363-post-pr384-linear-blocker-refresh'",
				"    open_pr_count: 0",
				"",
			].join("\n"),
		);

		const result = runGoalBoard(
			fixture.repo,
			fixture.goalDir,
			fixture.validatorPath,
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("github_pr active_route");
		expect(result.stderr).toContain("open_pr_count: 0");
	});

	it("runs fallback generic validation before runtime extensions", () => {
		const fixture = createRouteFixture(
			"goal-board-missing-goal-local-fallback-",
			"current-pr-head",
			"latest route head current-pr-head",
		);
		rmSync(join(fixture.goalDir, "goal.md"));

		const result = runGoalBoardWithoutExternalValidator(
			fixture.repo,
			fixture.goalDir,
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing required files: goal.md");
		expect(result.stdout).not.toContain(`goal-board:${fixture.goalDir}`);
	});
});
