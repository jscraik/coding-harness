import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock } = vi.hoisted(() => ({
	lookupMock: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
	lookup: lookupMock,
}));

import { secureFetch, validateRemoteUrl } from "./url-validator.js";

describe("url-validator secureFetch", () => {
	beforeEach(() => {
		lookupMock.mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects when pinned IP no longer matches DNS resolution", async () => {
		lookupMock
			.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
			.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]);

		const validated = await validateRemoteUrl(
			"https://github.com/org/repo.json",
		);
		const pinnedIp = validated.pinnedIp;
		if (!pinnedIp) {
			throw new Error("expected pinned IP to be populated");
		}

		await expect(secureFetch(validated.url, pinnedIp)).rejects.toMatchObject({
			name: "UrlValidationError",
			code: "DNS_LOOKUP_FAILED",
		});
	});

	it("re-validates redirect target host allowlist", async () => {
		lookupMock
			.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
			.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }]);

		const fetchStub = vi.fn().mockResolvedValueOnce(
			new Response(null, {
				status: 302,
				headers: {
					location: "https://evil.example.com/preset.json",
				},
			}),
		);
		vi.stubGlobal("fetch", fetchStub);

		const validated = await validateRemoteUrl(
			"https://github.com/org/repo.json",
		);
		const pinnedIp = validated.pinnedIp;
		if (!pinnedIp) {
			throw new Error("expected pinned IP to be populated");
		}

		await expect(secureFetch(validated.url, pinnedIp)).rejects.toMatchObject({
			name: "UrlValidationError",
			code: "HOST_NOT_ALLOWED",
		});
		expect(fetchStub).toHaveBeenCalledTimes(1);
	});

	it("follows allowed redirects with refreshed DNS pinning", async () => {
		lookupMock
			.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
			.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
			.mockResolvedValueOnce([{ address: "9.9.9.9", family: 4 }])
			.mockResolvedValueOnce([{ address: "9.9.9.9", family: 4 }]);

		const fetchStub = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: {
						location:
							"https://raw.githubusercontent.com/brainwav/coding-harness/main/contract.json",
					},
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			);
		vi.stubGlobal("fetch", fetchStub);

		const validated = await validateRemoteUrl(
			"https://github.com/org/repo.json",
		);
		const pinnedIp = validated.pinnedIp;
		if (!pinnedIp) {
			throw new Error("expected pinned IP to be populated");
		}

		const response = await secureFetch(validated.url, pinnedIp);
		expect(response.status).toBe(200);
		expect(fetchStub).toHaveBeenCalledTimes(2);
	});
});
