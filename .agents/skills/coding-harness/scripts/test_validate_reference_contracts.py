"""Smoke tests for the coding-harness skill reference validator."""

import json
import subprocess
import sys
from pathlib import Path


def test_validator_script_exists() -> None:
    """
    Verify the validator script file exists and contains the REQUIRED_PATTERNS marker.
    
    Asserts that a file named `validate_reference_contracts.py` is present next to this test file and that its text includes the substring "REQUIRED_PATTERNS".
    """
    script = Path(__file__).with_name("validate_reference_contracts.py")
    assert script.exists()
    assert "REQUIRED_PATTERNS" in script.read_text(encoding="utf-8")


def test_validator_emits_targetable_json_report() -> None:
    """
    Smoke test that running the reference-contracts validator on the repository root produces a passing JSON report with expected metadata and no findings.
    
    Verifies the report's `status` is `pass`, `skill_root` matches the resolved repository root, `package_form` is `source-skill-root`, `truth_source` matches the provided string, `SKILL.md` is listed in `checked_files`, and `findings` is an empty list.
    """
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
    """
    Verify the validator reports a missing SKILL.md when run against an empty skill root.
    
    Runs the `validate_reference_contracts.py` script with `--package-form extracted-local-tarball`
    against the provided temporary directory and asserts the process exits with failure and the
    JSON report contains a `missing-file` finding for `SKILL.md`.
    
    Parameters:
        tmp_path (Path): Temporary directory to use as the skill root (empty).
    """
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


def test_validator_emits_json_findings_for_non_file_targets(tmp_path: Path) -> None:
    """
    Verify the validator reports directories in expected file positions without crashing.
    """
    script = Path(__file__).with_name("validate_reference_contracts.py")
    (tmp_path / "SKILL.md").mkdir()

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
    assert any(
        finding["kind"] == "unreadable-file"
        and finding["file"] == "SKILL.md"
        for finding in report["findings"]
    )
