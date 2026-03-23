/**
 * Tests for ci-migrate promote-mode (JSC-61)
 *
 * Tests promoteCIMode() which patches harness.contract.json
 * to transition ciProviderPolicy.mode: shadow → required.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promoteCIMode } from "./ci-migrate.js";

function makeTmpDir(): string {
	const d = join(tmpdir(), `promote-mode-test-${Date.now()}`);
	mkdirSync(d, { recursive: true });
	return d;
}

function writeContract(dir: string, content: object): void {
	writeFileSync(
		join(dir, "harness.contract.json"),
		JSON.stringify(content, null, 2),
	);
}

function readContract(dir: string): Record<string, unknown> {
	return JSON.parse(
		readFileSync(join(dir, "harness.contract.json"), "utf-8"),
	) as Record<string, unknown>;
}

describe("promoteCIMode — eligibility checks", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("fails when harness.contract.json is missing", () => {
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("not found");
		}
	});

	it("fails when ciProviderPolicy is missing from contract", () => {
		writeContract(dir, { version: "1.0.0" });
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("missing ciProviderPolicy");
		}
	});

	it("fails when mode is neither shadow nor required", () => {
		writeContract(dir, {
			ciProviderPolicy: { mode: "unknown", migrationStage: "circleci-only" },
		});
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('"unknown"');
		}
	});

	it("succeeds (no-op) when mode is already required", () => {
		writeContract(dir, {
			ciProviderPolicy: { mode: "required", migrationStage: "circleci-only" },
		});
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.promoted).toBe(false);
			expect(result.value.currentMode).toBe("required");
			expect(result.value.previousMode).toBe("required");
		}
	});

	it("fails when migrationStage is not circleci-only", () => {
		writeContract(dir, {
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "dual-provider",
			},
		});
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('"dual-provider"');
			expect(result.error).toContain("circleci-only");
		}
	});

	it("fails when migrationStage is circleci-primary (not fully migrated)", () => {
		writeContract(dir, {
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-primary",
			},
		});
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('"circleci-primary"');
		}
	});

	it("fails when migrationStage is missing", () => {
		writeContract(dir, {
			ciProviderPolicy: { mode: "shadow" },
		});
		const result = promoteCIMode(dir);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('"(missing)"');
		}
	});
});

describe("promoteCIMode — happy path", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("promotes mode shadow → required and writes contract", () => {
		writeContract(dir, {
			version: "1.0.0",
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-only",
				activeProvider: "circleci",
			},
		});

		const result = promoteCIMode(dir);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.promoted).toBe(true);
		expect(result.value.previousMode).toBe("shadow");
		expect(result.value.currentMode).toBe("required");
		expect(result.value.migrationStage).toBe("circleci-only");
		expect(result.value.promotedAt).toBeTruthy();
	});

	it("writes updated mode to harness.contract.json", () => {
		writeContract(dir, {
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-only",
			},
		});

		const result = promoteCIMode(dir);
		expect(result.ok).toBe(true);

		const updated = readContract(dir);
		const policy = updated.ciProviderPolicy as Record<string, unknown>;
		expect(policy.mode).toBe("required");
	});

	it("preserves all other contract fields", () => {
		writeContract(dir, {
			version: "2.0.0",
			repoId: "my-repo",
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-only",
				activeProvider: "circleci",
				trustedPolicyRef: "abc123",
			},
		});

		promoteCIMode(dir);

		const updated = readContract(dir);
		expect(updated.version).toBe("2.0.0");
		expect(updated.repoId).toBe("my-repo");

		const policy = updated.ciProviderPolicy as Record<string, unknown>;
		expect(policy.migrationStage).toBe("circleci-only");
		expect(policy.activeProvider).toBe("circleci");
		expect(policy.trustedPolicyRef).toBe("abc123");
	});

	it("writes _shadowPromotedAt audit timestamp", () => {
		writeContract(dir, {
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-only",
			},
		});

		promoteCIMode(dir);

		const updated = readContract(dir);
		const policy = updated.ciProviderPolicy as Record<string, unknown>;
		expect(typeof policy._shadowPromotedAt).toBe("string");
	});

	it("does NOT write contract in dry-run mode", () => {
		const original = {
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-only",
			},
		};
		writeContract(dir, original);

		const result = promoteCIMode(dir, { dryRun: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.promoted).toBe(true);
			expect(result.value.currentMode).toBe("required");
		}

		// Contract must not change in dry-run
		const postContract = readContract(dir);
		const policy = postContract.ciProviderPolicy as Record<string, unknown>;
		expect(policy.mode).toBe("shadow");
		expect(policy._shadowPromotedAt).toBeUndefined();
	});

	it("returns idempotent result on repeated calls", () => {
		writeContract(dir, {
			ciProviderPolicy: {
				mode: "shadow",
				migrationStage: "circleci-only",
			},
		});

		const first = promoteCIMode(dir);
		expect(first.ok).toBe(true);
		if (first.ok) expect(first.value.promoted).toBe(true);

		// Second call: mode is now required
		const second = promoteCIMode(dir);
		expect(second.ok).toBe(true);
		if (second.ok) {
			expect(second.value.promoted).toBe(false);
			expect(second.value.currentMode).toBe("required");
		}
	});
});
