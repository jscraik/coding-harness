import { mkdir, rmdir, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
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
		parentRelative.startsWith("/") ||
		parentRelative.includes("../")
	) {
		return { ok: false, reason: "artifact parent is outside repo scope" };
	}
	return { ok: true, artifactPath: resolvedArtifact, parentDir };
}

async function parentExists(parentDir: string): Promise<boolean> {
	try {
		return (await stat(parentDir)).isDirectory();
	} catch {
		return false;
	}
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
	if (await parentExists(resolved.parentDir)) {
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
	await mkdir(resolved.parentDir, { recursive: true });
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
	return {
		ok: await parentExists(resolved.parentDir),
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
	try {
		await rmdir(resolved.parentDir);
		return {
			ok: true,
			status: "stopped",
			evidenceRefs: ["recovery:artifact-parent:rollback-removed"],
		};
	} catch {
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
