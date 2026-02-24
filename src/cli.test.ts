import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCsvList, parseIntegerArg, run } from "./cli.js";

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
			"Unknown command: totally-unknown-command",
		);
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
});
