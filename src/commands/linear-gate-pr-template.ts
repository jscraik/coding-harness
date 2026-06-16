function extractPrTemplateField(
	body: string | undefined,
	label: string,
): string {
	if (!body) {
		return "";
	}
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const fieldPattern = new RegExp(
		`^\\s*[-*]\\s*${escapedLabel}\\s*:\\s*(.*)$`,
		"i",
	);
	for (const line of body.split(/\r?\n/)) {
		const match = line.match(fieldPattern);
		if (match?.[1] !== undefined) {
			return match[1].trim();
		}
	}
	return "";
}

function hasNaWithReason(value: string): boolean {
	return /(?:\bn\.a\.|\bn\/a\b|\bnot applicable\b).{6,}/i.test(value);
}

/** Return true when PR-template metadata explicitly marks untracked work. */
export function isStandaloneUntrackedPr(body: string | undefined): boolean {
	return (
		hasNaWithReason(extractPrTemplateField(body, "Linear reference")) &&
		/\b(?:standalone|untracked)\b/i.test(
			extractPrTemplateField(body, "Linked issue relationship"),
		)
	);
}
