import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeGitEnv } from "../lib/workflow-contract/test-harness.js";

const CHECK_SCRIPT_SOURCE = join(
	process.cwd(),
	"scripts",
	"check-diagram-freshness.sh",
);
const STABLE_PATH = [
	dirname(process.execPath),
	...(process.platform === "darwin" ? ["/opt/homebrew/bin"] : []),
	"/usr/local/bin",
	"/usr/bin",
	"/bin",
	"/usr/sbin",
	"/sbin",
	process.env.HOME ? join(process.env.HOME, ".local", "bin") : "",
	process.env.PATH ?? "",
]
	.filter(Boolean)
	.join(delimiter);

function run(root: string, command: string, args: string[]) {
	return spawnSync(command, args, {
		cwd: root,
		encoding: "utf-8",
		env: { ...sanitizeGitEnv(), PATH: STABLE_PATH },
	});
}

function git(root: string, ...args: string[]): void {
	const result = run(root, "git", args);
	expect(result.status).toBe(0);
}

function write(root: string, relativePath: string, content: string): void {
	const fullPath = join(root, relativePath);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, content, "utf-8");
}

function createRepo(refreshScript: string): string {
	const root = mkdtempSync(join(tmpdir(), "diagram-freshness-"));
	mkdirSync(join(root, "scripts"), { recursive: true });
	copyFileSync(
		CHECK_SCRIPT_SOURCE,
		join(root, "scripts", "check-diagram-freshness.sh"),
	);
	write(root, "scripts/refresh-diagram-context.sh", refreshScript);
	write(root, "src/example.ts", "export const example = 1;\n");
	write(root, "src/example.test.ts", "export const exampleTest = 1;\n");
	mkdirSync(join(root, ".diagram", "context"), { recursive: true });
	write(
		root,
		"AI/context/diagram-context.md",
		"# Diagram Context Pack\n\nGenerated: 2026-03-11T00:00:00Z\n\n## system\n\n```mermaid\ngraph TD\n  A[Start] --> B[Finish]\n```\n",
	);
	write(
		root,
		".diagram/context/diagram-context.meta.json",
		JSON.stringify(
			{
				schema_version: 1,
				generated_at: "2026-03-11T00:00:00Z",
				last_generated_epoch: 1,
				min_interval_seconds: 60,
				changed: false,
				context_sha256: "baseline",
			},
			null,
			2,
		),
	);
	write(
		root,
		".diagram/architecture.mmd",
		[
			"graph TD",
			'  subgraph sg_one_a1b2c3d4["src/lib/one"]',
			'    node_alpha_11111111["alpha"]',
			"  end",
			'  ext_node_fs_deadbeef["node:fs"] --> node_alpha_11111111',
			"",
		].join("\n"),
	);

	git(root, "init");
	git(root, "config", "user.email", "codex@example.com");
	git(root, "config", "user.name", "Codex");
	git(root, "add", ".");
	git(root, "commit", "-m", "baseline");

	return root;
}

describe("check-diagram-freshness.sh", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});

	it("skips refresh when only test files changed", { timeout: 30000 }, () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > .refresh-invoked
`);
		roots.push(root);

		write(root, "src/example.test.ts", "export const exampleTest = 2;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"Diagram freshness check skipped: no architecture-sensitive implementation paths changed.",
		);
		expect(existsSync(join(root, ".refresh-invoked"))).toBe(false);
	});

	it("skips refresh when only tracked generated artifacts changed", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > .refresh-invoked
`);
		roots.push(root);

		write(
			root,
			"AI/context/diagram-context.md",
			"# Diagram Context Pack\n\nGenerated: 2026-03-12T00:00:00Z\n\n## system\n\n```mermaid\ngraph TD\n  A[Start] --> B[Finish]\n```\n",
		);

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"Diagram freshness check skipped: no architecture-sensitive implementation paths changed.",
		);
		expect(existsSync(join(root, ".refresh-invoked"))).toBe(false);
	});

	it("refreshes and passes when implementation changes do not alter tracked artifacts", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > .refresh-invoked
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 2;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"Refreshing architecture diagrams for changed sensitive paths...",
		);
		expect(result.stdout).toContain("Diagram freshness check passed.");
		expect(existsSync(join(root, ".refresh-invoked"))).toBe(true);
	});

	it("passes when refresh only updates volatile timestamp metadata", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
fence="$(printf '\\x60\\x60\\x60')"
printf '%s\\n' \
	"# Diagram Context Pack" \
	"" \
	"Generated: 2026-03-12T10:00:00Z" \
	"" \
	"## system" \
	"" \
	"\${fence}mermaid" \
	"graph TD" \
	"  A[Start] --> B[Finish]" \
	"\${fence}" \
	> AI/context/diagram-context.md

jq -n --tab \
	--arg generated_at "2026-03-12T10:00:00Z" \
	'{
		schema_version: 1,
		generated_at: $generated_at,
		last_generated_epoch: 2,
		min_interval_seconds: 60,
		changed: true,
		context_sha256: "updated"
	}' > .diagram/context/diagram-context.meta.json
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 4;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Diagram freshness check passed.");
	});

	it("passes when refresh only changes volatile Mermaid artifact identifiers", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
cat > .diagram/architecture.mmd <<'MMD'
graph TD
  subgraph sg_one_fedcba98["src/lib/one"]
    node_alpha_99999999["alpha"]
  end
  ext_node_fs_12345678["node:fs"] --> node_alpha_99999999
MMD
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 6;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Diagram freshness check passed.");
	});

	it("fails when refresh changes tracked artifacts after a sensitive code change", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > .refresh-invoked
fence="$(printf '\\x60\\x60\\x60')"
printf '%s\n' \
	"" \
	"## architecture" \
	"" \
	"\${fence}mermaid" \
	"graph TD" \
	"  A[Start] --> C[Changed]" \
	"\${fence}" \
	>> AI/context/diagram-context.md
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 3;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"Error: architecture diagram artifacts are stale after refresh.",
		);
		expect(result.stdout).toContain("AI/context/diagram-context.md");
	});

	it("fails when refresh changes a generated persistence diagram section", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > .refresh-invoked
fence="$(printf '\\x60\\x60\\x60')"
printf '%s\n' \
	"" \
	"## erd" \
	"" \
	"\${fence}mermaid" \
	"erDiagram" \
	"  USER ||--o{ REPO : owns" \
	"\${fence}" \
	>> AI/context/diagram-context.md
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 5;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"Error: architecture diagram artifacts are stale after refresh.",
		);
		expect(result.stdout).toContain("AI/context/diagram-context.md");
	});
});
