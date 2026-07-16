import { spawnSync } from "node:child_process";
import { gitEnvironmentForRepoRoot } from "../runtime/git-environment.js";
import type { PacketFamilySchemaVersion } from "./packet-consolidation.js";
import {
	buildSynaipseTransition,
	type SynaipseTransitionInput,
} from "./transition.js";

const CANONICAL_REMOTE = "https://github.com/jscraik/coding-harness.git";
const FULL_SHA = /^[0-9a-f]{40}$/;

interface TransitionRoute {
	transitionId: string;
	fromStage: SynaipseTransitionInput["fromStage"];
	toStage: SynaipseTransitionInput["toStage"];
}

interface ObservedTransitionRepository {
	repositorySha: string;
	hostedMainSha: string;
	evidenceRefs: string[];
}

/** Result of deriving transition identity from bounded repository-owned refs. */
export type PacketTransitionProjectionSource =
	| { status: "available"; observation: ObservedTransitionRepository }
	| { status: "unavailable"; reason: string };

const TRANSITION_ROUTES: Readonly<
	Partial<Record<PacketFamilySchemaVersion, TransitionRoute>>
> = {
	"reviewer-decision/v1": {
		transitionId: "ch_transition_reviewer_decision_compatibility",
		fromStage: "review",
		toStage: "integrate",
	},
	"governance-decision-surface/v1": {
		transitionId: "ch_transition_governance_decision_compatibility",
		fromStage: "shape",
		toStage: "admit",
	},
};

/** Read one git value without a shell or network access. */
function readGit(repoRoot: string, args: string[]): string | null {
	const result = spawnSync("git", args, {
		cwd: repoRoot,
		env: gitEnvironmentForRepoRoot(),
		encoding: "utf8",
	});
	if (result.status !== 0) return null;
	const value = result.stdout.trim();
	return value.length > 0 ? value : null;
}

/** Observe immutable checkout and hosted-main refs from the canonical repo. */
export function observePacketTransitionSource(
	repoRoot: string,
): PacketTransitionProjectionSource {
	const remote = readGit(repoRoot, ["remote", "get-url", "origin"]);
	if (remote !== CANONICAL_REMOTE)
		return {
			status: "unavailable",
			reason: "canonical coding-harness origin is unavailable",
		};
	const repositorySha = readGit(repoRoot, ["rev-parse", "--verify", "HEAD"]);
	const hostedMainSha = readGit(repoRoot, [
		"rev-parse",
		"--verify",
		"refs/remotes/origin/main",
	]);
	if (
		!repositorySha ||
		!hostedMainSha ||
		!FULL_SHA.test(repositorySha) ||
		!FULL_SHA.test(hostedMainSha)
	)
		return {
			status: "unavailable",
			reason: "canonical checkout or hosted-main SHA is unavailable",
		};
	return {
		status: "available",
		observation: {
			repositorySha,
			hostedMainSha,
			evidenceRefs: [
				`git:HEAD@${repositorySha}`,
				`git:refs/remotes/origin/main@${hostedMainSha}`,
			],
		},
	};
}

/** Build a complete authority-safe transition from repository observations. */
export function buildPacketTransition(
	schemaVersion: PacketFamilySchemaVersion,
	legacyEvidenceRefs: string[],
	repoRoot: string,
	observedAt: string,
):
	| SynaipseTransitionInput
	| Extract<PacketTransitionProjectionSource, { status: "unavailable" }> {
	const route = TRANSITION_ROUTES[schemaVersion];
	if (!route)
		return { status: "unavailable", reason: "packet has no transition route" };
	const source = observePacketTransitionSource(repoRoot);
	if (source.status === "unavailable") return source;
	return buildSynaipseTransition({
		...route,
		repositorySha: source.observation.repositorySha,
		hostedMainSha: source.observation.hostedMainSha,
		evidenceRefs: [...source.observation.evidenceRefs, ...legacyEvidenceRefs],
		observedAt,
		authority: {
			owner: "codex",
			standing: false,
			capabilities: ["observe:transition"],
		},
		vitalDecision: { required: false, question: null },
	});
}
