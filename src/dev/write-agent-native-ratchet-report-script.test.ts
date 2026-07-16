import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNodeScript } from "./script-test-utils.js";

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = join(
	REPO_ROOT,
	"scripts/write-agent-native-ratchet-report.cjs",
);
const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

function runReport(args: readonly string[] = []) {
	return runNodeScript(SCRIPT_PATH, args, { cwd: REPO_ROOT });
}

describe("write-agent-native-ratchet-report.cjs", () => {
	it("emits a passing ratchet report for the five agent-native ratchets", () => {
		const result = runReport(["--json", "--validate"]);
		const report = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			ratchets: Array<{
				id: string;
				status: string;
				command: string;
				nativeAuthority: string;
				sourceKind: string;
				mayClaim: string[];
				mustNotClaim: string[];
				evidencePaths: string[];
				claimBoundary: string;
			}>;
		};

		expect(result.status).toBe(0);
		expect(report.schemaVersion).toBe("agent-native-ratchets/v1");
		expect(report.status).toBe("pass");
		expect(report.ratchets.map((ratchet) => ratchet.id)).toEqual([
			"orientation_packet",
			"session_distillation",
			"agent_rework_loop",
			"reviewer_decision_contract",
			"governance_decision_surface",
		]);
		expect(report.ratchets.every((ratchet) => ratchet.status === "pass")).toBe(
			true,
		);
		expect(
			report.ratchets.every(
				(ratchet) =>
					ratchet.command.length > 0 &&
					ratchet.nativeAuthority === "harness" &&
					ratchet.mayClaim.length > 0 &&
					ratchet.mustNotClaim.includes("codex_context_current") &&
					ratchet.mustNotClaim.includes("codex_session_truth") &&
					ratchet.mustNotClaim.includes("connector_snapshot_current") &&
					ratchet.mustNotClaim.includes("sidecar_export_current") &&
					ratchet.mustNotClaim.includes("merge_ready") &&
					!ratchet.mayClaim.some((claim) =>
						ratchet.mustNotClaim.includes(claim),
					) &&
					ratchet.evidencePaths.length > 0 &&
					ratchet.claimBoundary.length > 0,
			),
		).toBe(true);
		expect(report.ratchets.map((ratchet) => ratchet.sourceKind)).toEqual([
			"repo_contract",
			"repo_worktree",
			"repo_artifact",
			"repo_artifact",
			"repo_artifact",
		]);
	});

	it("emits aggregate ratchets in downstream repos without source package scripts", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-downstream-"));
		tempRoots.push(root);
		writeFileSync(
			join(root, "package.json"),
			JSON.stringify({
				scripts: {
					"coding-policy:route": "harness coding-policy route",
				},
			}),
		);

		const result = runNodeScript(SCRIPT_PATH, ["--json", "--validate"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			status: string;
			ratchets: Array<{ command: string; status: string }>;
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.ratchets.map((ratchet) => ratchet.command)).toEqual([
			"harness next --json",
			"harness session-distill --json",
			"harness agent-rework --json",
			"harness reviewer-decision --json",
			"harness governance-decision-surface --json",
		]);
		expect(report.ratchets.every((ratchet) => ratchet.status === "pass")).toBe(
			true,
		);
	});

	it("emits a session distillation packet with separated claim boundaries", () => {
		const result = runReport(["--session-distill", "--json"]);
		const report = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			branch: string;
			headSha: string;
			worktreeStatus: string;
			changedFileCount: number;
			nativeAuthority: string;
			sourceKind: string;
			mayClaim: string[];
			mustNotClaim: string[];
			evidenceLanes: Array<{ id: string; status: string }>;
			nextCommands: string[];
			nonClaims: string[];
			claimBoundary: string;
		};

		expect(result.status).toBe(0);
		expect(report.schemaVersion).toBe("session-distill/v1");
		expect(report.status).toBe("pass");
		expect(report.branch.length).toBeGreaterThan(0);
		const gitHead = spawnSync("git", ["rev-parse", "HEAD"], {
			cwd: REPO_ROOT,
			encoding: "utf8",
		});
		expect(gitHead.status).toBe(0);
		expect(report.headSha).toMatch(/^[0-9a-f]{40}$/);
		expect(report.headSha).toBe(gitHead.stdout.trim());
		expect(["clean", "dirty"]).toContain(report.worktreeStatus);
		expect(report.changedFileCount).toBeGreaterThanOrEqual(0);
		expect(report.nativeAuthority).toBe("harness");
		expect(report.sourceKind).toBe("repo_worktree");
		expect(report.mayClaim).toEqual([
			"repo_handoff_orientation",
			"worktree_changed_files",
		]);
		expect(report.mustNotClaim).toEqual(
			expect.arrayContaining([
				"codex_context_current",
				"codex_session_truth",
				"connector_snapshot_current",
				"sidecar_export_current",
				"ci_passed",
				"review_threads_resolved",
				"tracker_closed",
				"merge_ready",
				"validation_passed",
			]),
		);
		expect(
			report.mayClaim.some((claim) => report.mustNotClaim.includes(claim)),
		).toBe(false);
		expect(report.evidenceLanes.map((lane) => lane.id)).toEqual([
			"worktree",
			"policy_route",
			"context_freshness",
			"validation",
			"external_readiness",
		]);
		expect(report.nextCommands).toContain("harness prompt-context-drift:write");
		expect(report.nextCommands).toContain(
			"harness prompt-context-drift:validate",
		);
		expect(report.nonClaims).toContain("merge_ready");
		expect(report.nonClaims).toContain("review_threads_resolved");
		expect(report.nonClaims).not.toContain("review_resolved");
		expect(report.claimBoundary).toContain("not validation");
	});

	it("includes untracked files without source-only session commands", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-session-distill-"));
		tempRoots.push(root);
		let result = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
		if (result.status !== 0) {
			throw new Error(`git init failed with status ${result.status}`);
		}
		result = spawnSync("git", ["config", "user.email", "codex@example.com"], {
			cwd: root,
			encoding: "utf8",
		});
		if (result.status !== 0) {
			throw new Error(
				`git config user.email failed with status ${result.status}`,
			);
		}
		result = spawnSync("git", ["config", "user.name", "Codex"], {
			cwd: root,
			encoding: "utf8",
		});
		if (result.status !== 0) {
			throw new Error(
				`git config user.name failed with status ${result.status}`,
			);
		}
		writeFileSync(join(root, "tracked.txt"), "tracked\n");
		result = spawnSync("git", ["add", "tracked.txt"], {
			cwd: root,
			encoding: "utf8",
		});
		if (result.status !== 0) {
			throw new Error(`git add failed with status ${result.status}`);
		}
		result = spawnSync("git", ["commit", "-m", "initial"], {
			cwd: root,
			encoding: "utf8",
		});
		if (result.status !== 0) {
			throw new Error(`git commit failed with status ${result.status}`);
		}
		writeFileSync(join(root, "new-file.txt"), "new\n");
		writeFileSync(join(root, "docs my file.md"), "new\n");
		writeFileSync(join(root, " spaced file.txt "), "new\n");
		writeFileSync(join(root, "line\nbreak.txt"), "new\n");

		result = runNodeScript(SCRIPT_PATH, ["--session-distill", "--json"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			changedFiles: string[];
			changedFileCount: number;
			nextCommands: string[];
		};

		expect(result.status).toBe(0);
		expect(report.changedFiles).toContain("new-file.txt");
		expect(report.changedFiles).toContain("docs my file.md");
		expect(report.changedFiles).toContain(" spaced file.txt ");
		expect(report.changedFiles).toContain("line\nbreak.txt");
		expect(report.changedFileCount).toBe(4);
		expect(report.nextCommands).toEqual([
			"harness prompt-context-drift:write",
			"harness prompt-context-drift:validate",
		]);
		expect(report.nextCommands.join("\n")).not.toContain("pnpm run");
	});

	it("ignores caller-scoped git environment when distilling session state", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-session-root-"));
		const contaminatingRoot = mkdtempSync(
			join(tmpdir(), "agent-native-contaminating-root-"),
		);
		tempRoots.push(root, contaminatingRoot);
		for (const repo of [root, contaminatingRoot]) {
			let result = spawnSync("git", ["init"], { cwd: repo, encoding: "utf8" });
			if (result.status !== 0) {
				throw new Error(`git init failed with status ${result.status}`);
			}
			result = spawnSync("git", ["config", "user.email", "codex@example.com"], {
				cwd: repo,
				encoding: "utf8",
			});
			if (result.status !== 0) {
				throw new Error(
					`git config user.email failed with status ${result.status}`,
				);
			}
			result = spawnSync("git", ["config", "user.name", "Codex"], {
				cwd: repo,
				encoding: "utf8",
			});
			if (result.status !== 0) {
				throw new Error(
					`git config user.name failed with status ${result.status}`,
				);
			}
			writeFileSync(join(repo, "tracked.txt"), "tracked\n");
			result = spawnSync("git", ["add", "tracked.txt"], {
				cwd: repo,
				encoding: "utf8",
			});
			if (result.status !== 0) {
				throw new Error(`git add failed with status ${result.status}`);
			}
			result = spawnSync("git", ["commit", "-m", "initial"], {
				cwd: repo,
				encoding: "utf8",
			});
			if (result.status !== 0) {
				throw new Error(`git commit failed with status ${result.status}`);
			}
		}
		writeFileSync(join(root, "actual-change.txt"), "actual\n");
		writeFileSync(join(contaminatingRoot, "wrong-change.txt"), "wrong\n");

		const result = runNodeScript(SCRIPT_PATH, ["--session-distill", "--json"], {
			cwd: root,
			env: {
				...process.env,
				GIT_DIR: join(contaminatingRoot, ".git"),
				GIT_WORK_TREE: contaminatingRoot,
			},
		});
		const report = JSON.parse(result.stdout) as { changedFiles: string[] };

		expect(result.status).toBe(0);
		expect(report.changedFiles).toContain("actual-change.txt");
		expect(report.changedFiles).not.toContain("wrong-change.txt");
	});

	it("fails closed when session distillation cannot read git state", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-session-no-git-"));
		tempRoots.push(root);

		const result = runNodeScript(SCRIPT_PATH, ["--session-distill", "--json"], {
			cwd: root,
		});

		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain(
			"session-distill requires git evidence for unstaged changed files",
		);
	});

	it("emits structured rework, reviewer, and governance ratchet packets", () => {
		const reworkResult = runReport(["--rework", "--json"]);
		expect(reworkResult.status).toBe(0);
		const rework = JSON.parse(reworkResult.stdout) as {
			schemaVersion: string;
			nativeAuthority: string;
			sourceKind: string;
			mayClaim: string[];
			mustNotClaim: string[];
			latestRun: { status: string };
			retryDecisions: string[];
		};
		const reviewerResult = runReport(["--reviewer-decision", "--json"]);
		expect(reviewerResult.status).toBe(0);
		const reviewer = JSON.parse(reviewerResult.stdout) as {
			schemaVersion: string;
			command: string;
			nativeAuthority: string;
			sourceKind: string;
			mayClaim: string[];
			mustNotClaim: string[];
			decision: string;
			outcomes: string[];
		};
		const governanceResult = runReport(["--governance", "--json"]);
		expect(governanceResult.status).toBe(0);
		const governance = JSON.parse(governanceResult.stdout) as {
			schemaVersion: string;
			classes: string[];
			nativeAuthority: string;
			sourceKind: string;
			mayClaim: string[];
			mustNotClaim: string[];
			documentsAnalyzed: number;
			classCounts: { feeds_runtime_decision: number };
			decisionInputs: Array<{ path: string; classes: string[] }>;
		};

		expect(rework.schemaVersion).toBe("agent-rework/v1");
		expect(rework.nativeAuthority).toBe("harness");
		expect(rework.sourceKind).toBe("repo_artifact");
		expect(rework.mayClaim).toEqual(["local_recovery_state"]);
		expect(rework.mustNotClaim).toEqual(
			expect.arrayContaining([
				"codex_context_current",
				"codex_session_truth",
				"connector_snapshot_current",
				"sidecar_export_current",
				"ci_passed",
				"review_threads_resolved",
				"tracker_closed",
				"merge_ready",
			]),
		);
		expect(["available", "unavailable"]).toContain(rework.latestRun.status);
		expect(rework.retryDecisions).toContain("retry");
		expect(reviewer.schemaVersion).toBe("reviewer-decision/v1");
		expect(reviewer.nativeAuthority).toBe("harness");
		expect(reviewer.sourceKind).toBe("repo_artifact");
		expect(reviewer.mayClaim).toEqual(["review_lane_decision"]);
		expect(reviewer.mustNotClaim).toEqual(
			expect.arrayContaining([
				"codex_context_current",
				"codex_session_truth",
				"connector_snapshot_current",
				"sidecar_export_current",
				"ci_passed",
				"review_threads_resolved",
				"tracker_closed",
				"merge_ready",
			]),
		);
		expect(reviewer.command).toBe(
			"harness reviewer-decision --manifest <manifest> --reviews-dir artifacts/reviews --json",
		);
		expect(reviewer.decision).toBe("needs_evidence");
		expect(reviewer.outcomes).toContain("needs_evidence");
		expect(governance.schemaVersion).toBe("governance-decision-surface/v1");
		expect(governance.nativeAuthority).toBe("harness");
		expect(governance.sourceKind).toBe("repo_artifact");
		expect(governance.mayClaim).toEqual(["governance_routing"]);
		expect(governance.mustNotClaim).toEqual(
			expect.arrayContaining([
				"codex_context_current",
				"codex_session_truth",
				"connector_snapshot_current",
				"sidecar_export_current",
				"ci_passed",
				"review_threads_resolved",
				"tracker_closed",
				"merge_ready",
			]),
		);
		expect(governance.classes).toContain("feeds_runtime_decision");
		expect(governance.documentsAnalyzed).toBeGreaterThan(0);
		expect(governance.classCounts.feeds_runtime_decision).toBeGreaterThan(0);
		expect(governance.decisionInputs.length).toBeGreaterThan(0);
		const firstDecisionInput = governance.decisionInputs[0];
		expect(firstDecisionInput).toBeDefined();
		expect(firstDecisionInput?.path.length).toBeGreaterThan(0);
	});

	it("keeps reviewer compatibility output after canonical projection", () => {
		const packageResult = spawnSync(
			"pnpm",
			["--silent", "run", "reviewer:decision"],
			{
				cwd: REPO_ROOT,
				encoding: "utf8",
			},
		);
		const cliResult = spawnSync(
			process.execPath,
			["--import", "tsx", "src/cli.ts", "reviewer-decision"],
			{
				cwd: REPO_ROOT,
				encoding: "utf8",
			},
		);

		if (packageResult.status !== 0) {
			throw new Error(
				`Package command failed with exit code ${packageResult.status}: ${packageResult.stderr}`,
			);
		}
		const packageReport = JSON.parse(packageResult.stdout) as {
			status: string;
			decision: string;
		};
		const cliReport = JSON.parse(cliResult.stdout) as {
			status: string;
			decision: string;
		};
		expect(packageResult.status).toBe(0);
		expect(packageReport).toMatchObject({
			status: "needs_evidence",
			decision: "needs_evidence",
		});
		expect(cliResult.status).toBe(0);
		expect(cliReport).toMatchObject({
			status: "needs_evidence",
			decision: "needs_evidence",
		});
		expect(cliResult.stderr).toBe("");
	});

	it("maps reviewer coverage receipts into typed reviewer decisions", () => {
		const root = mkdtempSync(join(REPO_ROOT, ".tmp-agent-native-reviewer-"));
		tempRoots.push(root);
		const reviewsDir = join(root, "reviews");
		mkdirSync(reviewsDir, { recursive: true });
		writeFileSync(
			join(root, "manifest.json"),
			JSON.stringify({
				requiredReviewers: [
					{
						role: "harness-product-code-reviewer",
						artifact: "product.md",
					},
				],
				synthesisStatus: "complete",
			}),
		);
		writeFileSync(
			join(reviewsDir, "product.md"),
			[
				"head_sha: 0123456789abcdef0123456789abcdef01234567",
				"WROTE: .tmp-agent-native-reviewer/reviews/product.md",
			].join("\n"),
		);

		const manifest = relative(REPO_ROOT, join(root, "manifest.json"));
		const reviews = relative(REPO_ROOT, reviewsDir);
		const result = runReport([
			"--reviewer-decision",
			"--json",
			"--manifest",
			manifest,
			"--reviews-dir",
			reviews,
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			decision: string;
			coverageReceipt: {
				status: string;
				requestedRoles: number;
				completedRoles: number;
				missingArtifacts: number;
			};
			claimBoundary: string;
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.decision).toBe("accept");
		expect(report.coverageReceipt).toMatchObject({
			status: "pass",
			requestedRoles: 1,
			completedRoles: 1,
			missingArtifacts: 0,
		});
		expect(report.claimBoundary).toContain("review-lane evidence");
	});

	it("accepts repo roots outside the caller working directory", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-repo-root-"));
		const callerRoot = mkdtempSync(join(tmpdir(), "agent-native-caller-"));
		tempRoots.push(root, callerRoot);
		const runRoot = join(root, ".harness", "runs", "20260621T220000Z-pass");
		mkdirSync(runRoot, { recursive: true });
		writeFileSync(
			join(runRoot, "summary.json"),
			JSON.stringify({
				runId: "20260621T220000Z-pass",
				overallStatus: "passed",
				failedGateId: null,
				freshVsResumed: "fresh",
			}),
		);

		const result = runNodeScript(
			SCRIPT_PATH,
			["--rework", "--json", "--repo-root", root],
			{ cwd: callerRoot },
		);
		const report = JSON.parse(result.stdout) as {
			status: string;
			latestRun: { status: string; runId?: string };
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.latestRun).toMatchObject({
			status: "available",
			runId: "20260621T220000Z-pass",
		});
	});

	it("resolves reviewer coverage validation from downstream repos", () => {
		const root = mkdtempSync(
			join(tmpdir(), "agent-native-reviewer-downstream-"),
		);
		tempRoots.push(root);
		const reviewsDir = join(root, "reviews");
		mkdirSync(reviewsDir, { recursive: true });
		writeFileSync(
			join(root, "manifest.json"),
			JSON.stringify({
				requiredReviewers: [
					{
						role: "harness-product-code-reviewer",
						artifact: "product.md",
					},
				],
				synthesisStatus: "complete",
			}),
		);
		writeFileSync(
			join(reviewsDir, "product.md"),
			[
				"head_sha: 0123456789abcdef0123456789abcdef01234567",
				"WROTE: reviews/product.md",
			].join("\n"),
		);

		const result = runNodeScript(
			SCRIPT_PATH,
			[
				"--reviewer-decision",
				"--json",
				"--validate",
				"--manifest",
				"manifest.json",
				"--reviews-dir",
				"reviews",
			],
			{ cwd: root },
		);
		const report = JSON.parse(result.stdout) as {
			status: string;
			decision: string;
			coverageReceipt: {
				status: string;
				completedRoles: number;
			};
		};

		expect(result.status).toBe(0);
		expect(report).toMatchObject({
			status: "pass",
			decision: "accept",
		});
		expect(report.coverageReceipt).toMatchObject({
			status: "pass",
			completedRoles: 1,
		});
	});

	it("summarizes latest verify-work run artifacts for rework routing", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-rework-"));
		tempRoots.push(root);
		const runRoot = join(root, ".harness", "runs", "20260621T220000Z-123");
		mkdirSync(join(runRoot, "gates"), { recursive: true });
		writeFileSync(
			join(runRoot, "summary.json"),
			JSON.stringify({
				runId: "20260621T220000Z-123",
				overallStatus: "failed",
				failedGateId: "lint",
				freshVsResumed: "fresh",
			}),
		);
		writeFileSync(
			join(runRoot, "gates", "lint.json"),
			JSON.stringify({
				gateId: "lint",
				status: "failed",
				failureClass: "contract_policy",
				nextAction: "fix contract/policy mismatch, then rerun from this gate",
			}),
		);

		const result = runNodeScript(SCRIPT_PATH, ["--rework", "--json"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			status: string;
			latestRun: {
				status: string;
				runId: string;
				overallStatus: string;
				failedGateId: string;
				gateCount: number;
				failedGates: Array<{ gateId: string; nextAction: string }>;
			};
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.latestRun).toMatchObject({
			status: "available",
			runId: "20260621T220000Z-123",
			overallStatus: "failed",
			failedGateId: "lint",
			gateCount: 1,
		});
		expect(report.latestRun.failedGates).toEqual([
			{
				gateId: "lint",
				status: "failed",
				failureClass: "contract_policy",
				nextAction: "fix contract/policy mismatch, then rerun from this gate",
			},
		]);
	});

	it("requires a readable verify-work summary before passing rework routing", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-rework-missing-"));
		tempRoots.push(root);
		mkdirSync(join(root, ".harness", "runs", "20260621T220000Z-empty"), {
			recursive: true,
		});

		const result = runNodeScript(SCRIPT_PATH, ["--rework", "--json"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			status: string;
			latestRun: { status: string; reason: string };
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("needs_evidence");
		expect(report.latestRun).toMatchObject({
			status: "unavailable",
			reason: "latest verify-work run summary is missing or invalid",
		});
	});

	it("requires the referenced failed gate ledger before passing rework routing", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-rework-no-gate-"));
		tempRoots.push(root);
		const runRoot = join(root, ".harness", "runs", "20260621T220000Z-missing");
		mkdirSync(join(runRoot, "gates"), { recursive: true });
		writeFileSync(
			join(runRoot, "summary.json"),
			JSON.stringify({
				runId: "20260621T220000Z-missing",
				overallStatus: "failed",
				failedGateId: "lint",
				freshVsResumed: "fresh",
			}),
		);

		const result = runNodeScript(SCRIPT_PATH, ["--rework", "--json"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			status: string;
			latestRun: { status: string; reason: string; failedGateId?: string };
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("needs_evidence");
		expect(report.latestRun).toMatchObject({
			status: "unavailable",
			reason: "latest verify-work failed gate ledger is missing or invalid",
		});
		expect(report.latestRun).not.toHaveProperty("failedGateId");

		const validatingResult = runNodeScript(
			SCRIPT_PATH,
			["--rework", "--json", "--validate"],
			{ cwd: root },
		);
		const validatingReport = JSON.parse(validatingResult.stdout) as {
			latestRun: { status: string; reason: string; failedGateId?: string };
		};
		expect(validatingResult.status).toBe(1);
		expect(validatingReport.latestRun).toEqual({
			status: "unavailable",
			reason: "latest verify-work failed gate ledger is missing or invalid",
		});
	});

	it("requires failed gate ledgers to include repair routing fields", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-rework-bad-gate-"));
		tempRoots.push(root);
		const runRoot = join(root, ".harness", "runs", "20260621T220000Z-bad");
		mkdirSync(join(runRoot, "gates"), { recursive: true });
		writeFileSync(
			join(runRoot, "summary.json"),
			JSON.stringify({
				runId: "20260621T220000Z-bad",
				overallStatus: "failed",
				failedGateId: "lint",
				freshVsResumed: "fresh",
			}),
		);
		writeFileSync(
			join(runRoot, "gates", "lint.json"),
			JSON.stringify({
				gateId: "lint",
				status: "failed",
				failureClass: "contract_policy",
			}),
		);

		const result = runNodeScript(SCRIPT_PATH, ["--rework", "--json"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			status: string;
			latestRun: { status: string; reason: string; failedGateId?: string };
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("needs_evidence");
		expect(report.latestRun).toEqual({
			status: "unavailable",
			reason: "latest verify-work failed gate ledger is missing or invalid",
		});
	});

	it("requires failed gate summaries to name failed ledgers", () => {
		const root = mkdtempSync(join(tmpdir(), "agent-native-rework-no-id-"));
		tempRoots.push(root);
		const runRoot = join(root, ".harness", "runs", "20260621T220000Z-no-id");
		mkdirSync(join(runRoot, "gates"), { recursive: true });
		writeFileSync(
			join(runRoot, "summary.json"),
			JSON.stringify({
				runId: "20260621T220000Z-no-id",
				overallStatus: "failed",
				failedGateId: null,
				freshVsResumed: "fresh",
			}),
		);
		writeFileSync(
			join(runRoot, "gates", "lint.json"),
			JSON.stringify({
				gateId: "lint",
				status: "failed",
				failureClass: "contract_policy",
				nextAction: "fix contract/policy mismatch, then rerun from this gate",
			}),
		);

		const result = runNodeScript(SCRIPT_PATH, ["--rework", "--json"], {
			cwd: root,
		});
		const report = JSON.parse(result.stdout) as {
			status: string;
			latestRun: { status: string; reason: string; failedGateId?: string };
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("needs_evidence");
		expect(report.latestRun).toEqual({
			status: "unavailable",
			reason: "latest verify-work failed gate summary is missing failedGateId",
		});
	});

	it("rejects unknown arguments without echoing user input", () => {
		const result = runReport(["--unknown-secret-token=value"]);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("agent-native-ratchets: failed");
		expect(result.stderr).not.toContain("unknown-secret-token");
	});

	it("accepts package-script argument delimiters", () => {
		const result = runReport([
			"--reviewer-decision",
			"--json",
			"--",
			"--manifest",
			".tmp-does-not-exist",
		]);
		const report = JSON.parse(result.stdout) as {
			decision: string;
			coverageReceipt: { blockerClass: string };
		};

		expect(result.status).toBe(0);
		expect(report.decision).toBe("needs_evidence");
		expect(report.coverageReceipt.blockerClass).toBe("missing_manifest");
	});
});
