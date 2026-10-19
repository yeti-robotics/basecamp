#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required. Install the version in package.json before setting up this worktree." >&2
  exit 1
fi

pnpm install --frozen-lockfile

if [[ ! -f apps/api/.env.local && ! -f apps/api/.env ]]; then
  echo "Note: add apps/api/.env.local before starting the API." >&2
fi
if [[ ! -f apps/dashboard/.env.local ]]; then
  echo "Note: add apps/dashboard/.env.local before starting the dashboard." >&2
fi

echo "Worktree dependencies are ready."
