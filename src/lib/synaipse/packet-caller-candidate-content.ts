import { execFileSync } from "node:child_process";
import {
	closeSync,
	constants,
	fstatSync,
	openSync,
	readFileSync,
} from "node:fs";
import { TextDecoder } from "node:util";
import { gitEnvironmentForRepoRoot } from "../runtime/git-environment.js";

const GIT_OBSERVATION_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const UTF8_PATH_DECODER = new TextDecoder("utf-8", { fatal: true });

/** One repository path and every indexed/worktree byte source bound by its candidate digest. */
export interface PacketCallerCandidateSource {
	path: string;
	contents: Buffer[];
}

/** Run one bounded Git observation while preserving path and blob bytes. */
function gitBytes(repoRoot: string, args: string[]): Buffer {
	return execFileSync("git", args, {
		cwd: repoRoot,
		env: gitEnvironmentForRepoRoot(),
		encoding: "buffer",
		maxBuffer: GIT_OBSERVATION_MAX_BUFFER_BYTES,
		stdio: ["ignore", "pipe", "ignore"],
		timeout: 10_000,
	});
}

/** Split NUL-delimited Git output without decoding filesystem path bytes. */
function splitNul(output: Buffer): Buffer[] {
	const values: Buffer[] = [];
	let start = 0;
	for (let index = 0; index < output.length; index += 1) {
		if (output[index] !== 0) continue;
		if (index > start) values.push(output.subarray(start, index));
		start = index + 1;
	}
	return values;
}

/** List tracked and untracked non-ignored candidate paths in stable byte order. */
function candidatePaths(repoRoot: string): Buffer[] {
	return splitNul(
		gitBytes(repoRoot, [
			"ls-files",
			"--cached",
			"--others",
			"--exclude-standard",
			"-z",
		]),
	).sort(Buffer.compare);
}

interface IndexEntry {
	mode: string;
	objectId: string;
}

/** Map byte-exact stage-zero paths to their indexed blob identity and mode. */
function indexedEntries(repoRoot: string): Map<string, IndexEntry> {
	const entries = new Map<string, IndexEntry>();
	for (const record of splitNul(
		gitBytes(repoRoot, ["ls-files", "--stage", "-z"]),
	)) {
		const separator = record.indexOf(0x09);
		if (separator < 0) throw new TypeError("invalid git index entry");
		const [mode, objectId, stage] = record
			.subarray(0, separator)
			.toString("ascii")
			.split(" ");
		if (!mode || !/^[0-9a-f]{40}$/.test(objectId ?? "") || stage !== "0")
			throw new TypeError("invalid stage-zero git index entry");
		entries.set(record.subarray(separator + 1).toString("hex"), {
			mode,
			objectId: objectId ?? "",
		});
	}
	return entries;
}

/** Return the stable Node filesystem error code when one is available. */
function fileErrorCode(error: unknown): unknown {
	return typeof error === "object" && error !== null && "code" in error
		? error.code
		: undefined;
}

/** Join a repository root and byte-exact Git path without decoding it. */
function absolutePath(repoRoot: string, path: Buffer): Buffer {
	return Buffer.concat([Buffer.from(repoRoot), Buffer.from("/"), path]);
}

/** Read a regular worktree file through one no-follow descriptor. */
function worktreeBytes(repoRoot: string, path: Buffer): Buffer | null {
	let descriptor: number;
	try {
		descriptor = openSync(
			absolutePath(repoRoot, path),
			constants.O_RDONLY | constants.O_NOFOLLOW,
		);
	} catch (error) {
		const code = fileErrorCode(error);
		if (code === "ENOENT" || code === "ELOOP") return null;
		throw error;
	}
	try {
		if (!fstatSync(descriptor).isFile()) return null;
		return readFileSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

/** Read every candidate byte source bound by the staged/worktree digest. */
function candidateContents(
	repoRoot: string,
	path: Buffer,
	index: Map<string, IndexEntry>,
	stagedPaths: Set<string>,
): Buffer[] {
	const contents: Buffer[] = [];
	const key = path.toString("hex");
	const entry = index.get(key);
	if (stagedPaths.has(key) && entry && entry.mode !== "120000") {
		if (entry.mode !== "100644" && entry.mode !== "100755")
			throw new TypeError("packet caller index entry must be a regular file");
		contents.push(gitBytes(repoRoot, ["cat-file", "blob", entry.objectId]));
	}
	const worktree = worktreeBytes(repoRoot, path);
	if (worktree && !contents.some((content) => content.equals(worktree)))
		contents.push(worktree);
	return contents;
}

/** Read byte-exact repository candidates and fail closed on unrepresentable public paths. */
export function packetCallerCandidateSources(
	repoRoot: string,
): PacketCallerCandidateSource[] {
	const index = indexedEntries(repoRoot);
	const stagedPaths = new Set(
		splitNul(
			gitBytes(repoRoot, [
				"diff",
				"--cached",
				"--name-only",
				"--no-renames",
				"-z",
				"HEAD",
			]),
		).map((path) => path.toString("hex")),
	);
	return candidatePaths(repoRoot).map((rawPath) => {
		let path: string;
		try {
			path = UTF8_PATH_DECODER.decode(rawPath);
		} catch {
			throw new TypeError(
				"packet caller inventory cannot represent a non-UTF-8 repository path",
			);
		}
		return {
			path,
			contents: candidateContents(repoRoot, rawPath, index, stagedPaths),
		};
	});
}
