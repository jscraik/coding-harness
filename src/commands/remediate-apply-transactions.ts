import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { validatePath } from "../lib/input/validator.js";
import type {
	CanonicalFinding,
	RemediationOutcome,
	RemediationTransaction,
} from "../lib/remediation/types.js";

interface ReplaceRangePatch {
	op: "replace_range";
	content: string;
	startLine?: number;
	endLine?: number;
}

type HeadShaProvider = () => string;

function safeFindingArtifactName(findingId: string): string {
	return findingId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
}

function buildArtifactUri(workspaceRoot: string, findingId: string): string {
	const artifactDir = join(workspaceRoot, "artifacts/remediation/transactions");
	mkdirSync(artifactDir, { recursive: true });
	return join(artifactDir, `${safeFindingArtifactName(findingId)}.json`);
}

function writeTransactionArtifact(
	artifactUri: string,
	payload: Omit<RemediationTransaction, "artifactChecksum">,
): RemediationTransaction {
	const artifactChecksum = createHash("sha256")
		.update(JSON.stringify(payload))
		.digest("hex");
	writeFileSync(
		artifactUri,
		JSON.stringify(
			{
				...payload,
				artifactChecksum,
				timestamp: new Date().toISOString(),
			},
			null,
			2,
		),
		"utf-8",
	);
	return {
		...payload,
		artifactChecksum,
	};
}

function parsePatchFromEvidence(
	finding: CanonicalFinding,
): { ok: true; patch: ReplaceRangePatch } | { ok: false; reason: string } {
	if (!finding.evidence) {
		return {
			ok: false,
			reason:
				'No patch payload in finding evidence. Include evidence as JSON: {"op":"replace_range","content":"..."}',
		};
	}

	const raw = finding.evidence.startsWith("harness_patch:")
		? finding.evidence.slice("harness_patch:".length).trim()
		: finding.evidence.trim();

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		return {
			ok: false,
			reason: `Patch payload parse error: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	if (typeof parsed !== "object" || parsed === null) {
		return { ok: false, reason: "Patch payload must be a JSON object" };
	}

	const value = parsed as Record<string, unknown>;
	if (value.op !== "replace_range") {
		return { ok: false, reason: 'Patch payload op must be "replace_range"' };
	}
	if (typeof value.content !== "string") {
		return { ok: false, reason: "Patch payload content must be a string" };
	}

	const startLine =
		typeof value.startLine === "number" ? value.startLine : undefined;
	const endLine = typeof value.endLine === "number" ? value.endLine : undefined;
	if (
		(startLine !== undefined &&
			(!Number.isInteger(startLine) || startLine < 1)) ||
		(endLine !== undefined && (!Number.isInteger(endLine) || endLine < 1))
	) {
		return {
			ok: false,
			reason: "Patch startLine/endLine must be positive integers",
		};
	}
	if (startLine !== undefined && endLine !== undefined && endLine < startLine) {
		return { ok: false, reason: "Patch endLine cannot be less than startLine" };
	}

	return {
		ok: true,
		patch: {
			op: "replace_range",
			content: value.content,
			...(startLine !== undefined ? { startLine } : {}),
			...(endLine !== undefined ? { endLine } : {}),
		},
	};
}

function applyReplaceRange(
	originalContent: string,
	startLine: number,
	endLine: number,
	replacement: string,
): string {
	const lines = originalContent.split("\n");
	const startIdx = startLine - 1;
	const endIdx = endLine - 1;
	if (startIdx < 0 || endIdx >= lines.length || startIdx > endIdx) {
		throw new Error(
			`Patch range [${startLine}, ${endLine}] is out of bounds for ${lines.length} line(s)`,
		);
	}
	const replacementLines = replacement.split("\n");
	return [
		...lines.slice(0, startIdx),
		...replacementLines,
		...lines.slice(endIdx + 1),
	].join("\n");
}

function buildUnknownFindingTransaction(
	actionFindingId: string,
	workspaceRoot: string,
	getHeadSha: HeadShaProvider,
): RemediationTransaction {
	const preSha = getHeadSha();
	const artifactUri = buildArtifactUri(workspaceRoot, actionFindingId);
	return writeTransactionArtifact(artifactUri, {
		findingId: actionFindingId,
		status: "rolled_back",
		reason:
			"Remediation action referenced an unknown finding id; no patch applied",
		preSha,
		postSha: preSha,
		artifactUri,
	});
}

/** Apply one canonical finding transaction and write its remediation artifact. */
function applyFindingTransaction(
	finding: CanonicalFinding,
	workspaceRoot: string,
	getHeadSha: HeadShaProvider,
): RemediationTransaction {
	const preSha = getHeadSha();
	const artifactUri = buildArtifactUri(workspaceRoot, finding.id);
	const patchResult = parsePatchFromEvidence(finding);
	if (!patchResult.ok) {
		return writeTransactionArtifact(artifactUri, {
			findingId: finding.id,
			status: "skipped",
			reason: patchResult.reason,
			preSha,
			postSha: preSha,
			artifactUri,
		});
	}

	const targetPath = join(
		workspaceRoot,
		validatePath(workspaceRoot, finding.filePath),
	);
	const transactionId = `${process.pid}.${randomUUID()}`;
	const backupPath = `${targetPath}.harness-bak.${transactionId}`;
	const tempPath = `${targetPath}.harness-tmp.${transactionId}`;

	try {
		const originalContent = readFileSync(targetPath, "utf-8");
		writeFileSync(backupPath, originalContent, {
			encoding: "utf-8",
			flag: "wx",
		});
		const startLine = patchResult.patch.startLine ?? finding.lineStart;
		const endLine =
			patchResult.patch.endLine ??
			(finding.lineEnd !== undefined ? finding.lineEnd : finding.lineStart);
		const updatedContent = applyReplaceRange(
			originalContent,
			startLine,
			endLine,
			patchResult.patch.content,
		);
		writeFileSync(tempPath, updatedContent, { encoding: "utf-8", flag: "wx" });
		const currentContent = readFileSync(targetPath, "utf-8");
		if (currentContent !== originalContent) {
			unlinkSync(backupPath);
			unlinkSync(tempPath);
			return writeTransactionArtifact(artifactUri, {
				findingId: finding.id,
				status: "rolled_back",
				reason:
					"Target file changed during apply transaction; patch rolled back for safety",
				preSha,
				postSha: preSha,
				artifactUri,
			});
		}
		renameSync(tempPath, targetPath);

		const postSha = getHeadSha();
		if (postSha !== preSha) {
			writeFileSync(targetPath, originalContent, "utf-8");
			unlinkSync(backupPath);
			return writeTransactionArtifact(artifactUri, {
				findingId: finding.id,
				status: "rolled_back",
				reason:
					"HEAD changed during apply transaction; patch rolled back for safety",
				preSha,
				postSha,
				artifactUri,
			});
		}

		unlinkSync(backupPath);
		return writeTransactionArtifact(artifactUri, {
			findingId: finding.id,
			status: "applied",
			reason: "Applied low-risk patch in single-finding transaction",
			preSha,
			postSha,
			artifactUri,
		});
	} catch (error) {
		let postSha = preSha;
		try {
			postSha = getHeadSha();
		} catch {
			postSha = preSha;
		}

		try {
			if (existsSync(backupPath)) {
				const originalContent = readFileSync(backupPath, "utf-8");
				writeFileSync(targetPath, originalContent, "utf-8");
				unlinkSync(backupPath);
			}
		} catch {
			// Best effort rollback only.
		}

		return writeTransactionArtifact(artifactUri, {
			findingId: finding.id,
			status: "rolled_back",
			reason: `Patch apply failed and was rolled back: ${
				error instanceof Error ? error.message : String(error)
			}`,
			preSha,
			postSha,
			artifactUri,
		});
	}
}

/**
 * Apply generated low-risk commit actions as bounded single-finding transactions.
 *
 * @param outcome - Successful remediation outcome to augment
 * @param findings - Canonical findings used during remediation
 * @param workspaceRoot - Workspace root for file operations
 * @param getHeadSha - SHA provider for deterministic transaction metadata
 */
export function applyRemediationTransactions(
	outcome: Extract<RemediationOutcome, { ok: true }>,
	findings: CanonicalFinding[],
	workspaceRoot: string,
	getHeadSha: HeadShaProvider,
): void {
	const findingById = new Map(findings.map((finding) => [finding.id, finding]));
	const transactions: RemediationTransaction[] = [];

	for (const action of outcome.output.actions) {
		if (action.type !== "commit" || action.dryRun) {
			continue;
		}
		const finding = findingById.get(action.findingId);
		if (!finding) {
			transactions.push(
				buildUnknownFindingTransaction(
					action.findingId,
					workspaceRoot,
					getHeadSha,
				),
			);
			continue;
		}
		transactions.push(
			applyFindingTransaction(finding, workspaceRoot, getHeadSha),
		);
	}

	outcome.output.transactions = transactions;
}
