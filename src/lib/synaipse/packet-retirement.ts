import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { gitEnvironmentForRepoRoot } from "../runtime/git-environment.js";
import {
	discoverPacketCallerInventory,
	type PacketCallerInventory,
} from "./packet-caller-inventory.js";
import {
	MANAGED_CONSUMERS,
	MANAGED_PROJECTION_TARGETS,
} from "./packet-consolidation-contract.js";

/** Evidence classes required before compatibility deletion can be authorized. */
export const RETIREMENT_EVIDENCE_KINDS = [
	"caller_inventory",
	"source_schema_type",
	"package_canary",
	"downstream_canary",
	"outcome_eval",
	"rollback",
	"independent_qa",
	"command_catalog",
] as const;

/** Required evidence class for one immutable retirement proof. */
export type RetirementEvidenceKind = (typeof RETIREMENT_EVIDENCE_KINDS)[number];

/** Candidate-SHA-bound immutable evidence reference. */
export interface RetirementEvidenceRef {
	kind: RetirementEvidenceKind;
	candidateSha: string;
	ref: string;
	artifactPath: string;
}

/** Inputs that must reconcile before compatibility deletion is authorized. */
export interface PacketRetirementInput {
	repoRoot: string;
	evidenceRoot: string;
	candidateSha: string;
	callerInventory: PacketCallerInventory;
	canonicalProjectionTargets: string[];
	evidence: RetirementEvidenceRef[];
}

/** Fail closed until repository-owned evidence verifiers can authorize deletion. */
export function canRetireLegacyPacket(input: PacketRetirementInput) {
	const structuralReason = structuralRetirementBlocker(input);
	if (structuralReason) return { canRetire: false, reason: structuralReason };
	const checkoutReason = checkoutRetirementBlocker(input);
	if (checkoutReason) return { canRetire: false, reason: checkoutReason };
	const evidenceReason = evidenceRetirementBlocker(input);
	if (evidenceReason) return { canRetire: false, reason: evidenceReason };
	return {
		canRetire: false,
		reason: "retirement_evidence_verifier_unavailable",
	};
}

/** Reject incomplete caller, projection, or evidence inventories. */
function structuralRetirementBlocker(input: PacketRetirementInput) {
	const blockers = [
		[!isFullGitSha(input.candidateSha), "candidate_sha_invalid"],
		[
			input.callerInventory.candidateSha !== input.candidateSha,
			"caller_inventory_sha_mismatch",
		],
		[
			input.callerInventory.unknownConsumers.length > 0,
			"unknown_consumers_present",
		],
		[
			input.callerInventory.runtimeConsumers.length === 0,
			"consumer_inventory_missing",
		],
		[
			input.callerInventory.missingManagedConsumers.length > 0,
			"consumer_inventory_incomplete",
		],
		[
			!hasExactStringSet(
				input.callerInventory.runtimeConsumers,
				MANAGED_CONSUMERS,
			),
			"consumer_inventory_mismatch",
		],
		[
			input.canonicalProjectionTargets.length === 0,
			"canonical_projection_missing",
		],
		[
			!hasExactStringSet(
				input.canonicalProjectionTargets,
				MANAGED_PROJECTION_TARGETS,
			),
			"canonical_projection_mismatch",
		],
		[
			input.evidence.some(
				(evidence) => evidence.candidateSha !== input.candidateSha,
			),
			"retirement_evidence_sha_mismatch",
		],
		[
			input.evidence.some((evidence) => !isImmutableEvidenceRef(evidence.ref)),
			"retirement_evidence_ref_not_immutable",
		],
		[
			!hasExactStringSet(
				input.evidence.map((evidence) => evidence.kind),
				RETIREMENT_EVIDENCE_KINDS,
			),
			"retirement_evidence_incomplete",
		],
	] as const;
	return blockers.find(([blocked]) => blocked)?.[1];
}

/** Reconcile the immutable commit and mechanically rediscovered callers. */
function checkoutRetirementBlocker(input: PacketRetirementInput) {
	const checkoutSha = gitOutput(input.repoRoot, ["rev-parse", "HEAD"]);
	if (checkoutSha !== input.candidateSha)
		return "candidate_checkout_sha_mismatch";
	if (
		gitOutput(input.repoRoot, [
			"status",
			"--porcelain=v1",
			"--untracked-files=all",
		]).length > 0
	) {
		return "candidate_checkout_dirty";
	}
	const discoveredInventory = discoverPacketCallerInventory(
		input.repoRoot,
		input.candidateSha,
	);
	if (
		JSON.stringify(discoveredInventory) !==
		JSON.stringify(input.callerInventory)
	) {
		return "caller_inventory_not_mechanical";
	}
	return undefined;
}

/** Verify every required evidence artifact against its content address. */
function evidenceRetirementBlocker(input: PacketRetirementInput) {
	for (const evidence of input.evidence) {
		const verified = verifyEvidenceArtifact(evidence, input.evidenceRoot);
		if (!verified.valid) return verified.reason;
	}
	return undefined;
}

/** Read one git fact without inheriting caller-specific repository variables. */
function gitOutput(repoRoot: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: repoRoot,
		env: gitEnvironmentForRepoRoot(),
		encoding: "utf8",
	}).trim();
}

/** Verify content address, evidence identity, candidate binding, and pass outcome. */
function verifyEvidenceArtifact(
	evidence: RetirementEvidenceRef,
	evidenceRoot: string,
): { valid: true } | { valid: false; reason: string } {
	const bytesResult = readEvidenceBytes(evidence.artifactPath, evidenceRoot);
	if (!bytesResult.valid) return bytesResult;
	const digest = createHash("sha256").update(bytesResult.bytes).digest("hex");
	if (evidence.ref !== `sha256:${digest}#${evidence.kind}`) {
		return { valid: false, reason: "retirement_evidence_digest_mismatch" };
	}
	const document = parseEvidenceDocument(bytesResult.bytes);
	if (document === undefined) {
		return { valid: false, reason: "retirement_evidence_document_invalid" };
	}
	const documentReason = evidenceDocumentBlocker(document, evidence);
	return documentReason
		? { valid: false, reason: documentReason }
		: { valid: true };
}

/** Resolve one bounded, non-symlink evidence file and return its exact bytes. */
function readEvidenceBytes(
	artifactPath: string,
	evidenceRoot: string,
):
	| { valid: true; bytes: Buffer }
	| { valid: false; reason: "retirement_evidence_path_invalid" } {
	const root = resolve(evidenceRoot);
	const artifact = resolve(root, artifactPath);
	const relativePath = relative(root, artifact);
	if (
		relativePath.length === 0 ||
		relativePath.startsWith("..") ||
		isAbsolute(relativePath)
	) {
		return { valid: false, reason: "retirement_evidence_path_invalid" };
	}
	let bytes: Buffer;
	try {
		if (lstatSync(artifact).isSymbolicLink()) {
			return { valid: false, reason: "retirement_evidence_path_invalid" };
		}
		bytes = readFileSync(artifact);
	} catch {
		return { valid: false, reason: "retirement_evidence_path_invalid" };
	}
	return { valid: true, bytes };
}

/** Parse evidence JSON without allowing parser failures to escape the predicate. */
function parseEvidenceDocument(bytes: Buffer): unknown | undefined {
	try {
		return JSON.parse(bytes.toString("utf8"));
	} catch {
		return undefined;
	}
}

/** Check evidence identity, candidate binding, references, and pass outcome. */
function evidenceDocumentBlocker(
	document: unknown,
	evidence: RetirementEvidenceRef,
): string | undefined {
	if (
		typeof document !== "object" ||
		document === null ||
		Reflect.get(document, "evidenceKind") !== evidence.kind ||
		Reflect.get(document, "candidateSha") !== evidence.candidateSha ||
		!Array.isArray(Reflect.get(document, "evidenceRefs")) ||
		Reflect.get(document, "evidenceRefs").length === 0
	) {
		return "retirement_evidence_document_invalid";
	}
	if (Reflect.get(document, "outcome") !== "pass") {
		return "retirement_evidence_outcome_not_pass";
	}
	return undefined;
}

/** Reconcile an observed string list against one exact, duplicate-free set. */
function hasExactStringSet(
	observed: readonly string[],
	expected: readonly string[],
): boolean {
	if (observed.length !== expected.length) return false;
	const observedSet = new Set(observed);
	return (
		observedSet.size === observed.length &&
		expected.every((item) => observedSet.has(item))
	);
}

/** Validate the full lowercase SHA required at the retirement boundary. */
function isFullGitSha(value: string): boolean {
	return (
		value.length === 40 &&
		[...value].every((char) => "0123456789abcdef".includes(char))
	);
}

/** Require a content-addressed evidence reference instead of a mutable path. */
function isImmutableEvidenceRef(value: string): boolean {
	const [digest, fragment] = value.split("#", 2);
	if (!digest?.startsWith("sha256:")) return false;
	const hash = digest.slice("sha256:".length);
	if (
		hash.length !== 64 ||
		![...hash].every((char) => "0123456789abcdef".includes(char))
	)
		return false;
	return fragment === undefined || fragment.trim().length > 0;
}
