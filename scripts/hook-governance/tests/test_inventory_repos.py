"""Tests for inventory_repos.py."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Allow importing the script directly from the parent directory.
sys.path.insert(0, str(Path(__file__).parent.parent))

from inventory_repos import (
    ManifestValidationError,
    build_inventory,
    classify_profile_type,
    detect_commit_msg_policy,
    detect_frameworks,
    detect_make_entrypoints,
    load_manifest,
    load_package_json,
    resolve_workspace_root,
)


# ---------------------------------------------------------------------------
# load_manifest
# ---------------------------------------------------------------------------


class TestLoadManifest:
    def test_loads_valid_manifest(self, tmp_path: Path) -> None:
        manifest = {"workspace_root": "../../", "repos": {"in_scope": [], "excluded": []}}
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps(manifest), encoding="utf-8")
        result = load_manifest(p)
        assert result == manifest

    def test_raises_when_file_not_found(self, tmp_path: Path) -> None:
        with pytest.raises(ManifestValidationError, match="manifest file not found"):
            load_manifest(tmp_path / "missing.json")

    def test_raises_on_invalid_json(self, tmp_path: Path) -> None:
        p = tmp_path / "bad.json"
        p.write_text("{invalid json", encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="invalid JSON"):
            load_manifest(p)

    def test_raises_when_root_is_not_object(self, tmp_path: Path) -> None:
        p = tmp_path / "list.json"
        p.write_text("[1, 2, 3]", encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="must be a JSON object"):
            load_manifest(p)

    def test_raises_when_root_is_string(self, tmp_path: Path) -> None:
        p = tmp_path / "str.json"
        p.write_text('"just-a-string"', encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="must be a JSON object"):
            load_manifest(p)


# ---------------------------------------------------------------------------
# resolve_workspace_root
# ---------------------------------------------------------------------------


class TestResolveWorkspaceRoot:
    def test_resolves_relative_workspace_root(self, tmp_path: Path) -> None:
        manifest_path = tmp_path / "sub" / "manifest.json"
        manifest_path.parent.mkdir()
        manifest = {"workspace_root": "../"}
        result = resolve_workspace_root(manifest_path, manifest)
        assert result == tmp_path.resolve()

    def test_defaults_to_two_levels_up(self, tmp_path: Path) -> None:
        manifest_path = tmp_path / "deep" / "sub" / "manifest.json"
        manifest_path.parent.mkdir(parents=True)
        manifest = {}  # No workspace_root -> defaults to "../../"
        result = resolve_workspace_root(manifest_path, manifest)
        assert result == tmp_path.resolve()

    def test_raises_when_workspace_root_empty_string(self, tmp_path: Path) -> None:
        manifest_path = tmp_path / "manifest.json"
        with pytest.raises(ManifestValidationError, match="workspace_root must be a non-empty string"):
            resolve_workspace_root(manifest_path, {"workspace_root": ""})

    def test_raises_when_workspace_root_whitespace_only(self, tmp_path: Path) -> None:
        manifest_path = tmp_path / "manifest.json"
        with pytest.raises(ManifestValidationError, match="workspace_root must be a non-empty string"):
            resolve_workspace_root(manifest_path, {"workspace_root": "   "})

    def test_raises_when_workspace_root_not_string(self, tmp_path: Path) -> None:
        manifest_path = tmp_path / "manifest.json"
        with pytest.raises(ManifestValidationError, match="workspace_root must be a non-empty string"):
            resolve_workspace_root(manifest_path, {"workspace_root": 42})


# ---------------------------------------------------------------------------
# load_package_json
# ---------------------------------------------------------------------------


class TestLoadPackageJson:
    def test_returns_empty_dict_when_no_package_json(self, tmp_path: Path) -> None:
        result = load_package_json(tmp_path)
        assert result == {}

    def test_loads_valid_package_json(self, tmp_path: Path) -> None:
        pkg = {"name": "my-repo", "version": "1.0.0"}
        (tmp_path / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        result = load_package_json(tmp_path)
        assert result == pkg

    def test_raises_on_invalid_json(self, tmp_path: Path) -> None:
        (tmp_path / "package.json").write_text("{bad json", encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="invalid package.json"):
            load_package_json(tmp_path)

    def test_raises_when_package_json_not_object(self, tmp_path: Path) -> None:
        (tmp_path / "package.json").write_text("[1, 2]", encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="must be a JSON object"):
            load_package_json(tmp_path)


# ---------------------------------------------------------------------------
# detect_frameworks
# ---------------------------------------------------------------------------


class TestDetectFrameworks:
    def test_no_frameworks_detected(self, tmp_path: Path) -> None:
        assert detect_frameworks(tmp_path) == []

    def test_detects_githooks_dir(self, tmp_path: Path) -> None:
        (tmp_path / ".githooks").mkdir()
        assert ".githooks" in detect_frameworks(tmp_path)

    def test_detects_pre_commit_config(self, tmp_path: Path) -> None:
        (tmp_path / ".pre-commit-config.yaml").touch()
        assert "pre-commit" in detect_frameworks(tmp_path)

    def test_detects_husky_dir(self, tmp_path: Path) -> None:
        (tmp_path / ".husky").mkdir()
        assert "husky" in detect_frameworks(tmp_path)

    def test_detects_prek_toml(self, tmp_path: Path) -> None:
        (tmp_path / "prek.toml").touch()
        assert "prek" in detect_frameworks(tmp_path)

    def test_detects_dot_prek_toml(self, tmp_path: Path) -> None:
        (tmp_path / ".prek.toml").touch()
        assert "prek" in detect_frameworks(tmp_path)

    def test_detects_simple_git_hooks_in_package_json(self, tmp_path: Path) -> None:
        pkg = {"simple-git-hooks": {"pre-commit": "npm test"}}
        (tmp_path / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        assert "simple-git-hooks" in detect_frameworks(tmp_path)

    def test_simple_git_hooks_not_detected_when_value_is_not_dict(self, tmp_path: Path) -> None:
        pkg = {"simple-git-hooks": "npm test"}
        (tmp_path / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        assert "simple-git-hooks" not in detect_frameworks(tmp_path)

    def test_frameworks_sorted(self, tmp_path: Path) -> None:
        (tmp_path / ".githooks").mkdir()
        (tmp_path / "prek.toml").touch()
        frameworks = detect_frameworks(tmp_path)
        assert frameworks == sorted(set(frameworks))

    def test_multiple_frameworks_detected(self, tmp_path: Path) -> None:
        (tmp_path / ".pre-commit-config.yaml").touch()
        (tmp_path / "prek.toml").touch()
        frameworks = detect_frameworks(tmp_path)
        assert "pre-commit" in frameworks
        assert "prek" in frameworks

    def test_deduplicates_prek_when_both_toml_files_exist(self, tmp_path: Path) -> None:
        (tmp_path / "prek.toml").touch()
        (tmp_path / ".prek.toml").touch()
        frameworks = detect_frameworks(tmp_path)
        assert frameworks.count("prek") == 1


# ---------------------------------------------------------------------------
# detect_make_entrypoints
# ---------------------------------------------------------------------------


class TestDetectMakeEntrypoints:
    def test_no_makefile_returns_empty(self, tmp_path: Path) -> None:
        result = detect_make_entrypoints(tmp_path)
        assert result == {}

    def test_detects_hooks_pre_commit(self, tmp_path: Path) -> None:
        (tmp_path / "Makefile").write_text("hooks-pre-commit:\n\t@echo pre-commit\n")
        result = detect_make_entrypoints(tmp_path)
        assert result["hooks-pre-commit"] == "make hooks-pre-commit"

    def test_detects_hooks_pre_push(self, tmp_path: Path) -> None:
        (tmp_path / "Makefile").write_text("hooks-pre-push:\n\t@echo pre-push\n")
        result = detect_make_entrypoints(tmp_path)
        assert result["hooks-pre-push"] == "make hooks-pre-push"

    def test_detects_hooks_commit_msg(self, tmp_path: Path) -> None:
        (tmp_path / "Makefile").write_text("hooks-commit-msg:\n\t@echo commit-msg\n")
        result = detect_make_entrypoints(tmp_path)
        assert result["hooks-commit-msg"] == "make hooks-commit-msg"

    def test_all_three_targets_detected(self, tmp_path: Path) -> None:
        makefile_content = (
            "hooks-pre-commit:\n\t@echo\n"
            "hooks-pre-push:\n\t@echo\n"
            "hooks-commit-msg:\n\t@echo\n"
        )
        (tmp_path / "Makefile").write_text(makefile_content)
        result = detect_make_entrypoints(tmp_path)
        assert "hooks-pre-commit" in result
        assert "hooks-pre-push" in result
        assert "hooks-commit-msg" in result

    def test_falls_back_to_commit_msg_policy_when_no_make_target(self, tmp_path: Path) -> None:
        (tmp_path / "Makefile").write_text("hooks-pre-commit:\n\t@echo\n")
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "validate-commit-msg.js").touch()

        result = detect_make_entrypoints(tmp_path)
        assert "hooks-commit-msg" in result
        assert "validate-commit-msg.js" in result["hooks-commit-msg"]

    def test_makefile_commit_msg_target_takes_precedence(self, tmp_path: Path) -> None:
        makefile_content = "hooks-commit-msg:\n\t@echo\n"
        (tmp_path / "Makefile").write_text(makefile_content)
        # Also add a validate-commit-msg.js - should NOT override Makefile target
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "validate-commit-msg.js").touch()
        result = detect_make_entrypoints(tmp_path)
        assert result["hooks-commit-msg"] == "make hooks-commit-msg"

    def test_partial_target_name_not_detected(self, tmp_path: Path) -> None:
        # "my-hooks-pre-commit:" should NOT match "hooks-pre-commit:"
        (tmp_path / "Makefile").write_text("my-hooks-pre-commit:\n\t@echo\n")
        result = detect_make_entrypoints(tmp_path)
        assert "hooks-pre-commit" not in result


# ---------------------------------------------------------------------------
# detect_commit_msg_policy
# ---------------------------------------------------------------------------


class TestDetectCommitMsgPolicy:
    def test_returns_none_when_no_policy(self, tmp_path: Path) -> None:
        assert detect_commit_msg_policy(tmp_path) is None

    def test_detects_simple_git_hooks_commit_msg(self, tmp_path: Path) -> None:
        pkg = {"simple-git-hooks": {"commit-msg": "node scripts/validate.js $1"}}
        (tmp_path / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        result = detect_commit_msg_policy(tmp_path)
        assert result is not None
        assert result["source"] == "simple-git-hooks"
        assert result["command"] == "node scripts/validate.js $1"

    def test_ignores_simple_git_hooks_empty_commit_msg(self, tmp_path: Path) -> None:
        pkg = {"simple-git-hooks": {"commit-msg": "   "}}
        (tmp_path / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        result = detect_commit_msg_policy(tmp_path)
        # Empty whitespace should not match
        assert result is None or result.get("source") != "simple-git-hooks"

    def test_detects_validate_commit_msg_script(self, tmp_path: Path) -> None:
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "validate-commit-msg.js").touch()
        result = detect_commit_msg_policy(tmp_path)
        assert result is not None
        assert result["source"] == "validate-commit-msg.js"
        assert "validate-commit-msg.js" in result["command"]
        assert "$1" in result["command"]

    def test_simple_git_hooks_takes_precedence_over_script(self, tmp_path: Path) -> None:
        pkg = {"simple-git-hooks": {"commit-msg": "node scripts/validate.js $1"}}
        (tmp_path / "package.json").write_text(json.dumps(pkg), encoding="utf-8")
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "validate-commit-msg.js").touch()
        result = detect_commit_msg_policy(tmp_path)
        assert result is not None
        assert result["source"] == "simple-git-hooks"

    def test_command_uses_repo_relative_path(self, tmp_path: Path) -> None:
        scripts_dir = tmp_path / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "validate-commit-msg.js").touch()
        result = detect_commit_msg_policy(tmp_path)
        assert result is not None
        # Command should use relative path, not absolute
        assert not result["command"].startswith("/")


# ---------------------------------------------------------------------------
# classify_profile_type
# ---------------------------------------------------------------------------


class TestClassifyProfileType:
    def test_standard_prek_wrapper_when_prek_only_with_wrappers(self) -> None:
        frameworks = ["prek"]
        entrypoints = {"hooks-pre-commit": "make hooks-pre-commit", "hooks-pre-push": "make hooks-pre-push"}
        result = classify_profile_type(frameworks, entrypoints)
        assert result == "standard-prek-wrapper"

    def test_mixed_framework_transitional_when_prek_with_others(self) -> None:
        frameworks = ["prek", "husky"]
        entrypoints = {"hooks-pre-commit": "make hooks-pre-commit", "hooks-pre-push": "make hooks-pre-push"}
        result = classify_profile_type(frameworks, entrypoints)
        assert result == "mixed-framework-transitional"

    def test_repo_specific_exception_when_no_prek(self) -> None:
        frameworks = ["husky"]
        entrypoints = {"hooks-pre-commit": "make hooks-pre-commit", "hooks-pre-push": "make hooks-pre-push"}
        result = classify_profile_type(frameworks, entrypoints)
        assert result == "repo-specific-exception"

    def test_repo_specific_exception_when_missing_pre_commit_wrapper(self) -> None:
        frameworks = ["prek"]
        entrypoints = {"hooks-pre-push": "make hooks-pre-push"}
        result = classify_profile_type(frameworks, entrypoints)
        assert result == "repo-specific-exception"

    def test_repo_specific_exception_when_missing_pre_push_wrapper(self) -> None:
        frameworks = ["prek"]
        entrypoints = {"hooks-pre-commit": "make hooks-pre-commit"}
        result = classify_profile_type(frameworks, entrypoints)
        assert result == "repo-specific-exception"

    def test_repo_specific_exception_when_empty_frameworks(self) -> None:
        result = classify_profile_type([], {})
        assert result == "repo-specific-exception"

    def test_prek_with_all_three_targets_is_standard(self) -> None:
        frameworks = ["prek"]
        entrypoints = {
            "hooks-pre-commit": "make hooks-pre-commit",
            "hooks-pre-push": "make hooks-pre-push",
            "hooks-commit-msg": "make hooks-commit-msg",
        }
        result = classify_profile_type(frameworks, entrypoints)
        assert result == "standard-prek-wrapper"


# ---------------------------------------------------------------------------
# build_inventory (integration test with file system)
# ---------------------------------------------------------------------------


def _write_manifest(manifest_dir: Path, workspace: Path, in_scope: list[str], excluded: list[str] | None = None) -> Path:
    # Compute the relative path from the manifest directory to the workspace.
    workspace_relative = os.path.relpath(str(workspace), str(manifest_dir))
    manifest = {
        "workspace_root": workspace_relative,
        "repos": {
            "in_scope": in_scope,
            "excluded": excluded or [],
        },
    }
    p = manifest_dir / "repo-scope.manifest.json"
    p.write_text(json.dumps(manifest), encoding="utf-8")
    return p


def _create_minimal_repo(workspace: Path, name: str, with_prek: bool = True, with_makefile: bool = True) -> Path:
    repo_dir = workspace / name
    repo_dir.mkdir(parents=True, exist_ok=True)
    if with_prek:
        (repo_dir / "prek.toml").touch()
    if with_makefile:
        (repo_dir / "Makefile").write_text(
            "hooks-pre-commit:\n\t@echo\nhooks-pre-push:\n\t@echo\n"
        )
    return repo_dir


class TestBuildInventory:
    def test_empty_in_scope(self, tmp_path: Path) -> None:
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, [], [])
        result = build_inventory(manifest_path)
        assert result["repositories"] == []
        assert result["excluded_repositories"] == []

    def test_single_repo_inventory(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        _create_minimal_repo(workspace, "my-repo")

        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, ["my-repo"])
        result = build_inventory(manifest_path)
        assert len(result["repositories"]) == 1
        assert result["repositories"][0]["repo_name"] == "my-repo"
        assert result["repositories"][0]["profile_type"] == "standard-prek-wrapper"

    def test_excluded_repos_not_in_inventory(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, [], ["excluded-repo"])
        result = build_inventory(manifest_path)
        assert result["excluded_repositories"] == ["excluded-repo"]

    def test_raises_when_repo_not_found_in_workspace(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, ["nonexistent-repo"])
        with pytest.raises(ManifestValidationError, match="missing repo path"):
            build_inventory(manifest_path)

    def test_raises_when_repo_in_both_in_scope_and_excluded(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, ["my-repo"], ["my-repo"])
        with pytest.raises(ManifestValidationError, match="excluded repo 'my-repo' must not appear"):
            build_inventory(manifest_path)

    def test_raises_when_repos_not_object(self, tmp_path: Path) -> None:
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps({"workspace_root": "../", "repos": "bad"}), encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="repos must be an object"):
            build_inventory(p)

    def test_raises_when_in_scope_not_list(self, tmp_path: Path) -> None:
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps({"workspace_root": "../", "repos": {"in_scope": "bad", "excluded": []}}), encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="repos.in_scope must be a list"):
            build_inventory(p)

    def test_raises_when_excluded_not_list(self, tmp_path: Path) -> None:
        p = tmp_path / "manifest.json"
        p.write_text(json.dumps({"workspace_root": "../", "repos": {"in_scope": [], "excluded": "bad"}}), encoding="utf-8")
        with pytest.raises(ManifestValidationError, match="repos.excluded must be a list"):
            build_inventory(p)

    def test_result_contains_schema_version(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, [])
        result = build_inventory(manifest_path)
        assert result["schema_version"] == 1

    def test_result_contains_workspace_root(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, [])
        result = build_inventory(manifest_path)
        assert "workspace_root" in result

    def test_commit_msg_policy_included_in_repo_entry(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        repo_dir = _create_minimal_repo(workspace, "my-repo")
        scripts_dir = repo_dir / "scripts"
        scripts_dir.mkdir()
        (scripts_dir / "validate-commit-msg.js").touch()

        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, ["my-repo"])
        result = build_inventory(manifest_path)
        commit_msg_policy = result["repositories"][0]["commit_msg_policy"]
        assert commit_msg_policy is not None
        assert "validate-commit-msg.js" in commit_msg_policy["command"]

    def test_excluded_repos_sorted_alphabetically(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, [], ["z-repo", "a-repo", "m-repo"])
        result = build_inventory(manifest_path)
        excluded = result["excluded_repositories"]
        assert excluded == sorted(excluded)

    def test_repo_without_prek_classified_as_exception(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        _create_minimal_repo(workspace, "my-repo", with_prek=False)

        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, ["my-repo"])
        result = build_inventory(manifest_path)
        assert result["repositories"][0]["profile_type"] == "repo-specific-exception"

    def test_multiple_repos_included(self, tmp_path: Path) -> None:
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        for name in ("repo-a", "repo-b", "repo-c"):
            _create_minimal_repo(workspace, name)

        manifest_dir = tmp_path / "manifest-dir"
        manifest_dir.mkdir()
        manifest_path = _write_manifest(manifest_dir, workspace, ["repo-a", "repo-b", "repo-c"])
        result = build_inventory(manifest_path)
        assert len(result["repositories"]) == 3
        names = [r["repo_name"] for r in result["repositories"]]
        assert set(names) == {"repo-a", "repo-b", "repo-c"}