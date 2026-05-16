import {
	readFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRuleLifecycleGate } from "../lib/rule-lifecycle.js";
import { runRuleLifecycleGateCLI } from "./rule-lifecycle-gate.js";

const RULE_LIFECYCLE_SCHEMA = readFileSync(
	resolve(process.cwd(), "docs/rule-lifecycle.schema.json"),
	"utf-8",
);

describe("rule-lifecycle-gate", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		for (const path of cleanup.splice(0)) {
			rmSync(path, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function makeRepo(rules: unknown[]): string {
		const repoRoot = mkdtempSync(join(tmpdir(), "rule-lifecycle-"));
		cleanup.push(repoRoot);
		mkdirSync(join(repoRoot, ".harness"), { recursive: true });
		mkdirSync(join(repoRoot, "docs"), { recursive: true });
		writeFileSync(
			join(repoRoot, "docs/rule-lifecycle.schema.json"),
			RULE_LIFECYCLE_SCHEMA,
		);
		writeFileSync(
			join(repoRoot, ".harness/rule-lifecycle-manifest.json"),
			JSON.stringify(
				{
					schemaVersion: "rule-lifecycle-manifest/v1",
					rules,
				},
				null,
				2,
			),
		);
		return repoRoot;
	}

	function activeRule(
		overrides: Record<string, unknown> = {},
	): Record<string, unknown> {
		return {
			id: "ci-security-authority",
			title: "CI security authority must stay explicit",
			status: "active",
			owner: "ci-security-governance",
			scope: [
				".circleci/config.yml",
				"docs/agents/06-security-and-governance.md",
			],
			evidence: ["incident:2026-05-16-circleci-snyk-authority-drift"],
			enforcement: ["ci", "doc"],
			enforcementRefs: [
				"security-scan",
				"docs/agents/06-security-and-governance.md",
			],
			lastReviewedAt: "2026-05-16",
			reviewCadenceDays: 90,
			removalCondition:
				"Retire only after the security authority contract migrates and replacement checks are green.",
			...overrides,
		};
	}

	it("passes active and superseded rules with ownership, evidence, enforcement, freshness, and retirement metadata", () => {
		const repoRoot = makeRepo([
			activeRule(),
			activeRule({
				id: "legacy-circleci-snyk-blocking",
				title: "Legacy CircleCI Snyk blocking scan",
				status: "superseded",
				supersededBy: "ci-security-authority",
				removalCondition:
					"Remove after every generated CI template points at ci-security-authority.",
			}),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("pass");
		expect(result.summary).toMatchObject({
			errors: 0,
			warnings: 0,
			rules: 2,
		});
	});

	it("fails when a rule omits owner metadata", () => {
		const repoRoot = makeRepo([activeRule({ owner: "" })]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.owner.missing",
					ruleId: "ci-security-authority",
					severity: "error",
				}),
			]),
		);
	});

	it("fails when a rule omits evidence metadata", () => {
		const repoRoot = makeRepo([activeRule({ evidence: [""] })]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.evidence.missing",
				}),
			]),
		);
	});

	it("fails when enforcement destinations or references are missing", () => {
		const repoRoot = makeRepo([
			activeRule({ enforcement: [], enforcementRefs: [""] }),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.enforcement_missing",
				}),
			]),
		);
	});

	it("fails when a retired rule points at an unknown replacement", () => {
		const repoRoot = makeRepo([
			activeRule({ id: "active-replacement" }),
			activeRule({
				id: "legacy-rule",
				status: "superseded",
				supersededBy: "missing-replacement",
			}),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.supersession_unknown",
				}),
			]),
		);
	});

	it("fails when a deprecated rule does not point at a replacement", () => {
		const repoRoot = makeRepo([
			activeRule({ id: "active-replacement" }),
			activeRule({ id: "legacy-rule", status: "deprecated" }),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.supersession_missing",
				}),
			]),
		);
	});

	it("fails when a rule is past its review cadence", () => {
		const repoRoot = makeRepo([
			activeRule({ lastReviewedAt: "2026-01-01", reviewCadenceDays: 30 }),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-03-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.stale",
					severity: "error",
				}),
			]),
		);
	});

	it("fails impossible calendar dates instead of normalizing them", () => {
		const repoRoot = makeRepo([
			activeRule({ lastReviewedAt: "2026-02-30", reviewCadenceDays: 90 }),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-03-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.rule.last_reviewed_invalid",
					severity: "error",
				}),
			]),
		);
	});

	it("fails empty manifests", () => {
		const repoRoot = makeRepo([]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.manifest.rules_missing",
					severity: "error",
				}),
			]),
		);
	});

	it("fails manifests outside the repository", () => {
		const repoRoot = makeRepo([activeRule()]);
		const externalRoot = mkdtempSync(
			join(tmpdir(), "external-rule-lifecycle-"),
		);
		cleanup.push(externalRoot);
		const externalManifest = join(externalRoot, "rule-lifecycle-manifest.json");
		writeFileSync(
			externalManifest,
			JSON.stringify(
				{
					schemaVersion: "rule-lifecycle-manifest/v1",
					rules: [activeRule()],
				},
				null,
				2,
			),
		);

		const result = runRuleLifecycleGate({
			repoRoot,
			manifestPath: resolve(externalManifest),
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.manifest.outside_repo",
					severity: "error",
				}),
			]),
		);
	});

	it("fails manifests that resolve outside the repository through symlinks", () => {
		const repoRoot = makeRepo([activeRule()]);
		rmSync(join(repoRoot, ".harness/rule-lifecycle-manifest.json"), {
			force: true,
		});
		const externalRoot = mkdtempSync(
			join(tmpdir(), "external-rule-lifecycle-"),
		);
		cleanup.push(externalRoot);
		const externalManifest = join(externalRoot, "rule-lifecycle-manifest.json");
		writeFileSync(
			externalManifest,
			JSON.stringify(
				{
					schemaVersion: "rule-lifecycle-manifest/v1",
					rules: [activeRule()],
				},
				null,
				2,
			),
		);
		symlinkSync(
			externalManifest,
			join(repoRoot, ".harness/rule-lifecycle-manifest.json"),
		);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.manifest.outside_repo",
					severity: "error",
				}),
			]),
		);
	});

	it("fails supersession chains that cycle instead of reaching an active rule", () => {
		const repoRoot = makeRepo([
			activeRule({ id: "active-replacement" }),
			activeRule({
				id: "retired-rule-a",
				status: "superseded",
				supersededBy: "retired-rule-b",
			}),
			activeRule({
				id: "retired-rule-b",
				status: "superseded",
				supersededBy: "retired-rule-a",
			}),
		]);

		const result = runRuleLifecycleGate({
			repoRoot,
			now: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				id: "rule-lifecycle.rule.supersession_cycle",
				severity: "error",
			}),
		);
	});

	it("fails invalid manifests with duplicate ids or unsafe scope paths", () => {
		const repoRoot = makeRepo([
			activeRule({ id: "duplicate-rule" }),
			activeRule({ id: "duplicate-rule", scope: ["../escaped"] }),
		]);

		const result = runRuleLifecycleGate({ repoRoot });

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.manifest.invalid",
				}),
			]),
		);
	});

	it("rejects root and rule fields not admitted by the lifecycle schema", () => {
		const repoRoot = makeRepo([activeRule({ untrackedField: true })]);
		writeFileSync(
			join(repoRoot, ".harness/rule-lifecycle-manifest.json"),
			JSON.stringify(
				{
					schemaVersion: "rule-lifecycle-manifest/v1",
					rules: [activeRule({ untrackedField: true })],
					untrackedRoot: true,
				},
				null,
				2,
			),
		);

		const result = runRuleLifecycleGate({ repoRoot });

		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "rule-lifecycle.manifest.invalid",
					message: expect.stringContaining(
						"Unexpected property: untrackedRoot",
					),
				}),
				expect.objectContaining({
					id: "rule-lifecycle.manifest.invalid",
					message: expect.stringContaining(
						"rules[0] has unexpected field: untrackedField",
					),
				}),
			]),
		);
	});

	it("resolves the lifecycle schema from the repo root instead of process cwd", () => {
		const repoRoot = makeRepo([activeRule()]);
		const otherCwd = mkdtempSync(join(tmpdir(), "rule-lifecycle-cwd-"));
		cleanup.push(otherCwd);
		const originalCwd = process.cwd();

		try {
			process.chdir(otherCwd);
			const result = runRuleLifecycleGate({
				repoRoot,
				now: new Date("2026-06-01T12:00:00.000Z"),
			});

			expect(result.status).toBe("pass");
			expect(result.findings).toEqual([]);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it("prints JSON and returns a failing exit code for blocking findings", () => {
		const repoRoot = makeRepo([activeRule({ owner: "" })]);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runRuleLifecycleGateCLI({ repoRoot, json: true });

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.schemaVersion).toBe("rule-lifecycle-gate/v1");
		expect(payload.status).toBe("fail");
	});
});
