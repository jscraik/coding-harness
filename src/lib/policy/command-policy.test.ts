import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const TARGET_DIRS = [".github/workflows", "scripts"];

function walkFiles(dirPath: string): string[] {
	const entries = readdirSync(dirPath);
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = join(dirPath, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			files.push(...walkFiles(fullPath));
			continue;
		}
		files.push(fullPath);
	}
	return files;
}

describe("command policy", () => {
	it("does not use grep in workflows or scripts", () => {
		const offenders: string[] = [];
		for (const dir of TARGET_DIRS) {
			const absoluteDir = join(ROOT, dir);
			for (const filePath of walkFiles(absoluteDir)) {
				const content = readFileSync(filePath, "utf-8");
				if (/\bgrep\b/.test(content)) {
					offenders.push(relative(ROOT, filePath));
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
