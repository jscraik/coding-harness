import process from "node:process";
import { parse } from "yaml";

export const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

const PACKAGE_NAME =
	/^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const LOCAL_PACKAGE_KEY = /^(?:file|link|workspace):/;
const REMOTE_PACKAGE_KEY = /^(?:git|github|https?):/;

export function packageIdentity(lockfileKey) {
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

export function registryUrl(value) {
	const registry = new URL(value);
	const defaultRegistry = new URL(DEFAULT_REGISTRY);
	const loopbackTestEndpoint =
		process.env.HARNESS_AUDIT_ALLOW_HTTP_FOR_TESTS === "1" &&
		(registry.hostname === "127.0.0.1" || registry.hostname === "localhost");
	if (registry.protocol !== "https:" && !loopbackTestEndpoint) {
		throw new Error("audit registry must use HTTPS");
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

function assertRegistryProvenance(
	packageName,
	metadata,
	registry,
	manifestRegistryApproved,
) {
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
	if (!manifestRegistryApproved) {
		throw new Error(
			`lockfile package ${packageName} has integrity but no approved registry provenance signal`,
		);
	}
}

function packageScope(packageName) {
	return packageName.startsWith("@") ? packageName.split("/")[0] : null;
}

export function packagesMapping(lockfileText) {
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

export function classifiedIdentity(
	lockfileKey,
	metadata,
	approvedScopes,
	registry,
	manifestRegistryApproved,
) {
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
	assertRegistryProvenance(
		identity.name,
		metadata,
		registry,
		manifestRegistryApproved,
	);
	return identity;
}

export function hasPackageManifestShape(manifest) {
	return (
		manifest !== null &&
		typeof manifest === "object" &&
		!Array.isArray(manifest) &&
		manifest.algorithm === "sha256" &&
		typeof manifest.registry_origin === "string"
	);
}

export function assertPackageManifestRegistry(manifest, registry) {
	if (!hasPackageManifestShape(manifest)) {
		throw new Error("audit package manifest is malformed");
	}
	const declaredRegistry = registryUrl(manifest.registry_origin);
	if (declaredRegistry.origin !== registry.origin) {
		throw new Error("audit package manifest registry origin does not match");
	}
	return true;
}
