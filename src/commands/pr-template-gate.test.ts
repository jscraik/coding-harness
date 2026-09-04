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

- Problem: PR bodies need to explain the decision pressure behind the work, not only list changed files.
- Change: Maintainers can review intent faster when motivation is captured near the top of the PR.
- Why this approach: Add a required Motivation section to the template and validator instead of relying on optional prose in Summary.
- Intended outcome: PR-template gate rejects incomplete evidence.
- Out of scope: Changing GitHub branch protection.
- Reviewer focus: Command-gate behavior and fixture coverage.
- Risk and rollback: Revert the command and template changes.

## Release boundary

- Release mode: Harness
- Completion condition: PR-template gate rejects incomplete evidence while keeping the release scope bounded.
- Deferred work: none; fixture-only validation change.
- Stronger-proof condition: New validators or adjacent workflow changes require a follow-up issue unless required for this gate to stay truthful.

## Behavior proof

- Before: PR-template gate accepted bodies without an explicit regression test plan.
- After: PR-template gate validates complete PR bodies.
- Environment or operator path: local command-gate fixture through Vitest.
- Verification steps: pnpm vitest run src/commands/pr-template-gate.test.ts.
- Evidence after fix: Command output recorded in Testing.
- Untested paths and limitations: live GitHub PR submission is n.a. because this fixture tests the local command path.

## Change details

- Plan IDs: JSC-999; .harness/plan/example-plan.md
- Linear reference: Refs JSC-999.
- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.
- Session IDs: codex-session-019c-example
- Trace IDs: circleci-workflow-123; harness-gate-pr-template
- AI session / traceability: codex-session-019c-example supports the command gate edits.
- Completed work: Added pr-template-gate command and docs update with evidence refs.
- Affected surfaces: code, tests, docs, PR template.
- Documentation impact: PR template and validator fixtures updated; README.md, SECURITY.md, CONTRIBUTING.md, AGENTS.md, ARCHITECTURE.md, governance docs, and deep-module READMEs are n.a. because this fixture only proves PR body validation.
- SemVer impact: none; validation-only fixture and PR-template contract change does not alter the packaged CLI runtime.
- Expected outcome alignment: Keeps PR evidence reviewable for downstream harness operators.
- Pattern scope inventory: validation evidence format checked in PR template gate; no sibling validators needed.
- Meta-behavior proof: n.a. because this fixture is not driven by steering admission.
- Repeated-error research: n.a. because this fixture does not admit the same error twice.
- Acceptance trace: JSC-999 SA-999-001 -> src/commands/pr-template-gate.test.ts.
- Validation evidence: Command: \`pnpm vitest run src/commands/pr-template-gate.test.ts\` -> pass.
- Review artifacts: CodeRabbit pending; Codex self-review recorded in PR body.
- Durable evidence map: n.a. because review artifacts are represented by PR body links rather than local-only artifact paths.
- Runtime impact: dev-only PR body validation gate.
- Closeout state: PR open; merge blocked on required checks; no Linear blocker.
- Learning / reinforcement: none; no durable learning promoted.

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Validation

- Regression coverage: Unit fixture coverage validates the command accepts complete bodies and rejects incomplete bodies.
- Untested or blocked paths: none
- Command: \`pnpm lint\` -> \`pass\`
- Command: \`pnpm typecheck\` -> \`pass\`
- Command: \`pnpm test\` -> \`pass\`
- Command: \`pnpm audit\` -> \`pass\`
- Command: \`pnpm check\` -> \`pass\`
- Command: \`harness docs-gate --mode advisory\` -> blocked (not run for command fixture)
- Any other command(s): none

## Review and closeout

- CodeRabbit: https://example.com/coderabbit
- Independent reviewer evidence: https://example.com/independent-review
- Codex: https://example.com/codex
- Additional evidence (if any): none

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

	it("passes a configured one-character Linear team prefix", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Refs X-999.",
		).replace(
			"- Linked issue relationship: implementation closure for JSC-999;",
			"- Linked issue relationship: implementation closure for X-999;",
		);

		const result = runPrTemplateGate({
			prBody: body,
			issueKeyPrefixes: ["X"],
		});

		expect(result).toMatchObject({ ok: true, output: { passed: true } });
	});

	it("threads configured prefixes into acceptance-trace coverage", () => {
		const body = VALID_BODY.replace(/JSC-999/g, "X-999");

		const result = runPrTemplateGate({
			prBody: body,
			issueKeyPrefixes: ["X"],
		});

		expect(result).toMatchObject({ ok: true, output: { passed: true } });
	});

	it("rejects a configured linked issue without a matching acceptance trace", () => {
		const body = VALID_BODY.replace(/JSC-999/g, "X-999").replace(
			"- Acceptance trace: X-999 SA-999-001 -> src/commands/pr-template-gate.test.ts.",
			"- Acceptance trace: SA-999-001 -> src/commands/pr-template-gate.test.ts.",
		);

		const result = runPrTemplateGate({
			prBody: body,
			issueKeyPrefixes: ["X"],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(
				result.output.errors.some((error) =>
					error.includes("Acceptance trace for linked issue X-999"),
				),
			).toBe(true);
		}
	});

	it("rejects a Linear team outside the configured prefix allowlist", () => {
		const body = VALID_BODY.replace(
			"- Linear reference: Refs JSC-999.",
			"- Linear reference: Refs EXPANSION-999.",
		);

		const result = runPrTemplateGate({
			prBody: body,
			issueKeyPrefixes: ["JSC"],
		});

		expect(result).toMatchObject({
			ok: true,
			output: {
				passed: false,
				errors: [
					expect.stringContaining(
						"Linear reference must use Refs, Fixes, or Closes",
					),
				],
			},
		});
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

	it("requires motivation fields near the top of the PR body", () => {
		const invalid = VALID_BODY.replace(
			/## Summary[\s\S]*?(?=## Release boundary)/,
			"",
		);

		const result = runPrTemplateGate({ prBody: invalid });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.errors).toContain(
				"Missing required section: ## Summary",
			);
			expect(result.output.errors).toContain("Missing summary block.");
		}
	});

	it("requires release mode to be selected from the template options", () => {
		const invalid = VALID_BODY.replace(
			"- Release mode: Harness",
			"- Release mode: Prototype / Portfolio / Product / Harness / n.a. because reason",
		);

		const result = runPrTemplateGate({ prBody: invalid });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.errors).toContain(
				"Release mode must be Prototype, Portfolio, Product, Harness, or `n.a. because <reason>`.",
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
				"## Change rationale\n\n## Checklist\n\n- [ ] placeholder checklist item\n\n## Validation\n\npass/fail\n\n## Review and closeout\n\n<link / artifact path / comment ID>\n\n## Notes\n\nAdd one-paragraph merge rationale here.",
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
		expect(consoleError).toHaveBeenCalled();
	});
});
