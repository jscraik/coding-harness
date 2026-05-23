import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/validate-audit-references.cjs", import.meta.url),
);

const roots: string[] = [];

function makeRoot() {
	const root = mkdtempSync(join(tmpdir(), "audit-references-"));
	roots.push(root);
	mkdirSync(join(root, ".harness", "research", "audits"), { recursive: true });
	mkdirSync(join(root, ".harness", "research", "deep"), { recursive: true });
	mkdirSync(join(root, "docs"), { recursive: true });
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "src", "lib", "runtime"), { recursive: true });
	spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
	return root;
}

function makePlainRoot() {
	const root = mkdtempSync(join(tmpdir(), "audit-references-plain-"));
	roots.push(root);
	mkdirSync(join(root, ".harness", "research", "audits"), { recursive: true });
	return root;
}

function write(root: string, repoPath: string, content = "fixture\n") {
	writeFileSync(join(root, repoPath), content);
}

function gitAdd(root: string, ...paths: string[]) {
	const result = spawnSync("git", ["add", "--", ...paths], {
		cwd: root,
		encoding: "utf8",
	});
	expect(result.status).toBe(0);
}

function runValidator(root: string, ...args: string[]) {
	return spawnSync(
		process.execPath,
		[SCRIPT_PATH, ...args, "--root", root, "--json"],
		{
			encoding: "utf8",
		},
	);
}

function parseSingleJsonReport(result: ReturnType<typeof runValidator>) {
	expect(result.stderr).toBe("");
	const stdout = result.stdout.trim();
	expect(stdout).toMatch(/^\{[\s\S]*\}$/u);
	return JSON.parse(stdout);
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("validate-audit-references script", () => {
	it("passes when audit references are allowed, loadable, and tracked", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			[
				"# Audit",
				"- .harness/research/deep/source.md",
				"- scripts/validate-evidence-patterns.cjs",
				"- [runtime](src/lib/runtime/local-runtime-card.ts)",
				"- package.json",
				"",
			].join("\n"),
		);
		write(root, ".harness/research/deep/source.md");
		write(root, "scripts/validate-evidence-patterns.cjs");
		write(root, "src/lib/runtime/local-runtime-card.ts");
		write(root, "package.json", "{}\n");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report).toMatchObject({
			blockerClass: null,
			schemaVersion: "audit-reference-report/v1",
			sourceArtifact: ".harness/research/audits/audit.md",
			status: "pass",
		});
		expect(report.missingRefs).toEqual([]);
		expect(report.ignoredOrUntrackedRefs).toEqual([]);
		expect(report.referencedArtifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					classification: "tracked",
					path: ".harness/research/deep/source.md",
				}),
				expect.objectContaining({
					classification: "tracked",
					path: "scripts/validate-evidence-patterns.cjs",
				}),
			]),
		);
	});

	it("resolves dot-relative markdown links from the source artifact directory", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			"- [source](../deep/source.md)\n",
		);
		write(root, ".harness/research/deep/source.md");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: ".harness/research/deep/source.md",
			}),
		]);
	});

	it("extracts tracked references from fenced code blocks", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			[
				"# Audit",
				"```text",
				"Review supporting artifact .harness/research/deep/source.md",
				"```",
				"",
			].join("\n"),
		);
		write(root, ".harness/research/deep/source.md");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: ".harness/research/deep/source.md",
			}),
		]);
	});

	it("extracts allowlisted root-file references from fenced code blocks", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			["# Audit", "```text", "Review README.md and Makefile", "```", ""].join(
				"\n",
			),
		);
		write(root, "README.md", "# Readme\n");
		write(root, "Makefile", "check:\n\t@true\n");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					classification: "tracked",
					path: "Makefile",
				}),
				expect.objectContaining({
					classification: "tracked",
					path: "README.md",
				}),
			]),
		);
	});

	it("extracts tracked references from inline code spans", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			"The runtime proof is `src/lib/runtime/local-runtime-card.ts`.\n",
		);
		write(root, "src/lib/runtime/local-runtime-card.ts");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: "src/lib/runtime/local-runtime-card.ts",
			}),
		]);
	});

	it("resolves dot-relative inline code spans from the source artifact directory", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			"The source proof is `../deep/source.md`.\n",
		);
		write(root, ".harness/research/deep/source.md");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: ".harness/research/deep/source.md",
			}),
		]);
	});

	it("validates allowlisted extensionless root artifacts", () => {
		const root = makeRoot();
		write(root, ".harness/research/audits/audit.md", "- Makefile\n");
		write(root, "Makefile", "check:\n\t@true\n");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: "Makefile",
			}),
		]);
	});

	it("fails closed when an explicit extensionless root artifact is missing", () => {
		const root = makeRoot();
		write(root, ".harness/research/audits/audit.md", "Review `Makefile`.\n");
		gitAdd(root, ".harness/research/audits/audit.md");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("missing");
		expect(report.missingRefs).toEqual(["Makefile"]);
	});

	it("validates tracked extensionless artifacts under allowed prefixes", () => {
		const root = makeRoot();
		write(root, ".harness/research/audits/audit.md", "- docs/NOTICE\n");
		write(root, "docs/NOTICE", "notice\n");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: "docs/NOTICE",
			}),
		]);
	});

	it("ignores unresolved extensionless prose mentions under allowed prefixes", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			"Wire it into pnpm check or the relevant docs/steering gate.\n",
		);
		gitAdd(root, ".harness/research/audits/audit.md");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([]);
		expect(report.missingRefs).toEqual([]);
	});

	it("blocks existing directory references instead of treating pathspec matches as file proof", () => {
		const root = makeRoot();
		mkdirSync(join(root, "docs", "governance"), { recursive: true });
		write(root, ".harness/research/audits/audit.md", "- docs/governance\n");
		write(root, "docs/governance/index.md");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("reference_outside_allowed_boundary");
		expect(report.blockedRefs).toEqual([
			expect.objectContaining({
				classification: "not_file",
				path: "docs/governance",
			}),
		]);
	});

	it("validates tracked CircleCI governance artifacts", () => {
		const root = makeRoot();
		mkdirSync(join(root, ".circleci"), { recursive: true });
		write(
			root,
			".harness/research/audits/audit.md",
			"- .circleci/config.yml\n",
		);
		write(root, ".circleci/config.yml", "version: 2.1\n");
		gitAdd(root, ".");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.referencedArtifacts).toEqual([
			expect.objectContaining({
				classification: "tracked",
				path: ".circleci/config.yml",
			}),
		]);
	});

	it("fails closed when an extracted reference is missing", () => {
		const root = makeRoot();
		write(root, ".harness/research/audits/audit.md", "- src/missing.ts\n");
		gitAdd(root, ".harness/research/audits/audit.md");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("missing");
		expect(report.blockerClass).toBe("missing_references");
		expect(report.missingRefs).toEqual(["src/missing.ts"]);
	});

	it("reports ignored and untracked references as partial proof", () => {
		const root = makeRoot();
		write(
			root,
			".harness/research/audits/audit.md",
			"- docs/untracked.md\n- docs/ignored.md\n",
		);
		write(root, ".gitignore", "docs/ignored.md\n");
		write(root, "docs/untracked.md");
		write(root, "docs/ignored.md");
		gitAdd(root, ".harness/research/audits/audit.md", ".gitignore");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("partial");
		expect(report.blockerClass).toBe("ignored_or_untracked_references");
		expect(report.ignoredOrUntrackedRefs).toEqual([
			expect.objectContaining({
				classification: "ignored",
				path: "docs/ignored.md",
			}),
			expect.objectContaining({
				classification: "untracked",
				path: "docs/untracked.md",
			}),
		]);
	});

	it("blocks references outside the repository boundary", () => {
		const root = makeRoot();
		write(root, ".harness/research/audits/audit.md", "- ../outside.md\n");
		gitAdd(root, ".harness/research/audits/audit.md");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("reference_outside_allowed_boundary");
		expect(report.blockedRefs).toEqual([
			expect.objectContaining({
				classification: "outside_repo",
				path: "../outside.md",
			}),
		]);
	});

	it("blocks references inside the repo but outside allowed boundaries", () => {
		const root = makeRoot();
		mkdirSync(join(root, "private"), { recursive: true });
		write(
			root,
			".harness/research/audits/audit.md",
			"- private/forbidden.md\n",
		);
		write(root, "private/forbidden.md");
		gitAdd(root, ".harness/research/audits/audit.md", "private/forbidden.md");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("reference_outside_allowed_boundary");
		expect(report.blockedRefs).toEqual([
			expect.objectContaining({
				classification: "outside_allowed_paths",
				path: "private/forbidden.md",
			}),
		]);
	});

	it("returns usage JSON and exit code 2 for invalid arguments", () => {
		const root = makeRoot();

		const result = runValidator(root, "--unknown");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(2);
		expect(report.status).toBe("usage");
		expect(report.blockerClass).toBe("usage");
		expect(report.usageErrors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "usage_unknown_option" }),
				expect.objectContaining({ code: "usage_missing_source" }),
			]),
		);
	});

	it("blocks when the root is not inside a git repository", () => {
		const root = makePlainRoot();
		write(root, ".harness/research/audits/audit.md");

		const result = runValidator(root, ".harness/research/audits/audit.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("repo_root_unavailable");
	});

	it("reports a missing source artifact before reference extraction", () => {
		const root = makeRoot();

		const result = runValidator(root, ".harness/research/audits/missing.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("missing");
		expect(report.blockerClass).toBe("source_missing");
		expect(report.missingRefs).toEqual([".harness/research/audits/missing.md"]);
	});

	it("blocks when the source artifact is not a file", () => {
		const root = makeRoot();
		mkdirSync(join(root, ".harness", "research", "audits", "not-file.md"));

		const result = runValidator(root, ".harness/research/audits/not-file.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("source_not_file");
	});

	it("blocks when the source artifact is outside allowed boundaries", () => {
		const root = makeRoot();
		write(root, "private.md");
		gitAdd(root, "private.md");

		const result = runValidator(root, "private.md");
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("source_outside_allowed_boundary");
	});

	it("blocks when the source artifact resolves outside the repository", () => {
		const root = makeRoot();
		const outsideRoot = mkdtempSync(
			join(tmpdir(), "audit-references-outside-"),
		);
		roots.push(outsideRoot);
		const outsideSource = join(outsideRoot, "outside.md");
		writeFileSync(outsideSource, "# Outside\n");

		const result = runValidator(root, outsideSource);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("blocked");
		expect(report.blockerClass).toBe("source_outside_repo");
	});
});
