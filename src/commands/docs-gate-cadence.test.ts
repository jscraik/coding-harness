import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT_INTEGRITY_POLICY } from "../lib/contract/types.js";
import type {
	HarnessContract,
	SurfaceRegistration,
} from "../lib/contract/types.js";
import { validateContract } from "../lib/contract/validator.js";
import {
	isGitEnvironmentKey,
	sanitizeGitEnvironment,
} from "../lib/git/safe-env.js";
import { runDocsGate } from "./docs-gate.js";

function write(path: string, content: string): void {
	writeFileSync(path, content, "utf-8");
}

function writeAt(root: string, path: string, content: string): void {
	const target = join(root, path);
	mkdirSync(dirname(target), { recursive: true });
	write(target, content);
}

function createTestRoot(label: string): string {
	return mkdtempSync(join(tmpdir(), `${label}-`));
}

function seedRequiredTruthSources(root: string): void {
	writeAt(root, "README.md", "# README\nUse `pnpm test`.\n");
	writeAt(root, "AGENTS.md", "# AGENTS\nRun `pnpm test`.\n");
	writeAt(root, "CONTRIBUTING.md", "# CONTRIBUTING\n");
	writeAt(root, "AI/context/diagram-context.md", "# Diagram Context\n");
	writeAt(root, "docs/agents/00-architecture-bootstrap.md", "# Bootstrap\n");
	writeAt(
		root,
		"package.json",
		JSON.stringify({ packageManager: "pnpm@10.33.0" }, null, 2),
	);
}

function seedCadenceContract(root: string): void {
	writeAt(
		root,
		"harness.contract.json",
		JSON.stringify(
			{
				version: "1.5.0",
				contextIntegrityPolicy: DEFAULT_CONTEXT_INTEGRITY_POLICY,
				docsGatePolicy: {
					enabled: true,
					mode: "required",
					rules: [
						{
							ruleId: "contract-policy-docs",
							when: { categories: ["contract_policy"] },
							requireDocs: ["README.md", "AGENTS.md"],
							severity: "error",
						},
					],
				},
				productSurface: {
					surfaces: [
						{
							surfaceId: "agent-first-status-matrix",
							surfaceType: "document",
							class: "adjacent",
							owner: "workflow",
							northStarContribution:
								"Keeps status reporting tied to current evidence.",
							manualGlueReductionClaim:
								"Avoids repeated status interpretation.",
							reliabilityContribution: "Prevents unsupported status claims.",
							evidenceReference: "docs/roadmap/agent-first-status.md",
							reviewCadence: "weekly",
							ownedPaths: ["docs/roadmap/agent-first-status.md"],
							lastReviewedAt: "2026-08-03",
						},
						{
							surfaceId: "north-star-roadmap",
							surfaceType: "document",
							class: "adjacent",
							owner: "workflow",
							northStarContribution: "Keeps roadmap reporting current.",
							manualGlueReductionClaim:
								"Avoids repeated roadmap interpretation.",
							reliabilityContribution: "Prevents unsupported roadmap claims.",
							evidenceReference: "docs/roadmap/north-star.md",
							reviewCadence: "weekly",
							ownedPaths: ["docs/roadmap/north-star.md"],
							lastReviewedAt: "2026-08-03",
						},
					],
				},
			},
			null,
			2,
		),
	);
	writeAt(root, "docs/roadmap/agent-first-status.md", "# Agent-first status\n");
	seedRequiredTruthSources(root);
}

function commitAll(
	root: string,
	message: string,
	env: NodeJS.ProcessEnv,
): void {
	execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore", env });
	execFileSync("git", ["commit", "-m", message], {
		cwd: root,
		stdio: "ignore",
		env,
	});
}

function initializeGitRepository(root: string, env: NodeJS.ProcessEnv): string {
	execFileSync("git", ["init"], { cwd: root, stdio: "ignore", env });
	execFileSync("git", ["config", "user.email", "docs-gate@example.com"], {
		cwd: root,
		stdio: "ignore",
		env,
	});
	execFileSync("git", ["config", "user.name", "Docs Gate Test"], {
		cwd: root,
		stdio: "ignore",
		env,
	});
	commitAll(root, "seed", env);
	return execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf-8",
		env,
	}).trim();
}

function runWithIsolatedGitEnvironment(
	options: Parameters<typeof runDocsGate>[0],
) {
	const saved = Object.entries(process.env).filter(([key]) =>
		isGitEnvironmentKey(key),
	);
	for (const [key] of saved) delete process.env[key];
	try {
		return runDocsGate(options);
	} finally {
		for (const key of Object.keys(process.env)) {
			if (isGitEnvironmentKey(key)) delete process.env[key];
		}
		for (const [key, value] of saved) {
			if (value !== undefined) process.env[key] = value;
		}
	}
}

function updateContract(
	root: string,
	mutate: (contract: HarnessContract) => void,
): void {
	const contractPath = join(root, "harness.contract.json");
	const contract = readFixtureContract(contractPath);
	mutate(contract);
	write(contractPath, JSON.stringify(contract, null, 2));
}

function surface(
	contract: HarnessContract,
	surfaceId: string,
): SurfaceRegistration {
	if (!contract.productSurface) throw new Error("missing fixture registry");
	const candidate = contract.productSurface.surfaces.find(
		(entry) => entry.surfaceId === surfaceId,
	);
	if (!candidate) throw new Error(`missing fixture surface: ${surfaceId}`);
	return candidate;
}

/** Decode fixture JSON before exposing it to cadence mutation helpers. */
function readFixtureContract(path: string): HarnessContract {
	const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
	const validation = validateContract(parsed);
	if (!validation.success || !validation.data) {
		throw new Error("invalid cadence fixture contract");
	}
	return parsed as HarnessContract;
}

describe("agent-first status cadence registration", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots) rmSync(root, { recursive: true, force: true });
		roots.length = 0;
	});

	it("accepts the exact registered review-date and document pair", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		write(
			contractPath,
			readFileSync(contractPath, "utf-8").replace(
				'"lastReviewedAt": "2026-08-03"',
				'"lastReviewedAt": "2026-08-10"',
			),
		);
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		commitAll(root, "refresh weekly cadence", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});
		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toEqual(["doc_only"]);
		expect(result.report.findings).toContainEqual(
			expect.objectContaining({
				rule_id: "docs.gate.agent_first_status_cadence_registration",
				result: "pass",
			}),
		);
	});

	it("accepts the exact pair when it is staged but not committed", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-staged");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		updateContract(root, (contract) => {
			surface(contract, "agent-first-status-matrix").lastReviewedAt =
				"2026-08-10";
		});
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		execFileSync(
			"git",
			["add", "harness.contract.json", "docs/roadmap/agent-first-status.md"],
			{ cwd: root, stdio: "ignore", env: gitEnv },
		);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.categories).toEqual(["doc_only"]);
	});

	it("rejects a contract-date-only change", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-contract-only");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		write(
			contractPath,
			readFileSync(contractPath, "utf-8").replace(
				'"lastReviewedAt": "2026-08-03"',
				'"lastReviewedAt": "2026-08-10"',
			),
		);
		commitAll(root, "change cadence contract without document", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects a status-document-only change", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-document-only");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		commitAll(root, "change status document without contract", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects a nearby surface date change instead of the registered date", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-nearby-date");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		updateContract(root, (contract) => {
			surface(contract, "north-star-roadmap").lastReviewedAt = "2026-08-10";
		});
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		commitAll(root, "change nearby review date", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects the pair when its contract diff includes another policy edit", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-extra-edit");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		write(
			contractPath,
			readFileSync(contractPath, "utf-8")
				.replace(
					'"lastReviewedAt": "2026-08-03"',
					'"lastReviewedAt": "2026-08-10"',
				)
				.replace(
					"Keeps status reporting tied to current evidence.",
					"Changes the status reporting contract.",
				),
		);
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
		expect(result.report.findings).toContainEqual(
			expect.objectContaining({
				rule_id: "docs.surface.missing",
				surface: "README.md",
			}),
		);
	});

	it("rejects an explicit defaulted contract field beside the cadence date", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-raw-default");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		const contract = readFixtureContract(contractPath);
		contract.blastRadiusRulesMode = "merge";
		surface(contract, "agent-first-status-matrix").lastReviewedAt =
			"2026-08-10";
		write(contractPath, JSON.stringify(contract, null, 2));
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		commitAll(root, "add explicit defaulted contract field", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects staged and working-tree contract disagreement", () => {
		const root = createTestRoot(
			"docs-gate-agent-first-cadence-staged-mismatch",
		);
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		const stagedContract = readFixtureContract(contractPath);
		stagedContract.blastRadiusRulesMode = "merge";
		surface(stagedContract, "agent-first-status-matrix").lastReviewedAt =
			"2026-08-10";
		write(contractPath, JSON.stringify(stagedContract, null, 2));
		execFileSync("git", ["add", "harness.contract.json"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});

		const workingContract = readFixtureContract(contractPath);
		delete workingContract.blastRadiusRulesMode;
		write(contractPath, JSON.stringify(workingContract, null, 2));
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		execFileSync("git", ["add", "docs/roadmap/agent-first-status.md"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects impossible calendar dates before granting cadence", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-invalid-date");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		write(
			contractPath,
			readFileSync(contractPath, "utf-8").replace(
				'"lastReviewedAt": "2026-08-03"',
				'"lastReviewedAt": "2026-99-99"',
			),
		);
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-99-99.\n",
		);
		commitAll(root, "reject invalid cadence date", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects future calendar dates before granting cadence", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-future-date");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		const contractPath = join(root, "harness.contract.json");
		write(
			contractPath,
			readFileSync(contractPath, "utf-8").replace(
				'"lastReviewedAt": "2026-08-03"',
				'"lastReviewedAt": "2099-01-01"',
			),
		);
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2099-01-01.\n",
		);
		commitAll(root, "reject future cadence date", gitEnv);

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});

	it("rejects a cadence pair split between HEAD and the worktree", () => {
		const root = createTestRoot("docs-gate-agent-first-cadence-split");
		roots.push(root);
		const gitEnv = sanitizeGitEnvironment({ policy: "strict" });
		seedCadenceContract(root);
		const baseSha = initializeGitRepository(root, gitEnv);
		updateContract(root, (contract) => {
			surface(contract, "agent-first-status-matrix").lastReviewedAt =
				"2026-08-10";
		});
		writeAt(
			root,
			"docs/roadmap/agent-first-status.md",
			"# Agent-first status\n\nReviewed 2026-08-10.\n",
		);
		execFileSync("git", ["add", "harness.contract.json"], {
			cwd: root,
			stdio: "ignore",
			env: gitEnv,
		});

		const result = runWithIsolatedGitEnvironment({
			repoRoot: root,
			mode: "required",
			trustedBaseRef: baseSha,
		});

		expect(result.exitCode).toBe(10);
		expect(result.report.categories).toContain("contract_policy");
	});
});
