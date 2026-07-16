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
import { EXIT_CODES, runToolingAudit } from "./tooling-audit.js";

function writeRepoFile(root: string, path: string, content: string): void {
	const target = join(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content, "utf-8");
}

function createCompliantRepo(root: string): void {
	mkdirSync(join(root, ".git"), { recursive: true });
	const policy = DEFAULT_CONTRACT.toolingPolicy;
	if (!policy) throw new Error("Expected default tooling policy");
	writeRepoFile(
		root,
		"harness.contract.json",
		JSON.stringify({ ...DEFAULT_CONTRACT, version: "1.5.0" }),
	);
	writeRepoFile(
		root,
		policy.miseFilePath,
		`[tools]\n${policy.requiredMiseTools.map((tool) => `"${tool.tool}" = "${tool.version}"`).join("\n")}\n`,
	);
	writeRepoFile(
		root,
		policy.codexEnvironment.path,
		`version = 1\nname = "fixture"\n\n${policy.codexEnvironment.requiredActions.map((action) => `[[actions]]\nname = "${action.name}"\nicon = "${action.icon}"\ncommand = '''\necho ${action.name}\n'''`).join("\n\n")}\n`,
	);
	writeRepoFile(
		root,
		policy.readinessScriptPath,
		`required_tooling_doc_terms=(${policy.requiredDocumentationTerms.map((term) => `"${term}"`).join(" ")})\nrequired_bins=(${policy.requiredBinaries.map((binary) => `"${binary}"`).join(" ")})\nrequired_codex_actions=(${policy.codexEnvironment.requiredActions.map((action) => `"${action.name}|${action.icon}"`).join(" ")})\nrequired_make_targets=(${policy.makefile.requiredTargets.map((target) => `"${target}"`).join(" ")})\nproject_brain_memory_extension_enabled=${policy.projectBrainMemoryExtension?.enabled ? "true" : "false"}\nrequired_project_brain_paths=(${(policy.projectBrainMemoryExtension?.requiredPaths ?? []).map((path) => `"${path}"`).join(" ")})\nexplicit_capabilities=(${(policy.packagePolicy.explicitCapabilities ?? []).map((capability) => `"${capability}"`).join(" ")})\ncapability_detectors=(${policy.packagePolicy.capabilityDetectors.map((detector) => `"${detector.capability}" ${detector.dependencyMarkers.map((marker) => `"${marker}"`).join(" ")}`).join(" ")})\nrequired_package_specs=(${policy.packagePolicy.requiredPackages.map((pkg) => `"${pkg.package}|${pkg.dependencyType}|${pkg.requiredWhenCapabilities.join(",")}"`).join(" ")})\n`,
	);
	writeRepoFile(
		root,
		policy.makefile.path,
		`${policy.makefile.requiredTargets.map((target) => `${target}:\n\t@echo ${target}`).join("\n\n")}\n`,
	);
	for (const path of REQUIRED_HOOK_SUPPORT_FILES)
		writeRepoFile(root, path, "placeholder\n");
	for (const path of policy.projectBrainMemoryExtension?.requiredPaths ?? []) {
		path.endsWith(".md")
			? writeRepoFile(root, path, "# placeholder\n")
			: mkdirSync(join(root, path), { recursive: true });
	}
	writeRepoFile(
		root,
		"package.json",
		JSON.stringify({
			name: "fixture",
			version: "1.0.0",
			scripts: REQUIRED_PACKAGE_SCRIPTS,
		}),
	);
	writeRepoFile(
		root,
		"prek.toml",
		`default_install_hook_types = ["pre-commit", "pre-push"]\n\n[[repos]]\nrepo = "local"\n\n[[repos.hooks]]\nid = "pre-commit"\nname = "${REQUIRED_PREK_HOOKS["pre-commit"].name}"\nentry = "${REQUIRED_PREK_HOOKS["pre-commit"].entry}"\nlanguage = "${REQUIRED_PREK_HOOKS["pre-commit"].language}"\npass_filenames = false\n\n[[repos.hooks]]\nid = "pre-push"\nname = "${REQUIRED_PREK_HOOKS["pre-push"].name}"\nentry = "${REQUIRED_PREK_HOOKS["pre-push"].entry}"\nlanguage = "${REQUIRED_PREK_HOOKS["pre-push"].language}"\npass_filenames = false\nstages = ["pre-push"]\n`,
	);
}

describe("tooling-audit TOML compatibility", () => {
	it("parses valid TOML values and rejects malformed assignments", async () => {
		const tempRoot = mkdtempSync(join(tmpdir(), "tooling-audit-toml-grammar-"));
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir);
		const policy = DEFAULT_CONTRACT.toolingPolicy;
		if (!policy) throw new Error("Expected default tooling policy");
		const basePrek = readFileSync(join(repoDir, "prek.toml"), "utf-8");
		const baseReadiness = readFileSync(
			join(repoDir, policy.readinessScriptPath),
			"utf-8",
		);
		const run = async (
			prek: string,
			readiness = baseReadiness,
		): Promise<number> => {
			writeRepoFile(repoDir, "prek.toml", prek);
			writeRepoFile(repoDir, policy.readinessScriptPath, readiness);
			const result = await runToolingAudit({ path: tempRoot, format: "json" });
			if (!result.ok) throw new Error("Expected tooling audit result");
			return result.value.exitCode;
		};
		try {
			const hook = '[[repos.hooks]]\nid = "pre-commit"';
			const cases: Array<[string, string, number]> = [
				[
					basePrek.replace(
						hook,
						'[[repos.hooks]]\nunknown = [1, nope]\nid = "pre-commit"',
					),
					baseReadiness,
					EXIT_CODES.DRIFT_DETECTED,
				],
				[
					basePrek.replace(
						hook,
						'[[repos.hooks]]\nunknown = ["ok"] nope\nid = "pre-commit"',
					),
					baseReadiness,
					EXIT_CODES.DRIFT_DETECTED,
				],
				[
					basePrek.replace(
						hook,
						'[[repos.hooks]]\nunknown = ["ok", nope\nid = "pre-commit"',
					),
					baseReadiness,
					EXIT_CODES.DRIFT_DETECTED,
				],
				[
					basePrek.replace(
						hook,
						'[[repos.hooks]]\nunknown = ["ok]", "yes"]\nid = "pre-commit"',
					),
					baseReadiness,
					EXIT_CODES.SUCCESS,
				],
				[
					basePrek.replace(
						hook,
						'[[repos.hooks]]\nunknown = ["""ok\nvalue""", \'\'\'yes\'\'\']\nid = "pre-commit"',
					),
					baseReadiness,
					EXIT_CODES.SUCCESS,
				],
				[
					basePrek.replace(
						'entry = "bash scripts/hook-pre-commit.sh"',
						'entry = """bash scripts/hook-pre-commit.sh\\\n"""',
					),
					baseReadiness,
					EXIT_CODES.SUCCESS,
				],
				[
					basePrek.replace(
						'entry = "bash scripts/hook-pre-commit.sh"',
						'entry = """bash scripts/hook-pre-commit.sh\\\n\n    """',
					),
					baseReadiness,
					EXIT_CODES.SUCCESS,
				],
				[
					basePrek.replaceAll("[[repos.hooks]]", "[[ repos.hooks ]]"),
					baseReadiness,
					EXIT_CODES.SUCCESS,
				],
				[
					basePrek,
					baseReadiness.replace(
						"set -euo pipefail",
						"set -euo pipefail # valid shell comment",
					),
					EXIT_CODES.SUCCESS,
				],
			];
			for (const [prek, readiness, expected] of cases)
				expect(await run(prek, readiness)).toBe(expected);
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	it("rejects incomplete, noncanonical, and traversal readiness forwarders", async () => {
		const tempRoot = mkdtempSync(
			join(tmpdir(), "tooling-audit-forwarding-guardrails-"),
		);
		const repoDir = join(tempRoot, "repo");
		mkdirSync(repoDir, { recursive: true });
		createCompliantRepo(repoDir);
		const policy = DEFAULT_CONTRACT.toolingPolicy;
		if (!policy) throw new Error("Expected default tooling policy");
		const effectiveReadiness = readFileSync(
			join(repoDir, policy.readinessScriptPath),
			"utf-8",
		);
		writeRepoFile(
			repoDir,
			"scripts/check-environment_impl.sh",
			effectiveReadiness,
		);
		const wrappers = [
			`#!/usr/bin/env bash
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@"
`,
			`#!/bin/sh
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@"
`,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$PWD/scripts"
exec bash "$SCRIPT_DIR/check-environment_impl.sh" "$@"
${effectiveReadiness}`,
			`#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/../check-environment_impl.sh" "$@"
`,
		];
		try {
			for (const wrapper of wrappers) {
				writeRepoFile(repoDir, policy.readinessScriptPath, wrapper);
				const result = await runToolingAudit({
					path: tempRoot,
					format: "json",
				});
				expect(result.ok).toBe(true);
				if (result.ok)
					expect(result.value.exitCode).toBe(EXIT_CODES.DRIFT_DETECTED);
			}
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
