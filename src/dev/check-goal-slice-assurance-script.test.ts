import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/check-goal-slice-assurance.py",
);
const HEAD_SHA = "29ac20979f21bc178358779e0bc50d8ddc0eee75";
const RECEIPT_ID = "R071";
const LIFECYCLE_UNIT = "PU-016-slice-assurance-validator";
const skillMembers = [
	"improve-codebase-architecture",
	"simplify",
	"unslopify",
	"he-code-review",
	"testing",
] as const;
const reviewerMembers = [
	"adversarial-reviewer",
	"agent-native-reviewer",
	"best-practices-researcher",
] as const;

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

function writeArtifact(root: string, path: string, content = "evidence") {
	mkdirSync(join(root, path, ".."), { recursive: true });
	writeFileSync(join(root, path), content);
}

function passResult(member: string, evidenceRef: string) {
	return {
		status: "pass",
		role: member,
		producer: member,
		receipt_id: RECEIPT_ID,
		lifecycle_unit: LIFECYCLE_UNIT,
		head_sha: HEAD_SHA,
		freshness: "current",
		evidence_ref: evidenceRef,
	};
}

function exceptionResult(
	member: string,
	evidenceRef: string,
	status = "blocked",
) {
	return {
		status,
		reason: `${member} unavailable in fixture`,
		owner: "Coordinator",
		accepted_exception_ref: evidenceRef,
	};
}

function baseReceipt() {
	const changedFiles: string[] = [];
	const skillResults: Record<string, unknown> = {};
	const reviewerResults: Record<string, unknown> = {};
	for (const member of skillMembers) {
		const evidenceRef = `artifacts/reviews/${member}.md`;
		changedFiles.push(evidenceRef);
		skillResults[member] = passResult(member, evidenceRef);
	}
	for (const member of reviewerMembers) {
		const evidenceRef = `artifacts/reviews/${member}.md`;
		changedFiles.push(evidenceRef);
		reviewerResults[member] = passResult(member, evidenceRef);
	}
	return {
		id: RECEIPT_ID,
		task_id: "T004",
		lifecycle_unit: LIFECYCLE_UNIT,
		head_sha: HEAD_SHA,
		changed_files: changedFiles,
		slice_skill_lens_results: skillResults,
		independent_reviewer_results: reviewerResults,
	};
}

function writeReceipt(
	root: string,
	receipt: unknown,
	extraReceipts: unknown[] = [],
) {
	const receiptsPath = join(root, "receipts.jsonl");
	writeFileSync(
		receiptsPath,
		[receipt, ...extraReceipts]
			.map((entry) => JSON.stringify(entry))
			.join("\n"),
	);
	return receiptsPath;
}

function writeReceiptArtifacts(
	root: string,
	receipt: ReturnType<typeof baseReceipt>,
) {
	for (const entry of receipt.changed_files) {
		writeArtifact(root, entry);
	}
}

function runValidator(root: string, receiptsPath: string) {
	return spawnSync(
		"python3",
		[SCRIPT_PATH, receiptsPath, "--receipt-id", RECEIPT_ID, "--repo", root],
		{
			encoding: "utf8",
			env: {
				...process.env,
				PYTHONDONTWRITEBYTECODE: "1",
			},
		},
	);
}

describe("check-goal-slice-assurance.py", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("passes when all required skill lenses and reviewers have receipt-bound evidence", () => {
		const root = createTempRoot("slice-assurance-pass-");
		const receipt = baseReceipt();
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"status": "pass"');
	});

	it("fails when a required skill lens is missing", () => {
		const root = createTempRoot("slice-assurance-missing-skill-");
		const receipt = baseReceipt();
		delete receipt.slice_skill_lens_results.testing;
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"slice_skill_lens_results missing required member(s): testing",
		);
	});

	it("fails when required member evidence is a string instead of a structured object", () => {
		const root = createTempRoot("slice-assurance-string-map-");
		const receipt = baseReceipt();
		receipt.independent_reviewer_results["agent-native-reviewer"] = "pass";
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"independent_reviewer_results.agent-native-reviewer must be a structured object",
		);
	});

	it("fails when pass evidence is not current or not listed in changed_files", () => {
		const root = createTempRoot("slice-assurance-stale-");
		const receipt = baseReceipt();
		const testing = receipt.slice_skill_lens_results.testing as Record<
			string,
			string
		>;
		testing.freshness = "stale";
		testing.evidence_ref = "artifacts/reviews/testing-not-listed.md";
		writeReceiptArtifacts(root, receipt);
		writeArtifact(root, "artifacts/reviews/testing-not-listed.md");
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"slice_skill_lens_results.testing.freshness must be current",
		);
	});

	it("fails when pass evidence is not listed in changed_files", () => {
		const root = createTempRoot("slice-assurance-not-listed-");
		const receipt = baseReceipt();
		const testing = receipt.slice_skill_lens_results.testing as Record<
			string,
			string
		>;
		testing.evidence_ref = "artifacts/reviews/testing-not-listed.md";
		writeReceiptArtifacts(root, receipt);
		writeArtifact(root, "artifacts/reviews/testing-not-listed.md");
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"slice_skill_lens_results.testing.evidence_ref must be listed in changed_files",
		);
	});

	it("fails on duplicate receipt ids", () => {
		const root = createTempRoot("slice-assurance-duplicate-");
		const receipt = baseReceipt();
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt, [receipt]);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("duplicate receipt id(s): R071");
	});

	it("fails when pass evidence is reused across required members", () => {
		const root = createTempRoot("slice-assurance-reuse-");
		const receipt = baseReceipt();
		const reused = "artifacts/reviews/reused.md";
		receipt.changed_files.push(reused);
		receipt.slice_skill_lens_results.simplify = passResult("simplify", reused);
		receipt.slice_skill_lens_results.unslopify = passResult(
			"unslopify",
			reused,
		);
		writeReceiptArtifacts(root, receipt);
		writeArtifact(root, reused);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("evidence_ref reuses evidence");
	});

	it("fails when evidence refs use lexical aliases", () => {
		const root = createTempRoot("slice-assurance-lexical-alias-");
		const receipt = baseReceipt();
		const testing = receipt.slice_skill_lens_results.testing as Record<
			string,
			string
		>;
		testing.evidence_ref = "./artifacts/reviews/testing.md";
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("must be a canonical repo-relative path");
	});

	it("fails when evidence refs are absolute, traversal, or symlink escapes", () => {
		const absoluteRoot = createTempRoot("slice-assurance-absolute-");
		const absoluteReceipt = baseReceipt();
		const testingAbsolute = absoluteReceipt.slice_skill_lens_results
			.testing as Record<string, string>;
		testingAbsolute.evidence_ref = join(
			absoluteRoot,
			"artifacts/reviews/testing.md",
		);
		writeReceiptArtifacts(absoluteRoot, absoluteReceipt);
		let result = runValidator(
			absoluteRoot,
			writeReceipt(absoluteRoot, absoluteReceipt),
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("must be repo-relative");

		const traversalRoot = createTempRoot("slice-assurance-traversal-");
		const traversalReceipt = baseReceipt();
		const testingTraversal = traversalReceipt.slice_skill_lens_results
			.testing as Record<string, string>;
		testingTraversal.evidence_ref = "../outside.md";
		writeReceiptArtifacts(traversalRoot, traversalReceipt);
		result = runValidator(
			traversalRoot,
			writeReceipt(traversalRoot, traversalReceipt),
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("path traversal");

		const symlinkRoot = createTempRoot("slice-assurance-symlink-");
		const outsideRoot = createTempRoot("slice-assurance-outside-");
		writeArtifact(outsideRoot, "outside.md");
		const symlinkReceipt = baseReceipt();
		const symlinkRef = "artifacts/reviews/escaped.md";
		const testingSymlink = symlinkReceipt.slice_skill_lens_results
			.testing as Record<string, string>;
		testingSymlink.evidence_ref = symlinkRef;
		symlinkReceipt.changed_files.push(symlinkRef);
		writeReceiptArtifacts(symlinkRoot, symlinkReceipt);
		rmSync(join(symlinkRoot, symlinkRef));
		symlinkSync(join(outsideRoot, "outside.md"), join(symlinkRoot, symlinkRef));
		result = runValidator(
			symlinkRoot,
			writeReceipt(symlinkRoot, symlinkReceipt),
		);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("escapes repository root");
	});

	it("fails when blocked or not applicable members have neither owner nor accepted exception", () => {
		const root = createTempRoot("slice-assurance-blocked-");
		const receipt = baseReceipt();
		receipt.independent_reviewer_results["best-practices-researcher"] = {
			status: "not applicable",
			reason: "not available",
		};
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("requires owner or accepted_exception_ref");
	});

	it.each([
		"blocked",
		"fail",
		"not applicable",
	])("allows %s members with owner, reason, and accepted exception evidence", (status) => {
		const root = createTempRoot(
			`slice-assurance-${status.replaceAll(" ", "-")}-exception-`,
		);
		const receipt = baseReceipt();
		const exceptionRef = `artifacts/reviews/best-practices-${status.replaceAll(" ", "-")}-exception.md`;
		receipt.changed_files.push(exceptionRef);
		receipt.independent_reviewer_results["best-practices-researcher"] =
			exceptionResult("best-practices-researcher", exceptionRef, status);
		writeReceiptArtifacts(root, receipt);
		writeArtifact(root, exceptionRef);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"receipt_id": "R071"');
	});

	it("fails when accepted exception evidence reuses another member artifact", () => {
		const root = createTempRoot("slice-assurance-exception-reuse-");
		const receipt = baseReceipt();
		receipt.independent_reviewer_results["best-practices-researcher"] =
			exceptionResult(
				"best-practices-researcher",
				"artifacts/reviews/testing.md",
			);
		delete (
			receipt.independent_reviewer_results[
				"best-practices-researcher"
			] as Record<string, unknown>
		).owner;
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("accepted_exception_ref reuses evidence");
	});

	it("fails when pass provenance does not match the target receipt", () => {
		const root = createTempRoot("slice-assurance-provenance-");
		const receipt = baseReceipt();
		const agentNative = receipt.independent_reviewer_results[
			"agent-native-reviewer"
		] as Record<string, string>;
		agentNative.role = "adversarial-reviewer";
		agentNative.head_sha = "stale-head";
		writeReceiptArtifacts(root, receipt);
		const receiptsPath = writeReceipt(root, receipt);

		const result = runValidator(root, receiptsPath);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"independent_reviewer_results.agent-native-reviewer.role must match member key",
		);
	});
});
