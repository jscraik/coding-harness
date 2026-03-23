/**
 * Tests for JSC-58: solo/lightweight ci-migrate mode.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isSoloCommitMode } from "./ci-migrate.js";

// Helpers

function tmpDir(): string {
	const dir = join(tmpdir(), `jsc58-test-${Date.now()}-${Math.random()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function writeContract(dir: string, policy: Record<string, unknown>): void {
	writeFileSync(
		join(dir, "harness.contract.json"),
		JSON.stringify({ ciProviderPolicy: policy }),
	);
}

describe("isSoloCommitMode", () => {
	let dir: string;

	beforeEach(() => {
		dir = tmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	// ── Explicit flag ─────────────────────────────────────────────────────────

	it("returns true when options.commitMode === 'solo'", () => {
		expect(isSoloCommitMode(dir, { commitMode: "solo" }, false)).toBe(true);
	});

	it("returns false when options.commitMode === 'enterprise'", () => {
		// Even if contract is missing fields, explicit enterprise wins
		writeContract(dir, {}); // no trustedPolicyRef
		expect(isSoloCommitMode(dir, { commitMode: "enterprise" }, false)).toBe(
			false,
		);
	});

	// ── Contract field ────────────────────────────────────────────────────────

	it("returns true when contract ciProviderPolicy.commitMode = 'solo'", () => {
		writeContract(dir, { commitMode: "solo" });
		expect(isSoloCommitMode(dir, {}, false)).toBe(true);
	});

	it("returns false when contract ciProviderPolicy.commitMode = 'enterprise'", () => {
		writeContract(dir, { commitMode: "enterprise" });
		expect(isSoloCommitMode(dir, {}, false)).toBe(false);
	});

	// ── Auto-detect from missing enterprise fields ─────────────────────────────

	it("auto-detects solo mode when trustedPolicyRef AND authorityConfigPath are absent", () => {
		writeContract(dir, { mode: "shadow" }); // no enterprise fields
		expect(isSoloCommitMode(dir, {}, false)).toBe(true);
	});

	it("does NOT auto-detect solo when trustedPolicyRef is present", () => {
		writeContract(dir, {
			trustedPolicyRef: "abc1234",
			// authorityConfigPath absent — but trustedPolicyRef present → enterprise check triggered
		});
		expect(isSoloCommitMode(dir, {}, false)).toBe(false);
	});

	it("does NOT auto-detect solo when authorityConfigPath is present", () => {
		writeContract(dir, {
			authorityConfigPath: ".harness/policy/authority.json",
		});
		expect(isSoloCommitMode(dir, {}, false)).toBe(false);
	});

	it("does NOT auto-detect solo when both enterprise fields are present", () => {
		writeContract(dir, {
			trustedPolicyRef: "abc1234",
			authorityConfigPath: ".harness/policy/authority.json",
		});
		expect(isSoloCommitMode(dir, {}, false)).toBe(false);
	});

	// ── Enterprise fields with whitespace-only strings treated as absent ───────

	it("treats whitespace-only trustedPolicyRef as absent (auto-detects solo)", () => {
		writeContract(dir, {
			trustedPolicyRef: "   ",
			authorityConfigPath: "",
		});
		expect(isSoloCommitMode(dir, {}, false)).toBe(true);
	});

	// ── No contract file ───────────────────────────────────────────────────────

	it("returns false when no harness.contract.json exists (not auto-solo)", () => {
		// No contract → contractAppearsToLackEnterpriseFields returns false (no policy obj)
		expect(isSoloCommitMode(dir, {}, false)).toBe(false);
	});

	// ── Priority: explicit flag overrides contract ─────────────────────────────

	it("explicit solo flag overrides contract commitMode=enterprise", () => {
		writeContract(dir, { commitMode: "enterprise" });
		expect(isSoloCommitMode(dir, { commitMode: "solo" }, false)).toBe(true);
	});

	it("explicit enterprise flag overrides contract commitMode=solo", () => {
		writeContract(dir, { commitMode: "solo" });
		expect(isSoloCommitMode(dir, { commitMode: "enterprise" }, false)).toBe(
			false,
		);
	});

	// ── logNotice parameter ────────────────────────────────────────────────────

	it("accepts logNotice=true without throwing", () => {
		writeContract(dir, {}); // triggers auto-detect
		// Should not throw even when notice is logged
		expect(() => isSoloCommitMode(dir, {}, true)).not.toThrow();
	});
});
