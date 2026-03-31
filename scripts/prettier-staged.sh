#!/usr/bin/env bash

set -euo pipefail

files=()

while IFS= read -r -d '' file; do
  [ -e "$file" ] || continue
  [ -L "$file" ] && continue

  case "$file" in
    *.astro|*.css|*.html|*.js|*.json|*.jsx|*.md|*.mjs|*.ts|*.tsx|*.yaml|*.yml)
      files+=("$file")
      ;;
  esac
done < <(git diff --cached --name-only --diff-filter=ACMR -z)

if [ "${#files[@]}" -gt 0 ]; then
  npx prettier --write "${files[@]}"
  git add -- "${files[@]}"
fi
