#!/usr/bin/env bash
# Shared Semgrep bootstrap helpers for repository hook and CI scripts.

if [[ -z "${REPO_ROOT:-}" ]]; then
  REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
fi

SEMGREP_VERSION="${SEMGREP_VERSION:-1.153.1}"
SEMGREP_VERSION_SERIES="${SEMGREP_VERSION%.*}"
DEFAULT_SEMGREP_PIP_SPEC="semgrep>=${SEMGREP_VERSION},<2.0.0"
if [[ "$SEMGREP_VERSION_SERIES" == *.* ]]; then
  semgrep_series_major="${SEMGREP_VERSION_SERIES%%.*}"
  semgrep_series_minor="${SEMGREP_VERSION_SERIES##*.}"
  if [[ "$semgrep_series_major" =~ ^[0-9]+$ && "$semgrep_series_minor" =~ ^[0-9]+$ ]]; then
    semgrep_next_minor="$((semgrep_series_minor + 1))"
    DEFAULT_SEMGREP_PIP_SPEC="semgrep>=${SEMGREP_VERSION},<${semgrep_series_major}.${semgrep_next_minor}.0"
  fi
fi
SEMGREP_PIP_SPEC="${SEMGREP_PIP_SPEC:-$DEFAULT_SEMGREP_PIP_SPEC}"
DEFAULT_SEMGREP_STATE_ROOT="$REPO_ROOT/.git/semgrep"
if git_semgrep_state_root="$(git -C "$REPO_ROOT" rev-parse --git-path semgrep 2>/dev/null)"; then
  if [[ "$git_semgrep_state_root" != /* ]]; then
    git_semgrep_state_root="$REPO_ROOT/$git_semgrep_state_root"
  fi
  DEFAULT_SEMGREP_STATE_ROOT="$git_semgrep_state_root"
fi

SEMGREP_STATE_ROOT="${SEMGREP_STATE_ROOT:-$DEFAULT_SEMGREP_STATE_ROOT}"
HOST_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
SEMGREP_RUNTIME_CACHE_ROOT="${SEMGREP_RUNTIME_CACHE_ROOT:-$SEMGREP_STATE_ROOT/cache}"
SEMGREP_RUNTIME_USER_HOME="${SEMGREP_USER_HOME:-$SEMGREP_STATE_ROOT/home}"
SEMGREP_RUNTIME_LOG_FILE="${SEMGREP_LOG_FILE:-$SEMGREP_STATE_ROOT/semgrep.log}"

if [[ -z "${SSL_CERT_FILE:-}" ]]; then
  for cert_path in /etc/ssl/cert.pem /etc/ssl/certs/ca-certificates.crt; do
    if [[ -f "$cert_path" ]]; then
      export SSL_CERT_FILE="$cert_path"
      break
    fi
  done
fi

SEMGREP_CACHE_ROOT="${SEMGREP_CACHE_ROOT:-$SEMGREP_STATE_ROOT/tool-cache}"
SEMGREP_VENV_DIR="${SEMGREP_CACHE_ROOT}/semgrep-venv-${SEMGREP_VERSION}"
SEMGREP_BIN="$SEMGREP_VENV_DIR/bin/semgrep"
SEMGREP_PYTHON="$SEMGREP_VENV_DIR/bin/python"
SEMGREP_SITE_PACKAGES_DIR="${SEMGREP_CACHE_ROOT}/semgrep-site-packages-${SEMGREP_VERSION}"

semgrep_binary_usable() {
  if [[ ! -x "$SEMGREP_BIN" ]]; then
    return 1
  fi

  XDG_CACHE_HOME="$SEMGREP_RUNTIME_CACHE_ROOT" \
    SEMGREP_USER_HOME="$SEMGREP_RUNTIME_USER_HOME" \
    SEMGREP_LOG_FILE="$SEMGREP_RUNTIME_LOG_FILE" \
    "$SEMGREP_BIN" --version >/dev/null 2>&1
}

detect_semgrep_package_version() {
  if semgrep_binary_usable; then
    "$SEMGREP_PYTHON" - <<'PY' 2>/dev/null
import importlib.metadata
print(importlib.metadata.version("semgrep"))
PY
    return
  fi

  PYTHONPATH="$SEMGREP_SITE_PACKAGES_DIR${PYTHONPATH:+:$PYTHONPATH}" \
    python3 - <<'PY' 2>/dev/null
import importlib.metadata
print(importlib.metadata.version("semgrep"))
PY
}

run_semgrep() {
  if semgrep_binary_usable; then
    XDG_CACHE_HOME="$SEMGREP_RUNTIME_CACHE_ROOT" \
      SEMGREP_USER_HOME="$SEMGREP_RUNTIME_USER_HOME" \
      SEMGREP_LOG_FILE="$SEMGREP_RUNTIME_LOG_FILE" \
      "$SEMGREP_BIN" "$@"
    return
  fi

  PYTHONPATH="$SEMGREP_SITE_PACKAGES_DIR${PYTHONPATH:+:$PYTHONPATH}" \
    XDG_CACHE_HOME="$SEMGREP_RUNTIME_CACHE_ROOT" \
    SEMGREP_USER_HOME="$SEMGREP_RUNTIME_USER_HOME" \
    SEMGREP_LOG_FILE="$SEMGREP_RUNTIME_LOG_FILE" \
    python3 -m semgrep "$@"
}

semgrep_version_usable() {
  local detected_version
  detected_version="$(detect_semgrep_package_version | tr -d "[:space:]")" || return 1
  if [[ "$detected_version" == "$SEMGREP_VERSION" ]]; then
    return 0
  fi
  # Some Python runtimes cannot resolve older Semgrep pins and install a newer
  # compatible release instead. Accept only newer patch releases in the same
  # major.minor package series to avoid cross-series scanner drift.
  local requested_series detected_series
  requested_series="${SEMGREP_VERSION%.*}"
  detected_series="${detected_version%.*}"
  if [[ -z "$requested_series" || -z "$detected_series" ]]; then
    return 1
  fi
  if [[ "$requested_series" != "$detected_series" ]]; then
    return 1
  fi
  [[ "$(printf '%s\n%s\n' "$SEMGREP_VERSION" "$detected_version" | sort -V | head -n 1)" == "$SEMGREP_VERSION" ]]
}

ensure_python_packaging_tools() {
  if [[ -z "${CI:-}" && -z "${CIRCLECI:-}" ]]; then
    return 1
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    return 1
  fi

  if [[ "$(id -u)" -eq 0 ]]; then
    apt-get update >/dev/null &&
      apt-get install -y python3-pip python3-venv >/dev/null || return 1
    python3 -m pip --version >/dev/null 2>&1 || return 1
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update >/dev/null &&
      sudo apt-get install -y python3-pip python3-venv >/dev/null || return 1
    python3 -m pip --version >/dev/null 2>&1 || return 1
    return 0
  fi

  return 1
}

install_semgrep_with_venv() {
  rm -rf "$SEMGREP_VENV_DIR"
  if ! python3 -m venv "$SEMGREP_VENV_DIR" >/dev/null 2>&1; then
    return 1
  fi
  if ! "$SEMGREP_PYTHON" -m pip install --quiet --upgrade pip "$SEMGREP_PIP_SPEC"; then
    return 1
  fi
  semgrep_binary_usable && semgrep_version_usable
}

install_semgrep_with_site_packages() {
  if ! python3 -m pip --version >/dev/null 2>&1; then
    return 1
  fi
  rm -rf "$SEMGREP_VENV_DIR"
  rm -f "$SEMGREP_BIN"
  rm -rf "$SEMGREP_SITE_PACKAGES_DIR"
  mkdir -p "$SEMGREP_SITE_PACKAGES_DIR"
  if ! python3 -m pip install --quiet --upgrade --target "$SEMGREP_SITE_PACKAGES_DIR" "$SEMGREP_PIP_SPEC"; then
    return 1
  fi
  semgrep_version_usable
}

install_semgrep() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: python3 is required to install Semgrep." >&2
    exit 1
  fi

  mkdir -p "$SEMGREP_STATE_ROOT" "$SEMGREP_RUNTIME_CACHE_ROOT" "$SEMGREP_RUNTIME_USER_HOME"
  mkdir -p "$(dirname "$SEMGREP_RUNTIME_LOG_FILE")"
  mkdir -p "$SEMGREP_CACHE_ROOT"

  local legacy_venv_dir="$HOST_CACHE_HOME/coding-harness/semgrep-venv-${SEMGREP_VERSION}"
  if [[ -d "$legacy_venv_dir" ]]; then
    rm -rf "$SEMGREP_VENV_DIR"
    cp -a "$legacy_venv_dir" "$SEMGREP_VENV_DIR"
    if semgrep_binary_usable && semgrep_version_usable; then
      return
    fi
    rm -rf "$SEMGREP_VENV_DIR"
  fi

  if install_semgrep_with_venv; then
    return
  fi

  if install_semgrep_with_site_packages; then
    return
  fi

  if ensure_python_packaging_tools; then
    if install_semgrep_with_venv || install_semgrep_with_site_packages; then
      return
    fi
  fi

  echo "Error: unable to install Semgrep ${SEMGREP_VERSION} or newer." >&2
  echo "Tried venv + pip install paths and CI packaging bootstrap." >&2
  exit 1
}

has_semgrep_installation() {
  if semgrep_binary_usable && semgrep_version_usable; then
    return 0
  fi

  if [[ -d "$SEMGREP_SITE_PACKAGES_DIR/semgrep" ]] && semgrep_version_usable; then
    return 0
  fi

  return 1
}

ensure_semgrep_version() {
  if ! has_semgrep_installation; then
    install_semgrep
  elif ! semgrep_version_usable; then
    install_semgrep
  fi

  if ! semgrep_version_usable; then
    echo "Error: semgrep bootstrap did not provision Semgrep ${SEMGREP_VERSION}." >&2
    exit 1
  fi
}
