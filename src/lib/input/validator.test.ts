import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PathTraversalError, validatePath } from "./validator.js";

describe("validatePath", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("allows paths within the base directory", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-validator-"));
		tempDirs.push(root);

		const baseDir = join(root, "docs");
		const filePath = join(baseDir, "guide.md");

		mkdirSync(baseDir, { recursive: true });
		writeFileSync(filePath, "# docs", "utf-8");

		const validated = validatePath(baseDir, "guide.md");
		expect(validated).toBe(realpathSync(filePath));
	});

	it("allows nested non-existent paths within the base directory", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-validator-"));
		tempDirs.push(root);

		const baseDir = join(root, "docs");
		mkdirSync(baseDir, { recursive: true });

		const validated = validatePath(baseDir, "new/deep/path/file.md");
		expect(validated).toBe(join(baseDir, "new/deep/path/file.md"));
	});

	it("rejects sibling paths that share a base prefix", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-validator-"));
		tempDirs.push(root);

		const baseDir = join(root, "docs");
		const siblingDir = join(root, "docs-evil");
		const siblingFile = join(siblingDir, "secrets.md");

		mkdirSync(baseDir, { recursive: true });
		mkdirSync(siblingDir, { recursive: true });
		writeFileSync(siblingFile, "secret", "utf-8");

		expect(() => validatePath(baseDir, "../docs-evil/secrets.md")).toThrow(
			PathTraversalError,
		);
	});
});
