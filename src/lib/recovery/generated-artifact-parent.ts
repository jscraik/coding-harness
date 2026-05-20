import { lstat, mkdir, rmdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type {
	RecoveryContext,
	RecoveryHandlerContract,
	RecoveryHookResult,
	RecoveryResult,
} from "./contract.js";

function artifactPathFrom(context: RecoveryContext): string | null {
	const value = context.details?.artifactPath;
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveParent(
	context: RecoveryContext,
):
	| { ok: true; artifactPath: string; parentDir: string }
	| { ok: false; reason: string } {
	const artifactPath = artifactPathFrom(context);
	if (!artifactPath) {
		return { ok: false, reason: "artifactPath detail is required" };
	}
	const repoRoot = resolve(context.repoRoot);
	const resolvedArtifact = resolve(repoRoot, artifactPath);
	const parentDir = dirname(resolvedArtifact);
	const parentRelative = relative(repoRoot, parentDir);
	if (
		parentRelative === "" ||
		parentRelative.startsWith("..") ||
		isAbsolute(parentRelative) ||
		parentRelative.includes("../")
	) {
		return { ok: false, reason: "artifact parent is outside repo scope" };
	}
	return { ok: true, artifactPath: resolvedArtifact, parentDir };
}

type ParentInspection =
	| { ok: true; exists: boolean }
	| { ok: false; reason: string; evidenceRefs: string[] };

async function inspectParent(parentDir: string): Promise<ParentInspection> {
	try {
		return { ok: true, exists: (await stat(parentDir)).isDirectory() };
	} catch (error) {
		if (errorCode(error) === "ENOENT") {
			return { ok: true, exists: false };
		}
		return {
			ok: false,
			reason: `artifact parent could not be inspected: ${errorCode(error) ?? "unknown"}: ${errorMessage(error)}`,
			evidenceRefs: ["recovery:artifact-parent:inspect-failed"],
		};
	}
}

async function hasSymlinkAncestor(
	repoRoot: string,
	parentDir: string,
): Promise<boolean> {
	const parentRelative = relative(repoRoot, parentDir);
	let current = repoRoot;
	for (const part of parentRelative.split(/[\\/]+/u)) {
		if (!part) continue;
		current = resolve(current, part);
		try {
			if ((await lstat(current)).isSymbolicLink()) return true;
		} catch (error) {
			const code = errorCode(error);
			if (code === "ENOENT" || code === "ENOTDIR") break;
			return true;
		}
	}
	return false;
}

function errorCode(error: unknown): string | null {
	return typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
		? error.code
		: null;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function verifyBefore(
	context: RecoveryContext,
): Promise<RecoveryHookResult> {
	const resolved = resolveParent(context);
	if (!resolved.ok) {
		return {
			ok: false,
			reason: resolved.reason,
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	if (await hasSymlinkAncestor(context.repoRoot, resolved.parentDir)) {
		return {
			ok: false,
			reason: "artifact parent traverses a symlink",
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	const parent = await inspectParent(resolved.parentDir);
	if (!parent.ok) {
		return {
			ok: false,
			reason: parent.reason,
			evidenceRefs: parent.evidenceRefs,
		};
	}
	if (parent.exists) {
		return {
			ok: false,
			reason: "artifact parent already exists",
			evidenceRefs: ["recovery:artifact-parent:already-exists"],
		};
	}
	return {
		ok: true,
		evidenceRefs: ["recovery:artifact-parent:missing"],
	};
}

async function recover(context: RecoveryContext): Promise<RecoveryResult> {
	const before = await verifyBefore(context);
	if (!before.ok) {
		return {
			ok: false,
			status: "denied",
			reason: before.reason ?? "recovery precondition failed",
			evidenceRefs: before.evidenceRefs,
		};
	}
	const resolved = resolveParent(context);
	if (!resolved.ok) {
		return {
			ok: false,
			status: "denied",
			reason: resolved.reason,
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	if (await hasSymlinkAncestor(context.repoRoot, resolved.parentDir)) {
		return {
			ok: false,
			status: "denied",
			reason: "artifact parent traverses a symlink",
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	try {
		await mkdir(resolved.parentDir, { recursive: true });
	} catch (error) {
		return {
			ok: false,
			status: "failed",
			reason: `artifact parent creation failed: ${errorCode(error) ?? "unknown"}: ${errorMessage(error)}`,
			evidenceRefs: ["recovery:artifact-parent:create-failed"],
		};
	}
	return {
		ok: true,
		status: "recovered",
		evidenceRefs: ["recovery:artifact-parent:created"],
	};
}

async function verifyAfter(
	context: RecoveryContext,
): Promise<RecoveryHookResult> {
	const resolved = resolveParent(context);
	if (!resolved.ok) {
		return {
			ok: false,
			reason: resolved.reason,
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	if (await hasSymlinkAncestor(context.repoRoot, resolved.parentDir)) {
		return {
			ok: false,
			reason: "artifact parent traverses a symlink",
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	const parent = await inspectParent(resolved.parentDir);
	if (!parent.ok) {
		return {
			ok: false,
			reason: parent.reason,
			evidenceRefs: parent.evidenceRefs,
		};
	}
	return {
		ok: parent.exists,
		evidenceRefs: ["recovery:artifact-parent:verified"],
	};
}

async function rollback(context: RecoveryContext): Promise<RecoveryResult> {
	const resolved = resolveParent(context);
	if (!resolved.ok) {
		return {
			ok: false,
			status: "denied",
			reason: resolved.reason,
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	if (await hasSymlinkAncestor(context.repoRoot, resolved.parentDir)) {
		return {
			ok: false,
			status: "denied",
			reason: "artifact parent traverses a symlink",
			evidenceRefs: ["recovery:artifact-parent:path-denied"],
		};
	}
	try {
		await rmdir(resolved.parentDir);
		return {
			ok: true,
			status: "stopped",
			evidenceRefs: ["recovery:artifact-parent:rollback-removed"],
		};
	} catch (error) {
		const code = errorCode(error);
		if (code !== "ENOTEMPTY" && code !== "EEXIST") {
			return {
				ok: false,
				status: "failed",
				reason: `artifact parent rollback failed: ${code ?? "unknown"}: ${errorMessage(error)}`,
				evidenceRefs: ["recovery:artifact-parent:rollback-failed"],
			};
		}
		return {
			ok: false,
			status: "stopped",
			reason: "artifact parent rollback skipped because directory is not empty",
			evidenceRefs: ["recovery:artifact-parent:rollback-skipped"],
		};
	}
}

/** Create the first safe deterministic recovery handler. */
export function createGeneratedArtifactParentHandler(): RecoveryHandlerContract {
	return {
		id: "missing-generated-artifact-parent",
		trigger: (context) =>
			context.failure.includes("ENOENT") &&
			context.failure.includes("parent directory"),
		authority: {
			scope: "local_filesystem",
			mutatesState: true,
			requiresSecret: false,
			mutationAuthorityRef: "repo-workspace-write",
		},
		verifyBefore,
		recover,
		verifyAfter,
		rollback,
		stopCondition: () => true,
		traceFields: [
			"handler.id",
			"authority.scope",
			"artifactPath",
			"verifyBefore.evidenceRefs",
			"recover.evidenceRefs",
			"verifyAfter.evidenceRefs",
			"rollback.evidenceRefs",
		],
		retirementCondition:
			"Retire when generated artifact writers create parent directories before writing artifacts.",
	};
}
