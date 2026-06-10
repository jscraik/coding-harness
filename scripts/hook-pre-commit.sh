#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

bash ./scripts/check-hook-critical-config-sync.sh
make codestyle-parity
pnpm lint
pnpm docs:lint
pnpm typecheck
pnpm run quality:docstrings
pnpm run quality:size
pnpm run quality:behavior-tests
pnpm run quality:git-env-sanitizer
pnpm run harness:audit-tracking
make secrets-staged
make docs-style-changed
make related-tests-staged
