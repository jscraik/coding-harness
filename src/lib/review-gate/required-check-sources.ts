import type { HarnessContract } from "../contract/types.js";
import type { CheckRun } from "../github/client.js";
import type { NormalizedGateDefinition } from "../policy/required-checks.js";
import { loadNormalizedRequiredChecksManifest } from "./required-check-manifest.js";

/** Required-check provider identity constraints from the active CI manifest. */
export interface RequiredCheckSourceConstraint {
	providerSlugs: Set<string>;
	sourceAppIds: Set<string>;
}

function normalizeConstraintSourceToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeSourceToken(
	value: string | number | undefined,
): string | undefined {
	if (typeof value === "number") {
		return String(value);
	}
	if (typeof value !== "string") {
		return undefined;
	}
	const normalized = normalizeConstraintSourceToken(value);
	return normalized.length > 0 ? normalized : undefined;
}

/** Return true when a check run carries provider identity metadata. */
export function hasCheckRunSourceMetadata(run: CheckRun | undefined): boolean {
	if (!run) {
		return false;
	}
	return Boolean(
		normalizeSourceToken(run.app?.slug) ||
			normalizeSourceToken(run.app?.id) ||
			normalizeSourceToken(run.app?.name),
	);
}

/** Return true when a check run satisfies the expected provider identity. */
export function matchesExpectedSource(
	run: CheckRun,
	constraint: RequiredCheckSourceConstraint | undefined,
): boolean {
	if (!constraint) {
		return true;
	}

	// Treat empty constraint as unconstrained
	if (
		constraint.providerSlugs.size === 0 &&
		constraint.sourceAppIds.size === 0
	) {
		return true;
	}

	const appSlug = normalizeSourceToken(run.app?.slug);
	const appId = normalizeSourceToken(run.app?.id);
	const appName = normalizeSourceToken(run.app?.name);

	if (!appSlug && !appId && !appName) {
		return false;
	}
	return Boolean(
		(appSlug && constraint.providerSlugs.has(appSlug)) ||
			(appSlug && constraint.sourceAppIds.has(appSlug)) ||
			(appId && constraint.sourceAppIds.has(appId)) ||
			(appName && constraint.providerSlugs.has(appName)) ||
			(appName && constraint.sourceAppIds.has(appName)),
	);
}

/** Describe the expected provider identity for blocker messages. */
export function describeExpectedSource(
	constraint: RequiredCheckSourceConstraint | undefined,
): string | undefined {
	if (!constraint) {
		return undefined;
	}
	const expected = [
		...constraint.providerSlugs.values(),
		...constraint.sourceAppIds.values(),
	].filter((value, index, values) => values.indexOf(value) === index);
	return expected.length > 0 ? expected.join(", ") : undefined;
}

function resolveGateKeys(gate: NormalizedGateDefinition): string[] {
	return [
		gate.displayName,
		...(gate.githubCheckName ? [gate.githubCheckName] : []),
	].filter((value, index, values) => values.indexOf(value) === index);
}

function buildSourceConstraint(
	gate: NormalizedGateDefinition,
): RequiredCheckSourceConstraint {
	const constraint = {
		providerSlugs: new Set<string>(),
		sourceAppIds: new Set<string>(),
	};
	const normalizedSourceAppSlug = normalizeConstraintSourceToken(
		gate.sourceAppSlug,
	);
	const normalizedSourceAppId = normalizeConstraintSourceToken(
		gate.sourceAppId,
	);
	if (normalizedSourceAppSlug.length > 0) {
		constraint.providerSlugs.add(normalizedSourceAppSlug);
	}
	if (normalizedSourceAppId.length > 0) {
		constraint.sourceAppIds.add(normalizedSourceAppId);
	}
	return constraint;
}

function mergeSourceConstraint(
	existing: RequiredCheckSourceConstraint | undefined,
	constraint: RequiredCheckSourceConstraint,
): RequiredCheckSourceConstraint {
	const merged = existing ?? {
		providerSlugs: new Set<string>(),
		sourceAppIds: new Set<string>(),
	};
	for (const providerSlug of constraint.providerSlugs) {
		merged.providerSlugs.add(providerSlug);
	}
	for (const sourceAppId of constraint.sourceAppIds) {
		merged.sourceAppIds.add(sourceAppId);
	}
	return merged;
}

/** Resolve source-authority constraints for active and explicitly required external checks. */
export function resolveRequiredCheckSources(
	contract: HarnessContract,
	contractPath?: string,
	requiredChecks: readonly string[] = [],
): Map<string, RequiredCheckSourceConstraint> {
	const sources = new Map<string, RequiredCheckSourceConstraint>();
	const normalizedManifest = loadNormalizedRequiredChecksManifest(
		contract,
		contractPath,
	);
	if (!normalizedManifest) {
		return sources;
	}

	const reviewPolicyRequiredChecks = new Set(
		requiredChecks
			.map((checkName) => checkName.trim())
			.filter((checkName) => checkName.length > 0),
	);
	const activeProviderKeys = new Set<string>();
	for (const gate of normalizedManifest.gates) {
		if (
			gate.enabled !== false &&
			gate.class === "required" &&
			gate.provider === normalizedManifest.activeProvider
		) {
			for (const key of resolveGateKeys(gate)) {
				activeProviderKeys.add(key);
			}
		}
	}

	for (const gate of normalizedManifest.gates) {
		if (gate.enabled === false || gate.class !== "required") {
			continue;
		}

		const keys = resolveGateKeys(gate);
		const isActiveProviderGate =
			gate.provider === normalizedManifest.activeProvider;
		const isExternalPolicyCheck =
			keys.some((key) => reviewPolicyRequiredChecks.has(key)) &&
			!keys.some((key) => activeProviderKeys.has(key));
		if (!isActiveProviderGate && !isExternalPolicyCheck) {
			continue;
		}

		const constraint = buildSourceConstraint(gate);
		for (const key of keys) {
			sources.set(key, mergeSourceConstraint(sources.get(key), constraint));
		}
	}

	return sources;
}
