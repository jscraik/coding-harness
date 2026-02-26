import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadContract } from "./loader.js";

describe("loadContract", () => {
	const createdFiles: string[] = [];

	afterEach(() => {
		for (const filePath of createdFiles) {
			rmSync(filePath, { force: true });
		}
		createdFiles.length = 0;
	});

	it("loads a valid contract", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-valid.json");
		createdFiles.push(path);

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				riskTierRules: { "src/**": "medium" },
			}),
			"utf-8",
		);

		const contract = loadContract(path);
		expect(contract.version).toBe("1.0");
		expect(contract.riskTierRules["src/**"]).toBe("medium");
	});

	it("enforces size limit using UTF-8 bytes, not character count", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-oversize.json");
		createdFiles.push(path);

		const largeEmojiValue = "😀".repeat(400_000);
		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				notes: largeEmojiValue,
			}),
			"utf-8",
		);

		expect(() => loadContract(path)).toThrow(/exceeds maximum size/i);
	});

	it("allows wide but shallow JSON payloads", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-wide.json");
		createdFiles.push(path);

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				largeArray: Array.from({ length: 250 }, (_, i) => ({ id: i })),
			}),
			"utf-8",
		);

		const contract = loadContract(path);
		expect(contract.version).toBe("1.0");
	});

	it("rejects excessively deep JSON payloads", () => {
		const dir = join(process.cwd(), "artifacts");
		mkdirSync(dir, { recursive: true });
		const path = join(dir, "contract-loader-deep.json");
		createdFiles.push(path);

		const deepObject: Record<string, unknown> = {};
		let current: Record<string, unknown> = deepObject;
		for (let i = 0; i < 110; i++) {
			current.next = {};
			current = current.next as Record<string, unknown>;
		}

		writeFileSync(
			path,
			JSON.stringify({
				version: "1.0",
				deepObject,
			}),
			"utf-8",
		);

		expect(() => loadContract(path)).toThrow(/depth exceeds maximum/i);
	});
});
