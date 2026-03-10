import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import {
	type ExitClassification,
	type RunEventSeverity,
	type RunEventStatus,
	type RunEventType,
	type RunOutcome,
	appendCanonicalEvent,
	writeCanonicalManifest,
} from "./run-records.js";

type Primitive = string | number | boolean | null;

export interface RunRecordArtifactInput {
	type: string;
	path: string;
	checksum?: string;
}

export interface EmitTerminalRunRecordOptions {
	command: string;
	startedAt: string;
	finishedAt?: string;
	outcome: RunOutcome;
	classification: ExitClassification;
	exitCode: number;
	artifacts?: RunRecordArtifactInput[];
	preconditions?: Record<string, Primitive>;
	policyContext?: {
		mode?: string;
		safetyPosture?: string;
		effectivePolicySource?: string;
		hash?: string;
	};
	repo?: {
		repository?: string;
		branch?: string;
		headSha?: string;
		ancestryBaseSha?: string;
		ancestryVerified?: boolean;
	};
	contract?: {
		path?: string;
		hash?: string;
		version?: string;
	};
	event?: {
		eventType?: RunEventType;
		status?: RunEventStatus;
		severity?: RunEventSeverity;
		payload?: Record<string, unknown>;
		correlationId?: string;
	};
	runId?: string;
	baseDir?: string;
	scenarioId?: string;
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function canonicalizeValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalizeValue);
	}
	if (typeof value === "object" && value !== null) {
		return Object.keys(value)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = canonicalizeValue((value as Record<string, unknown>)[key]);
				return acc;
			}, {});
	}
	return value;
}

export function hashRunRecordValue(value: unknown): string {
	return sha256(JSON.stringify(canonicalizeValue(value)));
}

function makeRunId(command: string): string {
	const normalized = command
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const prefix = normalized.length > 0 ? normalized : "run";
	return `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function pathForManifest(pathLike: string, cwd: string): string {
	const absolute = resolve(cwd, pathLike);
	const rel = relative(cwd, absolute);
	if (!rel.startsWith("..") && rel.length > 0) {
		return rel;
	}
	return absolute;
}

function artifactChecksum(pathLike: string, cwd: string): string {
	const absolute = resolve(cwd, pathLike);
	if (existsSync(absolute)) {
		try {
			const content = readFileSync(absolute);
			return createHash("sha256").update(content).digest("hex");
		} catch {
			return sha256(`unreadable:${absolute}`);
		}
	}
	return sha256(`missing:${absolute}`);
}

function hashFileIfReadable(pathLike: string, cwd: string): string | null {
	const absolute = resolve(cwd, pathLike);
	if (!existsSync(absolute)) {
		return null;
	}
	try {
		const content = readFileSync(absolute);
		return createHash("sha256").update(content).digest("hex");
	} catch {
		return null;
	}
}

export function emitTerminalRunRecord(options: EmitTerminalRunRecordOptions): {
	runId: string;
	manifestPath: string;
	eventsPath: string;
} {
	const cwd = process.cwd();
	const resolvedBaseDir = options.baseDir
		? resolve(cwd, options.baseDir)
		: null;
	const canonicalCwd = (() => {
		try {
			return realpathSync(cwd);
		} catch {
			return cwd;
		}
	})();
	const runRecordCwd =
		resolvedBaseDir &&
		resolvedBaseDir !== canonicalCwd &&
		!resolvedBaseDir.startsWith(`${canonicalCwd}/`)
			? (() => {
					try {
						return realpathSync(dirname(resolvedBaseDir));
					} catch {
						return dirname(resolvedBaseDir);
					}
				})()
			: canonicalCwd;
	const normalizedBaseDir = (() => {
		if (!options.baseDir || !resolvedBaseDir) {
			return options.baseDir;
		}
		if (runRecordCwd === canonicalCwd) {
			return options.baseDir;
		}
		const directRelative = relative(runRecordCwd, resolvedBaseDir);
		if (!directRelative.startsWith("..")) {
			return directRelative.length > 0 ? directRelative : ".";
		}
		const canonicalBaseDir = resolve(runRecordCwd, basename(resolvedBaseDir));
		const relFromCwd = relative(runRecordCwd, canonicalBaseDir);
		if (!relFromCwd.startsWith("..")) {
			return relFromCwd.length > 0 ? relFromCwd : ".";
		}
		return canonicalBaseDir;
	})();
	const runId = options.runId ?? makeRunId(options.command);
	const startedAtDate = new Date(options.startedAt);
	const fallbackStart = Number.isNaN(startedAtDate.getTime())
		? new Date()
		: startedAtDate;
	const finishedAtDate = options.finishedAt
		? new Date(options.finishedAt)
		: new Date();
	const finished =
		Number.isNaN(finishedAtDate.getTime()) ||
		finishedAtDate.getTime() < fallbackStart.getTime()
			? fallbackStart
			: finishedAtDate;
	const started = fallbackStart;

	const contractPath = options.contract?.path ?? "harness.contract.json";
	const contractHash =
		options.contract?.hash ?? hashFileIfReadable(contractPath, cwd);
	if (!contractHash) {
		throw new Error(
			`Unable to determine canonical contract hash for ${contractPath}. Provide contract.hash or a readable contract.path.`,
		);
	}
	const policyMode = options.policyContext?.mode ?? "manual";
	const safetyPosture = options.policyContext?.safetyPosture ?? "strict";
	const effectivePolicySource =
		options.policyContext?.effectivePolicySource ??
		pathForManifest(contractPath, cwd);
	const processPolicyHash =
		options.policyContext?.hash ??
		hashFileIfReadable(effectivePolicySource, cwd);
	if (!processPolicyHash) {
		throw new Error(
			`Unable to determine process policy hash for ${effectivePolicySource}. Provide policyContext.hash or a readable effectivePolicySource.`,
		);
	}

	const repoHeadSha = options.repo?.headSha ?? "unknown";

	const artifacts = (options.artifacts ?? []).map((artifact) => {
		const path = pathForManifest(artifact.path, cwd);
		const checksum =
			artifact.checksum && /^[a-f0-9]{64}$/.test(artifact.checksum)
				? artifact.checksum
				: artifactChecksum(artifact.path, cwd);
		return {
			type: artifact.type,
			path,
			checksum,
		};
	});

	const manifestWrite = writeCanonicalManifest({
		...(normalizedBaseDir ? { baseDir: normalizedBaseDir } : {}),
		...(runRecordCwd !== canonicalCwd ? { cwd: runRecordCwd } : {}),
		manifest: {
			schemaVersion: "agent-run-manifest/v1",
			runId,
			command: options.command,
			...(options.scenarioId ? { scenarioId: options.scenarioId } : {}),
			startedAt: started.toISOString(),
			finishedAt: finished.toISOString(),
			durationMs: Math.max(0, finished.getTime() - started.getTime()),
			repo: {
				repository: options.repo?.repository ?? "unknown/unknown",
				branch: options.repo?.branch ?? "unknown",
				headSha: repoHeadSha,
				...(options.repo?.ancestryBaseSha
					? { ancestryBaseSha: options.repo.ancestryBaseSha }
					: {}),
				...(options.repo?.ancestryVerified !== undefined
					? { ancestryVerified: options.repo.ancestryVerified }
					: {}),
			},
			contract: {
				path: pathForManifest(contractPath, cwd),
				hash: contractHash,
				...(options.contract?.version
					? { version: options.contract.version }
					: {}),
			},
			policyContext: {
				mode: policyMode,
				safetyPosture,
				effectivePolicySource,
			},
			outcome: options.outcome,
			exit: {
				code: options.exitCode,
				classification: options.classification,
			},
			artifactRefs: artifacts,
			preconditions: options.preconditions ?? {},
			provenance: {
				repoContractHash: contractHash,
				processPolicyHash,
			},
		},
	});

	const eventWrite = appendCanonicalEvent({
		...(normalizedBaseDir ? { baseDir: normalizedBaseDir } : {}),
		...(runRecordCwd !== canonicalCwd ? { cwd: runRecordCwd } : {}),
		event: {
			schemaVersion: "agent-run-event/v1",
			runId,
			eventId: `evt-${randomUUID()}`,
			timestamp: finished.toISOString(),
			eventType: options.event?.eventType ?? "decision",
			status: options.event?.status ?? "completed",
			severity: options.event?.severity ?? "info",
			payload: {
				outcome: options.outcome,
				classification: options.classification,
				exitCode: options.exitCode,
				...(options.event?.payload ?? {}),
			},
			...(options.event?.correlationId
				? { correlationId: options.event.correlationId }
				: {}),
		},
	});

	return {
		runId,
		manifestPath: manifestWrite.path,
		eventsPath: eventWrite.path,
	};
}
