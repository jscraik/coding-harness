import type { NorthStarDecisionQuestion } from "../contract/types.js";

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuestionText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\w\s/-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function hasEvidenceReference(text: string): boolean {
	const evidencePatterns = [
		/\[[^\]]+\]\([^)]+\)/i,
		/https?:\/\/\S+/i,
		/(?:^|[\s([])(?:\/|\.\.?\/)?(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+:[0-9]+(?:$|[\s),.;\]])/i,
		/(?:^|[\s([])(?:\/|\.\.?\/)?[A-Za-z._-][A-Za-z0-9._-]*:[0-9]+(?:$|[\s),.;\]])/i,
		/artifacts\/[A-Za-z0-9._/-]+/i,
	];
	return evidencePatterns.some((pattern) => pattern.test(text));
}

function getStructuredListIndent(line: string): number | undefined {
	const match = line.match(/^(\s*)(?:[-*+](?:\s+\[[xX ]\])?|\d+[.)])\s+/);
	if (!match) {
		return undefined;
	}
	return match[1]?.length ?? 0;
}

function extractQuestionResponseBlock(
	rawBody: string,
	question: NorthStarDecisionQuestion,
): string {
	const lines = rawBody.split(/\r?\n/);
	const questionPrompt = normalizeQuestionText(question.prompt);
	const idPattern = new RegExp(`\\b${escapeRegExp(question.id)}\\b`, "i");
	const collected: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const normalizedLine = normalizeQuestionText(line);
		if (!idPattern.test(line) && !normalizedLine.includes(questionPrompt)) {
			continue;
		}
		const startListIndent =
			getStructuredListIndent(line) ?? line.match(/^\s*/)?.[0].length ?? 0;
		collected.push(line);
		for (let next = index + 1; next < lines.length; next += 1) {
			const continuation = lines[next] ?? "";
			const continuationListIndent = getStructuredListIndent(continuation);
			if (continuation.trim().length === 0) {
				collected.push(continuation);
				continue;
			}
			if (
				continuationListIndent !== undefined &&
				continuationListIndent <= startListIndent
			) {
				break;
			}
			collected.push(continuation);
		}
	}

	return collected.join("\n");
}

function hasExplicitNegativeAnswer(responseBlock: string): boolean {
	for (const line of responseBlock.split(/\r?\n/)) {
		const trimmedLine = line.trim();
		if (trimmedLine.length === 0) {
			continue;
		}
		const leadingToken = normalizeQuestionText(trimmedLine).split(" ")[0];
		if (leadingToken === "no" || leadingToken === "false") {
			return true;
		}
		const separatorIndex = trimmedLine.indexOf(":");
		const answerCandidate =
			separatorIndex === -1
				? trimmedLine
				: trimmedLine.slice(separatorIndex + 1).trim();
		const answerToken = normalizeQuestionText(answerCandidate).split(" ")[0];
		if (answerToken === "no" || answerToken === "false") {
			return true;
		}
	}
	return false;
}

function hasNoImpactDeclaration(responseBlock: string): boolean {
	const normalizedBlock = normalizeQuestionText(responseBlock);
	if (normalizedBlock.includes("metric_impact_declared none")) {
		return true;
	}
	if (normalizedBlock.includes("metric impact declared none")) {
		return true;
	}
	return normalizedBlock.includes("no direct metric impact");
}

function hasPositivePolicySurfaceDelta(responseBlock: string): boolean {
	const match = responseBlock.match(
		/policy[_\s-]*surface[_\s-]*delta\s*:?\s*([+-]?\d+(?:\.\d+)?)/i,
	);
	if (!match) {
		return false;
	}
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Evaluate PR decision-question evidence and return review-gate blockers.
 */
export function evaluateNorthStarDecisionQuestions(params: {
	prBody?: string | null | undefined;
	decisionQuestions: NorthStarDecisionQuestion[];
	requireQuestions?: boolean;
}): string[] {
	if (params.decisionQuestions.length === 0) {
		return params.requireQuestions
			? [
					"contract_invalid:contract-missing-questions: Canonical north-star contracts must declare at least one decision question.",
				]
			: [];
	}

	const rawBody = params.prBody ?? "";
	const normalizedBody = normalizeQuestionText(rawBody);
	const missingQuestionIds: string[] = [];
	const questionIdsMissingEvidence: string[] = [];
	const questionIdsWithNegativeAnswer: string[] = [];
	for (const question of params.decisionQuestions) {
		const idPattern = new RegExp(`\\b${escapeRegExp(question.id)}\\b`, "i");
		const hasIdReference = idPattern.test(rawBody);
		const hasPromptReference = normalizedBody.includes(
			normalizeQuestionText(question.prompt),
		);
		if (!hasIdReference && !hasPromptReference) {
			missingQuestionIds.push(question.id);
			continue;
		}
		const responseBlock = extractQuestionResponseBlock(rawBody, question);
		if (!hasEvidenceReference(responseBlock)) {
			questionIdsMissingEvidence.push(question.id);
		}
		if (
			hasExplicitNegativeAnswer(responseBlock) &&
			!(
				hasNoImpactDeclaration(responseBlock) &&
				!hasPositivePolicySurfaceDelta(responseBlock)
			)
		) {
			questionIdsWithNegativeAnswer.push(question.id);
		}
	}

	const blockers: string[] = [];
	if (missingQuestionIds.length > 0) {
		const findingId = `missing-${[...missingQuestionIds].sort().join(",")}`;
		blockers.push(
			`review_evidence_incomplete:${findingId}: North-star decision questions missing from PR context: ${missingQuestionIds.join(", ")}`,
		);
	}
	if (questionIdsMissingEvidence.length > 0) {
		const findingId = `evidence-${[...questionIdsMissingEvidence].sort().join(",")}`;
		blockers.push(
			`review_evidence_incomplete:${findingId}: North-star decision responses must include evidence references for each question (URL, artifact path, or file:line link); missing evidence for: ${questionIdsMissingEvidence.join(", ")}`,
		);
	}
	if (questionIdsWithNegativeAnswer.length > 0) {
		const findingId = `negative-${[...questionIdsWithNegativeAnswer].sort().join(",")}`;
		blockers.push(
			`safety_floor_violation:${findingId}: North-star decision responses contradict throughput intent unless explicitly declared as no-impact (metric_impact_declared:none with non-positive policy_surface_delta); negative answers found for: ${questionIdsWithNegativeAnswer.join(", ")}`,
		);
	}
	return blockers;
}
