"use strict";

const DIRECT_PNPM_AUDIT =
	/(^|[^\w-])pnpm[ \t]+audit(?=$|[ \t\r\n`"'.,;!?()[\]{}]|--)/gm;

/**
 * Locate direct pnpm audit invocations while excluding the explicit
 * `pnpm run audit` package-script route and `pnpm audit:*` script shorthands.
 *
 * @param {string} text source text to inspect
 * @returns {Array<{index: number, command: string}>} direct command matches
 */
function findDirectPnpmAudit(text) {
	const matches = [];
	for (const match of String(text).matchAll(DIRECT_PNPM_AUDIT)) {
		const prefixLength = match[1]?.length ?? 0;
		matches.push({
			index: (match.index ?? 0) + prefixLength,
			command: "pnpm audit",
		});
	}
	return matches;
}

module.exports = { findDirectPnpmAudit };
