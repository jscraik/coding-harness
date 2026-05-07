// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal placeholder values that must not interpolate.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSymphonyCheck, runSymphonyCheckCLI } from "./symphony-check.js";

describe("runSymphonyCheck", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `symphony-check-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		vi.unstubAllEnvs();
	});

	const VALID_WORKFLOW = `---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "my-app-abc123"
  active_states:
    - Todo
    - In Progress
  terminal_states:
    - Done
    - Canceled
workspace:
  root: $SYMPHONY_WORKSPACE_ROOT
hooks:
  after_create: |
    git clone --depth 1 "$SOURCE_REPO" .
    pnpm install --frozen-lockfile
agent:
  max_concurrent_agents: 3
  max_turns: 12
---

# my-app Workflow

## Transition Table (Canonical)
\`S | E | G | A | N\`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| \`S0 TODO\` | \`claim\` | preflight | \`harness linear claim --issue <LK>\` | \`S1 IN_PROGRESS\` |
| \`S1 IN_PROGRESS\` | \`advance\` | check passes | \`harness linear handoff --issue <LK>\` | \`S2 IN_REVIEW\` |
| \`S2 IN_REVIEW\` | \`approved\` | review pass | \`harness linear close --issue <LK>\` | \`S3 DONE\` |
`;

	const VALID_CONTRACT = JSON.stringify(
		{
			version: "1.5.0",
			issueTrackingPolicy: {
				provider: "linear",
				requirePackageBugsUrl: true,
			},
		},
		null,
		2,
	);

	function scaffoldValidProject() {
		writeFileSync(join(tempDir, "WORKFLOW.md"), VALID_WORKFLOW);
		writeFileSync(join(tempDir, "harness.contract.json"), VALID_CONTRACT);
		mkdirSync(join(tempDir, ".codex/environments"), { recursive: true });
		writeFileSync(
			join(tempDir, ".codex/environments/environment.toml"),
			'name = "harness local environment"',
		);
	}

	describe("full pass scenario", () => {
		it("passes when all requirements are met", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });

			expect(result.pass).toBe(true);
			expect(result.summary.errors).toBe(0);
			expect(result.summary.projectSlug).toBe("my-app-abc123");
			expect(result.summary.linearKeyAvailable).toBe(true);
		});
	});

	describe("WORKFLOW.md checks", () => {
		it("fails when WORKFLOW.md is missing", () => {
			writeFileSync(join(tempDir, "harness.contract.json"), VALID_CONTRACT);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });

			expect(result.pass).toBe(false);
			const codes = result.findings.map((f) => f.code);
			expect(codes).toContain("MISSING_WORKFLOW");
		});

		it("fails when YAML front matter is missing", () => {
			writeFileSync(
				join(tempDir, "WORKFLOW.md"),
				"# No front matter\nJust a regular markdown file.",
			);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });

			expect(result.pass).toBe(false);
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_FRONTMATTER",
			);
		});

		it("fails when tracker.kind is missing", () => {
			const workflow = `---
tracker:
  project_slug: "test"
---

## Transition Table (Canonical)
\`S | E | G | A | N\`
\`harness linear claim\`
\`harness linear handoff\`
\`harness linear close\`
`;
			writeFileSync(join(tempDir, "WORKFLOW.md"), workflow);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_TRACKER_KIND",
			);
		});

		it("fails when project_slug is a placeholder", () => {
			const workflow = `---
tracker:
  kind: linear
  project_slug: "<your-project-slug>"
---

## Transition Table (Canonical)
\`S | E | G | A | N\`
\`harness linear claim\`
\`harness linear handoff\`
\`harness linear close\`
`;
			writeFileSync(join(tempDir, "WORKFLOW.md"), workflow);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_PROJECT_SLUG",
			);
		});

		it("resolves relative workflow overrides from repoRoot", () => {
			mkdirSync(join(tempDir, "docs/workflows"), { recursive: true });
			writeFileSync(join(tempDir, "docs/workflows/custom.md"), VALID_WORKFLOW);
			writeFileSync(join(tempDir, "harness.contract.json"), VALID_CONTRACT);
			mkdirSync(join(tempDir, ".codex/environments"), { recursive: true });
			writeFileSync(
				join(tempDir, ".codex/environments/environment.toml"),
				'name = "harness local environment"',
			);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({
				repoRoot: tempDir,
				workflowPath: "docs/workflows/custom.md",
			});

			expect(result.pass).toBe(true);
			expect(result.summary.workflowPath).toBe(
				join(tempDir, "docs/workflows/custom.md"),
			);
		});
	});

	describe("transition table checks", () => {
		it("accepts canonical SEGAPRN transition tables", () => {
			const workflow = `---
tracker:
  kind: linear
  project_slug: "test-slug"
  active_states:
    - Todo
workspace:
  root: /tmp
hooks:
  after_create: echo "setup"
---

# Workflow

## Transition Table (Canonical)
\`S | E | G | A | P | R | N\`

| S | E | G | A | P | R | N |
| --- | --- | --- | --- | --- | --- | --- |
| \`S0 TODO\` | \`claim\` | preflight | \`harness linear claim --issue <LK>\` | linear | success | \`S1 IN_PROGRESS\` |
| \`S1 IN_PROGRESS\` | \`advance\` | check passes | \`harness linear handoff --issue <LK>\` | linear | success | \`S2 IN_REVIEW\` |
| \`S2 IN_REVIEW\` | \`approved\` | review pass | \`harness linear close --issue <LK>\` | linear | success | \`S3 DONE\` |
`;
			writeFileSync(join(tempDir, "WORKFLOW.md"), workflow);
			writeFileSync(join(tempDir, "harness.contract.json"), VALID_CONTRACT);
			mkdirSync(join(tempDir, ".codex/environments"), { recursive: true });
			writeFileSync(
				join(tempDir, ".codex/environments/environment.toml"),
				'name = "harness local environment"',
			);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });

			expect(result.findings.map((f) => f.code)).not.toContain(
				"MISSING_TRANSITION_TABLE",
			);
			expect(result.pass).toBe(true);
		});

		it("fails when harness linear commands are missing from body", () => {
			const workflow = `---
tracker:
  kind: linear
  project_slug: "test-slug"
  active_states:
    - Todo
workspace:
  root: /tmp
hooks:
  after_create: echo "setup"
---

# Workflow

## Transition Table (Canonical)
\`S | E | G | A | N\`

Just a transition table with no harness commands.
`;
			writeFileSync(join(tempDir, "WORKFLOW.md"), workflow);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });

			const codes = result.findings.map((f) => f.code);
			expect(codes).toContain("MISSING_CLAIM_CMD");
			expect(codes).toContain("MISSING_HANDOFF_CMD");
			expect(codes).toContain("MISSING_CLOSE_CMD");
		});

		it("fails when transition table header is missing", () => {
			const workflow = `---
tracker:
  kind: linear
  project_slug: "test-slug"
  active_states:
    - Todo
workspace:
  root: /tmp
hooks:
  after_create: echo "setup"
---

# Workflow

harness linear claim
harness linear handoff
harness linear close
`;
			writeFileSync(join(tempDir, "WORKFLOW.md"), workflow);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_TRANSITION_TABLE",
			);
		});
	});

	describe("LINEAR_API_KEY checks", () => {
		it("fails when LINEAR_API_KEY is not available", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "");

			const result = runSymphonyCheck({
				repoRoot: tempDir,
				envFilePath: "/nonexistent/path/.env",
			});

			expect(result.summary.linearKeyAvailable).toBe(false);
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_LINEAR_API_KEY",
			);
		});

		it("finds LINEAR_API_KEY from env file", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "");

			const envFile = join(tempDir, ".env");
			writeFileSync(
				envFile,
				'# Comment\nOTHER_KEY=value\nLINEAR_API_KEY="lin_test_from_file"\n',
			);

			const result = runSymphonyCheck({
				repoRoot: tempDir,
				envFilePath: envFile,
			});

			expect(result.summary.linearKeyAvailable).toBe(true);
			expect(result.findings.map((f) => f.code)).not.toContain(
				"MISSING_LINEAR_API_KEY",
			);
		});

		it("rejects placeholder LINEAR_API_KEY values from process.env", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "${LINEAR_API_KEY}");

			const result = runSymphonyCheck({
				repoRoot: tempDir,
				envFilePath: "/nonexistent/path/.env",
			});

			expect(result.summary.linearKeyAvailable).toBe(false);
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_LINEAR_API_KEY",
			);
		});

		it("rejects placeholder LINEAR_API_KEY values from env files", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "");

			const envFile = join(tempDir, ".env");
			writeFileSync(envFile, 'LINEAR_API_KEY="${LINEAR_API_KEY}"\n');

			const result = runSymphonyCheck({
				repoRoot: tempDir,
				envFilePath: envFile,
			});

			expect(result.summary.linearKeyAvailable).toBe(false);
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_LINEAR_API_KEY",
			);
		});

		it("skips FIFO env paths instead of blocking on them", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "");

			const fifoPath = join(tempDir, ".codex.env.fifo");
			const mkfifo = spawnSync("mkfifo", [fifoPath], { encoding: "utf-8" });
			expect(mkfifo.status).toBe(0);

			const result = runSymphonyCheck({
				repoRoot: tempDir,
				envFilePath: fifoPath,
			});

			expect(result.summary.linearKeyAvailable).toBe(false);
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_LINEAR_API_KEY",
			);
		});

		it("treats the default FIFO-backed Codex env path as a valid secret source", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "");
			vi.stubEnv("HOME", tempDir);

			const codexDir = join(tempDir, ".codex");
			mkdirSync(codexDir, { recursive: true });
			const fifoPath = join(codexDir, ".env");
			const mkfifo = spawnSync("mkfifo", [fifoPath], { encoding: "utf-8" });
			expect(mkfifo.status).toBe(0);

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.summary.linearKeyAvailable).toBe(true);
			expect(result.findings.map((f) => f.code)).not.toContain(
				"MISSING_LINEAR_API_KEY",
			);
		});

		it("passes when LINEAR_API_KEY is in process.env", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.summary.linearKeyAvailable).toBe(true);
		});
	});

	describe("contract and environment checks", () => {
		it("warns when harness.contract.json is missing", () => {
			writeFileSync(join(tempDir, "WORKFLOW.md"), VALID_WORKFLOW);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.findings.map((f) => f.code)).toContain("MISSING_CONTRACT");
		});

		it("warns when contract provider is not linear", () => {
			writeFileSync(join(tempDir, "WORKFLOW.md"), VALID_WORKFLOW);
			writeFileSync(
				join(tempDir, "harness.contract.json"),
				JSON.stringify({
					version: "1.5.0",
					issueTrackingPolicy: { provider: "jira" },
				}),
			);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.findings.map((f) => f.code)).toContain(
				"CONTRACT_NOT_LINEAR",
			);
		});

		it("warns when codex environment template is missing", () => {
			writeFileSync(join(tempDir, "WORKFLOW.md"), VALID_WORKFLOW);
			writeFileSync(join(tempDir, "harness.contract.json"), VALID_CONTRACT);
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const result = runSymphonyCheck({ repoRoot: tempDir });
			expect(result.findings.map((f) => f.code)).toContain(
				"MISSING_CODEX_ENVIRONMENT",
			);
		});
	});

	describe("CLI output", () => {
		it("returns 0 on pass", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const code = runSymphonyCheckCLI({ repoRoot: tempDir });
			expect(code).toBe(0);
		});

		it("returns 1 on validation failure", () => {
			vi.stubEnv("LINEAR_API_KEY", "");

			const code = runSymphonyCheckCLI({
				repoRoot: tempDir,
				envFilePath: "/nonexistent/.env",
			});
			expect(code).toBe(1);
		});

		it("outputs JSON when --json is set", () => {
			scaffoldValidProject();
			vi.stubEnv("LINEAR_API_KEY", "lin_api_test_key");

			const spy = vi.spyOn(console, "info").mockImplementation(() => {});
			const code = runSymphonyCheckCLI({ repoRoot: tempDir, json: true });
			expect(code).toBe(0);

			const output = spy.mock.calls.map((c) => c[0]).join("");
			const parsed = JSON.parse(output);
			expect(parsed.pass).toBe(true);
			expect(parsed.summary.projectSlug).toBe("my-app-abc123");
			spy.mockRestore();
		});
	});
});
