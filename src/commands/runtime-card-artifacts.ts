import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import { buildRuntimeCardHandoff } from "../lib/runtime/runtime-card-handoff.js";
import type { RuntimeEvidenceBundle } from "../lib/runtime/runtime-evidence-bundle.js";
import { buildRuntimeEvidenceBundleFromCard } from "../lib/runtime/runtime-evidence-producer.js";
import {
	resolveRepoRuntimeOutputArtifactPath,
	writeRepoRuntimeJsonArtifact,
} from "../lib/runtime/repo-runtime-artifact.js";
import type { RuntimeCardTraceRecorder } from "../lib/runtime-trace/runtime-card-trace.js";
import type { RuntimeCardCLIOptions } from "./runtime-card-args.js";

function assertDistinctOutputArtifacts(options: RuntimeCardCLIOptions): void {
	const artifacts = [
		options.outPath
			? {
					flagName: "--out",
					path: resolveRepoRuntimeOutputArtifactPath(
						options.repoRoot,
						options.outPath,
						"--out",
					),
				}
			: undefined,
		options.evidenceOutPath
			? {
					flagName: "--evidence-out",
					path: resolveRepoRuntimeOutputArtifactPath(
						options.repoRoot,
						options.evidenceOutPath,
						"--evidence-out",
					),
				}
			: undefined,
		options.handoffOutPath
			? {
					flagName: "--handoff-out",
					path: resolveRepoRuntimeOutputArtifactPath(
						options.repoRoot,
						options.handoffOutPath,
						"--handoff-out",
					),
				}
			: undefined,
	].filter((artifact): artifact is { flagName: string; path: string } =>
		Boolean(artifact),
	);
	for (let index = 0; index < artifacts.length; index += 1) {
		for (
			let compareIndex = index + 1;
			compareIndex < artifacts.length;
			compareIndex += 1
		) {
			const left = artifacts[index];
			const right = artifacts[compareIndex];
			if (!left || !right) continue;
			if (left.path === right.path) {
				throw new Error(
					`${left.flagName} and ${right.flagName} must target different files`,
				);
			}
		}
	}
}

function assertHandoffOutputRequirements(options: RuntimeCardCLIOptions): void {
	if (!options.handoffOutPath) return;
	if (!options.outPath || !options.evidenceOutPath) {
		throw new Error("--handoff-out requires --out and --evidence-out");
	}
}

function buildProducedEvidence(
	card: RuntimeCard,
	evidenceOutPath: string,
): RuntimeEvidenceBundle {
	return buildRuntimeEvidenceBundleFromCard(card, {
		provenanceRef: `artifact:${evidenceOutPath}`,
		generatedAt: card.generatedAt,
	});
}

/**
 * Writes runtime-card, evidence-bundle, and handoff artifacts for the runtime-card command.
 */
export function writeRuntimeCardArtifacts(
	options: RuntimeCardCLIOptions,
	card: RuntimeCard,
	trace: RuntimeCardTraceRecorder | undefined,
): void {
	assertDistinctOutputArtifacts(options);
	assertHandoffOutputRequirements(options);
	let producedEvidence: RuntimeEvidenceBundle | undefined;
	if (options.outPath) {
		const outPath = resolveRepoRuntimeOutputArtifactPath(
			options.repoRoot,
			options.outPath,
			"--out",
		);
		writeRepoRuntimeJsonArtifact(
			options.repoRoot,
			options.outPath,
			"--out",
			card,
		);
		trace?.recordArtifactWrite("runtime-card", outPath);
	}
	if (options.evidenceOutPath) {
		producedEvidence = buildProducedEvidence(card, options.evidenceOutPath);
		const evidenceOutPath = resolveRepoRuntimeOutputArtifactPath(
			options.repoRoot,
			options.evidenceOutPath,
			"--evidence-out",
		);
		writeRepoRuntimeJsonArtifact(
			options.repoRoot,
			options.evidenceOutPath,
			"--evidence-out",
			producedEvidence,
		);
		trace?.recordArtifactWrite("runtime-evidence-bundle", evidenceOutPath);
	}
	if (!options.handoffOutPath) return;
	if (!options.outPath || !options.evidenceOutPath) {
		throw new Error("--handoff-out requires --out and --evidence-out");
	}
	const evidence =
		producedEvidence ?? buildProducedEvidence(card, options.evidenceOutPath);
	const handoffOutPath = resolveRepoRuntimeOutputArtifactPath(
		options.repoRoot,
		options.handoffOutPath,
		"--handoff-out",
	);
	const handoff = buildRuntimeCardHandoff({
		repoRoot: options.repoRoot,
		runtimeCardPath: options.outPath,
		evidenceBundlePath: options.evidenceOutPath,
		runtimeCard: card,
		evidenceBundle: evidence,
		generatedAt: card.generatedAt,
	});
	writeRepoRuntimeJsonArtifact(
		options.repoRoot,
		options.handoffOutPath,
		"--handoff-out",
		handoff,
	);
	trace?.recordArtifactWrite("runtime-card-handoff", handoffOutPath);
}
