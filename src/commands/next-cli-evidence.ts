import { cwd } from "node:process";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import type { parseNextArgs } from "./next-args.js";
import { loadPhaseExitArtifact } from "./next-phase-exit.js";
import { loadFitnessReportArtifact } from "./next-fitness-report.js";
import {
	discoverPrCloseoutArtifactPath,
	loadPrCloseoutArtifact,
	type HarnessNextPrCloseoutEvidence,
} from "./next-pr-closeout.js";
import { loadRuntimeCardArtifact } from "./next-runtime-card.js";
import { loadSynaipseTransitionArtifact } from "./next-synaipse-transition.js";
import type { HarnessNextOptions } from "./next-runner.js";

type EvidenceSetters = {
	setPhaseExit: (phaseExit: HePhaseExit) => void;
	setRuntimeCard: (runtimeCard: RuntimeCard) => void;
	setPrCloseout: (prCloseout: HarnessNextPrCloseoutEvidence) => void;
	setSynaipseTransition: (transition: unknown) => void;
};

function loadPhaseExitEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
	setters: EvidenceSetters,
): HarnessDecision | undefined {
	if (parsed.phaseExitPath === undefined) return undefined;
	const loaded = loadPhaseExitArtifact(
		options.repoRoot ?? cwd(),
		parsed.phaseExitPath,
		parsed.mode,
	);
	if ("decision" in loaded) return loaded.decision;
	setters.setPhaseExit(loaded.phaseExit);
	return undefined;
}

function loadRuntimeCardEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
	setters: EvidenceSetters,
): HarnessDecision | undefined {
	if (parsed.runtimeCardPath === undefined) return undefined;
	const loaded = loadRuntimeCardArtifact(
		options.repoRoot ?? cwd(),
		parsed.runtimeCardPath,
		parsed.mode,
	);
	if ("decision" in loaded) return loaded.decision;
	setters.setRuntimeCard(loaded.runtimeCard);
	return undefined;
}

function loadPrCloseoutEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
	setters: EvidenceSetters,
): HarnessDecision | undefined {
	const repoRoot = options.repoRoot ?? cwd();
	const path =
		parsed.prCloseoutPath ?? discoverPrCloseoutArtifactPath(repoRoot);
	if (path === undefined) return undefined;
	const loaded = loadPrCloseoutArtifact(repoRoot, path, parsed.mode);
	if ("decision" in loaded) return loaded.decision;
	setters.setPrCloseout(loaded.prCloseout);
	return undefined;
}

function loadFitnessEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
): HarnessDecision | undefined {
	if (parsed.fitnessReportPath === undefined) return undefined;
	const loaded = loadFitnessReportArtifact(
		options.repoRoot ?? cwd(),
		parsed.fitnessReportPath,
		parsed.mode,
	);
	if ("decision" in loaded) return loaded.decision;
	return undefined;
}

function loadSynaipseTransitionEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
	setters: EvidenceSetters,
): HarnessDecision | undefined {
	if (parsed.synaipseTransitionPath === undefined) return undefined;
	const loaded = loadSynaipseTransitionArtifact(
		options.repoRoot ?? cwd(),
		parsed.synaipseTransitionPath,
		parsed.mode,
	);
	if ("decision" in loaded) return loaded.decision;
	setters.setSynaipseTransition(loaded.synaipseTransition);
	return undefined;
}

/** Load optional local evidence artifacts accepted by the harness next CLI. */
export function loadNextCliEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
	setters: EvidenceSetters,
): HarnessDecision | undefined {
	const loaders = [
		() => loadPhaseExitEvidence(parsed, options, setters),
		() => loadRuntimeCardEvidence(parsed, options, setters),
		() => loadPrCloseoutEvidence(parsed, options, setters),
		() => loadFitnessEvidence(parsed, options),
		() => loadSynaipseTransitionEvidence(parsed, options, setters),
	];
	for (const load of loaders) {
		const decision = load();
		if (decision !== undefined) return decision;
	}
	return undefined;
}
