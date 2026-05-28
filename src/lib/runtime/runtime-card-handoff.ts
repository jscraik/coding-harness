import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import {
	RUNTIME_CARD_HANDOFF_SCHEMA_VERSION,
	type RuntimeCardHandoff,
	type RuntimeCardHandoffArtifactRef,
} from "./runtime-card-handoff-contract.js";
import { asRuntimeCardHandoff } from "./runtime-card-handoff-validation.js";
import { resolveRepoRuntimeOutputArtifactPath } from "./repo-runtime-artifact.js";
import type { RuntimeCard } from "./runtime-card.js";
import type { RuntimeEvidenceBundle } from "./runtime-evidence-bundle.js";

export {
	RUNTIME_CARD_HANDOFF_SCHEMA_VERSION,
	type RuntimeCardHandoff,
	type RuntimeCardHandoffArtifactRef,
	type RuntimeCardHandoffEvidenceUse,
	type RuntimeCardHandoffIdentity,
	type RuntimeCardHandoffValidationResult,
} from "./runtime-card-handoff-contract.js";
export {
	asRuntimeCardHandoff,
	validateRuntimeCardHandoff,
} from "./runtime-card-handoff-validation.js";

/** Inputs for building a durable runtime-card handoff receipt. */
export interface BuildRuntimeCardHandoffOptions {
	/** Repository root used to resolve persisted artifacts. */
	repoRoot: string;
	/** Repository-relative runtime-card output path. */
	runtimeCardPath: string;
	/** Repository-relative runtime-evidence-bundle output path. */
	evidenceBundlePath: string;
	/** Runtime card written to runtimeCardPath. */
	runtimeCard: RuntimeCard;
	/** Runtime evidence bundle written to evidenceBundlePath. */
	evidenceBundle: RuntimeEvidenceBundle;
	/** Optional handoff generation timestamp override. */
	generatedAt?: string;
	/** Freshness TTL for orientation use. Defaults to 3600 seconds. */
	ttlSeconds?: number;
}

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function artifactChecksum(
	repoRoot: string,
	artifactPath: string,
	flagName: string,
): {
	sha256: string;
	sizeBytes: number;
} {
	const resolvedPath = resolveRepoRuntimeOutputArtifactPath(
		repoRoot,
		artifactPath,
		flagName,
	);
	const stat = statSync(resolvedPath);
	if (!stat.isFile()) {
		throw new Error(`${flagName} must be a file`);
	}
	const bytes = readFileSync(resolvedPath);
	return {
		sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
		sizeBytes: stat.size,
	};
}

function buildRuntimeCardArtifactRef(
	options: BuildRuntimeCardHandoffOptions,
	sourceRefs: string[],
): RuntimeCardHandoffArtifactRef {
	return {
		path: options.runtimeCardPath,
		schemaVersion: options.runtimeCard.schemaVersion,
		...artifactChecksum(options.repoRoot, options.runtimeCardPath, "--out"),
		generatedAt: options.runtimeCard.generatedAt,
		headSha: options.runtimeCard.branch.ref,
		sourceRefs,
		provenanceRefs: [`artifact:${options.runtimeCardPath}`],
	};
}

function buildEvidenceBundleArtifactRef(
	options: BuildRuntimeCardHandoffOptions,
	sourceRefs: string[],
): RuntimeCardHandoffArtifactRef {
	return {
		path: options.evidenceBundlePath,
		schemaVersion: options.evidenceBundle.schemaVersion,
		...artifactChecksum(
			options.repoRoot,
			options.evidenceBundlePath,
			"--evidence-out",
		),
		generatedAt: options.evidenceBundle.generatedAt,
		headSha: options.runtimeCard.branch.ref,
		sourceRefs,
		provenanceRefs: [options.evidenceBundle.provenance.ref],
	};
}

function assertSameRuntimeIdentity(
	options: BuildRuntimeCardHandoffOptions,
): void {
	if (options.runtimeCard.issueKey !== options.evidenceBundle.issueKey) {
		throw new Error(
			"runtime-card handoff requires runtime-card and evidence bundle issue keys to match",
		);
	}
	if (options.runtimeCard.generatedAt !== options.evidenceBundle.generatedAt) {
		throw new Error(
			"runtime-card handoff requires runtime-card and evidence bundle generatedAt values to match",
		);
	}
	if (
		options.evidenceBundle.provenance.collectedAt !==
		options.runtimeCard.generatedAt
	) {
		throw new Error(
			"runtime-card handoff requires evidence provenance collectedAt to match runtime-card generatedAt",
		);
	}
	const expectedProvenanceRef = `artifact:${options.evidenceBundlePath}`;
	if (options.evidenceBundle.provenance.ref !== expectedProvenanceRef) {
		throw new Error(
			"runtime-card handoff requires evidence provenance ref to match --evidence-out",
		);
	}
}

/** Build a durable advisory handoff receipt binding a runtime card to its evidence bundle. */
export function buildRuntimeCardHandoff(
	options: BuildRuntimeCardHandoffOptions,
): RuntimeCardHandoff {
	assertSameRuntimeIdentity(options);
	const generatedAt = options.generatedAt ?? new Date().toISOString();
	const ttlSeconds = options.ttlSeconds ?? 3600;
	if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
		throw new Error(
			"runtime-card handoff ttlSeconds must be a positive integer",
		);
	}
	const expiresAt = new Date(
		Date.parse(generatedAt) + ttlSeconds * 1000,
	).toISOString();
	const cardSourceRefs = uniqueStrings(
		options.runtimeCard.sources.map((source) => source.ref),
	);
	const bundleSourceRefs = uniqueStrings(
		options.evidenceBundle.sources.map((source) => source.ref),
	);
	const sourceRefs = uniqueStrings([...cardSourceRefs, ...bundleSourceRefs]);
	const provenanceRefs = uniqueStrings([
		`artifact:${options.runtimeCardPath}`,
		options.evidenceBundle.provenance.ref,
	]);
	const handoff = {
		schemaVersion: RUNTIME_CARD_HANDOFF_SCHEMA_VERSION,
		generatedAt,
		expiresAt,
		issueKey: options.runtimeCard.issueKey,
		headSha: options.runtimeCard.branch.ref,
		evidenceUse: "orientation",
		freshness: "current",
		runtimeIdentity: {
			issueKey: options.runtimeCard.issueKey,
			headSha: options.runtimeCard.branch.ref,
			generatedAt: options.runtimeCard.generatedAt,
			provenanceRef: options.evidenceBundle.provenance.ref,
			sourceRefs,
		},
		runtimeCard: buildRuntimeCardArtifactRef(options, cardSourceRefs),
		evidenceBundle: buildEvidenceBundleArtifactRef(options, bundleSourceRefs),
		sourceRefs,
		provenanceRefs,
		blockers: uniqueStrings([
			...options.runtimeCard.blockers,
			...options.evidenceBundle.blockers,
		]),
	};
	return asRuntimeCardHandoff(handoff);
}
