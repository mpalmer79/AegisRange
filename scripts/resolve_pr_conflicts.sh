#!/usr/bin/env bash
set -euo pipefail

# Resolves the known Phase 3 PR conflict surface by favoring this branch's
# backend implementation for the files GitHub reports as conflicted.
#
# Usage:
#   bash scripts/resolve_pr_conflicts.sh
#
# Optional:
#   BASE_REF=origin/main bash scripts/resolve_pr_conflicts.sh

BASE_REF="${BASE_REF:-origin/main}"

CONFLICT_FILES=(
  "README.md"
  "backend/app/main.py"
  "backend/app/services/detection_service.py"
  "backend/app/services/document_service.py"
  "backend/app/services/event_services.py"
  "backend/app/services/incident_service.py"
  "backend/app/services/response_service.py"
  "backend/app/store.py"
  "backend/tests/test_pipeline.py"
)

echo "Fetching latest refs..."
git fetch --all --prune

echo "Rebasing current branch onto ${BASE_REF}..."
if git rebase "${BASE_REF}"; then
  echo "Rebase completed without conflicts."
  exit 0
fi

echo "Conflicts detected. Applying branch versions for known files..."
git checkout --ours "${CONFLICT_FILES[@]}"
git add "${CONFLICT_FILES[@]}"
git rebase --continue

echo "Rebase conflict resolution complete."
echo "Run tests:"
echo "  python -m compileall backend/app backend/tests"
echo "  PYTHONPATH=backend python -m unittest discover -s backend/tests -v"
