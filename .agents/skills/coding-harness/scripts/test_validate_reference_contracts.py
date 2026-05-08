"""Smoke tests for the coding-harness skill reference validator."""

from pathlib import Path


def test_validator_script_exists() -> None:
    script = Path(__file__).with_name("validate_reference_contracts.py")
    assert script.exists()
    assert "REQUIRED_PATTERNS" in script.read_text(encoding="utf-8")
