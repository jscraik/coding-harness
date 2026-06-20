import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
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
		expect(result.stderr).toContain(
			"--changed-files requires at least one path",
		);
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

	it.each([
		["--name-only", "--git-base must contain only"],
		["main..feature", "--git-base must be a plain git ref"],
		["main;echo", "--git-base must contain only"],
		["main@{1}", "--git-base must contain only"],
	])("rejects unsafe branch base ref %s", (baseRef, message) => {
		const root = createPolicyRoot();
		runGit(root, ["init"]);

		const result = runValidateCodingPolicy(root, [
			"--json",
			"--git-base",
			baseRef,
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("--git-base failed");
		expect(result.stderr).toContain(message);
	});
});
