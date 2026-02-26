import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGardener } from "./gardener.js";

describe("runGardener", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("does not write QUALITY_SCORE.md in dry-run mode", () => {
		mkdirSync("artifacts", { recursive: true });
		const root = mkdtempSync(join(process.cwd(), "artifacts/gardener-"));
		tempDirs.push(root);

		const docsDir = join(root, "docs");
		mkdirSync(docsDir, { recursive: true });
		writeFileSync(join(docsDir, "README.md"), "# docs", "utf-8");

		const result = runGardener({ docsPath: docsDir, dryRun: true });

		expect(result.ok).toBe(true);
		expect(existsSync(join(docsDir, "QUALITY_SCORE.md"))).toBe(false);
	});
});
