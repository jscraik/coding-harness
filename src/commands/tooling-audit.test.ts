import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTRACT } from "../lib/contract/types.js";
import {
	REQUIRED_HOOK_SUPPORT_FILES,
	REQUIRED_PACKAGE_SCRIPTS,
	REQUIRED_PREK_HOOKS,
	REQUIRED_PREK_INSTALL_HOOK_TYPES,
	REQUIRED_PREK_VERSION,
} from "../lib/policy/tooling-baseline.js";
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
		version: "1.5.0",
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
project_brain_memory_extension_enabled=${toolingPolicy.projectBrainMemoryExtension?.enabled ? "true" : "false"}
required_project_brain_paths=(${(toolingPolicy.projectBrainMemoryExtension?.requiredPaths ?? []).map((requiredPath) => `"${requiredPath}"`).join(" ")})
explicit_capabilities=(${(toolingPolicy.packagePolicy.explicitCapabilities ?? []).map((capability) => `"${capability}"`).join(" ")})
capability_detectors=(${toolingPolicy.packagePolicy.capabilityDetectors.map((detector) => `"${detector.capability}" ${detector.dependencyMarkers.map((marker) => `"${marker}"`).join(" ")}`).join(" ")})
required_package_specs=(${toolingPolicy.packagePolicy.requiredPackages.map((requiredPackage) => `"${requiredPackage.package}|${requiredPackage.dependencyType}|${requiredPackage.requiredWhenCapabilities.join(",")}"`).join(" ")})
`;
	writeRepoFile(root, toolingPolicy.readinessScriptPath, readinessScript);

	const makefile = toolingPolicy.makefile.requiredTargets
		.map((target) => `${target}:\n\t@echo ${target}`)
		.join("\n\n");
	writeRepoFile(root, toolingPolicy.makefile.path, `${makefile}\n`);

	for (const supportFile of REQUIRED_HOOK_SUPPORT_FILES) {
		writeRepoFile(root, supportFile, "placeholder\n");
	}

	for (const requiredPath of toolingPolicy.projectBrainMemoryExtension
		?.requiredPaths ?? []) {
		if (requiredPath.endsWith(".md")) {
			writeRepoFile(root, requiredPath, "# placeholder\n");
		} else {
			mkdirSync(join(root, requiredPath), { recursive: true });
		}
	}

	const packageJson = {
		name: "fixture-repo",
		version: "1.0.0",
		scripts: REQUIRED_PACKAGE_SCRIPTS,
	};
	writeRepoFile(root, "package.json", JSON.stringify(packageJson, null, 2));
	const hookBlocks = Object.entries(REQUIRED_PREK_HOOKS)
		.map(([id, hook]) => {
			const stagesLine =
				"stages" in hook ? `stages = ${JSON.stringify(hook.stages)}\n` : "";
			return `[[repos.hooks]]
id = "${id}"
name = "${hook.name}"
entry = "${hook.entry}"
language = "${hook.language}"
pass_filenames = ${String(hook.pass_filenames)}
${stagesLine}`;
		})
		.join("\n");

	writeRepoFile(
		root,
		"prek.toml",
		`minimum_prek_version = "${REQUIRED_PREK_VERSION}"
default_install_hook_types = ${JSON.stringify(REQUIRED_PREK_INSTALL_HOOK_TYPES)}

[[repos]]
repo = "local"

${hookBlocks}
`,
	);
}

function writeUiPackageJson(
	root: string,
	includeDesignSystemGuidance: boolean,
): void {
	const packageJson = {
		name: "fixture-ui-repo",
		version: "1.0.0",
		scripts: REQUIRED_PACKAGE_SCRIPTS,
		dependencies: {
			react: "^19.0.0",
			...(includeDesignSystemGuidance
				? { "@brainwav/design-system-guidance": "^1.0.0" }
				: {}),
		},
	};
	writeRepoFile(root, "package.json", JSON.stringify(packageJson, null, 2));
}

function writeExplicitCapabilityContract(
	root: string,
	capability: "ui" | "chatgpt_apps_sdk",
): void {
	const contract = {
		...DEFAULT_CONTRACT,
		version: "1.5.0",
		toolingPolicy: {
			...DEFAULT_CONTRACT.toolingPolicy,
			packagePolicy: {
				...DEFAULT_CONTRACT.toolingPolicy?.packagePolicy,
				explicitCapabilities: [capability],
			},
		},
	};
	writeRepoFile(
		root,
		"harness.contract.json",
		JSON.stringify(contract, null, 2),
	);
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

	it("flags repos missing required Project Brain memory-extension paths", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-project-brain-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);

		rmSync(join(repoDir, ".harness", "knowledge", "INDEX.md"), {
			force: true,
		});

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
						finding.description.includes("Project Brain memory-extension"),
					),
				).toBe(true);
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

	it("flags repos with missing minimum_prek_version", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-minimum-prek-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const prekPath = join(repoDir, "prek.toml");
		const prekContent = readFileSync(prekPath, "utf-8").replace(
			/^minimum_prek_version.*\n/m,
			"",
		);
		writeFileSync(prekPath, prekContent, "utf-8");

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
						finding.description.includes("minimum_prek_version"),
					),
				).toBe(true);
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

	it("flags repos with missing hook helper scripts in package.json", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-hook-scripts-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);

		writeRepoFile(
			repoDir,
			"package.json",
			JSON.stringify(
				{
					name: "fixture-repo",
					version: "1.0.0",
					scripts: {
						"secrets:staged": REQUIRED_PACKAGE_SCRIPTS["secrets:staged"],
					},
				},
				null,
				2,
			),
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
						finding.description.includes("package.json script"),
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

	it("flags UI repos that omit design-system guidance", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-ui-drift-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeUiPackageJson(repoDir, false);

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
						finding.description.includes("@brainwav/design-system-guidance"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags repos with explicit UI capability even without dependency markers", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-explicit-ui-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeExplicitCapabilityContract(repoDir, "ui");
		writeRepoFile(
			repoDir,
			"package.json",
			JSON.stringify(
				{
					name: "fixture-explicit-ui-repo",
					version: "1.0.0",
					scripts: REQUIRED_PACKAGE_SCRIPTS,
				},
				null,
				2,
			),
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
						finding.description.includes("@brainwav/design-system-guidance"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("accepts UI repos that include design-system guidance", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-ui-good-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeUiPackageJson(repoDir, true);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.SUCCESS);
				expect(result.value.result.findings.total).toBe(0);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags legacy simple-git-hooks metadata", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-hooks-drift-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeRepoFile(
			repoDir,
			"package.json",
			JSON.stringify(
				{
					name: "fixture-repo",
					version: "1.0.0",
					scripts: REQUIRED_PACKAGE_SCRIPTS,
					"simple-git-hooks": {
						"pre-commit": "make hooks-pre-commit",
					},
				},
				null,
				2,
			),
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				expect(
					result.value.result.results[0]?.findings.some((finding) =>
						finding.description.includes(
							"Legacy simple-git-hooks config should be removed",
						),
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
