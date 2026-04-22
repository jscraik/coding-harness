import {
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NORTH_STAR_DECISION_QUESTION_SPECS } from "../lib/contract/types.js";
import { runDriftGate, runDriftGateCLI } from "./drift-gate.js";

const CANONICAL_BASELINE_PATH =
	".harness/guardrails/north-star/drift-baseline-latest.json";

function write(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf-8");
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
			"last_updated: 2026-03-05",
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
			"| Metric | Current | Trend |",
			"| --- | --- | --- |",
			"| `pr_lead_time_p50` | 18h | improving |",
			"| `pr_lead_time_p90` | 30h | improving |",
			"| `review_rework_retry_rate` | 0.9 | improving |",
			"| `manual_interventions_per_agent_change` | 0.4 | improving |",
			"| `merge_readiness_block_time` | 6h | improving |",
			"| `north_star_alignment_pass_rate` | 97% | improving |",
			"| `blocking_drift_findings_count` | 1 | improving |",
			"| `surface_class_counts{core,adjacent,experimental}` | 7/3/1 | flat |",
			"| `policy_surface_additions_without_glue_reduction` | 0 | flat |",
			"| `cadence_breach_count` | 0 | flat |",
			"| `repeated_failure_class_count` | 1 | improving |",
			"| `durable_guardrail_added_count` | 1 | flat |",
			"| `post_guardrail_recurrence_rate` | 0.0 | improving |",
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
	write(
		join(root, "harness.contract.json"),
		JSON.stringify({ version: "0.13.0" }, null, 2),
	);
}

function seedCommittedProductSurfaceFiles(root: string): void {
	const repoRoot = process.cwd();
	const committedContract = JSON.parse(
		readFileSync(join(repoRoot, "harness.contract.json"), "utf-8"),
	) as {
		productSurface?: {
			surfaces?: Array<{
				ownedPaths?: string[];
				evidenceReference?: string;
			}>;
		};
	};

	for (const surface of committedContract.productSurface?.surfaces ?? []) {
		const sourcePaths = new Set<string>(surface.ownedPaths ?? []);
		if (typeof surface.evidenceReference === "string") {
			const evidencePath = surface.evidenceReference
				.replace(/:(\d+)(?::\d+)?$/, "")
				.replace(/^\/+/, "");
			if (
				!evidencePath.startsWith("artifacts/") &&
				!evidencePath.startsWith("/artifacts/")
			) {
				sourcePaths.add(evidencePath);
			}
		}
		for (const sourcePath of sourcePaths) {
			try {
				const source = readFileSync(join(repoRoot, sourcePath), "utf-8");
				write(join(root, sourcePath), source);
			} catch {
				// Ignore optional paths that do not exist in this fixture source.
			}
		}
	}
}

describe("drift-gate command", () => {
	const roots: string[] = [];

	afterEach(() => {
		vi.restoreAllMocks();
		for (const root of roots) {
			rmSync(root, { recursive: true, force: true });
		}
		roots.length = 0;
	});

	it("runDriftGateCLI writes normalized JSON to stdout in --json mode", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-cli-json");
		roots.push(root);
		createRepoFixture(root);

		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runDriftGateCLI({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
			json: true,
		});

		expect(exitCode).toBe(0);
		expect(consoleInfoSpy).not.toHaveBeenCalled();
		const jsonText = stdoutSpy.mock.calls
			.map((call) => String(call[0]))
			.join("");
		const parsed = JSON.parse(jsonText) as {
			gate: string;
			status: string;
			reason: string;
		};
		expect(parsed.gate).toBe("drift-gate");
		expect(["pass", "warn", "fail"]).toContain(parsed.status);
		expect(typeof parsed.reason).toBe("string");
	});

	it("runDriftGateCLI renders human summary and fix guidance without --json", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-cli-human");
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));

		const stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);

		const exitCode = runDriftGateCLI({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(exitCode).toBe(0);
		expect(stdoutSpy).not.toHaveBeenCalled();
		const rendered = consoleInfoSpy.mock.calls
			.map((call) => call.map(String).join(" "))
			.join("\n");
		expect(rendered).toContain("drift-gate (advisory) partial");
		expect(rendered).toContain("status.matrix.missing");
		expect(rendered).toContain("Fix:");
	});

	it("returns advisory output with missing baseline as not_applicable when auto-seed disabled", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-1");
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "harness.contract.json"));

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
			join(root, CANONICAL_BASELINE_PATH),
			JSON.stringify({ wrong: true }, null, 2),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
		});

		expect(result.exitCode).toBe(1);
		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("schema");
	});

	it("fails health mode when status-surface drift findings are present", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-health-drift",
		);
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some((f) => f.rule_id === "status.matrix.missing"),
		).toBe(true);
		expect(result.exitCode).toBe(1);
	});

	it("fails health mode when harness.contract.json is missing", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-health-contract-missing",
		);
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "harness.contract.json"));

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "status.north_star.contract_parity.contract_missing" &&
					f.severity === "error",
			),
		).toBe(true);
		expect(result.exitCode).toBe(1);
	});

	it("does not fail health mode for preexisting status findings", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-health-preexisting-status",
		);
		roots.push(root);
		createRepoFixture(root);
		rmSync(join(root, "docs/roadmap/agent-first-status.md"));
		write(
			join(root, CANONICAL_BASELINE_PATH),
			JSON.stringify(
				{
					schemaVersion: "1.0.0",
					findings: [
						{
							rule_id: "status.matrix.missing",
							surface: "status",
							path: "docs/roadmap/agent-first-status.md",
						},
					],
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "status.matrix.missing" &&
					f.baseline_state === "preexisting",
			),
		).toBe(true);
		expect(result.exitCode).toBe(0);
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
			join(root, CANONICAL_BASELINE_PATH),
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

	it("uses registry command specs when cli.ts no longer contains legacy dispatch patterns", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-registry-dispatch-fallback",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "src/cli.ts"),
			[
				'import { dispatchRegistryCommand } from "./lib/cli/command-registry.js";',
				"export function run(args) {",
				"  return dispatchRegistryCommand(args[0], args);",
				"}",
			].join("\n"),
		);
		write(
			join(root, "src/lib/cli/registry/command-specs.ts"),
			[
				"export const COMMAND_SPECS = [",
				'  { name: "init" },',
				'  { name: "drift-gate" },',
				"];",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) => f.rule_id === "command.surface.dispatch.missing",
			),
		).toBe(false);
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "command.surface.readme.missing",
			),
		).toBe(false);
	});

	it("includes wrapper commands from command-registry in dispatch parity", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-registry-wrapper-command-parity",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "src/cli.ts"),
			[
				'import { dispatchRegistryCommand } from "./lib/cli/command-registry.js";',
				"export function run(args) {",
				"  return dispatchRegistryCommand(args[0], args);",
				"}",
			].join("\n"),
		);
		write(
			join(root, "src/lib/cli/registry/command-specs.ts"),
			[
				"export const COMMAND_SPECS = [",
				'  { name: "init" },',
				'  { name: "drift-gate" },',
				"];",
			].join("\n"),
		);
		write(
			join(root, "src/lib/cli/command-registry.ts"),
			[
				"export const COMMAND_SPECS = [",
				'  { name: "commands" },',
				"  ...EXTRACTED_COMMAND_SPECS,",
				"];",
			].join("\n"),
		);
		write(
			join(root, "README.md"),
			[
				"| Command | Purpose |",
				"| --- | --- |",
				"| `commands` | List command capability metadata. |",
				"| `init` | Install harness. |",
				"| `drift-gate` | Check consistency drift. |",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "command.surface.dispatch.missing" &&
					f.message.includes("commands"),
			),
		).toBe(false);
	});

	it("normalizes README subcommand rows to canonical command tokens", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-readme-subcommand-normalization",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "src/lib/cli/registry/command-specs.ts"),
			[
				"export const COMMAND_SPECS = [",
				'  { name: "linear" },',
				'  { name: "init" },',
				'  { name: "drift-gate" },',
				"];",
			].join("\n"),
		);
		write(
			join(root, "README.md"),
			[
				"| Command | Purpose |",
				"| --- | --- |",
				"| `linear prepare` | Prepare branch metadata from Linear. |",
				"| `init` | Install harness. |",
				"| `drift-gate` | Check consistency drift. |",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "command.surface.dispatch.missing" &&
					f.message.includes("linear prepare"),
			),
		).toBe(false);
		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "command.surface.readme.missing" &&
					f.message.includes("linear"),
			),
		).toBe(false);
	});

	it("reports commands missing from docs/cli-reference command index", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-cli-reference-command-parity",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "docs/cli-reference.md"),
			[
				"| Command | Purpose |",
				"| --- | --- |",
				"| `init` | Install harness. |",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id === "command.surface.cli_reference.missing" &&
					f.message.includes("drift-gate"),
			),
		).toBe(true);
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

	it("fails health mode when report output write fails", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-7-health");
		roots.push(root);
		createRepoFixture(root);

		const outsideDir = join(
			process.cwd(),
			"artifacts",
			"drift-gate-outside-7-health",
		);
		roots.push(outsideDir);
		mkdirSync(outsideDir, { recursive: true });

		const linkPath = join(
			root,
			"artifacts/consistency-gate/consistency-drift-health-latest.json",
		);
		mkdirSync(dirname(linkPath), { recursive: true });
		symlinkSync(join(outsideDir, "poc.json"), linkPath);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			outPath:
				"artifacts/consistency-gate/consistency-drift-health-latest.json",
		});

		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("io");
		expect(result.exitCode).toBe(1);
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "report.output.write_error",
			),
		).toBe(true);
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

	it("writes canonical north-star drift artifacts on every run", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-canonical");
		roots.push(root);
		createRepoFixture(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(result.exitCode).toBe(0);
		const driftFindingsPath = join(
			root,
			".harness/guardrails/north-star/drift-findings.json",
		);
		const snapshotPath = join(
			root,
			".harness/guardrails/north-star/surface-classification-snapshot.json",
		);

		const writtenFindings = JSON.parse(
			readFileSync(driftFindingsPath, "utf-8"),
		) as {
			command: string;
			schemaVersion: string;
		};
		expect(writtenFindings.command).toBe("drift-gate");
		expect(writtenFindings.schemaVersion).toBe("1.0.0");

		const writtenSnapshot = JSON.parse(readFileSync(snapshotPath, "utf-8")) as {
			contract_path: string;
			schemaVersion: string;
			surface_counts: {
				core: number;
				adjacent: number;
				experimental: number;
			};
		};
		expect(writtenSnapshot.schemaVersion).toBe("1.0.0");
		expect(writtenSnapshot.contract_path).toBe("harness.contract.json");
		expect(typeof writtenSnapshot.surface_counts.core).toBe("number");
		expect(typeof writtenSnapshot.surface_counts.adjacent).toBe("number");
		expect(typeof writtenSnapshot.surface_counts.experimental).toBe("number");
	});

	it("seeds baseline on first run when --seed-baseline is requested", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-seed-1");
		roots.push(root);
		createRepoFixture(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: true,
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
		const baselinePath = join(root, CANONICAL_BASELINE_PATH);
		expect(() => readFileSync(baselinePath, "utf-8")).not.toThrow();
		expect(result.report.baseline_seeded).toBe(true);
	});

	it("falls back to legacy baseline path when canonical baseline is absent", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-legacy-baseline",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "artifacts/consistency-gate/consistency-baseline-latest.json"),
			JSON.stringify({ schemaVersion: "1.0.0", findings: [] }, null, 2),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(result.report.baseline.loaded).toBe(true);
		expect(result.report.baseline.path).toBe(
			"artifacts/consistency-gate/consistency-baseline-latest.json",
		);
	});

	it("second run compares against explicitly seeded baseline", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-seed-2");
		roots.push(root);
		createRepoFixture(root);

		// First run: seeds baseline
		runDriftGate({ repoRoot: root, mode: "advisory", seedBaseline: true });

		// Second run: should load baseline, no seed finding
		const result = runDriftGate({ repoRoot: root, mode: "advisory" });

		expect(result.report.baseline.loaded).toBe(true);
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(false);
		expect(result.report.baseline_seeded).toBeUndefined();
	});

	it("reports baseline.load.error when baseline path cannot be read", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-baseline-read-error",
		);
		roots.push(root);
		createRepoFixture(root);

		const unreadableBaselinePath = join(
			root,
			"artifacts/consistency-gate/unreadable-baseline",
		);
		mkdirSync(unreadableBaselinePath, { recursive: true });

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			baselinePath: "artifacts/consistency-gate/unreadable-baseline",
		});

		expect(result.report.outcome).toBe("error");
		expect(result.report.error_class).toBe("io");
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.load.error"),
		).toBe(true);
	});

	it("falls back to baseline.seed.missing when explicit baseline seeding write fails", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-baseline-seed-write-fail",
		);
		roots.push(root);
		createRepoFixture(root);

		const blockingFile = join(root, "artifacts/consistency-gate/blocker");
		mkdirSync(dirname(blockingFile), { recursive: true });
		writeFileSync(blockingFile, "not-a-directory\n", "utf-8");

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			baselinePath: "artifacts/consistency-gate/blocker/report.json",
			seedBaseline: true,
		});

		expect(result.report.outcome).toBe("ok");
		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(true);
	});

	it("default mode is read-only when baseline is missing", () => {
		const root = join(process.cwd(), "artifacts", "drift-gate-test-noseed");
		roots.push(root);
		createRepoFixture(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
		});

		expect(
			result.report.findings.some((f) => f.rule_id === "baseline.seed.missing"),
		).toBe(true);
		expect(result.report.baseline_seeded).toBeUndefined();
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

	it("does not suppress findings marked non-suppressible", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-suppress-nonsuppressible",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
					},
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
			suppressions: [
				"status.north_star.contract_parity.contract_shape_invalid",
			],
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id ===
					"status.north_star.contract_parity.contract_shape_invalid",
			),
		).toBe(true);
		expect(
			result.report.suppressed?.some(
				(f) =>
					f.rule_id ===
					"status.north_star.contract_parity.contract_shape_invalid",
			),
		).not.toBe(true);
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
		expect(statusFinding?.findingId).toBe(statusFinding?.rule_id);
		expect(statusFinding?.field).toBe(statusFinding?.rule_id);
		expect(statusFinding?.expected).toBe("Contract-aligned surface state");
		expect(typeof statusFinding?.actual).toBe("string");
		expect(statusFinding?.specSeverity).toBe("warning");
		expect(typeof statusFinding?.remediation).toBe("string");
	});

	it("flags missing required north-star metric rows in status matrix", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-status-metrics-missing",
		);
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "docs/roadmap/agent-first-status.md"),
			["# Matrix", "", "### Phase A", "**Status:** ✅ Complete"].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const finding = result.report.findings.find(
			(f) => f.rule_id === "status.metrics.required.missing",
		);
		expect(finding).toBeDefined();
		expect(finding?.message).toContain("pr_lead_time_p50");
	});

	it("flags green-by-feature status when throughput metrics regress", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-status-outcomes-regressed",
		);
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "docs/roadmap/agent-first-status.md"),
			[
				"# Matrix",
				"",
				"| Metric | Current | Trend |",
				"| --- | --- | --- |",
				"| `pr_lead_time_p50` | 24h | regressing |",
				"| `pr_lead_time_p90` | 36h | regressing |",
				"| `review_rework_retry_rate` | 1.2 | regressing |",
				"| `manual_interventions_per_agent_change` | 0.7 | regressing |",
				"| `merge_readiness_block_time` | 9h | regressing |",
				"| `north_star_alignment_pass_rate` | 92% | flat |",
				"| `blocking_drift_findings_count` | 2 | flat |",
				"| `surface_class_counts{core,adjacent,experimental}` | 7/3/1 | flat |",
				"| `policy_surface_additions_without_glue_reduction` | 1 | flat |",
				"| `cadence_breach_count` | 0 | flat |",
				"| `repeated_failure_class_count` | 2 | flat |",
				"| `durable_guardrail_added_count` | 0 | flat |",
				"| `post_guardrail_recurrence_rate` | 0.2 | flat |",
				"",
				"### Phase A",
				"**Status:** ✅ Complete",
				"",
				"### Phase B",
				"**Status:** ✅ Complete",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const finding = result.report.findings.find(
			(f) => f.rule_id === "status.outcomes.regressed",
		);
		expect(finding).toBeDefined();
		expect(finding?.message).toContain("pr_lead_time_p50");
	});

	it("does not flag benign 'follow-up' trend text as throughput regression", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-status-outcomes-follow-up",
		);
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "docs/roadmap/agent-first-status.md"),
			[
				"# Matrix",
				"",
				"| Metric | Current | Trend |",
				"| --- | --- | --- |",
				"| `pr_lead_time_p50` | 24h | follow-up validation pending |",
				"| `pr_lead_time_p90` | 36h | improving |",
				"| `review_rework_retry_rate` | 1.2 | improving |",
				"| `manual_interventions_per_agent_change` | 0.7 | improving |",
				"| `merge_readiness_block_time` | 9h | improving |",
				"| `north_star_alignment_pass_rate` | 92% | flat |",
				"| `blocking_drift_findings_count` | 2 | flat |",
				"| `surface_class_counts{core,adjacent,experimental}` | 7/3/1 | flat |",
				"| `policy_surface_additions_without_glue_reduction` | 1 | flat |",
				"| `cadence_breach_count` | 0 | flat |",
				"| `repeated_failure_class_count` | 2 | flat |",
				"| `durable_guardrail_added_count` | 0 | flat |",
				"| `post_guardrail_recurrence_rate` | 0.2 | flat |",
				"",
				"### Phase A",
				"**Status:** ✅ Complete",
				"",
				"### Phase B",
				"**Status:** ✅ Complete",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const finding = result.report.findings.find(
			(f) => f.rule_id === "status.outcomes.regressed",
		);
		expect(finding).toBeUndefined();
	});

	it("flags north-star narrative drift between contract and README/roadmap docs", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-parity",
		);
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
						primaryMetric: "pr_lead_time",
						primaryBottleneck: "review_rework_loop",
						autonomyBoundary:
							"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
						safetyFloor: [
							"deterministic evidence over intuition",
							"strict current-head SHA discipline",
						],
						nonGoals: [
							"governance surface area as a proxy for progress",
							"feature count without measurable throughput or reliability benefit",
						],
						decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
							(question) => ({
								id: question.id,
								prompt: question.prompt,
							}),
						),
					},
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "harness-core",
								northStarContribution: "Blocks drift before merge.",
								manualGlueReductionClaim: "Removes manual review triage.",
								reliabilityContribution: "Deterministic gate output.",
								evidenceReference: "/artifacts/reviews/review-gate.md:1",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jscraik",
								reviewerType: "user",
								signatureRef: "github:jscraik",
								displayName: "Jamie Craik",
								status: "active",
							},
						],
					},
				},
				null,
				2,
			),
		);
		write(
			join(root, "docs/roadmap/north-star.md"),
			"# North Star\n\nMismatch.",
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) => f.rule_id === "status.north_star.contract_parity.north_star_doc",
			),
		).toBe(true);
		const northStarDocFinding = result.report.findings.find(
			(f) => f.rule_id === "status.north_star.contract_parity.north_star_doc",
		);
		expect(northStarDocFinding?.message).toContain("primary bottleneck");
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "status.north_star.contract_parity.readme",
			),
		).toBe(true);
	});

	it("flags missing canonical north-star narrative surfaces", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-missing-narrative-surfaces",
		);
		roots.push(root);
		createRepoFixture(root);

		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
						primaryMetric: "pr_lead_time",
						primaryBottleneck: "review_rework_loop",
						autonomyBoundary:
							"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
						safetyFloor: [
							"deterministic evidence over intuition",
							"strict current-head SHA discipline",
						],
						nonGoals: [
							"governance surface area as a proxy for progress",
							"feature count without measurable throughput or reliability benefit",
						],
						decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
							(question) => ({
								id: question.id,
								prompt: question.prompt,
							}),
						),
					},
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "harness-core",
								northStarContribution: "Blocks drift before merge.",
								manualGlueReductionClaim: "Removes manual review triage.",
								reliabilityContribution: "Deterministic gate output.",
								evidenceReference: "/artifacts/reviews/review-gate.md:1",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jscraik",
								reviewerType: "user",
								signatureRef: "github:jscraik",
								displayName: "Jamie Craik",
								status: "active",
							},
						],
					},
				},
				null,
				2,
			),
		);

		rmSync(join(root, "docs/roadmap/north-star.md"), { force: true });
		rmSync(join(root, "README.md"), { force: true });

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(f) =>
					f.rule_id ===
					"status.north_star.contract_parity.north_star_doc.missing",
			),
		).toBe(true);
		expect(
			result.report.findings.some(
				(f) => f.rule_id === "status.north_star.contract_parity.readme.missing",
			),
		).toBe(true);
		expect(result.exitCode).toBe(1);
	});

	it("accepts canonical north-star bottleneck alias wording in roadmap narrative", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-bottleneck-alias",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
						primaryMetric: "pr_lead_time",
						primaryBottleneck: "review_rework_loop",
						autonomyBoundary:
							"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
						safetyFloor: [
							"deterministic evidence over intuition",
							"strict current-head SHA discipline",
						],
						nonGoals: ["governance surface area as a proxy for progress"],
						decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
							(question) => ({
								id: question.id,
								prompt: question.prompt,
							}),
						),
					},
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "harness-core",
								northStarContribution: "Blocks drift before merge.",
								manualGlueReductionClaim: "Removes manual review triage.",
								reliabilityContribution: "Deterministic gate output.",
								evidenceReference: "/artifacts/reviews/review-gate.md:1",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jscraik",
								reviewerType: "user",
								signatureRef: "github:jscraik",
								displayName: "Jamie Craik",
								status: "active",
							},
						],
					},
				},
				null,
				2,
			),
		);
		write(
			join(root, "docs/roadmap/north-star.md"),
			[
				"# North Star",
				"",
				"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
				"",
				"Primary bottleneck: review and rework loop cost.",
				"",
				"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
				"",
				"Safety floor:",
				"- deterministic evidence over intuition",
				"- strict current-head SHA discipline",
				"",
				"Non-goals:",
				"- governance surface area as a proxy for progress",
				"",
				"Decision questions:",
				...NORTH_STAR_DECISION_QUESTION_SPECS.map(
					(question) => `- ${question.id}: ${question.prompt}`,
				),
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const northStarDocFinding = result.report.findings.find(
			(f) => f.rule_id === "status.north_star.contract_parity.north_star_doc",
		);
		expect(northStarDocFinding?.message ?? "").not.toContain(
			"primary bottleneck",
		);
	});

	it("keeps committed north-star docs aligned with the canonical contract", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-repo-truth-north-star-docs",
		);
		roots.push(root);
		createRepoFixture(root);

		const repoRoot = process.cwd();
		write(
			join(root, "harness.contract.json"),
			readFileSync(join(repoRoot, "harness.contract.json"), "utf-8"),
		);
		write(
			join(root, "README.md"),
			readFileSync(join(repoRoot, "README.md"), "utf-8"),
		);
		write(
			join(root, "docs/roadmap/north-star.md"),
			readFileSync(join(repoRoot, "docs/roadmap/north-star.md"), "utf-8"),
		);
		write(
			join(root, "docs/roadmap/agent-first-status.md"),
			readFileSync(
				join(repoRoot, "docs/roadmap/agent-first-status.md"),
				"utf-8",
			),
		);
		seedCommittedProductSurfaceFiles(root);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const northStarContractFindings = result.report.findings.filter(
			(finding) =>
				finding.rule_id.startsWith("status.north_star.contract_parity") ||
				finding.rule_id === "status.metrics.required.missing",
		);
		expect(
			northStarContractFindings.map(
				(finding) => `${finding.rule_id}: ${finding.message}`,
			),
		).toEqual([]);
	});

	it("fails closed when harness.contract.json is malformed", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-parse-error",
		);
		roots.push(root);
		createRepoFixture(root);
		write(join(root, "harness.contract.json"), "{ malformed: true");

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const parseFinding = result.report.findings.find(
			(f) =>
				f.rule_id === "status.north_star.contract_parity.contract_parse_error",
		);
		expect(parseFinding).toBeDefined();
		expect(parseFinding?.rule_result).toBe("error");
		expect(result.exitCode).toBe(1);
	});

	it("fails closed when harness.contract.json uses a non-canonical version format", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-version-shape-error",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "v1.5.0",
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const shapeFinding = result.report.findings.find(
			(f) =>
				f.rule_id ===
				"status.north_star.contract_parity.contract_shape_invalid",
		);
		expect(shapeFinding).toBeDefined();
		expect(shapeFinding?.message).toContain(
			"version (canonical numeric format)",
		);
		expect(result.exitCode).toBe(1);
	});

	it("fails closed when northStar is parseable JSON but structurally invalid", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-shape-error",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
					},
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const shapeFinding = result.report.findings.find(
			(f) =>
				f.rule_id ===
				"status.north_star.contract_parity.contract_shape_invalid",
		);
		expect(shapeFinding).toBeDefined();
		expect(shapeFinding?.rule_result).toBe("error");
		expect(shapeFinding?.message).toContain("northStar.primaryMetric");
		expect(result.exitCode).toBe(1);
	});

	it("fails closed when a 1.6+ contract omits northStar entirely", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-missing-north-star",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.6.0",
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "harness-core",
								northStarContribution: "Blocks drift before merge.",
								manualGlueReductionClaim: "Removes manual review triage.",
								reliabilityContribution: "Deterministic gate output.",
								evidenceReference: "/artifacts/reviews/review-gate.md:1",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jscraik",
								reviewerType: "user",
								signatureRef: "github:jscraik",
								displayName: "Jamie Craik",
								status: "active",
							},
						],
					},
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const shapeFinding = result.report.findings.find(
			(f) =>
				f.rule_id ===
				"status.north_star.contract_parity.contract_shape_invalid",
		);
		expect(shapeFinding).toBeDefined();
		expect(shapeFinding?.message).toContain("northStar");
		expect(result.exitCode).toBe(1);
	});

	it("fails closed when 1.6+ contract omits required product/reviewer surfaces", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-missing-required-surfaces",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.6.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
						primaryMetric: "pr_lead_time",
						primaryBottleneck: "review_rework_loop",
						autonomyBoundary:
							"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
						safetyFloor: [
							"deterministic evidence over intuition",
							"strict current-head SHA discipline",
						],
						nonGoals: ["governance surface area as a proxy for progress"],
						decisionQuestions: [
							{
								id: "lead_time_path",
								prompt:
									"Does this reduce PR lead time directly, or strengthen the path to lower PR lead time by reducing review or rework cost?",
							},
							{
								id: "manual_glue",
								prompt:
									"Does this remove manual glue work from review, rework, or delivery handoffs?",
							},
							{
								id: "agent_reliability",
								prompt:
									"Does this improve agent reliability through clearer contracts, deterministic checks, or durable guardrails?",
							},
							{
								id: "safety_floor",
								prompt:
									"Does this preserve or strengthen deterministic evidence, strict current-head SHA discipline, and rollback safety?",
							},
						],
					},
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const shapeFinding = result.report.findings.find(
			(f) =>
				f.rule_id ===
				"status.north_star.contract_parity.contract_shape_invalid",
		);
		expect(shapeFinding).toBeDefined();
		expect(shapeFinding?.message).toContain("productSurface");
		expect(shapeFinding?.message).toContain("overrideReviewerRegistry");
		expect(result.exitCode).toBe(1);
	});

	it("fails closed when 1.6+ northStar uses non-canonical metric/bottleneck values", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-north-star-contract-noncanonical-values",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.6.0",
					northStar: {
						mission:
							"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
						primaryMetric: "foo_metric",
						primaryBottleneck: "foo_bottleneck",
						autonomyBoundary:
							"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
						safetyFloor: [
							"deterministic evidence over intuition",
							"strict current-head SHA discipline",
						],
						nonGoals: ["governance surface area as a proxy for progress"],
						decisionQuestions: [
							{
								id: "lead_time_path",
								prompt:
									"Does this reduce PR lead time directly, or strengthen the path to lower PR lead time by reducing review or rework cost?",
							},
							{
								id: "manual_glue",
								prompt:
									"Does this remove manual glue work from review, rework, or delivery handoffs?",
							},
							{
								id: "agent_reliability",
								prompt:
									"Does this improve agent reliability through clearer contracts, deterministic checks, or durable guardrails?",
							},
							{
								id: "safety_floor",
								prompt:
									"Does this preserve or strengthen deterministic evidence, strict current-head SHA discipline, and rollback safety?",
							},
						],
					},
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "harness-core",
								northStarContribution: "Blocks drift before merge.",
								manualGlueReductionClaim: "Removes manual review triage.",
								reliabilityContribution: "Deterministic gate output.",
								evidenceReference: "/artifacts/reviews/review-gate.md:1",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jscraik",
								reviewerType: "user",
								signatureRef: "github:jscraik",
								displayName: "Jamie Craik",
								status: "active",
							},
						],
					},
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "health",
			seedBaseline: false,
		});

		const shapeFinding = result.report.findings.find(
			(f) =>
				f.rule_id ===
				"status.north_star.contract_parity.contract_shape_invalid",
		);
		expect(shapeFinding).toBeDefined();
		expect(shapeFinding?.message).toContain(
			"northStar (canonical metric/bottleneck/question set)",
		);
		expect(result.exitCode).toBe(1);
	});

	it("flags surface_class_counts drift against contract productSurface registry", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-surface-class-count-mismatch",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{ class: "core" },
							{ class: "adjacent" },
							{ class: "adjacent" },
						],
					},
				},
				null,
				2,
			),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const mismatchFinding = result.report.findings.find(
			(f) => f.rule_id === "status.metrics.surface_class_counts.mismatch",
		);
		expect(mismatchFinding).toBeDefined();
		expect(mismatchFinding?.message).toContain("7/3/1");
		expect(mismatchFinding?.message).toContain("1/2/0");
	});

	it("flags malformed surface_class_counts status metric rows", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-surface-class-count-malformed-format",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{ class: "core" },
							{ class: "adjacent" },
							{ class: "experimental" },
						],
					},
				},
				null,
				2,
			),
		);
		write(
			join(root, "docs", "roadmap", "agent-first-status.md"),
			[
				"# Agent-First Status",
				"",
				"## Metrics",
				"| Metric | Current | Trend |",
				"| --- | --- | --- |",
				"| `surface_class_counts{core,adjacent,experimental}` | core=7,adjacent=3,experimental=1 | flat |",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const malformedFinding = result.report.findings.find(
			(f) => f.rule_id === "status.metrics.surface_class_counts.mismatch",
		);
		expect(malformedFinding).toBeDefined();
		expect(malformedFinding?.message).toContain(
			"surface_class_counts metric is malformed",
		);
		expect(malformedFinding?.message).toContain("2/3/0");
	});

	it("flags surface_class_counts drift when contract registers zero surfaces", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-surface-class-count-zero-surfaces",
		);
		roots.push(root);
		createRepoFixture(root);
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(
				{
					version: "1.5.0",
					productSurface: {
						surfaces: [],
					},
				},
				null,
				2,
			),
		);
		write(
			join(root, "docs", "roadmap", "agent-first-status.md"),
			[
				"# Agent-First Status",
				"",
				"## North-Star Alignment",
				"Mission: coding-harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
				"Primary metric: PR lead time",
				"Primary bottleneck: review/rework loop",
				"",
				"## Metrics",
				"| Metric | Current | Trend |",
				"| --- | --- | --- |",
				"| `surface_class_counts{core,adjacent,experimental}` | 1/0/0 | flat |",
			].join("\n"),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		const mismatchFinding = result.report.findings.find(
			(f) => f.rule_id === "status.metrics.surface_class_counts.mismatch",
		);
		expect(mismatchFinding).toBeDefined();
		expect(mismatchFinding?.message).toContain("1/0/0");
		expect(mismatchFinding?.message).toContain("0/0/0");
	});

	it("flags missing product-surface ownedPaths and evidenceReference targets", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-product-surface-path-missing",
		);
		roots.push(root);
		createRepoFixture(root);

		const repoRoot = process.cwd();
		const committedContract = JSON.parse(
			readFileSync(join(repoRoot, "harness.contract.json"), "utf-8"),
		) as {
			productSurface?: {
				surfaces?: Array<{
					ownedPaths?: string[];
					evidenceReference?: string;
				}>;
			};
		};
		seedCommittedProductSurfaceFiles(root);

		write(
			join(root, "README.md"),
			readFileSync(join(repoRoot, "README.md"), "utf-8"),
		);
		write(
			join(root, "docs/roadmap/north-star.md"),
			readFileSync(join(repoRoot, "docs/roadmap/north-star.md"), "utf-8"),
		);
		write(
			join(root, "docs/roadmap/agent-first-status.md"),
			readFileSync(
				join(repoRoot, "docs/roadmap/agent-first-status.md"),
				"utf-8",
			),
		);

		const firstSurface = committedContract.productSurface?.surfaces?.[0];
		if (!firstSurface) {
			throw new Error(
				"Expected committed contract to include product surfaces",
			);
		}
		firstSurface.ownedPaths = [
			...(firstSurface.ownedPaths ?? []),
			"src/commands/__missing_owned_surface__.ts",
		];
		firstSurface.evidenceReference = "docs/roadmap/__missing_evidence__.md:4";
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(committedContract, null, 2),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(finding) =>
					finding.rule_id ===
						"status.north_star.contract_parity.product_surface_owned_path_missing" &&
					finding.path === "src/commands/__missing_owned_surface__.ts",
			),
		).toBe(true);
		expect(
			result.report.findings.some(
				(finding) =>
					finding.rule_id ===
						"status.north_star.contract_parity.product_surface_evidence_reference_missing" &&
					finding.path === "docs/roadmap/__missing_evidence__.md:4",
			),
		).toBe(true);
	});

	it("does not remap missing absolute product-surface references into repo-relative paths", () => {
		const root = join(
			process.cwd(),
			"artifacts",
			"drift-gate-test-absolute-product-surface-path-missing",
		);
		roots.push(root);
		createRepoFixture(root);

		const repoRoot = process.cwd();
		const absoluteOwnedPath = join(
			root,
			"..",
			"..",
			"tmp",
			"missing-absolute-owned-surface.ts",
		);
		const absoluteEvidencePath = join(
			root,
			"..",
			"..",
			"tmp",
			"missing-absolute-evidence.md",
		);
		const repoShadowOwnedPath = join(
			root,
			absoluteOwnedPath.replace(/^\/+/, ""),
		);
		const repoShadowEvidencePath = join(
			root,
			absoluteEvidencePath.replace(/^\/+/, ""),
		);
		const committedContract = JSON.parse(
			readFileSync(join(repoRoot, "harness.contract.json"), "utf-8"),
		) as {
			productSurface?: {
				surfaces?: Array<{
					ownedPaths?: string[];
					evidenceReference?: string;
				}>;
			};
		};
		seedCommittedProductSurfaceFiles(root);

		write(
			join(root, "README.md"),
			readFileSync(join(repoRoot, "README.md"), "utf-8"),
		);
		write(
			join(root, "docs/roadmap/north-star.md"),
			readFileSync(join(repoRoot, "docs/roadmap/north-star.md"), "utf-8"),
		);
		write(
			join(root, "docs/roadmap/agent-first-status.md"),
			readFileSync(
				join(repoRoot, "docs/roadmap/agent-first-status.md"),
				"utf-8",
			),
		);
		write(repoShadowOwnedPath, "export const shadow = true;\n");
		write(repoShadowEvidencePath, "# shadow\n");

		const firstSurface = committedContract.productSurface?.surfaces?.[0];
		if (!firstSurface) {
			throw new Error(
				"Expected committed contract to include product surfaces",
			);
		}
		firstSurface.ownedPaths = [
			...(firstSurface.ownedPaths ?? []),
			absoluteOwnedPath,
		];
		firstSurface.evidenceReference = `${absoluteEvidencePath}:4`;
		write(
			join(root, "harness.contract.json"),
			JSON.stringify(committedContract, null, 2),
		);

		const result = runDriftGate({
			repoRoot: root,
			mode: "advisory",
			seedBaseline: false,
		});

		expect(
			result.report.findings.some(
				(finding) =>
					finding.rule_id ===
						"status.north_star.contract_parity.product_surface_owned_path_missing" &&
					finding.path === absoluteOwnedPath,
			),
		).toBe(true);
		expect(
			result.report.findings.some(
				(finding) =>
					finding.rule_id ===
						"status.north_star.contract_parity.product_surface_evidence_reference_missing" &&
					finding.path === `${absoluteEvidencePath}:4`,
			),
		).toBe(true);
	});
});
