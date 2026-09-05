#!/usr/bin/env bash
# deploy-pages.sh — publish dist/ to Cloudflare Pages with wrangler.
#
# This script was a 3-line stub that appended a line to BUILD-STATE.md and never deployed
# anything, using $SHA and $BRANCH which it also never set. Anything that "deployed" through it
# published nothing.
#
# Direct wrangler upload by design: this project must never gain a GitHub remote, so there is no
# git-push-triggered build. There is also no git repo here, so the build identifier is the
# content hash written by scripts/gen-build-id.mjs — the same value stamped into every page as
# <meta name="build-commit">, which makes a served page traceable to the source that built it.
#
#   bash scripts/deploy-pages.sh            # production branch of the Pages project
#   bash scripts/deploy-pages.sh --preview  # preview branch
#   bash scripts/deploy-pages.sh --dry-run  # every pre-check, print the wrangler line, deploy NOTHING
#
# RULE 11's SCAFFOLD GREEN row runs the --dry-run form; before 2026-09-03 this script
# answered it with "FAIL: unknown argument", so the rule's own proof could not pass.
#
# Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment. Load them by NAME:
#   python ~/.claude/scripts/with_env.py -- bash scripts/deploy-pages.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# project-config.md values carry trailing `# ...` comments. Not stripping one put the
# whole comment into --project-name, so the deploy would have targeted a project that
# does not exist. The --dry-run form is what surfaced it.
# 2026-09-05: the key is written as a markdown bullet on most projects
# (`- **CLOUDFLARE_PROJECT:** name`). The anchored, plain-key grep matched nothing, and
# because `set -e` kills the script when a command substitution's grep exits 1, the whole
# deploy - dry run included - ended SILENTLY with status 1 and no message at all.
PROJECT="$(grep -E '^[[:space:]]*[-*]?[[:space:]]*(\*\*)?CLOUDFLARE_PROJECT(\*\*)?[[:space:]]*[:=]' config/project-config.md | head -1 | sed 's/^[^:=]*[:=][[:space:]]*//' | sed 's/[[:space:]]*#.*//' | sed 's/\*\*//g' | sed 's/^[[:space:]]*//' | tr -d '\r' | sed 's/[[:space:]]*$//' || true)"
[ -n "$PROJECT" ] || { echo "FAIL: CLOUDFLARE_PROJECT missing from config/project-config.md"; exit 1; }

[ -d dist ] || { echo "FAIL: dist/ does not exist — run 'npm run build' first"; exit 1; }
[ -f dist/index.html ] || { echo "FAIL: dist/index.html missing — the build did not complete"; exit 1; }

# The _headers file carries the staging X-Robots-Tag. This check used to be unconditional,
# which is correct for a site that has not launched and DANGEROUS for one that has: on a
# LIVE project it demands the very header that would noindex the production site, and the
# obvious way to "fix" the failure is to add one. Branch on LAUNCH_STATUS, and on a LIVE
# project assert the OPPOSITE - that no blanket noindex is about to ship.
LAUNCH_STATUS="$(grep -E '^[[:space:]]*[-*]?[[:space:]]*(\*\*)?LAUNCH_STATUS(\*\*)?[[:space:]]*[:=]' config/project-config.md | head -1 | sed 's/^[^:=]*[:=][[:space:]]*//' | sed 's/[[:space:]]*#.*//' | sed 's/\*\*//g' | sed 's/^[[:space:]]*//' | tr -d '
' | awk '{print $1}' || true)"
if [ "${LAUNCH_STATUS:-}" = "LIVE" ]; then
  # SCOPE MATTERS (2026-09-05). A correct _headers file noindexes the PREVIEW hosts
  # (*.pages.dev) and nothing else. The old grep was file-wide, so it read that correct
  # block as "the production site is about to be de-indexed" and blocked every deploy of
  # every live project - and the obvious way to satisfy it is to delete the one noindex
  # that should be there. Only a noindex OUTSIDE a pages.dev block is the danger.
  if [ -f dist/_headers ] && awk '
      /^[^[:space:]#]/ { block = $0 }
      /X-Robots-Tag:.*noindex/ { if (block !~ /pages\.dev/) { found = 1 } }
      END { exit(found ? 0 : 1) }' dist/_headers; then
    echo "FAIL: LAUNCH_STATUS is LIVE but dist/_headers carries a noindex X-Robots-Tag."
    echo "      Deploying this would de-index the production site. Remove it, or set"
    echo "      LAUNCH_STATUS back if this project is not actually live."
    exit 1
  fi
  echo "pre-check: LAUNCH_STATUS=LIVE, no blanket noindex in dist/_headers"
else
  [ -f dist/_headers ] || { echo "FAIL: dist/_headers missing — staging would be indexable"; exit 1; }
  grep -q 'X-Robots-Tag' dist/_headers || { echo "FAIL: dist/_headers carries no X-Robots-Tag"; exit 1; }
fi

BRANCH="preview"
DRY=0
case "${1:-}" in
  --preview) BRANCH="preview" ;;
  --production|"") BRANCH="main" ;;
  --dry-run) BRANCH="main"; DRY=1 ;;
  *) echo "FAIL: unknown argument '$1'"; exit 1 ;;
esac

SHA="$(node -e "process.stdout.write(require('./src/data/build-id.json').id)")"

# RULE 11: the PINNED devDependency is what deploys. `wrangler@latest` silently changed the
# deploying binary between two runs of the same gate, which is the one thing a deploy step
# must not do — the pin lives in package.json and `npx wrangler` resolves it locally.
WRANGLER_LINE="npx wrangler pages deploy dist --project-name $PROJECT --branch $BRANCH --commit-dirty=true"

if [ "$DRY" = "1" ]; then
  echo "DRY RUN — every pre-check passed; would run:"
  echo "  $WRANGLER_LINE"
  echo "dry-run project=$PROJECT branch=$BRANCH build=$SHA (nothing was uploaded)"
  exit 0
fi

echo "deploying project=$PROJECT branch=$BRANCH build=$SHA"
npx wrangler pages deploy dist \
  --project-name "$PROJECT" \
  --branch "$BRANCH" \
  --commit-dirty=true

printf '\n- deployed_build: %s · deployed_at: %s · branch: %s · project: %s\n' \
  "$SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BRANCH" "$PROJECT" >> BUILD-STATE.md
echo "recorded in BUILD-STATE.md"
