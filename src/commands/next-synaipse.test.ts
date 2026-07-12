import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import { readSynaipseRepositorySha } from "../lib/synaipse/state.js";
import { runHarnessNext } from "./next-runner.js";
import { runNextCLI } from "./next.js";

function captureNextCLI(
	args: string[],
	options: Parameters<typeof runNextCLI>[1],
): { exitCode: number; output: string } {
	const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		const exitCode = runNextCLI(args, options);
		return {
			exitCode,
			output: String(infoSpy.mock.calls.at(-1)?.[0] ?? ""),
		};
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

const transition = {
	schemaVersion: "synaipse-transition/v1",
	runtimeStatus: "not_yet_emitted",
	fromStage: "shape",
	toStage: "admit",
	repository: { name: "jscraik/coding-harness", sha: "a".repeat(40) },
	evidence: { admitted: ["plan:synaipse-v1"], rejected: [] },
	policy: "standing_authority",
	authority: { owner: "codex", standing: true },
	blockers: [],
	waivers: [],
	decidedAt: "2026-07-12T15:00:00Z",
	recovery: null,
} as const;

describe("harness next SynAIpse transition routing", () => {
	it("interrupts only for a valid Vital Decision", () => {
		const repositorySha = readSynaipseRepositorySha(process.cwd());
		if (repositorySha === null)
			throw new Error("test repository SHA unavailable");
		const decision = runHarnessNext({
			repoRoot: process.cwd(),
			files: [],
			synaipseTransition: {
				...transition,
				repository: { ...transition.repository, sha: repositorySha },
				policy: "vital_decision_gate",
				authority: { owner: "operator", standing: false },
				blockers: ["public_compatibility_change"],
				recovery: { stage: "admit", action: "Wait for operator decision." },
			},
		});

		expect(decision.status).toBe("blocked");
		expect(decision.requiresHuman).toBe(true);
		expect(decision.failureClass).toBe("synaipse_vital_decision");
	});

	it("routes stale transition evidence to Codex repair", () => {
		const decision = runHarnessNext({
			repoRoot: process.cwd(),
			files: [],
			synaipseTransition: transition,
		});

		expect(decision.requiresHuman).toBe(false);
		expect(decision.failureClass).toBe("synaipse_transition_invalid");
	});

	it("loads a repository transition packet through the actual next CLI", () => {
		const repositorySha = readSynaipseRepositorySha(process.cwd());
		if (repositorySha === null)
			throw new Error("test repository SHA unavailable");
		const tempRoot = mkdtempSync(
			join(process.cwd(), "artifacts", "synaipse-transition-test-"),
		);
		const transitionPath = join(tempRoot, "transition.json");
		try {
			const example = JSON.parse(
				readFileSync(
					"contracts/examples/synaipse-transition.example.json",
					"utf8",
				),
			) as Record<string, unknown>;
			const repository = example.repository as Record<string, unknown>;
			writeFileSync(
				transitionPath,
				JSON.stringify(
					{ ...example, repository: { ...repository, sha: repositorySha } },
					null,
					2,
				),
			);
			const relativeTransitionPath = transitionPath.replace(
				`${process.cwd()}/`,
				"",
			);
			const { exitCode, output } = captureNextCLI(
				["--json", "--synaipse-transition", relativeTransitionPath],
				{
					repoRoot: process.cwd(),
					inspectChangedFiles: () => [],
				},
			);

			expect(exitCode).toBe(0);
			const decision = JSON.parse(output) as ReturnType<typeof runHarnessNext>;
			expect(validateHarnessDecision(decision)).toEqual({
				valid: true,
				errors: [],
			});
			expect(decision.failureClass).not.toBe("synaipse_transition_invalid");
		} finally {
			rmSync(tempRoot, { recursive: true, force: true });
		}
	});
});
