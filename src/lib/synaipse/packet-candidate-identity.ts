import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync,
	constants,
	fstatSync,
	openSync,
	readFileSync,
	readlinkSync,
} from "node:fs";
import { gitEnvironmentForRepoRoot } from "../runtime/git-environment.js";
import { hasUnsafeFileAncestor } from "./safe-file-ancestors.js";

/** Internally observed checkout and dirty-candidate identity. */
export interface PacketCandidateIdentity {
	checkoutHeadSha: string;
	candidateDigest: string;
	candidatePathCount: number;
}

const GIT_OBSERVATION_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/** Run one bounded Git observation while preserving raw output bytes. */
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
	const paths: Buffer[] = [];
	let start = 0;
	for (let index = 0; index < output.length; index += 1) {
		if (output[index] !== 0) continue;
		if (index > start) paths.push(output.subarray(start, index));
		start = index + 1;
	}
	return paths;
}

/** Return the sorted, byte-exact staged, unstaged, and untracked path set. */
function candidatePaths(repoRoot: string): Buffer[] {
	const unstaged = splitNul(
		gitBytes(repoRoot, ["diff", "--name-only", "--no-renames", "-z"]),
	);
	const staged = splitNul(
		gitBytes(repoRoot, [
			"diff",
			"--cached",
			"--name-only",
			"--no-renames",
			"-z",
			"HEAD",
		]),
	);
	const untracked = splitNul(
		gitBytes(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"]),
	);
	const unique = new Map(
		[...unstaged, ...staged, ...untracked].map((path) => [
			path.toString("hex"),
			path,
		]),
	);
	return [...unique.values()].sort(Buffer.compare);
}

/** Return the exact staged patch so index-only bytes and modes are bound. */
function stagedPatch(repoRoot: string): Buffer {
	return gitBytes(repoRoot, [
		"diff",
		"--cached",
		"--binary",
		"--full-index",
		"--no-renames",
		"HEAD",
	]);
}

/** Join a repository root and Git path without decoding the path bytes. */
function absolutePath(repoRoot: string, path: Buffer): Buffer {
	return Buffer.concat([Buffer.from(repoRoot), Buffer.from("/"), path]);
}

/** Return the stable Node filesystem error code when one is available. */
function fileErrorCode(error: unknown): unknown {
	return typeof error === "object" && error !== null && "code" in error
		? error.code
		: undefined;
}

/** Observe current worktree mode and bytes, distinguishing deletion and symlinks. */
function candidateEntry(
	repoRoot: string,
	path: Buffer,
): { mode: string; bytes: Buffer } {
	if (hasUnsafeFileAncestor(repoRoot, path))
		throw new TypeError(
			"packet candidate path has a symlinked or invalid ancestor",
		);
	const absolute = absolutePath(repoRoot, path);
	let descriptor: number;
	try {
		descriptor = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		const code = fileErrorCode(error);
		if (code === "ENOENT") {
			return { mode: "000000", bytes: Buffer.alloc(0) };
		}
		if (code === "ELOOP") {
			return { mode: "120000", bytes: readlinkSync(absolute, "buffer") };
		}
		throw error;
	}
	try {
		const stats = fstatSync(descriptor);
		if (!stats.isFile()) {
			throw new TypeError("packet candidate entry must be a file or symlink");
		}
		return {
			mode: (stats.mode & 0o111) === 0 ? "100644" : "100755",
			bytes: readFileSync(descriptor),
		};
	} finally {
		closeSync(descriptor);
	}
}

/** Encode one unsigned length for unambiguous binary framing. */
function lengthFrame(length: number): Buffer {
	const frame = Buffer.allocUnsafe(4);
	frame.writeUInt32BE(length);
	return frame;
}

/** Observe checkout HEAD and hash exact current path, mode, and content bytes. */
export function observePacketCandidateIdentity(
	repoRoot: string,
): PacketCandidateIdentity {
	const checkoutHeadSha = gitBytes(repoRoot, ["rev-parse", "--verify", "HEAD"])
		.toString("ascii")
		.trim();
	if (!/^[0-9a-f]{40}$/.test(checkoutHeadSha)) {
		throw new TypeError(
			"packet candidate checkout HEAD must be a full git SHA",
		);
	}
	const paths = candidatePaths(repoRoot);
	const indexPatch = stagedPatch(repoRoot);
	const digest = createHash("sha256")
		.update("packet-candidate-identity/v3\0")
		.update(Buffer.from(checkoutHeadSha, "ascii"))
		.update(lengthFrame(indexPatch.length))
		.update(indexPatch);
	for (const path of paths) {
		const entry = candidateEntry(repoRoot, path);
		digest
			.update(lengthFrame(path.length))
			.update(path)
			.update(Buffer.from(entry.mode, "ascii"))
			.update(lengthFrame(entry.bytes.length))
			.update(entry.bytes);
	}
	return {
		checkoutHeadSha,
		candidateDigest: `sha256:${digest.digest("hex")}`,
		candidatePathCount: paths.length,
	};
}
