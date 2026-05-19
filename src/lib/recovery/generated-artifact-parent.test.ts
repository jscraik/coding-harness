import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateRecoveryHandlerContract } from "./contract.js";
import { createGeneratedArtifactParentHandler } from "./generated-artifact-parent.js";

describe("generated artifact parent recovery handler", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	function makeRoot(): string {
		const dir = mkdtempSync(join(tmpdir(), "artifact-parent-"));
		tempDirs.push(dir);
		return dir;
	}

	it("satisfies the recovery contract", () => {
		const handler = createGeneratedArtifactParentHandler();
		expect(validateRecoveryHandlerContract(handler)).toMatchObject({
			ok: true,
			errors: [],
		});
		expect(handler.authority).toMatchObject({
			scope: "local_filesystem",
			mutatesState: true,
			requiresSecret: false,
		});
	});

	it("creates and verifies only the missing artifact parent directory", async () => {
		const repoRoot = makeRoot();
		const handler = createGeneratedArtifactParentHandler();
		const context = {
			failure: "ENOENT: missing generated artifact parent directory",
			repoRoot,
			details: { artifactPath: "artifacts/reviews/reviewer.md" },
		};
		expect(await handler.verifyBefore(context)).toMatchObject({
			ok: true,
			evidenceRefs: ["recovery:artifact-parent:missing"],
		});
		expect(await handler.recover(context)).toMatchObject({
			ok: true,
			status: "recovered",
			evidenceRefs: ["recovery:artifact-parent:created"],
		});
		expect(existsSync(join(repoRoot, "artifacts/reviews"))).toBe(true);
		expect(await handler.verifyAfter(context)).toMatchObject({
			ok: true,
			evidenceRefs: ["recovery:artifact-parent:verified"],
		});
	});

	it("refuses path traversal outside the repo", async () => {
		const repoRoot = makeRoot();
		const outside = mkdtempSync(join(tmpdir(), "artifact-parent-outside-"));
		tempDirs.push(outside);
		const handler = createGeneratedArtifactParentHandler();
		const context = {
			failure: "ENOENT: missing generated artifact parent directory",
			repoRoot,
			details: { artifactPath: `../${basename(outside)}/reviewer.md` },
		};
		expect(await handler.verifyBefore(context)).toMatchObject({
			ok: false,
			reason: "artifact parent is outside repo scope",
		});
		expect(await handler.recover(context)).toMatchObject({
			ok: false,
			status: "denied",
			reason: "artifact parent is outside repo scope",
		});
		expect(existsSync(join(outside, "reviewer.md"))).toBe(false);
	});

	it("refuses symlinked artifact parents that escape the repo", async () => {
		const repoRoot = makeRoot();
		const outside = mkdtempSync(join(tmpdir(), "artifact-parent-outside-"));
		tempDirs.push(outside);
		mkdirSync(join(repoRoot, "artifacts"));
		symlinkSync(outside, join(repoRoot, "artifacts/outside-link"));
		const handler = createGeneratedArtifactParentHandler();
		const context = {
			failure: "ENOENT: missing generated artifact parent directory",
			repoRoot,
			details: {
				artifactPath: "artifacts/outside-link/reviews/reviewer.md",
			},
		};

		expect(await handler.verifyBefore(context)).toMatchObject({
			ok: false,
			reason: "artifact parent traverses a symlink",
		});
		expect(await handler.recover(context)).toMatchObject({
			ok: false,
			status: "denied",
			reason: "artifact parent traverses a symlink",
		});
		expect(existsSync(join(outside, "reviews"))).toBe(false);
	});

	it("supports rollback for an empty recovered parent directory", async () => {
		const repoRoot = makeRoot();
		const handler = createGeneratedArtifactParentHandler();
		const context = {
			failure: "ENOENT: missing generated artifact parent directory",
			repoRoot,
			details: { artifactPath: "artifacts/reviews/reviewer.md" },
		};
		await handler.recover(context);
		expect(await handler.rollback(context)).toMatchObject({
			ok: true,
			status: "stopped",
			evidenceRefs: ["recovery:artifact-parent:rollback-removed"],
		});
		expect(existsSync(join(repoRoot, "artifacts/reviews"))).toBe(false);
	});

	it("stops rollback without deleting non-empty recovered parents", async () => {
		const repoRoot = makeRoot();
		const handler = createGeneratedArtifactParentHandler();
		const context = {
			failure: "ENOENT: missing generated artifact parent directory",
			repoRoot,
			details: { artifactPath: "artifacts/reviews/reviewer.md" },
		};
		await handler.recover(context);
		writeFileSync(join(repoRoot, "artifacts/reviews/reviewer.md"), "review");

		expect(await handler.rollback(context)).toMatchObject({
			ok: false,
			status: "stopped",
			evidenceRefs: ["recovery:artifact-parent:rollback-skipped"],
		});
		expect(existsSync(join(repoRoot, "artifacts/reviews"))).toBe(true);
		expect(existsSync(join(repoRoot, "artifacts/reviews/reviewer.md"))).toBe(
			true,
		);
	});
});
