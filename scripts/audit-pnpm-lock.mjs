#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import process from "node:process";

const DEFAULT_REGISTRY = "https://registry.npmjs.org/";
const SEVERITY_ORDER = new Map([
	["info", 0],
	["low", 1],
	["moderate", 2],
	["high", 3],
	["critical", 4],
]);

function parseArguments(argv) {
	let auditLevel = "moderate";
	let lockfile = "pnpm-lock.yaml";
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--audit-level") {
			auditLevel = argv[index + 1] ?? "";
			index += 1;
		} else if (argument === "--lockfile") {
			lockfile = argv[index + 1] ?? "";
			index += 1;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (!SEVERITY_ORDER.has(auditLevel)) {
		throw new Error(`Unsupported audit level: ${auditLevel}`);
	}
	if (lockfile.length === 0) {
		throw new Error("--lockfile requires a path");
	}
	return { auditLevel, lockfile };
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
	if (
		!/^(@[^/]+\/[^@]+|[^@/]+)$/.test(name) ||
		!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)
	) {
		return null;
	}
	return { name, version };
}

export function buildBulkPayload(lockfileText) {
	const lines = lockfileText.split(/\r?\n/);
	const packagesStart = lines.indexOf("packages:");
	if (packagesStart === -1) {
		throw new Error("pnpm lockfile has no packages section");
	}

	const versionsByName = new Map();
	for (const line of lines.slice(packagesStart + 1)) {
		if (/^[^\s]/.test(line)) break;
		const match = line.match(/^ {2}'((?:[^']|'')+)':\s*$/);
		if (!match) continue;
		const identity = packageIdentity(match[1].replaceAll("''", "'"));
		if (!identity) continue;
		const versions = versionsByName.get(identity.name) ?? new Set();
		versions.add(identity.version);
		versionsByName.set(identity.name, versions);
	}
	if (versionsByName.size === 0) {
		throw new Error("pnpm lockfile packages section has no auditable versions");
	}

	return Object.fromEntries(
		[...versionsByName.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([name, versions]) => [name, [...versions].sort()]),
	);
}

function auditEndpoint(registryValue) {
	const registry = new URL(registryValue);
	if (registry.protocol !== "https:") {
		const loopbackTestEndpoint =
			process.env.HARNESS_AUDIT_ALLOW_HTTP_FOR_TESTS === "1" &&
			(registry.hostname === "127.0.0.1" || registry.hostname === "localhost");
		if (!loopbackTestEndpoint) {
			throw new Error("audit registry must use HTTPS");
		}
	}
	if (registry.username || registry.password) {
		throw new Error("audit registry URL must not contain credentials");
	}
	return new URL("-/npm/v1/security/advisories/bulk", registry).toString();
}

export function validateResponse(value) {
	if (value === null || Array.isArray(value) || typeof value !== "object") {
		throw new Error("bulk advisory response must be an object");
	}
	const advisories = [];
	for (const [packageName, packageAdvisories] of Object.entries(value)) {
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

function parseAdvisory(packageName, advisory) {
	if (
		advisory === null ||
		typeof advisory !== "object" ||
		typeof advisory.severity !== "string" ||
		!SEVERITY_ORDER.has(advisory.severity) ||
		typeof advisory.title !== "string" ||
		typeof advisory.url !== "string"
	) {
		throw new Error(`bulk advisory entry for ${packageName} is malformed`);
	}
	return {
		name: packageName,
		severity: advisory.severity,
		title: advisory.title,
		url: advisory.url,
	};
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
		headers: {
			accept: "application/json",
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(
			Number(process.env.HARNESS_AUDIT_TIMEOUT_SECONDS ?? "300") * 1000,
		),
	});
	if (!response.ok) {
		throw new Error(`bulk advisory endpoint returned HTTP ${response.status}`);
	}
	return validateResponse(await response.json());
}

export function blockingAdvisories(advisories, auditLevel) {
	const threshold = SEVERITY_ORDER.get(auditLevel);
	if (threshold === undefined) {
		throw new Error(`Unsupported audit level: ${auditLevel}`);
	}
	return advisories.filter(
		(advisory) => SEVERITY_ORDER.get(advisory.severity) >= threshold,
	);
}

async function main() {
	const { auditLevel, lockfile } = parseArguments(process.argv.slice(2));
	const payload = buildBulkPayload(await readFile(lockfile, "utf8"));
	const advisories = await fetchBulkAdvisories(payload);
	const blocking = blockingAdvisories(advisories, auditLevel);
	console.log(
		`Bulk dependency audit checked ${Object.keys(payload).length} packages; ${advisories.length} advisories; ${blocking.length} at or above ${auditLevel}.`,
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
