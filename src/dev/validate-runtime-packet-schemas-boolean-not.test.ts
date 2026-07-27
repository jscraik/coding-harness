import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const scriptPath = join(
	repoRoot,
	"scripts/validate-runtime-packet-schemas.cjs",
);
const tempRoots: string[] = [];

function createTempRoot() {
	const cacheRoot = join(repoRoot, ".cache", "runtime-packet-schema-tests");
	const root = mkdtempSync(join(cacheRoot, "boolean-not-"));
	tempRoots.push(root);
	return root;
}

function validateWithNot(not: boolean) {
	const root = createTempRoot();
	const schema = JSON.parse(
		readFileSync("contracts/evidence-receipt.schema.json", "utf8"),
	) as Record<string, unknown>;
	schema.not = not;
	const schemaPath = join(root, "evidence-receipt.schema.json");
	const examplePath = join(root, "evidence-receipt.example.json");
	writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
	writeFileSync(
		examplePath,
		readFileSync("contracts/examples/evidence-receipt.example.json", "utf8"),
	);
	const manifest = JSON.parse(
		readFileSync("contracts/runtime-packet-schemas.manifest.json", "utf8"),
	) as { packets: Record<string, unknown>[] };
	const manifestPath = join(root, "runtime-packet-schemas.manifest.json");
	writeFileSync(
		manifestPath,
		JSON.stringify(
			{
				...manifest,
				packets: manifest.packets.map((entry) =>
					entry.schemaVersion === "evidence-receipt/v1"
						? {
								...entry,
								examplePath: relative(repoRoot, examplePath),
								schemaPath: relative(repoRoot, schemaPath),
							}
						: entry,
				),
			},
			null,
			2,
		),
	);
	return spawnSync(process.execPath, [scriptPath, "--manifest", manifestPath], {
		cwd: repoRoot,
		encoding: "utf8",
	});
}

describe("validate-runtime-packet-schemas.cjs boolean not", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("rejects every value when not is true", () => {
		const result = validateWithNot(true);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("must not match schema (not: true)"),
			]),
		);
	});

	it("accepts the underlying schema when not is false", () => {
		const result = validateWithNot(false);

		expect(result.status).toBe(0);
	});
});
