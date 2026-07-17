import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const validatorPath = join(
	repoRoot,
	"scripts/validate-runtime-packet-schemas.cjs",
);
const manifestPath = join(
	repoRoot,
	"contracts/runtime-packet-schemas.manifest.json",
);
const examplePath = join(
	repoRoot,
	"contracts/examples/session-distill.example.json",
);
const tempRoots: string[] = [];

function validateSessionDistillPatch(patch: Record<string, unknown>) {
	const tempBase = join(repoRoot, ".cache", "runtime-packet-schema-tests");
	mkdirSync(tempBase, { recursive: true });
	const root = mkdtempSync(join(tempBase, "session-distill-contract-"));
	tempRoots.push(root);
	const example = {
		...(JSON.parse(readFileSync(examplePath, "utf8")) as Record<
			string,
			unknown
		>),
		...patch,
	};
	const candidateExamplePath = join(root, "session-distill.json");
	writeFileSync(candidateExamplePath, JSON.stringify(example, null, 2));
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
		packets: Record<string, unknown>[];
	};
	manifest.packets = manifest.packets.map((entry) =>
		entry.schemaVersion === "session-distill/v1"
			? { ...entry, examplePath: candidateExamplePath }
			: entry,
	);
	const candidateManifestPath = join(root, "manifest.json");
	writeFileSync(candidateManifestPath, JSON.stringify(manifest, null, 2));
	const result = spawnSync(
		process.execPath,
		[validatorPath, "--manifest", candidateManifestPath],
		{ cwd: repoRoot, encoding: "utf8" },
	);
	return {
		status: result.status,
		report: JSON.parse(result.stdout) as { errors: string[] },
	};
}

describe("session-distill runtime packet validation", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("keeps abbreviated v1 head SHAs backward-compatible", () => {
		const result = validateSessionDistillPatch({ headSha: "1111111" });

		expect(result.status).toBe(0);
		expect(result.report.errors).toEqual([]);
	});

	it("rejects a blank v1 head SHA independently", () => {
		const result = validateSessionDistillPatch({ headSha: "" });

		expect(result.status).toBe(1);
		expect(result.report.errors).toEqual(
			expect.arrayContaining([expect.stringContaining(".headSha")]),
		);
	});

	it("rejects a changed-file-count mismatch independently", () => {
		const result = validateSessionDistillPatch({
			changedFiles: ["src/a.ts", "src/b.ts"],
			changedFileCount: 0,
		});

		expect(result.status).toBe(1);
		expect(result.report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"changedFileCount must equal changedFiles length",
				),
			]),
		);
	});
});
