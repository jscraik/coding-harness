import { describe, expect, it } from "vitest";
import { validateOllamaUrl } from "./constants.js";

describe("validateOllamaUrl", () => {
	it("accepts localhost loopback URLs", () => {
		expect(() => validateOllamaUrl("http://localhost:11434")).not.toThrow();
		expect(() => validateOllamaUrl("http://127.0.0.1:11434")).not.toThrow();
	});

	it("accepts IPv6 loopback URL syntax", () => {
		expect(() => validateOllamaUrl("http://[::1]:11434")).not.toThrow();
	});

	it("rejects non-loopback hosts", () => {
		expect(() => validateOllamaUrl("http://example.com:11434")).toThrow(
			/Ollama URL must be localhost/i,
		);
	});
});
