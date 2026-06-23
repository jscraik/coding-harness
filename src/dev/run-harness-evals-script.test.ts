import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNodeScript } from "./script-test-utils.js";

const REPO_ROOT = process.cwd();
const SCRIPT_PATH = join(REPO_ROOT, "scripts/run-harness-evals.mjs");
const tempRoots: string[] = [];

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("run-harness-evals.mjs", () => {
	it("emits structured JSON when path arguments escape the repository", () => {
		const outputRoot = mkdtempSync(join(REPO_ROOT, ".cache/eval-script-test-"));
		tempRoots.push(outputRoot);

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			"../outside-registry.json",
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			findings: Array<{ id: string; severity: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.schemaVersion).toBe("harness-eval-result/v1");
		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "args.registry",
					severity: "error",
				}),
			]),
		);
	});

	it("rejects symlinked registry files instead of following them", () => {
		const outputRoot = mkdtempSync(join(REPO_ROOT, ".cache/eval-script-test-"));
		const externalRoot = mkdtempSync(join(tmpdir(), "eval-script-external-"));
		tempRoots.push(outputRoot, externalRoot);
		const externalRegistry = join(externalRoot, "registry.json");
		writeFileSync(
			externalRegistry,
			JSON.stringify({
				schemaVersion: "harness-north-star-agent-delivery-evals/v1",
				northStarGoal: "external symlink fixture",
				scorecard: [],
				observabilityContract: { schemaVersion: "braintrust-log-data/v1" },
				evaluationContract: {},
				scenarios: [],
			}),
		);
		const registryLink = join(outputRoot, "registry-link.json");
		symlinkSync(externalRegistry, registryLink);
		mkdirSync(join(outputRoot, "fixtures"), { recursive: true });

		const result = runNodeScript(SCRIPT_PATH, [
			"--registry",
			relative(REPO_ROOT, registryLink),
			"--output",
			relative(REPO_ROOT, join(outputRoot, "result.json")),
			"--observability-output",
			relative(REPO_ROOT, join(outputRoot, "observability.json")),
			"--fixture-root",
			relative(REPO_ROOT, join(outputRoot, "fixtures")),
		]);
		const report = JSON.parse(result.stdout) as {
			status: string;
			findings: Array<{ id: string; message: string }>;
		};

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "registry.load",
					message: expect.stringContaining("Invalid file path"),
				}),
			]),
		);
	});
});
