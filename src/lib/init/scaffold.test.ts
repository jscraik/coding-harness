import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validateContract } from "../contract/validator.js";
import {
	CODESTYLE_PACK_TEMPLATE_FILES,
	TEMPLATES,
	createTemplateRenderContext,
	getTemplatesForProvider,
} from "./scaffold.js";

function resolveBinaryPath(
	name: string,
	options: { optional?: boolean } = {},
): string | undefined {
	const lookup = spawnSync("/bin/bash", ["-lc", `command -v ${name}`], {
		encoding: "utf-8",
	});
	const resolved = `${lookup.stdout}`.trim();
	if (lookup.status !== 0 || resolved.length === 0) {
		if (options.optional) {
			return undefined;
		}
		throw new Error(`Required binary '${name}' not found for scaffold tests`);
	}
	return resolved;
}

function createPathBin(
	tempDir: string,
	options: { includeNode?: boolean; includeJq?: boolean },
): string {
	const binDir = join(tempDir, "bin");
	mkdirSync(binDir, { recursive: true });
	const dirnamePath = resolveBinaryPath("dirname");
	if (!dirnamePath) {
		throw new Error("Required binary 'dirname' not found for scaffold tests");
	}
	symlinkSync(dirnamePath, join(binDir, "dirname"));
	if (options.includeJq) {
		const jqPath = resolveBinaryPath("jq", { optional: true });
		if (jqPath) {
			symlinkSync(jqPath, join(binDir, "jq"));
		}
	}
	if (options.includeNode) {
		symlinkSync(process.execPath, join(binDir, "node"));
	}
	return binDir;
}

describe("scaffold templates resolution", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("includes .coderabbit.yaml by default", () => {
		const templates = getTemplatesForProvider("circleci");
		expect(
			templates.some((template) => template.path === ".coderabbit.yaml"),
		).toBe(true);
	});

	it("renders run-harness-gate with source-repo fallback controls", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);

		expect(runnerTemplate).toBeDefined();
		const rendered = runnerTemplate!.render("pnpm", context);

		expect(rendered).toContain(
			'echo "Error: pnpm is required to run the harness source CLI in this repository." >&2',
		);
		expect(rendered).toContain("HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1");
	});

	it("keeps committed run-harness-gate.sh in parity with scaffold template", () => {
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();
		const context = createTemplateRenderContext(process.cwd(), "circleci");
		const rendered = runnerTemplate!
			.render("pnpm", context)
			.replace(/\r\n/g, "\n")
			.trim();
		const committed = readFileSync(
			join(process.cwd(), "scripts/run-harness-gate.sh"),
			"utf-8",
		)
			.replace(/\r\n/g, "\n")
			.trim();
		expect(committed).toBe(rendered);
	});

	it("generated run-harness-gate fails closed in source repos when pnpm is unavailable even if a fallback runner exists", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const harnessCliPath = join(tempDir, "scripts/harness-cli.sh");
		writeFileSync(
			harnessCliPath,
			["#!/usr/bin/env bash", "set -euo pipefail", 'echo "fallback:$*"'].join(
				"\n",
			),
			"utf-8",
		);
		chmodSync(harnessCliPath, 0o755);

		const binDir = createPathBin(tempDir, { includeNode: true });

		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: pnpm is required to run the harness source CLI in this repository.",
		);
		expect(`${result.stderr}`).toContain(
			"Set HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1 only when you intentionally want to use a non-source harness runner.",
		);
		expect(`${result.stdout}`).not.toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate fails closed in source repos when pnpm is unavailable and no fallback runner exists", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const binDir = createPathBin(tempDir, { includeNode: true });
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: pnpm is required to run the harness source CLI in this repository.",
		);
		expect(`${result.stderr}`).toContain(
			"Set HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1 only when you intentionally want to use a non-source harness runner.",
		);
		expect(`${result.stdout}`).not.toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate requires explicit fallback opt-in when jq parser is available and pnpm is unavailable", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const harnessCliPath = join(tempDir, "scripts/harness-cli.sh");
		writeFileSync(
			harnessCliPath,
			["#!/usr/bin/env bash", "set -euo pipefail", 'echo "fallback:$*"'].join(
				"\n",
			),
			"utf-8",
		);
		chmodSync(harnessCliPath, 0o755);

		const binDir = createPathBin(tempDir, { includeJq: true });
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: pnpm is required to run the harness source CLI in this repository.",
		);
		expect(`${result.stdout}`).not.toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate uses jq parser when python3 is unavailable and still fails closed without explicit fallback opt-in", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const harnessCliPath = join(tempDir, "scripts/harness-cli.sh");
		writeFileSync(
			harnessCliPath,
			["#!/usr/bin/env bash", "set -euo pipefail", 'echo "fallback:$*"'].join(
				"\n",
			),
			"utf-8",
		);
		chmodSync(harnessCliPath, 0o755);

		const binDir = createPathBin(tempDir, { includeJq: true });
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: pnpm is required to run the harness source CLI in this repository.",
		);
		expect(`${result.stdout}`).not.toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate fails closed when jq parser cannot parse package.json", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(join(tempDir, "package.json"), "{invalid-json", "utf-8");
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const binDir = createPathBin(tempDir, { includeJq: true });
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: unable to resolve harness source-runner identity from package metadata.",
		);
	});

	it("generated run-harness-gate uses node parser when python3 and jq are unavailable and still fails closed without explicit fallback opt-in", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const harnessCliPath = join(tempDir, "scripts/harness-cli.sh");
		writeFileSync(
			harnessCliPath,
			["#!/usr/bin/env bash", "set -euo pipefail", 'echo "fallback:$*"'].join(
				"\n",
			),
			"utf-8",
		);
		chmodSync(harnessCliPath, 0o755);

		const binDir = createPathBin(tempDir, { includeNode: true });
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: pnpm is required to run the harness source CLI in this repository.",
		);
		expect(`${result.stdout}`).not.toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate fails closed when node parser cannot parse package.json", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(join(tempDir, "package.json"), "{invalid-json", "utf-8");
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const binDir = createPathBin(tempDir, { includeNode: true });
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: binDir,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: unable to resolve harness source-runner identity from package metadata.",
		);
	});

	it("generated run-harness-gate fails closed when source-repo identity tooling is unavailable", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const harnessCliPath = join(tempDir, "scripts/harness-cli.sh");
		writeFileSync(
			harnessCliPath,
			["#!/usr/bin/env bash", "set -euo pipefail", 'echo "fallback:$*"'].join(
				"\n",
			),
			"utf-8",
		);
		chmodSync(harnessCliPath, 0o755);

		const binDir = createPathBin(tempDir, {});
		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: binDir,
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: unable to resolve harness source-runner identity from package metadata.",
		);
		expect(`${result.stdout}`).not.toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate keeps explicit HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1 messaging in source repos", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "@brainwav/coding-harness" }),
		);
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const harnessCliPath = join(tempDir, "scripts/harness-cli.sh");
		writeFileSync(
			harnessCliPath,
			["#!/usr/bin/env bash", "set -euo pipefail", 'echo "fallback:$*"'].join(
				"\n",
			),
			"utf-8",
		);
		chmodSync(harnessCliPath, 0o755);

		const binDir = createPathBin(tempDir, { includeNode: true });

		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK: "1",
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(0);
		expect(`${result.stderr}`).toContain(
			"HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1 enabled fallback",
		);
		expect(`${result.stdout}`).toContain("fallback:doctor --json");
	});

	it("generated run-harness-gate uses mise-resolved harness in non-source repos", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "demo-app" }),
			"utf-8",
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const binDir = join(tempDir, "bin");
		mkdirSync(binDir, { recursive: true });
		const miseHarnessPath = join(binDir, "mise-harness");
		writeFileSync(
			miseHarnessPath,
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'echo "mise-fallback:$*"',
			].join("\n"),
			"utf-8",
		);
		chmodSync(miseHarnessPath, 0o755);
		writeFileSync(
			join(binDir, "mise"),
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "${1:-}" == "which" && "${2:-}" == "harness" ]]; then',
				`  echo "${miseHarnessPath}"`,
				"  exit 0",
				"fi",
				"exit 1",
			].join("\n"),
			"utf-8",
		);
		chmodSync(join(binDir, "mise"), 0o755);

		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(0);
		expect(`${result.stdout}`).toContain("mise-fallback:doctor --json");
	});

	it("generated run-harness-gate uses global harness fallback in non-source repos", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({ name: "demo-app" }),
			"utf-8",
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const binDir = join(tempDir, "bin");
		mkdirSync(binDir, { recursive: true });
		writeFileSync(
			join(binDir, "harness"),
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'echo "global-fallback:$*"',
			].join("\n"),
			"utf-8",
		);
		chmodSync(join(binDir, "harness"), 0o755);

		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
			env: {
				...process.env,
				PATH: `${binDir}:/bin:/usr/bin`,
			},
		});

		expect(result.status).toBe(0);
		expect(`${result.stdout}`).toContain("global-fallback:doctor --json");
	});

	it("generated run-harness-gate fails closed for malformed package.json", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		mkdirSync(join(tempDir, "scripts"), { recursive: true });
		mkdirSync(join(tempDir, "src"), { recursive: true });
		writeFileSync(join(tempDir, "package.json"), "{invalid-json", "utf-8");
		writeFileSync(join(tempDir, "src/cli.ts"), "export {};\n", "utf-8");

		const context = createTemplateRenderContext(tempDir, "circleci");
		const runnerTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/run-harness-gate.sh",
		);
		expect(runnerTemplate).toBeDefined();

		const runnerPath = join(tempDir, "scripts/run-harness-gate.sh");
		writeFileSync(runnerPath, runnerTemplate!.render("pnpm", context), "utf-8");
		chmodSync(runnerPath, 0o755);

		const result = spawnSync("/bin/bash", [runnerPath, "doctor", "--json"], {
			cwd: tempDir,
			encoding: "utf-8",
		});

		expect(result.status).toBe(1);
		expect(`${result.stderr}`).toContain(
			"Error: unable to resolve harness source-runner identity from package metadata.",
		);
	});

	it("renders a schema-valid harness contract for current scaffold version", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const contractTemplate = TEMPLATES.find(
			(template) => template.path === "harness.contract.json",
		);
		expect(contractTemplate).toBeDefined();

		const renderedContract = JSON.parse(
			contractTemplate!.render("pnpm", context),
		);
		const result = validateContract(renderedContract);

		expect(renderedContract.northStar).toBeDefined();
		expect(renderedContract.productSurface).toBeDefined();
		expect(renderedContract.overrideReviewerRegistry).toBeDefined();
		expect(result.success).toBe(true);
	});

	it("includes the release workflow for all CI providers", () => {
		const circleciTemplates = getTemplatesForProvider("circleci");
		const ghaTemplates = getTemplatesForProvider("github-actions");

		expect(
			circleciTemplates.some(
				(template) =>
					template.path === ".github/workflows/release-private-npm.yml",
			),
		).toBe(true);
		expect(
			ghaTemplates.some(
				(template) =>
					template.path === ".github/workflows/release-private-npm.yml",
			),
		).toBe(true);
	});

	it("includes codestyle contract templates by default", () => {
		const templates = getTemplatesForProvider("circleci");
		const codestyleTemplatePaths = templates
			.filter((template) => template.path.startsWith("codestyle/"))
			.map((template) => template.path)
			.sort();
		const checksumTemplatePath = fileURLToPath(
			new URL("../../templates/codestyle/CHECKSUMS.sha256", import.meta.url),
		);
		const checksumManifest = readFileSync(checksumTemplatePath, "utf-8");
		const checksumPathSet = new Set(
			checksumManifest
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0 && !line.startsWith("#"))
				.map((line) => line.match(/^[a-f0-9]{64}\s+(.+)$/))
				.filter((match): match is RegExpMatchArray => match !== null)
				.map((match) => match[1])
				.filter((path) => path !== "codestyle/CHECKSUMS.sha256"),
		);
		const expectedChecksumPathSet = new Set([
			"CODESTYLE.md",
			...CODESTYLE_PACK_TEMPLATE_FILES.filter(
				(path) => path !== "codestyle/CHECKSUMS.sha256",
			),
		]);

		expect(templates.some((template) => template.path === "CODESTYLE.md")).toBe(
			true,
		);
		expect(codestyleTemplatePaths).toEqual(
			[...CODESTYLE_PACK_TEMPLATE_FILES].sort(),
		);

		// Assert that every entry in CODESTYLE_PACK_TEMPLATE_FILES exists in the template list
		for (const expectedFile of CODESTYLE_PACK_TEMPLATE_FILES) {
			expect(templates.some((template) => template.path === expectedFile)).toBe(
				true,
			);
		}
		expect([...checksumPathSet].sort()).toEqual(
			[...expectedChecksumPathSet].sort(),
		);

		expect(
			templates.some(
				(template) => template.path === "scripts/validate-codestyle.sh",
			),
		).toBe(true);
		expect(
			templates.some(
				(template) => template.path === "scripts/check-codestyle-parity.sh",
			),
		).toBe(true);
	});

	it("ships a checked-in CODESTYLE template for source checkouts", () => {
		const packagedTemplatePath = fileURLToPath(
			new URL("../../templates/CODESTYLE.md", import.meta.url),
		);

		expect(existsSync(packagedTemplatePath)).toBe(true);
	});

	it("never includes legacy .greptile templates", () => {
		const templates = getTemplatesForProvider("circleci");
		const legacyTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		expect(legacyTemplates.length).toBe(0);
	});

	it("omits non-essential templates when minimal mode is enabled", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			minimal: true,
		});
		const legacyTemplates = templates.filter((t) =>
			t.path.includes(".greptile"),
		);
		const codeownersTemplates = templates.filter((t) =>
			t.path.includes("CODEOWNERS"),
		);

		expect(legacyTemplates.length).toBe(0);
		expect(codeownersTemplates.length).toBe(0);

		// Minimal mode keeps provider workflows but still reduces the managed set.
		expect(templates.length).toBeLessThan(
			getTemplatesForProvider("circleci").length,
		);
	});

	it("includes issue tracker templates when explicitly set to github", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "github",
		});
		const issueTemplates = templates.filter((t) =>
			t.path.includes("ISSUE_TEMPLATE"),
		);
		expect(issueTemplates.length).toBeGreaterThan(0);
	});

	it("omits issue tracker templates when explicitly set to none", () => {
		const templates = getTemplatesForProvider("circleci", {
			dryRun: false,
			force: false,
			issueTracker: "none",
		});
		const issueTemplates = templates.filter((t) =>
			t.path.includes("ISSUE_TEMPLATE"),
		);
		expect(issueTemplates.length).toBe(0);
	});

	it("omits linear issue tracking policy when tracker is github", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(
			tempDir,
			"circleci",
			undefined,
			{
				dryRun: false,
				force: false,
				issueTracker: "github",
			},
		);
		const contractTemplate = TEMPLATES.find(
			(template) => template.path === "harness.contract.json",
		);

		expect(contractTemplate).toBeDefined();
		const rendered = JSON.parse(contractTemplate!.render("pnpm", context));

		expect(rendered.issueTrackingPolicy).toBeUndefined();
	});

	it("keeps linear issue tracking policy by default", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const contractTemplate = TEMPLATES.find(
			(template) => template.path === "harness.contract.json",
		);

		expect(contractTemplate).toBeDefined();
		const rendered = JSON.parse(contractTemplate!.render("pnpm", context));

		expect(rendered.issueTrackingPolicy?.provider).toBe("linear");
	});

	it("omits the linear contact link when tracker mode is github", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "https://github.com/brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(
			tempDir,
			"circleci",
			undefined,
			{
				dryRun: false,
				force: false,
				issueTracker: "github",
			},
		);
		const configTemplate = TEMPLATES.find(
			(template) => template.path === ".github/ISSUE_TEMPLATE/config.yml",
		);

		expect(configTemplate).toBeDefined();
		const rendered = configTemplate!.render("pnpm", context);

		expect(rendered).not.toContain("Linear work intake");
		expect(rendered).toContain("Repository docs");
		expect(rendered).toContain("Private security disclosure");
	});

	it("normalizes ssh repository URLs for issue-template docs links", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				repository: "git@github.com:brainwav/coding-harness.git",
			}),
		);

		const context = createTemplateRenderContext(
			tempDir,
			"circleci",
			undefined,
			{
				dryRun: false,
				force: false,
				issueTracker: "github",
			},
		);
		const configTemplate = TEMPLATES.find(
			(template) => template.path === ".github/ISSUE_TEMPLATE/config.yml",
		);

		expect(configTemplate).toBeDefined();
		const rendered = configTemplate!.render("pnpm", context);

		expect(rendered).toContain(
			"url: https://github.com/brainwav/coding-harness#readme",
		);
		expect(rendered).not.toContain("git@github.com:");
	});

	it("harness-cli.sh wrapper includes fail-fast guidance for local package installs", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "harness-scaffold-test-"));
		tempDirs.push(tempDir);
		writeFileSync(
			join(tempDir, "package.json"),
			JSON.stringify({
				name: "demo",
				packageManager: "yarn@4.0.0",
			}),
		);

		const context = createTemplateRenderContext(tempDir, "circleci");
		const harnessCliTemplate = TEMPLATES.find(
			(template) => template.path === "scripts/harness-cli.sh",
		);

		expect(harnessCliTemplate).toBeDefined();
		const rendered = harnessCliTemplate!.render("yarn", context);

		// The wrapper should resolve the local node_modules CLI path first.
		expect(rendered).toContain('CLI_PATH="$REPO_ROOT/node_modules/');
		expect(rendered).toContain('if [[ ! -f "$CLI_PATH" ]]; then');
		expect(rendered).toContain('exec node "$CLI_PATH" "$@"');

		// If missing, the wrapper should provide package-manager-specific recovery commands.
		expect(rendered).toContain(
			"local @brainwav/coding-harness could not be resolved",
		);
		expect(rendered).toContain("yarn install");
		expect(rendered).toContain("yarn add --dev @brainwav/coding-harness");
		expect(rendered).toContain("yarn harness");
	});
});
