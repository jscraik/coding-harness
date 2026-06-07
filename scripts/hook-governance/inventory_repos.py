#!/usr/bin/env python3
"""Generate a manifest-driven cross-repo hook inventory."""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Literal, TypedDict, cast

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator


class ManifestValidationError(ValueError):
    """Raised when the repo-scope manifest is invalid."""


type JsonObject = dict[str, object]
type ProfileType = Literal[
    "standard-prek-wrapper", "mixed-framework-transitional", "repo-specific-exception"
]


class CommitMsgPolicy(TypedDict):
    """Detected commit-message policy command and its source."""

    source: str
    command: str


class RepositoryInventoryEntry(TypedDict):
    """Hook-governance inventory details for one repository."""

    repo_name: str
    repo_path: str
    frameworks_present: list[str]
    gate_entrypoints: dict[str, str]
    commit_msg_policy: CommitMsgPolicy | None
    profile_type: ProfileType


class HookInventory(TypedDict):
    """Generated hook-governance inventory manifest."""

    schema_version: int
    workspace_root: str
    repositories: list[RepositoryInventoryEntry]
    excluded_repositories: list[str]


class RepoScopeModel(BaseModel):
    """Validated repository include/exclude scope from the manifest."""

    model_config = ConfigDict(extra="forbid")

    in_scope: list[str] = Field(default_factory=list)
    excluded: list[str] = Field(default_factory=list)

    @field_validator("in_scope", "excluded")
    @classmethod
    def repo_names_must_be_unique(cls, value: list[str]) -> list[str]:
        duplicates = sorted({repo_name for repo_name in value if value.count(repo_name) > 1})
        if duplicates:
            raise ValueError(f"duplicate repo names: {', '.join(duplicates)}")
        return value

    @model_validator(mode="after")
    def in_scope_and_excluded_must_not_overlap(self) -> RepoScopeModel:
        overlap = sorted(set(self.in_scope) & set(self.excluded))
        if overlap:
            raise ValueError(
                "repo names must not appear in both repos.in_scope and repos.excluded: "
                + ", ".join(overlap)
            )
        return self


class RepoScopeManifestModel(BaseModel):
    """Validated repo-scope manifest with Pydantic-backed defaults."""

    model_config = ConfigDict(extra="ignore")

    workspace_root: str = "../../"
    repos: RepoScopeModel = Field(default_factory=RepoScopeModel)

    @field_validator("workspace_root")
    @classmethod
    def workspace_root_must_be_non_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("workspace_root must be a non-empty string")
        return value


def _validation_error_message(exc: ValidationError) -> str:
    error = exc.errors()[0]
    location = tuple(str(item) for item in error.get("loc", ()))
    error_type = str(error.get("type", ""))
    message = str(error.get("msg", ""))

    if location == ("workspace_root",):
        return "workspace_root must be a non-empty string"
    if location == ("repos",) and "repo names must not appear" in message:
        repo_name = message.rsplit(": ", 1)[-1].split(", ", maxsplit=1)[0]
        return f"excluded repo '{repo_name}' must not appear in repos.in_scope"
    if location == ("repos",) and "duplicate repo names:" in message:
        return message
    if location == ("repos",):
        return "repos must be an object"
    if location[:2] == ("repos", "in_scope"):
        return "repos.in_scope must be a list of repo names"
    if location[:2] == ("repos", "excluded"):
        return "repos.excluded must be a list of repo names"
    if error_type == "model_type" and location == ():
        return f"manifest must be a JSON object, not {message}"
    return message


def parse_manifest(payload: Mapping[str, object]) -> RepoScopeManifestModel:
    """Validate a repo-scope manifest payload and preserve legacy diagnostics."""
    try:
        return RepoScopeManifestModel.model_validate(payload)
    except ValidationError as exc:
        raise ManifestValidationError(_validation_error_message(exc)) from exc


def load_manifest(manifest_path: Path) -> JsonObject:
    try:
        with manifest_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        raise ManifestValidationError(
            f"manifest file not found: {manifest_path}"
        ) from exc
    except json.JSONDecodeError as exc:
        raise ManifestValidationError(
            f"manifest file contains invalid JSON: {manifest_path}: {exc}"
        ) from exc

    if not isinstance(payload, dict):
        raise ManifestValidationError(
            f"manifest must be a JSON object, not {type(payload).__name__}"
        )

    return cast(JsonObject, payload)


def resolve_workspace_root(manifest_path: Path, manifest: Mapping[str, object]) -> Path:
    validated_manifest = parse_manifest(manifest)
    return (manifest_path.parent / validated_manifest.workspace_root).resolve()


def detect_frameworks(repo_path: Path) -> list[str]:
    frameworks: list[str] = []
    package_data = load_package_json(repo_path)
    if (repo_path / ".githooks").exists():
        frameworks.append(".githooks")
    if (repo_path / ".pre-commit-config.yaml").is_file():
        frameworks.append("pre-commit")
    if (repo_path / ".husky").exists():
        frameworks.append("husky")
    if (repo_path / "prek.toml").is_file() or (repo_path / ".prek.toml").is_file():
        frameworks.append("prek")

    if isinstance(package_data.get("simple-git-hooks"), dict):
        frameworks.append("simple-git-hooks")
    return sorted(set(frameworks))


def load_package_json(repo_path: Path) -> JsonObject:
    package_json_path = repo_path / "package.json"
    if not package_json_path.is_file():
        return {}
    try:
        package_data = json.loads(package_json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ManifestValidationError(
            f"invalid package.json for repo '{repo_path.name}': {exc}"
        ) from exc
    if not isinstance(package_data, dict):
        raise ManifestValidationError(
            f"package.json for repo '{repo_path.name}' must be a JSON object"
        )
    return cast(JsonObject, package_data)


def detect_make_entrypoints(repo_path: Path) -> dict[str, str]:
    """
    Detect available gate entrypoints in a repository's Makefile and fallback commit-msg policy.
    
    Parameters:
    	repo_path (Path): Path to the repository root; used to locate the Makefile and any repository-specific commit-msg policy.
    
    Returns:
    	entrypoints (dict[str, str]): Mapping of gate target names to shell commands. For each of the Makefile targets `hooks-pre-commit`, `hooks-pre-push`, and `hooks-commit-msg` that are present, the value is `"make <target>"`. If a `hooks-commit-msg` Makefile target is not present but a repository-specific commit-msg command is available, `hooks-commit-msg` is set to that command.
    """
    makefile_path = repo_path / "Makefile"
    entrypoints: dict[str, str] = {}
    if makefile_path.is_file():
        targets = makefile_path.read_text(encoding="utf-8").splitlines()
        for target_name in ("hooks-pre-commit", "hooks-pre-push", "hooks-commit-msg"):
            prefix = f"{target_name}:"
            if any(line.startswith(prefix) for line in targets):
                entrypoints[target_name] = f"make {target_name}"

    if "hooks-commit-msg" not in entrypoints:
        commit_msg_policy = detect_commit_msg_policy(repo_path)
        if commit_msg_policy is not None:
            entrypoints["hooks-commit-msg"] = commit_msg_policy["command"]

    return entrypoints


def detect_commit_msg_policy(repo_path: Path) -> CommitMsgPolicy | None:
    package_data = load_package_json(repo_path)
    simple_git_hooks = package_data.get("simple-git-hooks")
    if isinstance(simple_git_hooks, dict):
        hook_commands = cast(Mapping[str, object], simple_git_hooks)
        commit_msg_command = hook_commands.get("commit-msg")
        if isinstance(commit_msg_command, str) and commit_msg_command.strip():
            return {
                "source": "simple-git-hooks",
                "command": commit_msg_command,
            }

    validate_script = repo_path / "scripts" / "validate-commit-msg.js"
    if validate_script.is_file():
        return {
            "source": "validate-commit-msg.js",
            "command": f"node {validate_script.relative_to(repo_path).as_posix()} $1",
        }

    return None


def classify_profile_type(
    frameworks_present: list[str], gate_entrypoints: dict[str, str]
) -> ProfileType:
    has_standard_wrappers = all(
        target in gate_entrypoints for target in ("hooks-pre-commit", "hooks-pre-push")
    )
    if "prek" in frameworks_present and has_standard_wrappers:
        if len(frameworks_present) == 1:
            return "standard-prek-wrapper"
        return "mixed-framework-transitional"
    return "repo-specific-exception"


def build_inventory(manifest_path: Path) -> HookInventory:
    manifest = parse_manifest(load_manifest(manifest_path))
    in_scope = manifest.repos.in_scope
    excluded = manifest.repos.excluded

    workspace_root = (manifest_path.parent / manifest.workspace_root).resolve()
    inventory: list[RepositoryInventoryEntry] = []

    for repo_name in in_scope:
        repo_path = workspace_root / repo_name
        if not repo_path.is_dir():
            raise ManifestValidationError(
                f"missing repo path for in-scope repo '{repo_name}': {repo_path}; "
                "create the repo or remove it from repos.in_scope"
            )
        frameworks_present = detect_frameworks(repo_path)
        gate_entrypoints = detect_make_entrypoints(repo_path)
        inventory.append(
            {
                "repo_name": repo_name,
                "repo_path": str(repo_path),
                "frameworks_present": frameworks_present,
                "gate_entrypoints": gate_entrypoints,
                "commit_msg_policy": detect_commit_msg_policy(repo_path),
                "profile_type": classify_profile_type(
                    frameworks_present, gate_entrypoints
                ),
            }
        )

    return {
        "schema_version": 1,
        "workspace_root": str(workspace_root),
        "repositories": inventory,
        "excluded_repositories": sorted(excluded),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--out", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        inventory = build_inventory(args.manifest.resolve())
    except ManifestValidationError as exc:
        print(f"[inventory_repos] {exc}")
        return 1

    output = json.dumps(inventory, indent=2, sort_keys=True)
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
