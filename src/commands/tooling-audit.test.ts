import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTRACT } from "../lib/contract/types.js";
import {
	EXIT_CODES,
	runToolingAudit,
	runToolingAuditCLI,
} from "./tooling-audit.js";

function writeRepoFile(
	root: string,
	relativePath: string,
	content: string,
): void {
	const target = join(root, relativePath);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content, "utf-8");
}

function createCompliantRepo(
	root: string,
	withExplicitToolingPolicy = true,
): void {
	mkdirSync(join(root, ".git"), { recursive: true });
	const contractBase = {
		...DEFAULT_CONTRACT,
		version: "1.4.0",
	};
	const contract = withExplicitToolingPolicy
		? contractBase
		: (({ toolingPolicy: _toolingPolicy, ...rest }) => rest)(contractBase);
	writeRepoFile(
		root,
		"harness.contract.json",
		JSON.stringify(contract, null, 2),
	);

	const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
	if (!toolingPolicy) {
		throw new Error("Expected default tooling policy");
	}

	const miseToml = toolingPolicy.requiredMiseTools
		.map((tool) => `"${tool.tool}" = "${tool.version}"`)
		.join("\n");
	writeRepoFile(root, toolingPolicy.miseFilePath, `[tools]\n${miseToml}\n`);

	const actions = toolingPolicy.codexEnvironment.requiredActions
		.map(
			(action) =>
				`[[actions]]\nname = "${action.name}"\nicon = "${action.icon}"\ncommand = '''\necho ${action.name}\n'''`,
		)
		.join("\n\n");
	writeRepoFile(
		root,
		toolingPolicy.codexEnvironment.path,
		`version = 1\nname = "fixture"\n\n${actions}\n`,
	);

	const readinessScript = `required_tooling_doc_terms=(${toolingPolicy.requiredDocumentationTerms.map((term) => `"${term}"`).join(" ")})
required_bins=(${toolingPolicy.requiredBinaries.map((binary) => `"${binary}"`).join(" ")})
required_codex_actions=(${toolingPolicy.codexEnvironment.requiredActions.map((action) => `"${action.name}|${action.icon}"`).join(" ")})
required_make_targets=(${toolingPolicy.makefile.requiredTargets.map((target) => `"${target}"`).join(" ")})
`;
	writeRepoFile(root, toolingPolicy.readinessScriptPath, readinessScript);

	const makefile = toolingPolicy.makefile.requiredTargets
		.map((target) => `${target}:\n\t@echo ${target}`)
		.join("\n\n");
	writeRepoFile(root, toolingPolicy.makefile.path, `${makefile}\n`);
}

describe("tooling-audit command", () => {
	it("returns NO_REPOS_FOUND for empty directories", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-empty-"));
		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.NO_REPOS_FOUND);
				expect(result.value.result.totalRepos).toBe(0);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("reports compliant repos as success", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-good-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.SUCCESS);
				expect(result.value.result.findings.total).toBe(0);
				expect(result.value.result.successfulRepos).toBe(1);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags repos that rely on implicit tooling defaults", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-implicit-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, false);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				expect(result.value.result.findings.warning).toBeGreaterThan(0);
				expect(
					result.value.result.results[0]?.findings.some(
						(finding) => finding.path === "toolingPolicy",
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags missing codex actions as critical drift", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-drift-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);

		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		writeRepoFile(
			repoDir,
			toolingPolicy.codexEnvironment.path,
			`version = 1\nname = "fixture"\n\n[[actions]]\nname = "Tools"\nicon = "tool"\ncommand = '''\necho Tools\n'''\n`,
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				expect(result.value.result.findings.critical).toBeGreaterThan(0);
				expect(
					result.value.result.results[0]?.findings.some((finding) =>
						finding.description.includes("Missing Codex action mapping"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects unknown CLI flags", async () => {
		const result = await runToolingAuditCLI(["--unsupported"]);
		expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
	});
});
