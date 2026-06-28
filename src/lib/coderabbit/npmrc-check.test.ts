// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal .npmrc token placeholders.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { verifyNpmrc } from "./npmrc-check.js";

describe("verifyNpmrc", () => {
	let repoPath: string | undefined;

	afterEach(() => {
		if (repoPath) rmSync(repoPath, { recursive: true, force: true });
		repoPath = undefined;
	});

	it("fails when the repo security baseline .npmrc is missing", () => {
		repoPath = mkdtempSync(join(tmpdir(), "npmrc-check-"));

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("fail");
		expect(check.message).toContain("No .npmrc file found");
		expect(check.message).toContain("repo security baseline");
		expect(check.message).toContain("ignore-scripts=true");
	});

	it("fails when .npmrc lacks @brainwav scoped registry", () => {
		repoPath = npmrcFixture("ignore-scripts=true\n");

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("fail");
		expect(check.message).toContain("@brainwav:registry");
	});

	it("warns when .npmrc lacks ignore-scripts=true", () => {
		repoPath = npmrcFixture("@brainwav:registry=https://registry.npmjs.org/\n");

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("warn");
		expect(check.message).toContain("ignore-scripts=true");
		expect(check.message).not.toContain("@brainwav:registry");
	});

	it("warns when ignore-scripts=true exists only in comments", () => {
		repoPath = npmrcFixture(
			"@brainwav:registry=https://registry.npmjs.org/\n# ignore-scripts=true\n",
		);

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("warn");
		expect(check.message).toContain("ignore-scripts=true");
	});

	it("fails when .npmrc contains an auth token override", () => {
		repoPath = npmrcFixture(
			"@brainwav:registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${NPM_TOKEN}\nignore-scripts=true\n",
		);

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("fail");
		expect(check.message).toContain("user-level ~/.npmrc");
	});

	it("ignores _authToken mention in comment-only guidance", () => {
		repoPath = npmrcFixture(
			"@brainwav:registry=https://registry.npmjs.org/\nignore-scripts=true\n# Do not add //registry.npmjs.org/:_authToken=${NPM_TOKEN} here.\n",
		);

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("pass");
		expect(check.message).toContain("Valid .npmrc");
		expect(check.message).not.toContain("user-level ~/.npmrc");
	});

	it("passes with scoped registry and ignore-scripts=true, lists features", () => {
		repoPath = npmrcFixture(
			[
				"@brainwav:registry=https://registry.npmjs.org/",
				"ignore-scripts=true",
				"strict-peer-dependencies=false",
				"auto-install-peers=false",
				"shamefully-hoist=false",
				"node-linker=hoisted",
				"",
			].join("\n"),
		);

		const check = verifyNpmrc(repoPath);

		expect(check.status).toBe("pass");
		expect(check.details?.features).toContain("@brainwav scoped registry");
		expect(check.details?.features).toContain("ignore-scripts=true (security)");
	});
});

function npmrcFixture(content: string): string {
	const repo = mkdtempSync(join(tmpdir(), "npmrc-check-"));
	writeFileSync(join(repo, ".npmrc"), content);
	return repo;
}
