import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts",
	"check-pr-closeout-truth-contract.cjs",
);
const REQUIRED_FILES = [
	"src/lib/pr-closeout.ts",
	"src/lib/pr-closeout/claims.ts",
	"src/lib/pr-closeout.test.ts",
	"src/commands/pr-closeout.test.ts",
];

interface GateFinding {
	id: string;
	severity: "error";
	file: string;
	message: string;
	remediation: string;
}

interface GateResult {
	schemaVersion: "architecture-invariant-gate/v1";
	gateId: "pr-closeout-truth-contract";
	status: "pass" | "fail";
	findings: GateFinding[];
}

function runGate(root = process.cwd()) {
	return spawnSync("node", [SCRIPT_PATH, "--json", "--root", root], {
		cwd: process.cwd(),
		encoding: "utf-8",
	});
}

function parseGateResult(stdout: string): GateResult {
	return JSON.parse(stdout) as GateResult;
}

function copyFixtureWorkspace(tempDir: string): void {
	for (const relativePath of REQUIRED_FILES) {
		const source = join(process.cwd(), relativePath);
		const target = join(tempDir, relativePath);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, readFileSync(source, "utf-8"), "utf-8");
	}
	const scriptTarget = join(
		tempDir,
		"scripts",
		"check-pr-closeout-truth-contract.cjs",
	);
	mkdirSync(dirname(scriptTarget), { recursive: true });
	writeFileSync(scriptTarget, readFileSync(SCRIPT_PATH, "utf-8"), "utf-8");
	chmodSync(scriptTarget, 0o755);
}

describe("pr-closeout truth contract invariant gate", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("passes the live pr-closeout/v1 claim-evidence contract", () => {
		const result = runGate();
		const report = parseGateResult(result.stdout);

		expect(result.status).toBe(0);
		expect(report).toMatchObject({
			schemaVersion: "architecture-invariant-gate/v1",
			gateId: "pr-closeout-truth-contract",
			status: "pass",
			findings: [],
		});
	});

	it("emits actionable machine-readable failures when required fields drift", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-closeout-truth-contract-"));
		tempDirs.push(tempDir);
		copyFixtureWorkspace(tempDir);

		const claimsPath = join(tempDir, "src/lib/pr-closeout/claims.ts");
		const claimsSource = readFileSync(claimsPath, "utf-8").replace(
			/\n\s*verifiedAt:\s*string;\n/u,
			"\n",
		);
		writeFileSync(claimsPath, claimsSource, "utf-8");

		const result = spawnSync(
			"node",
			[
				join(tempDir, "scripts", "check-pr-closeout-truth-contract.cjs"),
				"--json",
			],
			{ cwd: tempDir, encoding: "utf-8" },
		);
		const report = parseGateResult(result.stdout);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				id: "claim-field-verifiedAt",
				file: "src/lib/pr-closeout/claims.ts",
				message: "PrCloseoutClaim is missing required field: verifiedAt",
				remediation: expect.stringContaining("Add verifiedAt"),
			}),
		);
	});

	it("emits fixture-specific failures when false-success coverage is removed", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-closeout-truth-fixture-"));
		tempDirs.push(tempDir);
		copyFixtureWorkspace(tempDir);

		const testPath = join(tempDir, "src/lib/pr-closeout.test.ts");
		const testSource = readFileSync(testPath, "utf-8").replace(
			"blocks success when rollback evidence is missing",
			"allows rollback evidence to drift",
		);
		writeFileSync(testPath, testSource, "utf-8");

		const result = spawnSync(
			"node",
			[
				join(tempDir, "scripts", "check-pr-closeout-truth-contract.cjs"),
				"--json",
			],
			{ cwd: tempDir, encoding: "utf-8" },
		);
		const report = parseGateResult(result.stdout);

		expect(result.status).toBe(1);
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				id: "missing-rollback-fixture",
				file: "src/lib/pr-closeout.test.ts",
				message: "missing rollback fixture is absent",
			}),
		);
	});
});
