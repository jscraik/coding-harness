import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSilentErrorDetector } from "./detector.js";

describe("runSilentErrorDetector", () => {
	const tempDirs: string[] = [];
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("ignores *.test.ts files in default src scan", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-silent-error-"));
		tempDirs.push(root);

		const srcDir = join(root, "src");
		mkdirSync(srcDir, { recursive: true });

		writeFileSync(
			join(srcDir, "production.ts"),
			"try { doThing(); } catch (e) {}",
			"utf-8",
		);
		writeFileSync(
			join(srcDir, "production.test.ts"),
			"try { doThing(); } catch (e) {}",
			"utf-8",
		);

		process.chdir(root);

		const result = runSilentErrorDetector({});
		expect(result.filesAnalyzed).toBe(1);
		expect(result.detections.every((d) => !d.file.endsWith(".test.ts"))).toBe(
			true,
		);
	});

	// Security: symlinks inside the scanned directory must not be followed
	it("does not follow symlinked files pointing outside the scan root", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-silent-error-"));
		tempDirs.push(root);

		// Create a completely separate directory outside the scan root
		const outsideRoot = mkdtempSync(
			join(tmpdir(), "harness-silent-error-outside-"),
		);
		tempDirs.push(outsideRoot);

		const srcDir = join(root, "src");
		mkdirSync(srcDir, { recursive: true });

		// Write a file with a silent-error pattern outside the scan root
		const outsideFile = join(outsideRoot, "outside.ts");
		writeFileSync(outsideFile, "try { work(); } catch (e) {}", "utf-8");

		// Create a symlink inside the scan dir pointing to the outside file
		symlinkSync(outsideFile, join(srcDir, "linked.ts"));

		process.chdir(root);
		const result = runSilentErrorDetector({ dirs: [srcDir] });

		// The symlink must be skipped — no files read, no detections
		expect(result.filesAnalyzed).toBe(0);
		expect(result.detections).toHaveLength(0);
	});

	it("does not duplicate detections when multiple regexes match same catch block", () => {
		const root = mkdtempSync(join(tmpdir(), "harness-silent-error-"));
		tempDirs.push(root);

		const srcDir = join(root, "src");
		mkdirSync(srcDir, { recursive: true });

		const filePath = join(srcDir, "console-only.ts");
		writeFileSync(
			filePath,
			"try { work(); } catch (err) { console.error(err); }",
			"utf-8",
		);

		const result = runSilentErrorDetector({ files: [filePath] });
		const consoleOnlyDetections = result.detections.filter(
			(d) => d.type === "console-only",
		);

		expect(consoleOnlyDetections).toHaveLength(1);
	});
});
