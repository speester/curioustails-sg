#!/usr/bin/env bash
set -euo pipefail
SRC="/d/Claude Code/Curious Tails"
DST="/c/Users/admin/AppData/Local/Temp/opencode/k129-scoped"
cd "$SRC"
git show "HEAD:src/pages/puppies/[breed]/[id].astro" > "$DST/src/pages/puppies/[breed]/[id].astro"
rm -rf "$DST/src/components/puppy-page"
echo "reverted [id].astro to HEAD and removed puppy-page/"
wc -l "$DST/src/pages/puppies/[breed]/[id].astro"
