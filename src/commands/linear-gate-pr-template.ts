function extractPrTemplateField(
	body: string | undefined,
	label: string,
): string {
	if (!body) {
		return "";
	}
	const prefix = `- ${label}:`;
	for (const line of body.split(/\r?\n/)) {
		if (line.toLowerCase().startsWith(prefix.toLowerCase())) {
			return line.slice(prefix.length).trim();
		}
	}
	return "";
}

function hasNaWithReason(value: string): boolean {
	return /\b(?:n\.a\.|n\/a|not applicable)\b.{6,}/i.test(value);
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
