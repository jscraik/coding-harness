import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	EXIT_CODES,
	runPrTemplateGate,
	runPrTemplateGateCLI,
} from "./pr-template-gate.js";

const VALID_BODY = `## Summary

- Linear issue: JSC-999
- Plan IDs: plan-2026-03-12
- What changed (brief): Added local PR-template gate command.
- Why this change was needed: Prevent incomplete PR templates before CI.
- Risk and rollback plan: Revert the command and docs updates.

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Testing

- Command: \`pnpm lint\` -> \`pass\`
- Command: \`pnpm typecheck\` -> \`pass\`
- Command: \`pnpm test\` -> \`pass\`
- Command: \`pnpm audit\` -> \`pass\`
- Command: \`pnpm check\` -> \`pass\`
- Command: \`harness docs-gate --mode advisory\` -> \`n/a\`
- Any other command(s): none

## Review artifacts

- Greptile: https://example.com/greptile
- Greptile confidence score: 4/5
- Independent reviewer evidence: N/A (solo mode)
- Codex: https://example.com/codex
- Additional evidence (if any): none

## Notes

This change adds local PR-template validation so template failures are caught before PR updates.
`;

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

describe("pr-template-gate command", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("returns validation error when no body source is provided", () => {
		const result = runPrTemplateGate({});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_ERROR");
		}
	});

	it("passes with valid body from file", () => {
		const root = join(process.cwd(), "artifacts", "pr-template-gate-test-1");
		roots.push(root);
		const bodyPath = join(root, "pr-body.md");
		write(bodyPath, VALID_BODY);

		const result = runPrTemplateGate({ prBodyFile: bodyPath });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(true);
			expect(result.output.errors).toEqual([]);
			expect(result.output.source).toBe("file");
		}
	});

	// Security regression: finding ef7d00b48248819187f403dcc5becaa5.
	// Original check was resolved.startsWith(cwd) — bypassed by sibling dirs
	// whose absolute path shares the same string prefix as cwd.
	it("rejects an absolute path outside cwd (prefix-bypass guard)", () => {
		const outsideDir = mkdtempSync(join(tmpdir(), "pr-gate-outside-"));
		roots.push(outsideDir);
		const outsideFile = join(outsideDir, "pr-body.md");
		write(outsideFile, VALID_BODY);

		const result = runPrTemplateGate({ prBodyFile: outsideFile });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_ERROR");
			expect(result.error.message).toContain(
				"PR body file must be within the current directory",
			);
		}
	});

	// Security regression: a symlink inside cwd that resolves outside must be rejected.
	it("rejects a symlink inside cwd that points outside", () => {
		const root = join(process.cwd(), "artifacts", "pr-template-gate-symlink");
		const outsideDir = mkdtempSync(join(tmpdir(), "pr-gate-target-"));
		roots.push(root, outsideDir);

		const outsideFile = join(outsideDir, "secret.md");
		write(outsideFile, VALID_BODY);

		mkdirSync(root, { recursive: true });
		const linkPath = join(root, "link.md");
		symlinkSync(outsideFile, linkPath);

		const result = runPrTemplateGate({ prBodyFile: linkPath });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("VALIDATION_ERROR");
			expect(result.error.message).toContain(
				"PR body file must be within the current directory",
			);
		}
	});

	it("fails with unresolved placeholders", () => {
		const invalid = VALID_BODY.replace(
			"Greptile confidence score: 4/5",
			"Greptile confidence score: <0-5>",
		);
		const result = runPrTemplateGate({ prBody: invalid });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.errors).toContain(
				"Replace template placeholder: <0-5>",
			);
		}
	});

	it("supports PR_TEMPLATE_BODY environment fallback", () => {
		vi.stubEnv("PR_TEMPLATE_BODY", VALID_BODY);
		const result = runPrTemplateGate({});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(true);
			expect(result.output.source).toBe("env");
		}
	});

	it("returns policy violation exit code on failed validation", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const exitCode = runPrTemplateGateCLI({
			prBody:
				"## Summary\n\n## Checklist\n\n- [ ] todo\n\n## Testing\n\npass/fail\n\n## Review artifacts\n\n<0-5>\n\n## Notes\n\nAdd one-paragraph merge rationale here.",
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
		expect(consoleError).toHaveBeenCalled();
	});
});
