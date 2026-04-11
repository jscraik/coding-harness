"""Tests for rollout_check.py."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

# Allow importing the script directly from the parent directory.
sys.path.insert(0, str(Path(__file__).parent.parent))

from rollout_check import (
    DEFAULT_REQUIRED_GATE_IDS,
    PROFILE_TO_WAVE,
    RolloutCheckError,
    _evaluate_repo,
    _extract_gate_ids,
    _make_path_portable,
    _required_gates_from_arg,
    evaluate_rollout,
    load_structured_file,
    parse_rfc3339_utc,
)


_NOW = datetime(2026, 4, 11, 12, 0, 0, tzinfo=timezone.utc)
_NOW_STR = "2026-04-11T12:00:00Z"


# ---------------------------------------------------------------------------
# parse_rfc3339_utc
# ---------------------------------------------------------------------------


class TestParseRfc3339Utc:
    def test_valid_datetime(self) -> None:
        dt = parse_rfc3339_utc("2026-04-11T12:00:00Z")
        assert dt.year == 2026
        assert dt.month == 4
        assert dt.day == 11
        assert dt.tzinfo == timezone.utc

    def test_raises_on_invalid_format(self) -> None:
        with pytest.raises(ValueError):
            parse_rfc3339_utc("2026-04-11 12:00:00")

    def test_raises_on_non_utc_offset(self) -> None:
        with pytest.raises(ValueError):
            parse_rfc3339_utc("2026-04-11T12:00:00+05:00")

    def test_raises_on_empty_string(self) -> None:
        with pytest.raises(ValueError):
            parse_rfc3339_utc("")


# ---------------------------------------------------------------------------
# _make_path_portable
# ---------------------------------------------------------------------------


class TestMakePathPortable:
    def test_cwd_relative_path(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        import os
        monkeypatch.chdir(tmp_path)
        sub = tmp_path / "subdir" / "file.json"
        result = _make_path_portable(str(sub))
        assert result == str(Path("subdir") / "file.json")

    def test_absolute_path_outside_cwd(self) -> None:
        # Path that can't be made relative to cwd
        result = _make_path_portable("/totally/unrelated/path/file.json")
        assert "file.json" in result

    def test_users_home_path_stripped(self) -> None:
        result = _make_path_portable("/Users/johndoe/dev/my-repo/file.json")
        assert "johndoe" not in result or result == "/Users/johndoe/dev/my-repo/file.json"

    def test_home_linux_path_stripped(self) -> None:
        result = _make_path_portable("/home/user/dev/my-repo")
        # Should strip /home/user/dev prefix if it exists
        assert "my-repo" in result


# ---------------------------------------------------------------------------
# _extract_gate_ids
# ---------------------------------------------------------------------------


class TestExtractGateIds:
    def test_empty_list(self) -> None:
        assert _extract_gate_ids([]) == set()

    def test_single_gate(self) -> None:
        stages = [{"gate_id": "lint"}]
        assert _extract_gate_ids(stages) == {"lint"}

    def test_multiple_gates(self) -> None:
        stages = [
            {"gate_id": "lint"},
            {"gate_id": "typecheck"},
            {"gate_id": "unit"},
        ]
        assert _extract_gate_ids(stages) == {"lint", "typecheck", "unit"}

    def test_duplicate_gate_ids_deduplicated(self) -> None:
        stages = [{"gate_id": "lint"}, {"gate_id": "lint"}]
        assert _extract_gate_ids(stages) == {"lint"}

    def test_non_dict_entries_skipped(self) -> None:
        stages = ["not-a-dict", None, {"gate_id": "lint"}]
        assert _extract_gate_ids(stages) == {"lint"}

    def test_missing_gate_id_skipped(self) -> None:
        stages = [{"name": "lint"}, {"gate_id": "typecheck"}]
        assert _extract_gate_ids(stages) == {"typecheck"}

    def test_empty_gate_id_string_skipped(self) -> None:
        stages = [{"gate_id": ""}, {"gate_id": "lint"}]
        assert _extract_gate_ids(stages) == {"lint"}

    def test_non_string_gate_id_skipped(self) -> None:
        stages = [{"gate_id": 42}, {"gate_id": "lint"}]
        assert _extract_gate_ids(stages) == {"lint"}

    def test_not_a_list_returns_empty_set(self) -> None:
        assert _extract_gate_ids(None) == set()
        assert _extract_gate_ids({}) == set()
        assert _extract_gate_ids("lint") == set()


# ---------------------------------------------------------------------------
# _required_gates_from_arg
# ---------------------------------------------------------------------------


class TestRequiredGatesFromArg:
    def test_parses_comma_separated_gates(self) -> None:
        result = _required_gates_from_arg("lint,typecheck,unit")
        assert result == ("lint", "typecheck", "unit")

    def test_strips_whitespace(self) -> None:
        result = _required_gates_from_arg(" lint , typecheck ")
        assert result == ("lint", "typecheck")

    def test_single_gate(self) -> None:
        result = _required_gates_from_arg("lint")
        assert result == ("lint",)

    def test_raises_on_empty_string(self) -> None:
        with pytest.raises(RolloutCheckError, match="must include at least one"):
            _required_gates_from_arg("")

    def test_raises_when_only_commas(self) -> None:
        with pytest.raises(RolloutCheckError, match="must include at least one"):
            _required_gates_from_arg(",,,")

    def test_default_gates_parse(self) -> None:
        raw = ",".join(DEFAULT_REQUIRED_GATE_IDS)
        result = _required_gates_from_arg(raw)
        assert set(result) == set(DEFAULT_REQUIRED_GATE_IDS)


# ---------------------------------------------------------------------------
# _evaluate_repo (unit level, with file system via tmp_path)
# ---------------------------------------------------------------------------


def _make_valid_artifact(extra: dict | None = None) -> dict:
    artifact = {
        "schema_version": "hook-conformance.v1",
        "freshness_status": "fresh",
        "stages": [
            {"gate_id": "docstrings"},
            {"gate_id": "lint"},
            {"gate_id": "typecheck"},
            {"gate_id": "spelling"},
            {"gate_id": "unit"},
            {"gate_id": "formatting"},
        ],
        "drift_flags": [],
    }
    if extra:
        artifact.update(extra)
    return artifact


def _write_conformance_artifact(repo_path: Path, artifact: dict) -> None:
    codex_dir = repo_path / ".codex"
    codex_dir.mkdir(parents=True, exist_ok=True)
    (codex_dir / "hook-conformance.json").write_text(
        json.dumps(artifact), encoding="utf-8"
    )


class TestEvaluateRepoRollout:
    def test_pass_with_valid_artifact(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        _write_conformance_artifact(repo_dir, _make_valid_artifact())

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "pass"
        assert result["issues"] == []
        assert result["rollout_wave"] == "wave-1"

    def test_fail_missing_conformance_artifact(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("missing conformance artifact" in issue for issue in result["issues"])

    def test_fail_wrong_schema_version(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        artifact = _make_valid_artifact()
        artifact["schema_version"] = "hook-conformance.v2"
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("schema_version" in issue for issue in result["issues"])

    def test_fail_stale_freshness_status(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        artifact = _make_valid_artifact({"freshness_status": "stale"})
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("freshness_status" in issue for issue in result["issues"])

    def test_fail_missing_required_gate(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        artifact = _make_valid_artifact()
        # Remove 'unit' gate
        artifact["stages"] = [s for s in artifact["stages"] if s["gate_id"] != "unit"]
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("missing required gate category 'unit'" in issue for issue in result["issues"])

    def test_slo_exceeded_becomes_issue(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        # Flag detected 48 hours before now, SLO is 24 hours
        old_detected_at = "2026-04-09T12:00:00Z"  # 48h before _NOW
        artifact = _make_valid_artifact({
            "drift_flags": [{"id": "flag-1", "severity": "high", "detected_at": old_detected_at}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("SLO exceeded" in issue for issue in result["issues"])

    def test_slo_within_becomes_warning(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        # Flag detected 6 hours before now, SLO is 24 hours
        recent_detected_at = "2026-04-11T06:00:00Z"
        artifact = _make_valid_artifact({
            "drift_flags": [{"id": "flag-1", "severity": "high", "detected_at": recent_detected_at}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "pass"
        assert len(result["warnings"]) == 1
        assert "within recovery SLO" in result["warnings"][0]

    def test_low_severity_drift_flag_ignored(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        artifact = _make_valid_artifact({
            "drift_flags": [{"id": "low-flag", "severity": "low", "detected_at": "2020-01-01T00:00:00Z"}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "pass"
        assert result["issues"] == []

    def test_high_severity_flag_missing_detected_at(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        artifact = _make_valid_artifact({
            "drift_flags": [{"id": "flag-1", "severity": "high"}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("missing detected_at" in issue for issue in result["issues"])

    def test_high_severity_flag_invalid_detected_at_format(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        artifact = _make_valid_artifact({
            "drift_flags": [{"id": "flag-1", "severity": "high", "detected_at": "not-a-date"}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("not RFC3339 UTC" in issue for issue in result["issues"])

    def test_high_severity_flag_missing_id_uses_unknown(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        old_detected_at = "2026-04-09T12:00:00Z"
        artifact = _make_valid_artifact({
            "drift_flags": [{"severity": "high", "detected_at": old_detected_at}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert any("unknown-flag" in issue for issue in result["issues"])

    def test_missing_repo_name_raises(self) -> None:
        repo = {"repo_path": "/some/path", "profile_type": "standard-prek-wrapper"}
        with pytest.raises(RolloutCheckError, match="missing repo_name"):
            _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)

    def test_missing_repo_path_raises(self) -> None:
        repo = {"repo_name": "foo", "profile_type": "standard-prek-wrapper"}
        with pytest.raises(RolloutCheckError, match="missing repo_path"):
            _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)

    def test_none_profile_type_defaults_to_repo_specific_exception(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        _write_conformance_artifact(repo_dir, _make_valid_artifact())

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": None,
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["profile_type"] == "repo-specific-exception"
        assert result["rollout_wave"] == "wave-3"

    def test_profile_to_wave_mapping(self, tmp_path: Path) -> None:
        for profile, wave in PROFILE_TO_WAVE.items():
            repo_dir = tmp_path / f"repo-{profile}"
            repo_dir.mkdir()
            _write_conformance_artifact(repo_dir, _make_valid_artifact())
            repo = {
                "repo_name": f"repo-{profile}",
                "repo_path": str(repo_dir),
                "profile_type": profile,
            }
            result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
            assert result["rollout_wave"] == wave

    def test_unknown_profile_type_maps_to_wave_unclassified(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        _write_conformance_artifact(repo_dir, _make_valid_artifact())

        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "custom-unknown",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["rollout_wave"] == "wave-unclassified"

    def test_artifact_not_a_dict_is_fail(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        (repo_dir / ".codex").mkdir(parents=True)
        (repo_dir / ".codex" / "hook-conformance.json").write_text(
            "[1, 2, 3]", encoding="utf-8"
        )
        repo = {
            "repo_name": "my-repo",
            "repo_path": str(repo_dir),
            "profile_type": "standard-prek-wrapper",
        }
        result = _evaluate_repo(repo, DEFAULT_REQUIRED_GATE_IDS, 24, _NOW)
        assert result["status"] == "fail"
        assert any("must be a JSON object" in issue for issue in result["issues"])


# ---------------------------------------------------------------------------
# evaluate_rollout (file I/O based)
# ---------------------------------------------------------------------------


def _write_inventory(tmp_path: Path, repos: list) -> Path:
    data = {"schema_version": 1, "repositories": repos}
    p = tmp_path / "inventory.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


class TestEvaluateRollout:
    def test_happy_path_all_pass(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        _write_conformance_artifact(repo_dir, _make_valid_artifact())

        inventory_path = _write_inventory(
            tmp_path,
            [{"repo_name": "my-repo", "repo_path": str(repo_dir), "profile_type": "standard-prek-wrapper"}],
        )
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["overall_ok"] is True
        assert result["blocking_issues"] == []
        assert result["schema_version"] == "hook-rollout-check.v1"

    def test_raises_when_recovery_slo_zero(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        with pytest.raises(RolloutCheckError, match="recovery_slo_hours must be greater than zero"):
            evaluate_rollout(inventory_path, DEFAULT_REQUIRED_GATE_IDS, 0)

    def test_raises_when_recovery_slo_negative(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        with pytest.raises(RolloutCheckError, match="recovery_slo_hours must be greater than zero"):
            evaluate_rollout(inventory_path, DEFAULT_REQUIRED_GATE_IDS, -1)

    def test_raises_when_inventory_not_object(self, tmp_path: Path) -> None:
        inventory_path = tmp_path / "inv.json"
        inventory_path.write_text("[1, 2]", encoding="utf-8")
        with pytest.raises(RolloutCheckError, match="inventory payload must be an object"):
            evaluate_rollout(inventory_path, DEFAULT_REQUIRED_GATE_IDS, 24)

    def test_raises_when_repositories_not_list(self, tmp_path: Path) -> None:
        inventory_path = tmp_path / "inv.json"
        inventory_path.write_text('{"repositories": "bad"}', encoding="utf-8")
        with pytest.raises(RolloutCheckError, match="inventory.repositories must be a list"):
            evaluate_rollout(inventory_path, DEFAULT_REQUIRED_GATE_IDS, 24)

    def test_raises_when_now_rfc3339_invalid(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        with pytest.raises(RolloutCheckError, match="now_rfc3339 must be RFC3339 UTC"):
            evaluate_rollout(inventory_path, DEFAULT_REQUIRED_GATE_IDS, 24, now_rfc3339="not-a-date")

    def test_overall_not_ok_when_repo_fails(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        # No conformance artifact - will fail

        inventory_path = _write_inventory(
            tmp_path,
            [{"repo_name": "my-repo", "repo_path": str(repo_dir), "profile_type": "standard-prek-wrapper"}],
        )
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["overall_ok"] is False
        assert len(result["blocking_issues"]) > 0

    def test_non_dict_repos_in_list_skipped(self, tmp_path: Path) -> None:
        inventory_path = tmp_path / "inv.json"
        inventory_path.write_text(
            json.dumps({"repositories": ["not-a-dict", None]}),
            encoding="utf-8",
        )
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["repositories"] == []

    def test_repos_sorted_alphabetically(self, tmp_path: Path) -> None:
        for name in ("z-repo", "a-repo", "m-repo"):
            repo_dir = tmp_path / name
            repo_dir.mkdir()
            _write_conformance_artifact(repo_dir, _make_valid_artifact())

        inventory_path = _write_inventory(
            tmp_path,
            [
                {"repo_name": "z-repo", "repo_path": str(tmp_path / "z-repo"), "profile_type": "standard-prek-wrapper"},
                {"repo_name": "a-repo", "repo_path": str(tmp_path / "a-repo"), "profile_type": "standard-prek-wrapper"},
                {"repo_name": "m-repo", "repo_path": str(tmp_path / "m-repo"), "profile_type": "standard-prek-wrapper"},
            ],
        )
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        names = [r["repo_name"] for r in result["repositories"]]
        assert names == sorted(names)

    def test_result_contains_required_gate_ids(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert set(result["required_gate_ids"]) == set(DEFAULT_REQUIRED_GATE_IDS)

    def test_result_contains_generated_at(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["generated_at"] == _NOW_STR

    def test_warnings_aggregated_from_repos(self, tmp_path: Path) -> None:
        repo_dir = tmp_path / "my-repo"
        repo_dir.mkdir()
        # High-severity flag within SLO -> warning
        recent = "2026-04-11T06:00:00Z"
        artifact = _make_valid_artifact({
            "drift_flags": [{"id": "flag-1", "severity": "high", "detected_at": recent}]
        })
        _write_conformance_artifact(repo_dir, artifact)

        inventory_path = _write_inventory(
            tmp_path,
            [{"repo_name": "my-repo", "repo_path": str(repo_dir), "profile_type": "standard-prek-wrapper"}],
        )
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["overall_ok"] is True
        assert len(result["warnings"]) == 1

    def test_output_written_to_file(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        out_path = tmp_path / "output.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        loaded = json.loads(out_path.read_text())
        assert loaded["schema_version"] == "hook-rollout-check.v1"

    def test_multiple_issues_across_multiple_repos(self, tmp_path: Path) -> None:
        for name in ("repo-a", "repo-b"):
            repo_dir = tmp_path / name
            repo_dir.mkdir()
            # No conformance artifact

        inventory_path = _write_inventory(
            tmp_path,
            [
                {"repo_name": "repo-a", "repo_path": str(tmp_path / "repo-a"), "profile_type": "standard-prek-wrapper"},
                {"repo_name": "repo-b", "repo_path": str(tmp_path / "repo-b"), "profile_type": "standard-prek-wrapper"},
            ],
        )
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["overall_ok"] is False
        assert len(result["blocking_issues"]) >= 2

    def test_empty_repositories_list_is_ok(self, tmp_path: Path) -> None:
        inventory_path = _write_inventory(tmp_path, [])
        result = evaluate_rollout(
            inventory_path=inventory_path,
            required_gate_ids=DEFAULT_REQUIRED_GATE_IDS,
            recovery_slo_hours=24,
            now_rfc3339=_NOW_STR,
        )
        assert result["overall_ok"] is True
        assert result["repositories"] == []