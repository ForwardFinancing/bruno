#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN is not set"
  exit 1
fi

echo "Building dependencies..."

echo "[1/5] bruno-schema-types"
npm run build --workspace=packages/bruno-schema-types

echo "[2/5] bruno-common"
npm run build --workspace=packages/bruno-common

echo "[3/5] bruno-requests"
npm run build --workspace=packages/bruno-requests

echo "[4/5] bruno-filestore"
npm run build --workspace=packages/bruno-filestore

echo "[5/5] bruno-converters"
npm run build --workspace=packages/bruno-converters

echo ""
echo "Publishing..."

echo "Publishing @forwardfinancing/bruno-converters"
npm publish --workspace=packages/bruno-converters

echo "Publishing @forwardfinancing/bruno-cli"
npm publish --workspace=packages/bruno-cli

echo ""
echo "Done."
