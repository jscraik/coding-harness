/**
 * Repository configuration scaffold template rendering for downstream projects.
 *
 * This module owns small config-file bodies emitted by `harness init`.
 *
 * @module lib/init/scaffold-config-templates
 */

import { PROJECT_MISE_REQUIRED_TOOLS } from "../policy/tooling-baseline.js";

export const BIOME_SCHEMA_VERSION = "2.4.15";
const BIOME_SCHEMA_URL = `https://biomejs.dev/schemas/${BIOME_SCHEMA_VERSION}/schema.json`;

/**
 * Renders the scaffolded Biome configuration used as `biome.json` for downstream projects.
 *
 * @returns A JSON-formatted string containing the Biome configuration with `$schema`, `vcs`, `files`, `overrides`, `linter`, and `assist` sections.
 */
export function renderBiomeConfigTemplate(): string {
	return `{
	"$schema": "${BIOME_SCHEMA_URL}",
	"vcs": {
		"enabled": true,
		"clientKind": "git",
		"useIgnoreFile": true,
		"defaultBranch": "main"
	},
	"files": {
		"ignoreUnknown": true,
		"includes": [
			"**",
			"!**/node_modules",
			"!**/dist",
			"!**/coverage",
			"!**/artifacts",
			"!**/CODESTYLE.md",
			"!**/.tmp-diagram-refresh-*"
		]
	},
	"overrides": [
		{
			"includes": ["**/*.config.ts", "**/vite.config.ts", "**/vitest.config.ts"],
			"linter": {
				"rules": {
					"style": {
						"noDefaultExport": "off"
					}
				}
			}
		}
	],
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"correctness": {
				"noUnusedImports": "error",
				"noUnusedVariables": "error"
			},
			"suspicious": {
				"noEmptyBlockStatements": "error",
				"noExplicitAny": "warn",
				"noConsole": "off",
				"noDebugger": "error"
			},
			"style": {
				"noDefaultExport": "error",
				"useConst": "error",
				"useImportType": "error"
			}
		}
	},
	"assist": { "actions": { "source": { "organizeImports": "off" } } }
}
`;
}

/**
 * Render the downstream Gitleaks configuration scaffold.
 *
 * @returns TOML contents for `.gitleaks.toml`.
 */
export function renderGitleaksConfigTemplate(): string {
	return `title = "Project gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Allowlist for test fixtures and examples."
paths = [
  "(^|/)docs?/",
  "(^|/)examples?/",
  "(^|/)test/",
  "(^|/)tests?/",
  "(^|/)spec/",
  "(^|/)__tests__/",
  "(^|/)test-data/",
  "(^|/)[^.]+\\\\.(test|spec)\\\\.[^.]+$",
]
regexes = [
  "\\\\[REDACTED\\\\]",
]
`;
}

/**
 * Render the downstream mise tool baseline scaffold.
 *
 * @returns TOML contents for `.mise.toml`.
 */
export function renderMiseConfigTemplate(): string {
	return `[tools]
${PROJECT_MISE_REQUIRED_TOOLS.map(([tool, version]) => `"${tool}" = "${version}"`).join("\n")}

[env]
CLAUDE_APPROVAL_POSTURE = "require"
UV_MALWARE_CHECK = "1"
`;
}
