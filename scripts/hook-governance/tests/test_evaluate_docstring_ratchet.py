"""Tests for evaluate_docstring_ratchet.py."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

# Allow importing the script directly from the parent directory.
sys.path.insert(0, str(Path(__file__).parent.parent))

from evaluate_docstring_ratchet import (
    FALSE_POSITIVE_THRESHOLD,
    DocstringRatchetError,
    _normalize_false_positive_rates,
    evaluate_docstring_ratchet,
    evaluate_repo,
    load_structured_file,
    portable_path,
)


# ---------------------------------------------------------------------------
# load_structured_file
# ---------------------------------------------------------------------------


class TestLoadStructuredFile:
    def test_loads_valid_json(self, tmp_path: Path) -> None:
        f = tmp_path / "data.json"
        f.write_text('{"key": "value"}', encoding="utf-8")
        result = load_structured_file(f)
        assert result == {"key": "value"}

    def test_loads_json_list(self, tmp_path: Path) -> None:
        f = tmp_path / "data.json"
        f.write_text('[1, 2, 3]', encoding="utf-8")
        result = load_structured_file(f)
        assert result == [1, 2, 3]

    def test_raises_on_invalid_json_and_no_yaml(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        import evaluate_docstring_ratchet as module
        monkeypatch.setattr(module, "yaml", None)
        f = tmp_path / "bad.json"
        f.write_text("not: valid: json}", encoding="utf-8")
        with pytest.raises(DocstringRatchetError, match="unable to parse structured file"):
            load_structured_file(f)

    def test_empty_object_json(self, tmp_path: Path) -> None:
        f = tmp_path / "empty.json"
        f.write_text("{}", encoding="utf-8")
        assert load_structured_file(f) == {}


# ---------------------------------------------------------------------------
# portable_path
# ---------------------------------------------------------------------------


class TestPortablePath:
    def test_returns_relative_path_when_under_anchor(self, tmp_path: Path) -> None:
        sub = tmp_path / "sub" / "file.json"
        sub.parent.mkdir(parents=True)
        sub.touch()
        result = portable_path(sub, anchor=tmp_path)
        assert result == "sub/file.json"

    def test_returns_absolute_posix_when_not_under_anchor(self, tmp_path: Path) -> None:
        other = tmp_path / "other" / "file.json"
        different_anchor = Path("/some/unrelated/dir")
        # Should not raise, just return absolute posix path
        result = portable_path(other, anchor=different_anchor)
        assert result.endswith("other/file.json")
        assert "/" in result

    def test_no_anchor_returns_absolute_posix(self, tmp_path: Path) -> None:
        f = tmp_path / "file.json"
        result = portable_path(f, anchor=None)
        assert "/" in result
        assert result.endswith("file.json")

    def test_home_relative_anchor(self) -> None:
        home = Path.home()
        sub = home / "projects" / "file.json"
        result = portable_path(sub, anchor=home)
        assert result == "projects/file.json"


# ---------------------------------------------------------------------------
# _normalize_false_positive_rates
# ---------------------------------------------------------------------------


class TestNormalizeFalsePositiveRates:
    def test_empty_list(self) -> None:
        assert _normalize_false_positive_rates([]) == []

    def test_integer_values_become_floats(self) -> None:
        result = _normalize_false_positive_rates([0, 1, 2])
        assert result == [0.0, 1.0, 2.0]
        assert all(isinstance(v, float) for v in result)

    def test_float_values_preserved(self) -> None:
        result = _normalize_false_positive_rates([0.01, 0.03, 0.05])
        assert result == [0.01, 0.03, 0.05]

    def test_mixed_int_and_float(self) -> None:
        result = _normalize_false_positive_rates([0, 0.02, 1])
        assert result == [0.0, 0.02, 1.0]

    def test_raises_when_not_a_list(self) -> None:
        with pytest.raises(DocstringRatchetError, match="false_positive_rate_weekly must be a list"):
            _normalize_false_positive_rates("0.02")

    def test_raises_on_non_numeric_entry(self) -> None:
        with pytest.raises(DocstringRatchetError, match="false_positive_rate_weekly entries must be numeric"):
            _normalize_false_positive_rates([0.02, "high"])

    def test_raises_on_none_entry(self) -> None:
        with pytest.raises(DocstringRatchetError, match="false_positive_rate_weekly entries must be numeric"):
            _normalize_false_positive_rates([0.01, None])

    def test_raises_when_dict(self) -> None:
        with pytest.raises(DocstringRatchetError):
            _normalize_false_positive_rates({"rate": 0.02})


# ---------------------------------------------------------------------------
# evaluate_repo
# ---------------------------------------------------------------------------


def _make_repo_payload(
    repo_name: str = "my-repo",
    repo_path: str = "/repos/my-repo",
    files: list[Any] | None = None,
) -> dict[str, Any]:
    return {
        "repo_name": repo_name,
        "repo_path": repo_path,
        "files": files or [],
    }


def _make_metrics_payload(
    repo_name: str = "my-repo",
    false_positive_rate_weekly: list[float] | None = None,
    unresolved: int = 0,
) -> dict[str, Any]:
    return {
        "repositories": {
            repo_name: {
                "false_positive_rate_weekly": false_positive_rate_weekly or [0.01, 0.02],
                "unresolved_high_conf_suppressions_over_7d": unresolved,
            }
        }
    }


class TestEvaluateRepo:
    def test_ratchet_ready_with_sufficient_clean_metrics(self) -> None:
        repo = _make_repo_payload(files=[{"path": "scripts/foo.py", "label": "public", "matched_rule_id": "rule-1"}])
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is True
        assert result["ratchet_reasons"] == []

    def test_ratchet_not_ready_insufficient_data_points(self) -> None:
        repo = _make_repo_payload()
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is False
        assert any("insufficient" in r for r in result["ratchet_reasons"])

    def test_ratchet_not_ready_rate_exceeds_threshold(self) -> None:
        repo = _make_repo_payload()
        # Two weeks of data but rate exceeds threshold
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.06])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is False
        assert any("exceeds threshold" in r for r in result["ratchet_reasons"])

    def test_ratchet_not_ready_unresolved_suppressions(self) -> None:
        repo = _make_repo_payload()
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02], unresolved=3)
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is False
        assert any("unresolved" in r.lower() for r in result["ratchet_reasons"])

    def test_both_rate_and_suppressions_failures_combined(self) -> None:
        repo = _make_repo_payload()
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01], unresolved=2)
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is False
        assert len(result["ratchet_reasons"]) == 2

    def test_raises_when_repo_name_missing(self) -> None:
        repo: dict[str, Any] = {"repo_path": "/repos/foo", "files": []}
        with pytest.raises(DocstringRatchetError, match="missing repo_name"):
            evaluate_repo(repo, {}, window_days=14)

    def test_raises_when_repo_path_missing(self) -> None:
        repo: dict[str, Any] = {"repo_name": "foo", "files": []}
        with pytest.raises(DocstringRatchetError, match="missing repo_path"):
            evaluate_repo(repo, {}, window_days=14)

    def test_raises_when_unresolved_not_int(self) -> None:
        repo = _make_repo_payload()
        metrics = {
            "repositories": {
                "my-repo": {
                    "false_positive_rate_weekly": [0.01, 0.02],
                    "unresolved_high_conf_suppressions_over_7d": "5",
                }
            }
        }
        with pytest.raises(DocstringRatchetError, match="must be an integer"):
            evaluate_repo(repo, metrics, window_days=14)

    def test_raises_when_files_not_list(self) -> None:
        repo = {"repo_name": "my-repo", "repo_path": "/x", "files": "not-a-list"}
        with pytest.raises(DocstringRatchetError, match="must be a list"):
            evaluate_repo(repo, {}, window_days=14)

    def test_public_file_gets_hard_block_when_ratchet_ready(self) -> None:
        files = [{"path": "scripts/api.py", "label": "public", "matched_rule_id": "rule-1"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is True
        assert result["files"][0]["severity_mode"] == "hard-block"

    def test_public_file_gets_warning_when_ratchet_not_ready(self) -> None:
        files = [{"path": "scripts/api.py", "label": "public", "matched_rule_id": "rule-1"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is False
        assert result["files"][0]["severity_mode"] == "warning"

    def test_unknown_surface_label_gets_classifier_drift_flag(self) -> None:
        files = [{"path": "scripts/api.py", "label": "unknown-surface", "matched_rule_id": "rule-1"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert "classifier-drift" in result["files"][0]["drift_flags"]

    def test_files_sorted_by_path(self) -> None:
        files = [
            {"path": "z_file.py", "label": "public", "matched_rule_id": "rule-1"},
            {"path": "a_file.py", "label": "public", "matched_rule_id": "rule-1"},
            {"path": "m_file.py", "label": "public", "matched_rule_id": "rule-1"},
        ]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        paths = [f["path"] for f in result["files"]]
        assert paths == sorted(paths)

    def test_file_without_matched_rule_id_defaults_to_empty_string(self) -> None:
        files = [{"path": "scripts/api.py", "label": "public"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["files"][0]["matched_rule_id"] == ""

    def test_file_entry_missing_path_skipped(self) -> None:
        files = [{"label": "public", "matched_rule_id": "rule-1"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["files"] == []

    def test_file_entry_missing_label_skipped(self) -> None:
        files = [{"path": "scripts/api.py", "matched_rule_id": "rule-1"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["files"] == []

    def test_non_dict_file_entry_skipped(self) -> None:
        files = ["not-a-dict", None, {"path": "scripts/api.py", "label": "public", "matched_rule_id": "r1"}]
        repo = _make_repo_payload(files=files)
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert len(result["files"]) == 1

    def test_missing_metrics_for_repo_uses_empty_defaults(self) -> None:
        repo = _make_repo_payload(repo_name="unknown-repo")
        metrics: dict[str, Any] = {"repositories": {}}
        result = evaluate_repo(repo, metrics, window_days=14)
        # No metrics at all -> insufficient data points
        assert result["ratchet_ready"] is False

    def test_window_days_7_requires_one_data_point(self) -> None:
        repo = _make_repo_payload()
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.02])
        result = evaluate_repo(repo, metrics, window_days=7)
        assert result["ratchet_ready"] is True

    def test_window_days_21_requires_three_data_points(self) -> None:
        repo = _make_repo_payload()
        metrics = _make_metrics_payload(false_positive_rate_weekly=[0.01, 0.02])
        result = evaluate_repo(repo, metrics, window_days=21)
        assert result["ratchet_ready"] is False
        assert any("2/3" in r for r in result["ratchet_reasons"])

    def test_exact_threshold_is_not_exceeded(self) -> None:
        # Exactly at threshold (0.05) should NOT fail
        repo = _make_repo_payload()
        metrics = _make_metrics_payload(false_positive_rate_weekly=[FALSE_POSITIVE_THRESHOLD, FALSE_POSITIVE_THRESHOLD])
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["ratchet_ready"] is True

    def test_result_includes_repo_name_and_path(self) -> None:
        repo = _make_repo_payload(repo_name="test-repo", repo_path="/repos/test-repo")
        metrics = _make_metrics_payload(repo_name="test-repo")
        result = evaluate_repo(repo, metrics, window_days=14)
        assert result["repo_name"] == "test-repo"
        assert result["repo_path"] == "/repos/test-repo"


# ---------------------------------------------------------------------------
# evaluate_docstring_ratchet (file I/O based)
# ---------------------------------------------------------------------------


def _write_classification(tmp_path: Path, repos: list[Any]) -> Path:
    data: dict[str, Any] = {"schema_version": "public-api-classification.v1", "repositories": repos}
    p = tmp_path / "classification.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


def _write_metrics(tmp_path: Path, repos_metrics: dict[str, Any]) -> Path:
    data: dict[str, Any] = {"schema_version": "docstring-ratchet-metrics.v1", "repositories": repos_metrics}
    p = tmp_path / "metrics.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


class TestEvaluateDocstringRatchet:
    def test_basic_happy_path(self, tmp_path: Path) -> None:
        classification_path = _write_classification(
            tmp_path,
            [{"repo_name": "my-repo", "repo_path": "/repos/my-repo", "files": []}],
        )
        metrics_path = _write_metrics(
            tmp_path,
            {"my-repo": {"false_positive_rate_weekly": [0.01, 0.02], "unresolved_high_conf_suppressions_over_7d": 0}},
        )
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        assert result["schema_version"] == "docstring-ratchet-evaluation.v1"
        assert result["window_days"] == 14
        assert len(result["repositories"]) == 1
        assert result["repositories"][0]["ratchet_ready"] is True

    def test_raises_when_window_days_zero(self, tmp_path: Path) -> None:
        classification_path = _write_classification(tmp_path, [])
        metrics_path = _write_metrics(tmp_path, {})
        with pytest.raises(DocstringRatchetError, match="--window-days must be greater than zero"):
            evaluate_docstring_ratchet(classification_path, metrics_path, window_days=0)

    def test_raises_when_window_days_negative(self, tmp_path: Path) -> None:
        classification_path = _write_classification(tmp_path, [])
        metrics_path = _write_metrics(tmp_path, {})
        with pytest.raises(DocstringRatchetError, match="--window-days must be greater than zero"):
            evaluate_docstring_ratchet(classification_path, metrics_path, window_days=-1)

    def test_raises_when_classification_not_object(self, tmp_path: Path) -> None:
        classification_path = tmp_path / "c.json"
        classification_path.write_text("[1, 2]", encoding="utf-8")
        metrics_path = _write_metrics(tmp_path, {})
        with pytest.raises(DocstringRatchetError, match="classification payload must be an object"):
            evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)

    def test_raises_when_repositories_not_list(self, tmp_path: Path) -> None:
        data = {"repositories": "not-a-list"}
        classification_path = tmp_path / "c.json"
        classification_path.write_text(json.dumps(data), encoding="utf-8")
        metrics_path = _write_metrics(tmp_path, {})
        with pytest.raises(DocstringRatchetError, match="classification.repositories must be a list"):
            evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)

    def test_raises_when_metrics_not_object(self, tmp_path: Path) -> None:
        classification_path = _write_classification(tmp_path, [])
        metrics_path = tmp_path / "m.json"
        metrics_path.write_text("[1, 2]", encoding="utf-8")
        with pytest.raises(DocstringRatchetError, match="metrics payload must be an object"):
            evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)

    def test_raises_when_file_not_found(self, tmp_path: Path) -> None:
        missing = tmp_path / "missing.json"
        metrics_path = _write_metrics(tmp_path, {})
        with pytest.raises(FileNotFoundError):
            evaluate_docstring_ratchet(missing, metrics_path, window_days=14)

    def test_repositories_sorted_alphabetically(self, tmp_path: Path) -> None:
        classification_path = _write_classification(
            tmp_path,
            [
                {"repo_name": "z-repo", "repo_path": "/repos/z-repo", "files": []},
                {"repo_name": "a-repo", "repo_path": "/repos/a-repo", "files": []},
                {"repo_name": "m-repo", "repo_path": "/repos/m-repo", "files": []},
            ],
        )
        metrics_path = _write_metrics(tmp_path, {})
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        names = [r["repo_name"] for r in result["repositories"]]
        assert names == sorted(names)

    def test_non_dict_repository_entries_skipped(self, tmp_path: Path) -> None:
        data: dict[str, Any] = {
            "repositories": [
                "not-a-dict",
                None,
                {"repo_name": "my-repo", "repo_path": "/repos/my-repo", "files": []},
            ]
        }
        classification_path = tmp_path / "c.json"
        classification_path.write_text(json.dumps(data), encoding="utf-8")
        metrics_path = _write_metrics(tmp_path, {})
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        assert len(result["repositories"]) == 1

    def test_result_contains_evaluated_at(self, tmp_path: Path) -> None:
        classification_path = _write_classification(tmp_path, [])
        metrics_path = _write_metrics(tmp_path, {})
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        assert "evaluated_at" in result
        # Should be RFC3339-like
        assert "T" in result["evaluated_at"]
        assert "Z" in result["evaluated_at"]

    def test_result_contains_classification_path(self, tmp_path: Path) -> None:
        classification_path = _write_classification(tmp_path, [])
        metrics_path = _write_metrics(tmp_path, {})
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        assert "classification_path" in result
        assert "classification" in result["classification_path"]

    def test_multiple_repos_all_evaluated(self, tmp_path: Path) -> None:
        classification_path = _write_classification(
            tmp_path,
            [
                {"repo_name": "repo-a", "repo_path": "/repos/repo-a", "files": []},
                {"repo_name": "repo-b", "repo_path": "/repos/repo-b", "files": []},
            ],
        )
        metrics_path = _write_metrics(
            tmp_path,
            {
                "repo-a": {"false_positive_rate_weekly": [0.01, 0.01], "unresolved_high_conf_suppressions_over_7d": 0},
                "repo-b": {"false_positive_rate_weekly": [0.04, 0.04], "unresolved_high_conf_suppressions_over_7d": 0},
            },
        )
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        assert len(result["repositories"]) == 2

    def test_file_output_writes_json(self, tmp_path: Path) -> None:
        classification_path = _write_classification(tmp_path, [])
        metrics_path = _write_metrics(tmp_path, {})
        result = evaluate_docstring_ratchet(classification_path, metrics_path, window_days=14)
        out_path = tmp_path / "output.json"
        out_path.write_text(json.dumps(result) + "\n", encoding="utf-8")
        loaded = json.loads(out_path.read_text())
        assert loaded["schema_version"] == "docstring-ratchet-evaluation.v1"
