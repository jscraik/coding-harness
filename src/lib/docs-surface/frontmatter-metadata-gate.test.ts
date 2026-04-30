import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectFrontmatterMetadataViolations } from "./frontmatter-metadata-gate.js";

function write(root: string, path: string, content: string): void {
	const filePath = join(root, path);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf-8");
}

describe("collectFrontmatterMetadataViolations", () => {
	it("flags policy docs that duplicate frontmatter keys in headings and TOC entries", () => {
		const root = mkdtempSync(join(tmpdir(), "frontmatter-gate-"));
		write(
			root,
			"docs/policy.md",
			`---
schema_version: 1
status: active
applies_to:
  - docs
---

# Policy

- [Status](#status)

## Applies To
`,
		);

		const violations = collectFrontmatterMetadataViolations({
			repoRoot: root,
			changedFiles: ["docs/policy.md"],
		});

		expect(violations).toEqual([
			{
				path: "docs/policy.md",
				violatedKeys: ["applies_to", "status"],
				fix: "Move frontmatter keys out of body headings/TOC entries: applies_to, status",
				sourceLearningId:
					"coderabbit.coding-harness.docs-frontmatter-machine-readable",
			},
		]);
	});

	it("allows frontmatter keys in fenced examples", () => {
		const root = mkdtempSync(join(tmpdir(), "frontmatter-gate-"));
		write(
			root,
			"docs/policy.md",
			`---
schema_version: 1
status: active
---

# Policy

\`\`\`yaml
status: draft
\`\`\`
`,
		);

		const violations = collectFrontmatterMetadataViolations({
			repoRoot: root,
			changedFiles: ["docs/policy.md"],
		});

		expect(violations).toEqual([]);
	});

	it("ignores non-policy markdown files", () => {
		const root = mkdtempSync(join(tmpdir(), "frontmatter-gate-"));
		write(
			root,
			"notes/policy.md",
			`---
status: active
---

## Status
`,
		);

		const violations = collectFrontmatterMetadataViolations({
			repoRoot: root,
			changedFiles: ["notes/policy.md"],
		});

		expect(violations).toEqual([]);
	});
});
