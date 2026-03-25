import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectProjectType } from "./detector.js";
import type { DetectionRule } from "./types.js";
import { OVERRIDE_RULE_NAME, VALID_OVERRIDE_TYPES } from "./types.js";

// === Test helpers ===

let tmpDir: string;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "harness-project-type-test-"));
});

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

function makeDir(rel: string): void {
	mkdirSync(resolve(tmpDir, rel), { recursive: true });
}

function makeFile(rel: string): void {
	const full = resolve(tmpDir, rel);
	mkdirSync(full.substring(0, full.lastIndexOf("/")), { recursive: true });
	writeFileSync(full, "");
}

// === SA1: Tauri repo detection ===
describe("SA1 — Tauri repo detection", () => {
	it("detects desktop when src-tauri/ directory is present", () => {
		makeDir("src-tauri");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("desktop");
		expect(result.matchedRule).toBe("tauri");
		expect(result.confidence).toBe("high");
		expect(result.signals).toContain("src-tauri");
	});
});

// === SA2: CLI TypeScript detection ===
describe("SA2 — CLI TypeScript repo detection", () => {
	it("detects cli when src/cli.ts exists", () => {
		makeFile("src/cli.ts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("cli");
		expect(result.matchedRule).toBe("cli-ts");
		expect(result.confidence).toBe("high");
	});
});

// === SA3: CLI JavaScript detection ===
describe("SA3 — CLI JavaScript repo detection", () => {
	it("detects cli when src/cli.js exists and no src-tauri", () => {
		makeFile("src/cli.js");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("cli");
		expect(result.matchedRule).toBe("cli-js");
		expect(result.confidence).toBe("high");
	});
});

// === SA4: Vite web detection ===
describe("SA4 — Vite web repo detection", () => {
	it("detects web when vite.config.ts exists at root", () => {
		makeFile("vite.config.ts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe("vite");
		expect(result.confidence).toBe("high");
	});

	it("detects web when vite.config.js exists at root", () => {
		makeFile("vite.config.js");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe("vite");
	});

	it("detects web when vite.config.mts exists at root", () => {
		makeFile("vite.config.mts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe("vite");
	});
});

// === SA5: Next.js web detection ===
describe("SA5 — Next.js web repo detection", () => {
	it("detects web when next.config.js exists at root", () => {
		makeFile("next.config.js");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe("next");
		expect(result.confidence).toBe("high");
	});

	it("detects web when next.config.ts exists at root", () => {
		makeFile("next.config.ts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe("next");
	});
});

// === SA6: Library detection ===
describe("SA6 — Library repo detection", () => {
	it("detects library when src/index.ts exists and no other signals", () => {
		makeFile("src/index.ts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("library");
		expect(result.matchedRule).toBe("library");
		expect(result.confidence).toBe("high");
	});
});

// === SA7: Unknown (no signals) ===
describe("SA7 — Unknown detection (empty dir)", () => {
	it("returns unknown with low confidence when no signals match", () => {
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("unknown");
		expect(result.matchedRule).toBeNull();
		expect(result.confidence).toBe("low");
		expect(result.signals).toHaveLength(0);
	});
});

// === SA8: Priority — Tauri beats Vite ===
describe("SA8 — Priority: Tauri wins over Vite", () => {
	it("returns desktop when both src-tauri/ and vite.config.ts exist", () => {
		makeDir("src-tauri");
		makeFile("vite.config.ts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("desktop");
		expect(result.matchedRule).toBe("tauri");
	});
});

// === SA9: Explicit override wins ===
describe("SA9 — Explicit --project-type override wins", () => {
	it("returns override result even on a Tauri repo", () => {
		makeDir("src-tauri");
		const result = detectProjectType(tmpDir, "web");
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe(OVERRIDE_RULE_NAME);
		expect(result.confidence).toBe("high");
		expect(result.signals).toHaveLength(0);
	});

	it("override works for all valid types", () => {
		for (const type of VALID_OVERRIDE_TYPES) {
			const result = detectProjectType(tmpDir, type);
			expect(result.projectType).toBe(type);
			expect(result.matchedRule).toBe(OVERRIDE_RULE_NAME);
		}
	});
});

// === SA10: Invalid override returns unknown (validation happens at CLI layer) ===
// Note: detectProjectType itself does NOT validate -- "unknown" validation is at CLI layer.
// SA10 tests that the VALID_OVERRIDE_TYPES constant excludes "unknown".
describe("SA10 — VALID_OVERRIDE_TYPES excludes unknown", () => {
	it("VALID_OVERRIDE_TYPES does not include unknown", () => {
		expect(VALID_OVERRIDE_TYPES).not.toContain("unknown");
	});

	it("VALID_OVERRIDE_TYPES contains exactly cli, desktop, library, web", () => {
		expect(VALID_OVERRIDE_TYPES.sort()).toEqual(
			["cli", "desktop", "library", "web"].sort(),
		);
	});
});

// === SA11: Upgrade — auto-detection does NOT affect existing stored value ===
// (This is the CLI+init layer test; detectProjectType itself is stateless — test that
// it returns the detected type, which the caller then decides to use or not)
describe("SA11 — detectProjectType is stateless (upgrade safety is caller's responsibility)", () => {
	it("detects cli from filesystem regardless of what caller stores", () => {
		makeFile("src/cli.ts");
		const result = detectProjectType(tmpDir);
		// The caller (runInit) uses existingContract?.projectType ?? result.projectType
		// detectProjectType itself always returns what it sees
		expect(result.projectType).toBe("cli");
	});
});

// === SA12: Override always wins ===
describe("SA12 — Override always returns override result", () => {
	it("override wins even when filesystem signals a different type", () => {
		makeFile("src/cli.ts");
		const result = detectProjectType(tmpDir, "web");
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe(OVERRIDE_RULE_NAME);
	});
});

// === SA13/SA14: Warning behaviour is CLI-layer concern; detect returns structured result for unknown ===
describe("SA13/SA14 — unknown detection result is structured", () => {
	it("returns structured unknown result with null matchedRule", () => {
		const result = detectProjectType(tmpDir); // empty dir
		expect(result).toEqual({
			projectType: "unknown",
			matchedRule: null,
			confidence: "low",
			signals: [],
		});
	});
});

// === SA15: detectProjectType is read-only ===
// ESM native modules cannot be monkeypatched via vi.spyOn in Node ESM.
// Instead, verify read-only invariant by source inspection: the detector must not
// import or call any write-capable fs API.
describe("SA15 — detectProjectType is read-only (source inspection)", () => {
	it("detector source does not import write-capable fs methods", async () => {
		const { readFileSync } = await import("node:fs");
		const { fileURLToPath } = await import("node:url");
		const { dirname, join } = await import("node:path");
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, "detector.ts"), "utf8");
		const forbidden = [
			"writeFileSync",
			"appendFileSync",
			"writeFile",
			"appendFile",
			"mkdirSync",
			"unlinkSync",
			"rmdirSync",
			"rmSync",
			"renameSync",
			"copyFileSync",
		];
		for (const fn of forbidden) {
			expect(src, `detector.ts must not reference ${fn}`).not.toContain(fn);
		}
	});

	it("detectProjectType returns a result without throwing on a real dir", () => {
		// Additional behavioural smoke: the function completes and returns a shape
		makeFile("src/cli.ts");
		const result = detectProjectType(tmpDir);
		expect(result).toMatchObject({
			projectType: expect.any(String),
			matchedRule: expect.anything(),
			confidence: expect.stringMatching(/^high|low$/),
			signals: expect.any(Array),
		});
	});
});

// === SA16: "unknown" override is not a permitted explicit value ===
// (The VALID_OVERRIDE_TYPES check happens in runInit; this tests the constant)
describe("SA16 — unknown is not in VALID_OVERRIDE_TYPES", () => {
	it("VALID_OVERRIDE_TYPES does not include unknown", () => {
		expect(VALID_OVERRIDE_TYPES).not.toContain("unknown");
	});
});

// === SA17: OVERRIDE_RULE_NAME constant is "override" ===
describe("SA17 — OVERRIDE_RULE_NAME is correct string", () => {
	it("OVERRIDE_RULE_NAME equals 'override'", () => {
		expect(OVERRIDE_RULE_NAME).toBe("override");
	});
});

// === SA18: picomatch error on malformed pattern is non-fatal ===
describe("SA18 — picomatch error on malformed pattern is non-fatal", () => {
	it("skips a rule with a malformed pattern and continues to next rule", async () => {
		// Import the module then override DETECTION_RULES for this test
		const detectorModule = await import("./detector.js");

		// Inject a malformed rule at highest priority
		const malformedRule: DetectionRule = {
			name: "malformed-test-rule",
			projectType: "web",
			priority: 0, // highest priority
			signals: [
				{
					type: "file",
					path: "doesnotexist.ts",
					pattern: "[invalid-glob-{{{", // malformed pattern
				},
			],
		};

		// Use the exported DETECTION_RULES for testing via detectProjectType with injected rules
		// detectProjectType accepts optional rules array for testability
		makeFile("src/cli.ts");
		const result = detectorModule.detectProjectType(tmpDir, undefined, [
			malformedRule,
			...detectorModule.DETECTION_RULES,
		]);

		// Malformed rule should be skipped; cli-ts rule should still match
		expect(result.projectType).toBe("cli");
		expect(result.matchedRule).toBe("cli-ts");
	});
});

// === Nuxt detection (covered by spec priority table) ===
describe("Nuxt web repo detection", () => {
	it("detects web when nuxt.config.ts exists at root", () => {
		makeFile("nuxt.config.ts");
		const result = detectProjectType(tmpDir);
		expect(result.projectType).toBe("web");
		expect(result.matchedRule).toBe("nuxt");
	});
});
