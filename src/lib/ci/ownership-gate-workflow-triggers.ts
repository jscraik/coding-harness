const ON_KEY_PATTERN = /^["']?on["']?\s*:\s*(.*)$/;
const PR_TRIGGER_KEY_PATTERN =
	/^["']?(pull_request|pull_request_target|merge_group)["']?\s*:/;
const PR_TRIGGER_LIST_PATTERN =
	/^-\s*["']?(pull_request|pull_request_target|merge_group)["']?\s*(?:#.*)?$/;
const YAML_COMMENT_PATTERN = /(?:^|\s+)#.*$/;

interface OnBlockState {
	inOnBlock: boolean;
	onBlockIndent: number;
	onEventIndent?: number | undefined;
}

interface YamlFlowState {
	entries: string[];
	current: string;
	depth: number;
	quote: '"' | "'" | null;
	escaped: boolean;
}

/**
 * Detects whether a workflow declares an automatic PR-family trigger.
 */
export function workflowHasAutomaticPrTrigger(content: string): boolean {
	const state: OnBlockState = {
		inOnBlock: false,
		onBlockIndent: 0,
	};
	for (const line of content.split(/\r?\n/)) {
		if (lineHasAutomaticPrTrigger(line, state)) return true;
	}
	return false;
}

/** Evaluate one workflow line against inline and block on-trigger syntax. */
function lineHasAutomaticPrTrigger(line: string, state: OnBlockState): boolean {
	const indent = line.length - line.trimStart().length;
	const trimmed = line.trim();
	if (trimmed === "" || trimmed.startsWith("#")) return false;
	closeOnBlockIfNeeded({ indent, trimmed, state });
	if (state.inOnBlock && indent > state.onBlockIndent) {
		return onBlockLineHasAutomaticPrTrigger({ indent, trimmed, state });
	}
	const onMatch = trimmed.match(ON_KEY_PATTERN);
	if (!onMatch) return false;
	const inlineValue = stripYamlComment(onMatch[1] ?? "");
	if (inlineValue !== "") return inlineOnHasAutomaticPrTrigger(inlineValue);
	state.onBlockIndent = indent;
	state.onEventIndent = undefined;
	state.inOnBlock = true;
	return false;
}

/** Close on-block parsing when indentation leaves the block. */
function closeOnBlockIfNeeded(input: {
	indent: number;
	trimmed: string;
	state: OnBlockState;
}): void {
	if (
		input.state.inOnBlock &&
		input.indent <= input.state.onBlockIndent &&
		!input.trimmed.startsWith("-")
	) {
		input.state.inOnBlock = false;
		input.state.onEventIndent = undefined;
	}
}

/** Detect PR-family triggers inside a multiline on block. */
function onBlockLineHasAutomaticPrTrigger(input: {
	indent: number;
	trimmed: string;
	state: OnBlockState;
}): boolean {
	input.state.onEventIndent ??= input.indent;
	if (input.indent !== input.state.onEventIndent) return false;
	return (
		PR_TRIGGER_KEY_PATTERN.test(input.trimmed) ||
		PR_TRIGGER_LIST_PATTERN.test(input.trimmed)
	);
}

/** Detect PR-family triggers in scalar or flow-style inline on values. */
function inlineOnHasAutomaticPrTrigger(inlineValue: string): boolean {
	const value = inlineValue.trim();
	if (value === "") return false;
	if (value.startsWith("{") && value.endsWith("}")) {
		return yamlFlowEntries(value).some((entry) => {
			const separator = entry.indexOf(":");
			return separator !== -1 && isPrTriggerName(entry.slice(0, separator));
		});
	}
	if (value.startsWith("[") && value.endsWith("]")) {
		return yamlFlowEntries(value).some(isPrTriggerName);
	}
	return isPrTriggerName(value);
}

/** Return top-level entries from a YAML flow array or mapping body. */
function yamlFlowEntries(value: string): string[] {
	return splitTopLevelYamlFlow(value.slice(1, -1));
}

/** Split YAML flow content without splitting nested or quoted commas. */
function splitTopLevelYamlFlow(value: string): string[] {
	const state = createYamlFlowState();
	for (const char of value) {
		consumeYamlFlowChar(state, char);
	}
	if (state.current.trim() !== "") state.entries.push(state.current.trim());
	return state.entries;
}

/** Create parser state for top-level YAML flow splitting. */
function createYamlFlowState(): YamlFlowState {
	return {
		entries: [],
		current: "",
		depth: 0,
		quote: null,
		escaped: false,
	};
}

/** Advance the YAML flow parser by one character. */
function consumeYamlFlowChar(state: YamlFlowState, char: string): void {
	if (consumeEscapedChar(state, char)) return;
	if (consumeQuotedChar(state, char)) return;
	if (consumeEscapeStart(state, char)) return;
	if (consumeQuoteStart(state, char)) return;
	if (consumeFlowOpen(state, char)) return;
	if (consumeFlowClose(state, char)) return;
	if (consumeTopLevelSeparator(state, char)) return;
	state.current += char;
}

/** Consume a character following an escape marker. */
function consumeEscapedChar(state: YamlFlowState, char: string): boolean {
	if (!state.escaped) return false;
	state.current += char;
	state.escaped = false;
	return true;
}

/** Consume a character while inside a quoted flow value. */
function consumeQuotedChar(state: YamlFlowState, char: string): boolean {
	if (!state.quote) return false;
	state.current += char;
	if (char === state.quote) state.quote = null;
	return true;
}

/** Enter escaped-character mode when a backslash is encountered. */
function consumeEscapeStart(state: YamlFlowState, char: string): boolean {
	if (char !== "\\") return false;
	state.current += char;
	state.escaped = true;
	return true;
}

/** Enter quoted mode when a flow quote is encountered. */
function consumeQuoteStart(state: YamlFlowState, char: string): boolean {
	if (char !== '"' && char !== "'") return false;
	state.current += char;
	state.quote = char;
	return true;
}

/** Track nested YAML flow collection openings. */
function consumeFlowOpen(state: YamlFlowState, char: string): boolean {
	if (char !== "{" && char !== "[") return false;
	state.current += char;
	state.depth += 1;
	return true;
}

/** Track nested YAML flow collection closings. */
function consumeFlowClose(state: YamlFlowState, char: string): boolean {
	if (char !== "}" && char !== "]") return false;
	state.current += char;
	state.depth = Math.max(0, state.depth - 1);
	return true;
}

/** Split the current flow entry on a top-level comma. */
function consumeTopLevelSeparator(state: YamlFlowState, char: string): boolean {
	if (char !== "," || state.depth !== 0) return false;
	state.entries.push(state.current.trim());
	state.current = "";
	return true;
}

/** Return whether a normalized trigger name is PR-family. */
function isPrTriggerName(value: string): boolean {
	const name = value.trim().replace(/^["']|["']$/g, "");
	return (
		name === "pull_request" ||
		name === "pull_request_target" ||
		name === "merge_group"
	);
}

/** Remove a trailing YAML comment from a scalar value. */
function stripYamlComment(value: string): string {
	return value.replace(YAML_COMMENT_PATTERN, "").trim();
}
