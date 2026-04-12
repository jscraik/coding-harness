#!/usr/bin/env python3
"""Generate a manifest-driven cross-repo hook inventory."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


class ManifestValidationError(ValueError):
    """Raised when the repo-scope manifest is invalid."""


def load_manifest(manifest_path: Path) -> dict[str, object]:
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

    return payload


def resolve_workspace_root(manifest_path: Path, manifest: dict[str, object]) -> Path:
    workspace_root = manifest.get("workspace_root", "../../")
    if not isinstance(workspace_root, str) or not workspace_root.strip():
        raise ManifestValidationError("workspace_root must be a non-empty string")
    return (manifest_path.parent / workspace_root).resolve()


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


def load_package_json(repo_path: Path) -> dict[str, object]:
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
    return package_data


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
        if isinstance(commit_msg_policy, dict):
            command = commit_msg_policy.get("command")
            if isinstance(command, str) and command.strip():
                entrypoints["hooks-commit-msg"] = command

    return entrypoints


def detect_commit_msg_policy(repo_path: Path) -> dict[str, str] | None:
    package_data = load_package_json(repo_path)
    simple_git_hooks = package_data.get("simple-git-hooks")
    if isinstance(simple_git_hooks, dict):
        commit_msg_command = simple_git_hooks.get("commit-msg")
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
) -> str:
    has_standard_wrappers = all(
        target in gate_entrypoints for target in ("hooks-pre-commit", "hooks-pre-push")
    )
    if "prek" in frameworks_present and has_standard_wrappers:
        if len(frameworks_present) == 1:
            return "standard-prek-wrapper"
        return "mixed-framework-transitional"
    return "repo-specific-exception"


def build_inventory(manifest_path: Path) -> dict[str, object]:
    manifest = load_manifest(manifest_path)
    repos = manifest.get("repos", {})
    if not isinstance(repos, dict):
        raise ManifestValidationError("repos must be an object")

    in_scope = repos.get("in_scope", [])
    excluded = repos.get("excluded", [])
    if not isinstance(in_scope, list) or not all(isinstance(item, str) for item in in_scope):
        raise ManifestValidationError("repos.in_scope must be a list of repo names")
    if not isinstance(excluded, list) or not all(
        isinstance(item, str) for item in excluded
    ):
        raise ManifestValidationError("repos.excluded must be a list of repo names")

    excluded_set = set(excluded)
    overlap = sorted(repo_name for repo_name in in_scope if repo_name in excluded_set)
    if overlap:
        repo_name = overlap[0]
        raise ManifestValidationError(
            f"excluded repo '{repo_name}' must not appear in repos.in_scope"
        )

    workspace_root = resolve_workspace_root(manifest_path, manifest)
    inventory: list[dict[str, str]] = []

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
