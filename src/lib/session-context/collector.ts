import { execFileSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	readdirSync,
	realpathSync,
	readFileSync,
	statSync,
} from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type {
	SessionContextArtifactRef,
	SessionContextChangedFile,
	SessionContextOptions,
	SessionContextReport,
	SessionContextStaleState,
	SessionContextStatus,
} from "./types.js";

const ACTIVE_ARTIFACTS_PATH = ".harness/active-artifacts.md";
const MAX_REVIEW_ARTIFACTS = 50;
const ISSUE_KEY_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const BACKTICK = String.fromCharCode(96);

const RUNTIME_CARD_CANDIDATES = [
	".harness/runtime/runtime-card.json",
	".harness/runtime-card.json",
	"artifacts/runtime-card.json",
	"artifacts/runtime/runtime-card.json",
	"artifacts/runtime-cards/runtime-card.json",
] as const;

const SESSION_EVIDENCE_CANDIDATES = [
	".harness/runtime",
	"artifacts/runtime",
	"artifacts/reviews",
	"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
] as const;

/** Build the read-only session-context/v1 orientation packet from repo-local evidence. */
export function collectSessionContext(
	options: SessionContextOptions = {},
): SessionContextReport {
	const generatedAt = (options.now ?? new Date()).toISOString();
	const repoRoot = canonicalRepoRoot(options.repoRoot ?? process.cwd());
	const repository = getRepositoryName(repoRoot);
	const branch = gitOutput(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
	const headSha = gitOutput(repoRoot, ["rev-parse", "HEAD"]);
	const activeArtifacts = collectActiveArtifacts(repoRoot);
	const runtimeCards = collectRuntimeCards(repoRoot);
	const reviewArtifacts = collectReviewArtifacts(repoRoot);
	const sessionEvidence = collectSessionEvidence(repoRoot);
	const issueRef = inferIssueRef(branch, activeArtifacts, repoRoot);
	const changedFiles = collectChangedFiles(repoRoot);
	const staleState = buildStaleState({
		activeArtifacts,
		runtimeCards,
		reviewArtifacts,
		sessionEvidence,
		branch,
		headSha,
	});

	return {
		schemaVersion: "session-context/v1",
		generatedAt,
		producer: "harness:session-context",
		status: deriveStatus(staleState),
		evidenceUse: "orientation",
		runtimeStatus: "emitted",
		repository,
		repoRoot,
		issueRef,
		branch,
		headSha,
		changedFiles,
		activeArtifacts,
		runtimeCards,
		reviewArtifacts,
		sessionEvidence,
		staleState,
		nextTraversalHints: buildTraversalHints(repoRoot),
	};
}

function canonicalRepoRoot(repoRoot: string): string {
	return realpathSync(resolve(repoRoot));
}

function getRepositoryName(repoRoot: string): string {
	const remoteUrl = gitOutput(repoRoot, [
		"config",
		"--get",
		"remote.origin.url",
	]);
	if (!remoteUrl) return basename(repoRoot);
	const withoutGitSuffix = remoteUrl.replace(/\.git$/, "");
	const match = withoutGitSuffix.match(/[:/]([^/:]+\/[^/]+)$/);
	return match?.[1] ?? basename(repoRoot);
}

function gitOutput(repoRoot: string, args: string[]): string | null {
	try {
		const output = execFileSync("git", args, {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return output.trim().length > 0 ? output.trimEnd() : null;
	} catch {
		return null;
	}
}

function collectChangedFiles(repoRoot: string): SessionContextChangedFile[] {
	const output = gitOutput(repoRoot, ["status", "--short"]);
	if (!output) return [];
	return output
		.split("\n")
		.map((line) => line.trimEnd())
		.filter(Boolean)
		.map((line) => {
			const status = line.slice(0, 2).trim() || "changed";
			const rawPath = line.slice(3).trim();
			const path = rawPath.includes(" -> ")
				? (rawPath.split(" -> ").pop() ?? rawPath)
				: rawPath;
			return { path, status };
		});
}

function collectActiveArtifacts(repoRoot: string): SessionContextArtifactRef[] {
	const activeArtifactRef = safeExistingFile(repoRoot, ACTIVE_ARTIFACTS_PATH);
	if (!activeArtifactRef) return [];
	const text = readText(repoRoot, ACTIVE_ARTIFACTS_PATH);
	const refs = new Set<string>([ACTIVE_ARTIFACTS_PATH]);
	for (const repoPath of extractBacktickRefs(text)) {
		const safePath = safeExistingPath(repoRoot, repoPath);
		if (safePath) refs.add(safePath);
	}
	return [...refs]
		.sort()
		.map((path) => artifactRef(repoRoot, path, "active-artifacts"));
}

function collectRuntimeCards(repoRoot: string): SessionContextArtifactRef[] {
	return RUNTIME_CARD_CANDIDATES.map((path) => safeExistingFile(repoRoot, path))
		.filter((path): path is string => path !== null)
		.map((path) => artifactRef(repoRoot, path, "runtime-card"));
}

function collectReviewArtifacts(repoRoot: string): SessionContextArtifactRef[] {
	return listSafeFiles(
		repoRoot,
		"artifacts/reviews",
		".md",
		MAX_REVIEW_ARTIFACTS,
	).map((path) => artifactRef(repoRoot, path, "review-artifact"));
}

function collectSessionEvidence(repoRoot: string): SessionContextArtifactRef[] {
	const refs = new Set<string>();
	for (const candidate of SESSION_EVIDENCE_CANDIDATES) {
		const repoPath = safeExistingPath(repoRoot, candidate);
		if (repoPath) refs.add(repoPath);
	}
	return [...refs]
		.sort()
		.map((path) => artifactRef(repoRoot, path, "session-evidence"));
}

function buildStaleState(input: {
	activeArtifacts: SessionContextArtifactRef[];
	runtimeCards: SessionContextArtifactRef[];
	reviewArtifacts: SessionContextArtifactRef[];
	sessionEvidence: SessionContextArtifactRef[];
	branch: string | null;
	headSha: string | null;
}): SessionContextStaleState[] {
	const staleState: SessionContextStaleState[] = [];
	if (!input.branch || !input.headSha) {
		staleState.push({
			surface: "git_worktree",
			freshness: "unknown",
			reason:
				"Git branch or HEAD SHA could not be read from the requested repository root.",
		});
	}
	if (input.activeArtifacts.length === 0) {
		staleState.push({
			surface: "active_artifacts",
			freshness: "missing",
			reason:
				".harness/active-artifacts.md was not found inside the repository.",
		});
	}
	if (input.runtimeCards.length === 0) {
		staleState.push({
			surface: "runtime_card",
			freshness: "missing",
			reason:
				"No local runtime-card artifact was discovered in the allow-listed repo-local paths.",
		});
	}
	if (input.reviewArtifacts.length === 0) {
		staleState.push({
			surface: "review_artifacts",
			freshness: "missing",
			reason: "No local review artifact was discovered in artifacts/reviews.",
		});
	}
	if (input.sessionEvidence.length === 0) {
		staleState.push({
			surface: "session_evidence",
			freshness: "missing",
			reason:
				"No repo-local session evidence artifact was found in the allow-listed locations.",
		});
	}
	staleState.push({
		surface: "external_state",
		freshness: "not_applicable",
		reason:
			"session-context/v1 is local orientation only and does not refresh PR, CI, review, or tracker state.",
	});
	return staleState;
}

function deriveStatus(
	staleState: SessionContextStaleState[],
): SessionContextStatus {
	return staleState.some((state) =>
		["missing", "stale", "unknown"].includes(state.freshness),
	)
		? "warn"
		: "pass";
}

function buildTraversalHints(repoRoot: string) {
	const quotedRepoRoot = shellQuote(repoRoot);
	return [
		{
			label: "agent cockpit",
			command: `cd ${quotedRepoRoot} && node --import tsx src/cli.ts next --json`,
			reason: "Ask the narrow cockpit for the next safe command before acting.",
		},
		{
			label: "runtime card",
			command: `node --import tsx src/cli.ts runtime-card --json --repo ${quotedRepoRoot}`,
			reason:
				"Refresh the runtime-card summary when local runtime evidence is missing or stale.",
		},
		{
			label: "agent readiness",
			command: `node --import tsx src/cli.ts agent-readiness --json --repo-root ${quotedRepoRoot}`,
			reason:
				"Check instruction, artifact, capability, approval, traceability, and context-health surfaces.",
		},
		{
			label: "orientation rail",
			command: `cd ${quotedRepoRoot} && node --import tsx src/cli.ts commands --json --for-agent --mode orient`,
			reason: "List the compact orient-mode command rail available to agents.",
		},
	];
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function inferIssueRef(
	branch: string | null,
	activeArtifacts: SessionContextArtifactRef[],
	repoRoot: string,
): string | null {
	const branchIssue = branch?.match(ISSUE_KEY_PATTERN)?.[0];
	if (branchIssue) return branchIssue;
	const activeIssue = readText(repoRoot, ACTIVE_ARTIFACTS_PATH).match(
		ISSUE_KEY_PATTERN,
	)?.[0];
	if (activeIssue) return activeIssue;
	for (const artifact of activeArtifacts) {
		const artifactIssue = artifact.path.match(ISSUE_KEY_PATTERN)?.[0];
		if (artifactIssue) return artifactIssue;
	}
	return null;
}

function artifactRef(
	repoRoot: string,
	path: string,
	source: string,
): SessionContextArtifactRef {
	const sizeBytes = safeSize(repoRoot, path);
	return {
		path,
		status: "pass",
		source,
		...(sizeBytes === undefined ? {} : { sizeBytes }),
	};
}

function safeExistingFile(repoRoot: string, repoPath: string): string | null {
	const safePath = safeExistingPath(repoRoot, repoPath);
	if (!safePath) return null;
	try {
		return lstatSync(join(repoRoot, safePath)).isFile() ? safePath : null;
	} catch {
		return null;
	}
}

function safeExistingPath(repoRoot: string, repoPath: string): string | null {
	const normalizedInput = repoPath.trim();
	if (normalizedInput.length === 0 || isAbsolute(normalizedInput)) return null;
	const candidate = resolve(repoRoot, normalizedInput);
	const syntacticRelative = relative(repoRoot, candidate);
	if (syntacticRelative.startsWith("..") || isAbsolute(syntacticRelative)) {
		return null;
	}
	if (!existsSync(candidate)) return null;
	const realCandidate = realpathSync(candidate);
	const realRelative = relative(repoRoot, realCandidate);
	if (realRelative.startsWith("..") || isAbsolute(realRelative)) return null;
	return toRepoPath(realRelative);
}

function listSafeFiles(
	repoRoot: string,
	dirPath: string,
	suffix: string,
	limit: number,
): string[] {
	const safeDir = safeExistingPath(repoRoot, dirPath);
	if (!safeDir) return [];
	const absoluteDir = join(repoRoot, safeDir);
	let entries: string[];
	try {
		entries = readdirSync(absoluteDir);
	} catch {
		return [];
	}
	const paths: string[] = [];
	for (const entry of entries.sort()) {
		if (paths.length >= limit) break;
		const absolutePath = join(absoluteDir, entry);
		let stats: ReturnType<typeof lstatSync>;
		try {
			stats = lstatSync(absolutePath);
		} catch {
			continue;
		}
		if (stats.isSymbolicLink() || !stats.isFile() || !entry.endsWith(suffix)) {
			continue;
		}
		const safePath = safeExistingPath(repoRoot, join(safeDir, entry));
		if (safePath) paths.push(safePath);
	}
	return paths;
}

function extractBacktickRefs(text: string): string[] {
	const refs: string[] = [];
	let index = 0;
	while (index < text.length) {
		const start = text.indexOf(BACKTICK, index);
		if (start === -1) break;
		const end = text.indexOf(BACKTICK, start + 1);
		if (end === -1) break;
		refs.push(text.slice(start + 1, end));
		index = end + 1;
	}
	return refs;
}

function safeSize(repoRoot: string, repoPath: string): number | undefined {
	try {
		return statSync(join(repoRoot, repoPath)).size;
	} catch {
		return undefined;
	}
}

function readText(repoRoot: string, repoPath: string): string {
	try {
		return readFileSync(join(repoRoot, repoPath), "utf8");
	} catch {
		return "";
	}
}

function toRepoPath(path: string): string {
	return path
		.split(/[/\\]+/)
		.filter(Boolean)
		.join("/");
}
