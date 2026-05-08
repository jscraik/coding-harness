"""Smoke tests for the coding-harness skill reference validator."""

import json
import subprocess
import sys
from pathlib import Path


def test_validator_script_exists() -> None:
    script = Path(__file__).with_name("validate_reference_contracts.py")
    assert script.exists()
    assert "REQUIRED_PATTERNS" in script.read_text(encoding="utf-8")


def test_validator_emits_targetable_json_report() -> None:
    script = Path(__file__).with_name("validate_reference_contracts.py")
    skill_root = script.parent.parent

    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--skill-root",
            str(skill_root),
            "--package-form",
            "source-skill-root",
            "--truth-source",
            "JSC-282 source-command truth",
            "--json",
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    report = json.loads(result.stdout)
    assert report["status"] == "pass"
    assert report["skill_root"] == str(skill_root.resolve())
    assert report["package_form"] == "source-skill-root"
    assert report["truth_source"] == "JSC-282 source-command truth"
    assert "SKILL.md" in report["checked_files"]
    assert report["findings"] == []


def test_validator_emits_json_findings_on_failure(tmp_path: Path) -> None:
    script = Path(__file__).with_name("validate_reference_contracts.py")

    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--skill-root",
            str(tmp_path),
            "--package-form",
            "extracted-local-tarball",
            "--truth-source",
            "JSC-282 source-command truth",
            "--json",
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    report = json.loads(result.stdout)
    assert result.returncode == 1
    assert report["status"] == "fail"
    assert report["package_form"] == "extracted-local-tarball"
    assert any(
        finding["kind"] == "missing-file"
        and finding["file"] == "SKILL.md"
        for finding in report["findings"]
    )
