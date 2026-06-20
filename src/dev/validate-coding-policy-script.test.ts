import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = join(REPO_ROOT, "scripts/validate-coding-policy.cjs");
const POLICY_PATH = join(REPO_ROOT, "coding-policy.json");
const SCHEMA_PATH = join(REPO_ROOT, "contracts/coding-policy.schema.json");

type PolicyModule = {
	id: string;
	path: string;
	changedFilePatterns: string[];
	sourceRules: string[];
	requiredGates: string[];
	[key: string]: unknown;
};

type CodingPolicy = {
	policyModules: PolicyModule[];
	claimBoundaries: string[];
	[key: string]: unknown;
};

const tempRoots: string[] = [];

function readPolicy(): CodingPolicy {
	return JSON.parse(readFileSync(POLICY_PATH, "utf8")) as CodingPolicy;
}

function firstPolicyModule(policy: CodingPolicy): PolicyModule {
	const module = policy.policyModules[0];
	if (!module) throw new Error("test fixture policy has no modules");
	return module;
}

function firstString(values: readonly string[], path: string): string {
	const value = values[0];
	if (!value) throw new Error(`test fixture ${path} has no values`);
	return value;
}

function createPolicyRoot(mutator?: (policy: CodingPolicy) => void): string {
	const root = mkdtempSync(join(tmpdir(), "validate-coding-policy-"));
	tempRoots.push(root);
	mkdirSync(join(root, "contracts"), { recursive: true });
	copyFileSync(SCHEMA_PATH, join(root, "contracts/coding-policy.schema.json"));

	const policy = readPolicy();
	for (const module of policy.policyModules) {
		const modulePath = join(root, module.path);
		mkdirSync(dirname(modulePath), { recursive: true });
		writeFileSync(modulePath, `# ${module.id}\n`);
	}
	mutator?.(policy);
	writeFileSync(
		join(root, "coding-policy.json"),
		JSON.stringify(policy, null, 2),
	);
	return root;
}

function runValidateCodingPolicy(root: string, args: string[] = []) {
	return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: root,
		encoding: "utf8",
	});
}

function runGit(root: string, args: string[]) {
	const result = spawnSync("git", args, {
		cwd: root,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
	return result;
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("validate-coding-policy.cjs", () => {
	it("accepts the repository coding policy fixture", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("coding-policy: pass");
	});

	it("rejects schema-disallowed extra properties", () => {
		const root = createPolicyRoot((policy) => {
			policy.extra = true;
			firstPolicyModule(policy).extra = true;
		});

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"coding-policy additional property extra is not allowed",
		);
		expect(result.stderr).toContain(
			"policyModules[0] additional property extra is not allowed",
		);
	});

	it("rejects schema drift for changed-file pattern contracts", () => {
		const root = createPolicyRoot();
		const schemaFixturePath = join(root, "contracts/coding-policy.schema.json");
		const schema = JSON.parse(readFileSync(schemaFixturePath, "utf8")) as {
			$defs: {
				policyModule: {
					required: string[];
					properties: {
						changedFilePatterns: {
							minItems?: number;
							items?: { type?: string };
						};
					};
				};
			};
		};
		schema.$defs.policyModule.required =
			schema.$defs.policyModule.required.filter(
				(value) => value !== "changedFilePatterns",
			);
		delete schema.$defs.policyModule.properties.changedFilePatterns.minItems;
		schema.$defs.policyModule.properties.changedFilePatterns.items = {
			type: "number",
		};
		writeFileSync(schemaFixturePath, JSON.stringify(schema, null, 2));

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"schema policyModule.changedFilePatterns must be required",
		);
		expect(result.stderr).toContain(
			"schema policyModule.changedFilePatterns must be non-empty",
		);
		expect(result.stderr).toContain(
			"schema policyModule.changedFilePatterns items must be strings",
		);
	});

	it("rejects schema-unique source rules and required gates", () => {
		const baselineModule = firstPolicyModule(readPolicy());
		const changedFilePattern = firstString(
			baselineModule.changedFilePatterns,
			"policyModules[0].changedFilePatterns",
		);
		const sourceRule = firstString(
			baselineModule.sourceRules,
			"policyModules[0].sourceRules",
		);
		const requiredGate = firstString(
			baselineModule.requiredGates,
			"policyModules[0].requiredGates",
		);
		const root = createPolicyRoot((policy) => {
			const module = firstPolicyModule(policy);
			module.changedFilePatterns = [changedFilePattern, changedFilePattern];
			module.sourceRules = [sourceRule, sourceRule];
			module.requiredGates = [requiredGate, requiredGate];
		});

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			`policyModules[0].changedFilePatterns duplicates ${changedFilePattern}`,
		);
		expect(result.stderr).toContain(
			`policyModules[0].sourceRules duplicates ${sourceRule}`,
		);
		expect(result.stderr).toContain(
			`policyModules[0].requiredGates duplicates ${requiredGate}`,
		);
	});

	it("rejects known module paths assigned to the wrong module id", () => {
		const root = createPolicyRoot((policy) => {
			const foundationModule = policy.policyModules.find(
				(module) => module.id === "foundations",
			);
			const testingModule = policy.policyModules.find(
				(module) => module.id === "testing",
			);
			if (!foundationModule || !testingModule) {
				throw new Error("test fixture policy is missing expected modules");
			}
			foundationModule.path = testingModule.path;
		});

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"path must be codestyle/01-foundations.md for module foundations",
		);
	});

	it("rejects non-string module paths without throwing", () => {
		const root = createPolicyRoot((policy) => {
			firstPolicyModule(policy).path = 42 as unknown as string;
		});

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"policyModules[0].path must be a non-empty string",
		);
		expect(result.stderr).toContain(
			"policyModules[0].path must be repo-relative",
		);
	});

	it("rejects changed-file routing patterns that escape the repo", () => {
		const root = createPolicyRoot((policy) => {
			firstPolicyModule(policy).changedFilePatterns = ["../outside/**"];
		});

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"policyModules[0].changedFilePatterns[0] must be repo-relative",
		);
	});

	it("rejects changed-file routing patterns with partial globstars", () => {
		const root = createPolicyRoot((policy) => {
			firstPolicyModule(policy).changedFilePatterns = ["scripts/**.sh"];
		});

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"policyModules[0].changedFilePatterns[0] must use ** only as a full path segment",
		);
	});

	it("rejects changed-file route inputs that escape the repo", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--changed-files",
			"src/../package.json",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("changedFiles[0] must be repo-relative");
	});

	it("rejects changed-file route requests without changed files", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, ["--json", "--changed-files"]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("- invalid command line arguments");
	});

	it("sanitizes unknown CLI argument values before writing stderr", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, [
			"API_TOKEN=secret-value\nforged-log-line",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("- invalid command line arguments");
		expect(result.stderr).not.toContain("secret-value");
		expect(result.stderr).not.toContain("API_TOKEN");
		expect(result.stderr).not.toContain("forged-log-line");
		expect(result.stderr).not.toContain("\n- forged-log-line");
	});

	it("sanitizes parse errors before writing stderr", () => {
		const root = createPolicyRoot();
		writeFileSync(
			join(root, "coding-policy.json"),
			"API_TOKEN=secret-value\\nforged-log-line\\n",
		);

		const result = runValidateCodingPolicy(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"coding-policy: failed to parse coding-policy.json",
		);
		expect(result.stderr).not.toContain("secret-value");
		expect(result.stderr).not.toContain("forged-log-line");
	});

	it("rejects empty changed-file route inputs", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--changed-files",
			"",
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("changedFiles[0] must be repo-relative");
	});

	it("rejects changed-file route inputs above the bounded batch limit", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--changed-files",
			...Array.from({ length: 201 }, (_, index) => `src/file-${index}.ts`),
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"changedFiles must include at most 200 paths",
		);
	});

	it("emits machine-readable policy routes for changed files", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--changed-files",
			"--",
			"src/dev/validate-coding-policy-script.test.ts",
			"scripts/check-doc-style.sh",
			"docs/agents/04-validation.md",
		]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			schemaVersion: string;
			changedFiles: string[];
			policyModules: Array<{
				id: string;
				path: string;
				matchedFiles: string[];
			}>;
			requiredGates: string[];
			claimBoundaries: string[];
		};
		expect(route.schemaVersion).toBe("coding-policy-route/v1");
		expect(route.changedFiles).not.toContain("--");
		expect(route.claimBoundaries.length).toBeGreaterThan(0);
		expect(route.requiredGates).toContain("pnpm run test:related");
		expect(route.requiredGates).toContain("pnpm run quality:scripts");
		expect(route.requiredGates).toContain(
			"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
		);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "testing",
					path: "codestyle/17-testing.md",
					matchedFiles: ["src/dev/validate-coding-policy-script.test.ts"],
				}),
				expect.objectContaining({
					id: "shell",
					path: "codestyle/10-shell-bash-zsh.md",
					matchedFiles: ["scripts/check-doc-style.sh"],
				}),
				expect.objectContaining({
					id: "docs-config-release",
					path: "codestyle/04-docs-config-and-release.md",
					matchedFiles: ["docs/agents/04-validation.md"],
				}),
			]),
		);
	});

	it("routes deep globstar paths with bounded matching", () => {
		const root = createPolicyRoot();
		const deepPath = [
			"src",
			"lib",
			...Array.from({ length: 36 }, (_, index) => `segment-${index}`),
			"policy.ts",
		].join("/");

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--changed-files",
			deepPath,
		]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
		};
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "quality-security-ops",
					matchedFiles: [deepPath],
				}),
			]),
		);
	});

	it("routes policy index, root source, shell, package, and security gate edits", () => {
		const root = createPolicyRoot();

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--changed-files",
			"--",
			"coding-policy.json",
			".markdownlint-cli2.yaml",
			".vale.ini",
			"src/cli.ts",
			"scripts/check",
			".pnpmrc",
			"pnpm-workspace.yaml",
			"scripts/check-staged-secrets.sh",
			"scripts/check-semgrep-full.sh",
			".gitleaks.toml",
			".trufflehog-exclude.txt",
			"security/openssf-scorecard-policy.json",
			"tests/example.test.ts",
		]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
			requiredGates: string[];
		};
		expect(route.requiredGates).toEqual(
			expect.arrayContaining([
				"pnpm run coding-policy:validate",
				"pnpm docs:lint",
				"pnpm check",
				"pnpm run quality:scripts",
				"pnpm install --frozen-lockfile",
				"pnpm audit",
				"pnpm run quality:self-affirming",
			]),
		);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "docs-config-release",
					matchedFiles: expect.arrayContaining([
						"coding-policy.json",
						".markdownlint-cli2.yaml",
						".vale.ini",
					]),
				}),
				expect.objectContaining({
					id: "quality-security-ops",
					matchedFiles: expect.arrayContaining(["src/cli.ts"]),
				}),
				expect.objectContaining({
					id: "shell",
					matchedFiles: expect.arrayContaining(["scripts/check"]),
				}),
				expect.objectContaining({
					id: "package-managers",
					matchedFiles: expect.arrayContaining([
						".pnpmrc",
						"pnpm-workspace.yaml",
					]),
				}),
				expect.objectContaining({
					id: "security",
					matchedFiles: expect.arrayContaining([
						"scripts/check-staged-secrets.sh",
						"scripts/check-semgrep-full.sh",
						".gitleaks.toml",
						".trufflehog-exclude.txt",
						"security/openssf-scorecard-policy.json",
					]),
				}),
				expect.objectContaining({
					id: "testing",
					matchedFiles: expect.arrayContaining(["tests/example.test.ts"]),
				}),
			]),
		);
	});

	it("emits machine-readable policy routes from git changed files", () => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);
		runGit(root, ["add", "."]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"baseline",
		]);
		mkdirSync(join(root, "src/dev"), { recursive: true });
		writeFileSync(
			join(root, "src/dev/validate-coding-policy-script.test.ts"),
			"test('policy route', () => {});\n",
		);

		const result = runValidateCodingPolicy(root, ["--json", "--git-changed"]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			changedFiles: string[];
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
		};
		expect(route.changedFiles).toEqual([
			"src/dev/validate-coding-policy-script.test.ts",
		]);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "testing",
					matchedFiles: ["src/dev/validate-coding-policy-script.test.ts"],
				}),
			]),
		);
	});

	it("routes deleted files from git changed-file discovery", () => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);
		mkdirSync(join(root, "docs/agents"), { recursive: true });
		writeFileSync(join(root, "docs/agents/deleted.md"), "# Deleted\n");
		runGit(root, ["add", "."]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"baseline",
		]);
		unlinkSync(join(root, "docs/agents/deleted.md"));

		const result = runValidateCodingPolicy(root, ["--json", "--git-changed"]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			changedFiles: string[];
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
		};
		expect(route.changedFiles).toEqual(["docs/agents/deleted.md"]);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "docs-config-release",
					matchedFiles: ["docs/agents/deleted.md"],
				}),
			]),
		);
	});

	it("routes both old and new paths for renamed files", () => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);
		mkdirSync(join(root, "docs"), { recursive: true });
		writeFileSync(join(root, "docs/renamed.md"), "# Renamed\n");
		runGit(root, ["add", "."]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"baseline",
		]);
		renameSync(join(root, "docs/renamed.md"), join(root, "renamed.txt"));
		runGit(root, ["add", "-A"]);

		const result = runValidateCodingPolicy(root, ["--json", "--git-changed"]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			changedFiles: string[];
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
		};
		expect(route.changedFiles).toEqual(["docs/renamed.md", "renamed.txt"]);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "docs-config-release",
					matchedFiles: ["docs/renamed.md"],
				}),
			]),
		);
	});

	it("fails closed when git changed-file routing has no changes", () => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);
		runGit(root, ["add", "."]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"baseline",
		]);

		const result = runValidateCodingPolicy(root, ["--json", "--git-changed"]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"route requests require at least one changed file",
		);
	});

	it("emits machine-readable policy routes from a branch base ref", () => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);
		runGit(root, ["add", "."]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"baseline",
		]);
		runGit(root, ["branch", "-M", "main"]);
		runGit(root, ["checkout", "-b", "feature"]);
		mkdirSync(join(root, "scripts"), { recursive: true });
		writeFileSync(join(root, "scripts/check-doc-style.sh"), "echo ok\n");
		runGit(root, ["add", "scripts/check-doc-style.sh"]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"script change",
		]);

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--git-base",
			"main",
		]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			changedFiles: string[];
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
		};
		expect(route.changedFiles).toEqual(["scripts/check-doc-style.sh"]);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "shell",
					matchedFiles: ["scripts/check-doc-style.sh"],
				}),
			]),
		);
	});

	it("routes deleted files from a branch base ref", () => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);
		mkdirSync(join(root, "scripts"), { recursive: true });
		writeFileSync(join(root, "scripts/deleted.sh"), "#!/usr/bin/env bash\n");
		runGit(root, ["add", "."]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"baseline",
		]);
		runGit(root, ["branch", "-M", "main"]);
		runGit(root, ["checkout", "-b", "feature"]);
		unlinkSync(join(root, "scripts/deleted.sh"));
		runGit(root, ["add", "scripts/deleted.sh"]);
		runGit(root, [
			"-c",
			"user.name=Harness Test",
			"-c",
			"user.email=harness-test@example.com",
			"commit",
			"-m",
			"delete script",
		]);

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--git-base",
			"main",
		]);

		expect(result.status).toBe(0);
		const route = JSON.parse(result.stdout) as {
			changedFiles: string[];
			policyModules: Array<{ id: string; matchedFiles: string[] }>;
		};
		expect(route.changedFiles).toEqual(["scripts/deleted.sh"]);
		expect(route.policyModules).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "shell",
					matchedFiles: ["scripts/deleted.sh"],
				}),
			]),
		);
	});

	it.each([
		"--name-only",
		"main..feature",
		"main;echo",
		"main@{1}",
	])("rejects unsafe branch base ref %s", (baseRef) => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--git-base",
			baseRef,
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("--git-base failed");
		expect(result.stderr).not.toContain(baseRef);
	});
});
