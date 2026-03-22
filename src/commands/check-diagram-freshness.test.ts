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
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const CHECK_SCRIPT_SOURCE = join(
	process.cwd(),
	"scripts",
	"check-diagram-freshness.sh",
);

function run(root: string, command: string, args: string[]) {
	return spawnSync(command, args, {
		cwd: root,
		encoding: "utf-8",
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
	write(root, ".diagram/system.mmd", "graph TD\n  A[Start] --> B[Finish]\n");
	write(
		root,
		".diagram/manifest.json",
		JSON.stringify(
			{
				generatedAt: "2026-03-11T00:00:00Z",
				diagrams: [{ id: "system", path: ".diagram/system.mmd" }],
			},
			null,
			2,
		),
	);
	write(
		root,
		".diagram/context/diagram-context.md",
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
python3 <<'PY'
from pathlib import Path
import json

fence = chr(96) * 3
context = Path(".diagram/context/diagram-context.md")
context.write_text(
    (
        "# Diagram Context Pack\\n\\nGenerated: 2026-03-12T10:00:00Z\\n\\n## system\\n\\n"
        + fence
        + "mermaid\\n"
        + "graph TD\\n  A[Start] --> B[Finish]\\n"
        + fence
        + "\\n"
    ),
    encoding="utf-8",
)

manifest = Path(".diagram/manifest.json")
manifest.write_text(
    json.dumps(
        {
            "generatedAt": "2026-03-12T10:00:00Z",
            "diagrams": [{"id": "system", "path": ".diagram/system.mmd"}],
        },
        indent=2,
    )
    + "\\n",
    encoding="utf-8",
)

meta = Path(".diagram/context/diagram-context.meta.json")
meta.write_text(
    json.dumps(
        {
            "schema_version": 1,
            "generated_at": "2026-03-12T10:00:00Z",
            "last_generated_epoch": 2,
            "min_interval_seconds": 60,
            "changed": True,
            "context_sha256": "updated",
        },
        indent=2,
    )
    + "\\n",
    encoding="utf-8",
)
PY
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 4;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Diagram freshness check passed.");
	});

	it("fails when refresh changes tracked artifacts after a sensitive code change", () => {
		const root = createRepo(`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > .refresh-invoked
printf '\n## Drift detected\n' >> .diagram/context/diagram-context.md
`);
		roots.push(root);

		write(root, "src/example.ts", "export const example = 3;\n");

		const result = run(root, "bash", ["scripts/check-diagram-freshness.sh"]);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"Error: architecture diagram artifacts are stale after refresh.",
		);
		expect(result.stdout).toContain(".diagram/context/diagram-context.md");
	});
});
