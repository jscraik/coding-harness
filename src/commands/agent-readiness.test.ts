import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findScopedInstructionFiles } from "../lib/agent-readiness/repo-evidence.js";
import type {
	PromptContextDriftBlocker,
	PromptContextDriftReport,
} from "../lib/prompt-context-drift/index.js";

import {
	assessAgentReadiness,
	runAgentReadinessCLI,
} from "./agent-readiness.js";

describe("agent-readiness command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it("passes when all core agent-readiness surfaces are present", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});

		expect(report.schemaVersion).toBe("agent-readiness/v1");
		expect(report.status).toBe("pass");
		expect(report.contextHealth).toMatchObject({
			schemaVersion: "agent-readiness-context-health/v1",
			status: "pass",
			evidenceUse: "orientation",
			canonicalReport: {
				schemaVersion: "context-health-report/v1",
				command: "node --import tsx src/cli.ts context-health --json",
				prerequisiteStatus: "pass",
			},
		});
		expect(report.contextHealth.surfaces.map((surface) => surface.id)).toEqual([
			"active_artifacts",
			"active_route_refs",
			"project_brain_memory",
			"project_brain_knowledge",
			"runtime_card",
			"prompt_context_drift",
			"external_horizon",
		]);
		expect(report.summary.fail).toBe(0);
		expect(report.findings.map((finding) => finding.id)).toContain(
			"capabilities.browser_or_screenshot",
		);
		expect(
			report.findings.find(
				(finding) => finding.id === "traceability.session_records",
			)?.evidence,
		).toEqual(["docs/architecture/agent-run-records.md"]);
	});

	it("fails when baseline instructions, artifacts, tests, and gates are missing", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "agent-readiness-empty-"));
		tempDirs.push(repoRoot);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "instructions.root_agents",
					status: "fail",
				}),
				expect.objectContaining({
					id: "artifacts.harness_map",
					status: "fail",
				}),
				expect.objectContaining({
					id: "capabilities.tests",
					status: "fail",
				}),
				expect.objectContaining({
					id: "approval_gates.destructive_actions",
					status: "fail",
				}),
			]),
		);
	});

	it("prints JSON and returns success for warning-free readiness", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runAgentReadinessCLI(["--repo-root", repoRoot, "--json"]);

		expect(exitCode).toBe(0);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			'"schemaVersion": "agent-readiness/v1"',
		);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain(
			'"schemaVersion": "agent-readiness-context-health/v1"',
		);
		expect(String(infoSpy.mock.calls[0]?.[0])).toContain('"status": "pass"');
	});

	it("warns when current active route references missing files", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			[
				"# Active",
				"",
				"## Current Active Route",
				"",
				"| Work | Refs |",
				"|---|---|",
				"| Missing | `.harness/specs/missing.md` |",
				"",
				"## Artifact Index",
			].join("\n"),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const activeRouteSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "active_route_refs",
		);

		expect(report.status).toBe("warn");
		expect(activeRouteSurface).toMatchObject({
			status: "warn",
			evidenceUse: "orientation",
			staleReasons: [
				"Active route ref `.harness/specs/missing.md` declared by .harness/active-artifacts.md#Current Active Route is missing.",
			],
			missingRefs: [
				{
					ref: ".harness/specs/missing.md",
					declaredBy: ".harness/active-artifacts.md#Current Active Route",
					normalizedPath: ".harness/specs/missing.md",
					reason: "missing_ref",
				},
			],
		});
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				id: "context_health.active_route_refs",
				category: "context_health",
				status: "warn",
			}),
		);
	});

	it("resolves current active route shorthand relative to the route file", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			[
				"# Active",
				"",
				"## Current Active Route",
				"",
				"| Work | Refs |",
				"|---|---|",
				"| Ready | `docs/goals/demo/current-route.json` plus `state.yaml`, `notes/execution-tracker.md`, and `receipts.jsonl`. Latest receipt is `abc123`. |",
				"",
				"## Artifact Index",
			].join("\n"),
		);
		writeRepoFile(repoRoot, "docs/goals/demo/current-route.json", "{}\n");
		writeRepoFile(repoRoot, "docs/goals/demo/state.yaml", "status: active\n");
		writeRepoFile(
			repoRoot,
			"docs/goals/demo/notes/execution-tracker.md",
			"# Tracker\n",
		);
		writeRepoFile(repoRoot, "docs/goals/demo/receipts.jsonl", "{}\n");

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const activeRouteSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "active_route_refs",
		);

		expect(activeRouteSurface).toMatchObject({
			status: "pass",
			staleReasons: [],
			missingRefs: [],
			evidence: [
				".harness/active-artifacts.md",
				"docs/goals/demo/current-route.json",
				"docs/goals/demo/state.yaml",
				"docs/goals/demo/notes/execution-tracker.md",
				"docs/goals/demo/receipts.jsonl",
			],
		});
	});

	it("warns when prompt-context drift report spoofs pass without validating", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			JSON.stringify({ overallStatus: "pass" }),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(report.status).toBe("warn");
		expect(promptContextSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				expect.stringContaining(
					"Prompt-context-drift report failed validation",
				),
			],
		});
	});

	it("accepts regular prompt-context drift reports through guarded reads", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			JSON.stringify(promptContextDriftReportForReadyRepo(repoRoot)),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "pass",
			staleReasons: [],
		});
	});

	it.each([
		{
			name: "empty",
			content: "",
			expected: { staleReasons: ["Prompt-context-drift report is empty."] },
		},
		{
			name: "oversized",
			content: "x".repeat(1_000_001),
			expected: {
				evidence: [
					"missing:artifacts/context-integrity/prompt-context-drift-report.json",
				],
				staleReasons: [
					"No prompt-context-drift report was provided for agent-readable orientation.",
				],
			},
		},
	])("warns when guarded prompt-context drift report is $name", ({
		content,
		expected,
	}) => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			content,
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			...expected,
		});
	});

	it("warns when prompt-context drift report is invalid JSON", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			"{not-json",
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				expect.stringContaining(
					"Prompt-context-drift report is not valid JSON",
				),
			],
		});
	});

	it("warns when prompt-context drift report validates but is not pass", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const driftReport = promptContextDriftReportForReadyRepo(repoRoot);
		driftReport.evidenceUse = "orientation";
		driftReport.overallStatus = "warn";
		driftReport.surfaces = driftReport.surfaces.map((surface) => ({
			...surface,
			status: "warn",
			evidenceUse: "orientation",
			requiredForClaimSupport: false,
			sourceRefs: surface.sourceRefs.map((sourceRef) => ({
				...sourceRef,
				evidenceUse: "orientation",
				requiredForClaimSupport: false,
			})),
		}));
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			JSON.stringify(driftReport),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				"Prompt-context-drift report is not pass for orientation.",
			],
		});
	});

	it("routes prompt-context drift blockers to their repair lane", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const blocker: PromptContextDriftBlocker = {
			blockerClass: "stale_runtime_card",
			reason: "No local runtime-card artifact was discovered.",
			nextActionClass: "refresh_runtime_card",
		};
		const driftReport = promptContextDriftReportForReadyRepo(repoRoot);
		driftReport.evidenceUse = "orientation";
		driftReport.overallStatus = "warn";
		driftReport.blockers = [blocker];
		driftReport.surfaces = driftReport.surfaces.map((surface) =>
			surface.surfaceId === "runtime_card_or_handoff"
				? {
						...surface,
						status: "warn",
						evidenceUse: "orientation",
						requiredForClaimSupport: false,
						blockers: [blocker],
						sourceRefs: surface.sourceRefs.map((sourceRef) => ({
							...sourceRef,
							evidenceUse: "orientation",
							requiredForClaimSupport: false,
						})),
					}
				: {
						...surface,
						evidenceUse: "orientation",
						requiredForClaimSupport: false,
						sourceRefs: surface.sourceRefs.map((sourceRef) => ({
							...sourceRef,
							evidenceUse: "orientation",
							requiredForClaimSupport: false,
						})),
					},
		);
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			JSON.stringify(driftReport),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			suggestedRefreshCommands: [
				"harness runtime-card --json --repo . --out artifacts/runtime-card.json",
			],
		});
	});

	it("warns when prompt-context drift report claims pass with missing surfaces", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const driftReport = promptContextDriftReportForReadyRepo(repoRoot);
		driftReport.evidenceUse = "orientation";
		driftReport.surfaces = driftReport.surfaces
			.filter((surface) => surface.surfaceId !== "active_route")
			.map((surface) => ({
				...surface,
				evidenceUse: "orientation",
				requiredForClaimSupport: false,
				sourceRefs: surface.sourceRefs.map((sourceRef) => ({
					...sourceRef,
					evidenceUse: "orientation",
					requiredForClaimSupport: false,
				})),
			}));
		writeRepoFile(
			repoRoot,
			"artifacts/context-integrity/prompt-context-drift-report.json",
			JSON.stringify(driftReport),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				"Prompt-context-drift report claims pass while required surface active_route is missing.",
			],
		});
	});

	it("warns when multiple prompt-context drift reports create ambiguous authority", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			"artifacts/prompt-context-drift-report.json",
			JSON.stringify(promptContextDriftReportForReadyRepo(repoRoot)),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(report.status).toBe("warn");
		expect(promptContextSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				expect.stringContaining(
					"Multiple prompt-context-drift reports were discovered",
				),
			],
			suggestedRefreshCommands: [
				"rm artifacts/prompt-context-drift-report.json",
			],
		});
	});

	it("routes symlinked prompt-context drift reports to the writer", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const canonicalReport =
			"artifacts/context-integrity/prompt-context-drift-report.json";
		const outsideDir = mkdtempSync(join(tmpdir(), "prompt-context-outside-"));
		tempDirs.push(outsideDir);
		const outsideReport = join(outsideDir, "prompt-context-drift-report.json");
		writeFileSync(
			outsideReport,
			JSON.stringify(promptContextDriftReportForReadyRepo(repoRoot)),
		);
		rmSync(repoPath(repoRoot, canonicalReport), { force: true });
		symlinkSync(outsideReport, repoPath(repoRoot, canonicalReport));

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			evidence: [`missing:${canonicalReport}`],
			suggestedRefreshCommands: [
				"harness prompt-context-drift:write",
				`harness prompt-context-drift:validate ${canonicalReport}`,
			],
		});
	});

	it("refreshes an alternate prompt-context drift report in place", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const alternateReportPath =
			".harness/runtime/prompt-context-drift-report.json";
		rmSync(
			repoPath(
				repoRoot,
				"artifacts/context-integrity/prompt-context-drift-report.json",
			),
		);
		writeRepoFile(repoRoot, alternateReportPath, "{not-json");

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const promptContextSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "prompt_context_drift",
		);

		expect(promptContextSurface).toMatchObject({
			status: "warn",
			suggestedRefreshCommands: [
				`harness prompt-context-drift:write --output ${alternateReportPath}`,
				`harness prompt-context-drift:validate ${alternateReportPath}`,
			],
		});
	});

	it("warns when current active route mixes in a row marked not current", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			[
				"# Active",
				"",
				"## Current Active Route",
				"",
				"| Work | Refs | Status |",
				"|---|---|---|",
				"| Current | `.harness/specs/ready.md` | Current active route |",
				"| Old | `.harness/plan/ready.md` | Active but not the current execution route |",
				"",
				"## Artifact Index",
			].join("\n"),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const activeRouteSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "active_route_refs",
		);

		expect(report.status).toBe("warn");
		expect(activeRouteSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				"Current Active Route contains a row marked not the current execution route.",
			],
		});
	});

	it("accepts safe repo-relative active-route refs outside common path prefixes", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(repoRoot, ".github/workflows/ci.yml", "name: CI\n");
		writeRepoFile(repoRoot, "templates/runtime-card.md", "# Template\n");
		writeRepoFile(repoRoot, "contracts/runtime-card.json", "{}\n");
		writeRepoFile(repoRoot, "docs/specs/with spaces.md", "# Spec\n");
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			[
				"# Active",
				"",
				"## Current Active Route",
				"",
				"| Work | Refs |",
				"|---|---|",
				"| Ready | `.github/workflows/ci.yml`; `templates/runtime-card.md`; `contracts/runtime-card.json`; `docs/specs/with spaces.md` |",
				"",
				"## Artifact Index",
			].join("\n"),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const activeRouteSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "active_route_refs",
		);

		expect(activeRouteSurface).toMatchObject({
			status: "pass",
			staleReasons: [],
		});
		expect(activeRouteSurface?.evidence).toEqual(
			expect.arrayContaining([
				".github/workflows/ci.yml",
				"templates/runtime-card.md",
				"contracts/runtime-card.json",
				"docs/specs/with spaces.md",
			]),
		);
	});

	it("ignores unsafe active-route tokens before checking repo evidence", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			[
				"# Active",
				"",
				"## Current Active Route",
				"",
				"| Work | Refs |",
				"|---|---|",
				"| Unsafe | `/tmp/outside.md`; `../outside.md`; `https://example.test/spec.md`; `docs/spec.md; rm -rf .` |",
				"",
				"## Artifact Index",
			].join("\n"),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const activeRouteSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "active_route_refs",
		);

		expect(activeRouteSurface).toMatchObject({
			status: "warn",
			evidence: [".harness/active-artifacts.md"],
			staleReasons: [
				"Current Active Route does not contain repo-relative artifact refs.",
			],
		});
	});

	it("explains malformed active-artifacts context instead of emitting an empty warning", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			["# Active", "", "## Artifact Index"].join("\n"),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const activeArtifactsSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "active_artifacts",
		);

		expect(report.status).toBe("warn");
		expect(activeArtifactsSurface).toMatchObject({
			status: "warn",
			staleReasons: [
				".harness/active-artifacts.md is missing the Current Active Route section.",
			],
		});
	});

	it("warns rather than fails when Project Brain memory or knowledge is absent", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		rmSync(join(repoRoot, ".harness", "memory"), {
			recursive: true,
			force: true,
		});
		rmSync(join(repoRoot, ".harness", "knowledge"), {
			recursive: true,
			force: true,
		});

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});

		expect(report.status).toBe("warn");
		expect(report.summary.fail).toBe(0);
		expect(report.contextHealth.surfaces).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "project_brain_memory",
					status: "warn",
					evidenceUse: "orientation",
				}),
				expect.objectContaining({
					id: "project_brain_knowledge",
					status: "warn",
					evidenceUse: "orientation",
				}),
			]),
		);
	});

	it("uses prerequisite-aware context-health refresh guidance", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		const readyReport = assessAgentReadiness({ repoRoot });
		const missingContractRepo = makeAgentReadyRepo(tempDirs);
		rmSync(join(missingContractRepo, "harness.contract.json"), { force: true });
		const missingContractReport = assessAgentReadiness({
			repoRoot: missingContractRepo,
		});

		expect(readyReport.contextHealth.suggestedRefreshCommands).toContain(
			"node --import tsx src/cli.ts context-health --json",
		);
		expect(
			missingContractReport.contextHealth.suggestedRefreshCommands,
		).toEqual(
			expect.arrayContaining([
				"node --import tsx src/cli.ts --help --all-commands",
				"node --import tsx src/cli.ts init --dry-run --json",
			]),
		);
		expect(
			missingContractReport.contextHealth.suggestedRefreshCommands,
		).not.toContain("node --import tsx src/cli.ts context-health --json");
	});

	it("presents context refresh commands as separate options, not a shell chain", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		rmSync(join(repoRoot, "harness.contract.json"), { force: true });
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runAgentReadinessCLI([repoRoot]);
		const output = infoSpy.mock.calls.map((call) => String(call[0])).join("\n");

		expect(exitCode).toBe(0);
		expect(output).toContain("context-refresh options:");
		expect(output).toContain(
			"  - node --import tsx src/cli.ts --help --all-commands",
		);
		expect(output).toContain(
			"  - node --import tsx src/cli.ts init --dry-run --json",
		);
		expect(output).not.toContain(" && ");
		expect(output).not.toContain("; node --import");
	});

	it("does not suggest local context-health as an external horizon refresh", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		rmSync(join(repoRoot, "artifacts", "external-state-snapshot.json"), {
			force: true,
		});

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const externalHorizonSurface = report.contextHealth.surfaces.find(
			(surface) => surface.id === "external_horizon",
		);

		expect(externalHorizonSurface).toMatchObject({
			status: "warn",
			evidenceUse: "orientation",
			suggestedRefreshCommands: [],
		});
		expect(
			report.findings.find(
				(finding) => finding.id === "context_health.external_horizon",
			)?.recommendation,
		).toBeUndefined();
		expect(report.contextHealth.suggestedRefreshCommands).toContain(
			"node --import tsx src/cli.ts context-health --json",
		);
	});

	it("does not duplicate the canonical context-health report contract", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});
		const contextHealth = report.contextHealth as unknown as Record<
			string,
			unknown
		>;

		expect(report.contextHealth.schemaVersion).toBe(
			"agent-readiness-context-health/v1",
		);
		expect(report.contextHealth.canonicalReport.schemaVersion).toBe(
			"context-health-report/v1",
		);
		expect(contextHealth).not.toHaveProperty("artifactRefs");
		expect(contextHealth).not.toHaveProperty("metrics");
		expect(contextHealth).not.toHaveProperty("contradictionHistory");
		expect(contextHealth).not.toHaveProperty("inventoryMetrics");
	});

	it("returns usage error when repo-root flag value is missing", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runAgentReadinessCLI(["--repo-root", "--json"]);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));

		expect(exitCode).toBe(2);
		expect(payload).toEqual({
			schemaVersion: "agent-readiness-error/v1",
			status: "error",
			error: {
				code: "agent-readiness.flag_value_required",
				message: "harness agent-readiness requires a value after --repo-root.",
			},
		});
	});

	it("lets repo-root flag override a positional path", () => {
		const emptyRepoRoot = mkdtempSync(join(tmpdir(), "agent-readiness-empty-"));
		tempDirs.push(emptyRepoRoot);
		const readyRepoRoot = makeAgentReadyRepo(tempDirs);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runAgentReadinessCLI([
			emptyRepoRoot,
			"--repo-root",
			readyRepoRoot,
			"--json",
		]);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));

		expect(exitCode).toBe(0);
		expect(payload.repoRoot).toBe(readyRepoRoot);
		expect(payload.status).toBe("pass");
	});

	it("rejects placeholder package test scripts", () => {
		const repoRoot = makeAgentReadyRepo(tempDirs);
		writeRepoFile(
			repoRoot,
			"package.json",
			JSON.stringify({
				scripts: {
					test: 'echo "Error: no test specified" && exit 1',
					"test:deep": "vitest run",
				},
			}),
		);

		const report = assessAgentReadiness({
			repoRoot,
			now: new Date("2026-05-26T12:00:00.000Z"),
		});

		expect(report.findings).toContainEqual(
			expect.objectContaining({
				id: "capabilities.tests",
				status: "fail",
			}),
		);
	});

	it("does not follow symlinked directories while finding scoped instructions", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "agent-readiness-symlink-"));
		const externalRoot = mkdtempSync(
			join(tmpdir(), "agent-readiness-external-"),
		);
		tempDirs.push(repoRoot, externalRoot);
		mkdirSync(join(repoRoot, "docs"), { recursive: true });
		writeRepoFile(externalRoot, "AGENTS.md", "# External instructions\n");
		symlinkSync(externalRoot, join(repoRoot, "docs", "external"), "dir");

		expect(findScopedInstructionFiles(repoRoot)).toEqual([]);
	});

	it("ignores runtime output directories while finding scoped instructions", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "agent-readiness-ignored-"));
		tempDirs.push(repoRoot);
		writeRepoFile(repoRoot, "AGENTS.md", "# Root instructions\n");
		writeRepoFile(repoRoot, "docs/team/AGENTS.md", "# Team instructions\n");
		writeRepoFile(
			repoRoot,
			".harness/media/AGENTS.md",
			"# Generated media instructions\n",
		);
		writeRepoFile(
			repoRoot,
			"artifacts/reviews/AGENTS.md",
			"# Review artifact instructions\n",
		);

		expect(findScopedInstructionFiles(repoRoot)).toEqual([
			"docs/team/AGENTS.md",
		]);
	});
});

// Shared by ready fixture writes and prompt-context drift digest expectations.
const READY_REPO_SOURCE_TEXT = {
	"AGENTS.md": [
		"# Agent Instructions",
		"PR bodies require a session or traceability reference.",
		"Use task-specific docs and codestyle before edits.",
	].join("\n"),
	".harness/active-artifacts.md": [
		"# Active",
		"",
		"## Current Active Route",
		"",
		"| Work | Refs |",
		"|---|---|",
		"| Ready | `.harness/plan/ready.md`; `.harness/specs/ready.md` |",
		"",
		"## Artifact Index",
	].join("\n"),
	".harness/plan/ready.md": "# Ready Plan\n",
	".harness/memory/LEARNINGS.md": "# Learnings\n",
	".harness/knowledge/INDEX.md": "# Knowledge\n",
	".harness/runtime/runtime-card.json": "{}\n",
	"harness.contract.json": JSON.stringify({
		contextIntegrityPolicy: { mode: "advisory" },
		toolingPolicy: {
			sharedStateActions: [
				{ name: "stage", authority: "user_or_explicit_request" },
				{ name: "commit", authority: "user_or_explicit_request" },
				{ name: "push", authority: "user_or_explicit_request" },
				{ name: "merge", authority: "pull_request_policy" },
				{ name: "deploy", authority: "release_policy" },
				{
					name: "external_mutation",
					authority: "explicit_credentialed_request",
				},
			],
		},
	}),
} as const;

type ReadyRepoSourcePath = keyof typeof READY_REPO_SOURCE_TEXT;

function makeAgentReadyRepo(tempDirs: string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "agent-readiness-ready-"));
	tempDirs.push(repoRoot);
	writeRepoFile(repoRoot, "AGENTS.md", readyRepoSourceText("AGENTS.md"));
	writeRepoFile(repoRoot, "CODESTYLE.md", "# Codestyle\n");
	writeRepoFile(repoRoot, "codestyle/README.md", "# Codestyle Map\n");
	writeRepoFile(
		repoRoot,
		"docs/agents/01-instruction-map.md",
		[
			"# Instruction Map",
			"AGENTS.md is the baseline.",
			"Use task-specific docs/agents routes for scoped work.",
		].join("\n"),
	);
	writeRepoFile(
		repoRoot,
		".harness/README.md",
		"Durable execution-input authority for harness artifacts.\n",
	);
	writeRepoFile(
		repoRoot,
		".harness/active-artifacts.md",
		readyRepoSourceText(".harness/active-artifacts.md"),
	);
	mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
	writeRepoFile(
		repoRoot,
		".harness/plan/ready.md",
		readyRepoSourceText(".harness/plan/ready.md"),
	);
	writeRepoFile(repoRoot, ".harness/specs/ready.md", "# Ready Spec\n");
	writeRepoFile(
		repoRoot,
		".harness/memory/LEARNINGS.md",
		readyRepoSourceText(".harness/memory/LEARNINGS.md"),
	);
	writeRepoFile(
		repoRoot,
		".harness/knowledge/INDEX.md",
		readyRepoSourceText(".harness/knowledge/INDEX.md"),
	);
	writeRepoFile(
		repoRoot,
		".harness/runtime/runtime-card.json",
		readyRepoSourceText(".harness/runtime/runtime-card.json"),
	);
	writeRepoFile(repoRoot, "artifacts/external-state-snapshot.json", "{}\n");
	writeRepoFile(repoRoot, "src/commands/context-health.ts", "export {};\n");
	writeRepoFile(
		repoRoot,
		"harness.contract.json",
		readyRepoSourceText("harness.contract.json"),
	);
	writeRepoFile(
		repoRoot,
		"package.json",
		JSON.stringify({
			scripts: { test: "vitest run", "test:deep": "vitest run" },
		}),
	);
	writeRepoFile(
		repoRoot,
		"docs/agents/02-tooling-policy.md",
		[
			"agent-browser and screenshot proof are available.",
			"Artifact routing is not permission to stage, commit, push, merge, or deploy.",
		].join("\n"),
	);
	writeRepoFile(
		repoRoot,
		"docs/agents/09-audit-trail-policy.md",
		"# Audit Trail\n",
	);
	writeRepoFile(
		repoRoot,
		"docs/architecture/agent-run-records.md",
		"Session trace headSha artifact references are recorded.\n",
	);
	writeRepoFile(
		repoRoot,
		"docs/agents/06-security-and-governance.md",
		"Destructive, global, and unsafe side effects require approval.\n",
	);
	writeRepoFile(
		repoRoot,
		".agents/skills/coding-harness/SKILL.md",
		"Use dry-run before destructive or approval-sensitive actions.\n",
	);
	writeRepoFile(
		repoRoot,
		"docs/agents/13-linear-production-workflow.md",
		"Linear GitHub branch commit validation evidence links are required.\n",
	);
	runGit(repoRoot, ["init"]);
	runGit(repoRoot, ["config", "user.name", "Codex"]);
	runGit(repoRoot, ["config", "user.email", "codex@example.invalid"]);
	runGit(repoRoot, ["add", "."]);
	runGit(repoRoot, ["commit", "-m", "seed readiness fixtures"]);
	writeRepoFile(
		repoRoot,
		"artifacts/context-integrity/prompt-context-drift-report.json",
		JSON.stringify(promptContextDriftReportForReadyRepo(repoRoot)),
	);
	return repoRoot;
}

function promptContextDriftReportForReadyRepo(
	repoRoot: string,
): PromptContextDriftReport {
	const currentHeadSha = readGitHead(repoRoot);
	const surfaces = [
		["prompt_context", "AGENTS.md"],
		["active_artifacts", ".harness/active-artifacts.md"],
		["active_route", ".harness/plan/ready.md"],
		["project_brain_memory", ".harness/memory/LEARNINGS.md"],
		["project_brain_knowledge", ".harness/knowledge/INDEX.md"],
		["runtime_card_or_handoff", ".harness/runtime/runtime-card.json"],
		["receipt_head_sha", "harness.contract.json"],
	] as const;

	return {
		schemaVersion: "prompt-context-drift-report/v1",
		generatedAt: "2026-05-26T12:00:00Z",
		producer: "agent-readiness-test",
		repoRootRef: "test-repo",
		currentHeadSha,
		evidenceUse: "claim_support",
		overallStatus: "pass",
		surfaces: surfaces.map(([surfaceId, ref]) => ({
			surfaceId,
			status: "pass",
			evidenceUse: "claim_support",
			freshness: "current",
			requiredForClaimSupport: true,
			observedHeadSha: currentHeadSha,
			currentHeadSha,
			sourceRefs: [
				{
					refId: `test:${surfaceId}`,
					surfaceId,
					refKind: "repo_file",
					ref,
					hashAlgorithm: "sha256",
					sha256: sha256Text(readyRepoSourceText(ref)),
					freshness: "current",
					evidenceUse: "claim_support",
					requiredForClaimSupport: true,
					requiresFilesystemExistence: true,
				},
			],
			blockers: [],
		})),
		blockers: [],
		nextAction: "none",
	};
}

function readGitHead(repoRoot: string): string {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(`git rev-parse HEAD failed: ${result.stderr}`);
	}
	return result.stdout.trim();
}

function runGit(repoRoot: string, args: string[]): void {
	const result = spawnSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
}

function sha256Text(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

function readyRepoSourceText(path: string): string {
	if (isReadyRepoSourcePath(path)) return READY_REPO_SOURCE_TEXT[path];
	throw new Error(`unexpected ready repo source ref: ${path}`);
}

function isReadyRepoSourcePath(path: string): path is ReadyRepoSourcePath {
	return Object.hasOwn(READY_REPO_SOURCE_TEXT, path);
}

function writeRepoFile(repoRoot: string, path: string, content: string): void {
	const fullPath = repoPath(repoRoot, path);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, content, "utf8");
}

function repoPath(repoRoot: string, path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		normalized.startsWith("..") ||
		normalized.includes("/../") ||
		/[\r\n\0]/u.test(normalized)
	) {
		throw new Error(`invalid fixture path: ${path}`);
	}
	const baseUrl = pathToFileURL(
		repoRoot.endsWith(sep) ? repoRoot : `${repoRoot}${sep}`,
	);
	const encodedPath = normalized.split("/").map(encodeURIComponent).join("/");
	const absolute = fileURLToPath(new URL(encodedPath, baseUrl));
	const relativePath = relative(repoRoot, absolute);
	if (
		relativePath === ".." ||
		relativePath.startsWith(`..${sep}`) ||
		isAbsolute(relativePath)
	) {
		throw new Error(`fixture path escaped repo: ${path}`);
	}
	return absolute;
}
