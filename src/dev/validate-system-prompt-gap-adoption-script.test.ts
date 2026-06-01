import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL(
		"../../scripts/validate-system-prompt-gap-adoption.cjs",
		import.meta.url,
	),
);

const SOURCE_PATH =
	".harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md";
const GOAL_PATH = "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md";
const STATE_PATH =
	"docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml";
const RECEIPTS_PATH =
	"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl";
const PLAN_PATH =
	".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md";
const SPEC_PATH =
	".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md";
const EVIDENCE_PATTERNS_PATH = ".harness/research/evidence-patterns.json";
const PATTERN_ID = "2026-05-27-codex-system-prompt-operational-analysis";
const SPG_IDS = Array.from({ length: 12 }, (_, index) => {
	return `SPG-${String(index + 1).padStart(3, "0")}`;
});

const roots: string[] = [];

function write(root: string, relativePath: string, text: string) {
	const absolutePath = join(root, relativePath);
	mkdirSync(join(absolutePath, ".."), { recursive: true });
	writeFileSync(absolutePath, text);
}

function makeRoot() {
	const root = mkdtempSync(join(tmpdir(), "spg-adoption-"));
	roots.push(root);
	write(
		root,
		EVIDENCE_PATTERNS_PATH,
		`${JSON.stringify(
			{
				patterns: [
					{
						dispositionReason: "SPG fixture",
						id: PATTERN_ID,
						owner: "codex",
						source: SOURCE_PATH,
						status: "adopted",
						targetSurfaces: [
							GOAL_PATH,
							STATE_PATH,
							RECEIPTS_PATH,
							PLAN_PATH,
							SPEC_PATH,
						],
						validationCommand:
							"node scripts/validate-system-prompt-gap-adoption.cjs --json",
					},
				],
				schemaVersion: "evidence-patterns/v1",
			},
			null,
			2,
		)}\n`,
	);
	write(
		root,
		SOURCE_PATH,
		`# System Prompt Operational Findings\n\nPattern: ${PATTERN_ID}\n`,
	);
	write(
		root,
		GOAL_PATH,
		`# Goal\n\n2026-05-27 Codex system-prompt operational analysis\nSPG-001 through SPG-012\n${SPG_IDS.join("\n")}\n`,
	);
	write(
		root,
		STATE_PATH,
		`system_prompt_analysis_adoption:\n  evidence_registry_id: "${PATTERN_ID}"\n  blocker: SPG-001 through SPG-012\n  ids:\n${SPG_IDS.map((id) => `    - ${id}`).join("\n")}\n`,
	);
	write(
		root,
		RECEIPTS_PATH,
		`{"id":"R1","audit_gap_ids":["GAP-002"],"source":"${SOURCE_PATH}"}\n`,
	);
	write(
		root,
		PLAN_PATH,
		`# Plan\n\nruntime evidence target for ${SOURCE_PATH}\nSPG-001 through SPG-012\n`,
	);
	write(
		root,
		SPEC_PATH,
		`# Spec\n\nRuntime Evidence target for ${SOURCE_PATH}\nSPG-001 through SPG-012\n`,
	);
	return root;
}

function runValidator(root: string) {
	return spawnSync(process.execPath, [SCRIPT_PATH, "--root", root, "--json"], {
		encoding: "utf8",
		env: {
			...process.env,
			SHELL: "/bin/sh",
		},
	});
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("validate-system-prompt-gap-adoption script", () => {
	it("passes a complete SPG adoption fixture", () => {
		const root = makeRoot();
		const result = runValidator(root);
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(0);
		expect(report.status).toBe("pass");
		expect(report.errors).toEqual([]);
	});

	it("fails closed when a required SPG surface is empty", () => {
		const root = makeRoot();
		write(root, GOAL_PATH, "");
		const result = runValidator(root);
		const report = JSON.parse(result.stdout);

		expect(result.status).toBe(1);
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "required_file_empty",
					path: GOAL_PATH,
				}),
			]),
		);
	});
});
