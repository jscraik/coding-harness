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

const VALID_BODY = `## What Problem This Solves

- Motivation: PR bodies need to explain the decision pressure behind the work, not only list changed files.
- Reasoning: Maintainers can review intent faster when motivation is captured near the top of the PR.
- Chosen approach: Add a required Motivation section to the template and validator instead of relying on optional prose in Summary.

## Release Boundary

- Release mode: Harness
- Done line: PR-template gate rejects incomplete evidence while keeping the release scope bounded.
- Explicit non-goals: Changing GitHub branch protection or expanding adjacent workflow gates.
- Allowed polish: Template wording that improves reviewer clarity without adding new evidence systems.
- Deferred polish / follow-up work: none; fixture-only validation change.
- Promotion rule: New validators or adjacent workflow changes require a follow-up issue unless required for this gate to stay truthful.

## Why This Change Was Made

- Problem: PR bodies could omit required validation evidence.
- Why now: CI should catch incomplete PR templates before review.
- Intended outcome: PR-template gate rejects incomplete evidence.
- Out of scope: Changing GitHub branch protection.
- Reviewer focus: Command-gate behavior and fixture coverage.
- Risk and rollback: Revert the command and docs updates.

## Behavior Proof

- Behavior before fix: PR-template gate accepted bodies without an explicit regression test plan.
- Behavior or issue addressed: PR-template gate validates complete PR bodies.
- Real environment tested: local command-gate fixture through Vitest.
- Exact steps or command run after this patch: pnpm vitest run src/commands/pr-template-gate.test.ts.
- Evidence after fix: Command output recorded in Testing.
- Observed result after fix: Complete PR body fixture passed the gate.
- What was not tested: live GitHub PR submission is n.a. because this fixture tests the local command path.
- Proof limitations or environment constraints: none for the local command-gate path.

## Work performed

- Plan IDs: JSC-999; .harness/plan/example-plan.md
- Linear reference: Refs JSC-999.
- Linked issue relationship: implementation closure for JSC-999; completed acceptance IDs: SA-999-001.
- Phase / slice: PU-001 PR evidence ledger
- Session IDs: codex-session-019c-example
- Trace IDs: circleci-workflow-123; harness-gate-pr-template
- AI session / traceability: codex-session-019c-example supports the command gate edits.
- Completed work: Added pr-template-gate command and docs update with evidence refs.
- Affected surfaces: code, tests, docs, PR template.
- Documentation impact: PR template and validator fixtures updated; README.md, SECURITY.md, CONTRIBUTING.md, AGENTS.md, ARCHITECTURE.md, governance docs, and deep-module READMEs are n.a. because this fixture only proves PR body validation.
- Documentation lifecycle impact: updated canonical PR template and validator fixtures; distribution remains source-only.
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
- CodeRabbit mode coverage: validation and gate; promotion n.a. (single fixture change).
- Closeout state: PR open; merge blocked on required checks; no Linear blocker.
- Learning / reinforcement: none; no durable learning promoted.
- Deferred work: none

## Checklist

- [x] I did not push directly to \`main\`; this PR is from a dedicated branch.

## Testing

- regression_test_plan: Unit fixture coverage validates the command accepts complete bodies and rejects incomplete bodies.
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

	it("requires motivation fields near the top of the PR body", () => {
		const invalid = VALID_BODY.replace(
			/## What Problem This Solves[\s\S]*?(?=## Why This Change Was Made)/,
			"",
		);

		const result = runPrTemplateGate({ prBody: invalid });

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.passed).toBe(false);
			expect(result.output.errors).toContain(
				"Missing required section: ## What Problem This Solves",
			);
			expect(result.output.errors).toContain("Missing motivation block.");
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
				"## Why This Change Was Made\n\n## Checklist\n\n- [ ] placeholder checklist item\n\n## Testing\n\npass/fail\n\n## Review artifacts\n\n<link / artifact path / comment ID>\n\n## Notes\n\nAdd one-paragraph merge rationale here.",
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
		expect(consoleError).toHaveBeenCalled();
	});
});
