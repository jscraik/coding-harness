/** Parsed Project Brain rule entry from the supported markdown grammar. */
export interface BrainRule {
	id: string;
	text: string;
}

const RULE_ENTRY_PATTERN = /^\s*-\s*\*\*(R-[^*]+)\*\*:\s*(.+)$/gm;

/** Parse active Project Brain rules from the supported markdown list grammar. */
export function parseBrainRules(content: string): BrainRule[] {
	const rules: BrainRule[] = [];
	for (const match of content.matchAll(RULE_ENTRY_PATTERN)) {
		const id = match[1]?.trim();
		const text = match[2]?.trim();
		if (id && text) rules.push({ id, text });
	}
	return rules;
}
