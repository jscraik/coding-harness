// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated scripts.
import { describe, expect, it } from "vitest";
import {
	SEMGREP_TEMPLATE_FILES,
	renderSemgrepBootstrapScript,
	renderSemgrepChangedScript,
	renderSemgrepFullScript,
	renderSemgrepPrePushRules,
} from "./scaffold-semgrep-templates.js";

describe("Semgrep scaffold templates", () => {
	it("keeps the Semgrep scaffold surface grouped", () => {
		expect(SEMGREP_TEMPLATE_FILES).toEqual([
			"scripts/check-semgrep-changed.sh",
			"scripts/check-semgrep-full.sh",
			"scripts/semgrep-bootstrap.sh",
			"scripts/semgrep-pre-push.yml",
		]);
	});

	it("renders changed and full scanners through the shared bootstrap", () => {
		const changed = renderSemgrepChangedScript();
		const full = renderSemgrepFullScript();

		expect(changed).toContain(
			'source "$REPO_ROOT/scripts/semgrep-bootstrap.sh"',
		);
		expect(changed).toContain(
			'git diff --name-only --diff-filter=ACMR -z "$base_ref"...HEAD --',
		);
		expect(changed).toContain('"${changed_sources[@]}"');
		expect(full).toContain('source "$REPO_ROOT/scripts/semgrep-bootstrap.sh"');
		expect(full).toContain("run_semgrep scan");
		expect(full).toContain("\t.");
	});

	it("renders bootstrap helpers and local pre-push rules", () => {
		const bootstrap = renderSemgrepBootstrapScript();
		const rules = renderSemgrepPrePushRules();

		expect(bootstrap).toContain(
			'SEMGREP_VERSION="${SEMGREP_VERSION:-1.153.1}"',
		);
		expect(bootstrap).toContain("set -euo pipefail");
		expect(bootstrap).toContain("semgrep_version_usable()");
		expect(bootstrap).toContain("resolve_semgrep_python()");
		expect(bootstrap).toContain(
			'SEMGREP_BOOTSTRAP_PYTHON="${SEMGREP_BOOTSTRAP_PYTHON:-}"',
		);
		expect(bootstrap).toContain("resolve_semgrep_python_cache_tag()");
		expect(bootstrap).toContain(
			'if ! SEMGREP_BOOTSTRAP_PYTHON="$(resolve_semgrep_python)"; then',
		);
		expect(bootstrap).toContain(
			'if [[ ! -x "$SEMGREP_BOOTSTRAP_PYTHON" ]]; then',
		);
		expect(bootstrap).toContain(
			'SEMGREP_PYTHON_CACHE_TAG="${SEMGREP_PYTHON_CACHE_TAG:-}"',
		);
		expect(bootstrap).toContain("ensure_semgrep_cache_paths()");
		expect(bootstrap).toContain("ensure_semgrep_cache_paths || return 1");
		expect(bootstrap).toContain("if ! ensure_semgrep_cache_paths; then");
		expect(bootstrap).toContain("local probe_pid=$!");
		expect(bootstrap).toContain("local watchdog_pid=$!");
		expect(bootstrap).toContain('kill -9 "$probe_pid"');
		expect(bootstrap).toContain("install_semgrep_with_site_packages()");
		expect(rules).toContain("ts-no-eval");
		expect(rules).toContain("ts-no-shell-true");
	});
});
