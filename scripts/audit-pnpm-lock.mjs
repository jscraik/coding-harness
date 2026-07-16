#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import process from "node:process";
import { parse } from "yaml";

const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
const DEFAULT_SCOPE_POLICY = "scripts/npm-audit-public-scopes.json";
const SEVERITY_ORDER = new Map([
	["info", 0],
	["low", 1],
	["moderate", 2],
	["high", 3],
	["critical", 4],
]);
const PACKAGE_NAME = /^(?:@[^/@\s]+\/[^/@\s]+|[^/@\s]+)$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const LOCAL_PACKAGE_KEY = /^(?:file|link|workspace):/;
const REMOTE_PACKAGE_KEY = /^(?:git|github|https?):/;
const UNSAFE_LINE_CODE_POINTS = new Set([0x2028, 0x2029]);
const SENSITIVE_QUERY_NAME =
	/(?:access[_-]?token|auth|credential|key|pass(?:word|wd)?|secret|signature|sig)/i;

function parseArguments(argv) {
	let auditLevel = "moderate";
	let lockfile = "pnpm-lock.yaml";
	let scopePolicy = DEFAULT_SCOPE_POLICY;
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
	return { auditLevel, lockfile, scopePolicy };
}

function packageIdentity(lockfileKey) {
	const peerContextIndex = lockfileKey.indexOf("(");
	const identity =
		peerContextIndex === -1
			? lockfileKey
			: lockfileKey.slice(0, peerContextIndex);
	const separator = identity.lastIndexOf("@");
	if (separator <= 0) return null;
	const name = identity.slice(0, separator);
	const version = identity.slice(separator + 1);
	if (!PACKAGE_NAME.test(name) || !VERSION.test(version)) return null;
	return { name, version };
}

function registryUrl(value) {
	const registry = new URL(value);
	const defaultRegistry = new URL(DEFAULT_REGISTRY);
	const loopbackTestEndpoint =
		process.env.HARNESS_AUDIT_ALLOW_HTTP_FOR_TESTS === "1" &&
		(registry.hostname === "127.0.0.1" || registry.hostname === "localhost");
	if (registry.protocol !== "https:") {
		if (!loopbackTestEndpoint) throw new Error("audit registry must use HTTPS");
	}
	if (registry.username || registry.password) {
		throw new Error("audit registry URL must not contain credentials");
	}
	if (!loopbackTestEndpoint && registry.origin !== defaultRegistry.origin) {
		throw new Error("audit registry origin is not approved");
	}
	return registry;
}

function packageResolution(packageName, metadata) {
	if (
		metadata === null ||
		typeof metadata !== "object" ||
		Array.isArray(metadata)
	) {
		throw new Error(`lockfile metadata for ${packageName} must be an object`);
	}
	const resolution = metadata.resolution;
	if (
		resolution === null ||
		typeof resolution !== "object" ||
		Array.isArray(resolution)
	) {
		throw new Error(`lockfile resolution for ${packageName} is missing`);
	}
	return resolution;
}

function assertRegistryProvenance(packageName, metadata, registry) {
	const resolution = packageResolution(packageName, metadata);
	if (typeof resolution.tarball === "string") {
		const tarball = registryUrl(resolution.tarball);
		if (tarball.origin !== registry.origin) {
			throw new Error(
				`lockfile package ${packageName} belongs to an unapproved registry origin`,
			);
		}
		return;
	}
	if (
		typeof resolution.integrity !== "string" ||
		resolution.integrity.length === 0
	) {
		throw new Error(
			`lockfile package ${packageName} has no registry provenance evidence`,
		);
	}
}

function packageScope(packageName) {
	return packageName.startsWith("@") ? packageName.split("/")[0] : null;
}

function packagesMapping(lockfileText) {
	const document = parse(lockfileText);
	if (
		document === null ||
		typeof document !== "object" ||
		Array.isArray(document) ||
		document.packages === null ||
		typeof document.packages !== "object" ||
		Array.isArray(document.packages)
	) {
		throw new Error("pnpm lockfile has no packages mapping");
	}
	return document.packages;
}

function classifiedIdentity(lockfileKey, metadata, approvedScopes, registry) {
	const identity = packageIdentity(lockfileKey);
	if (!identity) {
		if (LOCAL_PACKAGE_KEY.test(lockfileKey)) return null;
		if (REMOTE_PACKAGE_KEY.test(lockfileKey)) {
			throw new Error(
				`remote pnpm lockfile package is not auditable: ${lockfileKey}`,
			);
		}
		throw new Error(`unclassifiable pnpm lockfile package key: ${lockfileKey}`);
	}
	const scope = packageScope(identity.name);
	if (scope && !approvedScopes.has(scope)) {
		throw new Error(
			`scoped package ${identity.name} is not approved for the audit registry`,
		);
	}
	assertRegistryProvenance(identity.name, metadata, registry);
	return identity;
}

export function buildBulkPayload(
	lockfileText,
	{ allowedScopes = [], registry = DEFAULT_REGISTRY } = {},
) {
	const approvedScopes = new Set(allowedScopes);
	const approvedRegistry = registryUrl(registry);
	const versionsByName = new Map();
	for (const [lockfileKey, metadata] of Object.entries(
		packagesMapping(lockfileText),
	)) {
		const identity = classifiedIdentity(
			lockfileKey,
			metadata,
			approvedScopes,
			approvedRegistry,
		);
		if (!identity) continue;
		const versions = versionsByName.get(identity.name) ?? new Set();
		versions.add(identity.version);
		versionsByName.set(identity.name, versions);
	}
	if (versionsByName.size === 0) {
		throw new Error("pnpm lockfile packages mapping has no auditable versions");
	}
	return Object.fromEntries(
		[...versionsByName.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([name, versions]) => [name, [...versions].sort()]),
	);
}

function auditEndpoint(registryValue) {
	return new URL(
		"-/npm/v1/security/advisories/bulk",
		registryUrl(registryValue),
	).toString();
}

function safeSingleLine(value, field) {
	const hasControlCharacter =
		typeof value === "string" &&
		[...value].some((character) => {
			const codePoint = character.codePointAt(0);
			return (
				codePoint !== undefined &&
				(codePoint <= 31 ||
					codePoint === 127 ||
					UNSAFE_LINE_CODE_POINTS.has(codePoint))
			);
		});
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
	if (
		[...url.searchParams.keys()].some((name) => SENSITIVE_QUERY_NAME.test(name))
	) {
		throw new Error(
			"bulk advisory URL must not contain credential query parameters",
		);
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
	const { auditLevel, lockfile, scopePolicy } = parseArguments(
		process.argv.slice(2),
	);
	const registry = process.env.npm_config_registry ?? DEFAULT_REGISTRY;
	const payload = buildBulkPayload(await readFile(lockfile, "utf8"), {
		allowedScopes: await loadAllowedScopes(scopePolicy),
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
