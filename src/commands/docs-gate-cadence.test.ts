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
		commitAll(root, "attempt broader contract change", gitEnv);

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
});
