import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifyLocalCodeRabbitSetup } from "./local-checks.js";

const SECURE_NPMRC = [
	"@brainwav:registry=https://registry.npmjs.org/",
	"ignore-scripts=true",
	"",
].join("\n");

describe("verifyLocalCodeRabbitSetup - CodeRabbit cost controls", () => {
	let repoPath: string | undefined;

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		repoPath = undefined;
	});

	it("passes when cost controls are enabled", () => {
		repoPath = createRepoFixture(
			[
				"reviews:",
				"  commit_status: true",
				"  sequence_diagrams: false",
				"  auto_review:",
				"    enabled: true",
				"    drafts: false",
				"    auto_pause_after_reviewed_commits: 3",
				"  path_filters:",
				'    - "!artifacts/**"',
				'    - "!build/**"',
				'    - "!coverage/**"',
				'    - "!dist/**"',
				'    - "!docs/doc-lifecycle-manifest.json"',
				'    - "!node_modules/**"',
				'    - "!pnpm-lock.yaml"',
				'    - "!**/*.min.js"',
				'    - "!**/*.png"',
				'    - "!**/*.jpg"',
				'    - "!**/*.jpeg"',
				'    - "!**/*.gif"',
				"knowledge_base:",
				"  web_search:",
				"    enabled: false",
				"",
			].join("\n"),
		);

		const costCheck = costControlCheck(repoPath);

		expect(costCheck?.status).toBe("pass");
		expect(costCheck?.details?.features).toContain(
			"draft PR auto-review disabled",
		);
		expect(costCheck?.details?.features).toContain(
			"incremental auto-review pauses after 3 reviewed commits",
		);
		expect(costCheck?.details?.features).toContain(
			"web search disabled by default",
		);
	});

	it("warns when cost controls allow expensive default review loops", () => {
		repoPath = createRepoFixture(
			[
				"reviews:",
				"  commit_status: true",
				"  sequence_diagrams: true",
				"  auto_review:",
				"    enabled: true",
				"    drafts: true",
				"    auto_pause_after_reviewed_commits: 0",
				"  path_filters:",
				'    - "!artifacts/**"',
				"knowledge_base:",
				"  web_search:",
				"    enabled: true",
				"",
			].join("\n"),
		);

		const costCheck = costControlCheck(repoPath);

		expect(costCheck?.status).toBe("warn");
		expect(costCheck?.message).toContain("drafts: false");
		expect(costCheck?.message).toContain(
			"auto_pause_after_reviewed_commits to 3",
		);
		expect(costCheck?.message).toContain("web_search.enabled: false");
	});

	it("warns when incremental reviews pause at a non-baseline threshold", () => {
		repoPath = createRepoFixture(
			[
				"reviews:",
				"  commit_status: true",
				"  sequence_diagrams: false",
				"  auto_review:",
				"    enabled: true",
				"    drafts: false",
				"    auto_pause_after_reviewed_commits: 1",
				"  path_filters:",
				'    - "!artifacts/**"',
				'    - "!build/**"',
				'    - "!coverage/**"',
				'    - "!dist/**"',
				'    - "!docs/doc-lifecycle-manifest.json"',
				'    - "!node_modules/**"',
				'    - "!pnpm-lock.yaml"',
				'    - "!**/*.min.js"',
				'    - "!**/*.png"',
				'    - "!**/*.jpg"',
				'    - "!**/*.jpeg"',
				'    - "!**/*.gif"',
				"knowledge_base:",
				"  web_search:",
				"    enabled: false",
				"",
			].join("\n"),
		);

		const costCheck = costControlCheck(repoPath);

		expect(costCheck?.status).toBe("warn");
		expect(costCheck?.message).toContain(
			"auto_pause_after_reviewed_commits to 3",
		);
	});
});

function createRepoFixture(codeRabbitContent: string): string {
	const repo = mkdtempSync(join(tmpdir(), "coderabbit-local-checks-"));
	mkdirSync(join(repo, "src/templates"), { recursive: true });
	writeFileSync(join(repo, ".coderabbit.yaml"), codeRabbitContent);
	writeFileSync(join(repo, "src/templates/coderabbit.yaml"), codeRabbitContent);
	writeFileSync(join(repo, ".npmrc"), SECURE_NPMRC);
	return repo;
}

function costControlCheck(repoPath: string) {
	return verifyLocalCodeRabbitSetup(repoPath).find(
		(check) => check.name === "CodeRabbit cost controls",
	);
}
