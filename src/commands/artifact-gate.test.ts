import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runArtifactGateCLI } from "./artifact-gate.js";

describe("artifact-gate command", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		for (const path of cleanup.splice(0)) {
			rmSync(path, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function makeRepo(): string {
		const repoRoot = mkdtempSync(join(tmpdir(), "artifact-gate-"));
		cleanup.push(repoRoot);
		mkdirSync(join(repoRoot, ".harness"), { recursive: true });
		writeFileSync(
			join(repoRoot, ".harness/artifact-provenance.json"),
			JSON.stringify(
				{
					schemaVersion: "artifact-provenance/v1",
					artifacts: [
						{
							path: "scripts/codex-preflight.sh",
							source: "src/templates/codex-preflight.sh",
							checkCommand: "node scripts/sync-codex-preflight.cjs --check",
							writeCommand: "node scripts/sync-codex-preflight.cjs --write",
							reviewPolicy: "review-source-and-sync-generated-copy",
							enforcement: "required",
						},
					],
				},
				null,
				2,
			),
		);
		return repoRoot;
	}

	it("fails required generated artifact changes without source changes", () => {
		const repoRoot = makeRepo();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({
			repoRoot,
			files: ["scripts/codex-preflight.sh"],
			json: true,
		});

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.status).toBe("fail");
		expect(payload.findings[0].id).toBe(
			"artifact-gate.generated_without_source",
		);
		expect(payload.findings[0].severity).toBe("error");
		expect(payload.findings[0].source).toBe("src/templates/codex-preflight.sh");
	});

	it("passes when generated artifact and source change together", () => {
		const repoRoot = makeRepo();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({
			repoRoot,
			files: ["scripts/codex-preflight.sh", "src/templates/codex-preflight.sh"],
			json: true,
		});

		expect(exitCode).toBe(0);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.status).toBe("pass");
		expect(payload.summary.info).toBe(1);
	});

	it("fails required source changes without generated artifact changes", () => {
		const repoRoot = makeRepo();
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({
			repoRoot,
			files: ["src/templates/codex-preflight.sh"],
			json: true,
		});

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.status).toBe("fail");
		expect(payload.findings[0].id).toBe(
			"artifact-gate.source_without_generated",
		);
		expect(payload.findings[0].severity).toBe("error");
		expect(payload.findings[0]).toMatchObject({
			path: "scripts/codex-preflight.sh",
			source: "src/templates/codex-preflight.sh",
		});
	});

	it("warns but does not fail when the registry is missing", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "artifact-gate-missing-"));
		cleanup.push(repoRoot);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({
			repoRoot,
			files: ["scripts/codex-preflight.sh"],
			json: true,
		});

		expect(exitCode).toBe(0);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.status).toBe("warn");
		expect(payload.findings[0].id).toBe("artifact-gate.registry.missing");
	});

	it("returns usage error when no files are passed", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({ files: [], json: true });

		expect(exitCode).toBe(2);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.error.code).toBe("artifact-gate.files_required");
	});

	it("returns usage error when files are blank", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({ files: ["", "  "], json: true });

		expect(exitCode).toBe(2);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.error.code).toBe("artifact-gate.files_required");
	});

	it("fails invalid registries with duplicate, absolute, or escaping paths", () => {
		const repoRoot = makeRepo();
		writeFileSync(
			join(repoRoot, ".harness/artifact-provenance.json"),
			JSON.stringify(
				{
					schemaVersion: "artifact-provenance/v1",
					artifacts: [
						{ path: "dist/cli.js", source: "src/cli.ts" },
						{ path: "dist/cli.js", source: "src/index.ts" },
						{ path: "/tmp/escaped.js", source: "src/escaped.ts" },
						{ path: "scripts/mirror.sh", source: "../template.sh" },
					],
				},
				null,
				2,
			),
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runArtifactGateCLI({
			repoRoot,
			files: ["dist/cli.js"],
			json: true,
		});

		expect(exitCode).toBe(1);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
		expect(payload.findings[0].id).toBe("artifact-gate.registry.invalid");
	});
});
