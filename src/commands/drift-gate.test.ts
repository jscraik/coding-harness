import {
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
