#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import process from "node:process";
import {
	assertPackageManifestRegistry,
	classifiedIdentity,
	DEFAULT_REGISTRY,
	hasPackageManifestShape,
	packagesMapping,
	registryUrl,
} from "./lib/audit-pnpm-lock-policy.mjs";
export { packageIdentity } from "./lib/audit-pnpm-lock-policy.mjs";

const DEFAULT_SCOPE_POLICY = "scripts/npm-audit-public-scopes.json";
const DEFAULT_PACKAGE_MANIFEST =
	"scripts/npm-audit-public-package-manifest.json";
const SEVERITY_ORDER = new Map([
	["info", 0],
	["low", 1],
	["moderate", 2],
	["high", 3],
	["critical", 4],
]);
const PACKAGE_NAME =
	/^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;
const UNSAFE_TEXT_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

function parseArguments(argv) {
	let auditLevel = "moderate";
	let lockfile = "pnpm-lock.yaml";
	let scopePolicy = DEFAULT_SCOPE_POLICY;
	let packageManifest = DEFAULT_PACKAGE_MANIFEST;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--audit-level") {
			auditLevel = argv[index + 1] ?? "";
			index += 1;
		} else if (argument === "--lockfile") {
			lockfile = argv[index + 1] ?? "";
			index += 1;
		} else if (argument === "--scope-policy") {
			scopePolicy = argv[index + 1] ?? "";
			index += 1;
		} else if (argument === "--package-manifest") {
			packageManifest = argv[index + 1] ?? "";
			index += 1;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (!SEVERITY_ORDER.has(auditLevel)) {
		throw new Error(`Unsupported audit level: ${auditLevel}`);
	}
	if (lockfile.length === 0) throw new Error("--lockfile requires a path");
	if (scopePolicy.length === 0) {
		throw new Error("--scope-policy requires a path");
	}
	if (packageManifest.length === 0) {
		throw new Error("--package-manifest requires a path");
	}
	return { auditLevel, lockfile, packageManifest, scopePolicy };
}

export function buildBulkPayload(
	lockfileText,
	{ allowedScopes = [], packageManifest, registry = DEFAULT_REGISTRY } = {},
) {
	const approvedScopes = new Set(allowedScopes);
	const approvedRegistry = registryUrl(registry);
	const manifestRegistryApproved = assertPackageManifestRegistry(
		packageManifest,
		approvedRegistry,
	);
	const versionsByName = new Map();
	for (const [lockfileKey, metadata] of Object.entries(
		packagesMapping(lockfileText),
	)) {
		const identity = classifiedIdentity(
			lockfileKey,
			metadata,
			approvedScopes,
			approvedRegistry,
			manifestRegistryApproved,
		);
		if (!identity) continue;
		const versions = versionsByName.get(identity.name) ?? new Set();
		versions.add(identity.version);
		versionsByName.set(identity.name, versions);
	}
	if (versionsByName.size === 0) {
		throw new Error("pnpm lockfile packages mapping has no auditable versions");
	}
	assertPackageManifest(versionsByName.keys(), packageManifest);
	return Object.fromEntries(
		[...versionsByName.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([name, versions]) => [name, [...versions].sort()]),
	);
}

function hasPackageManifestMetadata(manifest) {
	return (
		Number.isSafeInteger(manifest.package_count) &&
		manifest.package_count >= 1 &&
		typeof manifest.digest === "string" &&
		/^sha256:[0-9a-f]{64}$/.test(manifest.digest)
	);
}

function assertPackageManifest(packageNames, manifest) {
	if (
		!hasPackageManifestShape(manifest) ||
		!hasPackageManifestMetadata(manifest)
	) {
		throw new Error("audit package manifest is malformed");
	}
	const names = [...packageNames].sort();
	const digest = `sha256:${createHash("sha256").update(names.join("\n")).digest("hex")}`;
	if (manifest.package_count !== names.length || manifest.digest !== digest) {
		throw new Error(
			"audit package identities do not match the approved manifest",
		);
	}
}

function auditEndpoint(registryValue) {
	return new URL(
		"-/npm/v1/security/advisories/bulk",
		registryUrl(registryValue),
	).toString();
}

function safeSingleLine(value, field) {
	const hasControlCharacter =
		typeof value === "string" && UNSAFE_TEXT_CHARACTER.test(value);
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > 500 ||
		hasControlCharacter
	) {
		throw new Error(`bulk advisory ${field} is unsafe`);
	}
	return value;
}

function safeAdvisoryUrl(value) {
	const text = safeSingleLine(value, "URL");
	const url = new URL(text);
	if (url.protocol !== "https:" || url.username || url.password) {
		throw new Error("bulk advisory URL must be credential-free HTTPS");
	}
	if (url.search !== "" || url.hash !== "") {
		throw new Error("bulk advisory URL must not contain query or fragment");
	}
	return url.toString();
}

function parseAdvisory(packageName, advisory) {
	if (
		!PACKAGE_NAME.test(packageName) ||
		advisory === null ||
		typeof advisory !== "object" ||
		typeof advisory.severity !== "string" ||
		!SEVERITY_ORDER.has(advisory.severity)
	) {
		throw new Error(`bulk advisory entry for ${packageName} is malformed`);
	}
	return {
		name: packageName,
		severity: advisory.severity,
		title: safeSingleLine(advisory.title, "title"),
		url: safeAdvisoryUrl(advisory.url),
	};
}

export function validateResponse(value, expectedPackages = null) {
	if (value === null || Array.isArray(value) || typeof value !== "object") {
		throw new Error("bulk advisory response must be an object");
	}
	const expected = expectedPackages ? new Set(expectedPackages) : null;
	const advisories = [];
	for (const [packageName, packageAdvisories] of Object.entries(value)) {
		if (expected && !expected.has(packageName)) {
			throw new Error("bulk advisory response contains an unexpected package");
		}
		if (!Array.isArray(packageAdvisories)) {
			throw new Error(
				`bulk advisory entry for ${packageName} must be an array`,
			);
		}
		for (const advisory of packageAdvisories) {
			advisories.push(parseAdvisory(packageName, advisory));
		}
	}
	return advisories;
}

export async function fetchBulkAdvisories(
	payload,
	{
		fetchImplementation = fetch,
		registry = process.env.npm_config_registry ?? DEFAULT_REGISTRY,
	} = {},
) {
	const response = await fetchImplementation(auditEndpoint(registry), {
		method: "POST",
		redirect: "error",
		headers: { accept: "application/json", "content-type": "application/json" },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(
			Number(process.env.HARNESS_AUDIT_TIMEOUT_SECONDS ?? "300") * 1000,
		),
	});
	if (!response.ok) {
		throw new Error(`bulk advisory endpoint returned HTTP ${response.status}`);
	}
	return validateResponse(await response.json(), Object.keys(payload));
}

export function blockingAdvisories(advisories, auditLevel) {
	const threshold = SEVERITY_ORDER.get(auditLevel);
	if (threshold === undefined)
		throw new Error(`Unsupported audit level: ${auditLevel}`);
	return advisories.filter(
		(advisory) => SEVERITY_ORDER.get(advisory.severity) >= threshold,
	);
}

async function loadAllowedScopes(path) {
	const value = JSON.parse(await readFile(path, "utf8"));
	if (
		!Array.isArray(value) ||
		value.some(
			(scope) => typeof scope !== "string" || !/^@[^/@\s]+$/.test(scope),
		) ||
		new Set(value).size !== value.length
	) {
		throw new Error("audit scope policy must be an array of unique npm scopes");
	}
	return value;
}

async function main() {
	const { auditLevel, lockfile, packageManifest, scopePolicy } = parseArguments(
		process.argv.slice(2),
	);
	const registry = process.env.npm_config_registry ?? DEFAULT_REGISTRY;
	const payload = buildBulkPayload(await readFile(lockfile, "utf8"), {
		allowedScopes: await loadAllowedScopes(scopePolicy),
		packageManifest: JSON.parse(await readFile(packageManifest, "utf8")),
		registry,
	});
	const advisories = await fetchBulkAdvisories(payload, { registry });
	const blocking = blockingAdvisories(advisories, auditLevel);
	console.log(
		`Bulk dependency audit checked ${Object.values(payload).reduce((count, versions) => count + versions.length, 0)} exact package versions; ${advisories.length} advisories; ${blocking.length} at or above ${auditLevel}.`,
	);
	for (const advisory of blocking) {
		console.error(
			`${advisory.severity}: ${advisory.name}: ${advisory.title} (${advisory.url})`,
		);
	}
	if (blocking.length > 0) process.exitCode = 1;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main().catch((error) => {
		console.error(`Dependency audit unavailable: ${error.message}`);
		process.exitCode = 2;
	});
}
