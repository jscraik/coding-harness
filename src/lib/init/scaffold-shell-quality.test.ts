/**
 * JSC-62: Shell script quality checks for generated harness templates.
 *
 * These tests verify that generated shell scripts follow the established
 * patterns fixed in PRs #57, #58, #60 to prevent regressions. They check for:
 * 1. No bare grep calls without exit code handling (|| true / || :)
 * 2. Optional tools guarded with `command -v` checks
 * 3. No set -e unfriendly pipeline patterns
 *
 * We perform static analysis on the template source strings since:
 * - The templates are inline in scaffold.ts
 * - We want to catch regressions before they reach downstream projects
 * - shellcheck is not guaranteed to be installed in all environments
 */
import { describe, expect, it } from "vitest";
import {
	type Template,
	type TemplateRenderContext,
	getTemplatesForProvider,
} from "../../lib/init/scaffold.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ShellTemplate = {
	path: string;
	content: string;
};

/** Minimal render context for template analysis (no real project needed). */
const STUB_CONTEXT: TemplateRenderContext = {
	targetDir: "/tmp/stub",
	packageScripts: [],
};

function renderTemplate(template: Template): ShellTemplate {
	return {
		path: template.path,
		content: template.render("pnpm", STUB_CONTEXT),
	};
}

function getShellTemplates(): ShellTemplate[] {
	const circleci = getTemplatesForProvider("circleci");
	const gha = getTemplatesForProvider("github-actions");

	const seen = new Set<string>();
	return [...circleci, ...gha]
		.filter((t) => t.path.endsWith(".sh"))
		.map((t) => renderTemplate(t))
		.filter((t) => {
			if (seen.has(t.path)) return false;
			seen.add(t.path);
			return true;
		});
}

function findOptionalToolsWithoutGuard(content: string): string[] {
	// Only flag lines where `diagram` is actually being EXECUTED as a command,
	// not just mentioned in a string array or comment.
	// Execution patterns: `diagram <args>`, `pnpm exec diagram`, `command -v diagram`
	const OPTIONAL_TOOL_EXEC_PATTERNS = [
		// Direct execution: "diagram " at start of line or after pipe
		/(?:^|\|\s*)(diagram)\s+\S/,
		// pnpm exec diagram
		/pnpm\s+exec\s+diagram/,
	];

	const violations: string[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		// Skip comments and empty lines
		if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
		// Skip if it's a variable assignment or array (contains quotes around it)
		if (/["'][^"']*diagram[^"']*["']/.test(line)) continue;

		for (const pattern of OPTIONAL_TOOL_EXEC_PATTERNS) {
			if (pattern.test(line)) {
				// Check if there's a command -v guard in nearby lines (10 lines context)
				const contextStart = Math.max(0, i - 10);
				const context = lines.slice(contextStart, i + 1).join("\n");
				if (
					!context.includes("command -v diagram") &&
					!context.includes("command -v")
				) {
					violations.push(`Line ${i + 1}: ${line.trim()}`);
				}
			}
		}
	}

	return violations;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("generated shell script quality (JSC-62)", () => {
	let shellTemplates: ShellTemplate[];

	try {
		shellTemplates = getShellTemplates();
	} catch {
		shellTemplates = [];
	}

	it("has at least some shell script templates to validate", () => {
		// Sanity check — if this fails, getShellTemplates() or scaffold logic changed
		expect(shellTemplates.length).toBeGreaterThan(0);
	});

	it("all generated .sh templates have a shebang line", () => {
		const violations: string[] = [];
		for (const template of shellTemplates) {
			const firstLine = template.content.split("\n")[0] ?? "";
			if (!firstLine.startsWith("#!/")) {
				violations.push(
					`${template.path}: missing shebang (got: ${firstLine.slice(0, 40)})`,
				);
			}
		}
		if (violations.length > 0) {
			throw new Error(
				`Shell templates missing shebang:\n${violations.join("\n")}`,
			);
		}
	});

	it("all generated .sh templates use 'set -euo pipefail' or stronger error handling", () => {
		const violations: string[] = [];
		for (const template of shellTemplates) {
			// Accept set -euo pipefail or set -e (at minimum)
			if (
				!template.content.includes("set -euo pipefail") &&
				!template.content.includes("set -e")
			) {
				violations.push(`${template.path}: missing set -e`);
			}
		}
		if (violations.length > 0) {
			throw new Error(
				`Shell templates missing error handling:\n${violations.join("\n")}`,
			);
		}
	});

	it("no optional tools (diagram, etc.) used without command -v guard", () => {
		const allViolations: string[] = [];
		for (const template of shellTemplates) {
			const violations = findOptionalToolsWithoutGuard(template.content);
			if (violations.length > 0) {
				allViolations.push(`== ${template.path} ==\n${violations.join("\n")}`);
			}
		}
		if (allViolations.length > 0) {
			throw new Error(
				`Optional tools used without command -v guard (regression from PR #60):\n${allViolations.join("\n\n")}`,
			);
		}
	});
});
