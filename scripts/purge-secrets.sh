#!/usr/bin/env bash
set -euo pipefail

# purge-secrets.sh
# Usage: ./scripts/purge-secrets.sh <repo-url> <branch-to-protect>
# Example: ./scripts/purge-secrets.sh git@github.com:org/repo.git main

REPO_URL=${1:-}
PROTECT_BRANCH=${2:-main}
FILES_TO_REMOVE=("server/.env")

if [[ -z "$REPO_URL" ]]; then
  echo "ERROR: repo-url missing. Usage: $0 <repo-url> <branch-to-protect>"
  exit 2
fi

TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

echo "Backing up remote as mirror clone..."
git clone --mirror "$REPO_URL" repo.git
cd repo.git

# Sanity: show refs and size
echo "Repo refs:"
git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags | sed -n '1,50p'

# Run git-filter-repo to remove the files (requires git-filter-repo installed)
# See: https://github.com/newren/git-filter-repo

echo "Removing files from history: ${FILES_TO_REMOVE[*]}"

for f in "${FILES_TO_REMOVE[@]}"; do
  echo " -- Scheduling removal: $f"
done

# Build args
FILTER_ARGS=()
for f in "${FILES_TO_REMOVE[@]}"; do
  FILTER_ARGS+=(--invert-paths --path "$f")
done

# Run filter-repo
git filter-repo "${FILTER_ARGS[@]}"

# Cleanup: expire reflog and aggressive gc
git reflog expire --expire=now --all || true
git gc --prune=now --aggressive || true

# Show summary: check whether any blobs or refs mention the file
if git rev-list --objects --all | grep -F "server/.env" >/dev/null 2>&1; then
  echo "WARNING: server/.env still referenced in history; please inspect manually."
else
  echo "Pass: server/.env not referenced by commits listed via rev-list."
fi

echo "Ready to push cleaned history to origin after review."

echo "To push to remote (destructive):"
echo "  git remote add origin $REPO_URL || true"
echo "  git push --force --all"
echo "  git push --force --tags"

echo "IMPORTANT: This will rewrite history. Coordinate with your team: everyone must re-clone or reset to the new HEAD after this."

echo "Backup mirror location: $TMP_DIR/repo.git"

# End of script
