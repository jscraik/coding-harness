/** Parsed Project Brain rule entry. */
export interface BrainRuleEntry {
	id: string;
	text: string;
}

const RULE_ID_PATTERN = "R-[a-z0-9_-]+";

/** Format a Project Brain rule list item. */
export function formatBrainRuleEntry(rule: BrainRuleEntry): string {
	return `- **${rule.id}**: ${rule.text}`;
}

/** Extract Project Brain rules from a domain rules document. */
export function parseBrainRules(content: string): BrainRuleEntry[] {
	const rules: BrainRuleEntry[] = [];
	const regex = new RegExp(
		`^\\s*-\\s*\\*\\*(${RULE_ID_PATTERN})\\*\\*:\\s*(.+)$`,
		"gim",
	);

	for (const match of content.matchAll(regex)) {
		const id = match[1];
		const text = match[2];
		if (id && text) {
			rules.push({ id, text: text.trim() });
		}
	}

	return rules;
}
