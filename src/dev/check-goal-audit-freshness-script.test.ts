import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/check-goal-audit-freshness.py",
);
const GOAL_DIR = "docs/goals/codex-runtime-evidence-verifier-cockpit";
const AUDIT_PATH =
	".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md";

const tempRoots: string[] = [];
const tempRootHeads = new Map<string, string>();

function runGit(root: string, args: string[]) {
	const result = spawnSync("git", args, {
		cwd: root,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_EMAIL: "codex@example.test",
			GIT_AUTHOR_NAME: "Codex Test",
			GIT_COMMITTER_EMAIL: "codex@example.test",
			GIT_COMMITTER_NAME: "Codex Test",
		},
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout);
	}
	return result.stdout.trim();
}

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	mkdirSync(join(root, GOAL_DIR), { recursive: true });
	mkdirSync(join(root, AUDIT_PATH, ".."), { recursive: true });
	runGit(root, ["init", "-q"]);
	runGit(root, ["commit", "--allow-empty", "-m", "baseline"]);
	tempRootHeads.set(root, runGit(root, ["rev-parse", "HEAD"]));
	return root;
}

function sha256(content: string) {
	return createHash("sha256").update(content).digest("hex");
}

function writeAudit(root: string, content: string, mtime: Date) {
	const path = join(root, AUDIT_PATH);
	writeFileSync(path, content);
	utimesSync(path, mtime, mtime);
	return path;
}

function writeReceipts(root: string, receipts: unknown[]) {
	const path = join(root, GOAL_DIR, "receipts.jsonl");
	writeFileSync(
		path,
		receipts.map((receipt) => JSON.stringify(receipt)).join("\n"),
	);
	return path;
}

function receipt(root: string, overrides: Record<string, unknown> = {}) {
	const content = "audit content";
	const headSha = tempRootHeads.get(root);
	if (!headSha) throw new Error(`missing test repository head for ${root}`);
	return {
		id: "R072",
		created_at: "2026-05-27T01:05:00Z",
		head_sha: headSha,
		audit_sources_checked: [
			{
				path: AUDIT_PATH,
				sha256: sha256(content),
				checked_at: "2026-05-27T01:10:00Z",
				head_sha: headSha,
				...overrides,
			},
		],
	};
}

function runValidator(root: string, extraArgs: string[] = []) {
	return spawnSync(
		"python3",
		[SCRIPT_PATH, join(root, GOAL_DIR), "--repo", root, ...extraArgs],
		{
			encoding: "utf8",
			env: {
				...process.env,
				PYTHONDONTWRITEBYTECODE: "1",
			},
		},
	);
}

describe("check-goal-audit-freshness.py", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
			tempRootHeads.delete(root);
		}
	});

	it("passes when the latest matching audit source records the current hash and head", () => {
		const root = createTempRoot("audit-freshness-pass-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [
			{
				id: "R071",
				head_sha: tempRootHeads.get(root),
				audit_sources_checked: [
					{
						path: AUDIT_PATH,
						sha256: "0".repeat(64),
						checked_at: "2026-05-27T00:00:00Z",
						head_sha: tempRootHeads.get(root),
					},
				],
			},
			receipt(root),
		]);

		const result = runValidator(root);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain('"status": "pass"');
		expect(result.stdout).toContain('"receipt_id": "R072"');
	});

	it("accepts uppercase hex commit SHAs as the same current head", () => {
		const root = createTempRoot("audit-freshness-uppercase-head-");
		const headSha = tempRootHeads.get(root);
		if (!headSha) throw new Error("missing test repository head");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		const storedReceipt = receipt(root);
		storedReceipt.head_sha = headSha.toUpperCase();
		const [storedSource] = storedReceipt.audit_sources_checked;
		if (!storedSource) throw new Error("missing generated audit source");
		storedSource.head_sha = headSha.toUpperCase();
		writeReceipts(root, [storedReceipt]);

		const result = runValidator(root);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({ head_sha: headSha });
	});

	it("accepts a receipt-only goal evidence commit that records its parent head", () => {
		const root = createTempRoot("audit-freshness-self-referential-");
		const parentHead = tempRootHeads.get(root);
		if (!parentHead) throw new Error("missing test repository head");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root)]);
		mkdirSync(join(root, ".harness"), { recursive: true });
		writeFileSync(
			join(root, ".harness/active-artifacts.md"),
			"route evidence\n",
		);
		runGit(root, [
			"add",
			join(GOAL_DIR, "receipts.jsonl"),
			".harness/active-artifacts.md",
		]);
		runGit(root, ["commit", "-m", "record receipt"]);

		const result = runValidator(root);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			head_sha: parentHead,
			receipt_id: "R072",
		});
	});

	it("accepts a self-referential receipt when all changed files are declared", () => {
		const root = createTempRoot("audit-freshness-declared-self-ref-");
		const parentHead = tempRootHeads.get(root);
		if (!parentHead) throw new Error("missing test repository head");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		mkdirSync(join(root, "scripts"), { recursive: true });
		const storedReceipt = {
			...receipt(root),
			changed_files: [
				join(GOAL_DIR, "receipts.jsonl"),
				"scripts/check-goal-audit-freshness.py",
			],
		};
		writeReceipts(root, [storedReceipt]);
		writeFileSync(
			join(root, "scripts/check-goal-audit-freshness.py"),
			"# validator repair\n",
		);
		runGit(root, [
			"add",
			join(GOAL_DIR, "receipts.jsonl"),
			"scripts/check-goal-audit-freshness.py",
		]);
		runGit(root, ["commit", "-m", "repair validator"]);

		const result = runValidator(root);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			head_sha: parentHead,
			receipt_id: "R072",
		});
	});

	it("accepts a shallow self-referential receipt checkout when declared files are goal-route evidence only", () => {
		const root = createTempRoot("audit-freshness-shallow-source-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		runGit(root, ["add", AUDIT_PATH]);
		runGit(root, ["commit", "-m", "record audit baseline"]);
		const parentHead = runGit(root, ["rev-parse", "HEAD"]);
		tempRootHeads.set(root, parentHead);
		writeReceipts(root, [
			{
				...receipt(root),
				changed_files: [
					".harness/active-artifacts.md",
					".harness/implementation-notes/goal-kanban-board.html",
					join(GOAL_DIR, "goal.md"),
					join(GOAL_DIR, "receipts.jsonl"),
					join(GOAL_DIR, "state.yaml"),
					"scripts/check-goal-audit-freshness.py",
				],
			},
		]);
		mkdirSync(join(root, ".harness"), { recursive: true });
		mkdirSync(join(root, ".harness/implementation-notes"), { recursive: true });
		mkdirSync(join(root, "scripts"), { recursive: true });
		writeFileSync(join(root, ".harness/active-artifacts.md"), "route\n");
		writeFileSync(
			join(root, ".harness/implementation-notes/goal-kanban-board.html"),
			"<main>route</main>\n",
		);
		writeFileSync(join(root, GOAL_DIR, "goal.md"), "# Goal route\n");
		writeFileSync(join(root, GOAL_DIR, "state.yaml"), "status: route\n");
		writeFileSync(
			join(root, "scripts/check-goal-audit-freshness.py"),
			"# guard\n",
		);
		runGit(root, [
			"add",
			".harness/active-artifacts.md",
			".harness/implementation-notes/goal-kanban-board.html",
			join(GOAL_DIR, "goal.md"),
			join(GOAL_DIR, "receipts.jsonl"),
			join(GOAL_DIR, "state.yaml"),
			"scripts/check-goal-audit-freshness.py",
		]);
		runGit(root, ["commit", "-m", "record self-referential route"]);
		const cloneParent = mkdtempSync(
			join(tmpdir(), "audit-freshness-shallow-clone-"),
		);
		tempRoots.push(cloneParent);
		const cloneRoot = join(cloneParent, "clone");
		const clone = spawnSync(
			"git",
			["clone", "--depth", "1", `file://${root}`, cloneRoot],
			{ encoding: "utf8" },
		);
		if (clone.status !== 0) throw new Error(clone.stderr || clone.stdout);
		utimesSync(
			join(cloneRoot, AUDIT_PATH),
			new Date("2026-05-27T01:00:00Z"),
			new Date("2026-05-27T01:00:00Z"),
		);

		const result = runValidator(cloneRoot);

		expect(result.status, result.stderr).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			head_relation: "non_ancestor_tree_diff",
			head_sha: parentHead,
			receipt_id: "R072",
		});
	});

	it("rejects a shallow self-referential receipt when the real fetched diff includes non-goal files", () => {
		const root = createTempRoot("audit-freshness-shallow-non-goal-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		runGit(root, ["add", AUDIT_PATH]);
		runGit(root, ["commit", "-m", "record audit baseline"]);
		tempRootHeads.set(root, runGit(root, ["rev-parse", "HEAD"]));
		writeReceipts(root, [
			{
				...receipt(root),
				changed_files: [
					".harness/active-artifacts.md",
					join(GOAL_DIR, "receipts.jsonl"),
					join(GOAL_DIR, "state.yaml"),
				],
			},
		]);
		mkdirSync(join(root, ".harness"), { recursive: true });
		writeFileSync(join(root, ".harness/active-artifacts.md"), "route\n");
		writeFileSync(join(root, GOAL_DIR, "state.yaml"), "status: route\n");
		writeFileSync(join(root, "source.ts"), "export const changed = true;\n");
		runGit(root, [
			"add",
			".harness/active-artifacts.md",
			join(GOAL_DIR, "receipts.jsonl"),
			join(GOAL_DIR, "state.yaml"),
			"source.ts",
		]);
		runGit(root, ["commit", "-m", "record mixed route and source changes"]);
		const cloneParent = mkdtempSync(
			join(tmpdir(), "audit-freshness-shallow-non-goal-clone-"),
		);
		tempRoots.push(cloneParent);
		const cloneRoot = join(cloneParent, "clone");
		const clone = spawnSync(
			"git",
			["clone", "--depth", "1", `file://${root}`, cloneRoot],
			{ encoding: "utf8" },
		);
		if (clone.status !== 0) throw new Error(clone.stderr || clone.stdout);
		utimesSync(
			join(cloneRoot, AUDIT_PATH),
			new Date("2026-05-27T01:00:00Z"),
			new Date("2026-05-27T01:00:00Z"),
		);

		const result = runValidator(cloneRoot);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"receipt.head_sha must match current repository HEAD",
		);
	});

	it("rejects a stale receipt head when non-goal files changed afterward", () => {
		const root = createTempRoot("audit-freshness-stale-non-goal-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root)]);
		writeFileSync(join(root, "source.ts"), "export const changed = true;\n");
		runGit(root, ["add", join(GOAL_DIR, "receipts.jsonl"), "source.ts"]);
		runGit(root, ["commit", "-m", "change source"]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"receipt.head_sha must match current repository HEAD",
		);
	});

	it("fails when the current audit content no longer matches the latest relevant receipt hash", () => {
		const root = createTempRoot("audit-freshness-stale-hash-");
		writeAudit(root, "updated audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root)]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("audit sha256 is stale");
	});

	it("ignores checkout mtimes because git rewrites filesystem timestamps", () => {
		const root = createTempRoot("audit-freshness-checkout-mtime-");
		writeAudit(root, "audit content", new Date("2026-05-27T02:00:00Z"));
		writeReceipts(root, [receipt(root)]);

		const result = runValidator(root);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain('"status": "pass"');
	});

	it("fails when checked_at predates the receipt creation time", () => {
		const root = createTempRoot("audit-freshness-before-receipt-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		const staleReceipt = receipt(root);
		staleReceipt.created_at = "2026-05-27T01:15:00Z";
		writeReceipts(root, [staleReceipt]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"checked_at must be at or after receipt.created_at",
		);
	});

	it("fails when checked_at is implausibly in the future", () => {
		const root = createTempRoot("audit-freshness-future-check-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [
			receipt(root, {
				checked_at: "2999-01-01T00:00:00Z",
			}),
		]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("checked_at must not be in the future");
	});

	it("fails when no receipt mentions the governed audit path", () => {
		const root = createTempRoot("audit-freshness-missing-source-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [
			{
				id: "R072",
				head_sha: tempRootHeads.get(root),
				audit_sources_checked: [
					{
						path: ".harness/research/audits/other.md",
						sha256: sha256("audit content"),
						checked_at: "2026-05-27T01:10:00Z",
						head_sha: tempRootHeads.get(root),
					},
				],
			},
		]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("no audit_sources_checked entry found");
	});

	it("fails when required-mode validation is pointed at an alternate audit path", () => {
		const root = createTempRoot("audit-freshness-alternate-path-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root)]);

		const result = runValidator(root, [
			"--audit",
			".harness/research/audits/other.md",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("--audit must be the governed audit path");
	});

	it("fails when receipt source paths use non-canonical syntax", () => {
		const root = createTempRoot("audit-freshness-noncanonical-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root, { path: `./${AUDIT_PATH}` })]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("must be a canonical repo-relative path");
	});

	it("fails when the audit source omits required provenance fields", () => {
		const root = createTempRoot("audit-freshness-missing-fields-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		const incomplete = receipt(root);
		delete (incomplete.audit_sources_checked[0] as Record<string, unknown>)
			.head_sha;
		writeReceipts(root, [incomplete]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing required field(s): head_sha");
	});

	it("fails when the recorded evidence head is not reachable from repository history", () => {
		const root = createTempRoot("audit-freshness-unreachable-head-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		const staleReceipt = receipt(root);
		staleReceipt.head_sha = "f".repeat(40);
		const staleSource = staleReceipt.audit_sources_checked[0];
		if (!staleSource) throw new Error("missing test audit source");
		staleSource.head_sha = "f".repeat(40);
		writeReceipts(root, [staleReceipt]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"must be reachable from current repository HEAD",
		);
	});

	it("accepts a non-ancestor review checkout when the tree is equivalent", () => {
		const root = createTempRoot("audit-freshness-equivalent-review-");
		const recordedHead = tempRootHeads.get(root);
		if (!recordedHead) throw new Error("missing test repository head");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root)]);
		const syntheticReviewHead = runGit(root, [
			"commit-tree",
			`${recordedHead}^{tree}`,
			"-m",
			"synthetic review",
		]);
		runGit(root, ["checkout", "-q", syntheticReviewHead]);

		const result = runValidator(root);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			head_relation: "tree_equivalent",
			head_sha: recordedHead,
		});
	});

	it("rejects a non-ancestor review checkout when the tree differs", () => {
		const root = createTempRoot("audit-freshness-different-review-");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [receipt(root)]);
		runGit(root, ["checkout", "--orphan", "synthetic-review"]);
		writeFileSync(join(root, "source.ts"), "export const changed = true;\n");
		runGit(root, ["add", "source.ts"]);
		runGit(root, ["commit", "-m", "synthetic review"]);

		const result = runValidator(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"receipt.head_sha must match current repository HEAD",
		);
	});

	it("accepts a synthetic self-referential receipt checkout when changed files are declared", () => {
		const root = createTempRoot("audit-freshness-synthetic-self-ref-");
		const recordedHead = tempRootHeads.get(root);
		if (!recordedHead) throw new Error("missing test repository head");
		writeAudit(root, "audit content", new Date("2026-05-27T01:00:00Z"));
		writeReceipts(root, [
			{
				...receipt(root),
				changed_files: [join(GOAL_DIR, "receipts.jsonl")],
			},
		]);
		runGit(root, ["add", join(GOAL_DIR, "receipts.jsonl")]);
		runGit(root, ["commit", "-m", "record receipt"]);
		const receiptCommit = runGit(root, ["rev-parse", "HEAD"]);
		const syntheticReviewHead = runGit(root, [
			"commit-tree",
			`${receiptCommit}^{tree}`,
			"-m",
			"synthetic review",
		]);
		runGit(root, ["checkout", "-q", syntheticReviewHead]);

		const result = runValidator(root);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			head_relation: "non_ancestor_tree_diff",
			head_sha: recordedHead,
		});
	});
});
