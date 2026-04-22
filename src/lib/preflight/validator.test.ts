import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_CONTRACT,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "../contract/types.js";
import type { PreflightAdmissionDeclaration } from "./types.js";
import { runPreflightGate } from "./validator.js";

describe("runPreflightGate", () => {
	let tempDir: string;
	let originalCwd: string;
	const originalPath = process.env.PATH ?? "";
	const cleanupPaths: string[] = [];

	beforeEach(() => {
		originalCwd = process.cwd();
		tempDir = join(
			tmpdir(),
			`harness-preflight-validator-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		);
		mkdirSync(tempDir, { recursive: true });
		process.chdir(tempDir);
		mkdirSync(".git", { recursive: true });
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
		for (const path of cleanupPaths.splice(0, cleanupPaths.length)) {
			rmSync(path, { recursive: true, force: true });
		}
		process.env.PATH = originalPath;
	});

	function writeExecutable(path: string, content: string): void {
		writeFileSync(path, content, { encoding: "utf-8" });
		chmodSync(path, 0o755);
	}

	function writeRepoPackageVersion(version: string): void {
		writeFileSync(
			"package.json",
			JSON.stringify({ name: "@brainwav/coding-harness", version }),
			{ encoding: "utf-8" },
		);
	}

	it("uses default harness.contract.json when contractPath is omitted", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
		);
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const riskTierCheck = result.checks.find(
			(check) => check.id === "risk-tier",
		);

		expect(riskTierCheck?.passed).toBe(true);
		expect(riskTierCheck?.message).toBe("Current tier: high");
		expect(result.riskTier).toBe("high");
	});

	it("skips risk-tier when no default contract exists", async () => {
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const riskTierCheck = result.checks.find(
			(check) => check.id === "risk-tier",
		);

		expect(riskTierCheck?.passed).toBe(true);
		expect(riskTierCheck?.message).toBe(
			"Skipped: no contract or files provided",
		);
		expect(result.riskTier).toBeUndefined();
	});

	it("fails closed when contract exists but is invalid", async () => {
		writeFileSync("harness.contract.json", "{invalid-json");
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const contractLoadCheck = result.checks.find(
			(check) => check.id === "contract-load",
		);

		expect(result.passed).toBe(false);
		expect(contractLoadCheck?.passed).toBe(false);
		expect(contractLoadCheck?.message).toContain("Invalid contract:");
		expect(result.riskTier).toBeUndefined();
	});

	it("skips risk-tier when files option is omitted", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
		);

		const result = await runPreflightGate({
			maxTier: "low",
		});
		const riskTierCheck = result.checks.find(
			(check) => check.id === "risk-tier",
		);

		expect(riskTierCheck?.passed).toBe(true);
		expect(riskTierCheck?.message).toBe(
			"Skipped: no contract or files provided",
		);
		expect(result.riskTier).toBeUndefined();
	});

	it("fails when evaluated risk tier exceeds maxTier policy ceiling", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
		);
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
			maxTier: "medium",
		});
		const riskTierCheck = result.checks.find(
			(check) => check.id === "risk-tier",
		);

		expect(result.passed).toBe(false);
		expect(result.riskTier).toBe("high");
		expect(riskTierCheck?.passed).toBe(false);
		expect(riskTierCheck?.message).toContain(
			"Risk tier 'high' exceeds maximum allowed 'medium'",
		);
	});

	it("short-circuits native checks when pre hook skip-all-checks is enabled", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						pre: [{ id: "skip-all-checks" }],
					},
				},
			}),
		);
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});

		expect(result.passed).toBe(true);
		expect(result.checks.some((check) => check.id === "risk-tier")).toBe(false);
		expect(
			result.checks.some((check) => check.id === "hook:pre:skip-all-checks"),
		).toBe(true);
		expect(result.hookDecisions?.[0]?.action).toBe("short-circuit");
	});

	it("applies pre hooks when files option is omitted", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						pre: [{ id: "force-fail" }],
					},
				},
			}),
		);

		const result = await runPreflightGate({});
		const hookCheck = result.checks.find(
			(check) => check.id === "hook:pre:force-fail",
		);

		expect(result.passed).toBe(false);
		expect(hookCheck?.passed).toBe(false);
		expect(result.hookDecisions?.[0]?.action).toBe("override");
	});

	it("blocks successful runs when post hook fail-on-warnings sees warning findings", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						post: [{ id: "fail-on-warnings" }],
					},
				},
			}),
		);
		mkdirSync("src", { recursive: true });
		writeFileSync("src/debug.ts", "console.log('debug');\n");

		const result = await runPreflightGate({
			files: ["src/debug.ts"],
		});
		const hookCheck = result.checks.find(
			(check) => check.id === "hook:post:fail-on-warnings",
		);

		expect(result.passed).toBe(false);
		expect(hookCheck?.passed).toBe(false);
		expect(
			result.hookDecisions?.some((decision) => decision.action === "block"),
		).toBe(true);
	});

	it("fails when global and repo-local harness versions drift", async () => {
		writeFileSync(
			"harness.contract.json",
			JSON.stringify({
				version: "1.0",
				riskTierRules: {
					"src/auth/**": "high",
				},
			}),
		);
		mkdirSync("src/auth", { recursive: true });
		writeFileSync("src/auth/login.ts", "export const login = true;\n");
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'harness v0.12.0'\n",
		);
		writeRepoPackageVersion("0.12.0");

		const fakeBinDir = join(
			tmpdir(),
			`harness-preflight-bin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
		);
		mkdirSync(fakeBinDir, { recursive: true });
		cleanupPaths.push(fakeBinDir);
		writeExecutable(
			join(fakeBinDir, "harness"),
			"#!/usr/bin/env bash\necho 'harness v0.6.0'\n",
		);
		process.env.PATH = `${fakeBinDir}${delimiter}${originalPath}`;

		const result = await runPreflightGate({
			files: ["src/auth/login.ts"],
		});
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck?.passed).toBe(false);
		expect(coherenceCheck?.severity).toBe("error");
		expect(coherenceCheck?.message).toContain("Version drift detected");
		expect(result.passed).toBe(false);
	});

	it("passes harness-version-coherence when no repo-local runner found (skip)", async () => {
		// No scripts/harness-cli.sh in cwd — coherence returns skip → passed=true
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({ files: [] });
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck).toBeDefined();
		expect(coherenceCheck?.passed).toBe(true);
	});

	it("fails with warning severity when repo-local version cannot be determined", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'not-a-version'\n",
		);

		const result = await runPreflightGate({ files: [] });
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck?.passed).toBe(false);
		expect(coherenceCheck?.severity).toBe("warning");
		expect(coherenceCheck?.message).toContain("Could not determine");
	});

	it("harness-version-coherence check is registered in PREFLIGHT_CHECKS", async () => {
		const { PREFLIGHT_CHECKS } = await import("./validator.js");
		expect(PREFLIGHT_CHECKS).toHaveProperty("harness-version-coherence");
		const entry = PREFLIGHT_CHECKS["harness-version-coherence"];
		expect(entry?.name).toBe("Harness Version Coherence");
		expect(entry?.severity).toBe("error");
		expect(typeof entry?.fn).toBe("function");
	});

	it("harness-version-coherence check can be skipped via options.skip", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'not-a-version'\n",
		);

		const result = await runPreflightGate({
			files: [],
			skip: ["harness-version-coherence"],
		});
		const coherenceCheck = result.checks.find(
			(check) => check.id === "harness-version-coherence",
		);

		expect(coherenceCheck).toBeUndefined();
	});

	it("requires admission declaration when contract north-star is present", async () => {
		writeFileSync("harness.contract.json", JSON.stringify(DEFAULT_CONTRACT));
		mkdirSync("src/commands", { recursive: true });
		writeFileSync(
			"src/commands/review-gate.ts",
			"export const reviewGate = true;\n",
		);

		const result = await runPreflightGate({
			files: ["src/commands/review-gate.ts"],
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain("admission_incomplete:");
		expect(admissionCheck?.message).toContain("--admission-file");
	});

	it("allows explicit admission bypass via --skip admission-declaration", async () => {
		writeFileSync("harness.contract.json", JSON.stringify(DEFAULT_CONTRACT));
		mkdirSync("src/commands", { recursive: true });
		writeFileSync(
			"src/commands/review-gate.ts",
			"export const reviewGate = true;\n",
		);

		const result = await runPreflightGate({
			files: ["src/commands/review-gate.ts"],
			skip: ["admission-declaration"],
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(admissionCheck).toBeUndefined();
	});

	it("fails admission declaration when required fields are missing", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "",
				primary_bottleneck: "",
				affected_surface_ids: [],
				affected_surface_classes: [],
				policy_surface_delta: 0,
				manual_glue_delta: 0,
				metric_impact_declared: "none",
				evidence_links: [],
				why_this_improves_throughput_or_reliability: "",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain("north_star_metric is required");
		expect(admissionCheck?.message).toContain(
			"evidence_links must contain at least one evidence reference",
		);
	});

	it("fails admission declaration when north-star fields diverge from contract", async () => {
		writeFileSync("harness.contract.json", JSON.stringify(DEFAULT_CONTRACT));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "cycle_time",
				primary_bottleneck: "handoff_latency",
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Tightens admission declaration enforcement.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			`north_star_metric must match contract primaryMetric '${NORTH_STAR_PRIMARY_METRIC}'`,
		);
		expect(admissionCheck?.message).toContain(
			`primary_bottleneck must match contract primaryBottleneck '${NORTH_STAR_PRIMARY_BOTTLENECK}'`,
		);
	});

	it("passes admission declaration when north-star fields align with contract", async () => {
		writeFileSync("harness.contract.json", JSON.stringify(DEFAULT_CONTRACT));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: NORTH_STAR_PRIMARY_METRIC,
				primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Maintains contract alignment while reducing manual glue.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(admissionCheck?.passed).toBe(true);
		expect(admissionCheck?.message).toContain(
			"Admission declaration is complete and aligned to contract north-star fields",
		);
	});

	it("emits surface_registration_gap when affected surface ids are not in productSurface inventory", async () => {
		const contract = {
			...DEFAULT_CONTRACT,
			productSurface: {
				surfaces: [
					{
						surfaceId: "review-gate",
						surfaceType: "command",
						class: "core",
						owner: "codex",
						northStarContribution: "Protects merge-readiness checks.",
						manualGlueReductionClaim: "Reduces manual rerun decisions.",
						reliabilityContribution: "Enforces deterministic checks.",
						evidenceReference: "src/commands/review-gate.ts:1",
						ownedPaths: ["src/commands/review-gate.ts"],
						lastReviewedAt: "2026-04-21",
					},
				],
			},
		};
		writeFileSync("harness.contract.json", JSON.stringify(contract));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: NORTH_STAR_PRIMARY_METRIC,
				primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				affected_surface_ids: ["unknown-surface"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Keeps admission declarations mapped to registered surfaces.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"surface_registration_gap: affected_surface_ids contains unknown surface id(s): unknown-surface",
		);
	});

	it("emits surface_registration_gap when governed changed files are not covered by productSurface ownedPaths", async () => {
		const contract = {
			...DEFAULT_CONTRACT,
			productSurface: {
				surfaces: [
					{
						surfaceId: "review-gate",
						surfaceType: "command",
						class: "core",
						owner: "codex",
						northStarContribution: "Protects merge-readiness checks.",
						manualGlueReductionClaim: "Reduces manual rerun decisions.",
						reliabilityContribution: "Enforces deterministic checks.",
						evidenceReference: "src/commands/review-gate.ts:1",
						ownedPaths: ["src/commands/review-gate.ts"],
						lastReviewedAt: "2026-04-21",
					},
				],
			},
		};
		writeFileSync("harness.contract.json", JSON.stringify(contract));
		mkdirSync("src/commands", { recursive: true });
		writeFileSync(
			"src/commands/new-governance-gate.ts",
			"export const gate = true;\n",
		);

		const result = await runPreflightGate({
			files: ["src/commands/new-governance-gate.ts"],
			admission: {
				north_star_metric: NORTH_STAR_PRIMARY_METRIC,
				primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Detects governed file changes that are not mapped in inventory.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"surface_registration_gap: governed changed file 'src/commands/new-governance-gate.ts' is not covered by productSurface.surfaces[].ownedPaths",
		);
	});

	it("derives governed roots from productSurface ownedPaths for non-command runtime surfaces", async () => {
		const contract = {
			...DEFAULT_CONTRACT,
			productSurface: {
				surfaces: [
					{
						surfaceId: "runtime-review-evidence",
						surfaceType: "command",
						class: "core",
						owner: "codex",
						northStarContribution:
							"Keeps review evidence routing deterministic.",
						manualGlueReductionClaim: "Eliminates ad hoc policy routing.",
						reliabilityContribution:
							"Preserves canonical failure-class mapping.",
						evidenceReference: "src/lib/output/normalise.ts:1",
						ownedPaths: ["src/lib/output/normalise.ts"],
						lastReviewedAt: "2026-04-22",
					},
				],
			},
		};
		writeFileSync("harness.contract.json", JSON.stringify(contract));
		mkdirSync("src/lib/output", { recursive: true });
		writeFileSync(
			"src/lib/output/runtime-adapter.ts",
			"export const value = 1;\n",
		);

		const result = await runPreflightGate({
			files: ["src/lib/output/runtime-adapter.ts"],
			admission: {
				north_star_metric: NORTH_STAR_PRIMARY_METRIC,
				primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
				affected_surface_ids: ["runtime-review-evidence"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Catches runtime-surface drift beyond command-only ownership.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"surface_registration_gap: governed changed file 'src/lib/output/runtime-adapter.ts' is not covered by productSurface.surfaces[].ownedPaths",
		);
	});

	it("matches governed files against globbed and absolute ownedPaths without false surface-registration gaps", async () => {
		const contract = {
			...DEFAULT_CONTRACT,
			productSurface: {
				surfaces: [
					{
						surfaceId: "globbed-surface",
						surfaceType: "command",
						class: "core",
						owner: "codex",
						northStarContribution: "Keeps governed files mapped by glob.",
						manualGlueReductionClaim:
							"Prevents manual inventory updates for obvious path families.",
						reliabilityContribution:
							"Normalizes admission checks across relative and absolute file inputs.",
						evidenceReference: "src/commands/review-gate.ts:1",
						ownedPaths: ["src/**", "src/commands/*.ts"],
						lastReviewedAt: "2026-04-22",
					},
				],
			},
		};
		writeFileSync("harness.contract.json", JSON.stringify(contract));
		mkdirSync("src/commands", { recursive: true });
		writeFileSync(
			"src/commands/owned-by-glob.ts",
			"export const covered = true;\n",
		);

		for (const changedFile of [
			"src/commands/owned-by-glob.ts",
			join(tempDir, "src/commands/owned-by-glob.ts"),
		]) {
			const result = await runPreflightGate({
				files: [changedFile],
				admission: {
					north_star_metric: NORTH_STAR_PRIMARY_METRIC,
					primary_bottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
					affected_surface_ids: ["globbed-surface"],
					affected_surface_classes: ["core"],
					policy_surface_delta: 0,
					manual_glue_delta: -1,
					metric_impact_declared: "path_strengthening",
					evidence_links: ["docs/roadmap/north-star.md"],
					why_this_improves_throughput_or_reliability:
						"Ensures owned-path matching stays stable for globbed and absolute file inputs.",
				},
			});
			const admissionCheck = result.checks.find(
				(check) => check.id === "admission-declaration",
			);

			expect(result.passed).toBe(true);
			expect(admissionCheck?.passed).toBe(true);
			expect(admissionCheck?.message ?? "").not.toContain(
				"surface_registration_gap",
			);
		}
	});

	it("fails admission declaration gracefully for malformed runtime payloads", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: null,
				primary_bottleneck: 42,
				affected_surface_ids: "review-gate",
				affected_surface_classes: { class: "core" },
				policy_surface_delta: 0,
				manual_glue_delta: 0,
				metric_impact_declared: "none",
				evidence_links: false,
				why_this_improves_throughput_or_reliability: undefined,
			} as unknown as PreflightAdmissionDeclaration,
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain("north_star_metric is required");
		expect(admissionCheck?.message).toContain(
			"affected_surface_ids must contain at least one surface id",
		);
	});

	it("fails admission declaration when array fields contain only empty-string values", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["", "   "],
				affected_surface_classes: ["  ", ""],
				policy_surface_delta: 0,
				manual_glue_delta: 0,
				metric_impact_declared: "direct",
				evidence_links: ["  ", ""],
				why_this_improves_throughput_or_reliability: "Reduces rework loop",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"affected_surface_ids must contain at least one surface id",
		);
		expect(admissionCheck?.message).toContain(
			"affected_surface_classes must contain at least one surface class",
		);
		expect(admissionCheck?.message).toContain(
			"evidence_links must contain at least one evidence reference",
		);
	});

	it("fails admission declaration when policy delta grows without impact declaration", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 1,
				manual_glue_delta: 0,
				metric_impact_declared: "none",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability: "Adds gate coverage",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"metric_impact_declared cannot be 'none' when policy_surface_delta > 0",
		);
	});

	it("fails admission declaration when metric_impact_declared is unsupported", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: 0,
				metric_impact_declared:
					"unknown" as unknown as PreflightAdmissionDeclaration["metric_impact_declared"],
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability: "Adds gate coverage",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"metric_impact_declared must be one of: direct, path_strengthening, none",
		);
	});

	it("fails admission declaration when evidence links are not resolvable references", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["n/a", "proof"],
				why_this_improves_throughput_or_reliability:
					"Prevents untraceable admission declarations.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(false);
		expect(admissionCheck?.passed).toBe(false);
		expect(admissionCheck?.message).toContain(
			"evidence_links entries must be URL, markdown link, path, or file:line reference",
		);
		expect(admissionCheck?.message).toContain("n/a");
		expect(admissionCheck?.message).toContain("proof");
	});

	it("accepts admission evidence links as URL, markdown link, path, and file:line references", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));

		const result = await runPreflightGate({
			admission: {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "direct",
				evidence_links: [
					"https://example.com/evidence",
					"[north-star](docs/roadmap/north-star.md)",
					"artifacts/reviews/testing-review-rerun20.md",
					"src/lib/preflight/validator.ts:545",
				],
				why_this_improves_throughput_or_reliability:
					"Keeps admission evidence machine-traceable.",
			},
		});
		const admissionCheck = result.checks.find(
			(check) => check.id === "admission-declaration",
		);

		expect(result.passed).toBe(true);
		expect(admissionCheck?.passed).toBe(true);
	});

	it("escalates warnings to failure when strict mode is enabled", async () => {
		writeFileSync("harness.contract.json", JSON.stringify({ version: "1.0" }));
		mkdirSync("scripts", { recursive: true });
		writeExecutable(
			"scripts/harness-cli.sh",
			"#!/usr/bin/env bash\necho 'not-a-version'\n",
		);

		const nonStrict = await runPreflightGate({
			files: [],
			strict: false,
			skip: ["admission-declaration"],
		});
		const strict = await runPreflightGate({
			files: [],
			strict: true,
			skip: ["admission-declaration"],
		});

		expect(nonStrict.summary.warnings).toBeGreaterThan(0);
		expect(nonStrict.passed).toBe(true);
		expect(strict.summary.warnings).toBeGreaterThan(0);
		expect(strict.passed).toBe(false);
	});
});
