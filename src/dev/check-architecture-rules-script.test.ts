import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/check-architecture-rules.cjs");

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const root = mkdtempSync(join(tmpdir(), prefix));
	tempRoots.push(root);
	return root;
}

function writeDiagramFixture(root: string) {
	mkdirSync(join(root, ".diagram"), { recursive: true });
	const diagrams = ["architecture", "dependency", "security", "auth"];
	writeFileSync(
		join(root, ".diagram", "manifest.json"),
		JSON.stringify(
			{
				diagrams: diagrams.map((id) => ({ id, path: `${id}.mmd` })),
			},
			null,
		),
	);
	for (const id of diagrams) {
		writeFileSync(
			join(root, ".diagram", `${id}.mmd`),
			`graph TD\n  ${id.replace(/[^A-Za-z]/gu, "")}[${id}]\n`,
		);
	}
}

function writeArchitectureFixture(root: string, baseline = "") {
	mkdirSync(join(root, "src", "commands"), { recursive: true });
	mkdirSync(join(root, "scripts"), { recursive: true });
	writeFileSync(
		join(root, "src", "commands", "ci-migrate.ts"),
		"export const runCiMigrate = () => true;\n",
	);
	writeFileSync(
		join(root, "scripts", "validate-architecture-registries.cjs"),
		"process.exit(0);\n",
	);
	writeFileSync(join(root, ".architecture-baseline.txt"), baseline);
	writeDiagramFixture(root);
}

function runArchitectureCheck(
	root: string,
	format: "console" | "json" = "json",
) {
	return spawnSync(process.execPath, [SCRIPT_PATH, "--format", format], {
		cwd: root,
		encoding: "utf8",
	});
}

function parseJsonReport(result: ReturnType<typeof runArchitectureCheck>) {
	expect(result.stdout.trim()).toMatch(/^\{/u);
	return JSON.parse(result.stdout) as {
		status: "pass" | "fail";
		summary: {
			errors: number;
			warnings: number;
			baselined: number;
		};
		violations: Array<{
			rule: string;
			severity: string;
			file: string;
			message: string;
		}>;
	};
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("check-architecture-rules.cjs warning ownership", () => {
	it("fails unowned architecture warnings", () => {
		const root = createTempRoot("architecture-warning-unowned-");
		writeArchitectureFixture(root);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.summary).toMatchObject({
			errors: 0,
			warnings: 1,
			baselined: 0,
		});
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: "src/commands/ci-migrate.ts",
					rule: "auth-commands-use-crypto",
					severity: "warning",
				}),
			]),
		);
	});

	it("fails unowned warnings in console mode too", () => {
		const root = createTempRoot("architecture-warning-console-");
		writeArchitectureFixture(root);

		const result = runArchitectureCheck(root, "console");

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("[warning] auth-commands-use-crypto");
		expect(result.stderr).toContain("[architecture] fail:");
	});

	it("allows exact owned baselines with ticket and non-expired expiry metadata", () => {
		const root = createTempRoot("architecture-warning-owned-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-05-27|ticket=JSC-363|expires=2099-12-31",
				"",
			].join("\n"),
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.summary).toMatchObject({
			errors: 0,
			warnings: 0,
			baselined: 1,
		});
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: "src/commands/ci-migrate.ts",
					rule: "auth-commands-use-crypto",
					severity: "baseline",
				}),
			]),
		);
	});

	it("detects cycles through directory index imports", () => {
		const root = createTempRoot("architecture-directory-cycle-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-05-27|ticket=JSC-363|expires=2099-12-31",
				"",
			].join("\n"),
		);
		mkdirSync(join(root, "src", "feature"), { recursive: true });
		writeFileSync(
			join(root, "src", "entry.ts"),
			"import { feature } from './feature';\nexport const entry = feature;\n",
		);
		writeFileSync(
			join(root, "src", "feature", "index.ts"),
			"import { entry } from '../entry';\nexport const feature = entry;\n",
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: "src/entry.ts",
					rule: "no-circular-deps",
					severity: "error",
					message: expect.stringContaining("src/feature/index.ts"),
				}),
			]),
		);
	});

	it("rejects expired architecture baselines", () => {
		const root = createTempRoot("architecture-warning-expired-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-05-27|ticket=JSC-363|expires=2000-01-01",
				"",
			].join("\n"),
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: ".architecture-baseline.txt",
					rule: "architecture-baseline-metadata",
					severity: "error",
					message: expect.stringContaining("baseline entry expired"),
				}),
			]),
		);
	});

	it("rejects baseline entries without ticket metadata", () => {
		const root = createTempRoot("architecture-warning-missing-ticket-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-05-27|expires=2099-12-31",
				"",
			].join("\n"),
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: ".architecture-baseline.txt",
					rule: "architecture-baseline-metadata",
					severity: "error",
					message: expect.stringContaining("ticket=JSC-<number>"),
				}),
			]),
		);
	});

	it("rejects baseline entries with non-JSC ticket metadata", () => {
		const root = createTempRoot("architecture-warning-bad-ticket-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-05-27|ticket=NOT-JSC|expires=2099-12-31",
				"",
			].join("\n"),
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: ".architecture-baseline.txt",
					rule: "architecture-baseline-metadata",
					severity: "error",
					message: expect.stringContaining("ticket=JSC-<number>"),
				}),
			]),
		);
	});

	it("rejects malformed baseline expiry dates", () => {
		const root = createTempRoot("architecture-warning-invalid-expires-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-05-27|ticket=JSC-363|expires=2026-99-99",
				"",
			].join("\n"),
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: ".architecture-baseline.txt",
					rule: "architecture-baseline-metadata",
					severity: "error",
					message: expect.stringContaining("valid UTC YYYY-MM-DD"),
				}),
			]),
		);
	});

	it("rejects malformed baseline review dates", () => {
		const root = createTempRoot("architecture-warning-invalid-date-");
		writeArchitectureFixture(
			root,
			[
				"auth-commands-use-crypto|src/commands/ci-migrate.ts|owner=runtime-evidence-cockpit|reason=delegated auth facade tracked for follow-up|date=2026-02-31|ticket=JSC-363|expires=2099-12-31",
				"",
			].join("\n"),
		);

		const result = runArchitectureCheck(root);
		const report = parseJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.violations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					file: ".architecture-baseline.txt",
					rule: "architecture-baseline-metadata",
					severity: "error",
					message: expect.stringContaining("valid UTC YYYY-MM-DD"),
				}),
			]),
		);
	});
});
