import { cwd } from "node:process";
import type { HarnessDecision } from "../lib/decision/harness-decision.js";
import type { HePhaseExit } from "../lib/decision/he-phase-exit.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";
import type { parseNextArgs } from "./next-args.js";
import { loadPhaseExitArtifact } from "./next-phase-exit.js";
import {
	discoverPrCloseoutArtifactPath,
	loadPrCloseoutArtifact,
	type HarnessNextPrCloseoutEvidence,
} from "./next-pr-closeout.js";
import { loadRuntimeCardArtifact } from "./next-runtime-card.js";
import type { HarnessNextOptions } from "./next-runner.js";

/** Load optional local evidence artifacts accepted by the harness next CLI. */
export function loadNextCliEvidence(
	parsed: ReturnType<typeof parseNextArgs>,
	options: Omit<HarnessNextOptions, "mode" | "files">,
	setters: {
		setPhaseExit: (phaseExit: HePhaseExit) => void;
		setRuntimeCard: (runtimeCard: RuntimeCard) => void;
		setPrCloseout: (prCloseout: HarnessNextPrCloseoutEvidence) => void;
	},
): HarnessDecision | undefined {
	const repoRoot = options.repoRoot ?? cwd();
	if (parsed.phaseExitPath !== undefined) {
		const loadedPhaseExit = loadPhaseExitArtifact(
			repoRoot,
			parsed.phaseExitPath,
			parsed.mode,
		);
		if ("decision" in loadedPhaseExit) return loadedPhaseExit.decision;
		setters.setPhaseExit(loadedPhaseExit.phaseExit);
	}
	if (parsed.runtimeCardPath !== undefined) {
		const loadedRuntimeCard = loadRuntimeCardArtifact(
			repoRoot,
			parsed.runtimeCardPath,
			parsed.mode,
		);
		if ("decision" in loadedRuntimeCard) return loadedRuntimeCard.decision;
		setters.setRuntimeCard(loadedRuntimeCard.runtimeCard);
	}
	const prCloseoutPath =
		parsed.prCloseoutPath ?? discoverPrCloseoutArtifactPath(repoRoot);
	if (prCloseoutPath !== undefined) {
		const loadedPrCloseout = loadPrCloseoutArtifact(
			repoRoot,
			prCloseoutPath,
			parsed.mode,
		);
		if ("decision" in loadedPrCloseout) return loadedPrCloseout.decision;
		setters.setPrCloseout(loadedPrCloseout.prCloseout);
	}
	return undefined;
}
