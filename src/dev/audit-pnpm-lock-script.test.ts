import { describe, expect, it, vi } from "vitest";
import {
	blockingAdvisories,
	buildBulkPayload,
	fetchBulkAdvisories,
} from "../../scripts/audit-pnpm-lock.mjs";
import type { BulkAdvisory } from "../../scripts/audit-pnpm-lock.mjs";

const LOCKFILE = `lockfileVersion: '9.0'

packages:

  '@scope/pkg@2.0.0(peer@1.0.0)':
    resolution: {integrity: sha512-example}

  'plain@1.2.3':
    resolution: {integrity: sha512-example}

snapshots:
  '@scope/pkg@2.0.0(peer@1.0.0)': {}
`;

describe("pnpm bulk audit script", () => {
	it("submits exact lockfile versions to the documented bulk endpoint", async () => {
		const payload = buildBulkPayload(LOCKFILE);
		const fetchImplementation = vi.fn<typeof fetch>(
			async () =>
				new Response("{}", {
					headers: { "content-type": "application/json" },
					status: 200,
				}),
		);
		const advisories = await fetchBulkAdvisories(payload, {
			fetchImplementation,
			registry: "https://registry.npmjs.org/",
		});

		expect(payload).toEqual({
			"@scope/pkg": ["2.0.0"],
			plain: ["1.2.3"],
		});
		expect(advisories).toEqual([]);
		expect(fetchImplementation).toHaveBeenCalledWith(
			"https://registry.npmjs.org/-/npm/v1/security/advisories/bulk",
			expect.objectContaining({
				body: JSON.stringify(payload),
				method: "POST",
			}),
		);
	});

	it("blocks returned advisories at the configured severity", () => {
		const advisories: BulkAdvisory[] = [
			{
				name: "plain",
				severity: "high",
				title: "unsafe package",
				url: "https://example.test/advisory",
			},
		];
		expect(blockingAdvisories(advisories, "moderate")).toEqual(advisories);
		expect(blockingAdvisories(advisories, "critical")).toEqual([]);
	});

	it("fails closed when the bulk endpoint is unavailable", async () => {
		const fetchImplementation = vi.fn<typeof fetch>(
			async () => new Response('{"error":"retired"}', { status: 410 }),
		);
		await expect(
			fetchBulkAdvisories(buildBulkPayload(LOCKFILE), {
				fetchImplementation,
				registry: "https://registry.npmjs.org/",
			}),
		).rejects.toThrow("bulk advisory endpoint returned HTTP 410");
	});
});
