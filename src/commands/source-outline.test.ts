import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	EXIT_CODES,
	runSourceOutline,
	runSourceOutlineCLI,
} from "./source-outline.js";

describe("runSourceOutline", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		while (tempDirs.length > 0) {
			const dir = tempDirs.pop();
			if (dir) {
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	function createWorkspace(): string {
		const workspacePath = mkdtempSync(join(tmpdir(), "source-outline-"));
		tempDirs.push(workspacePath);
		mkdirSync(join(workspacePath, "src"), { recursive: true });
		writeFileSync(
			join(workspacePath, "src", "example.ts"),
			`/**
 * Greets one user.
 */
export function greet(input: string): string {
	const normalized = input.trim();
	return normalized.toUpperCase();
}

/** Worker contract. */
export interface WorkerOptions {
	readonly name: string;
}

/** Runs queued work. */
export class Worker {
	/** Handler set at construction time. */
	handler = (value: number): number => {
		return value + 10;
	};

	/** Start one job. */
	run(count: number): number {
		return count + 1;
	}
}

/** Lazily formats one value. */
export const format = (value: number): string => {
	return String(value);
};
`,
		);
		return workspacePath;
	}

	it("returns comments and signatures without implementation bodies", () => {
		const workspacePath = createWorkspace();

		const output = runSourceOutline({
			baseDir: workspacePath,
			path: "src/example.ts",
		});

		expect(output.success).toBe(true);
		expect(output.mode).toBe("outline");
		expect(output.path).toBe("src/example.ts");
		expect(output.symbols.map((symbol) => symbol.qualifiedName)).toEqual([
			"greet",
			"WorkerOptions",
			"Worker",
			"format",
		]);
		const greet = output.symbols.find((symbol) => symbol.name === "greet");
		expect(greet?.comments).toEqual(["Greets one user."]);
		expect(greet?.signature).toBe(
			"export function greet(input: string): string;",
		);
		expect(greet?.signature).not.toContain("toUpperCase");
		const worker = output.symbols.find((symbol) => symbol.name === "Worker");
		expect(worker?.children.map((symbol) => symbol.qualifiedName)).toEqual([
			"Worker.handler",
			"Worker.run",
		]);
		const handler = worker?.children.find(
			(symbol) => symbol.name === "handler",
		);
		expect(handler?.signature).toBe("handler = ...;");
		expect(handler?.signature).not.toContain("return value + 10;");
	});

	it("unwraps one requested implementation by qualified symbol name", () => {
		const workspacePath = createWorkspace();

		const output = runSourceOutline({
			baseDir: workspacePath,
			path: "src/example.ts",
			symbol: "Worker.run",
		});

		expect(output.success).toBe(true);
		expect(output.mode).toBe("implementation");
		expect(output.implementation?.symbol).toBe("Worker.run");
		expect(output.implementation?.text).toContain("return count + 1;");
		expect(output.implementation?.text).not.toContain("toUpperCase");
		expect(output.implementation?.text).not.toContain("return String(value);");
	});

	it("reports an error when the requested symbol is absent", () => {
		const workspacePath = createWorkspace();

		const output = runSourceOutline({
			baseDir: workspacePath,
			path: "src/example.ts",
			symbol: "missing",
		});

		expect(output.success).toBe(false);
		expect(output.error).toBe("Symbol not found: missing");
		expect(output.symbols.length).toBeGreaterThan(0);
	});

	it("rejects traversal outside the workspace", () => {
		const workspacePath = createWorkspace();

		const output = runSourceOutline({
			baseDir: workspacePath,
			path: "../outside.ts",
		});

		expect(output.success).toBe(false);
		expect(output.error).toBe("Path traversal detected");
	});

	it("rejects unsupported source extensions before parsing", () => {
		const workspacePath = createWorkspace();
		writeFileSync(join(workspacePath, "src", "notes.md"), "# Notes\n");

		const output = runSourceOutline({
			baseDir: workspacePath,
			path: "src/notes.md",
		});

		expect(output.success).toBe(false);
		expect(output.error).toBe(
			'Unsupported source extension ".md". Expected one of: .ts, .tsx, .js, .jsx, .mts, .cts',
		);
	});

	it("prints agent-first usage when no path is provided", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runSourceOutlineCLI([]);
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
			const usage = infoSpy.mock.calls
				.map((call) => String(call[0]))
				.join("\n");
			expect(usage).toContain("before opening implementation bodies");
			expect(usage).toContain("--symbol");
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("treats help as success", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runSourceOutlineCLI(["--help"]);
			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		} finally {
			infoSpy.mockRestore();
		}
	});

	it("rejects missing symbol operands as usage errors", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		try {
			const exitCode = runSourceOutlineCLI(["src/example.ts", "--symbol"]);
			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		} finally {
			infoSpy.mockRestore();
		}
	});
});
