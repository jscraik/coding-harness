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
					ratchet.evidencePaths.length > 0 &&
					ratchet.claimBoundary.length > 0,
			),
		).toBe(true);
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
			ratchets: Array<{ status: string }>;
		};

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
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
			evidenceLanes: Array<{ id: string; status: string }>;
			nextCommands: string[];
			nonClaims: string[];
			claimBoundary: string;
		};

		expect(result.status).toBe(0);
		expect(report.schemaVersion).toBe("session-distill/v1");
		expect(report.status).toBe("pass");
		expect(report.branch.length).toBeGreaterThan(0);
		expect(report.headSha.length).toBeGreaterThan(0);
		expect(["clean", "dirty"]).toContain(report.worktreeStatus);
		expect(report.changedFileCount).toBeGreaterThanOrEqual(0);
		expect(report.evidenceLanes.map((lane) => lane.id)).toEqual([
			"worktree",
			"policy_route",
			"context_freshness",
			"validation",
			"external_readiness",
		]);
		expect(report.nextCommands).toContain(
			"pnpm run prompt-context-drift:write",
		);
		expect(report.nonClaims).toContain("merge_ready");
		expect(report.claimBoundary).toContain("not validation");
	});

	it("includes untracked files in session distillation changed-file routing", () => {
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
		expect(report.changedFileCount).toBe(2);
		expect(report.nextCommands[0]).toBe(
			"pnpm run coding-policy:route -- 'docs my file.md' 'new-file.txt'",
		);
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
			latestRun: { status: string };
			retryDecisions: string[];
		};
		const reviewerResult = runReport(["--reviewer-decision", "--json"]);
		expect(reviewerResult.status).toBe(0);
		const reviewer = JSON.parse(reviewerResult.stdout) as {
			schemaVersion: string;
			decision: string;
			outcomes: string[];
		};
		const governanceResult = runReport(["--governance", "--json"]);
		expect(governanceResult.status).toBe(0);
		const governance = JSON.parse(governanceResult.stdout) as {
			schemaVersion: string;
			classes: string[];
			documentsAnalyzed: number;
			classCounts: { feeds_runtime_decision: number };
			decisionInputs: Array<{ path: string; classes: string[] }>;
		};

		expect(rework.schemaVersion).toBe("agent-rework/v1");
		expect(["available", "unavailable"]).toContain(rework.latestRun.status);
		expect(rework.retryDecisions).toContain("retry");
		expect(reviewer.schemaVersion).toBe("reviewer-decision/v1");
		expect(reviewer.decision).toBe("needs_evidence");
		expect(reviewer.outcomes).toContain("needs_evidence");
		expect(governance.schemaVersion).toBe("governance-decision-surface/v1");
		expect(governance.classes).toContain("feeds_runtime_decision");
		expect(governance.documentsAnalyzed).toBeGreaterThan(0);
		expect(governance.classCounts.feeds_runtime_decision).toBeGreaterThan(0);
		expect(governance.decisionInputs.length).toBeGreaterThan(0);
		const firstDecisionInput = governance.decisionInputs[0];
		expect(firstDecisionInput).toBeDefined();
		expect(firstDecisionInput?.path.length).toBeGreaterThan(0);
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
