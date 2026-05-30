import {
	existsSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveEvidencePath } from "./loader.js";

const tempDirs: string[] = [];

function makeTempRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "evidence-loader-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("resolveEvidencePath", () => {
	it("returns metadata for a repo-contained evidence file", () => {
		const repoRoot = makeTempRepo();
		writeFileSync(join(repoRoot, "receipt.json"), "{}");

		const result = resolveEvidencePath(repoRoot, "receipt.json");
		const realRepoRoot = realpathSync(repoRoot);

		expect(result).toEqual({
			status: "valid",
			inputPath: "receipt.json",
			absolutePath: join(realRepoRoot, "receipt.json"),
			realPath: realpathSync(join(repoRoot, "receipt.json")),
			parentRealPath: realRepoRoot,
			sizeBytes: 2,
			blocker: null,
		});
	});

	it("classifies a missing file below an existing parent", () => {
		const repoRoot = makeTempRepo();

		const result = resolveEvidencePath(repoRoot, "missing.json");

		expect(result.status).toBe("missing_file");
		expect(result.parentRealPath).toBe(realpathSync(repoRoot));
		expect(result.realPath).toBeNull();
		expect(result.sizeBytes).toBeNull();
		expect(result.blocker).toContain("missing.json");
	});

	it("classifies a missing parent directory", () => {
		const repoRoot = makeTempRepo();

		const result = resolveEvidencePath(repoRoot, "missing/receipt.json");

		expect(result.status).toBe("missing_parent");
		expect(result.parentRealPath).toBeNull();
		expect(result.blocker).toBe(
			"Evidence parent directory could not be resolved.",
		);
	});

	it("rejects lexical paths outside the repo", () => {
		const repoRoot = makeTempRepo();
		const outside = makeTempRepo();
		writeFileSync(join(outside, "receipt.json"), "{}");

		const result = resolveEvidencePath(repoRoot, "../receipt.json");

		expect(result.status).toBe("outside_repo");
		expect(result.blocker).toBe(
			"Evidence path resolves outside the repository.",
		);
	});

	it("rejects symlinks that resolve outside the repo", () => {
		const repoRoot = makeTempRepo();
		const outside = makeTempRepo();
		writeFileSync(join(outside, "receipt.json"), "{}");
		symlinkSync(
			join(outside, "receipt.json"),
			join(repoRoot, "receipt-link.json"),
		);
		expect(existsSync(join(repoRoot, "receipt-link.json"))).toBe(true);

		const result = resolveEvidencePath(repoRoot, "receipt-link.json");

		expect(result.status).toBe("outside_repo");
		expect(result.realPath).toBe(realpathSync(join(outside, "receipt.json")));
		expect(result.sizeBytes).toBeNull();
		expect(result.blocker).toBe(
			"Evidence file resolves outside the repository.",
		);
	});

	it("rejects directory inputs", () => {
		const repoRoot = makeTempRepo();
		const { mkdirSync } = require("node:fs");
		mkdirSync(join(repoRoot, "artifacts"));

		const result = resolveEvidencePath(repoRoot, "artifacts");

		expect(result.status).toBe("directory_target");
		expect(result.realPath).toBe(realpathSync(join(repoRoot, "artifacts")));
		expect(result.sizeBytes).toBeNull();
		expect(result.blocker).toContain("directory");
	});
});
