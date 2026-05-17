import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
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

## Work performed

- Plan IDs: JSC-999; .harness/plan/example-plan.md
- Phase / slice: PU-001 PR evidence ledger
- Session IDs: codex-session-019c-example
- Trace IDs: circleci-workflow-123; harness-gate-pr-template
- AI session / traceability: codex-session-019c-example supports the command gate edits.
- Completed work: Added pr-template-gate command and docs update with evidence refs.
- Affected surfaces: code, tests, docs, PR template.
- Expected outcome alignment: Keeps PR evidence reviewable for downstream harness operators.
- Pattern scope inventory: validation evidence format checked in PR template gate; no sibling validators needed.
- Meta-behavior proof: n.a. because this fixture is not driven by steering admission.
- Repeated-error research: n.a. because this fixture does not admit the same error twice.
- Acceptance trace: SA-999-001 -> src/commands/pr-template-gate.test.ts.
- Validation evidence: Command: \`pnpm vitest run src/commands/pr-template-gate.test.ts\` -> pass.
- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.
- Runtime impact: dev-only PR body validation gate.
- CodeRabbit mode coverage: validation and gate; promotion n.a. (single fixture change).
- Closeout state: PR open; merge blocked on required checks; no Linear blocker.
- Learning / reinforcement: none; no durable learning promoted.
- Deferred work: none

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Testing

- verification_commands: \`pnpm lint\`; \`pnpm typecheck\`; \`pnpm test\`; \`pnpm audit\`; \`pnpm check\`
- verification_outcomes: \`pass\`; \`pass\`; \`pass\`; \`pass\`; \`pass\`
- blocked_steps_reason: none
- Command: \`pnpm lint\` -> \`pass\`
- Command: \`pnpm typecheck\` -> \`pass\`
- Command: \`pnpm test\` -> \`pass\`
- Command: \`pnpm audit\` -> \`pass\`
- Command: \`pnpm check\` -> \`pass\`
- Command: \`harness docs-gate --mode advisory\` -> n.a. (not needed for command fixture)
- Any other command(s): none

## Review artifacts

- CodeRabbit: https://example.com/coderabbit
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
			"CodeRabbit: https://example.com/coderabbit",
			"CodeRabbit: <link / artifact path / comment ID>",
		);
		const result = runPrTemplateGate({ prBody: invalid });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.errors).toContain(
				"Replace template placeholder: <link / artifact path / comment ID>",
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
				"## Summary\n\n## Checklist\n\n- [ ] todo\n\n## Testing\n\npass/fail\n\n## Review artifacts\n\n<link / artifact path / comment ID>\n\n## Notes\n\nAdd one-paragraph merge rationale here.",
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
		expect(consoleError).toHaveBeenCalled();
	});
});
