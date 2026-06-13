import {
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeNorthStarOverrideAcknowledgement } from "../lib/contract/north-star-artifact-io.js";
import type { OverrideAcknowledgement } from "../lib/contract/north-star-artifact-io.js";
import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	getNorthStarDriftFindingsPath,
} from "../lib/contract/north-star-artifacts.js";
import { runDriftGate, runDriftGateCLI } from "./drift-gate.js";

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
}

function copyRepoFile(root: string, relativePath: string): void {
	write(
		join(root, relativePath),
		readFileSync(join(process.cwd(), relativePath), "utf-8"),
	);
}

function createRepoFixture(root: string): void {
	write(
		join(root, "src/cli.ts"),
		[
			'if (command === "init") {}',
			'if (command === "drift-gate") {}',
			'console.info("  init             Install harness");',
			'console.info("  drift-gate       Check consistency drift");',
		].join("\n"),
	);
	write(
		join(root, "README.md"),
		[
			"| Command | Purpose |",
			"| --- | --- |",
			"| `init` | Install harness. |",
			"| `drift-gate` | Check consistency drift. |",
		].join("\n"),
	);
	write(
		join(root, "docs/QUALITY_SCORE.md"),
		[
			"---",
			"last_updated: 2026-04-21",
			"calculated_by: harness-gardener",
			"---",
			"",
			"# Documentation Quality Score",
			"",
			"**Score:** 90/100",
		].join("\n"),
	);
	write(
		join(root, "docs/roadmap/agent-first-status.md"),
		[
			"# Matrix",
			"",
			"### Phase A",
			"**Status:** ✅ Complete",
			"",
			"### Phase B",
			"**Status:** 🔶 Partial",
		].join("\n"),
	);
	write(
		join(root, "todos/001-complete-test.md"),
		["---", "status: complete", "---", "", "# complete todo"].join("\n"),
	);
}

describe("drift-gate command", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});

	it("returns advisory output with missing baseline as not_applicable when auto-seed disabled", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-1");
		roots.push(root);
		createRepoFixture(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.mode).toBe("advisory");
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(true);
	});

	it("keeps not-applicable info findings from escalating report status", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-info-only");
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "todos"), { recursive: true, force: true });
		write(
			join(root, "docs/QUALITY_SCORE.md"),
			[
				"---",
				"last_updated: 2099-01-01",
				"calculated_by: harness-gardener",
				"---",
				"",
				"# Documentation Quality Score",
				"",
				"**Score:** 90/100",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					rule_id: "todo.lifecycle.not_applicable",
					severity: "info",
				}),
			]),
		);
		expect(
			result.report.findings.some((finding) => finding.severity === "warning"),
		).toBe(false);
		expect(result.report.status).toBe("success");
	});

	it("flags todo lifecycle mismatches", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-2");
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "todos/002-ready-mismatch.md"),
			["---", "status: complete", "---", "", "# mismatch todo"].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(result.exitCode).toBe(0);
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "todo.lifecycle.status.mismatch" &&
					f.path === "todos/002-ready-mismatch.md",
			),
		).toBe(true);
	});

	it("fails health mode when baseline schema is invalid", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-3");
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "artifacts/consistency-gate/consistency-baseline-latest.json"),
			JSON.stringify({ wrong: true }, null, 2),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
		});

		expect(result.exitCode).toBe(2);
		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("schema");
	});

	it("keeps invalid baseline load errors and does not auto-seed", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-8");
		roots.push(root);
		createRepoFixture(root);

		const baselinePath = join(
			root,
			"artifacts/consistency-gate/consistency-baseline-latest.json",
		);
		write(baselinePath, `${JSON.stringify({ wrong: true }, null, 2)}\n`);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("schema");
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.load.error"),
		).toBe(true);
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(false);
		expect(result.report.baseline_seeded).toBeUndefined();
		expect(JSON.parse(readFileSync(baselinePath, "utf-8"))).toEqual({
			wrong: true,
		});
	});

	it("treats stale findings as preexisting when baseline omits dynamic message text", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-4");
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "docs/QUALITY_SCORE.md"),
			[
				"---",
				"last_updated: 2026-01-01",
				"calculated_by: harness-gardener",
				"---",
				"",
				"# Documentation Quality Score",
				"",
				"**Score:** 90/100",
			].join("\n"),
		);

		write(
			join(root, "artifacts/consistency-gate/consistency-baseline-latest.json"),
			JSON.stringify(
				{
					schemaVersion: "1.0.0",
					findings: [
						{
							rule_id: "quality.score.stale",
							surface: "quality-score",
							path: "docs/QUALITY_SCORE.md",
						},
					],
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		const staleFinding = result.report.findings.find(
			(f) => f.rule_id === "quality.score.stale",
		);
		expect(staleFinding?.baseline_state).toBe("preexisting");
	});

	it("ignores help option rows when detecting command duplicates", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-5");
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "src/cli.ts"),
			[
				'if (command === "init") {}',
				'if (command === "drift-gate") {}',
				'console.info("  init             Install harness");',
				'console.info("  drift-gate       Check consistency drift");',
				'console.info("  --json           Emit JSON");',
				'console.info("  --json           Emit JSON");',
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(
			result.report.findings.some(
				(f) => f.rule_id === "command.surface.help.duplicate",
			),
		).toBe(false);
	});

	it("uses registry core commands when the registry entrypoint re-exports them", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-registry-core",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "README.md"),
			[
				"| Command | Purpose |",
				"| --- | --- |",
				"| `commands` | List command metadata. |",
				"| `init` | Install harness. |",
				"| `drift-gate` | Check consistency drift. |",
				"| `learnings` | Import learning evidence. |",
				"| `review-context` | Build review context. |",
				"| `source-outline` | Inspect source signatures. |",
				"| `validation-plan` | Recommend validation commands. |",
			].join("\n"),
		);
		write(
			join(root, "src/cli.ts"),
			[
				'import { dispatchRegistryCommand } from "./lib/cli/command-registry.js";',
				"const registryDispatch = dispatchRegistryCommand(command, dispatchArgs);",
			].join("\n"),
		);
		write(
			join(root, "src/lib/cli/registry/command-specs.ts"),
			'export * from "./command-specs-core.js";',
		);
		write(
			join(root, "src/lib/cli/registry/command-specs-core.ts"),
			[
				"export const COMMAND_SPECS = [",
				'\t{ name: "init" },',
				'\t{ name: "drift-gate" },',
				"];",
			].join("\n"),
		);
		write(
			join(root, "src/lib/cli/command-registry.ts"),
			["const COMMAND_SPECS = [", '\t{ name: "commands" },', "];"].join("\n"),
		);
		write(
			join(root, "src/lib/cli/registry/learning-evidence-command-specs.ts"),
			[
				"return [",
				'\t{ name: "learnings" },',
				'\t{ name: "review-context" },',
				'\t{ name: "validation-plan" },',
				"];",
			].join("\n"),
		);
		write(
			join(root, "src/lib/cli/registry/source-outline-spec.ts"),
			'export const SOURCE_OUTLINE_COMMAND_SPEC = { name: "source-outline" };',
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(
			result.report.findings.some(
				(f) => f.rule_id === "command.surface.dispatch.missing",
			),
		).toBe(false);
	});

	it("blocks writes through symlinked output path", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-7");
		roots.push(root);
		createRepoFixture(root);

		const outsideDir = join(process.cwd(), "artifacts", "drift-gate-outside-7");
		roots.push(outsideDir);
		mkdirSync(outsideDir, { recursive: true });

		const linkPath = join(
			root,
			"artifacts/consistency-gate/consistency-drift-advisory-latest.json",
		);
		mkdirSync(dirname(linkPath), { recursive: true });
		symlinkSync(join(outsideDir, "poc.json"), linkPath);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			outPath:
				"artifacts/consistency-gate/consistency-drift-advisory-latest.json",
		});

		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("io");
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "report.output.write_error",
			),
		).toBe(true);
		expect(() => readFileSync(join(outsideDir, "poc.json"), "utf-8")).toThrow();
	});

	it("writes output report to --out path", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-6");
		roots.push(root);
		createRepoFixture(root);

		const outPath = "artifacts/consistency-gate/custom-report.json";
		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			outPath,
		});

		expect(result.exitCode).toBe(0);
		const written = JSON.parse(readFileSync(join(root, outPath), "utf-8")) as {
			schemaVersion: string;
			command: string;
		};
		expect(written.schemaVersion).toBe("1.0.0");
		expect(written.command).toBe("drift-gate");
	});

	it("persists blocked status in health-mode report output", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-health-out");
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));

		const outPath = "artifacts/consistency-gate/custom-health-report.json";
		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			outPath,
		});

		expect(result.exitCode).toBe(1);
		expect(result.report.status).toBe("blocked");

		const written = JSON.parse(readFileSync(join(root, outPath), "utf-8")) as {
			status: string;
		};
		expect(written.status).toBe("blocked");
	});

	it("auto-seeds baseline on first run when no baseline exists", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-seed-1");
		roots.push(root);
		createRepoFixture(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(result.exitCode).toBe(0);
		// Baseline should have been seeded — no "baseline.seed.missing" finding
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(false);
		// All findings should be preexisting after seeding
		for (const finding of result.report.findings) {
			expect(finding.baseline_state).toBe("preexisting");
		}
		// Baseline file should exist now
		const baselinePath = join(
			root,
			"artifacts/consistency-gate/consistency-baseline-latest.json",
		);
		expect(() => readFileSync(baselinePath, "utf-8")).not.toThrow();
		expect(result.report.baseline_seeded).toBe(true);
	});

	it("second run compares against auto-seeded baseline", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-seed-2");
		roots.push(root);
		createRepoFixture(root);

		// First run: seeds baseline
		runDriftGate({ repoRoot: root, mode: "advisory" });

		// Second run: should load baseline, no seed finding
		const result = runDriftGate({ repoRoot: root, mode: "advisory" });

		expect(result.report.baseline.loaded).toBe(true);
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(false);
		expect(result.report.baseline_seeded).toBeUndefined();
	});

	it("--no-seed disables auto-seeding", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-noseed");
		roots.push(root);
		createRepoFixture(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(true);
	});

	it("suppressions filter findings and report suppressed count", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-suppress");
		roots.push(root);
		createRepoFixture(root);
		// Remove status matrix to generate that finding
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			suppressions: ["status.matrix.missing"],
		});

		expect(
			result.report.findings.some((f) => f.rule_id === "status.matrix.missing"),
		).toBe(false);
		expect(result.report.summary.suppressed_count).toBe(1);
		expect(result.report.suppressed?.length).toBe(1);
		expect(result.report.suppressed?.[0]?.rule_id).toBe(
			"status.matrix.missing",
		);
	});

	it("findings include fix guidance", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-fix");
		roots.push(root);
		createRepoFixture(root);
		// Remove status matrix to generate a finding with fix guidance
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		const statusFinding = result.report.findings.find(
			(f) => f.rule_id === "status.matrix.missing",
		);
		expect(statusFinding).toBeDefined();
		expect(statusFinding?.fix).toBeDefined();
		expect(statusFinding?.fix?.manual).toContain("agent-first-status.md");
		expect(statusFinding?.fix?.suppressible).toBe(true);
	});

	it("flags north-star surface drift when contract-backed surfaces diverge", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-drift",
		);
		roots.push(root);
		createRepoFixture(root);
		copyRepoFile(root, "harness.contract.json");
		copyRepoFile(root, "docs/roadmap/north-star.md");

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(result.exitCode).toBe(1);
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "status.north_star.contract_parity.readme" &&
					f.path === "README.md",
			),
		).toBe(true);
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id ===
						"status.north_star.contract_parity.agent_first_status" &&
					f.path === "docs/roadmap/agent-first-status.md",
			),
		).toBe(true);
		// AC3: parity findings carry the drift_blocking failure class
		const readmeFinding = result.report.findings.find(
			(f) => f.rule_id === "status.north_star.contract_parity.readme",
		);
		expect(readmeFinding?.failureClass).toBe("drift_blocking");
	});

	it("flags cadence breach for stale non-core surfaces", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-cadence-breach",
		);
		roots.push(root);
		createRepoFixture(root);
		copyRepoFile(root, "harness.contract.json");
		copyRepoFile(root, "docs/roadmap/north-star.md");
		copyRepoFile(root, "README.md");
		copyRepoFile(root, "docs/roadmap/agent-first-status.md");

		// Inject a stale adjacent surface into the contract
		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
		contract.productSurface = {
			surfaces: [
				{
					surfaceId: "stale-surface",
					surfaceType: "command",
					class: "adjacent",
					owner: "workflow",
					northStarContribution: "test",
					manualGlueReductionClaim: "test",
					reliabilityContribution: "test",
					evidenceReference: "src/stale.ts",
					reviewCadence: "weekly",
					ownedPaths: ["src/stale.ts"],
					lastReviewedAt: "2026-03-01",
				},
			],
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2));

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(result.exitCode).toBe(1);
		const cadenceFinding = result.report.findings.find(
			(f) => f.rule_id === "status.north_star.cadence.breach",
		);
		expect(cadenceFinding).toBeDefined();
		expect(cadenceFinding?.failureClass).toBe("cadence_breach");
		expect(cadenceFinding?.severity).toBe("error");
	});

	it("emits durable guardrail artifacts for blocking findings (SA10)", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-guardrail");
		roots.push(root);
		createRepoFixture(root);
		copyRepoFile(root, "harness.contract.json");
		copyRepoFile(root, "docs/roadmap/north-star.md");

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		// Drift-blocking findings should emit guardrail artifacts
		expect(result.report.guardrail_refs?.length).toBeGreaterThan(0);
		expect(
			result.report.guardrail_refs?.some((ref) =>
				ref.includes("guardrails/north-star/drift_blocking"),
			),
		).toBe(true);
	});

	it("suppresses findings overridden by a valid acknowledgement (SA15 runtime)", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-override");
		roots.push(root);
		createRepoFixture(root);
		copyRepoFile(root, "harness.contract.json");
		copyRepoFile(root, "docs/roadmap/north-star.md");

		// Add overrideReviewerRegistry to contract
		const contractPath = join(root, "harness.contract.json");
		const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
		contract.overrideReviewerRegistry = {
			trustedReviewers: [
				{
					reviewerId: "jamie-craik",
					reviewerType: "user",
					signatureRef: "refs/reviewers/jamie-craik",
					displayName: "Jamie Craik",
					status: "active",
				},
			],
		};
		writeFileSync(contractPath, JSON.stringify(contract, null, 2));

		// Write an override that covers the README parity finding
		const ack: OverrideAcknowledgement = {
			schemaVersion: "north-star-override-acknowledgement/v1",
			overrideId: "ovr-readme-parity",
			timestampUtc: new Date().toISOString(),
			actor: "jamie-craik",
			reason: "Readme divergence is expected during rebranding",
			linkedFindingIds: ["status.north_star.contract_parity.readme"],
			approvedUntilUtc: new Date(Date.now() + 86400000).toISOString(),
			compensatingControls: ["rebrand-tracker"],
			signatureRef: "refs/reviewers/jamie-craik",
		};
		writeNorthStarOverrideAcknowledgement(
			root,
			"2026-04-27",
			"ovr-readme-parity",
			ack,
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		// The overridden finding should be in suppressed, not findings
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "status.north_star.contract_parity.readme",
			),
		).toBe(false);
		expect(
			result.report.suppressed?.some(
				(f) => f.rule_id === "status.north_star.contract_parity.readme",
			),
		).toBe(true);
		// Other north-star findings should still be present
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "status.north_star.contract_parity.agent_first_status",
			),
		).toBe(true);
	});

	it("writes canonical north-star drift findings artifact", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-artifact",
		);
		roots.push(root);
		createRepoFixture(root);
		copyRepoFile(root, "harness.contract.json");
		copyRepoFile(root, "docs/roadmap/north-star.md");

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const artifactPath = getNorthStarDriftFindingsPath();
		const artifact = JSON.parse(
			readFileSync(join(root, artifactPath), "utf-8"),
		) as {
			schemaVersion: string;
			sourceReport: { schemaVersion: string; status: string; outcome: string };
			findings: Array<{ rule_id: string }>;
		};

		expect(result.report.artifact_refs).toEqual([
			{
				type: "north-star-drift-findings",
				path: artifactPath,
				schemaVersion: NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings,
			},
		]);
		expect(artifact.schemaVersion).toBe(
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.driftFindings,
		);
		expect(artifact.sourceReport).toMatchObject({
			schemaVersion: "1.0.0",
			status: result.report.status,
			outcome: result.report.outcome,
		});
		expect(artifact.findings.length).toBeGreaterThan(0);
		expect(
			artifact.findings.every((finding) =>
				finding.rule_id.startsWith("status.north_star."),
			),
		).toBe(true);
	});

	it("passes north-star parity when governed surfaces stay aligned", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-aligned",
		);
		roots.push(root);
		createRepoFixture(root);
		copyRepoFile(root, "harness.contract.json");
		copyRepoFile(root, "README.md");
		copyRepoFile(root, "docs/roadmap/north-star.md");
		copyRepoFile(root, "docs/roadmap/agent-first-status.md");

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some((f) =>
				f.rule_id.startsWith("status.north_star.contract_parity."),
			),
		).toBe(false);
	});

	it("reports schema blockers when the north-star contract cannot be loaded", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-invalid",
		);
		roots.push(root);
		createRepoFixture(root);
		write(join(root, "harness.contract.json"), "{\n  invalid json\n");

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(result.exitCode).toBe(2);
		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("schema");
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "status.north_star.contract.invalid",
			),
		).toBe(true);
	});
	it("CLI emits normalised GateResult JSON when --json is set", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-cli-json");
		roots.push(root);
		createRepoFixture(root);

		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			const exitCode = runDriftGateCLI({
				repoRoot: root,
				mode: "advisory",
				json: true,
				seedBaseline: false,
			});
			expect(exitCode).toBe(0);
			expect(stdoutSpy).toHaveBeenCalledTimes(1);
			const payload = JSON.parse(String(stdoutSpy.mock.calls[0]?.[0])) as {
				gate: string;
				status: string;
				findings: unknown[];
			};
			expect(payload.gate).toBe("drift-gate");
			expect(payload.status).toBe("warn");
			expect(Array.isArray(payload.findings)).toBe(true);
		} finally {
			stdoutSpy.mockRestore();
		}
	});

	it("CLI returns health-mode exit code and human summary output", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-cli-human");
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "artifacts/consistency-gate/consistency-baseline-latest.json"),
			JSON.stringify({ wrong: true }, null, 2),
		);

		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runDriftGateCLI({
				repoRoot: root,
				mode: "health",
			});
			expect(exitCode).toBe(2);
			expect(infoSpy).toHaveBeenCalled();
			const firstLine = String(infoSpy.mock.calls[0]?.[0] ?? "");
			expect(firstLine).toContain("drift-gate (health) blocked");
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("health-mode JSON reports fail for blocking status-surface drift", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-cli-health-json");
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));

		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		try {
			const exitCode = runDriftGateCLI({
				repoRoot: root,
				mode: "health",
				json: true,
			});
			expect(exitCode).toBe(1);
			expect(stdoutSpy).toHaveBeenCalledTimes(1);
			const payload = JSON.parse(String(stdoutSpy.mock.calls[0]?.[0])) as {
				status: string;
				findings: Array<{ id: string }>;
			};
			expect(payload.status).toBe("fail");
			expect(
				payload.findings.some((finding) =>
					finding.id.includes("status.matrix.missing"),
				),
			).toBe(true);
		} finally {
			stdoutSpy.mockRestore();
		}
	});
});
