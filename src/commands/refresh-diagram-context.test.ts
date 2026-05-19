import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sanitizeGitEnv } from "../lib/workflow-contract/test-harness.js";

const SCRIPT_SOURCE = join(
	process.cwd(),
	"scripts",
	"refresh-diagram-context.sh",
);
const NORMALIZE_HELPER_SOURCE = join(
	process.cwd(),
	"scripts",
	"lib",
	"normalize-mermaid-artifact.cjs",
);
const STABLE_PATH = [
	...(process.platform === "darwin" ? ["/opt/homebrew/bin"] : []),

	"/usr/local/bin",
	"/usr/bin",
	"/bin",
	"/usr/sbin",
	"/sbin",
	process.env.PATH ?? "",
]
	.filter(Boolean)
	.join(delimiter);

function writeExecutable(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
	chmodSync(path, 0o755);
}

function createRepo(): { root: string; binDir: string } {
	const root = mkdtempSync(join(tmpdir(), "diagram-context-refresh-"));
	const binDir = join(root, "bin");
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "scripts", "lib"), { recursive: true });
	writeFileSync(
		join(root, "package.json"),
		`${JSON.stringify({ name: "@brainwav/coding-harness" }, null, 2)}\n`,
	);
	copyFileSync(
		SCRIPT_SOURCE,
		join(root, "scripts", "refresh-diagram-context.sh"),
	);
	copyFileSync(
		NORMALIZE_HELPER_SOURCE,
		join(root, "scripts", "lib", "normalize-mermaid-artifact.cjs"),
	);
	chmodSync(join(root, "scripts", "refresh-diagram-context.sh"), 0o755);

	writeExecutable(
		join(binDir, "diagram"),
		`#!/usr/bin/env bash
exit 0
`,
	);
	writeExecutable(
		join(binDir, "pnpm"),
		`#!/usr/bin/env bash
set -euo pipefail
out_dir=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		--output-dir)
			out_dir="$2"
			shift 2
			;;
		*)
			shift
			;;
	esac
done
if [[ -z "$out_dir" ]]; then
	echo "missing --output-dir" >&2
	exit 2
fi
mkdir -p "$out_dir"
cat > "$out_dir/architecture.mmd" <<'MMD'
graph TD
  subgraph src["src"]

    api_aaaaaaaa["api"]
    api_bbbbbbbb["api"]

  end
MMD
cat > "$out_dir/erd.mmd" <<'MMD'
erDiagram
  USER {
    string id PK
  }
MMD
cat > "$out_dir/c4.mmd" <<'MMD'
C4Context
  title "System Context — diagram context refresh random checkout"
  System(mainSystem, "diagram context refresh random checkout", "The system being documented")
MMD
cat > "$out_dir/manifest.json" <<'JSON'
{
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "schemaVersion": "1.0",
  "rootPath": "/tmp/original",
  "diagramDir": ".diagram",
  "compaction": {
    "applied": true,
    "profile": "agent",
    "maxDiagrams": 2
  },
  "diagrams": []
}
JSON
`,
	);

	return { root, binDir };
}

describe("refresh-diagram-context.sh", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});

	it("preserves diagram manifest metadata while adding ERD diagrams to context", {
		timeout: 30000,
	}, () => {
		const { root, binDir } = createRepo();
		roots.push(root);

		const result = spawnSync(
			"bash",
			["scripts/refresh-diagram-context.sh", "--force", "--quiet"],
			{
				cwd: root,
				encoding: "utf-8",
				env: {
					...sanitizeGitEnv(),
					PATH: [binDir, STABLE_PATH].join(delimiter),
				},
			},
		);

		expect(result.status).toBe(0);
		const manifest = JSON.parse(
			readFileSync(join(root, ".diagram", "manifest.json"), "utf-8"),
		) as {
			schemaVersion?: string;
			compaction?: { profile?: string; maxDiagrams?: number };
			diagrams?: Array<{ type: string; file: string }>;
		};
		expect(manifest.schemaVersion).toBe("1.0");
		expect(manifest.compaction?.profile).toBe("agent");
		expect(manifest.compaction?.maxDiagrams).toBe(2);
		expect(manifest.diagrams).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: "erd", file: "erd.mmd" }),
			]),
		);

		const context = readFileSync(
			join(root, "AI", "context", "diagram-context.md"),
			"utf-8",
		);

		expect(context).toContain("## How to use this pack");
		expect(context).toContain("## Table of Contents");
		expect(context).toContain(
			"- [How to use this pack](#how-to-use-this-pack)",
		);
		expect(context).toContain("- [erd](#erd)");
		expect(context).toContain("database, and ERD context");
		expect(context).toContain("harness source-outline <path>");
		expect(context).toContain(
			"bash scripts/harness-cli.sh source-outline <path> --json",
		);
		expect(context).toContain("## erd");
		expect(context).toContain("erDiagram");
		expect(context).toContain('title "System Context — coding harness"');
		expect(context).toContain(
			'System(mainSystem, "coding harness", "The system being documented")',
		);
		expect(context).not.toContain("diagram context refresh random checkout");
		expect(context.match(/\["api"\]/g)).toHaveLength(2);
	});

	it("preserves context when refresh only changes volatile Mermaid output", {
		timeout: 30000,
	}, () => {
		const { root, binDir } = createRepo();
		roots.push(root);

		writeExecutable(
			join(binDir, "pnpm"),
			`#!/usr/bin/env bash
set -euo pipefail
out_dir=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		--output-dir)
			out_dir="$2"
			shift 2
			;;
		*)
			shift
			;;
	esac
done
mkdir -p "$out_dir"
cat > "$out_dir/architecture.mmd" <<'MMD'
graph TD
  node_sources_11111111["sources"]
  node_types_22222222["types"]
MMD
cat > "$out_dir/manifest.json" <<'JSON'
{
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "diagrams": []
}
JSON
`,
		);

		const firstResult = spawnSync(
			"bash",
			["scripts/refresh-diagram-context.sh", "--force", "--quiet"],
			{
				cwd: root,
				encoding: "utf-8",
				env: {
					...sanitizeGitEnv(),
					PATH: [binDir, STABLE_PATH].join(delimiter),
				},
			},
		);
		expect(firstResult.status).toBe(0);
		const contextPath = join(root, "AI", "context", "diagram-context.md");
		const firstContext = readFileSync(contextPath, "utf-8");

		writeExecutable(
			join(binDir, "pnpm"),
			`#!/usr/bin/env bash
set -euo pipefail
out_dir=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		--output-dir)
			out_dir="$2"
			shift 2
			;;
		*)
			shift
			;;
	esac
done
mkdir -p "$out_dir"
cat > "$out_dir/architecture.mmd" <<'MMD'
graph TD
  node_types_88888888["types"]
  node_sources_99999999["sources"]
MMD
cat > "$out_dir/manifest.json" <<'JSON'
{
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "diagrams": []
}
JSON
`,
		);
		const secondResult = spawnSync(
			"bash",
			["scripts/refresh-diagram-context.sh", "--force", "--quiet"],
			{
				cwd: root,
				encoding: "utf-8",
				env: {
					...sanitizeGitEnv(),
					PATH: [binDir, STABLE_PATH].join(delimiter),
				},
			},
		);

		expect(secondResult.status).toBe(0);
		expect(readFileSync(contextPath, "utf-8")).toBe(firstContext);
	});
});
