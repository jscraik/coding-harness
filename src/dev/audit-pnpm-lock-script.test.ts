import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";
import {
	blockingAdvisories,
	buildBulkPayload,
	fetchBulkAdvisories,
	validateResponse,
} from "../../scripts/audit-pnpm-lock.mjs";
import type { BulkAdvisory } from "../../scripts/audit-pnpm-lock.mjs";

const LOCKFILE = `lockfileVersion: '9.0'

packages:

  '@scope/pkg@2.0.0(peer@1.0.0)':
    resolution: {integrity: sha512-example}

  plain@1.2.3:
    resolution: {integrity: sha512-example}

  prerelease@3.0.0-alpha.2:
    resolution: {integrity: sha512-example}

snapshots:
  '@scope/pkg@2.0.0(peer@1.0.0)': {}
`;

describe("pnpm bulk audit script", () => {
	it("structurally submits every exact pnpm v9 lockfile version", async () => {
		const payload = buildBulkPayload(LOCKFILE, { allowedScopes: ["@scope"] });
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
			prerelease: ["3.0.0-alpha.2"],
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

	it("classifies every package entry in the repository lockfile", () => {
		const lockfileText = readFileSync("pnpm-lock.yaml", "utf8");
		const policy = JSON.parse(
			readFileSync("scripts/npm-audit-public-scopes.json", "utf8"),
		) as string[];
		const document = parse(lockfileText) as {
			packages: Record<string, unknown>;
		};
		const payload = buildBulkPayload(lockfileText, { allowedScopes: policy });
		const submittedVersions = Object.values(payload).reduce(
			(count, versions) => count + versions.length,
			0,
		);

		expect(submittedVersions).toBe(Object.keys(document.packages).length);
	});

	it("fails closed on unknown scoped packages before network construction", () => {
		expect(() => buildBulkPayload(LOCKFILE)).toThrow(
			"scoped package @scope/pkg is not approved",
		);
	});

	it("rejects packages resolved from another registry origin", () => {
		const privateLockfile = `lockfileVersion: '9.0'
packages:
  '@private/internal@4.0.0':
    resolution: {tarball: 'https://registry.private.test/@private/internal.tgz'}
`;
		expect(() =>
			buildBulkPayload(privateLockfile, { allowedScopes: ["@private"] }),
		).toThrow("audit registry origin is not approved");
	});

	it("rejects undeclared registry origins before constructing a request", () => {
		expect(() =>
			buildBulkPayload(LOCKFILE, {
				allowedScopes: ["@scope"],
				registry: "https://registry.example.test/",
			}),
		).toThrow("audit registry origin is not approved");
	});

	it("fails closed rather than omitting direct remote dependencies", () => {
		const remoteLockfile = `lockfileVersion: '9.0'
packages:
  https://example.test/archive.tgz:
    resolution: {tarball: 'https://example.test/archive.tgz'}
  plain@1.2.3:
    resolution: {integrity: sha512-example}
`;
		expect(() => buildBulkPayload(remoteLockfile)).toThrow(
			"remote pnpm lockfile package is not auditable",
		);
	});

	it("fails closed on unclassifiable package entries", () => {
		const malformedLockfile = `lockfileVersion: '9.0'
packages:
  malformed-entry:
    resolution: {integrity: sha512-example}
`;
		expect(() => buildBulkPayload(malformedLockfile)).toThrow(
			"unclassifiable pnpm lockfile package key",
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

	it("rejects unsafe remote advisory strings before logging", () => {
		expect(() =>
			validateResponse({
				plain: [
					{
						severity: "high",
						title: "unsafe\nforged-line",
						url: "https://example.test/advisory",
					},
				],
			}),
		).toThrow("title is unsafe");
		expect(() =>
			validateResponse({
				plain: [
					{
						severity: "high",
						title: "unsafe package",
						url: "https://user:secret@example.test/advisory",
					},
				],
			}),
		).toThrow("credential-free HTTPS");
		expect(() =>
			validateResponse({
				plain: [
					{
						severity: "high",
						title: "unsafe\u2028forged-line",
						url: "https://example.test/advisory",
					},
				],
			}),
		).toThrow("title is unsafe");
		expect(() =>
			validateResponse({
				plain: [
					{
						severity: "high",
						title: "unsafe package",
						url: "https://example.test/advisory?access_token=secret",
					},
				],
			}),
		).toThrow("credential query parameters");
	});

	it("rejects redirects so the dependency payload cannot cross origins", async () => {
		const fetchImplementation = vi.fn<typeof fetch>(async (_url, init) => {
			expect(init).toEqual(expect.objectContaining({ redirect: "error" }));
			throw new TypeError("fetch failed: redirect mode is error");
		});
		await expect(
			fetchBulkAdvisories(
				buildBulkPayload(LOCKFILE, { allowedScopes: ["@scope"] }),
				{ fetchImplementation },
			),
		).rejects.toThrow("redirect mode is error");
	});

	it("rejects response packages absent from the submitted payload", () => {
		expect(() => validateResponse({ injected: [] }, ["plain"])).toThrow(
			"unexpected package",
		);
	});

	it("fails closed when the bulk endpoint is unavailable", async () => {
		const fetchImplementation = vi.fn<typeof fetch>(
			async () => new Response('{"error":"retired"}', { status: 410 }),
		);
		await expect(
			fetchBulkAdvisories(
				buildBulkPayload(LOCKFILE, { allowedScopes: ["@scope"] }),
				{
					fetchImplementation,
					registry: "https://registry.npmjs.org/",
				},
			),
		).rejects.toThrow("bulk advisory endpoint returned HTTP 410");
	});
});
