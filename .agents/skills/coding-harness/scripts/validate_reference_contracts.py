#!/usr/bin/env python3
"""Validate coding-harness skill docs for current command contracts."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path


DEFAULT_SKILL_ROOT = Path(__file__).resolve().parent.parent
TARGET_FILES = [
    "SKILL.md",
    "references/agent-install.json",
    "references/setup-and-commands.md",
    "references/agent-install-guide.md",
]

BANNED_PATTERNS = {
    "verify-greptile": re.compile(r"\bverify-greptile\b"),
    "request-greptile-review": re.compile(r"\brequest-greptile-review\b"),
    "Greptile Review": re.compile(r"\bGreptile Review\b"),
    "legacy preflight invocation": re.compile(
        r"source scripts/codex-preflight\.sh && preflight_repo"
    ),
}

REQUIRED_PATTERNS = {
    "verify-coderabbit": re.compile(r"\bverify-coderabbit\b"),
    "current preflight invocation": re.compile(
        r"bash scripts/codex-preflight\.sh --stack auto --mode required"
    ),
}


@dataclass(frozen=True)
class ReferenceFinding:
    kind: str
    label: str
    file: str | None
    line: int | None
    message: str


@dataclass(frozen=True)
class ReferenceReport:
    status: str
    skill_root: str
    package_form: str
    truth_source: str
    checked_files: list[str]
    findings: list[ReferenceFinding]


def parse_args() -> argparse.Namespace:
    """
    Builds and parses command-line arguments for validating skill reference contracts.

    Returns:
        argparse.Namespace: Parsed arguments with the following attributes:
            skill_root (Path): Path to the skill root to validate (defaults to the packaged script's skill root).
            package_form (str): Evidence label for the package form under validation.
            truth_source (str): Command-truth source used when interpreting reference mismatches.
            json (bool): When true, emit a machine-readable (JSON) mismatch report.
    """
    parser = argparse.ArgumentParser(
        description="Validate coding-harness skill docs for current command contracts.",
    )
    parser.add_argument(
        "--skill-root",
        type=Path,
        default=DEFAULT_SKILL_ROOT,
        help="Skill root to validate. Defaults to this packaged script's skill root.",
    )
    parser.add_argument(
        "--package-form",
        default="source-skill-root",
        help="Evidence label for the package form under validation.",
    )
    parser.add_argument(
        "--truth-source",
        default="JSC-282 source-command truth",
        help="Command-truth source used when interpreting reference mismatches.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit a machine-readable mismatch report.",
    )
    return parser.parse_args()


def load_files(
    skill_root: Path,
) -> tuple[list[tuple[Path, str]], list[str], list[tuple[str, str]]]:
    """
    Load expected target files and report missing or unreadable entries.

    Parameters:
        skill_root (Path): Base directory under which TARGET_FILES are resolved.

    Returns:
        tuple[list[tuple[Path, str]], list[str], list[tuple[str, str]]]: Loaded
        file content, missing relative paths, and unreadable relative paths with
        diagnostic messages.
    """
    loaded: list[tuple[Path, str]] = []
    missing: list[str] = []
    unreadable: list[tuple[str, str]] = []
    for rel_path in TARGET_FILES:
        path = skill_root / rel_path
        if not path.exists():
            missing.append(rel_path)
            continue
        if not path.is_file():
            unreadable.append((rel_path, "expected file is not a regular file"))
            continue
        try:
            loaded.append((path, path.read_text(encoding="utf-8")))
        except (OSError, UnicodeDecodeError) as error:
            unreadable.append(
                (rel_path, f"unable to read expected file: {type(error).__name__}")
            )

    return loaded, missing, unreadable


def find_line_number(text: str, match_start: int) -> int:
    """
    Compute the 1-based line number that contains the character index `match_start` within `text`.

    Parameters:
        text (str): The source text in which to locate the line.
        match_start (int): Zero-based character index into `text` representing the start position of a match.

    Returns:
        int: The line number (starting at 1) that contains `match_start`. The result is equal to the count of newline characters before `match_start` plus one.
    """
    return text.count("\n", 0, match_start) + 1


def build_report(
    skill_root: Path,
    package_form: str,
    truth_source: str,
) -> ReferenceReport:
    """
    Builds a ReferenceReport describing missing files and pattern violations found under a skill root.

    Parameters:
        skill_root (Path): Root directory to search for expected target files.
        package_form (str): Identifier for the package form to include in the report.
        truth_source (str): Human-readable source identifier to include in the report.

    Returns:
        ReferenceReport: Report with `status` set to "fail" if any findings were recorded (missing files, banned-pattern matches, or missing required patterns), otherwise "pass". The report's `checked_files` lists loaded file paths relative to `skill_root`, and `findings` contains detailed ReferenceFinding entries for each issue.
    """
    files, missing, unreadable = load_files(skill_root)
    findings: list[ReferenceFinding] = []

    findings.extend(
        (
            ReferenceFinding(
                kind="missing-file",
                label="missing expected file",
                file=rel_path,
                line=None,
                message=f"missing expected file: {rel_path}",
            )
            for rel_path in missing
        )
    )
    findings.extend(
        (
            ReferenceFinding(
                kind="unreadable-file",
                label="unreadable expected file",
                file=rel_path,
                line=None,
                message=f"{rel_path}: {message}",
            )
            for rel_path, message in unreadable
        )
    )

    combined = "\n".join(text for _, text in files)

    for path, text in files:
        for label, pattern in BANNED_PATTERNS.items():
            for match in pattern.finditer(text):
                line = find_line_number(text, match.start())
                findings.append(
                    ReferenceFinding(
                        kind="banned-pattern",
                        label=label,
                        file=str(path.relative_to(skill_root)),
                        line=line,
                        message=f"banned pattern '{label}'",
                    ),
                )

    for label, pattern in REQUIRED_PATTERNS.items():
        if not pattern.search(combined):
            findings.append(
                ReferenceFinding(
                    kind="missing-required-pattern",
                    label=label,
                    file=None,
                    line=None,
                    message=f"missing required pattern '{label}'",
                ),
            )

    return ReferenceReport(
        status="fail" if findings else "pass",
        skill_root=str(skill_root),
        package_form=package_form,
        truth_source=truth_source,
        checked_files=[str(path.relative_to(skill_root)) for path, _ in files],
        findings=findings,
    )


def emit_text(report: ReferenceReport) -> None:
    """
    Prints a human-readable summary of a ReferenceReport to standard output.

    When the report contains findings, prints a "FAIL reference contract check:" header followed by one line per finding. Each finding line includes a location if available:
    - "<file>:<line>: <message>" when both file and line exist,
    - "<file>: <message>" when only file exists,
    - "<message>" when no file is present.

    When the report has no findings, prints "PASS reference contract check".

    Parameters:
        report (ReferenceReport): The result of a contract check whose findings will be emitted.
    """
    if report.findings:
        print("FAIL reference contract check:")
        for finding in report.findings:
            location = ""
            if finding.file is not None and finding.line is not None:
                location = f"{finding.file}:{finding.line}"
            elif finding.file is not None:
                location = finding.file

            prefix = f"{location}: " if location else ""
            print(f"- {prefix}{finding.message}")
        return

    print("PASS reference contract check")


def main() -> int:
    """
    Run the command-line validation flow: parse CLI arguments, build a reference report for the given skill root, and emit results.

    Depending on the `--json` flag, prints the report as JSON or as human-readable text to stdout. Exits with code 1 if the report status is "fail", 0 otherwise.

    Returns:
        int: 1 when the validation report status is `"fail"`, 0 when it is `"pass"`.
    """
    args = parse_args()
    skill_root = args.skill_root.resolve()
    report = build_report(
        skill_root=skill_root,
        package_form=args.package_form,
        truth_source=args.truth_source,
    )
    if args.json:
        print(json.dumps(asdict(report), indent=2, sort_keys=True))
    else:
        emit_text(report)
    if report.status == "fail":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
