import { randomUUID } from "node:crypto";
import {
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isDirectExecution,
	parseCsvList,
	parseIntegerArg,
	run,
} from "./cli.js";

// Mock command modules to avoid actual execution
vi.mock("./commands/remediate.js", () => ({
	runRemediateCLI: vi.fn(async () => 0),
}));

vi.mock("./commands/gap-case.js", () => ({
	runGapCaseCLI: vi.fn(() => 0),
}));

describe("parseIntegerArg", () => {
	it("parses valid integers and respects minimum", () => {
		expect(parseIntegerArg("42")).toBe(42);
		expect(parseIntegerArg(" 7 ", 0)).toBe(7);
		expect(parseIntegerArg("0", 0)).toBe(0);
		expect(parseIntegerArg("-1", 0)).toBeUndefined();
	});

	it("rejects malformed numeric strings", () => {
		expect(parseIntegerArg("1e3", 0)).toBeUndefined();
		expect(parseIntegerArg("12ms", 0)).toBeUndefined();
		expect(parseIntegerArg("3.14", 0)).toBeUndefined();
		expect(parseIntegerArg("", 0)).toBeUndefined();
	});

	it("holds strict parsing invariant for fuzzed inputs", () => {
		let seed = 20260224;
		const rand = (): number => {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			return seed / 0x100000000;
		};

		const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz-+._";
		for (let i = 0; i < 300; i++) {
			const len = 1 + Math.floor(rand() * 8);
			let candidate = "";
			for (let j = 0; j < len; j++) {
				candidate +=
					alphabet[Math.floor(rand() * alphabet.length)] ?? alphabet[0] ?? "0";
			}

			const trimmed = candidate.trim();
			const isStrictInt = /^-?\d+$/.test(trimmed);
			const expected = isStrictInt ? Number.parseInt(trimmed, 10) : undefined;
			const actual = parseIntegerArg(candidate, Number.NEGATIVE_INFINITY);

			expect(actual).toBe(expected);
		}
	});
});

describe("parseCsvList", () => {
	it("parses comma-separated values and strips empties", () => {
		expect(parseCsvList("a,b,c")).toEqual(["a", "b", "c"]);
		expect(parseCsvList(" a , , b ,, c ")).toEqual(["a", "b", "c"]);
		expect(parseCsvList(", ,")).toEqual([]);
		expect(parseCsvList(undefined)).toEqual([]);
	});

	it("is robust for fuzzed comma/noise input", () => {
		let seed = 424242;
		const rand = (): number => {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			return seed / 0x80000000;
		};

		const alphabet = "abc/._- ,";
		for (let i = 0; i < 200; i++) {
			const len = Math.floor(rand() * 24);
			let candidate = "";
			for (let j = 0; j < len; j++) {
				candidate +=
					alphabet[Math.floor(rand() * alphabet.length)] ?? alphabet[0] ?? "a";
			}

			const result = parseCsvList(candidate);
			expect(Array.isArray(result)).toBe(true);
			expect(result.every((item) => item.length > 0)).toBe(true);
			expect(result.every((item) => item === item.trim())).toBe(true);
		}
	});
});

describe("run", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("exits with code 1 for unknown command", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// silence usage output in test
		});

		expect(() => run(["totally-unknown-command"])).toThrowError("EXIT_1");
		expect(exitSpy).toHaveBeenCalledWith(1);
		expect(infoSpy).toHaveBeenCalledWith(
			'Unknown command: "totally-unknown-command"',
		);
	});

	it("returns unknown-command JSON suggestions from the catalog path", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// silence output in test
		});

		expect(() => run(["totally-unknown-command", "--json"])).toThrowError(
			"EXIT_1",
		);

		const payload = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0] ?? "{}"));
		expect(payload.status).toBe("error");
		expect(payload.error).toBe("unknown_command");
		expect(payload.received).toBe("totally-unknown-command");
		expect(Array.isArray(payload.suggestions)).toBe(true);
		expect(payload.suggestions.length).toBeGreaterThan(0);
		expect(payload.suggestions[0]).toHaveProperty("name");
		expect(payload.suggestions[0]).toHaveProperty("summary");
		expect(payload.suggestions[0]).toHaveProperty("mutability");
		expect(payload.suggestions[0]).toHaveProperty("retryability");
		expect(payload.suggestions[0]).toHaveProperty("requiredFlags");
		expect(payload.suggestions[0]).toHaveProperty("safeFirstAlternatives");
		expect(payload.hint).toBe(
			'Run "harness --help --all-commands" for the full expert command list.',
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("keeps unknown commands fail-closed by default even when typo is close", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// silence output in test
		});

		expect(() => run(["drfit-gate", "--json"])).toThrowError("EXIT_1");
		const payload = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0] ?? "{}"));
		expect(payload.error).toBe("unknown_command");
		expect(payload.received).toBe("drfit-gate");
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("points unknown text commands to expert help discovery", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
			// silence output in test
		});

		expect(() => run(["totally-unknown-command"])).toThrowError("EXIT_1");

		const lines = infoSpy.mock.calls.map((call) => String(call[0] ?? ""));
		expect(lines).toContain(
			'Run "harness --help --all-commands" for the full expert command list.',
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("allows fuzzy command correction only when --allow-fuzzy is provided", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const stderrWriteSpy = vi
			.spyOn(process.stderr, "write")
			.mockImplementation(() => true);

		expect(() => run(["drfit-gate", "--allow-fuzzy", "--json"])).toThrowError(
			"EXIT_0",
		);
		expect(exitSpy).toHaveBeenCalledWith(0);
		expect(stderrWriteSpy).toHaveBeenCalled();
		const correctionPayload = JSON.parse(
			String(stderrWriteSpy.mock.calls.at(-1)?.[0] ?? "{}"),
		) as {
			_agent_correction: boolean;
			received: string;
			interpreted_as: string;
		};
		expect(correctionPayload._agent_correction).toBe(true);
		expect(correctionPayload.received).toBe("drfit-gate");
		expect(correctionPayload.interpreted_as).toBe("drift-gate");
	});

	it("supports HARNESS_ALLOW_FUZZY_COMMANDS=1 env override", () => {
		const original = process.env.HARNESS_ALLOW_FUZZY_COMMANDS;
		process.env.HARNESS_ALLOW_FUZZY_COMMANDS = "1";
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		try {
			expect(() => run(["drfit-gate", "--json"])).toThrowError("EXIT_0");
			expect(exitSpy).toHaveBeenCalledWith(0);
		} finally {
			if (original === undefined) {
				process.env.HARNESS_ALLOW_FUZZY_COMMANDS = undefined;
			} else {
				process.env.HARNESS_ALLOW_FUZZY_COMMANDS = original;
			}
		}
	});

	it("keeps fuzzy correction disabled when --no-fuzzy is set even if env override is enabled", () => {
		const original = process.env.HARNESS_ALLOW_FUZZY_COMMANDS;
		process.env.HARNESS_ALLOW_FUZZY_COMMANDS = "1";
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);

		try {
			expect(() => run(["drfit-gate", "--no-fuzzy", "--json"])).toThrowError(
				"EXIT_1",
			);
			expect(exitSpy).toHaveBeenCalledWith(1);
		} finally {
			if (original === undefined) {
				process.env.HARNESS_ALLOW_FUZZY_COMMANDS = undefined;
			} else {
				process.env.HARNESS_ALLOW_FUZZY_COMMANDS = original;
			}
		}
	});

	it("routes gap-case open/resolve commands", () => {
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation((code?: string | number | null | undefined) => {
				throw new Error(`EXIT_${String(code)}`);
			}) as never;
		const testDir = join(
			process.cwd(),
			"artifacts",
			`harness-cli-test-${randomUUID()}`,
		);
		const contractPath = join(testDir, "harness.contract.json");
		const storePath = join(testDir, "gap-cases.json");

		// Create contract with gap-case policy enabled
		mkdirSync(dirname(contractPath), { recursive: true });
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				pilotGapCasePolicy: {
					enabled: true,
					defaultSlaHours: 168,
					requireClosureEvidence: false,
					storePath,
				},
			}),
			"utf-8",
		);

		expect(() =>
			run([
				"gap-case",
				"open",
				"--incident-id",
				"INC-1",
				"--owner",
				"alice",
				"--severity",
				"high",
				"--summary",
				"Found security issue",
				"--finding-id",
				"f-123",
				"--store",
				storePath,
				"--contract",
				contractPath,
			]),
		).toThrowError("EXIT_0");
		const openedStore = JSON.parse(readFileSync(storePath, "utf-8")) as {
			cases: Array<{ id: string }>;
		};
		const openedCaseId = openedStore.cases[0]?.id;
		expect(openedCaseId).toEqual(expect.stringMatching(/^gc-/));
		expect(() =>
			run([
				"gap-case",
				"resolve",
				"--case-id",
				openedCaseId ?? "",
				"--resolved-by",
				"alice",
				"--evidence-url",
				"https://example.com/evidence",
				"--store",
				storePath,
				"--contract",
				contractPath,
			]),
		).toThrowError("EXIT_0");

		// Clean up test directory and the local store created by the real route.
		rmSync(testDir, { recursive: true, force: true });
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it("does not exit for help or version", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		vi.spyOn(console, "info").mockImplementation(() => {
			// silence output in test
		});

		run(["--help"]);
		run(["--version"]);

		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("prints the cockpit memory rule before any command group in default help", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		run(["--help"]);

		const lines = infoSpy.mock.calls.map((call) => String(call[0] ?? ""));
		expect(lines).toContain("Start here: harness orient --json");
		expect(lines.indexOf("Start here: harness orient --json")).toBeLessThan(
			lines.indexOf("Commands (focused):"),
		);
		expect(lines).toContain("  Agent Cockpit:");
		expect(
			lines.some((line) =>
				/^\s+orient\s+Emit a compact cold-start orientation packet/.test(line),
			),
		).toBe(true);
		expect(
			lines.some((line) =>
				/^\s+next\s+Recommend the next safe harness command/.test(line),
			),
		).toBe(true);
		expect(
			lines.some((line) =>
				/^\s+(commands|check|init|doctor|health)\s+/.test(line),
			),
		).toBe(false);
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("short-circuits mutating commands when --help follows command name", async () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(() => run(["init", "--help"])).not.toThrow();
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining("Usage: harness"),
		);
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("prints top-level help when modifier flags precede --help", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(() => run(["--all", "--help"])).not.toThrow();
		expect(infoSpy).toHaveBeenCalledWith(
			expect.stringContaining("Usage: harness"),
		);
		expect(exitSpy).not.toHaveBeenCalled();
	});

	it("keeps full expert command help available behind --all-commands", () => {
		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`EXIT_${String(code)}`);
		}) as never);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(() => run(["--help", "--all-commands"])).not.toThrow();

		const lines = infoSpy.mock.calls.map((call) => String(call[0] ?? ""));
		expect(lines).toContain("Commands (full, with aliases):");
		expect(
			lines.some((line) => /^\s+commands\s+List machine-readable/.test(line)),
		).toBe(true);
		expect(
			lines.some((line) =>
				line.includes('Run "harness --help --all-commands"'),
			),
		).toBe(false);
		expect(exitSpy).not.toHaveBeenCalled();
	});
});

describe("isDirectExecution", () => {
	it("returns true for direct module path", () => {
		const modulePath = join(process.cwd(), "src/cli.ts");
		const moduleUrl = pathToFileURL(modulePath).href;

		expect(isDirectExecution(modulePath, moduleUrl)).toBe(true);
	});

	it("returns true when entrypoint is a symlink to the module", () => {
		const testDir = join(
			process.cwd(),
			"artifacts",
			`harness-cli-entrypoint-${randomUUID()}`,
		);
		const modulePath = join(process.cwd(), "src/cli.ts");
		const moduleUrl = pathToFileURL(modulePath).href;
		const symlinkPath = join(testDir, "harness");

		mkdirSync(testDir, { recursive: true });
		symlinkSync(modulePath, symlinkPath);

		expect(isDirectExecution(symlinkPath, moduleUrl)).toBe(true);

		rmSync(testDir, { recursive: true, force: true });
	});
});
