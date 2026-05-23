import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/validate-evidence-patterns.cjs", import.meta.url),
);

const roots: string[] = [];

type PatternFixture = {
	id: string;
	status: string;
	targetSurfaces: string[];
	validationCommand?: string;
};

function makeRoot() {
	const root = mkdtempSync(join(tmpdir(), "evidence-patterns-"));
	roots.push(root);
	mkdirSync(join(root, ".harness", "research", "deep"), { recursive: true });
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(
		join(root, ".harness", "research", "deep", "fixture.md"),
		"# Fixture\n",
	);
	writeFileSync(join(root, "scripts", "enforce.sh"), "#!/usr/bin/env bash\n");
	writeFileSync(join(root, "src", "runtime.ts"), "export const ok = true;\n");
	return root;
}

function writeManifest(
	root: string,
	overrides: Record<string, Partial<PatternFixture>> = {},
) {
	const patterns: PatternFixture[] = [
		{
			id: "documented",
			status: "documented_only",
			targetSurfaces: [".harness/research/deep/fixture.md"],
		},
		{
			id: "planning",
			status: "planning_only",
			targetSurfaces: [".harness/research/deep/fixture.md"],
		},
		{
			id: "enforced",
			status: "enforcement_backed",
			targetSurfaces: ["scripts/enforce.sh"],
		},
		{
			id: "implemented",
			status: "implementation_backed",
			targetSurfaces: ["src/runtime.ts"],
		},
		{
			id: "deferred",
			status: "deferred",
			targetSurfaces: [],
		},
	].map((pattern) => ({
		dispositionReason: `${pattern.id} fixture`,
		owner: "codex",
		source: ".harness/research/deep/fixture.md",
		validationCommand: 'node -e "process.exit(0)"',
		...pattern,
		...overrides[pattern.id],
	}));
	writeFileSync(
		join(root, ".harness", "research", "evidence-patterns.json"),
		`${JSON.stringify(
			{
				lastReviewedAt: "2026-05-23",
				patterns,
				schemaVersion: "evidence-patterns/v1",
			},
			null,
			2,
		)}\n`,
	);
}

function runValidator(root: string, ...args: string[]) {
	return spawnSync(
		process.execPath,
		[SCRIPT_PATH, "--root", root, "--json", ...args],
		{
			encoding: "utf8",
			env: {
				...process.env,
				SHELL: "/bin/sh",
			},
		},
	);
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("validate-evidence-patterns script", () => {
	it("strict mode validates all five evidence-pattern status states", () => {
		const root = makeRoot();
		writeManifest(root);

		const result = runValidator(root, "--strict-adopted");
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.strictAdopted).toBe(true);
		expect(report.statusSummary.counts).toMatchObject({
			deferred: 1,
			documented_only: 1,
			enforcement_backed: 1,
			implementation_backed: 1,
			planning_only: 1,
		});
		expect(report.validationCommands).toHaveLength(1);
		expect(report.validationCommands[0]).toMatchObject({
			declaredValidationCommand: 'node -e "process.exit(0)"',
			executedCommand: 'node -e "process.exit(0)"',
			status: "pass",
		});
	});

	it("allows non-adopted evidence patterns without executable commands", () => {
		const root = makeRoot();
		writeManifest(root, {
			deferred: {
				validationCommand: "",
			},
			documented: {
				validationCommand: "",
			},
			planning: {
				validationCommand: "",
			},
		});

		const result = runValidator(root, "--strict-adopted");
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.errors).toEqual([]);
	});

	it("strict mode fails an adopted pattern without a validation command", () => {
		const root = makeRoot();
		writeManifest(root, {
			implemented: {
				validationCommand: "",
			},
		});

		const result = runValidator(root, "--strict-adopted");
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "adopted_validation_command_missing",
					patternId: "implemented",
				}),
			]),
		);
	});

	it("strict mode fails an adopted pattern whose declared command fails", () => {
		const root = makeRoot();
		writeManifest(root, {
			enforced: {
				validationCommand: 'node -e "process.exit(7)"',
			},
		});

		const result = runValidator(root, "--strict-adopted");
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.validationCommands).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					declaredValidationCommand: 'node -e "process.exit(7)"',
					executedCommand: 'node -e "process.exit(7)"',
					status: "fail",
				}),
			]),
		);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "validation_command_failed",
					command: 'node -e "process.exit(7)"',
				}),
			]),
		);
	});

	it("strict mode fails a timed-out adopted validation command", () => {
		const root = makeRoot();
		writeManifest(root, {
			enforced: {
				validationCommand: 'node -e "setTimeout(() => {}, 1000)"',
			},
		});

		const result = runValidator(
			root,
			"--strict-adopted",
			"--command-timeout-ms",
			"25",
		);
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.validationCommands).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					declaredValidationCommand: 'node -e "setTimeout(() => {}, 1000)"',
					executedCommand: 'node -e "setTimeout(() => {}, 1000)"',
					status: "fail",
					timedOut: true,
				}),
			]),
		);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "validation_command_failed",
					timedOut: true,
				}),
			]),
		);
	});

	it("normalizes legacy adopted and rejected status aliases", () => {
		const root = makeRoot();
		writeManifest(root, {
			deferred: {
				status: "rejected",
			},
			implemented: {
				status: "adopted",
			},
		});

		const result = runValidator(root, "--strict-adopted");
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(0);
		expect(report.statusSummary.patterns).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "implemented",
					sourceStatus: "adopted",
					status: "implementation_backed",
				}),
				expect.objectContaining({
					id: "deferred",
					sourceStatus: "rejected",
					status: "deferred",
				}),
			]),
		);
	});

	it("rejects unknown flags instead of silently passing", () => {
		const root = makeRoot();
		writeManifest(root);

		const result = runValidator(root, "--strict-adoptted");
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(2);
		expect(report.status).toBe("usage");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "usage_unknown_option",
				}),
			]),
		);
	});
});
