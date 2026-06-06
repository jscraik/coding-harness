#!/usr/bin/env python3
"""Validate typed artifact surfaces across repository file kinds."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tomllib
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Literal, cast

from pydantic import BaseModel, ConfigDict, ValidationError, field_validator
import yaml


REPO_ROOT = Path(__file__).resolve().parent.parent
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
JSON_SCHEMA_DRAFTS = {
    "https://json-schema.org/draft/2020-12/schema",
    "http://json-schema.org/draft-07/schema#",
}
REQUIRED_PACKAGE_SCRIPTS = {
    "docs:lint",
    "docs:lifecycle",
    "contracts:command-catalog",
    "contracts:runtime-packets",
    "skill:validate",
    "workflow:validate",
    "typescript:types",
    "typescript:policy",
    "python:types",
    "artifact:types",
    "types:check",
}


class CommandCapability(BaseModel):
    """Typed contract for one command catalog entry."""

    model_config = ConfigDict(extra="forbid")

    name: str
    aliases: list[str]
    summary: str
    example: str | None = None
    category: Literal[
        "discovery",
        "bootstrap-governance",
        "review-policy",
        "workflow-linear",
        "pilot-remediation",
        "drift-search-evidence",
        "uncategorized",
    ]
    mutability: Literal["read", "write"]
    requiredFlags: list[str]
    expectedArtifacts: list[str]
    retryability: Literal["safe", "conditional", "manual"]
    safeFirstAlternatives: list[str]
    tier: Literal["cockpit", "domain", "plumbing", "legacy"]
    primaryAudience: Literal["agent", "human", "both"]
    orchestratedBy: list[Literal["next", "pr-ready", "fix-review", "learn"]]
    agentMode: Literal[
        "orient",
        "plan",
        "verify",
        "review",
        "repair",
        "handoff",
        "learn",
        "admin",
    ]
    visibility: Literal["default", "agent", "advanced", "plumbing", "hidden", "legacy"]

    @field_validator("name", "summary", "example")
    @classmethod
    def reject_blank_optional_string(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator(
        "aliases",
        "requiredFlags",
        "expectedArtifacts",
        "safeFirstAlternatives",
        mode="after",
    )
    @classmethod
    def reject_blank_string_items(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value


class CommandCatalog(BaseModel):
    """Typed contract for command catalog JSON output."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["harness-command-catalog/v3"]
    generatedAt: str
    commandCount: int
    commands: list[CommandCapability]

    @field_validator("generatedAt")
    @classmethod
    def require_non_blank_generated_at(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value


class HarnessDecision(BaseModel):
    """Typed contract for harness-decision/v1 JSON output."""

    model_config = ConfigDict(extra="allow")

    schemaVersion: Literal["harness-decision/v1"]
    producer: str
    status: Literal["pass", "fail", "blocked", "action_required"]
    summary: str
    nextAction: str
    nextCommand: str | None
    phase: Literal["orient", "verify", "review", "repair", "handoff"]
    objective: str
    requiredEvidence: list[str]
    stopConditions: list[str]
    humanEscalation: str | None
    followUpCommands: list[str]
    hiddenPlumbing: list[str]
    safeToRun: bool
    requiresHuman: bool
    requiresNetwork: bool
    writesFiles: bool
    evidenceRef: list[str]
    failureClass: str | None
    retry: Literal["safe", "conditional", "manual"]
    riskTier: Literal["low", "medium", "high", "critical", "unknown"]

    @field_validator(
        "producer",
        "summary",
        "nextAction",
        "objective",
        "nextCommand",
        "humanEscalation",
        "failureClass",
    )
    @classmethod
    def reject_blank_decision_string(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator(
        "requiredEvidence",
        "stopConditions",
        "followUpCommands",
        "hiddenPlumbing",
        "evidenceRef",
    )
    @classmethod
    def reject_blank_decision_items(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value


class CliJsonLiveValidation(BaseModel):
    """Live validation policy for a CLI JSON contract."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool
    allowedExitCodes: list[int]
    stdoutJson: bool
    reason: str | None = None

    @field_validator("allowedExitCodes")
    @classmethod
    def require_allowed_exit_codes(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("must contain at least one exit code")
        if any(code < 0 for code in value):
            raise ValueError("must not contain negative exit codes")
        return value

    @field_validator("reason")
    @classmethod
    def reject_blank_reason(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value


class CliJsonContract(BaseModel):
    """One CLI JSON output contract entry."""

    model_config = ConfigDict(extra="forbid")

    name: str
    command: list[str]
    expectedSchemaVersion: Literal[
        "harness-command-catalog/v3",
        "harness-decision/v1",
    ]
    schemaPath: str
    examplePath: str
    liveValidation: CliJsonLiveValidation

    @field_validator("name", "schemaPath", "examplePath")
    @classmethod
    def reject_blank_contract_string(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("command")
    @classmethod
    def reject_blank_command_args(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("must contain at least one argument")
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank arguments")
        return value


class CliJsonContractsManifest(BaseModel):
    """Manifest of agent-facing CLI JSON contracts."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["cli-json-contracts-manifest/v1"]
    generatedAt: str
    contracts: list[CliJsonContract]

    @field_validator("generatedAt")
    @classmethod
    def reject_blank_manifest_generated_at(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("contracts")
    @classmethod
    def require_contracts(cls, value: list[CliJsonContract]) -> list[CliJsonContract]:
        if not value:
            raise ValueError("must contain at least one contract")
        names = [contract.name for contract in value]
        duplicate_names = sorted({name for name in names if names.count(name) > 1})
        if duplicate_names:
            raise ValueError(f"duplicate contract names: {', '.join(duplicate_names)}")
        return value


class DocLifecycleFrontmatter(BaseModel):
    """Typed frontmatter contract for governed documentation surfaces."""

    model_config = ConfigDict(extra="allow")

    doc_schema: Literal["coding-harness-doc/v1"]
    doc_type: Literal[
        "architecture",
        "contributing",
        "control-plane",
        "docs-index",
        "governance",
        "lifecycle",
        "operator-instructions",
        "product",
        "security",
        "skill",
    ]
    authority: Literal["canon", "supporting", "generated", "historical"]
    distribution: Literal[
        "source-only",
        "downstream-template",
        "packaged-skill",
        "generated",
        "example-only",
    ]
    audience: list[str]
    lifecycle_state: Literal[
        "proposed",
        "experimental",
        "active",
        "deprecated",
        "superseded",
        "archived",
    ]
    owner: str
    created: str
    last_reviewed: str
    review_cadence: str
    maintenance_trigger: list[str]
    semver_impact: Literal["none", "patch", "minor", "major"]
    validated_by: list[str]
    depends_on: list[str]
    superseded_by: str | None = None
    remove_after: str | None = None

    @field_validator("audience", "maintenance_trigger", "validated_by")
    @classmethod
    def require_non_empty_list(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("must contain at least one item")
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value

    @field_validator("depends_on")
    @classmethod
    def reject_blank_depends_on(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value

    @field_validator("owner", "review_cadence")
    @classmethod
    def require_non_blank_string(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("created", "last_reviewed", "remove_after", mode="before")
    @classmethod
    def require_iso_date(cls, value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, date):
            return value.isoformat()
        if not isinstance(value, str):
            raise ValueError("must use YYYY-MM-DD")
        if DATE_PATTERN.fullmatch(value) is None:
            raise ValueError("must use YYYY-MM-DD")
        return value


class ArtifactHtmlParser(HTMLParser):
    """Minimal parser used to surface syntax-level HTML parser errors."""


@dataclass(frozen=True)
class ArtifactReport:
    """Summary of checked artifact files by kind."""

    markdown: int = 0
    markdown_frontmatter: int = 0
    governed_markdown: int = 0
    yaml_files: int = 0
    json_files: int = 0
    jsonl_files: int = 0
    json_schema_files: int = 0
    cli_json_contracts: int = 0
    command_catalog_commands: int = 0
    runtime_packets: int = 0
    toml_files: int = 0
    html_files: int = 0
    shell_files: int = 0
    node_files: int = 0
    errors: tuple[str, ...] = ()


def run_command(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    """Run a command at the repository root and capture text output."""
    return subprocess.run(
        args,
        cwd=REPO_ROOT,
        check=False,
        text=True,
        capture_output=True,
    )


def tracked_files(patterns: Sequence[str] | None = None) -> list[Path]:
    """Return tracked plus untracked non-ignored paths, optionally limited by pathspecs."""
    command = ["git", "ls-files", "--cached", "--others", "--exclude-standard"]
    if patterns:
        command.extend(patterns)
    result = run_command(command)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return [Path(line) for line in result.stdout.splitlines() if line]


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return cast(object, json.load(handle))


def load_yaml(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return cast(object, yaml.safe_load(handle))


def as_object_map(value: object) -> dict[str, object] | None:
    """Return a string-keyed object map when a parsed value is object-shaped."""
    if not isinstance(value, dict):
        return None
    raw = cast(dict[object, object], value)
    if not all(isinstance(key, str) for key in raw):
        return None
    return cast(dict[str, object], raw)


def frontmatter_block(content: str) -> str | None:
    if not content.startswith("---\n"):
        return None
    parts = content.split("\n---\n", 1)
    if len(parts) != 2:
        return None
    return parts[0][4:]


def has_version_field(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    return any(
        key in value
        for key in ("schema", "schema_version", "schemaVersion", "version", "$schema")
    )


def require(condition: bool, errors: list[str], message: str) -> None:
    if not condition:
        errors.append(message)


def validate_tool_versions(errors: list[str]) -> None:
    package_json = as_object_map(load_json(REPO_ROOT / "package.json"))
    if package_json is None:
        errors.append("package.json must be a JSON object")
        return

    scripts = as_object_map(package_json.get("scripts"))
    if scripts is None:
        errors.append("package.json scripts must be a JSON object")
        scripts = {}
    for script_name in sorted(REQUIRED_PACKAGE_SCRIPTS):
        require(
            script_name in scripts,
            errors,
            f"package.json missing required artifact/type script: {script_name}",
        )

    dependencies = as_object_map(package_json.get("dependencies"))
    require(dependencies is not None, errors, "package.json dependencies must be an object")
    typescript_version = dependencies.get("typescript") if dependencies is not None else None
    require(
        isinstance(typescript_version, str) and typescript_version.startswith("^5.9."),
        errors,
        "package.json must pin TypeScript to the 5.9.x baseline",
    )
    require(
        package_json.get("packageManager") == "pnpm@10.33.0",
        errors,
        "package.json packageManager must remain pnpm@10.33.0",
    )
    engines = as_object_map(package_json.get("engines"))
    node_engine = engines.get("node") if engines is not None else None
    node_version_valid = False
    if isinstance(node_engine, str) and node_engine.startswith(">="):
        # Parse the minimum version from formats like ">=24", ">=24.0.0", ">=24.0.0 <25"
        version_str = node_engine[2:].strip().split()[0]
        try:
            version_parts = version_str.split(".")
            major = int(version_parts[0]) if len(version_parts) > 0 else 0
            minor = int(version_parts[1]) if len(version_parts) > 1 else 0
            patch = int(version_parts[2]) if len(version_parts) > 2 else 0
            node_version_valid = (major, minor, patch) >= (26, 3, 0)
        except (ValueError, IndexError):
            pass
    require(
        node_version_valid,
        errors,
        "package.json engines.node must declare a version floor >= 24.0.0",
    )

    tsconfig = as_object_map(load_json(REPO_ROOT / "tsconfig.json"))
    compiler_options = as_object_map(tsconfig.get("compilerOptions")) if tsconfig is not None else None
    if compiler_options is None:
        errors.append("tsconfig.json compilerOptions must be an object")
    else:
        for key in (
            "strict",
            "noUncheckedIndexedAccess",
            "exactOptionalPropertyTypes",
            "useUnknownInCatchVariables",
        ):
            require(
                compiler_options.get(key) is True,
                errors,
                f"tsconfig.json compilerOptions.{key} must stay enabled",
            )

    with (REPO_ROOT / "pyproject.toml").open("rb") as handle:
        pyproject = as_object_map(tomllib.load(handle))
    if pyproject is None:
        errors.append("pyproject.toml must be a TOML object")
        return
    project = as_object_map(pyproject.get("project"))
    require(project is not None, errors, "pyproject.toml [project] must exist")
    if project is not None:
        require(
            project.get("requires-python") == ">=3.12",
            errors,
            "pyproject.toml must require Python >=3.12",
        )
        dependencies_value = project.get("dependencies")
        require(
            isinstance(dependencies_value, list)
            and any(
                str(item).startswith("pydantic>=2.")
                for item in cast(list[object], dependencies_value)
            ),
            errors,
            "pyproject.toml must include Pydantic 2.x",
        )
    tool = as_object_map(pyproject.get("tool"))
    pyright = as_object_map(tool.get("pyright")) if tool is not None else None
    require(
        isinstance(pyright, dict) and pyright.get("typeCheckingMode") == "strict",
        errors,
        "pyproject.toml tool.pyright.typeCheckingMode must be strict",
    )


def validate_markdown(path: Path, errors: list[str]) -> bool:
    content = path.read_text(encoding="utf-8")
    block = frontmatter_block(content)
    if block is None:
        return False
    try:
        data = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        errors.append(f"{path}: Markdown frontmatter is invalid YAML: {exc}")
        return True
    if is_governed_doc_frontmatter(data):
        try:
            DocLifecycleFrontmatter.model_validate(data)
        except ValidationError as exc:
            details = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            errors.append(
                f"{path}: governed doc frontmatter violates doc lifecycle contract: {details}"
            )
    return True


def is_governed_doc_frontmatter(value: object) -> bool:
    data = as_object_map(value)
    if data is None:
        return False
    return data.get("doc_schema") == "coding-harness-doc/v1" or "doc_type" in data


def validate_yaml_file(path: Path, errors: list[str]) -> None:
    if not is_yaml_config_surface(path):
        return
    try:
        data = load_yaml(path)
    except yaml.YAMLError as exc:
        errors.append(f"{path}: invalid YAML: {exc}")
        return
    if path.name.endswith(".schema.yaml"):
        require(
            has_version_field(data),
            errors,
            f"{path}: YAML schema files must include schema/version metadata",
        )


def is_yaml_config_surface(path: Path) -> bool:
    path_text = path.as_posix()
    if path_text.startswith(("src/templates/", "templates/", "docs/goals/")):
        return False
    return path_text.startswith(
        (
            ".agents/",
            ".circleci/",
            ".github/",
            "rules/",
            "scripts/",
            "AI/prompts/",
        )
    ) or path.name in {
        ".architecture.yml",
        ".coderabbit.yaml",
        ".markdownlint-cli2.yaml",
        "goal-governor-output.yaml",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
    }


def validate_json_file(path: Path, errors: list[str]) -> None:
    try:
        data = load_json(path)
    except json.JSONDecodeError as exc:
        errors.append(f"{path}: invalid JSON: {exc}")
        return
    if path.name.endswith(".schema.json"):
        data_map = as_object_map(data)
        if data_map is None:
            errors.append(f"{path}: JSON Schema root must be an object")
            return
        schema_value = data_map.get("$schema")
        title_value = data_map.get("title")
        type_value = data_map.get("type")
        require(schema_value in JSON_SCHEMA_DRAFTS, errors, f"{path}: unsupported $schema")
        require(
            isinstance(title_value, str) and bool(title_value.strip()),
            errors,
            f"{path}: missing title",
        )
        require(isinstance(type_value, str), errors, f"{path}: missing root type")
    if is_versioned_machine_json(path):
        require(
            has_version_field(data),
            errors,
            f"{path}: machine contract JSON must include schema/version metadata",
        )


def is_versioned_machine_json(path: Path) -> bool:
    path_text = path.as_posix()
    if path.name in {"package.json", "tsconfig.json"}:
        return False
    if path.name.endswith(".schema.json"):
        return False
    if path_text == "harness.contract.json":
        return True
    if path_text.startswith("contracts/") and "/examples/" not in path_text:
        return any(token in path.name for token in ("manifest", "registry", "contract"))
    return path_text in {
        "docs/workflow-artifact-registry.json",
        ".harness/ci-required-checks.json",
        ".harness/ci-provider-transition-status.json",
    }


def validate_jsonl_file(path: Path, errors: list[str]) -> None:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            try:
                json.loads(stripped)
            except json.JSONDecodeError as exc:
                errors.append(f"{path}:{line_number}: invalid JSONL record: {exc}")


def validate_command_catalog_value(value: object, label: str, errors: list[str]) -> int:
    try:
        catalog = CommandCatalog.model_validate(value)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        errors.append(f"{label}: command catalog violates schema: {details}")
        return 0
    if catalog.commandCount != len(catalog.commands):
        errors.append(
            f"{label}: commandCount must match commands length "
            f"({catalog.commandCount} != {len(catalog.commands)})"
        )
    command_names = [command.name for command in catalog.commands]
    duplicate_names = sorted(
        {name for name in command_names if command_names.count(name) > 1}
    )
    if duplicate_names:
        errors.append(
            f"{label}: command names must be unique: {', '.join(duplicate_names)}"
        )
    return len(catalog.commands)


def validate_harness_decision_value(value: object, label: str, errors: list[str]) -> None:
    try:
        HarnessDecision.model_validate(value)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        errors.append(f"{label}: harness decision violates schema: {details}")


def validate_cli_json_value(
    value: object,
    contract: CliJsonContract,
    label: str,
    errors: list[str],
) -> int:
    data_map = as_object_map(value)
    if data_map is None:
        errors.append(f"{label}: CLI JSON output must be an object")
        return 0
    require(
        data_map.get("schemaVersion") == contract.expectedSchemaVersion,
        errors,
        f"{label}: schemaVersion must be {contract.expectedSchemaVersion}",
    )
    if contract.expectedSchemaVersion == "harness-command-catalog/v3":
        return validate_command_catalog_value(value, label, errors)
    if contract.expectedSchemaVersion == "harness-decision/v1":
        validate_harness_decision_value(value, label, errors)
        return 0
    errors.append(f"{label}: unsupported CLI JSON schemaVersion {contract.expectedSchemaVersion}")
    return 0


def validate_cli_json_contracts(errors: list[str]) -> tuple[int, int]:
    manifest_path = REPO_ROOT / "contracts/cli-json-contracts.manifest.json"
    try:
        manifest = CliJsonContractsManifest.model_validate(load_json(manifest_path))
    except (ValidationError, json.JSONDecodeError, OSError) as exc:
        if isinstance(exc, ValidationError):
            details = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            errors.append(f"contracts/cli-json-contracts.manifest.json: invalid manifest: {details}")
        else:
            errors.append(f"contracts/cli-json-contracts.manifest.json: {exc}")
        return (0, 0)

    command_catalog_commands = 0
    for contract in manifest.contracts:
        schema_path = (REPO_ROOT / contract.schemaPath).resolve()
        example_path = (REPO_ROOT / contract.examplePath).resolve()

        # Ensure paths are within REPO_ROOT to prevent escaping the repository
        try:
            schema_path.relative_to(REPO_ROOT)
        except ValueError:
            errors.append(
                f"{contract.name}: schemaPath escapes repository root: {contract.schemaPath}"
            )
            continue
        try:
            example_path.relative_to(REPO_ROOT)
        except ValueError:
            errors.append(
                f"{contract.name}: examplePath escapes repository root: {contract.examplePath}"
            )
            continue

        if not schema_path.exists():
            errors.append(f"{contract.name}: schemaPath does not exist: {contract.schemaPath}")
            continue
        if not example_path.exists():
            errors.append(f"{contract.name}: examplePath does not exist: {contract.examplePath}")
            continue

        try:
            example_data = load_json(example_path)
        except (json.JSONDecodeError, OSError) as exc:
            errors.append(f"{contract.examplePath}: {exc}")
            continue

        example_count = validate_cli_json_value(
            example_data,
            contract,
            contract.examplePath,
            errors,
        )
        if contract.expectedSchemaVersion == "harness-command-catalog/v3":
            command_catalog_commands = max(command_catalog_commands, example_count)

        if not contract.liveValidation.enabled:
            continue
        result = run_command(contract.command)
        if result.returncode not in contract.liveValidation.allowedExitCodes:
            detail = (result.stderr or result.stdout).strip()
            errors.append(
                f"{contract.name}: live command exited {result.returncode}; "
                f"allowed {contract.liveValidation.allowedExitCodes}: {detail}"
            )
            continue
        if not contract.liveValidation.stdoutJson:
            continue
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            errors.append(f"{contract.name}: live command emitted invalid JSON: {exc}")
            continue
        live_count = validate_cli_json_value(
            data,
            contract,
            " ".join(contract.command),
            errors,
        )
        if contract.expectedSchemaVersion == "harness-command-catalog/v3":
            command_catalog_commands = max(command_catalog_commands, live_count)

    return (len(manifest.contracts), command_catalog_commands)


def validate_runtime_packet_schemas(errors: list[str]) -> int:
    result = run_command(["node", "scripts/validate-runtime-packet-schemas.cjs", "--all"])
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        errors.append(
            "contracts/runtime-packet-schemas.manifest.json: "
            f"validation failed: {detail}"
        )
        return 0
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        errors.append(f"scripts/validate-runtime-packet-schemas.cjs emitted invalid JSON: {exc}")
        return 0
    data_map = as_object_map(data)
    if data_map is None:
        errors.append("scripts/validate-runtime-packet-schemas.cjs output must be a JSON object")
        return 0
    require(
        data_map.get("schemaVersion") == "runtime-packet-schema-validation/v1",
        errors,
        "runtime packet validation output must declare schemaVersion "
        "runtime-packet-schema-validation/v1",
    )
    require(
        data_map.get("status") == "pass",
        errors,
        "runtime packet validation output must have status pass",
    )
    packet_count = data_map.get("packetCount")
    require(
        isinstance(packet_count, int) and packet_count > 0,
        errors,
        "runtime packet validation output must include positive packetCount",
    )
    return packet_count if isinstance(packet_count, int) else 0


def validate_toml_file(path: Path, errors: list[str]) -> None:
    try:
        with path.open("rb") as handle:
            tomllib.load(handle)
    except tomllib.TOMLDecodeError as exc:
        errors.append(f"{path}: invalid TOML: {exc}")


def validate_html_file(path: Path, errors: list[str]) -> None:
    try:
        ArtifactHtmlParser().feed(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - HTMLParser exposes broad parser failures.
        errors.append(f"{path}: invalid HTML parse: {exc}")


def validate_command_syntax(
    paths: Iterable[Path], command_prefix: Sequence[str], errors: list[str]
) -> int:
    checked = 0
    for path in paths:
        checked += 1
        result = run_command([*command_prefix, path.as_posix()])
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            errors.append(f"{path}: syntax check failed: {detail}")
    return checked


def build_report() -> ArtifactReport:
    errors: list[str] = []
    files = tracked_files()

    validate_tool_versions(errors)

    markdown_frontmatter = 0
    governed_markdown = 0
    for path in (file_path for file_path in files if file_path.suffix in {".md", ".mdx"}):
        if validate_markdown(path, errors):
            markdown_frontmatter += 1
            block = frontmatter_block(path.read_text(encoding="utf-8"))
            if block is not None:
                try:
                    data = yaml.safe_load(block)
                except yaml.YAMLError:
                    data = None
                if is_governed_doc_frontmatter(data):
                    governed_markdown += 1

    yaml_files = [path for path in files if path.suffix in {".yaml", ".yml"}]
    for path in yaml_files:
        validate_yaml_file(path, errors)

    json_files = [path for path in files if path.suffix == ".json"]
    for path in json_files:
        validate_json_file(path, errors)

    jsonl_files = [path for path in files if path.suffix == ".jsonl"]
    for path in jsonl_files:
        validate_jsonl_file(path, errors)

    cli_json_contracts, command_catalog_commands = validate_cli_json_contracts(errors)
    runtime_packets = validate_runtime_packet_schemas(errors)

    toml_files = [path for path in files if path.suffix == ".toml"]
    for path in toml_files:
        validate_toml_file(path, errors)

    html_files = [path for path in files if path.suffix == ".html"]
    for path in html_files:
        validate_html_file(path, errors)

    shell_files = [path for path in files if path.suffix == ".sh"]
    shell_count = validate_command_syntax(shell_files, ["bash", "-n"], errors)

    node_files = [path for path in files if path.suffix in {".js", ".mjs", ".cjs"}]
    node_count = validate_command_syntax(node_files, ["node", "--check"], errors)

    return ArtifactReport(
        markdown=sum(1 for path in files if path.suffix in {".md", ".mdx"}),
        markdown_frontmatter=markdown_frontmatter,
        governed_markdown=governed_markdown,
        yaml_files=len(yaml_files),
        json_files=len(json_files),
        jsonl_files=len(jsonl_files),
        json_schema_files=sum(1 for path in json_files if path.name.endswith(".schema.json")),
        cli_json_contracts=cli_json_contracts,
        command_catalog_commands=command_catalog_commands,
        runtime_packets=runtime_packets,
        toml_files=len(toml_files),
        html_files=len(html_files),
        shell_files=shell_count,
        node_files=node_count,
        errors=tuple(errors),
    )


def main() -> int:
    report = build_report()
    if report.errors:
        for error in report.errors:
            print(f"[artifact-types] {error}", file=sys.stderr)
        return 1
    print(
        "[artifact-types] pass "
        f"markdown={report.markdown} frontmatter={report.markdown_frontmatter} "
        f"governed_markdown={report.governed_markdown} "
        f"yaml={report.yaml_files} json={report.json_files} jsonl={report.jsonl_files} "
        f"json_schema={report.json_schema_files} "
        f"cli_json_contracts={report.cli_json_contracts} "
        f"command_catalog_commands={report.command_catalog_commands} "
        f"runtime_packets={report.runtime_packets} "
        f"toml={report.toml_files} "
        f"html={report.html_files} shell={report.shell_files} node={report.node_files}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
