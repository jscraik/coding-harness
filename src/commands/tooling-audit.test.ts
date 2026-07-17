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
	writeRepoFile(
		root,
		"prek.toml",
		`default_install_hook_types = ["pre-commit", "pre-push"]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "${REQUIRED_PREK_HOOKS["pre-commit"].name}"
entry = "${REQUIRED_PREK_HOOKS["pre-commit"].entry}"
language = "${REQUIRED_PREK_HOOKS["pre-commit"].language}"
pass_filenames = ${String(REQUIRED_PREK_HOOKS["pre-commit"].pass_filenames)}
stages = ["pre-commit"]

[[repos.hooks]]
id = "pre-push"
name = "${REQUIRED_PREK_HOOKS["pre-push"].name}"
entry = "${REQUIRED_PREK_HOOKS["pre-push"].entry}"
language = "${REQUIRED_PREK_HOOKS["pre-push"].language}"
pass_filenames = ${String(REQUIRED_PREK_HOOKS["pre-push"].pass_filenames)}
stages = ${JSON.stringify(REQUIRED_PREK_HOOKS["pre-push"].stages)}
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

	it("follows approved readiness wrappers and validates effective Prek stages", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-wrapper-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);

		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		const effectiveReadiness = readFileSync(
			join(repoDir, toolingPolicy.readinessScriptPath),
			"utf-8",
		);
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@" # approved forwarding comment
`,
		);
		writeRepoFile(
			repoDir,
			"scripts/check-environment_impl.sh",
			effectiveReadiness,
		);
		writeRepoFile(
			repoDir,
			"scripts/hooks/commit-msg.sh",
			"#!/usr/bin/env bash\nexit 0\n",
		);
		writeRepoFile(
			repoDir,
			"prek.toml",
			`default_install_hook_types = ["pre-commit", "commit-msg", "pre-push"]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "hooks-pre-commit"
name = "Run pre-commit validation"
entry = "bash scripts/hook-pre-commit.sh"
language = "system"
stages = ["pre-commit"]
pass_filenames = false

[[repos.hooks]]
id = "hooks-commit-msg"
name = "Validate commit message policy"
entry = "bash scripts/hooks/commit-msg.sh"
language = "system"
stages = ["commit-msg"]
pass_filenames = true

[[repos.hooks]]
id = "hooks-pre-push"
name = "Run pre-push diagnostics"
entry = "bash scripts/hook-pre-push.sh"
language = "system"
stages = ["pre-push"]
pass_filenames = false
`,
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.SUCCESS);
				expect(result.value.result.findings.total).toBe(0);
				const readinessPath = join(repoDir, toolingPolicy.readinessScriptPath);
				writeFileSync(
					readinessPath,
					readFileSync(readinessPath, "utf-8").replace(
						'"$SCRIPT_DIR/check-environment_impl.sh"',
						"'$SCRIPT_DIR/check-environment_impl.sh'",
					),
				);
				const rejected = await runToolingAudit({
					path: tempRoot,
					format: "json",
				});
				expect(rejected.ok).toBe(true);
				if (rejected.ok) {
					expect(rejected.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				}
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects readiness wrappers with extra commands", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-extra-command-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		const effectiveReadiness = readFileSync(
			join(repoDir, toolingPolicy.readinessScriptPath),
			"utf-8",
		);
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
echo unexpected-side-effect >&2
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@"
`,
		);
		writeRepoFile(
			repoDir,
			"scripts/check-environment_impl.sh",
			effectiveReadiness,
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
						finding.description.includes("unsupported command"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects shell commands appended to SCRIPT_DIR assignments", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-inline-command-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		const effectiveReadiness = readFileSync(
			join(repoDir, toolingPolicy.readinessScriptPath),
			"utf-8",
		);
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"; touch "$PWD/pwned"
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@"
`,
		);
		writeRepoFile(
			repoDir,
			"scripts/check-environment_impl.sh",
			effectiveReadiness,
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
						finding.description.includes("unsupported command"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects direct executable readiness forwarding", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-direct-exec-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec "$SCRIPT_DIR/check-environment_impl.sh" "$@"
`,
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
						finding.description.includes("exactly one bash exec"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("accepts inline-commented booleans while rejecting extra leaf hooks", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-prek-extra-hook-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const prekPath = join(repoDir, "prek.toml");
		const prekContent = readFileSync(prekPath, "utf-8")
			.replaceAll("[[repos.hooks]]", "[[repos.hooks]]# valid header comment")
			.replace(
				"pass_filenames = false",
				"pass_filenames = false # valid TOML comment",
			)
			.replace(
				'entry = "bash scripts/hook-pre-commit.sh"',
				"\"entry\" = 'bash scripts/hook-pre-commit.sh' # valid TOML literal comment",
			)
			.replace(
				'stages = ["pre-push"]',
				'stages = ["pre-commit", # comment between values\n "pre-push",] # valid TOML comment',
			);
		writeFileSync(
			prekPath,
			`${prekContent}
[[repos.hooks]]
id = "extra"
name = "Extra"
entry = "echo unapproved"
language = "system"
stages = ["pre-commit"]
pass_filenames = false
`,
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
						finding.description.includes("unapproved leaf command"),
					),
				).toBe(true);
				expect(
					result.value.result.results[0]?.findings.some((finding) =>
						finding.description.includes("missing or out of date"),
					),
				).toBe(false);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects executable trailing TOML tokens", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-prek-trailing"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const prekPath = join(repoDir, "prek.toml");
		const prekContent = readFileSync(prekPath, "utf-8")
			.replace(
				'entry = "bash scripts/hook-pre-commit.sh"',
				'entry = "bash scripts/hook-pre-commit.sh" ; echo bad',
			)
			.replace('stages = ["pre-push"]', 'stages = ["pre-push"] ; echo bad');
		writeFileSync(prekPath, prekContent, "utf-8");

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				expect(result.value.result.results[0]?.findings.length).toBeGreaterThan(
					0,
				);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects malformed stage arrays instead of defaulting the stage", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-prek-stage-token-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const prekPath = join(repoDir, "prek.toml");
		const prekContent = readFileSync(prekPath, "utf-8").replace(
			'entry = "bash scripts/hook-pre-commit.sh"',
			'entry = "bash scripts/hook-pre-commit.sh"\nstages = ["pre-commit", evil]',
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
				expect(
					result.value.result.results[0]?.findings.some((finding) =>
						finding.description.includes(
							"invalid value for policy key 'stages'",
						),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects forwarding argv suffixes without a separator", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-suffix-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@"#unexpected
`,
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
						finding.description.includes("exactly one bash exec"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects duplicate Prek entry and stage keys", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-prek-duplicates-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const prekPath = join(repoDir, "prek.toml");
		const prekContent = readFileSync(prekPath, "utf-8")
			.replace(
				'entry = "bash scripts/hook-pre-commit.sh"',
				'entry = "bash scripts/hook-pre-commit.sh"\nentry = "echo malicious"',
			)
			.replace(
				'stages = ["pre-push"]',
				'stages = ["pre-push"]\nstages = ["post-checkout"]',
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
				const findings = result.value.result.results[0]?.findings ?? [];
				expect(
					findings.filter((finding) =>
						finding.description.includes("repeats policy key"),
					).length,
				).toBe(2);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags a leaf hook whose effective Prek stage is wrong", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-prek-stage-drift-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeRepoFile(
			repoDir,
			"prek.toml",
			`default_install_hook_types = ["pre-commit", "pre-push"]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "hooks-pre-commit"
name = "Run pre-commit validation"
entry = "bash scripts/hook-pre-commit.sh"
language = "system"
stages = ["pre-push"]
pass_filenames = false

[[repos.hooks]]
id = "hooks-pre-push"
name = "Run pre-push diagnostics"
entry = "bash scripts/hook-pre-push.sh"
language = "system"
stages = ["pre-push"]
pass_filenames = false
`,
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
							"uses an unapproved leaf command for effective stage 'pre-push'",
						),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags an unapproved leaf command even when the effective stage matches", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-prek-leaf-drift-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeRepoFile(
			repoDir,
			"prek.toml",
			`default_install_hook_types = ["pre-commit", "pre-push"]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "renamed-pre-commit"
name = "Run pre-commit validation"
entry = "bash scripts/run-prek.sh hook pre-commit"
language = "system"
stages = ["pre-commit"]
pass_filenames = false

[[repos.hooks]]
id = "renamed-pre-push"
name = "Run pre-push diagnostics"
entry = "bash scripts/hooks/pre-push.sh"
language = "system"
stages = ["pre-push"]
pass_filenames = false
`,
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
						finding.description.includes("invokes nested hook orchestration"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags an approved readiness wrapper with a missing target", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-target-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/missing-check-environment.sh" "$@"
`,
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
						finding.description.includes("forwarded readiness target"),
					),
				).toBe(true);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects a readiness wrapper that escapes the repository", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-escape-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		const toolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		if (!toolingPolicy) {
			throw new Error("Expected default tooling policy");
		}
		writeRepoFile(
			repoDir,
			toolingPolicy.readinessScriptPath,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/../../outside-check-environment.sh" "$@"
`,
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
						finding.description.includes("path traversal"),
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
					devDependencies: {
						"simple-git-hooks": "2.13.1",
					},
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
				const finding = result.value.result.results[0]?.findings.find((item) =>
					item.description.includes(
						"Legacy simple-git-hooks config should be removed",
					),
				);
				expect(finding?.actual).toEqual([
					"simple-git-hooks",
					"devDependencies.simple-git-hooks",
				]);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("flags Prek hooks that invoke nested hook orchestration", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-prek-nested-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir, true);
		writeRepoFile(
			repoDir,
			"prek.toml",
			`default_install_hook_types = ["pre-commit", "pre-push"]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "${REQUIRED_PREK_HOOKS["pre-commit"].name}"
entry = "make hooks-pre-commit"
language = "${REQUIRED_PREK_HOOKS["pre-commit"].language}"
pass_filenames = ${String(REQUIRED_PREK_HOOKS["pre-commit"].pass_filenames)}

[[repos.hooks]]
id = "pre-push"
name = "${REQUIRED_PREK_HOOKS["pre-push"].name}"
entry = "pre-commit run --hook-stage pre-push"
language = "${REQUIRED_PREK_HOOKS["pre-push"].language}"
pass_filenames = ${String(REQUIRED_PREK_HOOKS["pre-push"].pass_filenames)}
stages = ${JSON.stringify(REQUIRED_PREK_HOOKS["pre-push"].stages)}
`,
		);

		try {
			const result = await runToolingAudit({
				path: tempRoot,
				format: "json",
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
				const findings = result.value.result.results[0]?.findings.filter(
					(item) => item.description.includes("nested hook orchestration"),
				);
				expect(findings).toHaveLength(2);
				expect(findings?.map((finding) => finding.actual)).toEqual([
					"make hooks-pre-commit",
					"pre-commit run --hook-stage pre-push",
				]);
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
