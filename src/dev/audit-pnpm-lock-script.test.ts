import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";
import {
	blockingAdvisories,
	buildBulkPayload,
	fetchBulkAdvisories,
	packageIdentity,
	validateResponse,
} from "../../scripts/audit-pnpm-lock.mjs";
import type {
	AuditPackageManifest,
	BulkAdvisory,
} from "../../scripts/audit-pnpm-lock.mjs";

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

const TEST_PACKAGE_MANIFEST = {
	algorithm: "sha256" as const,
	registry_origin: "https://registry.npmjs.org",
	package_count: 3,
	digest:
		"sha256:ee1919357fbcec135d7618f9c33bca4387e5e9d3b9f7bb0e0f15049fc935d29a" as const,
};

function parseStringArray(value: unknown, label: string): string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`${label} must be a string array`);
	}
	return value;
}

function isAuditPackageManifest(value: unknown): value is AuditPackageManifest {
	return (
		value !== null &&
		typeof value === "object" &&
		"algorithm" in value &&
		value.algorithm === "sha256" &&
		"registry_origin" in value &&
		typeof value.registry_origin === "string" &&
		"package_count" in value &&
		Number.isSafeInteger(value.package_count) &&
		"digest" in value &&
		typeof value.digest === "string" &&
		/^sha256:[0-9a-f]{64}$/.test(value.digest)
	);
}

function parseAuditPackageManifest(value: unknown): AuditPackageManifest {
	if (!isAuditPackageManifest(value)) {
		throw new Error("test audit package manifest is malformed");
	}
	return value;
}

function packagesMappingFromDocument(value: unknown): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== "object" ||
		!("packages" in value) ||
		value.packages === null ||
		typeof value.packages !== "object" ||
		Array.isArray(value.packages)
	) {
		throw new Error("test lockfile has no packages mapping");
	}
	return Object.fromEntries(Object.entries(value.packages));
}

const TEST_OPTIONS = {
	allowedScopes: ["@scope"],
	packageManifest: TEST_PACKAGE_MANIFEST,
};

describe("pnpm bulk audit script", () => {
	it("structurally submits every exact pnpm v9 lockfile version", async () => {
		const payload = buildBulkPayload(LOCKFILE, TEST_OPTIONS);
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
		const policy = parseStringArray(
			JSON.parse(readFileSync("scripts/npm-audit-public-scopes.json", "utf8")),
			"audit scope policy",
		);
		const packageManifest = parseAuditPackageManifest(
			JSON.parse(
				readFileSync("scripts/npm-audit-public-package-manifest.json", "utf8"),
			),
		);
		const packages = packagesMappingFromDocument(parse(lockfileText));
		const payload = buildBulkPayload(lockfileText, {
			allowedScopes: policy,
			packageManifest,
		});
		const submittedVersions = Object.values(payload).reduce(
			(count, versions) => count + versions.length,
			0,
		);
		const canonicalIdentities = new Set(
			Object.keys(packages)
				.map((lockfileKey) => packageIdentity(lockfileKey))
				.filter((identity) => identity !== null)
				.map((identity) => `${identity.name}@${identity.version}`),
		);

		expect(submittedVersions).toBe(canonicalIdentities.size);
	});

	it("deduplicates peer-context lockfile keys by package name and version", () => {
		const lockfile = `lockfileVersion: '9.0'
packages:
  plain@1.2.3(peer-a@1.0.0):
    resolution: {integrity: sha512-example}
  plain@1.2.3(peer-b@2.0.0):
    resolution: {integrity: sha512-example}
`;
		const packageManifest: AuditPackageManifest = {
			algorithm: "sha256",
			registry_origin: "https://registry.npmjs.org",
			package_count: 1,
			digest:
				"sha256:a116c9ed46d6207734a43317d30fd88f52ac8634c37d904bbf4e41d865f90475",
		};

		expect(buildBulkPayload(lockfile, { packageManifest })).toEqual({
			plain: ["1.2.3"],
		});
	});

	it("requires an explicit manifest registry signal for integrity-only entries", () => {
		const legacyManifest = {
			algorithm: "sha256",
			package_count: 3,
			digest: TEST_PACKAGE_MANIFEST.digest,
		};
		expect(() =>
			buildBulkPayload(LOCKFILE, {
				allowedScopes: ["@scope"],
				packageManifest: legacyManifest,
			}),
		).toThrow("audit package manifest is malformed");
	});

	it("fails closed on unknown scoped packages before network construction", () => {
		expect(() =>
			buildBulkPayload(LOCKFILE, { packageManifest: TEST_PACKAGE_MANIFEST }),
		).toThrow("scoped package @scope/pkg is not approved");
	});

	it("fails closed when lockfile package identities drift from the reviewed manifest", () => {
		const privateLockfile = LOCKFILE.replace(
			"plain@1.2.3",
			"private-internal@1.2.3",
		);
		expect(() => buildBulkPayload(privateLockfile, TEST_OPTIONS)).toThrow(
			"package identities do not match the approved manifest",
		);
	});

	it("rejects malformed package names before manifest or network construction", () => {
		for (const name of [
			"plain\u001bescape",
			"plain\u202Eoverride",
			"plain:alias",
			"plain\\alias",
		]) {
			const lockfile = LOCKFILE.replace("plain@1.2.3", `${name}@1.2.3`);
			expect(() => buildBulkPayload(lockfile, TEST_OPTIONS)).toThrow(
				"unclassifiable pnpm lockfile package key",
			);
		}
	});

	it("rejects packages resolved from another registry origin", () => {
		const privateLockfile = `lockfileVersion: '9.0'
packages:
  '@private/internal@4.0.0':
    resolution: {tarball: 'https://registry.private.test/@private/internal.tgz'}
		`;
		expect(() =>
			buildBulkPayload(privateLockfile, {
				allowedScopes: ["@private"],
				packageManifest: TEST_PACKAGE_MANIFEST,
			}),
		).toThrow("audit registry origin is not approved");
	});

	it("rejects undeclared registry origins before constructing a request", () => {
		expect(() =>
			buildBulkPayload(LOCKFILE, {
				allowedScopes: ["@scope"],
				packageManifest: TEST_PACKAGE_MANIFEST,
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
		expect(() =>
			buildBulkPayload(remoteLockfile, {
				packageManifest: TEST_PACKAGE_MANIFEST,
			}),
		).toThrow("remote pnpm lockfile package is not auditable");
	});

	it("fails closed on unclassifiable package entries", () => {
		const malformedLockfile = `lockfileVersion: '9.0'
packages:
  malformed-entry:
    resolution: {integrity: sha512-example}
`;
		expect(() =>
			buildBulkPayload(malformedLockfile, {
				packageManifest: TEST_PACKAGE_MANIFEST,
			}),
		).toThrow("unclassifiable pnpm lockfile package key");
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
		).toThrow("query or fragment");
		for (const url of [
			"https://example.test/advisory?token=secret",
			"https://example.test/advisory?api_token=secret",
			"https://example.test/advisory#access_token=secret",
		]) {
			expect(() =>
				validateResponse({
					plain: [{ severity: "high", title: "unsafe package", url }],
				}),
			).toThrow("query or fragment");
		}
		for (const suffix of [
			"?client_secret=value",
			"?x-api-key=value",
			"?x_api_key=value",
			"?authorization_token=value",
			"?auth_token=value",
			"?bearer_token=value",
			"?jwt=value",
			"?accessKeyId=value",
			"?X-Amz-Credential=value",
			"?GoogleAccessId=value",
			"?page=1",
			"#section",
		]) {
			expect(() =>
				validateResponse({
					plain: [
						{
							severity: "high",
							title: "unsafe package",
							url: `https://example.test/advisory${suffix}`,
						},
					],
				}),
			).toThrow("query or fragment");
		}
		for (const title of ["unsafe\u0085line", "unsafe\u202Eoverride"]) {
			expect(() =>
				validateResponse({
					plain: [
						{
							severity: "high",
							title,
							url: "https://example.test/advisory",
						},
					],
				}),
			).toThrow("title is unsafe");
		}
	});

	it("rejects redirects so the dependency payload cannot cross origins", async () => {
		const fetchImplementation = vi.fn<typeof fetch>(async (_url, init) => {
			expect(init).toEqual(expect.objectContaining({ redirect: "error" }));
			throw new TypeError("fetch failed: redirect mode is error");
		});
		await expect(
			fetchBulkAdvisories(buildBulkPayload(LOCKFILE, TEST_OPTIONS), {
				fetchImplementation,
			}),
		).rejects.toThrow("redirect mode is error");
	});

	it("rejects response packages absent from the submitted payload", () => {
		expect(() => validateResponse({ injected: [] }, ["plain"])).toThrow(
			"unexpected package",
		);
	});

	it("rejects malformed package names returned by the registry", () => {
		for (const name of [
			"plain\u001bescape",
			"plain\u202Eoverride",
			"plain:alias",
			"plain\\alias",
		]) {
			expect(() =>
				validateResponse({
					[name]: [
						{
							severity: "high",
							title: "unsafe package",
							url: "https://example.test/advisory",
						},
					],
				}),
			).toThrow(`bulk advisory entry for ${name} is malformed`);
		}
	});

	it("fails closed when the bulk endpoint is unavailable", async () => {
		const fetchImplementation = vi.fn<typeof fetch>(
			async () => new Response('{"error":"retired"}', { status: 410 }),
		);
		await expect(
			fetchBulkAdvisories(buildBulkPayload(LOCKFILE, TEST_OPTIONS), {
				fetchImplementation,
				registry: "https://registry.npmjs.org/",
			}),
		).rejects.toThrow("bulk advisory endpoint returned HTTP 410");
	});
});
